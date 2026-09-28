import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

let authToken = '';
let testVisitorId = null;
const uniquePhone = '9876' + Math.floor(100000 + Math.random() * 900000);

test('Visitor Management System API Test Suite (SRS Conformance)', async (t) => {

  await t.test('1. Database status endpoint returns valid engine and record counts', async () => {
    const res = await fetch(`${BASE_URL}/api/database/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.engine);
    assert.equal(typeof data.total_records, 'number');
    assert.equal(typeof data.configured, 'boolean');
  });

  await t.test('2. Authentication: Reject invalid staff credentials', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'WrongPassword' })
    });
    assert.equal(res.status, 401);
  });

  await t.test('3. Authentication: Login with default SRS credentials (admin / Admin@123)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123' })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.access_token);
    assert.equal(data.user.username, 'admin');
    authToken = data.access_token;
  });

  await t.test('4. Authentication: Get current staff profile (/api/auth/me)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.username, 'admin');
    assert.equal(data.role, 'staff');
  });

  await t.test('5. Protected routes reject requests without token', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`);
    assert.equal(res.status, 401);
  });

  await t.test('6. FR-2 Register visitor: Reject invalid phone numbers (non-10-digit)', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        full_name: 'Test Visitor',
        phone: '12345',
        purpose: 'Interview',
        host_name: 'Principal',
        id_proof_type: 'Aadhaar',
        id_proof_number: '123456789012'
      })
    });
    assert.equal(res.status, 422);
  });

  await t.test('7. FR-2 Register visitor: Successfully register with valid data', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        full_name: 'John Doe',
        phone: uniquePhone,
        purpose: 'Campus Tour',
        host_name: 'Admissions Office',
        id_proof_type: 'Aadhaar',
        id_proof_number: '987654321098',
        organization: 'Independent',
        email: 'johndoe@example.com',
        notes: 'Requested science lab visit'
      })
    });
    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    assert.equal(data.full_name, 'John Doe');
    assert.equal(data.phone, uniquePhone);
    assert.equal(data.status, 'checked_in');
    testVisitorId = data.id;
  });

  await t.test('8. Business Rule: Prevent duplicate active check-in with same phone (409 Conflict)', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        full_name: 'John Duplicate',
        phone: uniquePhone,
        purpose: 'Duplicate checkin attempt',
        host_name: 'Admissions Office',
        id_proof_type: 'Aadhaar',
        id_proof_number: '987654321098'
      })
    });
    assert.equal(res.status, 409);
    const data = await res.json();
    assert.ok(data.detail.includes('already'));
  });

  await t.test('9. FR-3 View single visitor record', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${testVisitorId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.id, testVisitorId);
    assert.equal(data.full_name, 'John Doe');
    assert.equal(data.purpose, 'Campus Tour');
  });

  await t.test('10. FR-4 Update visitor details', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${testVisitorId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        full_name: 'John Doe Updated',
        purpose: 'Official Campus Tour and Meeting'
      })
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.full_name, 'John Doe Updated');
    assert.equal(data.purpose, 'Official Campus Tour and Meeting');
  });

  await t.test('11. FR-6 Check out visitor', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${testVisitorId}/checkout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'checked_out');
    assert.ok(data.check_out_time);
  });

  await t.test('12. Checking out an already checked out visitor returns 400', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${testVisitorId}/checkout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 400);
  });

  await t.test('13. FR-7 Search visitors by query', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors?q=Updated`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    assert.ok(list.some(v => v.id === testVisitorId));
  });

  await t.test('14. FR-8 Dashboard summary metrics', async () => {
    const res = await fetch(`${BASE_URL}/api/dashboard`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(typeof data.total_visitors, 'number');
    assert.equal(typeof data.currently_inside, 'number');
    assert.equal(typeof data.checked_in_today, 'number');
    assert.equal(typeof data.checked_out_today, 'number');
    assert.ok(Array.isArray(data.recent));
  });

  await t.test('15. FR-9 Reports with date range filtering', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(`${BASE_URL}/api/reports?date_from=${today}&date_to=${today}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.summary);
    assert.ok(Array.isArray(data.visitors));
  });

  await t.test('16. FR-5 Delete visitor record', async () => {
    const res = await fetch(`${BASE_URL}/api/visitors/${testVisitorId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(res.status, 204);

    // Verify deletion
    const verifyRes = await fetch(`${BASE_URL}/api/visitors/${testVisitorId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    assert.equal(verifyRes.status, 404);
  });

});
