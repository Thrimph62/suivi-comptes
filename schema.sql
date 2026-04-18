-- ============================================================
-- SUIVI COMPTES - Schéma Supabase
-- Coller dans : Supabase > SQL Editor > New Query > Run
-- ============================================================

-- 1. TABLE COMPTES
CREATE TABLE IF NOT EXISTS comptes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'courant'
    CHECK (type IN ('courant','epargne','cheques_repas','titres_services','autre')),
  banque TEXT,
  pays TEXT CHECK (pays IN ('BE','FR','Autre')),
  solde_initial DECIMAL(12,2) DEFAULT 0,
  ordre INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLE CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent TEXT NOT NULL,
  sous_categorie TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent, sous_categorie)
);

-- 3. TABLE TIERS
CREATE TABLE IF NOT EXISTS tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  categorie_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLE RECURRENCES (avant transactions car FK)
CREATE TABLE IF NOT EXISTS recurrences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compte_id UUID NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  tiers_id UUID REFERENCES tiers(id) ON DELETE SET NULL,
  tiers_nom TEXT,
  categorie_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  montant DECIMAL(12,2) NOT NULL,
  frequence TEXT NOT NULL
    CHECK (frequence IN ('hebdomadaire','mensuel','annuel','personnalise')),
  intervalle_jours INTEGER,
  date_debut DATE NOT NULL,
  date_fin DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLE TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compte_id UUID NOT NULL REFERENCES comptes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tiers_id UUID REFERENCES tiers(id) ON DELETE SET NULL,
  tiers_nom TEXT,
  categorie_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  montant DECIMAL(12,2) NOT NULL,
  notes TEXT,
  pointee BOOLEAN DEFAULT FALSE,
  recurrence_id UUID REFERENCES recurrences(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (accès uniquement aux utilisateurs connectés)
-- ============================================================

ALTER TABLE comptes ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acces authentifie" ON comptes FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acces authentifie" ON categories FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acces authentifie" ON tiers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acces authentifie" ON recurrences FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Acces authentifie" ON transactions FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- DONNÉES INITIALES - 13 COMPTES
-- ============================================================

INSERT INTO comptes (nom, type, banque, pays, solde_initial, ordre) VALUES
  ('Compte Courant Timothé', 'courant', 'Argenta', 'BE', 0, 1),
  ('Compte Commun BE', 'courant', 'Argenta', 'BE', 0, 2),
  ('Compte Commun FR', 'courant', 'Caisse d''Epargne', 'FR', 0, 3),
  ('Livret A Timothé', 'epargne', 'Caisse d''Epargne', 'FR', 0, 4),
  ('Livret A Justine', 'epargne', 'Caisse d''Epargne', 'FR', 0, 5),
  ('Livret A Charlotte', 'epargne', 'Caisse d''Epargne', 'FR', 0, 6),
  ('Epargne Pension Timothé', 'epargne', 'Argenta', 'BE', 0, 7),
  ('Chèques Repas Timothé', 'cheques_repas', NULL, 'BE', 0, 8),
  ('Chèques Repas Mathilde', 'cheques_repas', NULL, 'BE', 0, 9),
  ('Titres Services', 'titres_services', NULL, 'BE', 0, 10);

-- ============================================================
-- DONNÉES INITIALES - CATÉGORIES (vide, à remplir par l'utilisateur)
-- L'utilisateur les crée via Paramètres > Catégories
-- ============================================================

-- Exemples commentés (décommenter si souhaité) :
-- INSERT INTO categories (parent, sous_categorie) VALUES
--   ('Alimentation', 'Supermarché'),
--   ('Alimentation', 'Boulangerie'),
--   ('Alimentation', 'Restaurant'),
--   ('Loisirs', 'Sport'),
--   ('Maison', 'Loyer'),
--   ('Salaire', NULL),
--   ('Virement Interne', NULL);
