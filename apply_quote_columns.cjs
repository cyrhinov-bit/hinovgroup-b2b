const { Client } = require('pg');

async function apply() {
  const connectionString = 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const sql = `
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS valid_until DATE;
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS payment_terms TEXT;
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signatory_name TEXT;
    ALTER TABLE quotes ADD COLUMN IF NOT EXISTS signatory_role TEXT;

    ALTER TABLE quote_lines ADD COLUMN IF NOT EXISTS unit TEXT;
  `;

  await client.query(sql);
  console.log('Columns added to quotes and quote_lines successfully!');
  await client.end();
}

apply();
