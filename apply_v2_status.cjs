const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = 'postgresql://postgres:majorix0404199@db.eqscmifbnqjxxzmtjvee.supabase.co:5432/postgres';
  
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log("Connexion à la base de données...");
    await client.connect();
    
    console.log("Lecture du fichier de migration...");
    const sql = fs.readFileSync('./supabase/migrations/20260816210000_add_v2_daily_status.sql', 'utf8');

    console.log("Exécution de la migration...");
    await client.query(sql);
    console.log("✅ Migration appliquée avec succès !");
    
  } catch (err) {
    console.error("❌ Erreur:", err);
  } finally {
    await client.end();
  }
}

run();
