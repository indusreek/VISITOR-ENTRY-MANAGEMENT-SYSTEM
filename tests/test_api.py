import unittest
from datetime import date

from fastapi.testclient import TestClient

from app.main import app


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._cm = TestClient(app)
        cls.client = cls._cm.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls._cm.__exit__(None, None, None)

    def auth_header(self):
        response = self.client.post(
            "/api/auth/login", json={"username": "admin", "password": "Admin@123"}
        )
        self.assertEqual(response.status_code, 200)
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    # ================= 1. AUTHENTICATION TESTS =================

    def test_login_success(self):
        response = self.client.post(
            "/api/auth/login", json={"username": "admin", "password": "Admin@123"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["token_type"], "bearer")

    def test_login_rejects_bad_password(self):
        response = self.client.post(
            "/api/auth/login", json={"username": "admin", "password": "WrongPassword!"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Invalid username or password")

    def test_login_rejects_nonexistent_user(self):
        response = self.client.post(
            "/api/auth/login", json={"username": "unknown_user", "password": "Admin@123"}
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "Invalid username or password")

    def test_get_current_user(self):
        headers = self.auth_header()
        response = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["username"], "admin")
        self.assertIn("full_name", data)

    def test_protected_endpoints_require_token(self):
        endpoints = [
            ("GET", "/api/auth/me"),
            ("GET", "/api/visitors"),
            ("POST", "/api/visitors"),
            ("GET", "/api/dashboard"),
            ("GET", "/api/reports?date_from=2026-01-01&date_to=2026-01-02"),
        ]
        for method, url in endpoints:
            if method == "GET":
                resp = self.client.get(url)
            else:
                resp = self.client.post(url, json={})
            self.assertEqual(resp.status_code, 401, f"{method} {url} did not return 401")

    def test_invalid_bearer_token_rejected(self):
        headers = {"Authorization": "Bearer invalid.fake.token"}
        response = self.client.get("/api/visitors", headers=headers)
        self.assertEqual(response.status_code, 401)

    # ================= 2. VISITOR CRUD & LIFECYCLE TESTS =================

    def test_visitor_complete_lifecycle(self):
        headers = self.auth_header()

        # Step 1: Create visitor
        create_payload = {
            "full_name": "Rohan Deshmukh",
            "phone": "9123456780",
            "email": "rohan@example.com",
            "organization": "Tech Corp",
            "purpose": "Vendor meeting",
            "host_name": "Finance Head",
            "id_proof_type": "PAN",
            "id_proof_number": "ABCDE1234F",
            "notes": "Has laptop badge",
        }
        created = self.client.post("/api/visitors", headers=headers, json=create_payload)
        self.assertEqual(created.status_code, 201, created.text)
        visitor = created.json()
        visitor_id = visitor["id"]
        self.assertEqual(visitor["full_name"], "Rohan Deshmukh")
        self.assertEqual(visitor["phone"], "9123456780")
        self.assertEqual(visitor["status"], "checked_in")
        self.assertIsNotNone(visitor["check_in_time"])
        self.assertIsNone(visitor["check_out_time"])

        # Step 2: Prevent duplicate check-in with same phone
        duplicate = self.client.post(
            "/api/visitors",
            headers=headers,
            json={
                "full_name": "Duplicate User",
                "phone": "9123456780",
                "purpose": "Another visit",
                "host_name": "Host",
                "id_proof_type": "Aadhaar",
                "id_proof_number": "999988887777",
            },
        )
        self.assertEqual(duplicate.status_code, 409)
        self.assertIn("already has a visitor currently checked in", duplicate.json()["detail"])

        # Step 3: Get single visitor by ID (FR-3)
        single = self.client.get(f"/api/visitors/{visitor_id}", headers=headers)
        self.assertEqual(single.status_code, 200)
        self.assertEqual(single.json()["id"], visitor_id)
        self.assertEqual(single.json()["id_proof_number"], "ABCDE1234F")

        # Step 4: Search visitor by query (FR-7)
        search_res = self.client.get("/api/visitors?q=Deshmukh", headers=headers)
        self.assertEqual(search_res.status_code, 200)
        self.assertTrue(any(v["id"] == visitor_id for v in search_res.json()))

        # Step 5: Filter visitors by status (FR-7)
        status_res = self.client.get("/api/visitors?status=checked_in", headers=headers)
        self.assertEqual(status_res.status_code, 200)
        self.assertTrue(any(v["id"] == visitor_id for v in status_res.json()))

        # Step 6: Update visitor details (FR-4)
        update_payload = {
            "full_name": "Rohan S. Deshmukh",
            "phone": "9123456780",
            "email": "rohan.new@example.com",
            "organization": "Tech Corp International",
            "purpose": "Executive meeting",
            "host_name": "Managing Director",
            "id_proof_type": "PAN",
            "id_proof_number": "ABCDE1234F",
            "notes": "VIP Guest",
        }
        updated = self.client.put(f"/api/visitors/{visitor_id}", headers=headers, json=update_payload)
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["full_name"], "Rohan S. Deshmukh")
        self.assertEqual(updated.json()["purpose"], "Executive meeting")
        self.assertEqual(updated.json()["status"], "checked_in")  # Status unchanged

        # Step 7: Check-out visitor (FR-6)
        checkout = self.client.post(f"/api/visitors/{visitor_id}/checkout", headers=headers)
        self.assertEqual(checkout.status_code, 200)
        self.assertEqual(checkout.json()["status"], "checked_out")
        self.assertIsNotNone(checkout.json()["check_out_time"])

        # Step 8: Reject check-out when already checked out
        second_checkout = self.client.post(f"/api/visitors/{visitor_id}/checkout", headers=headers)
        self.assertEqual(second_checkout.status_code, 400)
        self.assertIn("already checked out", second_checkout.json()["detail"])

        # Step 9: Verify same phone can now check in again since previous is checked out
        reentry = self.client.post(
            "/api/visitors",
            headers=headers,
            json={
                "full_name": "Rohan S. Deshmukh",
                "phone": "9123456780",
                "purpose": "Afternoon Follow-up",
                "host_name": "Managing Director",
                "id_proof_type": "PAN",
                "id_proof_number": "ABCDE1234F",
            },
        )
        self.assertEqual(reentry.status_code, 201)
        reentry_id = reentry.json()["id"]

        # Clean up reentry
        self.client.delete(f"/api/visitors/{reentry_id}", headers=headers)

        # Step 10: Delete visitor (FR-5)
        deleted = self.client.delete(f"/api/visitors/{visitor_id}", headers=headers)
        self.assertEqual(deleted.status_code, 204)

        # Step 11: Verify deleted visitor is not found
        not_found = self.client.get(f"/api/visitors/{visitor_id}", headers=headers)
        self.assertEqual(not_found.status_code, 404)

    # ================= 3. VALIDATION REJECTION TESTS =================

    def test_invalid_phone_rejected(self):
        headers = self.auth_header()
        bad_phones = ["123", "98765432101", "abc1234567", "98765-43210"]
        for bad_phone in bad_phones:
            resp = self.client.post(
                "/api/visitors",
                headers=headers,
                json={
                    "full_name": "Test Visitor",
                    "phone": bad_phone,
                    "purpose": "General Visit",
                    "host_name": "Staff Host",
                    "id_proof_type": "Aadhaar",
                    "id_proof_number": "123456789012",
                },
            )
            self.assertEqual(resp.status_code, 422, f"Phone '{bad_phone}' was not rejected with 422")

    def test_invalid_id_proof_type_rejected(self):
        headers = self.auth_header()
        resp = self.client.post(
            "/api/visitors",
            headers=headers,
            json={
                "full_name": "Test Visitor",
                "phone": "9876543211",
                "purpose": "General Visit",
                "host_name": "Staff Host",
                "id_proof_type": "InvalidIDType",
                "id_proof_number": "123456789012",
            },
        )
        self.assertEqual(resp.status_code, 422)

    def test_missing_required_fields_rejected(self):
        headers = self.auth_header()
        resp = self.client.post("/api/visitors", headers=headers, json={"full_name": "Only Name"})
        self.assertEqual(resp.status_code, 422)

    def test_invalid_status_filter_rejected(self):
        headers = self.auth_header()
        resp = self.client.get("/api/visitors?status=invalid_status", headers=headers)
        self.assertEqual(resp.status_code, 400)

    # ================= 4. DASHBOARD & REPORT TESTS =================

    def test_dashboard_endpoint(self):
        headers = self.auth_header()
        resp = self.client.get("/api/dashboard", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("total_visitors", data)
        self.assertIn("checked_in_today", data)
        self.assertIn("currently_inside", data)
        self.assertIn("checked_out_today", data)
        self.assertIn("recent", data)
        self.assertIsInstance(data["recent"], list)

    def test_reports_endpoint_and_date_validation(self):
        headers = self.auth_header()
        today = date.today().isoformat()

        # Valid date range
        resp = self.client.get(f"/api/reports?date_from={today}&date_to={today}", headers=headers)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["date_from"], today)
        self.assertEqual(data["date_to"], today)
        self.assertIn("summary", data)
        self.assertIn("total", data["summary"])
        self.assertIn("currently_inside", data["summary"])
        self.assertIn("checked_out", data["summary"])
        self.assertIn("visitors", data)

        # Invalid date range (from > to)
        invalid_range = self.client.get(
            "/api/reports?date_from=2026-12-31&date_to=2026-01-01", headers=headers
        )
        self.assertEqual(invalid_range.status_code, 400)


if __name__ == "__main__":
    unittest.main()
