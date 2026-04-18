# 📖 Guide d'installation — Suivi Comptes
## Pas-à-pas sans terminal (100% via navigateur)

---

## ✅ Ce dont vous avez besoin
- Un compte **GitHub** (gratuit) → https://github.com
- Un compte **Supabase** (gratuit) → https://supabase.com
- Un navigateur web (Chrome, Firefox, Edge…)

---

## ÉTAPE 1 — Configurer Supabase (base de données)

### 1.1 Créer un nouveau projet Supabase
1. Connectez-vous sur https://supabase.com
2. Cliquez **"New project"**
3. Choisissez votre organisation
4. **Nom** : `suivi-comptes`
5. **Mot de passe base de données** : choisissez un mot de passe fort (notez-le quelque part)
6. **Région** : `West EU (Ireland)` — la plus proche de la Belgique
7. Cliquez **"Create new project"** — attendez 1-2 minutes

### 1.2 Créer les tables (schéma)
1. Dans Supabase, allez dans **SQL Editor** (icône dans le menu de gauche)
2. Cliquez **"New query"**
3. Ouvrez le fichier `schema.sql` de ce dossier
4. Copiez **tout le contenu** et collez-le dans l'éditeur Supabase
5. Cliquez **"Run"** (bouton vert)
6. Vous devriez voir : `Success. No rows returned`
7. ✅ Vos 13 comptes sont créés ! Vérifiez dans **Table Editor > comptes**

### 1.3 Créer votre compte utilisateur
1. Dans Supabase, allez dans **Authentication > Users**
2. Cliquez **"Add user" > "Create new user"**
3. Entrez une **adresse email** (ex: `suivi@famille.com`)
4. Entrez un **mot de passe** — c'est ce que vous et Mathilde utiliserez pour vous connecter
5. Cochez **"Auto confirm user"**
6. Cliquez **"Create user"**

### 1.4 Récupérer vos clés Supabase
1. Dans Supabase, allez dans **Settings > API** (icône engrenage en bas à gauche)
2. Notez ces deux valeurs (vous en aurez besoin à l'étape 3) :
   - **Project URL** → ressemble à `https://xxxxx.supabase.co`
   - **anon public key** → longue chaîne de caractères

---

## ÉTAPE 2 — Créer le dépôt GitHub

### 2.1 Créer le dépôt
1. Connectez-vous sur https://github.com
2. Cliquez **"New"** ou le **"+"** en haut à droite > **"New repository"**
3. **Repository name** : `suivi-comptes` ⚠️ (exactement ce nom, en minuscules)
4. Laissez sur **"Public"** (nécessaire pour GitHub Pages gratuit)
5. **NE cochez pas** "Add a README file"
6. Cliquez **"Create repository"**

### 2.2 Uploader les fichiers du projet
1. Sur la page de votre nouveau dépôt, cliquez **"uploading an existing file"**
2. Extrayez le ZIP `suivi-comptes.zip` sur votre ordinateur
3. **Glissez-déposez TOUS les fichiers et dossiers** dans la zone de dépôt GitHub
   - ⚠️ Assurez-vous d'inclure le dossier `.github` (il peut être caché sur Mac/Windows)
   - Pour voir les fichiers cachés sur Windows : Affichage > Éléments masqués ✓
   - Pour voir les fichiers cachés sur Mac : `Cmd + Shift + .`
4. Ajoutez un message de commit : `Premier déploiement`
5. Cliquez **"Commit changes"**

---

## ÉTAPE 3 — Configurer les secrets GitHub

Ces secrets permettent à GitHub de construire l'application avec vos données Supabase.

1. Dans votre dépôt GitHub, allez dans **Settings** (onglet en haut)
2. Dans le menu gauche : **Secrets and variables > Actions**
3. Cliquez **"New repository secret"**

**Secret 1 :**
- Name : `VITE_SUPABASE_URL`
- Secret : votre **Project URL** de Supabase (ex: `https://xxxxx.supabase.co`)
- Cliquez **"Add secret"**

**Secret 2 :**
- Name : `VITE_SUPABASE_ANON_KEY`
- Secret : votre **anon public key** de Supabase
- Cliquez **"Add secret"**

---

## ÉTAPE 4 — Activer GitHub Pages

1. Dans votre dépôt GitHub, allez dans **Settings > Pages** (menu gauche)
2. **Source** : `Deploy from a branch`
3. **Branch** : `gh-pages` / `/ (root)`
   - ⚠️ Si `gh-pages` n'existe pas encore, attendez 2-3 minutes que le déploiement se termine (voir étape 5)
4. Cliquez **"Save"**

---

## ÉTAPE 5 — Vérifier le déploiement automatique

1. Dans votre dépôt GitHub, cliquez sur l'onglet **Actions**
2. Vous verrez un workflow "Déployer sur GitHub Pages" en cours
3. Attendez qu'il passe au vert ✅ (2-3 minutes)
4. Si rouge ❌ : cliquez dessus pour voir l'erreur et vérifiez vos secrets

---

## ÉTAPE 6 — Accéder à votre application

🎉 Votre application est disponible à l'adresse :

```
https://VOTRE_NOM_GITHUB.github.io/suivi-comptes/
```

Remplacez `VOTRE_NOM_GITHUB` par votre identifiant GitHub.

Connectez-vous avec l'email et le mot de passe créés à l'étape 1.3.

---

## ÉTAPE 7 — Première configuration de l'application

Une fois connecté, commencez par :

1. **⚙️ Paramètres > Comptes** — Renseignez le **solde initial** de chaque compte (le solde actuel de vos vrais comptes bancaires)
2. **⚙️ Paramètres > Catégories** — Créez vos catégories (ex: Alimentation, Loisirs, Maison…) et sous-catégories
3. **⚙️ Paramètres > Tiers** — Ajoutez vos tiers fréquents avec leur catégorie par défaut
4. Commencez à ajouter vos transactions !

---

## 🔄 Comment mettre à jour l'application

Si une nouvelle version est disponible :
1. Téléchargez le nouveau ZIP
2. Allez dans votre dépôt GitHub
3. Modifiez ou remplacez les fichiers concernés via l'interface web
4. Le déploiement se fera automatiquement

---

## ❓ Questions fréquentes

**Q : Comment partager l'accès avec Mathilde ?**
L'application est accessible depuis n'importe quel navigateur à l'adresse GitHub Pages. Partagez l'URL et le mot de passe — c'est tout !

**Q : Mes données sont-elles sécurisées ?**
Oui — les données sont stockées dans Supabase (base de données sécurisée), et l'application nécessite une connexion. L'URL GitHub Pages est publique mais sans mot de passe, personne ne peut voir vos données.

**Q : L'application est-elle disponible sur mobile ?**
Oui, le design est responsive. Ajoutez l'URL à l'écran d'accueil de votre téléphone pour un accès rapide.

**Q : Que se passe-t-il si je dépasse la limite gratuite de Supabase ?**
Le plan gratuit Supabase inclut 500 MB de stockage et 50 000 requêtes/mois — largement suffisant pour un usage personnel. Si nécessaire, Supabase propose des plans payants à partir de ~25$/mois.
