"""Teleconi Ops Tracker backend tests — updated for site_name mandatory,
PO delete, invoice create/delete, cost delete by Owner."""
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
    return r.json()["access_token"] if r.status_code == 200 else ""


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
def pcm_token():
    tok = _login("00204")
    assert tok, "PCM login failed"
    return tok


@pytest.fixture(scope="session")
def eng_token():
    tok = _login("00202")
    assert tok, "Engineer login failed"
    return tok


def h(tok): return {"Authorization": f"Bearer {tok}"}


# ---- Auth: verifies all 4 roles ----
class TestAuth:
    def test_login_owner(self):
        assert _login("00101") != ""

    def test_login_pm(self):
        assert _login("00201") != ""

    def test_login_pcm(self):
        assert _login("00204") != ""

    def test_login_engineer(self):
        assert _login("00202") != ""

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", data={"username": "00101", "password": "wrong"})
        assert r.status_code == 401

    def test_me_owner(self, owner_token):
        r = requests.get(f"{API}/auth/me", headers=h(owner_token))
        assert r.status_code == 200
        j = r.json()
        assert j["employee_id"] == "00101" and j["role"] == "Owner"

    def test_me_engineer(self, eng_token):
        r = requests.get(f"{API}/auth/me", headers=h(eng_token))
        assert r.status_code == 200 and r.json()["role"] == "Engineer"


# ---- Dashboard ----
class TestDashboard:
    def test_dashboard(self, owner_token):
        r = requests.get(f"{API}/dashboard", headers=h(owner_token))
        assert r.status_code == 200
        data = r.json()
        for k in ["total_profit", "total_po", "total_actual", "budget_utilization",
                  "summary", "trend", "peak_month", "cost_by_project",
                  "cost_by_category", "cost_by_user", "projects"]:
            assert k in data, f"missing {k}"
        assert isinstance(data["trend"], list) and len(data["trend"]) == 8


# ---- POs — new schema (po_number/site_code/release_date/po_amount/status) + DELETE ----
class TestPOs:
    def test_list_pos(self, owner_token):
        r = requests.get(f"{API}/pos", headers=h(owner_token))
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data["pos"], list) and len(data["pos"]) >= 2
        p = data["pos"][0]
        for k in ["po_number", "site_code", "release_date", "po_amount", "status"]:
            assert k in p, f"missing field {k}"

    def test_create_po_owner_new_schema(self, owner_token):
        po_num = f"PO-TEST-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/pos", headers=h(owner_token), json={
            "po_number": po_num,
            "site_code": "TEST-001",
            "release_date": "2026-08-01",
            "po_amount": 100000000,
            "status": "Active",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["po_number"] == po_num
        assert body["site_code"] == "TEST-001"
        assert body["status"] == "Active"
        # verify GET
        r2 = requests.get(f"{API}/pos", headers=h(owner_token))
        nums = [p["po_number"] for p in r2.json()["pos"]]
        assert po_num in nums

    def test_create_po_pcm_allowed(self, pcm_token):
        po_num = f"PO-TEST-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/pos", headers=h(pcm_token), json={
            "po_number": po_num, "site_code": "PCM-001",
            "release_date": "2026-08-02", "po_amount": 50000000, "status": "Plan",
        })
        assert r.status_code == 200

    def test_create_po_engineer_forbidden(self, eng_token):
        r = requests.post(f"{API}/pos", headers=h(eng_token), json={
            "po_number": "PO-TEST-ENG", "site_code": "x",
            "release_date": "2026-08-01", "po_amount": 1, "status": "Plan",
        })
        assert r.status_code == 403

    def test_delete_po_owner_and_verify(self, owner_token):
        po_num = f"PO-DEL-{uuid.uuid4().hex[:6]}"
        requests.post(f"{API}/pos", headers=h(owner_token), json={
            "po_number": po_num, "site_code": "DEL-001",
            "release_date": "2026-08-05", "po_amount": 1000, "status": "Plan",
        })
        r = requests.delete(f"{API}/pos/{po_num}", headers=h(owner_token))
        assert r.status_code == 204
        # verify gone
        r2 = requests.get(f"{API}/pos", headers=h(owner_token))
        nums = [p["po_number"] for p in r2.json()["pos"]]
        assert po_num not in nums

    def test_delete_po_engineer_forbidden(self, eng_token, owner_token):
        po_num = f"PO-DELENG-{uuid.uuid4().hex[:6]}"
        requests.post(f"{API}/pos", headers=h(owner_token), json={
            "po_number": po_num, "site_code": "x",
            "release_date": "2026-08-01", "po_amount": 1, "status": "Plan",
        })
        r = requests.delete(f"{API}/pos/{po_num}", headers=h(eng_token))
        assert r.status_code == 403
        requests.delete(f"{API}/pos/{po_num}", headers=h(owner_token))


