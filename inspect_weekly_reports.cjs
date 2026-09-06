const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres',
});

async function run() {
  await client.connect();
  await client.query("ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;");
  console.log('ALTER TABLE profiles executed successfully.');
  const resProfiles = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles'");
  console.log('profiles columns:', resProfiles.rows.map(r => r.column_name));
  await client.end();
}

run().catch(console.error);

