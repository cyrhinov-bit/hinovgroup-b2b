const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres',
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'v2_weekly_reports'");
  console.log('v2_weekly_reports columns:', res.rows.map(r => r.column_name));
  const rows = await client.query("SELECT * FROM v2_weekly_reports LIMIT 3");
  console.log('Sample v2_weekly_reports:', rows.rows);
  await client.end();
}

run().catch(console.error);
