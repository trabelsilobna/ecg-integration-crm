/**
 * Script de migration : JSON → PostgreSQL
 * Usage: DATABASE_URL=... node migrate.js
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const dataDir = path.join(__dirname, 'data');

function readJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
}

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('🔌 Connexion PostgreSQL OK');

    // ─── Créer les tables ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nom TEXT,
        prenom TEXT,
        email TEXT UNIQUE,
        login TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'collaborateur',
        poste TEXT,
        site TEXT,
        departement TEXT,
        "dateArrivee" TEXT,
        progression INTEGER DEFAULT 0,
        statut TEXT DEFAULT 'actif',
        "responsableCoach" INTEGER,
        "responsableFormateur" INTEGER,
        "responsableRecruteur" INTEGER,
        "photoUrl" TEXT,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS parcours_etapes (
        id SERIAL PRIMARY KEY,
        titre TEXT,
        description TEXT,
        phase TEXT,
        "ordre" INTEGER,
        duree TEXT,
        responsable TEXT,
        documents JSONB DEFAULT '[]',
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS parcours_progressions (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        "etapeId" INTEGER,
        statut TEXT DEFAULT 'non_commence',
        "dateDebut" TEXT,
        "dateFin" TEXT,
        commentaire TEXT,
        "validePar" INTEGER,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS kpi_realisations (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        mois TEXT,
        data JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS pointages (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
        date TEXT,
        heure TEXT,
        type TEXT,
        statut TEXT,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS alertes (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER,
        nom TEXT,
        site TEXT,
        mois TEXT,
        alertes JSONB DEFAULT '[]',
        kpi JSONB DEFAULT '{}',
        presence JSONB DEFAULT '{}',
        lu BOOLEAN DEFAULT FALSE,
        "createdAt" TEXT,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS candidatures (
        id SERIAL PRIMARY KEY,
        "candidatNom" TEXT,
        "candidatPrenom" TEXT,
        email TEXT,
        poste TEXT,
        statut TEXT DEFAULT 'nouveau',
        "dateCreation" TEXT,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS parrainages (
        id SERIAL PRIMARY KEY,
        "userId" INTEGER,
        "parrainId" INTEGER,
        "dateCreation" TEXT,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS coach_seances (
        id SERIAL PRIMARY KEY,
        "coachId" INTEGER,
        "collaborateurId" INTEGER,
        date TEXT,
        heure TEXT,
        duree TEXT,
        type TEXT,
        notes TEXT,
        statut TEXT DEFAULT 'planifiee',
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS coach_plan_action (
        id SERIAL PRIMARY KEY,
        "coachId" INTEGER,
        "collaborateurId" INTEGER,
        objectif TEXT,
        actions JSONB DEFAULT '[]',
        statut TEXT DEFAULT 'en_cours',
        "dateCreation" TEXT,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS coach_taches (
        id SERIAL PRIMARY KEY,
        "coachId" INTEGER,
        "collaborateurId" INTEGER,
        titre TEXT,
        description TEXT,
        statut TEXT DEFAULT 'a_faire',
        priorite TEXT DEFAULT 'normale',
        "dateEcheance" TEXT,
        "dateCreation" TEXT,
        extra JSONB DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS app_data (
        key TEXT PRIMARY KEY,
        value JSONB
      );
    `);
    console.log('✅ Tables créées');

    // ─── Importer users ─────────────────────────────────────────────────
    const users = readJSON('users.json');
    for (const u of users) {
      const { id, nom, prenom, email, login, password, role, poste, site, departement,
              dateArrivee, progression, statut, responsableCoach, responsableFormateur,
              responsableRecruteur, photoUrl, ...rest } = u;
      await client.query(`
        INSERT INTO users (id, nom, prenom, email, login, password, role, poste, site, departement,
          "dateArrivee", progression, statut, "responsableCoach", "responsableFormateur",
          "responsableRecruteur", "photoUrl", extra)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        ON CONFLICT (id) DO UPDATE SET
          nom=EXCLUDED.nom, prenom=EXCLUDED.prenom, email=EXCLUDED.email,
          login=EXCLUDED.login, password=EXCLUDED.password, role=EXCLUDED.role,
          poste=EXCLUDED.poste, site=EXCLUDED.site, departement=EXCLUDED.departement,
          "dateArrivee"=EXCLUDED."dateArrivee", progression=EXCLUDED.progression,
          statut=EXCLUDED.statut, "responsableCoach"=EXCLUDED."responsableCoach",
          "responsableFormateur"=EXCLUDED."responsableFormateur",
          "responsableRecruteur"=EXCLUDED."responsableRecruteur",
          "photoUrl"=EXCLUDED."photoUrl", extra=EXCLUDED.extra
      `, [id, nom, prenom, email||null, login||null, password||null, role||'collaborateur',
          poste||null, site||null, departement||null, dateArrivee||null,
          progression||0, statut||'actif', responsableCoach||null,
          responsableFormateur||null, responsableRecruteur||null, photoUrl||null,
          JSON.stringify(rest)]);
    }
    // Réinitialiser la séquence
    await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    console.log(`✅ ${users.length} utilisateurs importés`);

    // ─── Importer parcours ───────────────────────────────────────────────
    const parcoursData = readJSON('parcours.json');
    const etapes = parcoursData.etapes || [];
    for (const e of etapes) {
      const { id, titre, description, phase, ordre, duree, responsable, documents, ...rest } = e;
      await client.query(`
        INSERT INTO parcours_etapes (id, titre, description, phase, "ordre", duree, responsable, documents, extra)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET
          titre=EXCLUDED.titre, description=EXCLUDED.description, phase=EXCLUDED.phase,
          "ordre"=EXCLUDED."ordre", duree=EXCLUDED.duree, responsable=EXCLUDED.responsable,
          documents=EXCLUDED.documents, extra=EXCLUDED.extra
      `, [id, titre||null, description||null, phase||null, ordre||0, duree||null,
          responsable||null, JSON.stringify(documents||[]), JSON.stringify(rest)]);
    }
    if (etapes.length > 0) await client.query(`SELECT setval('parcours_etapes_id_seq', (SELECT MAX(id) FROM parcours_etapes))`);

    // Progressions
    const progressions = parcoursData.progressions || {};
    for (const [userId, userProgressions] of Object.entries(progressions)) {
      if (Array.isArray(userProgressions)) {
        for (const p of userProgressions) {
          const { id, etapeId, statut, dateDebut, dateFin, commentaire, validePar, ...rest } = p;
          await client.query(`
            INSERT INTO parcours_progressions ("userId", "etapeId", statut, "dateDebut", "dateFin", commentaire, "validePar", extra)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            ON CONFLICT DO NOTHING
          `, [parseInt(userId), etapeId||null, statut||'non_commence', dateDebut||null,
              dateFin||null, commentaire||null, validePar||null, JSON.stringify(rest)]);
        }
      }
    }
    console.log(`✅ Parcours importé (${etapes.length} étapes)`);

    // ─── Importer KPI ────────────────────────────────────────────────────
    const kpiData = readJSON('kpi_commerciaux.json');
    const realisations = kpiData.realisations || {};
    for (const [userId, moisData] of Object.entries(realisations)) {
      for (const [mois, data] of Object.entries(moisData)) {
        await client.query(`
          INSERT INTO kpi_realisations ("userId", mois, data)
          VALUES ($1,$2,$3)
          ON CONFLICT DO NOTHING
        `, [parseInt(userId), mois, JSON.stringify(data)]);
      }
    }
    console.log('✅ KPI importés');

    // ─── Importer pointages ──────────────────────────────────────────────
    const pointagesData = readJSON('pointages.json');
    const ptList = pointagesData.pointages || [];
    for (const p of ptList) {
      const { userId, date, heure, type, statut, ...rest } = p;
      await client.query(`
        INSERT INTO pointages ("userId", date, heure, type, statut, extra)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT DO NOTHING
      `, [userId, date, heure||null, type||null, statut||null, JSON.stringify(rest)]);
    }
    // Sauvegarder la config pointages
    await client.query(`
      INSERT INTO app_data (key, value) VALUES ('pointages_config', $1)
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value
    `, [JSON.stringify(pointagesData.config || {})]);
    console.log(`✅ ${ptList.length} pointages importés`);

    // ─── Importer alertes ────────────────────────────────────────────────
    const alertesData = readJSON('alertes.json');
    for (const a of (alertesData.alertes || [])) {
      const { id, userId, nom, site, mois, alertes, kpi, presence, lu, createdAt, ...rest } = a;
      await client.query(`
        INSERT INTO alertes (id, "userId", nom, site, mois, alertes, kpi, presence, lu, "createdAt", extra)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (id) DO NOTHING
      `, [id, userId||null, nom||null, site||null, mois||null,
          JSON.stringify(alertes||[]), JSON.stringify(kpi||{}),
          JSON.stringify(presence||{}), lu||false, createdAt||null, JSON.stringify(rest)]);
    }
    if ((alertesData.alertes||[]).length > 0) await client.query(`SELECT setval('alertes_id_seq', (SELECT MAX(id) FROM alertes))`);
    console.log('✅ Alertes importées');

    // ─── Importer candidatures ───────────────────────────────────────────
    const candidatures = readJSON('candidatures.json');
    for (const c of candidatures) {
      const { id, candidatNom, candidatPrenom, email, poste, statut, dateCreation, ...rest } = c;
      await client.query(`
        INSERT INTO candidatures (id, "candidatNom", "candidatPrenom", email, poste, statut, "dateCreation", extra)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (id) DO NOTHING
      `, [id, candidatNom||null, candidatPrenom||null, email||null, poste||null,
          statut||'nouveau', dateCreation||null, JSON.stringify(rest)]);
    }
    if (candidatures.length > 0) await client.query(`SELECT setval('candidatures_id_seq', (SELECT MAX(id) FROM candidatures))`);
    console.log('✅ Candidatures importées');

    // ─── Sauvegarder formations et tutos dans app_data ───────────────────
    const formations = readJSON('formations_sante.json');
    await client.query(`
      INSERT INTO app_data (key, value) VALUES ('formations_sante', $1)
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value
    `, [JSON.stringify(formations)]);

    const tutos = readJSON('tuto_lorenzo.json');
    await client.query(`
      INSERT INTO app_data (key, value) VALUES ('tuto_lorenzo', $1)
      ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value
    `, [JSON.stringify(tutos)]);
    console.log('✅ Formations et tutos importés');

    console.log('\n🎉 Migration terminée avec succès !');
  } catch (err) {
    console.error('❌ Erreur migration:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
