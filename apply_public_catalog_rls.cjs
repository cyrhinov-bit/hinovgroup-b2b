const { Client } = require('pg');

async function apply() {
  const connectionString = 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');

    const sql = `
      -- 1. pos_products (Lecture seule publique)
      DROP POLICY IF EXISTS "Allow public read-only access to pos_products" ON pos_products;
      CREATE POLICY "Allow public read-only access to pos_products" 
      ON pos_products 
      FOR SELECT 
      TO anon 
      USING (true);

      -- 2. pos_categories (Lecture seule publique)
      DROP POLICY IF EXISTS "Allow public read-only access to pos_categories" ON pos_categories;
      CREATE POLICY "Allow public read-only access to pos_categories" 
      ON pos_categories 
      FOR SELECT 
      TO anon 
      USING (true);

      -- 3. pos_brands (Lecture seule publique)
      DROP POLICY IF EXISTS "Allow public read-only access to pos_brands" ON pos_brands;
      CREATE POLICY "Allow public read-only access to pos_brands" 
      ON pos_brands 
      FOR SELECT 
      TO anon 
      USING (true);

      -- 4. pos_settings (Lecture seule publique des paramètres de la librairie & WhatsApp)
      DROP POLICY IF EXISTS "Allow public read-only access to pos_settings" ON pos_settings;
      CREATE POLICY "Allow public read-only access to pos_settings" 
      ON pos_settings 
      FOR SELECT 
      TO anon 
      USING (true);
    `;

    await client.query(sql);
    console.log('SUCCESS: Public catalog RLS policies applied successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
  } finally {
    await client.end();
  }
}

apply();

