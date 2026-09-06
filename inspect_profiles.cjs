const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres',
});

async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'profiles'");
  console.log('Profiles columns:', res.rows);
  const rows = await client.query("SELECT id, name, email, role, photo, avatar_url FROM profiles LIMIT 5");
  console.log('Sample profiles:', rows.rows);
  await client.end();
}

run().catch(console.error);

