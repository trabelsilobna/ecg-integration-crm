const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Configuration multer pour l'upload de fichiers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    cb(null, `${Date.now()}_${base}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy (Manus HTTPS reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret: 'ecg-integration-secret-2026',
  resave: true,
  saveUninitialized: false,
  rolling: true,
  cookie: { secure: 'auto', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));

// Helper: lire/écrire les données JSON
function readData(file) {
  const filePath = path.join(__dirname, 'data', file);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeData(file, data) {
  const filePath = path.join(__dirname, 'data', file);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Middleware auth
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || !['admin', 'rh', 'pmo', 'pdg', 'recruteur', 'coach', 'formateur'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'collaborateur' ? '/mon-espace' : '/dashboard');
  }
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect(req.session.user.role === 'collaborateur' ? '/mon-espace' : '/dashboard');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/api/login', async (req, res) => {
  const { login, password } = req.body;
  const users = readData('users.json');
  const user = users.find(u => u.login === login || u.email === login);
  if (!user) return res.json({ success: false, message: 'Identifiant ou mot de passe incorrect' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.json({ success: false, message: 'Identifiant ou mot de passe incorrect' });
  req.session.user = { id: user.id, nom: user.nom, prenom: user.prenom, email: user.email, login: user.login, role: user.role, poste: user.poste, site: user.site, departement: user.departement };

  // ── POINTAGE AUTOMATIQUE À LA CONNEXION ──
  if (user.role === 'collaborateur') {
    enregistrerPointage(user.id);
  }

  const redirect = user.role === 'collaborateur' ? '/mon-espace' : '/dashboard';
  res.json({ success: true, role: user.role, redirect });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json(req.session.user);
});

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'app.html'));
});
app.get('/parcours', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'app.html')));
app.get('/collaborateurs', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'app.html')));
app.get('/ressources', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'app.html')));
app.get('/kpi', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'app.html')));
app.get('/profil', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'views', 'app.html')));
app.get('/alertes', requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'views', 'app.html')));

// Interface dédiée collaborateur
app.get('/mon-espace', requireAuth, (req, res) => {
  // Seuls les collaborateurs accèdent à cette interface
  if (!req.session.user || req.session.user.role !== 'collaborateur') {
    return res.redirect('/dashboard');
  }
  const u = req.session.user;
  const initials = ((u.prenom?.[0] || '') + (u.nom?.[0] || '')).toUpperCase();
  // Calculer la progression du parcours côté serveur
  let progression = 0, termine = 0, total = 0;
  try {
    const parcoursData = readData('parcours.json');
    const userId = u.id;
    const progressions = parcoursData.progressions.filter(p => p.userId === userId);
    total = parcoursData.etapes.length;
    termine = progressions.filter(p => p.statut === 'termine').length;
    progression = total > 0 ? Math.round((termine / total) * 100) : 0;
  } catch(e) {}
  let html = fs.readFileSync(path.join(__dirname, 'views', 'collaborateur.html'), 'utf8');
  // Injection serveur des données utilisateur dans le HTML
  html = html
    .replace('>Connexion...<', `>${u.prenom} ${u.nom}<`)
    .replace('>--<', `>${initials}<`)
    .replace('>\uD83D\uDE4B Collaborateur<', `>\uD83D\uDE4B ${u.poste || 'Collaborateur'}<`)
    // Injection de la progression dans le dashboard
    .replace('id="dashProgPct">0%<', `id="dashProgPct">${progression}%<`)
    .replace('id="dashProgBar" style="width:0%"', `id="dashProgBar" style="width:${progression}%"`)
    .replace('id="dashEtapesTerminees">0<', `id="dashEtapesTerminees">${termine}<`)
    .replace('id="dashEtapesTotal">0<', `id="dashEtapesTotal">${total}<`);
  res.send(html);
});

// ─── API COLLABORATEURS ───────────────────────────────────────────────────────

app.get('/api/collaborateurs', requireAuth, (req, res) => {
  const users = readData('users.json');
  const currentUser = req.session.user;
  const adminRoles = ['admin', 'rh', 'pmo', 'pdg', 'manager', 'directeur_commercial'];
  let allUsers = users;

  // Filtrage par périmètre selon le rôle
  if (!adminRoles.includes(currentUser.role)) {
    if (currentUser.role === 'recruteur') {
      // Le recruteur voit uniquement les CC dont il est responsableRecruteur
      allUsers = users.filter(u => u.role === 'collaborateur' && u.responsableRecruteur === currentUser.id);
    } else if (currentUser.role === 'formateur') {
      // Le formateur voit uniquement les CC dont il est responsableFormateur
      allUsers = users.filter(u => u.role === 'collaborateur' && u.responsableFormateur === currentUser.id);
    } else if (currentUser.role === 'coach') {
      // Le coach voit uniquement les CC dont il est responsableCoach
      allUsers = users.filter(u => u.role === 'collaborateur' && u.responsableCoach === currentUser.id);
    }
    // Si aucun CC assigné, retourner liste vide (pas les autres utilisateurs)
  }

  const data = allUsers.map(u => ({
    id: u.id, nom: u.nom, prenom: u.prenom, email: u.email,
    poste: u.poste, site: u.site, departement: u.departement,
    dateArrivee: u.dateArrivee, progression: u.progression,
    statut: u.statut, role: u.role,
    responsableRecruteur: u.responsableRecruteur,
    responsableFormateur: u.responsableFormateur,
    responsableCoach: u.responsableCoach
  }));
  res.json(data);
});

app.get('/api/collaborateurs/:id', requireAuth, (req, res) => {
  const users = readData('users.json');
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  const { password, ...safeUser } = user;
  res.json(safeUser);
});

app.put('/api/collaborateurs/:id', requireAuth, (req, res) => {
  const users = readData('users.json');
  const idx = users.findIndex(u => u.id === parseInt(req.params.id));
  if (idx === -1) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  users[idx] = { ...users[idx], ...req.body, id: users[idx].id, password: users[idx].password };
  writeData('users.json', users);
  res.json({ success: true });
});

app.post('/api/collaborateurs', requireAdmin, async (req, res) => {
  const users = readData('users.json');
  const { nom, prenom, email, login, password, role, poste, site, departement, dateArrivee } = req.body;
  const hashed = await bcrypt.hash(password || 'Ecg2026!', 10);
  const newUser = {
    id: Math.max(...users.map(u => u.id)) + 1,
    nom, prenom, email, login: login || email,
    password: hashed, role: role || 'collaborateur',
    poste, site, departement, dateArrivee,
    progression: 0, statut: 'en_cours'
  };
  users.push(newUser);
  writeData('users.json', users);
  res.json({ success: true, id: newUser.id });
});

// ─── API PARCOURS ─────────────────────────────────────────────────────────────

app.get('/api/parcours', requireAuth, (req, res) => {
  const data = readData('parcours.json');
  res.json(data.etapes);
});

app.get('/api/parcours/progression/:userId', requireAuth, (req, res) => {
  const data = readData('parcours.json');
  const userId = parseInt(req.params.userId);
  const currentUser = req.session.user;
  const adminRoles = ['admin', 'rh', 'pmo', 'pdg', 'manager', 'directeur_commercial'];

  // Vérification du périmètre : les rôles non-admin ne peuvent voir que leurs CC assignés
  if (!adminRoles.includes(currentUser.role)) {
    const users = readData('users.json');
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && targetUser.role === 'collaborateur') {
      const fieldMap = { recruteur: 'responsableRecruteur', formateur: 'responsableFormateur', coach: 'responsableCoach' };
      const field = fieldMap[currentUser.role];
      if (field && targetUser[field] !== currentUser.id) {
        return res.status(403).json({ error: 'Accès refusé : ce collaborateur n\'est pas dans votre périmètre' });
      }
    }
  }

  const progressions = data.progressions.filter(p => p.userId === userId);

  // Filtrer les étapes selon le rôle du demandeur
  // Les collaborateurs voient TOUTES les étapes de leur parcours
  // Seuls recruteur/formateur/coach sont limités à leurs étapes
  let etapesVisibles = data.etapes;
  const restrictedRoles = ['recruteur', 'formateur', 'coach'];
  if (restrictedRoles.includes(currentUser.role)) {
    etapesVisibles = data.etapes.filter(e => {
      const roles = e.rolesAcces || ['admin', 'rh', 'pmo', 'pdg'];
      return roles.includes(currentUser.role);
    });
  }

  const etapes = etapesVisibles.map(e => ({
    ...e,
    statut: progressions.find(p => p.etapeId === e.id)?.statut || 'a_faire',
    date: progressions.find(p => p.etapeId === e.id)?.date || null
  }));

  const termineTotal = progressions.filter(p => p.statut === 'termine').length;
  const termineVisible = etapes.filter(e => e.statut === 'termine').length;
  const total = data.etapes.length;
  const totalVisible = etapesVisibles.length;
  const pourcentage = total > 0 ? Math.round((termineTotal / total) * 100) : 0;

  // Inclure les infos utilisateur
  const users = readData('users.json');
  const userObj = users.find(u => u.id === userId);
  const user = userObj ? { prenom: userObj.prenom, nom: userObj.nom, poste: userObj.poste, site: userObj.site, dateArrivee: userObj.dateArrivee } : {};
  res.json({ etapes, progression: pourcentage, pourcentage, termine: termineVisible, total: totalVisible, user });
});

