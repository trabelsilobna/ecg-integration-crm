# 📦 Guide d'Installation — Plateforme ECG Intégration

## Prérequis

Avant de commencer, assurez-vous d'avoir installé sur votre serveur :

| Logiciel | Version minimale | Lien de téléchargement |
|----------|-----------------|------------------------|
| **Node.js** | 18.x ou supérieur | https://nodejs.org |
| **npm** | 8.x ou supérieur | (inclus avec Node.js) |

---

## 🚀 Installation en 5 étapes

### Étape 1 — Décompresser l'archive

Décompressez le fichier `ecg-integration.zip` dans le dossier de votre choix :

```bash
unzip ecg-integration.zip -d ecg-integration
cd ecg-integration
```

### Étape 2 — Installer les dépendances

```bash
npm install
```

Cette commande télécharge automatiquement toutes les librairies nécessaires (Express, bcryptjs, etc.).

### Étape 3 — Configurer le port (optionnel)

Par défaut, l'application tourne sur le **port 5000**.

Pour changer le port, créez un fichier `.env` à la racine :

```
PORT=3000
SESSION_SECRET=votre-secret-personnalise-2026
```

### Étape 4 — Démarrer l'application

```bash
npm start
```

Vous devriez voir :
```
ECG CRM running on http://0.0.0.0:5000
```

### Étape 5 — Accéder à l'application

Ouvrez votre navigateur et allez sur :
```
http://votre-ip-serveur:5000
```

---

## 🌐 Hébergement recommandé

### Option 1 — Railway.app (gratuit, le plus simple)

1. Créez un compte sur https://railway.app
2. Cliquez sur **"New Project"** → **"Deploy from GitHub"**
3. Uploadez le dossier ou connectez votre dépôt GitHub
4. Railway détecte automatiquement Node.js et démarre l'application
5. Vous obtenez une URL permanente du type `ecg-integration.up.railway.app`

### Option 2 — Render.com (gratuit)

1. Créez un compte sur https://render.com
2. Cliquez sur **"New Web Service"**
3. Uploadez le code ou connectez GitHub
4. Commande de démarrage : `npm start`
5. URL permanente fournie automatiquement

### Option 3 — VPS OVH/DigitalOcean

1. Louez un VPS (à partir de 3€/mois)
2. Installez Node.js : `sudo apt install nodejs npm`
3. Copiez les fichiers sur le serveur via FTP ou SSH
4. Démarrez avec PM2 pour la persistance :
   ```bash
   npm install -g pm2
   pm2 start server.js --name ecg-crm
   pm2 startup
   pm2 save
   ```

---

## 👥 Comptes utilisateurs par défaut

| Rôle | Login | Mot de passe |
|------|-------|-------------|
| Admin | `arab.benourdia` | `admin123` |
| PMO | `lobna.trabelsi` | `admin123` |
| PDG | `kamel.aich` | `admin123` |
| Dir. Commercial | `lorenzo.aich` | `lorenzo123` |
| Recruteur | `oumaima.gnaoui` | `recruteur123` |
| Coach Intégrateur | `adam.perez` | `coach123` |
| Formateur | `sofiane.dekkak` | `formateur123` |
| Collaborateur | `katia.lopez` | `admin123` |

> ⚠️ **Important** : Changez tous les mots de passe après le premier déploiement en production.

---

## 📁 Structure des fichiers

```
ecg-integration/
├── server.js          ← Serveur principal (Node.js/Express)
├── package.json       ← Dépendances
├── data/              ← Base de données JSON
│   ├── users.json     ← Comptes utilisateurs
│   ├── parcours.json  ← Étapes du parcours CC
│   ├── candidatures.json
│   └── ...
├── views/             ← Pages HTML
│   ├── login.html     ← Page de connexion
│   ├── app.html       ← Interface principale
│   └── collaborateur.html ← Espace CC
├── public/            ← Fichiers statiques (CSS, images)
│   ├── img/           ← Logo ECG et images
│   └── uploads/       ← Fichiers uploadés par les utilisateurs
└── uploads/           ← Documents coach et PMO
```

---

## 🔧 Maintenance

### Sauvegarder les données

Les données sont stockées dans des fichiers JSON dans le dossier `data/`. Pour sauvegarder :

```bash
cp -r data/ backup-data-$(date +%Y%m%d)/
```

### Ajouter un nouvel utilisateur

Éditez le fichier `data/users.json` et ajoutez un objet utilisateur. Le mot de passe doit être hashé avec bcrypt. Utilisez ce script :

```bash
node -e "const b=require('bcryptjs'); b.hash('MotDePasse123', 10, (e,h)=>console.log(h))"
```

---

## ❓ Support

Pour toute question technique, contactez l'équipe projet ECG :
- **Email** : l.trabelsi@cplussur.com
- **Projet** : INTEG-2026

---

*© 2026 ECG Group — Plateforme d'Intégration v1.0*
