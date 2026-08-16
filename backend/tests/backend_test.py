"""Teleconi Ops Tracker backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _login(uid: str, pw: str = "123") -> str:
    r = requests.post(
        f"{API}/auth/login",
        data={"username": uid, "password": pw},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if r.status_code != 200:
        return ""
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def owner_token():
    tok = _login("00101")
    assert tok, "Owner login failed"
    return tok


@pytest.fixture(scope="session")
def pm_token():
    tok = _login("00201")
    assert tok, "PM login failed"
    return tok


@pytest.fixture(scope="session")
def eng_token():
    tok = _login("00202")
    assert tok, "Engineer login failed"
    return tok


def h(tok): return {"Authorization": f"Bearer {tok}"}


# ---- Auth ----
class TestAuth:
    def test_login_owner(self):
        assert _login("00101") != ""

    def test_login_pm(self):
        assert _login("00201") != ""

    def test_login_engineer(self):
        assert _login("00202") != ""

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", data={"username": "00101", "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, owner_token):
        r = requests.get(f"{API}/auth/me", headers=h(owner_token))
        assert r.status_code == 200
        assert r.json()["employee_id"] == "00101"
        assert r.json()["role"] == "Owner"


# ---- Dashboard ----
class TestDashboard:
    def test_dashboard(self, owner_token):
        r = requests.get(f"{API}/dashboard", headers=h(owner_token))
        assert r.status_code == 200
        data = r.json()
        for k in ["total_profit", "total_po", "total_actual", "budget_utilization",
                  "summary", "trend", "peak_month", "cost_by_project",
                  "cost_by_category", "cost_by_user"]:
            assert k in data, f"missing {k}"
        assert isinstance(data["summary"], list) and len(data["summary"]) > 0
        assert "budget" in data["summary"][0]
        assert isinstance(data["trend"], list) and len(data["trend"]) == 8


# ---- POs ----
class TestPOs:
    def test_list_pos(self, owner_token):
        r = requests.get(f"{API}/pos", headers=h(owner_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["pos"], list)
        assert len(data["pos"]) >= 2
        p = data["pos"][0]
        assert "actual_cost" in p and "utilization" in p

    def test_create_po_owner(self, owner_token):
        po_num = f"PO-TEST-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/pos", headers=h(owner_token), json={
            "po_number": po_num, "project_name": "Moratel DWDM",
            "location": "TEST", "po_amount": 100000000,
        })
        assert r.status_code == 200
        assert r.json()["po_number"] == po_num
        # verify GET
        r2 = requests.get(f"{API}/pos", headers=h(owner_token))
        nums = [p["po_number"] for p in r2.json()["pos"]]
        assert po_num in nums

    def test_create_po_engineer_forbidden(self, eng_token):
        r = requests.post(f"{API}/pos", headers=h(eng_token), json={
            "po_number": "PO-TEST-ENG", "project_name": "Moratel DWDM",
            "location": "x", "po_amount": 1,
        })
        assert r.status_code == 403


# ---- Invoices ----
class TestInvoices:
    def test_list_invoices(self, owner_token):
        r = requests.get(f"{API}/invoices", headers=h(owner_token))
        assert r.status_code == 200
        assert len(r.json()["invoices"]) == 4

    def test_toggle_invoice(self, owner_token):
        r = requests.get(f"{API}/invoices", headers=h(owner_token))
        inv = r.json()["invoices"][0]
        original = inv["paid"]
        num = inv["invoice_number"]
        r2 = requests.post(f"{API}/invoices/{num}/toggle", headers=h(owner_token))
        assert r2.status_code == 200
        assert r2.json()["paid"] != original
        # toggle back
        requests.post(f"{API}/invoices/{num}/toggle", headers=h(owner_token))


# ---- Costs ----
class TestCosts:
    def test_list_costs(self, owner_token):
        r = requests.get(f"{API}/costs", headers=h(owner_token))
        assert r.status_code == 200
        assert len(r.json()["costs"]) > 0

    def test_create_cost_empty_remarks(self, eng_token):
        r = requests.post(f"{API}/costs", headers=h(eng_token), json={
            "date": "2026-08-20", "project_name": "Moratel DWDM",
            "site_name": "TEST", "post": "2.0 Operational", "category": "2.1 Fuel",
            "amount": 100000, "keterangan": "", "remarks": "   ",
        })
        assert r.status_code == 400

    def test_create_cost_valid(self, eng_token):
        r = requests.post(f"{API}/costs", headers=h(eng_token), json={
            "date": "2026-08-20", "project_name": "Moratel DWDM",
            "site_name": "TEST", "post": "2.0 Operational", "category": "2.1 Fuel",
            "amount": 100000, "keterangan": "test", "remarks": "TEST_remark",
        })
        assert r.status_code == 200
        cid = r.json()["id"]
        # verify persistence
        r2 = requests.get(f"{API}/costs", headers=h(eng_token))
        assert any(c["id"] == cid for c in r2.json()["costs"])


# ---- Employees / RBAC ----
class TestEmployeesRBAC:
    def test_engineer_cannot_create_employee(self, eng_token):
        r = requests.post(f"{API}/employees", headers=h(eng_token), json={
            "employee_id": "TEST_999", "name": "TEST", "role": "Engineer", "password": "123",
        })
        assert r.status_code == 403

    def test_pm_cannot_patch_employee(self, pm_token):
        r = requests.patch(f"{API}/employees/00202", headers=h(pm_token), json={
            "name": "TEST", "role": "Engineer",
        })
        assert r.status_code == 403

    def test_owner_can_create_and_patch_employee(self, owner_token):
        eid = f"TEST{uuid.uuid4().hex[:4]}"
        r = requests.post(f"{API}/employees", headers=h(owner_token), json={
            "employee_id": eid, "name": "TEST User", "role": "Engineer",
            "gaji": "5000000", "bank": "BCA", "no_rek": "1234", "password": "123",
        })
        assert r.status_code == 201
        r2 = requests.patch(f"{API}/employees/{eid}", headers=h(owner_token), json={
            "name": "TEST User2", "role": "Engineer", "gaji": "6000000",
        })
        assert r2.status_code == 200
        assert r2.json()["name"] == "TEST User2"