app.post('/api/parcours/progression', requireAuth, (req, res) => {
  const data = readData('parcours.json');
  const { userId, etapeId, statut } = req.body;
  const idx = data.progressions.findIndex(p => p.userId === userId && p.etapeId === etapeId);
  if (idx >= 0) {
    data.progressions[idx].statut = statut;
    data.progressions[idx].date = new Date().toISOString().split('T')[0];
  } else {
    data.progressions.push({ userId, etapeId, statut, date: new Date().toISOString().split('T')[0] });
  }
  // Recalculer progression utilisateur
  const users = readData('users.json');
  const userIdx = users.findIndex(u => u.id === userId);
  if (userIdx >= 0) {
    const userProgressions = data.progressions.filter(p => p.userId === userId);
    const termine = userProgressions.filter(p => p.statut === 'termine').length;
    users[userIdx].progression = Math.round((termine / data.etapes.length) * 100);
    writeData('users.json', users);
  }
  writeData('parcours.json', data);
  res.json({ success: true });
});

// ─── API RESSOURCES ───────────────────────────────────────────────────────────

app.get('/api/ressources', requireAuth, (req, res) => {
  // Ressources statiques ECG
  const ressourcesBase = [
    { id: 1, titre: "Guide du conseiller ECG", categorie: "commercial", description: "Méthodes de vente, argumentaires et bonnes pratiques commerciales chez ECG", icone: "📖", taille: "2.1 MB", type: "PDF", cible: "conseiller" },
    { id: 2, titre: "Script d'appel et guide téléphonique", categorie: "commercial", description: "Trame d'appel, phrases d'accroche, gestion des objections et closing", icone: "📞", taille: "0.8 MB", type: "PDF", cible: "conseiller" },
    { id: 3, titre: "Catalogue produits & services ECG", categorie: "produit", description: "Description complète de l'offre ECG, tarifs et conditions commerciales 2026", icone: "🗂️", taille: "3.2 MB", type: "PDF", cible: "conseiller" },
    { id: 4, titre: "Fiche de présentation ECG Group", categorie: "produit", description: "Pitch deck et supports de présentation à utiliser en rendez-vous client", icone: "📊", taille: "4.5 MB", type: "PPTX", cible: "conseiller" },
    { id: 5, titre: "Modèle de devis commercial", categorie: "commercial", description: "Template officiel de devis ECG avec instructions de complétion", icone: "📄", taille: "0.3 MB", type: "DOCX", cible: "conseiller" },
    { id: 8, titre: "Grille de suivi des objectifs", categorie: "kpi", description: "Tableau de bord personnel pour suivre ses objectifs hebdomadaires et mensuels", icone: "📈", taille: "0.5 MB", type: "XLSX", cible: "conseiller" },
    { id: 9, titre: "Procédure CRM — Saisie des activités", categorie: "kpi", description: "Guide d'utilisation du CRM ECG : saisie des appels, devis et opportunités", icone: "💻", taille: "1.0 MB", type: "PDF", cible: "conseiller" },
    { id: 10, titre: "Politique de rémunération variable", categorie: "rh", description: "Explication du système de primes, commissions et bonus liés aux objectifs", icone: "💰", taille: "0.6 MB", type: "PDF", cible: "conseiller" },
    { id: 11, titre: "Charte qualité relation client", categorie: "commercial", description: "Standards de qualité attendus dans la relation client chez ECG", icone: "⭐", taille: "0.4 MB", type: "PDF", cible: "conseiller" },
    { id: 12, titre: "Avantages sociaux & mutuelle", categorie: "rh", description: "Détail de la mutuelle, tickets restaurant, participation et épargne salariale", icone: "🏥", taille: "0.7 MB", type: "PDF", cible: "conseiller" },
  ];

  // Charger les ressources de formation Santé FI depuis le fichier JSON
  let formationsSante = [];
  try {
    formationsSante = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'formations_sante.json'), 'utf8'));
  } catch(e) { /* fichier absent */ }

  // Charger les tutoriels Lorenzo
  let tutoLorenzo = [];
  try {
    tutoLorenzo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'tuto_lorenzo.json'), 'utf8'));
  } catch(e) { /* fichier absent */ }

  // Charger les ressources ajoutées par le PMO
  let ressourcesCustom = [];
  try { ressourcesCustom = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ressources_custom.json'), 'utf8')); } catch(e) { ressourcesCustom = []; }
  const ressources = [...ressourcesBase, ...formationsSante, ...tutoLorenzo, ...ressourcesCustom];
  const { categorie, sous_categorie } = req.query;
  let filtered = ressources;
  if (categorie) filtered = filtered.filter(r => r.categorie === categorie);
  if (sous_categorie) filtered = filtered.filter(r => r.sous_categorie === sous_categorie);
  res.json(filtered);
});

// ─── API KPI ──────────────────────────────────────────────────────────────────

app.get('/api/kpi', requireAuth, (req, res) => {
  const users = readData('users.json');
  const data = readData('parcours.json');
  const collaborateurs = users.filter(u => u.role === 'collaborateur');
  const enCours = collaborateurs.filter(u => u.statut === 'en_cours').length;
  const termines = collaborateurs.filter(u => u.progression === 100).length;
  const avgProgression = collaborateurs.length > 0
    ? Math.round(collaborateurs.reduce((s, u) => s + u.progression, 0) / collaborateurs.length)
    : 0;
  const satisfactionScore = 8.4;
  res.json({
    totalCollaborateurs: collaborateurs.length,
    enCours,
    termines,
    avgProgression,
    satisfactionScore,
    tauxRetention: 94,
    kpis: [
      { label: "Taux d'intégration réussie", valeur: termines, total: collaborateurs.length, pct: collaborateurs.length > 0 ? Math.round((termines / collaborateurs.length) * 100) : 0, couleur: "#1A3A6B", objectif: 100 },
      { label: "Progression moyenne", valeur: avgProgression, total: 100, pct: avgProgression, couleur: "#0066CC", objectif: 80 },
      { label: "Satisfaction collaborateurs", valeur: satisfactionScore, total: 10, pct: satisfactionScore * 10, couleur: "#22C55E", objectif: 9 },
      { label: "Taux de rétention (1 an)", valeur: 94, total: 100, pct: 94, couleur: "#F59E0B", objectif: 90 }
    ],
    parSite: [
      'Tunis Siège', 'Tunis Sousse', 'Tunis Jupiter', 'Rabat', 'Alger', 'Dakar', 'Casa'
    ].map(siteName => {
      const siteCollabs = collaborateurs.filter(c => c.site === siteName || (siteName === 'Tunis Jupiter' && c.site === 'Jupiter'));
      return {
        site: siteName,
        count: siteCollabs.length,
        progression: siteCollabs.length > 0 ? Math.round(siteCollabs.reduce((s, c) => s + (c.progression || 0), 0) / siteCollabs.length) : 0
      };
    })
  });
});

// ─── API CHATBOT IA ───────────────────────────────────────────────────────────

app.post('/api/chat', requireAuth, async (req, res) => {
  const { message, history } = req.body;
  const user = req.session.user;

  // 1️⃣ Réponses de salutation rapides (sans recherche documentaire)
  const msg = message.toLowerCase().trim();
  if (msg.match(/^(bonjour|salut|hello|bonsoir|coucou|hi|hey)/)) {
    return res.json({ response: `Bonjour ${user.prenom} ! 👋 Je suis votre assistant d'intégration ECG.\n\nJe peux vous aider sur :\n• 📋 Votre parcours d'intégration\n• 📚 Les ressources et documents disponibles\n• 🎓 Les formations\n• 💰 La rémunération et les avantages\n• 🏠 Le télétravail et les congés\n\nQue souhaitez-vous savoir ?` });
  }
  if (msg.match(/^(merci|super|parfait|ok|bien|génial|top)/)) {
    return res.json({ response: `Avec plaisir ${user.prenom} ! 😊 N'hésitez pas si vous avez d'autres questions.` });
  }

  // 2️⃣ Recherche dans les documents alimentés (ressources + parcours)
  const docMatch = rechercherDansDocuments(msg, user);
  if (docMatch) {
    return res.json({ response: docMatch });
  }

  // 3️⃣ Réponses basées sur des règles métier (questions fréquentes)
  const regleMatch = getChatbotRegle(msg, user.prenom);
  if (regleMatch) {
    return res.json({ response: regleMatch });
  }

  // 4️⃣ Aucune réponse trouvée → orienter vers le coach intégrateur
  const users = readData('users.json');
  const ccUser = users.find(u => u.login === user.login);
  let coachInfo = '';
  if (ccUser && ccUser.responsableCoach) {
    const coach = users.find(u => u.id === ccUser.responsableCoach);
    if (coach) {
      coachInfo = `\n\n🤝 **Votre coach intégrateur : ${coach.prenom} ${coach.nom}**\nN'hésitez pas à le contacter directement ou lors de votre prochaine séance d'accompagnement. Il est votre interlocuteur privilégié pour toutes les questions liées à votre intégration terrain.`;
    }
  }
  if (!coachInfo) {
    coachInfo = `\n\n🤝 **Contactez votre coach intégrateur** pour obtenir une réponse personnalisée. Il est votre interlocuteur privilégié pour les questions liées à votre intégration terrain.`;
  }

  res.json({ response: `Je n'ai pas trouvé de réponse dans les documents disponibles pour votre question : **"${message}"**.${coachInfo}\n\n📚 Vous pouvez aussi consulter la section **Ressources** de la plateforme pour trouver des documents pertinents.` });
});

