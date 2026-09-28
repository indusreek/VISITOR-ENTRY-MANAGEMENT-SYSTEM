import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Load environment variables from .env if available
try {
  process.loadEnvFile();
} catch (e) {
  // .env not present or running in container
}

// Lazy-loaded Supabase client singleton
let supabaseClient = null;
let migrationTriggered = false;

export function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function getResolvedSupabaseCredentials() {
  const envUrl = (process.env.SUPABASE_URL || '').trim();
  const envServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const envAnonKey = (process.env.SUPABASE_ANON_KEY || '').trim();

  const candidates = [envUrl, envAnonKey, envServiceKey].filter(Boolean);
  let url = candidates.find(s => s.startsWith('http://') || s.startsWith('https://'));
  if (url) {
    url = url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }

  // Find valid JWT keys (not starting with http)
  const keys = candidates.filter(s => !s.startsWith('http://') && !s.startsWith('https://'));
  // Prefer service role key if available, else anon key
  let key = keys.find(k => {
    try {
      const parts = k.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return payload.role === 'service_role';
      }
    } catch (e) {}
    return false;
  }) || keys[0];

  if (url && key) {
    return { url, key };
  }
  return null;
}

export function isSupabaseConfigured() {
  return Boolean(getResolvedSupabaseCredentials());
}

