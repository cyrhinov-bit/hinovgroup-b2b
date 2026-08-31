const { Client } = require('pg');

async function inspect() {
  const connectionString = 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres';
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const resQuotes = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'quotes'
    ORDER BY ordinal_position;
  `);
  console.log('Quotes columns:', resQuotes.rows.map(r => r.column_name));

  const resLines = await client.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'quote_lines'
    ORDER BY ordinal_position;
  `);
  console.log('Quote lines columns:', resLines.rows.map(r => r.column_name));

  await client.end();
}

inspect();