// Recherche dans les documents alimentés par le PMO
function rechercherDansDocuments(msg, user) {
  const mots = msg.split(/\s+/).filter(m => m.length > 3);
  if (mots.length === 0) return null;

  // Charger toutes les ressources disponibles
  let ressourcesBase = [
    { titre: "Guide du conseiller ECG", categorie: "commercial", description: "Méthodes de vente, argumentaires et bonnes pratiques commerciales chez ECG" },
    { titre: "Script d'appel et guide téléphonique", categorie: "commercial", description: "Trame d'appel, phrases d'accroche, gestion des objections et closing" },
    { titre: "Catalogue produits & services ECG", categorie: "produit", description: "Description complète de l'offre ECG, tarifs et conditions commerciales 2026" },
    { titre: "Politique de rémunération variable", categorie: "rh", description: "Explication du système de primes, commissions et bonus liés aux objectifs" },
    { titre: "Charte qualité relation client", categorie: "commercial", description: "Standards de qualité attendus dans la relation client chez ECG" },
    { titre: "Avantages sociaux & mutuelle", categorie: "rh", description: "Détail de la mutuelle, tickets restaurant, participation et épargne salariale" },
    { titre: "Grille de suivi des objectifs", categorie: "kpi", description: "Tableau de bord personnel pour suivre ses objectifs hebdomadaires et mensuels" },
    { titre: "Procédure CRM — Saisie des activités", categorie: "kpi", description: "Guide d'utilisation du CRM ECG : saisie des appels, devis et opportunités" },
  ];

  // Charger les ressources custom du PMO
  let ressourcesCustom = [];
  try { ressourcesCustom = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'ressources_custom.json'), 'utf8')); } catch(e) {}

  // Charger les tutoriels Lorenzo
  let tutoLorenzo = [];
  try { tutoLorenzo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'tuto_lorenzo.json'), 'utf8')); } catch(e) {}

  // Charger le parcours (structure: { etapes: [...], progressions: {...} })
  let parcours = [];
  try {
    const parcoursData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'parcours.json'), 'utf8'));
    parcours = Array.isArray(parcoursData) ? parcoursData : (parcoursData.etapes || []);
  } catch(e) {}

  const tousDocuments = [...ressourcesBase, ...ressourcesCustom, ...tutoLorenzo];

  // Scorer chaque document selon la correspondance avec les mots de la question
  const scores = tousDocuments.map(doc => {
    const texte = ((doc.titre || '') + ' ' + (doc.description || '') + ' ' + (doc.categorie || '')).toLowerCase();
    let score = 0;
    for (const mot of mots) {
      if (texte.includes(mot)) score += mot.length > 5 ? 3 : 1;
    }
    return { doc, score };
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score);

  // Recherche dans le parcours aussi
  const parcoursMatches = parcours.filter(etape => {
    const texte = ((etape.titre || '') + ' ' + (etape.description || '')).toLowerCase();
    return mots.some(m => texte.includes(m));
  });

  if (scores.length === 0 && parcoursMatches.length === 0) return null;

  let reponse = `🔍 J'ai trouvé des informations pertinentes dans les documents disponibles :\n\n`;

  if (scores.length > 0) {
    const top = scores.slice(0, 3);
    reponse += `**📚 Documents correspondants :**\n`;
    for (const { doc } of top) {
      reponse += `• **${doc.titre}** (${doc.categorie || 'général'}) — ${doc.description || ''}\n`;
    }
    reponse += `\n📂 Retrouvez ces documents dans la section **Ressources** de la plateforme.`;
  }

  if (parcoursMatches.length > 0) {
    reponse += `\n\n**📋 Étapes du parcours concernées :**\n`;
    for (const etape of parcoursMatches.slice(0, 2)) {
      reponse += `• **${etape.titre}** — ${etape.description || ''}\n`;
    }
  }

  return reponse;
}

// Règles métier pour les questions fréquentes
function getChatbotRegle(msg, prenom) {
  if (msg.includes('parcours') || msg.includes('étape') || msg.includes('intégration')) {
    return `Votre parcours d'intégration ECG est structuré en 3 phases :\n\n**📝 Pré-boarding** : Signature du contrat, accès aux outils, kit de bienvenue\n**🚀 Onboarding** : Accueil, formation initiale, prise de poste\n**🎯 Post-onboarding** : Bilans à 1 mois, 3 mois et 6 mois\n\nSuivez votre progression dans l'onglet **Parcours**.`;
  }
  if (msg.includes('formation') || msg.includes('apprendre') || msg.includes('cours')) {
    return `Le Groupe ECG propose un catalogue de formations complet :\n• **Formations obligatoires** : Sécurité, RGPD, Éthique\n• **Formations métier** : Selon votre poste\n• **Formations transversales** : Management, communication, digital\n\nAccueil au catalogue dans **Ressources** → Formations.`;
  }
  if (msg.includes('congé') || msg.includes('vacances') || msg.includes('absence')) {
    return `Pour les congés chez ECG :\n• **25 jours ouvrés/an** (dès le 1er mois)\n• **Demande** : Via votre manager, puis validation RH\n• **Délai** : Minimum 2 semaines à l'avance\n\nContactez votre référent RH pour toute question spécifique.`;
  }
  if (msg.includes('salaire') || msg.includes('paie') || msg.includes('rémunération') || msg.includes('prime') || msg.includes('commission')) {
    return `Concernant votre rémunération :\n• **Versement** : Dernier jour ouvré du mois\n• **Bulletin** : Disponible sur le portail RH\n• **Questions** : paie@ecg-group.com\n\nConsultez aussi le document **Politique de rémunération variable** dans les Ressources.`;
  }
  if (msg.includes('télétravail') || msg.includes('remote') || msg.includes('domicile')) {
    return `Politique télétravail ECG :\n• **Éligibilité** : Après 3 mois d'ancienneté\n• **Fréquence** : Jusqu'à 2 jours/semaine\n• **Conditions** : Accord manager + équipement fourni\n\nPendant l'intégration, la présence en entreprise est recommandée.`;
  }
  if (msg.includes('contact') || msg.includes('rh') || msg.includes('ressources humaines')) {
    return `Contacts RH ECG :\n• **RH général** : rh@ecg-group.com\n• **Paie** : paie@ecg-group.com\n• **Formation** : formation@ecg-group.com\n• **IT** : it-support@ecg-group.com`;
  }
  if (msg.includes('valeur') || msg.includes('culture') || msg.includes('groupe ecg')) {
    return `Les valeurs ECG :\n• **Excellence** : Qualité dans tout ce que nous faisons\n• **Collaboration** : La force du collectif\n• **Engagement** : Chaque collaborateur contribue\n• **Innovation** : Encourager les idées nouvelles\n\nDécouvrez-en plus dans le **Guide du collaborateur ECG** (Ressources).`;
  }
  if (msg.includes('aide') || msg.includes('help') || msg.includes('que peux-tu') || msg.includes('peux tu')) {
    return `Je peux vous aider sur :\n• 📋 Parcours d'intégration\n• 📚 Documents et ressources\n• 🎓 Formations disponibles\n• 💰 Rémunération et avantages\n• 🏠 Télétravail et congés\n• 👥 Contacts RH\n\nPosez votre question !`;
  }
  return null;
}

// ─── API KPI COMMERCIAUX (collaborateur) ─────────────────────────────────────