export function getSupabase() {
  if (!supabaseClient) {
    const creds = getResolvedSupabaseCredentials();
    if (!creds) {
      return null;
    }
    supabaseClient = createClient(creds.url, creds.key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    if (!migrationTriggered) {
      migrationTriggered = true;
      autoMigrateIfEmpty().catch(err => {
        console.warn('Supabase auto-migration background error:', err.message);
      });
    }
  }
  return supabaseClient;
}

export async function autoMigrateIfEmpty() {
  const supabase = getSupabase();
  if (!supabase) return { configured: false };

  try {
    // 1. Check & ensure default admin staff exists
    const { data: users, error: userErr } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (!userErr && (!users || users.length === 0)) {
      await supabase.from('users').insert([{
        username: 'admin',
        password_hash: hashPassword('Admin@123'),
        full_name: 'College Staff'
      }]);
      console.log('⚡ [Supabase Migration] Seeded default staff account: admin');
    }

    // 2. Check & ensure initial visitor records exist without losing data
    const { data: visitors, error: vErr } = await supabase
      .from('visitors')
      .select('id')
      .limit(1);

    if (!vErr && (!visitors || visitors.length === 0)) {
      const recordsToSeed = localVisitors.map(v => ({
        full_name: v.full_name,
        phone: v.phone,
        email: v.email,
        organization: v.organization,
        purpose: v.purpose,
        host_name: v.host_name,
        id_proof_type: v.id_proof_type,
        id_proof_number: v.id_proof_number,
        notes: v.notes,
        status: v.status,
        check_in_time: v.check_in_time,
        check_out_time: v.check_out_time,
        created_at: v.created_at,
        updated_at: v.updated_at
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('visitors')
        .insert(recordsToSeed)
        .select();

      if (!insertErr && inserted) {
        console.log(`⚡ [Supabase Migration] Migrated ${inserted.length} existing visitor records to Supabase PostgreSQL.`);
        return { configured: true, migrated: true, count: inserted.length };
      }
    }

    return { configured: true, migrated: false };
  } catch (err) {
    console.warn('⚡ [Supabase Migration] Exception during sync:', err.message);
    return { configured: true, error: err.message };
  }
}

export async function getDatabaseStatus() {
  const creds = getResolvedSupabaseCredentials();
  if (creds) {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { count, error } = await supabase
          .from('visitors')
          .select('*', { count: 'exact', head: true });

        if (!error) {
          return {
            engine: 'Supabase PostgreSQL',
            connected: true,
            configured: true,
            url: creds.url,
            total_records: count ?? 0
          };
        }
      } catch (e) {}
    }
  }

  return {
    engine: 'In-Memory / SQLite Fallback',
    connected: true,
    configured: false,
    url: null,
    total_records: localVisitors.length
  };
}

// ----------------------------------------------------
// Fallback In-Memory Store (when Supabase keys not set)
// ----------------------------------------------------
const todayStr = new Date().toISOString().slice(0, 10);
let nextVisitorId = 7;

const localUsers = [
  {
    id: 1,
    username: 'admin',
    password_hash: hashPassword('Admin@123'),
    full_name: 'College Staff',
    created_at: new Date().toISOString()
  }
];

let localVisitors = [
  {
    id: 1,
    full_name: 'Arun Kumar',
    phone: '9876543210',
    email: 'arun.k@example.com',
    organization: 'Apex Solutions',
    purpose: 'Meeting',
    host_name: 'Dr. Suresh (HOD CSE)',
    id_proof_type: 'Aadhaar',
    id_proof_number: '554433221100',
    notes: 'Campus visitor badge issued',
    status: 'checked_out',
    check_in_time: `${todayStr}T09:15:00.000Z`,
    check_out_time: `${todayStr}T10:30:00.000Z`,
    created_at: `${todayStr}T09:15:00.000Z`,
    updated_at: `${todayStr}T10:30:00.000Z`
  },
  {
    id: 2,
    full_name: 'Priya Sharma',
    phone: '9876501234',
    email: 'priya.s@example.com',
    organization: 'Self',
    purpose: 'Admission Enquiry',
    host_name: 'Admissions Office',
    id_proof_type: 'PAN',
    id_proof_number: 'ABCPS1234K',
    notes: 'Enquiring for B.Tech CSE',
    status: 'checked_in',
    check_in_time: `${todayStr}T10:00:00.000Z`,
    check_out_time: null,
    created_at: `${todayStr}T10:00:00.000Z`,
    updated_at: `${todayStr}T10:00:00.000Z`
  },
  {
    id: 3,
    full_name: 'Ravi Kumar',
    phone: '9843215678',
    email: 'ravi.k@example.com',
    organization: 'EduCorp',
    purpose: 'Document Submission',
    host_name: 'Registrar',
    id_proof_type: 'Driving License',
    id_proof_number: 'DL0420110012345',
    notes: 'Submitted verification files',
    status: 'checked_out',
    check_in_time: `${todayStr}T10:45:00.000Z`,
    check_out_time: `${todayStr}T11:30:00.000Z`,
    created_at: `${todayStr}T10:45:00.000Z`,
    updated_at: `${todayStr}T11:30:00.000Z`
  },
  {
    id: 4,
    full_name: 'Meena Raj',
    phone: '9988776655',
    email: 'meena.r@gmail.com',
    organization: 'Global Logistics',
    purpose: 'Meeting',
    host_name: 'Principal',
    id_proof_type: 'Passport',
    id_proof_number: 'P9876543',
    notes: 'Guest speaker discussion',
    status: 'checked_out',
    check_in_time: `${todayStr}T11:15:00.000Z`,
    check_out_time: `${todayStr}T12:10:00.000Z`,
    created_at: `${todayStr}T11:15:00.000Z`,
    updated_at: `${todayStr}T12:10:00.000Z`
  },
  {
    id: 5,
    full_name: 'Karthik S',
    phone: '9123456780',
    email: 'karthik.s@gmail.com',
    organization: 'Tata Consultancy',
    purpose: 'Campus Recruitment',
    host_name: 'Placement Officer',
    id_proof_type: 'PAN',
    id_proof_number: 'XYZPK9876Q',
    notes: 'Pre-placement talk setup',
    status: 'checked_in',
    check_in_time: `${todayStr}T14:00:00.000Z`,
    check_out_time: null,
    created_at: `${todayStr}T14:00:00.000Z`,
    updated_at: `${todayStr}T14:00:00.000Z`
  },
  {
    id: 6,
    full_name: 'Divya M',
    phone: '9012345678',
    email: 'divya.m@outlook.com',
    organization: 'Tech Park Ltd',
    purpose: 'Vendor Meeting',
    host_name: 'Finance Head',
    id_proof_type: 'Aadhaar',
    id_proof_number: '123498765432',
    notes: 'Equipment maintenance invoice',
    status: 'checked_out',
    check_in_time: `${todayStr}T15:20:00.000Z`,
    check_out_time: `${todayStr}T16:15:00.000Z`,
    created_at: `${todayStr}T15:20:00.000Z`,
    updated_at: `${todayStr}T16:15:00.000Z`
  }
];

// ----------------------------------------------------
// Database Operations (Supabase with fallback)
// ----------------------------------------------------

export async function findUserByUsername(username) {
  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('Supabase findUserByUsername query error, falling back:', error.message);
      }
    } catch (err) {
      console.warn('Supabase findUserByUsername exception:', err.message);
    }
  }

  return localUsers.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
}