# ---- Invoices: create, toggle, delete ----
class TestInvoices:
    def test_list_invoices(self, owner_token):
        r = requests.get(f"{API}/invoices", headers=h(owner_token))
        assert r.status_code == 200
        assert isinstance(r.json()["invoices"], list)

    def test_create_invoice_owner(self, owner_token):
        inv_num = f"INV-TEST-{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/invoices", headers=h(owner_token), json={
            "invoice_number": inv_num, "po_number": "PO-2026-001",
            "amount": 5000000, "due_date": "2026-09-30",
        })
        assert r.status_code == 200, r.text
        assert r.json()["invoice_number"] == inv_num
        assert r.json()["paid"] is False
        # verify persistence
        r2 = requests.get(f"{API}/invoices", headers=h(owner_token))
        assert any(i["invoice_number"] == inv_num for i in r2.json()["invoices"])

    def test_create_invoice_engineer_forbidden(self, eng_token):
        r = requests.post(f"{API}/invoices", headers=h(eng_token), json={
            "invoice_number": "INV-TEST-ENG", "po_number": "PO-2026-001",
            "amount": 1, "due_date": "-",
        })
        assert r.status_code == 403

    def test_toggle_invoice(self, owner_token):
        r = requests.get(f"{API}/invoices", headers=h(owner_token))
        inv = r.json()["invoices"][0]
        original = inv["paid"]
        num = inv["invoice_number"]
        r2 = requests.post(f"{API}/invoices/{num}/toggle", headers=h(owner_token))
        assert r2.status_code == 200
        assert r2.json()["paid"] != original
        requests.post(f"{API}/invoices/{num}/toggle", headers=h(owner_token))

    def test_delete_invoice_owner(self, owner_token):
        inv_num = f"INV-DEL-{uuid.uuid4().hex[:6]}"
        requests.post(f"{API}/invoices", headers=h(owner_token), json={
            "invoice_number": inv_num, "po_number": "PO-2026-001",
            "amount": 1000, "due_date": "-",
        })
        r = requests.delete(f"{API}/invoices/{inv_num}", headers=h(owner_token))
        assert r.status_code == 204
        r2 = requests.get(f"{API}/invoices", headers=h(owner_token))
        assert not any(i["invoice_number"] == inv_num for i in r2.json()["invoices"])


# ---- Costs: site_name required, remarks removed, delete by Owner only ----
class TestCosts:
    def test_list_costs(self, owner_token):
        r = requests.get(f"{API}/costs", headers=h(owner_token))
        assert r.status_code == 200
        assert len(r.json()["costs"]) > 0

    def test_create_cost_empty_site_name_fails(self, eng_token):
        r = requests.post(f"{API}/costs", headers=h(eng_token), json={
            "date": "2026-08-20", "project_name": "Moratel DWDM",
            "site_name": "   ", "post": "2.0 Operational", "category": "2.1 Fuel",
            "amount": 100000, "keterangan": "",
        })
        assert r.status_code == 400

    def test_create_cost_valid_no_remarks_field(self, eng_token):
        r = requests.post(f"{API}/costs", headers=h(eng_token), json={
            "date": "2026-08-20", "project_name": "Moratel DWDM",
            "site_name": "TEST_Bandung", "post": "2.0 Operational",
            "category": "2.1 Fuel", "amount": 100000, "keterangan": "",
        })
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["site_name"] == "TEST_Bandung"
        assert body["submitted_by"] == "Yendro Makendro Sija"
        # verify persistence
        cid = body["id"]
        r2 = requests.get(f"{API}/costs", headers=h(eng_token))
        assert any(c["id"] == cid for c in r2.json()["costs"])

    def test_delete_cost_owner(self, owner_token, eng_token):
        # create a cost via engineer
        cr = requests.post(f"{API}/costs", headers=h(eng_token), json={
            "date": "2026-08-20", "project_name": "Moratel DWDM",
            "site_name": "TEST_DeleteMe", "post": "2.0 Operational",
            "category": "2.1 Fuel", "amount": 1, "keterangan": "",
        })
        assert cr.status_code == 200
        cid = cr.json()["id"]
        # delete via owner
        r = requests.delete(f"{API}/costs/{cid}", headers=h(owner_token))
        assert r.status_code == 204
        # verify gone
        r2 = requests.get(f"{API}/costs", headers=h(owner_token))
        assert not any(c["id"] == cid for c in r2.json()["costs"])

    def test_delete_cost_engineer_forbidden(self, eng_token, owner_token):
        cr = requests.post(f"{API}/costs", headers=h(eng_token), json={
            "date": "2026-08-20", "project_name": "Moratel DWDM",
            "site_name": "TEST_EngDel", "post": "2.0 Operational",
            "category": "2.1 Fuel", "amount": 1, "keterangan": "",
        })
        cid = cr.json()["id"]
        r = requests.delete(f"{API}/costs/{cid}", headers=h(eng_token))
        assert r.status_code == 403
        # cleanup as owner
        requests.delete(f"{API}/costs/{cid}", headers=h(owner_token))

    def test_delete_cost_pm_forbidden(self, pm_token):
        # PM shouldn't be able to delete either
        r = requests.delete(f"{API}/costs/nonexistent-id", headers=h(pm_token))
        assert r.status_code == 403


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

    def test_owner_can_create_employee(self, owner_token):
        eid = f"TEST{uuid.uuid4().hex[:4]}"
        r = requests.post(f"{API}/employees", headers=h(owner_token), json={
            "employee_id": eid, "name": "TEST User", "role": "Engineer",
            "gaji": "5000000", "bank": "BCA", "no_rek": "1234", "password": "123",
        })
        assert r.status_code == 201