app.get('/api/kpi-commerciaux/:userId', requireAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  if (req.session.user.id !== userId && !['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const data = readData('kpi_commerciaux.json');
  const realisations = data.realisations.filter(r => r.userId === userId);

  // Enrichir avec les données de pointage réelles
  try {
    const cfg = readData('pointages.json');
    const pointagesUser = cfg.pointages.filter(p => p.userId === userId);

    // Correspondance période → préfixe de date
    const periodeMap = {
      'M0': '2026-02', // Février 2026
      'MI': '2026-02',
      'M1': '2026-03', // Mars 2026
      'M2': '2026-04',
      'M3': '2026-05'
    };

    realisations.forEach(r => {
      const prefix = periodeMap[r.mois];
      if (!prefix) return;
      const ptMois = pointagesUser.filter(p => p.date.startsWith(prefix));
      if (ptMois.length === 0) return;
      // Calculer retards et absences depuis les pointages réels
      r.retards = ptMois.filter(p => p.statut === 'retard').length;
      r.absences = ptMois.filter(p => p.statut === 'absent').length;
      r.joursTravailles = ptMois.filter(p => p.statut === 'present' || p.statut === 'retard').length;
    });
  } catch(e) {
    // Si pas de pointages, on garde les valeurs JSON existantes
  }

  res.json(realisations);
});

app.get('/api/enquete/:userId', requireAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  if (req.session.user.id !== userId && !['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const data = readData('kpi_commerciaux.json');
  const enquetes = data.enquetesSatisfaction.filter(e => e.userId === userId);
  res.json(enquetes);
});

app.post('/api/enquete', requireAuth, (req, res) => {
  const data = readData('kpi_commerciaux.json');
  const userId = req.session.user.id;
  const { periode, scores, commentaire, recommandeECG } = req.body;
  // Vérifier si une enquête pour cette période existe déjà
  const exists = data.enquetesSatisfaction.find(e => e.userId === userId && e.periode === periode);
  if (exists) return res.json({ success: false, message: 'Vous avez déjà soumis une enquête pour cette période.' });
  const newEnquete = {
    id: (data.enquetesSatisfaction.length > 0 ? Math.max(...data.enquetesSatisfaction.map(e => e.id)) + 1 : 1),
    userId,
    date: new Date().toISOString().split('T')[0],
    periode,
    scores,
    commentaire: commentaire || '',
    recommandeECG: recommandeECG === true
  };
  data.enquetesSatisfaction.push(newEnquete);
  writeData('kpi_commerciaux.json', data);
  res.json({ success: true });
});

// ─── SYSTÈME DE POINTAGE ────────────────────────────────────────────────────────────────────────────────────

// Obtenir la date du jour en heure de Tunis (UTC+1)
function getDateTunis() {
  const now = new Date();
  // UTC+1 (Tunis)
  const tunis = new Date(now.getTime() + 60 * 60 * 1000);
  return {
    date: tunis.toISOString().split('T')[0],
    heure: tunis.toISOString().split('T')[1].substring(0, 5),
    heureMinutes: tunis.getUTCHours() * 60 + tunis.getUTCMinutes(),
    jourSemaine: tunis.getUTCDay() // 0=dim, 1=lun, ..., 5=ven, 6=sam
  };
}

// Enregistrer le pointage d'un collaborateur lors de sa connexion
function enregistrerPointage(userId) {
  try {
    const cfg = readData('pointages.json');
    const { date, heure, heureMinutes, jourSemaine } = getDateTunis();

    // Ne pas pointer les week-ends (sam=6, dim=0)
    if (!cfg.config.joursOuvres.includes(jourSemaine)) return;

    // Vérifier si un pointage existe déjà pour ce jour
    const existant = cfg.pointages.find(p => p.userId === userId && p.date === date);
    if (existant) return; // Déjà pointé aujourd'hui

    // Calculer le statut
    const [hDeb, mDeb] = cfg.config.heureDebut.split(':').map(Number);
    const [hAbs, mAbs] = cfg.config.heureAbsence.split(':').map(Number);
    const minutesDebut = hDeb * 60 + mDeb;
    const minutesAbsence = hAbs * 60 + mAbs;
    const tolerance = cfg.config.toleranceMinutes;

    let statut;
    if (heureMinutes <= minutesDebut + tolerance) {
      statut = 'present'; // à l'heure ou dans la tolérance
    } else if (heureMinutes < minutesAbsence) {
      statut = 'retard'; // après tolérance mais avant 12h
    } else {
      statut = 'absent'; // connexion après 12h (ne devrait pas arriver ici normalement)
    }

    const retardMinutes = statut === 'retard' ? heureMinutes - minutesDebut : 0;

    cfg.pointages.push({
      id: Date.now(),
      userId,
      date,
      heureConnexion: heure,
      statut,
      retardMinutes
    });

    writeData('pointages.json', cfg);
  } catch (e) {
    console.error('Erreur pointage:', e.message);
  }
}

// Tâche automatique : marquer absent les collaborateurs non connectés avant 12h
function marquerAbsents() {
  try {
    const cfg = readData('pointages.json');
    const { date, heureMinutes, jourSemaine } = getDateTunis();
    if (!cfg.config.joursOuvres.includes(jourSemaine)) return;

    const [hAbs, mAbs] = cfg.config.heureAbsence.split(':').map(Number);
    const minutesAbsence = hAbs * 60 + mAbs;
    if (heureMinutes < minutesAbsence) return; // Pas encore 12h

    const users = readData('users.json');
    const collaborateurs = users.filter(u => u.role === 'collaborateur');
    let modifie = false;

    collaborateurs.forEach(u => {
      const dejaPounte = cfg.pointages.find(p => p.userId === u.id && p.date === date);
      if (!dejaPounte) {
        cfg.pointages.push({
          id: Date.now() + u.id,
          userId: u.id,
          date,
          heureConnexion: null,
          statut: 'absent',
          retardMinutes: 0
        });
        modifie = true;
      }
    });

    if (modifie) writeData('pointages.json', cfg);
  } catch (e) {
    console.error('Erreur marquerAbsents:', e.message);
  }
}

// Exécuter la vérification des absents toutes les 5 minutes
setInterval(marquerAbsents, 5 * 60 * 1000);

// ─── ROUTES API POINTAGE ────────────────────────────────────────────────────────────────────────────────────

// Pointages d'un collaborateur (lui-même ou admin)
app.get('/api/pointages/:userId', requireAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  if (req.session.user.id !== userId && !['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const cfg = readData('pointages.json');
  const pointages = cfg.pointages.filter(p => p.userId === userId).sort((a, b) => b.date.localeCompare(a.date));
  res.json({ pointages, config: cfg.config });
});

// Tous les pointages du jour (admin/RH)
app.get('/api/pointages-jour', requireAuth, (req, res) => {
  if (!['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { date } = getDateTunis();
  const cfg = readData('pointages.json');
  const users = readData('users.json');
  const collaborateurs = users.filter(u => u.role === 'collaborateur');
  const result = collaborateurs.map(u => {
    const p = cfg.pointages.find(pt => pt.userId === u.id && pt.date === date);
    return {
      userId: u.id,
      nom: u.nom,
      prenom: u.prenom,
      poste: u.poste,
      pointage: p || null,
      statut: p ? p.statut : 'non_pointe'
    };
  });
  res.json({ date, pointages: result });
});

// Calculer le nombre de jours ouvrés (lun-ven) dans un mois donné jusqu'à aujourd'hui
function joursOuvresEcoules(prefix) {
  const [annee, mois] = prefix.split('-').map(Number);
  const aujourd = getDateTunis().date;
  const finMois = new Date(Date.UTC(annee, mois, 0)); // dernier jour du mois
  const limiteDate = aujourd < `${prefix}-31` ? aujourd : finMois.toISOString().split('T')[0];
  let count = 0;
  const d = new Date(Date.UTC(annee, mois - 1, 1));
  while (d.toISOString().split('T')[0] <= limiteDate) {
    const jour = d.getUTCDay();
    if (jour >= 1 && jour <= 5) count++; // lun=1 à ven=5
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

// Stats de présence d'un collaborateur pour un mois donné
app.get('/api/stats-presence/:userId', requireAuth, (req, res) => {
  const userId = parseInt(req.params.userId);
  if (req.session.user.id !== userId && !['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { annee, mois } = req.query; // ex: 2026, 03
  const cfg = readData('pointages.json');
  const prefix = annee && mois ? `${annee}-${mois}` : getDateTunis().date.substring(0, 7);
  const pointagesMois = cfg.pointages.filter(p => p.userId === userId && p.date.startsWith(prefix));
  const presents = pointagesMois.filter(p => p.statut === 'present').length;
  const retards = pointagesMois.filter(p => p.statut === 'retard').length;
  const absents = pointagesMois.filter(p => p.statut === 'absent').length;
  const totalRetardMin = pointagesMois.filter(p => p.statut === 'retard').reduce((s, p) => s + (p.retardMinutes || 0), 0);

  // Calcul du taux d'absentéisme
  const joursOuvres = joursOuvresEcoules(prefix);
  const tauxAbsenteisme = joursOuvres > 0 ? Math.round((absents / joursOuvres) * 100 * 10) / 10 : 0;
  const tauxPresence = joursOuvres > 0 ? Math.round(((presents + retards) / joursOuvres) * 100 * 10) / 10 : 0;

  res.json({
    prefix,
    presents,
    retards,
    absents,
    totalRetardMin,
    joursOuvres,
    tauxAbsenteisme,
    tauxPresence,
    pointages: pointagesMois
  });
});

// Mettre à jour la config horaire (admin)
app.put('/api/pointage-config', requireAuth, (req, res) => {
  if (!['admin','rh'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const { heureDebut, toleranceMinutes, heureAbsence } = req.body;
  const cfg = readData('pointages.json');
  if (heureDebut) cfg.config.heureDebut = heureDebut;
  if (toleranceMinutes !== undefined) cfg.config.toleranceMinutes = parseInt(toleranceMinutes);
  if (heureAbsence) cfg.config.heureAbsence = heureAbsence;
  writeData('pointages.json', cfg);
  res.json({ success: true, config: cfg.config });
});

// ─── API ABSENTÉISME GLOBAL PAR CC (admin) ────────────────────────────────────────────────────────────────────────────────────

app.get('/api/admin/absenteisme', requireAuth, (req, res) => {
  if (!['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const users = readData('users.json');
  const cfg = readData('pointages.json');
  const { annee, mois } = req.query;
  const prefix = annee && mois ? `${annee}-${mois}` : getDateTunis().date.substring(0, 7);
  const joursOuvres = joursOuvresEcoules(prefix);

  const collaborateurs = users.filter(u => u.role === 'collaborateur');
  const result = collaborateurs.map(u => {
    const ptgs = cfg.pointages.filter(p => p.userId === u.id && p.date.startsWith(prefix));
    const presents = ptgs.filter(p => p.statut === 'present').length;
    const retards = ptgs.filter(p => p.statut === 'retard').length;
    const absents = ptgs.filter(p => p.statut === 'absent').length;
    const totalRetardMin = ptgs.filter(p => p.statut === 'retard').reduce((s, p) => s + (p.retardMinutes || 0), 0);
    const tauxAbsenteisme = joursOuvres > 0 ? Math.round((absents / joursOuvres) * 100 * 10) / 10 : 0;
    const tauxPresence = joursOuvres > 0 ? Math.round(((presents + retards) / joursOuvres) * 100 * 10) / 10 : 0;
    const alerte = tauxAbsenteisme >= 20 ? 'critique' : tauxAbsenteisme >= 10 ? 'attention' : 'ok';
    return {
      userId: u.id,
      nom: u.nom,
      prenom: u.prenom,
      poste: u.poste,
      site: u.site,
      statut: u.statut,
      presents,
      retards,
      absents,
      totalRetardMin,
      joursOuvres,
      tauxAbsenteisme,
      tauxPresence,
      alerte
    };
  });

  // Moyenne globale
  const avgAbsenteisme = result.length > 0
    ? Math.round(result.reduce((s, r) => s + r.tauxAbsenteisme, 0) / result.length * 10) / 10
    : 0;

  res.json({ prefix, joursOuvres, avgAbsenteisme, collaborateurs: result });
});

// ─── API TURNOVER & ANALYSE PAR PHASE (admin) ────────────────────────────────────────────────────────────────────────────────────

app.get('/api/admin/turnover', requireAuth, (req, res) => {
  if (!['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  const users = readData('users.json');
  const parcoursData = readData('parcours.json');
  const collaborateurs = users.filter(u => u.role === 'collaborateur');

  // Définition des phases et leur ordre
  const phaseDefs = [
    { key: 'preboarding', label: 'Pré-boarding', etapeIds: [1,2,3], emoji: '📝' },
    { key: 'onboarding', label: 'Onboarding', etapeIds: [4,5,6,7], emoji: '🚀' },
    { key: 'postonboarding', label: 'Post-onboarding', etapeIds: [8,9,10], emoji: '🎯' }
  ];

  const analyseParCollab = collaborateurs.map(u => {
    const progressions = parcoursData.progressions.filter(p => p.userId === u.id);
    const etapesDone = progressions.filter(p => p.statut === 'termine').map(p => p.etapeId);

    // Progression par phase
    const phases = phaseDefs.map(ph => {
      const total = ph.etapeIds.length;
      const done = ph.etapeIds.filter(id => etapesDone.includes(id)).length;
      const pct = Math.round((done / total) * 100);
      return { ...ph, total, done, pct };
    });

    // Déterminer la phase de blocage (première phase non complète)
    const phaseBloquee = phases.find(ph => ph.pct < 100);

    // Calcul du risque de turnover
    const joursDepuisArrivee = u.dateArrivee
      ? Math.floor((new Date() - new Date(u.dateArrivee)) / (1000 * 60 * 60 * 24))
      : 0;
    const progressionGlobale = u.progression || 0;

    // Score de risque : progression faible + temps élevé = risque fort
    let risqueTurnover = 'faible';
    let scoreRisque = 0;
    if (progressionGlobale < 30 && joursDepuisArrivee > 30) scoreRisque += 3;
    else if (progressionGlobale < 60 && joursDepuisArrivee > 60) scoreRisque += 2;
    if (phaseBloquee && phaseBloquee.key === 'preboarding') scoreRisque += 2;
    if (phaseBloquee && phaseBloquee.key === 'onboarding') scoreRisque += 1;
    if (u.statut === 'en_cours' && joursDepuisArrivee > 90) scoreRisque += 2;

    if (scoreRisque >= 4) risqueTurnover = 'eleve';
    else if (scoreRisque >= 2) risqueTurnover = 'moyen';

    return {
      userId: u.id,
      nom: u.nom,
      prenom: u.prenom,
      poste: u.poste,
      site: u.site,
      dateArrivee: u.dateArrivee,
      joursDepuisArrivee,
      progressionGlobale,
      statut: u.statut,
      phases,
      phaseBloquee: phaseBloquee || null,
      risqueTurnover,
      scoreRisque
    };
  });

  // Statistiques globales par phase
  const statsParPhase = phaseDefs.map(ph => {
    const pcts = analyseParCollab.map(c => c.phases.find(p => p.key === ph.key)?.pct || 0);
    const avg = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;
    const bloques = analyseParCollab.filter(c => c.phaseBloquee?.key === ph.key).length;
    return { ...ph, avgCompletion: avg, nbBloques: bloques };
  });

  // Taux de turnover estimé
  const nbRisqueEleve = analyseParCollab.filter(c => c.risqueTurnover === 'eleve').length;
  const nbRisqueMoyen = analyseParCollab.filter(c => c.risqueTurnover === 'moyen').length;
  const tauxTurnoverEstime = collaborateurs.length > 0
    ? Math.round(((nbRisqueEleve + nbRisqueMoyen * 0.5) / collaborateurs.length) * 100)
    : 0;

  res.json({
    totalCollaborateurs: collaborateurs.length,
    nbRisqueEleve,
    nbRisqueMoyen,
    nbRisqueFaible: collaborateurs.length - nbRisqueEleve - nbRisqueMoyen,
    tauxTurnoverEstime,
    statsParPhase,
    collaborateurs: analyseParCollab
  });
});

// ─── API ANALYSE IA AUTOMATIQUE (admin) ────────────────────────────────────────────────────────────────────────────────────

app.get('/api/admin/analyse-ia', requireAuth, async (req, res) => {
  if (!['admin','rh','pmo','pdg'].includes(req.session.user.role)) {
    return res.status(403).json({ error: 'Accès refusé' });
  }

  const users = readData('users.json');
  const parcoursData = readData('parcours.json');
  const cfg = readData('pointages.json');
  const collaborateurs = users.filter(u => u.role === 'collaborateur');
  const prefix = getDateTunis().date.substring(0, 7);
  const joursOuvres = joursOuvresEcoules(prefix);

  // Collecter toutes les données pour l'analyse
  const dataCollab = collaborateurs.map(u => {
    const ptgs = cfg.pointages.filter(p => p.userId === u.id && p.date.startsWith(prefix));
    const absents = ptgs.filter(p => p.statut === 'absent').length;
    const retards = ptgs.filter(p => p.statut === 'retard').length;
    const tauxAbsenteisme = joursOuvres > 0 ? Math.round((absents / joursOuvres) * 100) : 0;
    const progressions = parcoursData.progressions.filter(p => p.userId === u.id);
    const etapesDone = progressions.filter(p => p.statut === 'termine').map(p => p.etapeId);
    const joursDepuisArrivee = u.dateArrivee
      ? Math.floor((new Date() - new Date(u.dateArrivee)) / (1000 * 60 * 60 * 24))
      : 0;
    return {
      nom: `${u.prenom} ${u.nom}`,
      poste: u.poste,
      progression: u.progression,
      joursDepuisArrivee,
      tauxAbsenteisme,
      absents,
      retards,
      etapesDone: etapesDone.length,
      totalEtapes: 10
    };
  });

  // Construire le prompt pour l'analyse IA
  const prompt = `Tu es un expert RH et analyste de données d'intégration. Analyse les données suivantes et fournis une analyse structurée en français.

Données des collaborateurs en cours d'intégration (${prefix}) :
${JSON.stringify(dataCollab, null, 2)}

Fournis une analyse en 4 sections :
1. **Problèmes détectés** : Liste les problèmes critiques identifiés (absentéisme élevé, progression bloquée, risque de départ)
2. **Collaborateurs à risque** : Identifie les collaborateurs nécessitant une attention immédiate
3. **Causes probables** : Analyse les causes des problèmes détectés
4. **Recommandations RH** : Actions concrètes à mettre en place

Sois précis, concis et actionnable. Utilise des emojis pour faciliter la lecture.`;

  try {
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.4
      })
    });

    if (aiRes.ok) {
      const aiData = await aiRes.json();
      const analyse = aiData.choices?.[0]?.message?.content || '';
      return res.json({ success: true, analyse, generatedAt: new Date().toISOString() });
    }
  } catch(e) {
    // Fallback : analyse règle-basée si l'IA n'est pas disponible
  }

  // Analyse règle-basée (fallback sans clé API)
  const problemes = [];
  const aRisque = [];
  const recommandations = [];

  dataCollab.forEach(c => {
    if (c.tauxAbsenteisme >= 20) {
      problemes.push(`⚠️ **${c.nom}** : Taux d'absentéisme critique à **${c.tauxAbsenteisme}%** (${c.absents} absence${c.absents > 1 ? 's' : ''} sur ${joursOuvres} jours ouvrables)`);
      aRisque.push(c.nom);
      recommandations.push(`📞 Contacter **${c.nom}** en urgence pour comprendre les raisons des absences répétées`);
    } else if (c.tauxAbsenteisme >= 10) {
      problemes.push(`🟡 **${c.nom}** : Absentéisme modéré à **${c.tauxAbsenteisme}%** — à surveiller`);
      recommandations.push(`👀 Planifier un point avec **${c.nom}** pour évaluer son engagement`);
    }
    if (c.retards >= 3) {
      problemes.push(`⏰ **${c.nom}** : **${c.retards} retards** ce mois — ponctualité à améliorer`);
    }
    if (c.progression < 30 && c.joursDepuisArrivee > 30) {
      problemes.push(`🔴 **${c.nom}** : Progression bloquée à **${c.progression}%** après ${c.joursDepuisArrivee} jours d'intégration`);
      if (!aRisque.includes(c.nom)) aRisque.push(c.nom);
      recommandations.push(`🎯 Revoir le plan d'intégration de **${c.nom}** avec son manager — identifier les blocages dans le parcours`);
    }
    if (c.etapesDone < 3 && c.joursDepuisArrivee > 14) {
      problemes.push(`📋 **${c.nom}** : Seulement **${c.etapesDone} étape${c.etapesDone > 1 ? 's' : ''}** validée${c.etapesDone > 1 ? 's' : ''} après ${c.joursDepuisArrivee} jours — parcours en retard`);
    }
  });

  // Analyse globale
  const avgAbsenteisme = dataCollab.length > 0
    ? Math.round(dataCollab.reduce((s, c) => s + c.tauxAbsenteisme, 0) / dataCollab.length)
    : 0;
  const avgProgression = dataCollab.length > 0
    ? Math.round(dataCollab.reduce((s, c) => s + c.progression, 0) / dataCollab.length)
    : 0;

  let synthese = `## 🤖 Analyse IA du programme d'intégration — ${prefix}\n\n`;
  synthese += `**Contexte :** ${dataCollab.length} collaborateur${dataCollab.length > 1 ? 's' : ''} en cours d'intégration | Absentéisme moyen : **${avgAbsenteisme}%** | Progression moyenne : **${avgProgression}%**\n\n`;

  if (problemes.length === 0) {
    synthese += `### ✅ Aucun problème critique détecté\nTous les collaborateurs progressent normalement dans leur parcours d'intégration.\n\n`;
  } else {
    synthese += `### ⚠️ Problèmes détectés (${problemes.length})\n${problemes.map(p => `- ${p}`).join('\n')}\n\n`;
  }

  if (aRisque.length > 0) {
    synthese += `### 🔴 Collaborateurs à risque\n${aRisque.map(n => `- **${n}**`).join('\n')}\n\n`;
    synthese += `### 🔍 Causes probables\n- Difficultés d'adaptation au poste ou à l'équipe\n- Manque d'accompagnement dans les premières semaines\n- Problèmes personnels pouvant impacter la présence\n- Parcours d'intégration trop chargé ou mal adapté\n\n`;
  } else {
    synthese += `### 🔍 Analyse des causes\nAucun collaborateur ne présente de signaux d'alarme majeurs. La dynamique d'intégration est positive.\n\n`;
  }

  if (recommandations.length > 0) {
    synthese += `### 💡 Recommandations RH\n${recommandations.map(r => `- ${r}`).join('\n')}\n`;
  } else {
    synthese += `### 💡 Recommandations RH\n- ✅ Maintenir le rythme actuel d'accompagnement\n- 📊 Continuer le suivi mensuel des indicateurs\n- 👍 Valoriser les collaborateurs qui progressent bien`;
  }

  res.json({ success: true, analyse: synthese, generatedAt: new Date().toISOString(), fallback: true });
});
// ─── ALERTES MANAGER ─────────────────────────────────────────────────────────────────────────────────────
const alertesPath = path.join(__dirname, 'data', 'alertes.json');
function loadAlertes() { try { return JSON.parse(fs.readFileSync(alertesPath, 'utf8')); } catch { return { alertes: [] }; } }
function saveAlertes(d) { fs.writeFileSync(alertesPath, JSON.stringify(d, null, 2)); }

// POST : un conseiller envoie une alerte à son manager
app.post('/api/alertes-manager', requireAuth, (req, res) => {
  const { userId, nom, site, mois, alertes, kpi, presence } = req.body;
  if (!userId || !alertes || alertes.length === 0) return res.json({ success: false });
  const data = loadAlertes();
  // Éviter les doublons : une alerte par user par mois
  const existing = data.alertes.findIndex(a => a.userId === userId && a.mois === mois);
  const alerte = {
    id: Date.now(),
    userId, nom, site, mois,
    alertes, kpi, presence,
    date: new Date().toISOString(),
    lu: false
  };
  if (existing >= 0) {
    data.alertes[existing] = alerte; // mise à jour
  } else {
    data.alertes.unshift(alerte);
  }
  // Garder les 100 dernières alertes
  data.alertes = data.alertes.slice(0, 100);
  saveAlertes(data);
  res.json({ success: true });
});

// GET : l'admin récupère toutes les alertes
app.get('/api/alertes-manager', requireAdmin, (req, res) => {
  const data = loadAlertes();
  res.json(data.alertes);
});

// PUT : marquer une alerte comme lue
app.put('/api/alertes-manager/:id/lu', requireAdmin, (req, res) => {
  const data = loadAlertes();
  const idx = data.alertes.findIndex(a => a.id === parseInt(req.params.id));
  if (idx >= 0) { data.alertes[idx].lu = true; saveAlertes(data); }
  res.json({ success: true });
});

// DELETE : supprimer une alerte
app.delete('/api/alertes-manager/:id', requireAdmin, (req, res) => {
  const data = loadAlertes();
  data.alertes = data.alertes.filter(a => a.id !== parseInt(req.params.id));
  saveAlertes(data);
  res.json({ success: true });
});// ─── PLANNING COACH INTÉGRATEUR ─────────────────────────────────────────────────────────────────────────────────────
app.get('/api/planning-coach/:userId', requireAuth, (req, res) => {
  const users = loadUsers();
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  // Seul le CC lui-même, son coach assigné, ou un admin peut voir ce planning
  const isOwner = req.session.userId === userId;
  const isCoach = req.session.userRole === 'coach' || req.session.userRole === 'admin' || req.session.userRole === 'rh' || req.session.userRole === 'pmo' || req.session.userRole === 'pdg';
  if (!isOwner && !isCoach) return res.status(403).json({ error: 'Accès refusé' });
  // Données de démonstration
  const planning = {
    coachNom: 'Adam Perez',
    noteCoach: 'Vous progressez très bien ! Continuez à travailler sur votre argumentaire produit et la gestion des objections. Je suis disponible pour toute question entre nos séances.',
    seances: [
      { id: 1, titre: 'Accélérateur terrain — Prise de contact client', date: '15 Avr 2026', duree: '2h', statut: 'fait' },
      { id: 2, titre: 'Suivi objectifs commerciaux — Semaine 2', date: '22 Avr 2026', duree: '1h30', statut: 'fait' },
      { id: 3, titre: 'Accompagnement terrain — Rendez-vous client', date: '29 Avr 2026', duree: '3h', statut: 'planifie' },
      { id: 4, titre: 'Bilan mi-parcours — Analyse des KPIs', date: '06 Mai 2026', duree: '1h', statut: 'en_attente' },
      { id: 5, titre: 'Préparation évaluation manager', date: '13 Mai 2026', duree: '1h30', statut: 'en_attente' },
    ],
    planActions: [
      { action: 'Maîtriser l’argumentaire Apivia Santé', priorite: 'haute', echeance: '30 Avr 2026', objectif: 'Score > 80% au test produit', avancement: 65 },
      { action: 'Atteindre 15 appels/jour', priorite: 'haute', echeance: '30 Avr 2026', objectif: 'Volume d’activité hebdomadaire', avancement: 80 },
      { action: 'Saisir toutes les activités dans le CRM', priorite: 'moyenne', echeance: 'Continu', objectif: 'Taux de saisie > 95%', avancement: 90 },
      { action: 'Travailler la gestion des objections', priorite: 'moyenne', echeance: '15 Mai 2026', objectif: 'Taux de transformation > 20%', avancement: 40 },
    ]
  };
  res.json(planning);
});

// ─── SUIVI ÉVALUATION ─────────────────────────────────────────────────────────────────────────────────────
app.get('/api/suivi-eval/:userId', requireAuth, (req, res) => {
  const users = loadUsers();
  const userId = parseInt(req.params.userId);
  const user = users.find(u => u.id === userId);
  if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
  const isOwner = req.session.userId === userId;
  const isAdmin = ['admin','rh','pmo','pdg','coach','formateur','recruteur'].includes(req.session.userRole);
  if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Accès refusé' });
  // Données de démonstration
  const suivi = {
    evaluations: [
      { id: 1, titre: 'Test produits — Apivia Santé', date: '10 Avr 2026', evaluateur: 'Sofiane Dekkak (Formateur)', score: 72, statut: 'valide', commentaire: 'Bonne compréhension des garanties de base. À approfondir sur les options complémentaires.' },
      { id: 2, titre: 'Mise en situation commerciale', date: '15 Avr 2026', evaluateur: 'Adam Perez (Coach)', score: 68, statut: 'valide', commentaire: 'Bonne écoute active. Travailler la conclusion et le closing.' },
      { id: 3, titre: 'Connaissance gamme Allianz', date: '18 Avr 2026', evaluateur: 'Sofiane Dekkak (Formateur)', score: 85, statut: 'valide', commentaire: 'Excellent ! Maîtrise très satisfaisante de la gamme.' },
      { id: 4, titre: 'Évaluation terrain — Accompagnement J+15', date: '22 Avr 2026', evaluateur: 'Adam Perez (Coach)', score: 75, statut: 'valide', commentaire: 'Progression notable sur la prise de contact. Continuer les efforts.' },
      { id: 5, titre: 'Bilan mi-parcours — Manager', date: '05 Mai 2026', evaluateur: 'Manager direct', score: 0, statut: 'en_attente', commentaire: null },
    ]
  };
  res.json(suivi);
});
// ─── PARRAINAGE ───────────────────────────────────────────────────────────────────────────────────────────────────
app.post('/api/parrainage', requireAuth, (req, res) => {
  const { prenom, nom, email, tel, commentaire, parrainId, parrainNom } = req.body;
  if (!prenom || !nom || !email) return res.status(400).json({ success: false, message: 'Champs obligatoires manquants.' });
  const filePath = path.join(__dirname, 'data', 'parrainages.json');
  let parrainages = [];
  try { parrainages = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { parrainages = []; }
  parrainages.push({
    id: Date.now(),
    prenom, nom, email, tel: tel || '',
    commentaire: commentaire || '',
    parrainId, parrainNom,
    date: new Date().toLocaleDateString('fr-FR'),
    statut: 'nouveau'
  });
  fs.writeFileSync(filePath, JSON.stringify(parrainages, null, 2));
  res.json({ success: true });
});

app.get('/api/parrainages', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (!['admin','rh','pmo','pdg','recruteur'].includes(role)) return res.status(403).json({ error: 'Accès refusé' });
  const filePath = path.join(__dirname, 'data', 'parrainages.json');
  let parrainages = [];
  try { parrainages = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { parrainages = []; }
  res.json(parrainages);
});

// ─── UPLOAD FICHIER ─────────────────────────────────────────────────────────────────────────────────────────────
app.post('/api/upload-fichier', requireAuth, upload.single('fichier'), (req, res) => {
  const role = req.session.user.role;
  if (!['admin','rh','pmo','pdg'].includes(role)) return res.status(403).json({ error: 'Accès refusé' });
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const url = '/uploads/' + req.file.filename;
  const ext = path.extname(req.file.originalname).replace('.','').toUpperCase();
  const taille = (req.file.size / 1024 / 1024).toFixed(1) + ' MB';
  res.json({ success: true, url, filename: req.file.filename, originalname: req.file.originalname, type: ext, taille });
});

// ─── RESSOURCES PMO ──────────────────────────────────────────────────────────────────────────────────────────────
app.post('/api/ressources-pmo', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role !== 'pmo') return res.status(403).json({ error: 'Accès réservé au PMO' });
  const { titre, categorie, type, taille, description, url, icone } = req.body;
  if (!titre) return res.status(400).json({ error: 'Titre obligatoire' });
  const filePath = path.join(__dirname, 'data', 'ressources_custom.json');
  let ressources = [];
  try { ressources = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { ressources = []; }
  const newR = { id: Date.now(), titre, categorie: categorie||'rh', type: type||'PDF', taille: taille||'—', description: description||'', url: url||'', icone: icone||'📄', dateAjout: new Date().toLocaleDateString('fr-FR'), ajoutePar: req.session.user.login };
  ressources.push(newR);
  fs.writeFileSync(filePath, JSON.stringify(ressources, null, 2));
  res.json({ success: true, ressource: newR });
});

app.delete('/api/ressources-pmo/:id', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role !== 'pmo') return res.status(403).json({ error: 'Accès réservé au PMO' });
  const id = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'ressources_custom.json');
  let ressources = [];
  try { ressources = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { ressources = []; }
  ressources = ressources.filter(r => r.id !== id);
  fs.writeFileSync(filePath, JSON.stringify(ressources, null, 2));
  res.json({ success: true });
});

// ─── PARCOURS PMO ────────────────────────────────────────────────────────────────────────────────────────────────
app.post('/api/parcours-pmo', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role !== 'pmo') return res.status(403).json({ error: 'Accès réservé au PMO' });
  const { titre, phase, duree, description } = req.body;
  if (!titre) return res.status(400).json({ error: 'Titre obligatoire' });
  const filePath = path.join(__dirname, 'data', 'parcours_custom.json');
  let etapes = [];
  try { etapes = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { etapes = []; }
  const newE = { id: Date.now(), titre, phase: phase||'Semaine 1', duree: duree||'1 jour', description: description||'' };
  etapes.push(newE);
  fs.writeFileSync(filePath, JSON.stringify(etapes, null, 2));
  res.json({ success: true, etape: newE });
});

app.delete('/api/parcours-pmo/:id', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role !== 'pmo') return res.status(403).json({ error: 'Accès réservé au PMO' });
  const id = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'parcours_custom.json');
  let etapes = [];
  try { etapes = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { etapes = []; }
  etapes = etapes.filter(e => e.id !== id);
  fs.writeFileSync(filePath, JSON.stringify(etapes, null, 2));
  res.json({ success: true });
});

// ─── PLANNING COACH PMO ──────────────────────────────────────────────────────────────────────────────────────────
app.get('/api/planning-coach-pmo', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role !== 'pmo') return res.status(403).json({ error: 'Accès réservé au PMO' });
  const filePath = path.join(__dirname, 'data', 'planning_coach.json');
  let planning = [];
  try { planning = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { planning = []; }
  res.json(planning);
});

app.post('/api/planning-coach-pmo', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role !== 'pmo') return res.status(403).json({ error: 'Accès réservé au PMO' });
  const { collaborateur, coach, date, heure, type, objectif, statut } = req.body;
  if (!collaborateur || !date) return res.status(400).json({ error: 'Collaborateur et date obligatoires' });
  const filePath = path.join(__dirname, 'data', 'planning_coach.json');
  let planning = [];
  try { planning = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { planning = []; }
  const newS = { id: Date.now(), collaborateur, coach: coach||'', date, heure: heure||'09:00', type: type||'Point de suivi', objectif: objectif||'', statut: statut||'planifie', creePar: req.session.user.login, dateCreation: new Date().toLocaleDateString('fr-FR') };
  planning.push(newS);
  fs.writeFileSync(filePath, JSON.stringify(planning, null, 2));
  res.json({ success: true, seance: newS });
});

app.delete('/api/planning-coach-pmo/:id', requireAuth, (req, res) => {
  const role = req.session.user.role;
  if (role !== 'pmo') return res.status(403).json({ error: 'Accès réservé au PMO' });
  const id = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'planning_coach.json');
  let planning = [];
  try { planning = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { planning = []; }
  planning = planning.filter(s => s.id !== id);
  fs.writeFileSync(filePath, JSON.stringify(planning, null, 2));
  res.json({ success: true });
});

// ─── DÉMARRAGE ───────────────────────────────────────────────────────────────────────────────────────────────────

// ─── API GESTION PMO ─────────────────────────────────────────────────────────

// POST /api/ressources-pmo — Ajouter une ressource
app.post('/api/ressources-pmo', requireAdmin, (req, res) => {
  const role = req.session.user.role;
  if (!['admin','rh','pmo','pdg'].includes(role)) return res.status(403).json({ error: 'Accès refusé' });
  const { titre, categorie, type, taille, description, url, icone } = req.body;
  if (!titre || !categorie) return res.status(400).json({ error: 'Titre et catégorie requis' });
  const filePath = path.join(__dirname, 'data', 'ressources_custom.json');
  let ressources = [];
  try { ressources = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { ressources = []; }
  const newId = ressources.length ? Math.max(...ressources.map(r => r.id || 0)) + 1 : 1000;
  const newRessource = { id: newId, titre, categorie, type: type||'PDF', taille: taille||'—', description: description||'', url: url||'', icone: icone||'📄', dateAjout: new Date().toISOString().slice(0,10) };
  ressources.push(newRessource);
  fs.writeFileSync(filePath, JSON.stringify(ressources, null, 2));
  res.json({ success: true, ressource: newRessource });
});

// DELETE /api/ressources-pmo/:id — Supprimer une ressource custom
app.delete('/api/ressources-pmo/:id', requireAdmin, (req, res) => {
  const role = req.session.user.role;
  if (!['admin','rh','pmo','pdg'].includes(role)) return res.status(403).json({ error: 'Accès refusé' });
  const id = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'ressources_custom.json');
  let ressources = [];
  try { ressources = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) { ressources = []; }
  const before = ressources.length;
  ressources = ressources.filter(r => r.id !== id);
  if (ressources.length === before) return res.status(404).json({ error: 'Ressource non trouvée (ressources statiques non supprimables)' });
  fs.writeFileSync(filePath, JSON.stringify(ressources, null, 2));
  res.json({ success: true });
});

// POST /api/parcours-pmo — Ajouter une étape au parcours
app.post('/api/parcours-pmo', requireAdmin, (req, res) => {
  const role = req.session.user.role;
  if (!['admin','rh','pmo','pdg'].includes(role)) return res.status(403).json({ error: 'Accès refusé' });
  const { titre, phase, duree, description } = req.body;
  if (!titre) return res.status(400).json({ error: 'Titre requis' });
  const filePath = path.join(__dirname, 'data', 'parcours.json');
  let data = { etapes: [] };
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) {}
  if (!data.etapes) data.etapes = [];
  const newId = data.etapes.length ? Math.max(...data.etapes.map(e => e.id || 0)) + 1 : 1;
  data.etapes.push({ id: newId, titre, phase: phase||'Semaine 1', duree: duree||'1 jour', description: description||'' });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// DELETE /api/parcours-pmo/:id — Supprimer une étape du parcours
app.delete('/api/parcours-pmo/:id', requireAdmin, (req, res) => {
  const role = req.session.user.role;
  if (!['admin','rh','pmo','pdg'].includes(role)) return res.status(403).json({ error: 'Accès refusé' });
  const id = parseInt(req.params.id);
  const filePath = path.join(__dirname, 'data', 'parcours.json');
  let data = { etapes: [] };
  try { data = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch(e) {}
  if (!data.etapes) data.etapes = [];
  data.etapes = data.etapes.filter(e => e.id !== id);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  res.json({ success: true });
});

// ─── API COACH INTÉGRATEUR ───────────────────────────────────────────────────
// Fichiers de données coach
const coachDataPath = (file) => path.join(__dirname, 'data', file);
const loadCoachData = (file) => { try { return JSON.parse(fs.readFileSync(coachDataPath(file), 'utf8')); } catch(e) { return []; } };
const saveCoachData = (file, data) => fs.writeFileSync(coachDataPath(file), JSON.stringify(data, null, 2));

// Middleware : seul le coach (et admin/rh/pmo/pdg) peut accéder
const requireCoach = (req, res, next) => {
  const role = req.session.user?.role;
  if (!['coach','admin','rh','pmo','pdg'].includes(role)) return res.status(403).json({ error: 'Accès réservé au Coach Intégrateur' });
  next();
};

// GET /api/coach/seances — Toutes les séances du coach connecté
app.get('/api/coach/seances', requireAuth, requireCoach, (req, res) => {
  const seances = loadCoachData('coach_seances.json');
  const coachLogin = req.session.user.login;
  const filtered = req.session.user.role === 'coach' ? seances.filter(s => s.coachLogin === coachLogin) : seances;
  res.json(filtered);
});

// POST /api/coach/seances — Créer une séance
app.post('/api/coach/seances', requireAuth, requireCoach, (req, res) => {
  const { ccId, ccNom, titre, date, heure, duree, type, statut, notes } = req.body;
  if (!ccId || !date || !titre) return res.status(400).json({ error: 'ccId, titre et date obligatoires' });
  const seances = loadCoachData('coach_seances.json');
  const newS = { id: Date.now(), ccId: parseInt(ccId), ccNom: ccNom||'', titre, date, heure: heure||'09:00', duree: duree||'1h', type: type||'Suivi', statut: statut||'planifie', notes: notes||'', coachLogin: req.session.user.login, coachNom: req.session.user.prenom+' '+req.session.user.nom, dateCreation: new Date().toLocaleDateString('fr-FR') };
  seances.push(newS);
  saveCoachData('coach_seances.json', seances);
  res.json({ success: true, seance: newS });
});

// PUT /api/coach/seances/:id — Modifier statut/notes d'une séance
app.put('/api/coach/seances/:id', requireAuth, requireCoach, (req, res) => {
  const id = parseInt(req.params.id);
  const seances = loadCoachData('coach_seances.json');
  const idx = seances.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Séance non trouvée' });
  seances[idx] = { ...seances[idx], ...req.body };
  saveCoachData('coach_seances.json', seances);
  res.json({ success: true, seance: seances[idx] });
});

// DELETE /api/coach/seances/:id — Supprimer une séance
app.delete('/api/coach/seances/:id', requireAuth, requireCoach, (req, res) => {
  let seances = loadCoachData('coach_seances.json');
  seances = seances.filter(s => s.id !== parseInt(req.params.id));
  saveCoachData('coach_seances.json', seances);
  res.json({ success: true });
});

// GET /api/coach/plan-action — Plans d'action par CC
app.get('/api/coach/plan-action', requireAuth, requireCoach, (req, res) => {
  const plans = loadCoachData('coach_plan_action.json');
  const coachLogin = req.session.user.login;
  const filtered = req.session.user.role === 'coach' ? plans.filter(p => p.coachLogin === coachLogin) : plans;
  res.json(filtered);
});

// POST /api/coach/plan-action — Ajouter une action
app.post('/api/coach/plan-action', requireAuth, requireCoach, (req, res) => {
  const { ccId, ccNom, action, priorite, echeance, objectif, avancement } = req.body;
  if (!ccId || !action) return res.status(400).json({ error: 'ccId et action obligatoires' });
  const plans = loadCoachData('coach_plan_action.json');
  const newA = { id: Date.now(), ccId: parseInt(ccId), ccNom: ccNom||'', action, priorite: priorite||'moyenne', echeance: echeance||'', objectif: objectif||'', avancement: parseInt(avancement)||0, statut: 'en_cours', coachLogin: req.session.user.login, dateCreation: new Date().toLocaleDateString('fr-FR') };
  plans.push(newA);
  saveCoachData('coach_plan_action.json', plans);
  res.json({ success: true, action: newA });
});

// PUT /api/coach/plan-action/:id — Mettre à jour une action (avancement, statut)
app.put('/api/coach/plan-action/:id', requireAuth, requireCoach, (req, res) => {
  const id = parseInt(req.params.id);
  const plans = loadCoachData('coach_plan_action.json');
  const idx = plans.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Action non trouvée' });
  plans[idx] = { ...plans[idx], ...req.body };
  saveCoachData('coach_plan_action.json', plans);
  res.json({ success: true, action: plans[idx] });
});

// DELETE /api/coach/plan-action/:id — Supprimer une action
app.delete('/api/coach/plan-action/:id', requireAuth, requireCoach, (req, res) => {
  let plans = loadCoachData('coach_plan_action.json');
  plans = plans.filter(p => p.id !== parseInt(req.params.id));
  saveCoachData('coach_plan_action.json', plans);
  res.json({ success: true });
});

// GET /api/coach/taches — Tâches réalisées par le coach
app.get('/api/coach/taches', requireAuth, requireCoach, (req, res) => {
  const taches = loadCoachData('coach_taches.json');
  const coachLogin = req.session.user.login;
  const filtered = req.session.user.role === 'coach' ? taches.filter(t => t.coachLogin === coachLogin) : taches;
  res.json(filtered);
});

// POST /api/coach/taches — Ajouter une tâche réalisée
app.post('/api/coach/taches', requireAuth, requireCoach, (req, res) => {
  const { ccId, ccNom, titre, description, date, categorie, duree } = req.body;
  if (!ccId || !titre) return res.status(400).json({ error: 'ccId et titre obligatoires' });
  const taches = loadCoachData('coach_taches.json');
  const newT = { id: Date.now(), ccId: parseInt(ccId), ccNom: ccNom||'', titre, description: description||'', date: date||new Date().toLocaleDateString('fr-FR'), categorie: categorie||'suivi', duree: duree||'', coachLogin: req.session.user.login, dateCreation: new Date().toLocaleDateString('fr-FR') };
  taches.push(newT);
  saveCoachData('coach_taches.json', taches);
  res.json({ success: true, tache: newT });
});

// DELETE /api/coach/taches/:id — Supprimer une tâche
app.delete('/api/coach/taches/:id', requireAuth, requireCoach, (req, res) => {
  let taches = loadCoachData('coach_taches.json');
  taches = taches.filter(t => t.id !== parseInt(req.params.id));
  saveCoachData('coach_taches.json', taches);
  res.json({ success: true });
});

// ─── UPLOAD DOCUMENTS COACH ────────────────────────────────────────────────
const coachUploadDir = path.join(__dirname, 'uploads', 'coach');
if (!fs.existsSync(coachUploadDir)) fs.mkdirSync(coachUploadDir, { recursive: true });

const coachStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, coachUploadDir),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, Date.now() + '_' + safeName);
  }
});
const coachUpload = multer({ storage: coachStorage, limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/coach/upload — Upload d'un ou plusieurs documents
app.post('/api/coach/upload', requireAuth, requireCoach, coachUpload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'Aucun fichier reçu' });
  const uploaded = req.files.map(f => ({
    nom: f.originalname,
    fichier: '/uploads/coach/' + f.filename,
    taille: f.size,
    type: f.mimetype
  }));
  res.json({ success: true, fichiers: uploaded });
});

