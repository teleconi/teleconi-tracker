import os
import logging
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Annotated, List, Optional

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, APIRouter, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("telecony")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = os.environ.get("JWT_ALGORITHM", "HS256")
TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "720"))

ROLES = {"Owner", "Engineer", "PM", "Project Manager", "Project Controller"}
CATEGORIES = ["Makan", "Penginapan", "Transport", "Others"]
CURRENT_MONTH = "2026-08"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# ---- password helpers ----
DUMMY_HASH = bcrypt.hashpw(b"dummy-not-used", bcrypt.gensalt()).decode()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8")[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], stored.encode("utf-8"))
    except Exception:
        return False


def create_access_token(employee_id: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": employee_id, "role": role, "iat": now, "exp": now + timedelta(minutes=TOKEN_MINUTES)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# ---- models ----
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PublicUser(BaseModel):
    employee_id: str
    name: str
    role: str
    email: str
    ktp: str
    join_date: str
    bpjs: str
    salary_amount: float


class POCreate(BaseModel):
    po_number: str
    project_name: str
    location: str
    po_amount: float
    budget: Optional[float] = None


class PO(BaseModel):
    id: str
    po_number: str
    project_name: str
    location: str
    po_amount: float
    budget: float
    actual_cost: float = 0
    utilization: float = 0
    status: str = "Active"


class CostCreate(BaseModel):
    date: str
    project_name: str
    site_name: str
    category: str
    amount: float
    keterangan: str


class ChangePassword(BaseModel):
    new_password: str


app = FastAPI(title="Telecony Ops Tracker API")
api = APIRouter(prefix="/api")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


# ---- auth deps ----
async def current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> dict:
    cred_error = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token", headers={"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        employee_id = payload.get("sub")
        if not isinstance(employee_id, str) or not employee_id:
            raise cred_error
    except InvalidTokenError:
        raise cred_error
    user = await db.users.find_one({"employee_id": employee_id}, {"_id": 0})
    if not user or user.get("role") not in ROLES:
        raise cred_error
    return user


def to_public(user: dict) -> PublicUser:
    return PublicUser(
        employee_id=user["employee_id"], name=user["name"], role=user["role"],
        email=user.get("email", ""), ktp=user.get("ktp", ""),
        join_date=user.get("join_date", ""), bpjs=user.get("bpjs", "Active"),
        salary_amount=user.get("salary_amount", 0),
    )


# ---- auth routes ----
@api.post("/auth/login", response_model=Token)
async def login(form: Annotated[OAuth2PasswordRequestForm, Depends()]):
    employee_id = form.username.strip()
    user = await db.users.find_one({"employee_id": employee_id})
    stored = user["password_hash"] if user else DUMMY_HASH
    if not verify_password(form.password, stored):
        raise HTTPException(status_code=401, detail="Invalid employee ID or password", headers={"WWW-Authenticate": "Bearer"})
    return Token(access_token=create_access_token(user["employee_id"], user["role"]))


@api.get("/auth/me", response_model=PublicUser)
async def me(user: Annotated[dict, Depends(current_user)]):
    return to_public(user)


@api.post("/auth/change-password")
async def change_password(body: ChangePassword, user: Annotated[dict, Depends(current_user)]):
    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    await db.users.update_one({"employee_id": user["employee_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"message": "Password updated"}


# ---- helpers ----
async def actual_cost_for(project_name: str) -> float:
    pipeline = [{"$match": {"project_name": project_name}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]
    res = await db.costs.aggregate(pipeline).to_list(1)
    return float(res[0]["total"]) if res else 0.0


async def build_pos() -> List[dict]:
    pos = await db.pos.find({}, {"_id": 0}).sort("po_number", 1).to_list(1000)
    out = []
    for po in pos:
        actual = await actual_cost_for(po["project_name"])
        util = round((actual / po["po_amount"] * 100), 1) if po["po_amount"] else 0
        out.append({**po, "actual_cost": actual, "utilization": util})
    return out


# ---- dashboard ----
@api.get("/dashboard")
async def dashboard(user: Annotated[dict, Depends(current_user)]):
    pos = await build_pos()
    total_po = sum(p["po_amount"] for p in pos)
    total_actual = sum(p["actual_cost"] for p in pos)
    total_budget = sum(p["budget"] for p in pos)
    profit = total_po - total_actual
    margin = round(profit / total_po * 100, 1) if total_po else 0
    utilization = round(total_actual / total_budget * 100, 1) if total_budget else 0

    # monthly trend (Jan-Aug 2026)
    months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]
    trend_pipe = [{"$group": {"_id": "$month", "total": {"$sum": "$amount"}}}]
    trend_raw = await db.costs.aggregate(trend_pipe).to_list(100)
    trend_map = {t["_id"]: t["total"] for t in trend_raw}
    trend = [{"month": m, "label": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"][i], "total": float(trend_map.get(m, 0))} for i, m in enumerate(months)]
    peak = max(trend, key=lambda x: x["total"]) if trend else {"label": "-", "total": 0}

    summary = [{"project_name": p["project_name"], "po_amount": p["po_amount"], "actual_cost": p["actual_cost"], "remaining": p["po_amount"] - p["actual_cost"]} for p in pos]

    return {
        "greeting_name": user["name"].split(" ")[0],
        "total_profit": profit,
        "profit_margin": margin,
        "total_po": total_po,
        "total_actual": total_actual,
        "total_budget": total_budget,
        "budget_utilization": utilization,
        "summary": summary,
        "trend": trend,
        "peak_month": peak,
    }


# ---- POs ----
@api.get("/pos")
async def list_pos(user: Annotated[dict, Depends(current_user)]):
    pos = await build_pos()
    total_po = sum(p["po_amount"] for p in pos)
    total_actual = sum(p["actual_cost"] for p in pos)
    return {"pos": pos, "total_po": total_po, "total_actual": total_actual, "remaining": total_po - total_actual}


@api.post("/pos", response_model=PO)
async def create_po(body: POCreate, user: Annotated[dict, Depends(current_user)]):
    if user["role"] not in ("Owner", "PM", "Project Manager"):
        raise HTTPException(status_code=403, detail="Only Owner or Project Manager can add POs")
    existing = await db.pos.find_one({"po_number": body.po_number})
    if existing:
        raise HTTPException(status_code=400, detail="PO number already exists")
    doc = {
        "id": str(uuid.uuid4()), "po_number": body.po_number, "project_name": body.project_name,
        "location": body.location, "po_amount": body.po_amount,
        "budget": body.budget if body.budget else body.po_amount * 0.35, "status": "Active",
    }
    await db.pos.insert_one(doc)
    doc.pop("_id", None)
    return PO(**doc, actual_cost=0, utilization=0)


# ---- operational costs ----
@api.get("/costs")
async def list_costs(user: Annotated[dict, Depends(current_user)]):
    costs = await db.costs.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    return {"costs": costs, "count": len(costs)}


@api.post("/costs")
async def create_cost(body: CostCreate, user: Annotated[dict, Depends(current_user)]):
    if body.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category")
    if not body.keterangan.strip():
        raise HTTPException(status_code=400, detail="Keterangan is required")
    month = body.date[:7] if len(body.date) >= 7 and body.date[4] == "-" else CURRENT_MONTH
    doc = {
        "id": str(uuid.uuid4()), "date": body.date, "month": month, "project_name": body.project_name,
        "site_name": body.site_name, "category": body.category, "amount": body.amount,
        "keterangan": body.keterangan, "submitted_by": user["name"], "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.costs.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---- salary ----
@api.get("/employees")
async def list_employees(user: Annotated[dict, Depends(current_user)]):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("employee_id", 1).to_list(1000)
    salaries = await db.salaries.find({"month": CURRENT_MONTH}, {"_id": 0}).to_list(1000)
    paid_map = {s["employee_id"]: s["paid"] for s in salaries}
    employees = []
    total = 0
    paid_count = 0
    for u in users:
        paid = paid_map.get(u["employee_id"], False)
        amt = u.get("salary_amount", 0)
        total += amt
        if paid:
            paid_count += 1
        employees.append({"employee_id": u["employee_id"], "name": u["name"], "role": u["role"], "salary_amount": amt, "paid": paid})
    return {"employees": employees, "month": CURRENT_MONTH, "total_payroll": total, "paid_count": paid_count, "total_count": len(employees)}


@api.post("/salaries/toggle")
async def toggle_salary(body: dict, user: Annotated[dict, Depends(current_user)]):
    if user["role"] not in ("Owner", "PM", "Project Manager"):
        raise HTTPException(status_code=403, detail="Not allowed to change payment status")
    employee_id = body.get("employee_id")
    existing = await db.salaries.find_one({"employee_id": employee_id, "month": CURRENT_MONTH})
    new_paid = not (existing and existing.get("paid"))
    await db.salaries.update_one({"employee_id": employee_id, "month": CURRENT_MONTH}, {"$set": {"paid": new_paid}}, upsert=True)
    return {"employee_id": employee_id, "paid": new_paid}


@api.post("/salaries/pay-all")
async def pay_all(user: Annotated[dict, Depends(current_user)]):
    if user["role"] not in ("Owner", "PM", "Project Manager"):
        raise HTTPException(status_code=403, detail="Not allowed to change payment status")
    users = await db.users.find({}, {"employee_id": 1}).to_list(1000)
    for u in users:
        await db.salaries.update_one({"employee_id": u["employee_id"], "month": CURRENT_MONTH}, {"$set": {"paid": True}}, upsert=True)
    return {"message": "All marked paid"}


app.include_router(api)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ---- seed ----
DEMO_USERS = [
    {"employee_id": "00101", "name": "Teleconi", "role": "Owner", "password": "123", "email": "owner@teleconi.id", "ktp": "", "join_date": "01 Aug 2026", "bpjs": "Active", "bank": "Mandiri", "no_rek": "123", "salary_amount": 20_000_000},
    {"employee_id": "00201", "name": "Pahala Sidauruk", "role": "PM", "password": "123", "email": "pahala@teleconi.id", "ktp": "", "join_date": "01 Aug 2026", "bpjs": "Active", "bank": "BCA", "no_rek": "7151611471", "salary_amount": 12_000_000},
    {"employee_id": "00202", "name": "Yendro Makendro Sija", "role": "Engineer", "password": "123", "email": "yendro@teleconi.id", "ktp": "", "join_date": "01 Aug 2026", "bpjs": "Active", "bank": "Mandiri", "no_rek": "7151611471", "salary_amount": 8_500_000},
    {"employee_id": "00203", "name": "Rofinus Hada", "role": "Engineer", "password": "123", "email": "rofinus@teleconi.id", "ktp": "", "join_date": "01 Aug 2026", "bpjs": "Active", "bank": "BCA", "no_rek": "7795330801", "salary_amount": 8_000_000},
    {"employee_id": "00204", "name": "Aldi Efendi", "role": "Engineer", "password": "123", "email": "aldi@teleconi.id", "ktp": "", "join_date": "01 Aug 2026", "bpjs": "Active", "bank": "BCA", "no_rek": "7535113980", "salary_amount": 8_000_000},
]

DEMO_POS = [
    {"id": str(uuid.uuid4()), "po_number": "PO-2026-001", "project_name": "Moratel DWDM", "location": "Bank Mandiri", "po_amount": 450_000_000, "budget": 150_000_000, "status": "Active"},
    {"id": str(uuid.uuid4()), "po_number": "PO-2026-002", "project_name": "Moratel OLT", "location": "Bali", "po_amount": 300_000_000, "budget": 107_000_000, "status": "Active"},
]

DEMO_COSTS = [
    {"date": "2026-01-14", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "category": "Transport", "amount": 12_000_000, "keterangan": "Site mobilization"},
    {"date": "2026-02-09", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "category": "Penginapan", "amount": 15_000_000, "keterangan": "Team lodging"},
    {"date": "2026-03-21", "project_name": "Moratel OLT", "site_name": "Denpasar", "category": "Makan", "amount": 8_200_000, "keterangan": "Crew meals"},
    {"date": "2026-04-05", "project_name": "Moratel DWDM", "site_name": "Bekasi", "category": "Others", "amount": 20_000_000, "keterangan": "Material handling"},
    {"date": "2026-05-16", "project_name": "Moratel OLT", "site_name": "Denpasar", "category": "Transport", "amount": 18_000_000, "keterangan": "Equipment transport"},
    {"date": "2026-06-12", "project_name": "Moratel DWDM", "site_name": "Bandung", "category": "Penginapan", "amount": 28_200_000, "keterangan": "Extended stay"},
    {"date": "2026-07-08", "project_name": "Moratel OLT", "site_name": "Denpasar", "category": "Others", "amount": 22_000_000, "keterangan": "Splicing consumables"},
    {"date": "2026-08-17", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "category": "Makan", "amount": 450_000, "keterangan": "Meals — day shift"},
    {"date": "2026-08-15", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "category": "Transport", "amount": 1_200_000, "keterangan": "Site transport"},
    {"date": "2026-08-18", "project_name": "Moratel OLT", "site_name": "Denpasar", "category": "Makan", "amount": 4_000_000, "keterangan": "Crew catering"},
    {"date": "2026-08-11", "project_name": "Moratel DWDM", "site_name": "Bekasi", "category": "Others", "amount": 38_900_000, "keterangan": "Fiber drum purchase"},
]


@app.on_event("startup")
async def seed():
    await db.users.create_index("employee_id", unique=True)
    if await db.users.count_documents({}) == 0:
        logger.info("Seeding users...")
        docs = []
        for u in DEMO_USERS:
            d = {k: v for k, v in u.items() if k != "password"}
            d["password_hash"] = hash_password(u["password"])
            docs.append(d)
        await db.users.insert_many(docs)
    if await db.pos.count_documents({}) == 0:
        logger.info("Seeding POs...")
        await db.pos.insert_many([dict(p) for p in DEMO_POS])
    if await db.costs.count_documents({}) == 0:
        logger.info("Seeding costs...")
        costs = []
        for c in DEMO_COSTS:
            costs.append({**c, "id": str(uuid.uuid4()), "month": c["date"][:7], "submitted_by": "Budi Santoso", "status": "Approved", "created_at": datetime.now(timezone.utc).isoformat()})
        await db.costs.insert_many(costs)
    if await db.salaries.count_documents({"month": CURRENT_MONTH}) == 0:
        logger.info("Seeding salaries...")
        paid_default = {"00203": True, "00204": True}
        await db.salaries.insert_many([{"employee_id": u["employee_id"], "month": CURRENT_MONTH, "paid": paid_default.get(u["employee_id"], False)} for u in DEMO_USERS])


@app.on_event("shutdown")
async def shutdown():
    client.close()
