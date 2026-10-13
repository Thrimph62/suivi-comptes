-- ============================================================
-- SUIVI COMPTES - Schéma Supabase (tables préfixées suivi_comptes_)
-- Coller dans : Supabase > SQL Editor > New Query > Run
-- IDEMPOTENT : peut être relancé sur une base existante sans toucher aux données.
-- ============================================================

CREATE TABLE IF NOT EXISTS suivi_comptes_comptes (
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

CREATE TABLE IF NOT EXISTS suivi_comptes_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent TEXT NOT NULL,
  sous_categorie TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(parent, sous_categorie)
);

CREATE TABLE IF NOT EXISTS suivi_comptes_tiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom TEXT NOT NULL UNIQUE,
  categorie_id UUID REFERENCES suivi_comptes_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suivi_comptes_recurrences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compte_id UUID NOT NULL REFERENCES suivi_comptes_comptes(id) ON DELETE CASCADE,
  tiers_id UUID REFERENCES suivi_comptes_tiers(id) ON DELETE SET NULL,
  tiers_nom TEXT,
  categorie_id UUID REFERENCES suivi_comptes_categories(id) ON DELETE SET NULL,
  montant DECIMAL(12,2) NOT NULL,
  frequence TEXT NOT NULL
    CHECK (frequence IN ('hebdomadaire','mensuel','annuel','personnalise')),
  intervalle_jours INTEGER,
  date_debut DATE NOT NULL,
  date_fin DATE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suivi_comptes_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  compte_id UUID NOT NULL REFERENCES suivi_comptes_comptes(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  tiers_id UUID REFERENCES suivi_comptes_tiers(id) ON DELETE SET NULL,
  tiers_nom TEXT,
  categorie_id UUID REFERENCES suivi_comptes_categories(id) ON DELETE SET NULL,
  montant DECIMAL(12,2) NOT NULL,
  notes TEXT,
  pointee BOOLEAN DEFAULT FALSE,
  recurrence_id UUID REFERENCES suivi_comptes_recurrences(id) ON DELETE SET NULL,
  transfer_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des mois dont le pointage est terminé (utilisée par la page d'un compte)
CREATE TABLE IF NOT EXISTS suivi_comptes_mois_clotures (
  compte_id UUID NOT NULL REFERENCES suivi_comptes_comptes(id) ON DELETE CASCADE,
  mois TEXT NOT NULL,
  PRIMARY KEY (compte_id, mois)
);

-- ============================================================
-- INDEX (accélèrent soldes, pages de compte, récurrences)
-- ============================================================
CREATE INDEX IF NOT EXISTS suivi_comptes_txn_compte_date ON suivi_comptes_transactions (compte_id, date);
CREATE INDEX IF NOT EXISTS suivi_comptes_txn_recurrence  ON suivi_comptes_transactions (recurrence_id);
CREATE INDEX IF NOT EXISTS suivi_comptes_txn_transfer    ON suivi_comptes_transactions (transfer_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- (Authentication > Providers > Email : désactiver "Allow new users to sign up")
-- ============================================================
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['comptes','categories','tiers','recurrences','transactions','mois_clotures'] LOOP
    EXECUTE format('ALTER TABLE suivi_comptes_%s ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "Acces authentifie" ON suivi_comptes_%s', t);
    EXECUTE format('CREATE POLICY "Acces authentifie" ON suivi_comptes_%s FOR ALL USING (auth.role() = ''authenticated'')', t);
  END LOOP;
END $$;

-- ============================================================
-- VUES (calcul des soldes côté base : pas de limite de 1000 lignes)
-- security_invoker = la RLS s'applique à l'utilisateur connecté
-- ============================================================
CREATE OR REPLACE VIEW suivi_comptes_soldes WITH (security_invoker = true) AS
WITH p AS (SELECT (now() AT TIME ZONE 'Europe/Brussels')::date AS d)
SELECT c.id AS compte_id,
  c.solde_initial + COALESCE(SUM(t.montant) FILTER (WHERE t.date <  p.d), 0)                          AS avant,
  c.solde_initial + COALESCE(SUM(t.montant) FILTER (WHERE t.date <= p.d), 0)                          AS aujourdhui,
  c.solde_initial + COALESCE(SUM(t.montant) FILTER (WHERE t.pointee), 0)                              AS pointe,
  c.solde_initial + COALESCE(SUM(t.montant) FILTER (WHERE t.date <= p.d + INTERVAL '1 month'), 0)     AS m1,
  c.solde_initial + COALESCE(SUM(t.montant) FILTER (WHERE t.date <= p.d + INTERVAL '3 months'), 0)    AS m3,
  c.solde_initial + COALESCE(SUM(t.montant) FILTER (WHERE t.date <= p.d + INTERVAL '1 year'), 0)      AS m12
FROM suivi_comptes_comptes c
CROSS JOIN p
LEFT JOIN suivi_comptes_transactions t ON t.compte_id = c.id
GROUP BY c.id, c.solde_initial;

CREATE OR REPLACE VIEW suivi_comptes_occurrences_futures WITH (security_invoker = true) AS
SELECT recurrence_id, COUNT(*)::int AS n
FROM suivi_comptes_transactions
WHERE recurrence_id IS NOT NULL AND date > (now() AT TIME ZONE 'Europe/Brussels')::date
GROUP BY recurrence_id;