// GET /uploads/coach/:filename — Servir les fichiers uploadés
app.use('/uploads/coach', requireAuth, express.static(coachUploadDir));

// ─── UPLOAD PHOTO DE PROFIL ─────────────────────────────────────────────────
const avatarUploadDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(avatarUploadDir)) fs.mkdirSync(avatarUploadDir, { recursive: true });

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, avatarUploadDir),
  filename: (req, file, cb) => {
    const login = req.session.user.login.replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, 'avatar_' + login + ext);
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Seules les images sont acceptées'));
    cb(null, true);
  }
});

// POST /api/profil/avatar — Upload photo de profil
app.post('/api/profil/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucune image reçue' });
  const avatarUrl = '/uploads/avatars/' + req.file.filename;
  // Mettre à jour l'avatar dans users.json
  const usersPath = path.join(__dirname, 'data', 'users.json');
  let users = [];
  try { users = JSON.parse(fs.readFileSync(usersPath, 'utf8')); } catch(e) {}
  const idx = users.findIndex(u => u.login === req.session.user.login);
  if (idx !== -1) {
    users[idx].avatar = avatarUrl;
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
    req.session.user.avatar = avatarUrl;
  }
  res.json({ success: true, avatarUrl });
});

// GET /uploads/avatars/:filename — Servir les avatars (public pour affichage)
app.use('/uploads/avatars', express.static(avatarUploadDir));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`ECG CRM running on http://0.0.0.0:${PORT}`);
});