export async function getDashboardStats() {
  const supabase = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  if (supabase) {
    try {
      // Fetch all visitors to compute stats and recent entries
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .order('check_in_time', { ascending: false });

      if (!error && Array.isArray(data)) {
        const total_visitors = data.length;
        const checked_in_today = data.filter(v => (v.check_in_time || '').slice(0, 10) === today).length;
        const currently_inside = data.filter(v => v.status === 'checked_in').length;
        const checked_out_today = data.filter(v => (v.check_out_time || '').slice(0, 10) === today).length;
        const recent = data.slice(0, 10);

        return {
          total_visitors,
          checked_in_today,
          currently_inside,
          checked_out_today,
          recent
        };
      }
      if (error) {
        console.warn('Supabase getDashboardStats error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase getDashboardStats exception:', err.message);
    }
  }

  // Fallback to local
  const total_visitors = localVisitors.length;
  const checked_in_today = localVisitors.filter(v => (v.check_in_time || '').slice(0, 10) === today).length;
  const currently_inside = localVisitors.filter(v => v.status === 'checked_in').length;
  const checked_out_today = localVisitors.filter(v => (v.check_out_time || '').slice(0, 10) === today).length;
  const recent = [...localVisitors]
    .sort((a, b) => new Date(b.check_in_time || b.created_at) - new Date(a.check_in_time || a.created_at))
    .slice(0, 10);

  return {
    total_visitors,
    checked_in_today,
    currently_inside,
    checked_out_today,
    recent
  };
}

export async function getVisitors({ q = '', status = '' } = {}) {
  const supabase = getSupabase();

  if (supabase) {
    try {
      let query = supabase
        .from('visitors')
        .select('*')
        .order('check_in_time', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (q && q.trim()) {
        const term = q.trim();
        query = query.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,purpose.ilike.%${term}%,host_name.ilike.%${term}%,organization.ilike.%${term}%`);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        return data;
      }
      if (error) {
        console.warn('Supabase getVisitors error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase getVisitors exception:', err.message);
    }
  }

  // Fallback to local
  let results = [...localVisitors];
  if (status) {
    results = results.filter(v => v.status === status);
  }
  if (q && q.trim()) {
    const term = q.trim().toLowerCase();
    results = results.filter(v =>
      (v.full_name && v.full_name.toLowerCase().includes(term)) ||
      (v.phone && v.phone.toLowerCase().includes(term)) ||
      (v.host_name && v.host_name.toLowerCase().includes(term)) ||
      (v.purpose && v.purpose.toLowerCase().includes(term)) ||
      (v.organization && v.organization.toLowerCase().includes(term))
    );
  }
  return results.sort((a, b) => new Date(b.check_in_time || b.created_at) - new Date(a.check_in_time || a.created_at));
}

export async function getVisitorById(id) {
  const visitorId = parseInt(id, 10);
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('id', visitorId)
        .maybeSingle();

      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('Supabase getVisitorById error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase getVisitorById exception:', err.message);
    }
  }

  return localVisitors.find(v => v.id === visitorId) || null;
}

export async function hasOpenCheckin(phone) {
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .select('id')
        .eq('phone', phone.trim())
        .eq('status', 'checked_in')
        .limit(1);

      if (!error && Array.isArray(data) && data.length > 0) {
        return true;
      }
    } catch (err) {
      console.warn('Supabase hasOpenCheckin exception:', err.message);
    }
  }

  return localVisitors.some(v => v.phone === phone.trim() && v.status === 'checked_in');
}

export async function createVisitor(record) {
  const now = new Date().toISOString();
  const visitorData = {
    full_name: record.full_name.trim(),
    phone: record.phone.trim(),
    email: record.email ? record.email.trim() : null,
    organization: record.organization ? record.organization.trim() : null,
    purpose: record.purpose.trim(),
    host_name: record.host_name.trim(),
    id_proof_type: record.id_proof_type,
    id_proof_number: record.id_proof_number.trim(),
    notes: record.notes ? record.notes.trim() : null,
    status: 'checked_in',
    check_in_time: now,
    check_out_time: null,
    created_at: now,
    updated_at: now
  };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .insert([visitorData])
        .select()
        .single();

      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('Supabase createVisitor error, falling back:', error.message);
      }
    } catch (err) {
      console.warn('Supabase createVisitor exception:', err.message);
    }
  }

  const newLocal = {
    id: nextVisitorId++,
    ...visitorData
  };
  localVisitors.unshift(newLocal);
  return newLocal;
}

export async function updateVisitor(id, updateFields) {
  const visitorId = parseInt(id, 10);
  const now = new Date().toISOString();
  const fields = { ...updateFields, updated_at: now };

  const supabase = getSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .update(fields)
        .eq('id', visitorId)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('Supabase updateVisitor error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase updateVisitor exception:', err.message);
    }
  }

  const local = localVisitors.find(v => v.id === visitorId);
  if (!local) return null;
  Object.assign(local, fields);
  return local;
}

export async function checkoutVisitor(id) {
  const visitorId = parseInt(id, 10);
  const now = new Date().toISOString();
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('visitors')
        .update({
          status: 'checked_out',
          check_out_time: now,
          updated_at: now
        })
        .eq('id', visitorId)
        .select()
        .single();

      if (!error && data) {
        return data;
      }
      if (error) {
        console.warn('Supabase checkoutVisitor error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase checkoutVisitor exception:', err.message);
    }
  }

  const local = localVisitors.find(v => v.id === visitorId);
  if (!local) return null;
  local.status = 'checked_out';
  local.check_out_time = now;
  local.updated_at = now;
  return local;
}

export async function deleteVisitor(id) {
  const visitorId = parseInt(id, 10);
  const supabase = getSupabase();

  if (supabase) {
    try {
      const { error } = await supabase
        .from('visitors')
        .delete()
        .eq('id', visitorId);

      if (!error) {
        return true;
      }
      if (error) {
        console.warn('Supabase deleteVisitor error:', error.message);
      }
    } catch (err) {
      console.warn('Supabase deleteVisitor exception:', err.message);
    }
  }

  const idx = localVisitors.findIndex(v => v.id === visitorId);
  if (idx === -1) return false;
  localVisitors.splice(idx, 1);
  return true;
}

export async function getReports({ date_from, date_to }) {
  const allVisitors = await getVisitors();
  let filtered = allVisitors;

  if (date_from && date_to) {
    filtered = allVisitors.filter(v => {
      const vDate = (v.check_in_time || v.created_at || '').slice(0, 10);
      return vDate >= date_from && vDate <= date_to;
    });
  }

  const total = filtered.length;
  const currently_inside = filtered.filter(v => v.status === 'checked_in').length;
  const checked_out = filtered.filter(v => v.status === 'checked_out').length;

  return {
    date_from: date_from || new Date().toISOString().slice(0, 10),
    date_to: date_to || new Date().toISOString().slice(0, 10),
    summary: {
      total,
      currently_inside,
      checked_out
    },
    visitors: filtered
  };
}
