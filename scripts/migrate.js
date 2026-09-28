import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Attempt to load environment variables from .env
try {
  process.loadEnvFile();
} catch (e) {
  // .env file might not exist yet
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const initialUsers = [
  {
    username: 'admin',
    password_hash: hashPassword('Admin@123'),
    full_name: 'College Staff'
  }
];

const todayStr = new Date().toISOString().slice(0, 10);
const initialVisitors = [
  {
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

async function runMigration() {
  console.log('========================================================');
  console.log('Visitor Management System - Supabase Migration Engine');
  console.log('========================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn('⚠️  Supabase credentials are NOT detected in environment variables.');
    console.log('To connect to your own Supabase project:');
    console.log('1. Set the following in .env or your deployment environment:');
    console.log('   SUPABASE_URL=https://<your-project-ref>.supabase.co');
    console.log('   SUPABASE_ANON_KEY=<your-anon-or-service-role-key>');
    console.log('2. Execute the schema from supabase/schema.sql in your Supabase SQL Editor.');
    console.log('3. Re-run this migration script: npm run migrate\n');
    console.log('ℹ️  Currently operating in: In-Memory / SQLite Fallback Mode (Supabase Ready).');
    process.exit(0);
  }

  console.log(`Connecting to Supabase at: ${supabaseUrl.trim()}`);
  const client = createClient(supabaseUrl.trim(), supabaseKey.trim(), {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // 1. Verify and migrate Users
  console.log('Step 1: Checking "users" table...');
  const { data: existingUsers, error: usersErr } = await client
    .from('users')
    .select('id, username')
    .limit(10);

  if (usersErr) {
    console.error('❌ Error querying "users" table:', usersErr.message);
    console.log('👉 Please ensure you have run "supabase/schema.sql" in your Supabase SQL Editor first!');
    process.exit(1);
  }

  if (!existingUsers || existingUsers.length === 0) {
    console.log('  -> "users" table is empty. Seeding default staff account (admin)...');
    const { error: insertUserErr } = await client.from('users').insert(initialUsers);
    if (insertUserErr) {
      console.error('❌ Failed to seed default user:', insertUserErr.message);
    } else {
      console.log('  ✅ Default staff account seeded successfully.');
    }
  } else {
    console.log(`  ✅ Found ${existingUsers.length} existing user(s).`);
  }

  // 2. Verify and migrate Visitors
  console.log('Step 2: Checking "visitors" table...');
  const { data: existingVisitors, error: visitorsErr } = await client
    .from('visitors')
    .select('id, full_name, phone')
    .limit(10);

  if (visitorsErr) {
    console.error('❌ Error querying "visitors" table:', visitorsErr.message);
    process.exit(1);
  }

  if (!existingVisitors || existingVisitors.length === 0) {
    console.log(`  -> "visitors" table is empty. Migrating ${initialVisitors.length} existing records...`);
    const { data: inserted, error: insertVisErr } = await client
      .from('visitors')
      .insert(initialVisitors)
      .select();

    if (insertVisErr) {
      console.error('❌ Failed to migrate visitor records:', insertVisErr.message);
    } else {
      console.log(`  ✅ Successfully migrated ${inserted.length} visitor records into Supabase PostgreSQL.`);
    }
  } else {
    console.log(`  ✅ "visitors" table already contains ${existingVisitors.length} record(s). Preserving existing data.`);
  }

  console.log('\n========================================================');
  console.log('🎉 Migration verification completed successfully!');
  console.log('========================================================');
}

runMigration().catch(err => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
