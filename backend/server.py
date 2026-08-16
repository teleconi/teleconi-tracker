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

ROLES = {"Owner", "Engineer", "PM", "PCM", "Project Manager", "Project Controller"}
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
    ktp: str = ""
    bpjs: str = ""
    address: str = ""
    gaji: str = ""
    bank: str = ""
    no_rek: str = ""
    join_date: str = ""


class EmployeeUpsert(BaseModel):
    name: str
    role: str
    ktp: str = "tbd"
    bpjs: str = "tbd"
    address: str = ""
    gaji: str = "tbd"
    bank: str = ""
    no_rek: str = ""
    join_date: str = ""


class EmployeeCreate(EmployeeUpsert):
    employee_id: str
    password: str = "123"


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
    post: str
    category: str
    amount: float
    keterangan: str = ""
    remarks: str


class InvoiceCreate(BaseModel):
    invoice_number: str
    po_number: str
    amount: float
    due_date: str


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
        ktp=str(user.get("ktp", "")), bpjs=str(user.get("bpjs", "")),
        address=str(user.get("address", "")), gaji=str(user.get("gaji", "")),
        bank=str(user.get("bank", "")), no_rek=str(user.get("no_rek", "")),
        join_date=str(user.get("join_date", "")),
    )


def require_owner(user: dict):
    if user.get("role") != "Owner":
        raise HTTPException(status_code=403, detail="Hanya Owner yang dapat mengubah data")


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
async def dashboard(user: Annotated[dict, Depends(current_user)], project: Optional[str] = None):
    all_pos = await build_pos()
    selected = project if project and project != "All Project" else None
    pos = [p for p in all_pos if (selected is None or p["project_name"] == selected)]
    projects = [p["project_name"] for p in all_pos]

    total_po = sum(p["po_amount"] for p in pos)
    total_actual = sum(p["actual_cost"] for p in pos)
    total_budget = sum(p["budget"] for p in pos)
    profit = total_po - total_actual
    margin = round(profit / total_po * 100, 1) if total_po else 0
    utilization = round(total_actual / total_budget * 100, 1) if total_budget else 0

    cost_match = {"project_name": selected} if selected else {}

    # monthly trend (Jan-Aug 2026)
    months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]
    trend_pipe = ([{"$match": cost_match}] if cost_match else []) + [{"$group": {"_id": "$month", "total": {"$sum": "$amount"}}}]
    trend_raw = await db.costs.aggregate(trend_pipe).to_list(100)
    trend_map = {t["_id"]: t["total"] for t in trend_raw}
    trend = [{"month": m, "label": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"][i], "total": float(trend_map.get(m, 0))} for i, m in enumerate(months)]
    peak = max(trend, key=lambda x: x["total"]) if trend else {"label": "-", "total": 0}

    summary = [{"project_name": p["project_name"], "po_amount": p["po_amount"], "budget": p["budget"], "actual_cost": p["actual_cost"], "remaining": p["po_amount"] - p["actual_cost"]} for p in pos]

    total_cost = total_actual or 1
    cost_by_project = [{"name": p["project_name"], "pct": round(p["actual_cost"] / total_cost * 100)} for p in pos if p["actual_cost"] > 0]

    cat_pipe = ([{"$match": cost_match}] if cost_match else []) + [{"$group": {"_id": "$post", "total": {"$sum": "$amount"}}}, {"$sort": {"total": -1}}]
    cat_raw = await db.costs.aggregate(cat_pipe).to_list(100)
    cost_by_category = [{"name": c["_id"] or "Lainnya", "pct": round(c["total"] / total_cost * 100)} for c in cat_raw]

    user_pipe = ([{"$match": cost_match}] if cost_match else []) + [{"$group": {"_id": "$submitted_by", "total": {"$sum": "$amount"}, "role": {"$first": "$role"}}}, {"$sort": {"total": -1}}, {"$limit": 5}]
    user_raw = await db.costs.aggregate(user_pipe).to_list(100)
    cost_by_user = [{"name": u["_id"] or "-", "role": u.get("role") or "", "total": float(u["total"])} for u in user_raw]

    return {
        "greeting_name": user["name"].split(" ")[0],
        "projects": projects,
        "selected_project": project or "All Project",
        "total_profit": profit,
        "profit_margin": margin,
        "total_po": total_po,
        "total_actual": total_actual,
        "total_budget": total_budget,
        "budget_utilization": utilization,
        "summary": summary,
        "trend": trend,
        "peak_month": peak,
        "cost_by_project": cost_by_project,
        "cost_by_category": cost_by_category,
        "cost_by_user": cost_by_user,
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
    if user["role"] not in ("Owner", "PM", "PCM", "Project Manager", "Project Controller"):
        raise HTTPException(status_code=403, detail="Not allowed to add POs")
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


# ---- invoices ----
@api.get("/invoices")
async def list_invoices(user: Annotated[dict, Depends(current_user)]):
    invoices = await db.invoices.find({}, {"_id": 0}).sort("invoice_number", 1).to_list(1000)
    return {"invoices": invoices}


@api.post("/invoices")
async def create_invoice(body: InvoiceCreate, user: Annotated[dict, Depends(current_user)]):
    if user["role"] not in ("Owner", "PM", "PCM", "Project Manager", "Project Controller"):
        raise HTTPException(status_code=403, detail="Not allowed")
    if await db.invoices.find_one({"invoice_number": body.invoice_number}):
        raise HTTPException(status_code=400, detail="Invoice number already exists")
    doc = {"id": str(uuid.uuid4()), **body.model_dump(), "paid": False}
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.post("/invoices/{invoice_number}/toggle")
async def toggle_invoice(invoice_number: str, user: Annotated[dict, Depends(current_user)]):
    if user["role"] not in ("Owner", "PM", "PCM", "Project Manager", "Project Controller"):
        raise HTTPException(status_code=403, detail="Not allowed")
    inv = await db.invoices.find_one({"invoice_number": invoice_number})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    new_paid = not inv.get("paid", False)
    await db.invoices.update_one({"invoice_number": invoice_number}, {"$set": {"paid": new_paid}})
    return {"invoice_number": invoice_number, "paid": new_paid}


# ---- operational costs ----
@api.get("/costs")
async def list_costs(user: Annotated[dict, Depends(current_user)]):
    costs = await db.costs.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return {"costs": costs, "count": len(costs)}


@api.post("/costs")
async def create_cost(body: CostCreate, user: Annotated[dict, Depends(current_user)]):
    if not body.remarks.strip():
        raise HTTPException(status_code=400, detail="Remarks wajib diisi")
    month = body.date[:7] if len(body.date) >= 7 and body.date[4] == "-" else CURRENT_MONTH
    doc = {
        "id": str(uuid.uuid4()), "date": body.date, "month": month, "project_name": body.project_name,
        "site_name": body.site_name, "post": body.post, "category": body.category, "amount": body.amount,
        "keterangan": body.keterangan, "remarks": body.remarks, "submitted_by": user["name"],
        "submitted_by_id": user["employee_id"], "role": user["role"], "status": "Pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.costs.insert_one(doc)
    doc.pop("_id", None)
    return doc


# ---- employees ----
@api.get("/employees")
async def list_employees(user: Annotated[dict, Depends(current_user)]):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).sort("employee_id", 1).to_list(1000)
    salaries = await db.salaries.find({"month": CURRENT_MONTH}, {"_id": 0}).to_list(1000)
    paid_map = {s["employee_id"]: s["paid"] for s in salaries}
    employees = []
    for u in users:
        pub = to_public(u).model_dump()
        pub["paid"] = paid_map.get(u["employee_id"], False)
        employees.append(pub)
    return {"employees": employees, "month": CURRENT_MONTH, "total_count": len(employees)}


@api.post("/employees", response_model=PublicUser, status_code=201)
async def create_employee(body: EmployeeCreate, user: Annotated[dict, Depends(current_user)]):
    require_owner(user)
    eid = body.employee_id.strip()
    if not eid or not body.name.strip():
        raise HTTPException(status_code=400, detail="Employee ID dan Nama wajib diisi")
    if await db.users.find_one({"employee_id": eid}):
        raise HTTPException(status_code=400, detail="Employee ID sudah digunakan")
    doc = body.model_dump()
    doc.pop("password", None)
    doc["employee_id"] = eid
    doc["no_rek"] = str(body.no_rek)
    doc["password_hash"] = hash_password(body.password or "123")
    await db.users.insert_one(doc)
    await db.salaries.update_one({"employee_id": eid, "month": CURRENT_MONTH}, {"$set": {"paid": False}}, upsert=True)
    saved = await db.users.find_one({"employee_id": eid}, {"_id": 0})
    return to_public(saved)


@api.patch("/employees/{employee_id}", response_model=PublicUser)
async def update_employee(employee_id: str, body: EmployeeUpsert, user: Annotated[dict, Depends(current_user)]):
    require_owner(user)
    existing = await db.users.find_one({"employee_id": employee_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Karyawan tidak ditemukan")
    update = body.model_dump()
    update["no_rek"] = str(body.no_rek)
    await db.users.update_one({"employee_id": employee_id}, {"$set": update})
    saved = await db.users.find_one({"employee_id": employee_id}, {"_id": 0})
    return to_public(saved)


# ---- salary ----


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
    {"employee_id": "00101", "name": "Teleconi", "role": "Owner", "password": "123", "email": "owner@teleconi.id", "ktp": "tbd", "join_date": "01 Aug 2026", "bpjs": "tbd", "address": "jakarta", "gaji": "tbd", "bank": "Mandiri", "no_rek": "123", "salary_amount": 0},
    {"employee_id": "00201", "name": "Pahala Sidauruk", "role": "PM", "password": "123", "email": "pahala@teleconi.id", "ktp": "tbd", "join_date": "01 Aug 2026", "bpjs": "tbd", "address": "jakarta", "gaji": "tbd", "bank": "BCA", "no_rek": "7151611471", "salary_amount": 0},
    {"employee_id": "00202", "name": "Yendro Makendro Sija", "role": "Engineer", "password": "123", "email": "yendro@teleconi.id", "ktp": "tbd", "join_date": "01 Aug 2026", "bpjs": "tbd", "address": "jakarta", "gaji": "tbd", "bank": "Mandiri", "no_rek": "7151611471", "salary_amount": 0},
    {"employee_id": "00203", "name": "Rofinus Hada", "role": "Engineer", "password": "123", "email": "rofinus@teleconi.id", "ktp": "tbd", "join_date": "01 Aug 2026", "bpjs": "tbd", "address": "jakarta", "gaji": "tbd", "bank": "BCA", "no_rek": "7795330801", "salary_amount": 0},
    {"employee_id": "00204", "name": "Devi", "role": "PCM", "password": "123", "email": "tbd", "ktp": "tbd", "join_date": "tbd", "bpjs": "tbd", "address": "tbd", "gaji": "tbd", "bank": "tbd", "no_rek": "tbd", "salary_amount": 0},
]

DEMO_POS = [
    {"id": str(uuid.uuid4()), "po_number": "PO-2026-001", "project_name": "Moratel DWDM", "location": "Bank Mandiri", "po_amount": 450_000_000, "budget": 150_000_000, "status": "Active"},
    {"id": str(uuid.uuid4()), "po_number": "PO-2026-002", "project_name": "Moratel OLT", "location": "Bali", "po_amount": 300_000_000, "budget": 107_000_000, "status": "Active"},
]

DEMO_COSTS = [
    {"date": "2026-01-14", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "post": "4.0 Transportation", "category": "4.1 Flight", "amount": 12_000_000, "remarks": "Site mobilization", "submitted_by": "Yendro Makendro Sija", "role": "Engineer"},
    {"date": "2026-02-09", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "post": "3.0 Accomodation", "category": "3.1 Hotel", "amount": 15_000_000, "remarks": "Team lodging", "submitted_by": "Rofinus Hada", "role": "Engineer"},
    {"date": "2026-03-21", "project_name": "Moratel OLT", "site_name": "Denpasar", "post": "2.0 Operational", "category": "2.1 Fuel", "amount": 8_200_000, "remarks": "Crew fuel", "submitted_by": "Devi", "role": "Engineer"},
    {"date": "2026-04-05", "project_name": "Moratel DWDM", "site_name": "Bekasi", "post": "7.0 Other Project Cost", "category": "7.1 Others", "amount": 20_000_000, "remarks": "Material handling", "submitted_by": "Yendro Makendro Sija", "role": "Engineer"},
    {"date": "2026-05-16", "project_name": "Moratel OLT", "site_name": "Denpasar", "post": "4.0 Transportation", "category": "4.3 Rental Car", "amount": 18_000_000, "remarks": "Equipment transport", "submitted_by": "Pahala Sidauruk", "role": "PM"},
    {"date": "2026-06-12", "project_name": "Moratel DWDM", "site_name": "Bandung", "post": "3.0 Accomodation", "category": "3.1 Hotel", "amount": 28_200_000, "remarks": "Extended stay", "submitted_by": "Rofinus Hada", "role": "Engineer"},
    {"date": "2026-07-08", "project_name": "Moratel OLT", "site_name": "Denpasar", "post": "7.0 Other Project Cost", "category": "7.1 Others", "amount": 22_000_000, "remarks": "Splicing consumables", "submitted_by": "Devi", "role": "Engineer"},
    {"date": "2026-08-17", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "post": "2.0 Operational", "category": "2.2 Toll", "amount": 450_000, "remarks": "Toll — day shift", "submitted_by": "Yendro Makendro Sija", "role": "Engineer"},
    {"date": "2026-08-15", "project_name": "Moratel DWDM", "site_name": "Jakarta Selatan", "post": "4.0 Transportation", "category": "4.2 Train", "amount": 1_200_000, "remarks": "Site transport", "submitted_by": "Rofinus Hada", "role": "Engineer"},
    {"date": "2026-08-18", "project_name": "Moratel OLT", "site_name": "Denpasar", "post": "2.0 Operational", "category": "2.1 Fuel", "amount": 4_000_000, "remarks": "Crew fuel", "submitted_by": "Devi", "role": "Engineer"},
    {"date": "2026-08-11", "project_name": "Moratel DWDM", "site_name": "Bekasi", "post": "5.0 Rental", "category": "5.1 Equipment Rental", "amount": 38_900_000, "remarks": "Fiber drum rental", "submitted_by": "Pahala Sidauruk", "role": "PM"},
]

DEMO_INVOICES = [
    {"invoice_number": "INV-2026-001", "po_number": "PO-2026-001", "amount": 225_000_000, "due_date": "25 Aug 2026", "paid": True},
    {"invoice_number": "INV-2026-002", "po_number": "PO-2026-001", "amount": 225_000_000, "due_date": "10 Sep 2026", "paid": False},
    {"invoice_number": "INV-2026-003", "po_number": "PO-2026-002", "amount": 150_000_000, "due_date": "30 Aug 2026", "paid": True},
    {"invoice_number": "INV-2026-004", "po_number": "PO-2026-002", "amount": 150_000_000, "due_date": "15 Sep 2026", "paid": False},
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
    if await db.invoices.count_documents({}) == 0:
        logger.info("Seeding invoices...")
        await db.invoices.insert_many([{**i, "id": str(uuid.uuid4())} for i in DEMO_INVOICES])
    if await db.costs.count_documents({}) == 0:
        logger.info("Seeding costs...")
        costs = []
        for c in DEMO_COSTS:
            costs.append({**c, "id": str(uuid.uuid4()), "month": c["date"][:7], "keterangan": "", "status": "Approved", "created_at": c["date"] + "T08:00:00+00:00"})
        await db.costs.insert_many(costs)
    if await db.salaries.count_documents({"month": CURRENT_MONTH}) == 0:
        logger.info("Seeding salaries...")
        paid_default = {"00203": True, "00204": True}
        await db.salaries.insert_many([{"employee_id": u["employee_id"], "month": CURRENT_MONTH, "paid": paid_default.get(u["employee_id"], False)} for u in DEMO_USERS])


@app.on_event("shutdown")
async def shutdown():
    client.close()
