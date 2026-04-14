/**
 * Module PostgreSQL pour ECG CRM
 * Remplace les fichiers JSON par une base de données persistante sur Render
 * Fonctionne en mode "dual" : PostgreSQL si DATABASE_URL est défini, sinon fichiers JSON
 */
const fs = require('fs');
const path = require('path');

let pool = null;
let useDB = false;

function initPool() {
  if (process.env.DATABASE_URL && !pool) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    useDB = true;
    console.log('🐘 Mode PostgreSQL activé');
  } else if (!process.env.DATABASE_URL) {
    console.log('📁 Mode fichiers JSON (pas de DATABASE_URL)');
  }
}

async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release();
  }
}

// ─── INIT TABLES ─────────────────────────────────────────────────────────────
async function initTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS ecg_kv (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ecg_users (
      id SERIAL PRIMARY KEY,
      login TEXT UNIQUE NOT NULL,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// ─── IMPORT INITIAL DEPUIS JSON ───────────────────────────────────────────────
async function importInitialData() {
  const dataDir = path.join(__dirname, 'data');
  const files = ['users.json', 'parcours.json', 'kpi_commerciaux.json', 'pointages.json',
                 'alertes.json', 'parrainages.json', 'ressources_custom.json',
                 'planning_coach.json', 'coach_seances.json', 'coach_plan_action.json', 'coach_taches.json'];

  // Import users dans table dédiée
  try {
    const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
    const existing = await query('SELECT COUNT(*) FROM ecg_users');
    if (parseInt(existing.rows[0].count) === 0) {
      for (const u of users) {
        await query(
          'INSERT INTO ecg_users (id, login, data) VALUES ($1, $2, $3) ON CONFLICT (login) DO NOTHING',
          [u.id, u.login || u.email, JSON.stringify(u)]
        );
      }
      // Synchroniser la séquence
      await query(`SELECT setval('ecg_users_id_seq', GREATEST((SELECT MAX(id) FROM ecg_users), 1))`);
      console.log(`✅ ${users.length} utilisateurs importés dans PostgreSQL`);
    }
  } catch (e) {
    console.error('Erreur import users:', e.message);
  }

  // Import autres fichiers dans table KV
  for (const file of files.slice(1)) {
    try {
      const existing = await query('SELECT key FROM ecg_kv WHERE key = $1', [file]);
      if (existing.rows.length === 0) {
        const data = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
        await query('INSERT INTO ecg_kv (key, value) VALUES ($1, $2)', [file, JSON.stringify(data)]);
        console.log(`✅ ${file} importé`);
      }
    } catch (e) {
      // Fichier absent = données vides
      try {
        await query('INSERT INTO ecg_kv (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
          [file, JSON.stringify(file.includes('json') && !file.includes('users') ? (file === 'parcours.json' ? { etapes: [], progressions: [] } : (file === 'kpi_commerciaux.json' ? { realisations: [], enquetesSatisfaction: [] } : (file === 'pointages.json' ? { config: { heureDebut: '08:30', toleranceMinutes: 15, heureAbsence: '12:00', joursOuvres: [1,2,3,4,5] }, pointages: [] } : (file === 'alertes.json' ? { alertes: [] } : [])))) : [])]);
      } catch(e2) {}
    }
  }
}

// ─── INIT COMPLÈTE ────────────────────────────────────────────────────────────
async function init() {
  initPool();
  if (!useDB) return;
  try {
    await initTables();
    await importInitialData();
    console.log('✅ Base de données PostgreSQL prête');
  } catch (e) {
    console.error('❌ Erreur init PostgreSQL:', e.message);
    useDB = false;
    console.log('⚠️ Fallback sur fichiers JSON');
  }
}

// ─── READ DATA ────────────────────────────────────────────────────────────────
async function readDataAsync(file) {
  if (!useDB) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', file), 'utf8'));
  }

  if (file === 'users.json') {
    const r = await query('SELECT data FROM ecg_users ORDER BY id');
    return r.rows.map(row => row.data);
  }

  const r = await query('SELECT value FROM ecg_kv WHERE key = $1', [file]);
  if (r.rows.length > 0) return r.rows[0].value;

  // Fallback JSON si pas encore en DB
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'data', file), 'utf8'));
  } catch (e) {
    // Valeurs par défaut
    if (file === 'parcours.json') return { etapes: [], progressions: [] };
    if (file === 'kpi_commerciaux.json') return { realisations: [], enquetesSatisfaction: [] };
    if (file === 'pointages.json') return { config: { heureDebut: '08:30', toleranceMinutes: 15, heureAbsence: '12:00', joursOuvres: [1,2,3,4,5] }, pointages: [] };
    if (file === 'alertes.json') return { alertes: [] };
    return [];
  }
}

// ─── WRITE DATA ───────────────────────────────────────────────────────────────
async function writeDataAsync(file, data) {
  if (!useDB) {
    fs.writeFileSync(path.join(__dirname, 'data', file), JSON.stringify(data, null, 2));
    return;
  }

  if (file === 'users.json') {
    // Upsert chaque utilisateur
    for (const u of data) {
      await query(
        `INSERT INTO ecg_users (id, login, data) VALUES ($1, $2, $3)
         ON CONFLICT (login) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [u.id, u.login || u.email, JSON.stringify(u)]
      );
    }
    // Synchroniser la séquence
    await query(`SELECT setval('ecg_users_id_seq', GREATEST((SELECT MAX(id) FROM ecg_users), 1))`);
    return;
  }

  await query(
    `INSERT INTO ecg_kv (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [file, JSON.stringify(data)]
  );
}

// ─── CREATE USER ──────────────────────────────────────────────────────────────
async function createUserDB(userData) {
  if (!useDB) {
    const users = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'users.json'), 'utf8'));
    const newId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
    const newUser = { id: newId, ...userData };
    users.push(newUser);
    fs.writeFileSync(path.join(__dirname, 'data', 'users.json'), JSON.stringify(users, null, 2));
    return newUser;
  }

  const r = await query(
    `INSERT INTO ecg_users (login, data) VALUES ($1, $2) RETURNING id`,
    [userData.login || userData.email, JSON.stringify(userData)]
  );
  const newId = r.rows[0].id;
  const newUser = { id: newId, ...userData };
  // Mettre à jour data avec l'id
  await query('UPDATE ecg_users SET data = $1 WHERE id = $2', [JSON.stringify(newUser), newId]);
  return newUser;
}

// ─── UPDATE USER ──────────────────────────────────────────────────────────────
async function updateUserDB(userId, fields) {
  if (!useDB) {
    const filePath = path.join(__dirname, 'data', 'users.json');
    const users = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const idx = users.findIndex(u => u.id === userId);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...fields, id: userId, password: users[idx].password };
      fs.writeFileSync(filePath, JSON.stringify(users, null, 2));
    }
    return;
  }

  const r = await query('SELECT data FROM ecg_users WHERE id = $1', [userId]);
  if (r.rows.length === 0) return;
  const current = r.rows[0].data;
  const updated = { ...current, ...fields, id: userId, password: fields.password || current.password };
  await query('UPDATE ecg_users SET data = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(updated), userId]);
}

module.exports = { init, readDataAsync, writeDataAsync, createUserDB, updateUserDB, isUsingDB: () => useDB };
