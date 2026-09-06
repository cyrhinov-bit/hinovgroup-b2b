const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres',
});

async function run() {
  await client.connect();
  console.log('Adding missing columns to v2_weekly_reports...');
  
  await client.query(`
    ALTER TABLE v2_weekly_reports
    ADD COLUMN IF NOT EXISTS week_end DATE,
    ADD COLUMN IF NOT EXISTS ai_summary TEXT,
    ADD COLUMN IF NOT EXISTS achievements TEXT,
    ADD COLUMN IF NOT EXISTS difficulties TEXT,
    ADD COLUMN IF NOT EXISTS director_comment TEXT,
    ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID;
  `);

  console.log('Columns added successfully.');
  
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_weekly_reports'");
  console.log('Updated v2_weekly_reports columns:', res.rows.map(r => r.column_name));
  
  await client.end();
}

run().catch(console.error);
