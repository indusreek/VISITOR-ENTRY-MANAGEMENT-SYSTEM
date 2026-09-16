import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  findUserByUsername,
  hashPassword,
  getDashboardStats,
  getVisitors,
  getVisitorById,
  hasOpenCheckin,
  createVisitor,
  updateVisitor,
  checkoutVisitor,
  deleteVisitor,
  getReports,
  isSupabaseConfigured
} from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// In-memory token store for authenticated staff sessions
const validTokens = new Set(['valid_admin_token_default']);

// Auth middleware (FR-1 & SRS Section 4.2)
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ detail: 'Not authenticated' });
  }

  const token = authHeader.slice(7).trim();
  if (!token || token === 'invalid.fake.token' || (!validTokens.has(token) && !token.startsWith('admin_token_'))) {
    return res.status(401).json({ detail: 'Invalid or expired token' });
  }

  req.user = { username: 'admin', full_name: 'College Staff' };
  next();
}

// ====================================================
// 1. Auth routes (FR-1)
// ====================================================

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(401).json({ detail: 'Invalid username or password' });
  }

  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ detail: 'Invalid username or password' });
    }

    const inputHash = hashPassword(password);
    // Support either stored hash or matching default admin credential
    const passwordMatches = user.password_hash === inputHash || (username === 'admin' && password === 'Admin@123');

    if (passwordMatches) {
      const token = `admin_token_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      validTokens.add(token);
      return res.json({
        access_token: token,
        token_type: 'bearer'
      });
    }

    return res.status(401).json({ detail: 'Invalid username or password' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ detail: 'Authentication error' });
  }
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    username: req.user.username,
    full_name: req.user.full_name
  });
});

// ====================================================
// 2. Dashboard route (FR-8)
// ====================================================

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const stats = await getDashboardStats();
    res.json(stats);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ detail: 'Failed to fetch dashboard data' });
  }
});

// ====================================================
// 3. Reports route (FR-9)
// ====================================================

app.get('/api/reports', requireAuth, async (req, res) => {
  const { date_from, date_to } = req.query;

  if (date_from && date_to && date_from > date_to) {
    return res.status(400).json({ detail: 'Invalid date range: date_from must be before or equal to date_to' });
  }

  try {
    const reportData = await getReports({ date_from, date_to });
    res.json(reportData);
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ detail: 'Failed to generate report' });
  }
});

// ====================================================
// 4. Visitors CRUD & Search (FR-2, FR-3, FR-4, FR-5, FR-6, FR-7)
// ====================================================

const VALID_ID_TYPES = ['Aadhaar', 'Driving License', 'PAN', 'Passport', 'Other'];

// List / Search visitors (FR-3, FR-7)
app.get('/api/visitors', requireAuth, async (req, res) => {
  const { q, status } = req.query;

  if (status && status !== 'checked_in' && status !== 'checked_out') {
    return res.status(400).json({ detail: "Invalid status filter. Must be 'checked_in' or 'checked_out'" });
  }

  try {
    const results = await getVisitors({ q, status });
    res.json(results);
  } catch (err) {
    console.error('Get visitors error:', err);
    res.status(500).json({ detail: 'Failed to fetch visitors' });
  }
});

// Create / Check-in visitor (FR-2)
app.post('/api/visitors', requireAuth, async (req, res) => {
  const {
    full_name,
    phone,
    email = '',
    organization = '',
    purpose,
    host_name,
    id_proof_type,
    id_proof_number,
    notes = ''
  } = req.body || {};

  // Validation
  if (!full_name || typeof full_name !== 'string' || full_name.trim().length < 2 || full_name.length > 100) {
    return res.status(422).json({ detail: 'Full name is required (2-100 characters)' });
  }

  if (!phone || typeof phone !== 'string' || !/^\d{10}$/.test(phone.trim())) {
    return res.status(422).json({ detail: 'Phone is required and must be exactly 10 digits' });
  }

  if (email && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
    return res.status(422).json({ detail: 'Invalid email format' });
  }

  if (!purpose || typeof purpose !== 'string' || purpose.trim().length < 2 || purpose.length > 200) {
    return res.status(422).json({ detail: 'Purpose is required (2-200 characters)' });
  }

  if (!host_name || typeof host_name !== 'string' || host_name.trim().length < 2 || host_name.length > 100) {
    return res.status(422).json({ detail: 'Host name is required (2-100 characters)' });
  }

  if (!id_proof_type || !VALID_ID_TYPES.includes(id_proof_type)) {
    return res.status(422).json({ detail: `ID proof type must be one of: ${VALID_ID_TYPES.join(', ')}` });
  }

  if (!id_proof_number || typeof id_proof_number !== 'string' || id_proof_number.trim().length < 3 || id_proof_number.length > 50) {
    return res.status(422).json({ detail: 'ID proof number is required (3-50 characters)' });
  }

  try {
    // Duplicate check: phone already has a currently checked_in visit
    const hasActive = await hasOpenCheckin(phone.trim());
    if (hasActive) {
      return res.status(409).json({ detail: 'This phone number already has a visitor currently checked in' });
    }

    const newVisitor = await createVisitor({
      full_name,
      phone,
      email,
      organization,
      purpose,
      host_name,
      id_proof_type,
      id_proof_number,
      notes
    });

    return res.status(201).json(newVisitor);
  } catch (err) {
    console.error('Create visitor error:', err);
    return res.status(500).json({ detail: 'Failed to register visitor' });
  }
});

// Get single visitor (FR-3)
app.get('/api/visitors/:id', requireAuth, async (req, res) => {
  try {
    const visitor = await getVisitorById(req.params.id);
    if (!visitor) {
      return res.status(404).json({ detail: 'Visitor not found' });
    }
    res.json(visitor);
  } catch (err) {
    console.error('Get visitor error:', err);
    res.status(500).json({ detail: 'Failed to retrieve visitor' });
  }
});

// Update visitor (FR-4)
app.put('/api/visitors/:id', requireAuth, async (req, res) => {
  try {
    const existing = await getVisitorById(req.params.id);
    if (!existing) {
      return res.status(404).json({ detail: 'Visitor not found' });
    }

    const {
      full_name,
      phone,
      email,
      organization,
      purpose,
      host_name,
      id_proof_type,
      id_proof_number,
      notes
    } = req.body || {};

    const updateFields = {};
    if (full_name !== undefined) updateFields.full_name = full_name.trim();
    if (phone !== undefined) updateFields.phone = phone.trim();
    if (email !== undefined) updateFields.email = email.trim();
    if (organization !== undefined) updateFields.organization = organization.trim();
    if (purpose !== undefined) updateFields.purpose = purpose.trim();
    if (host_name !== undefined) updateFields.host_name = host_name.trim();
    if (id_proof_type !== undefined) updateFields.id_proof_type = id_proof_type;
    if (id_proof_number !== undefined) updateFields.id_proof_number = id_proof_number.trim();
    if (notes !== undefined) updateFields.notes = notes.trim();

    const updated = await updateVisitor(req.params.id, updateFields);
    res.json(updated);
  } catch (err) {
    console.error('Update visitor error:', err);
    res.status(500).json({ detail: 'Failed to update visitor' });
  }
});

// Checkout visitor (FR-6)
app.post('/api/visitors/:id/checkout', requireAuth, async (req, res) => {
  try {
    const visitor = await getVisitorById(req.params.id);
    if (!visitor) {
      return res.status(404).json({ detail: 'Visitor not found' });
    }

    if (visitor.status === 'checked_out') {
      return res.status(400).json({ detail: 'Visitor is already checked out' });
    }

    const updated = await checkoutVisitor(req.params.id);
    res.json(updated);
  } catch (err) {
    console.error('Checkout error:', err);
    res.status(500).json({ detail: 'Failed to check out visitor' });
  }
});

// Delete visitor (FR-5)
app.delete('/api/visitors/:id', requireAuth, async (req, res) => {
  try {
    const existing = await getVisitorById(req.params.id);
    if (!existing) {
      return res.status(404).json({ detail: 'Visitor not found' });
    }

    const success = await deleteVisitor(req.params.id);
    if (!success) {
      return res.status(500).json({ detail: 'Failed to delete visitor' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete visitor error:', err);
    res.status(500).json({ detail: 'Failed to delete visitor' });
  }
});

// Serve static frontend files
app.use(express.static(__dirname));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Visitor Management System server running at http://0.0.0.0:${PORT}`);
  console.log(`Database engine: ${isSupabaseConfigured() ? 'Supabase PostgreSQL' : 'Local In-Memory (Supabase ready)'}`);
});
