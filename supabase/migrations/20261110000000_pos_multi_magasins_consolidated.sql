-- ============================================================================
-- MIGRATION CONSOLIDÉE : MODULE MULTI-MAGASINS (LIBRAIRIES) POUR LE POS
-- ----------------------------------------------------------------------------
-- Périmètre : Strictement limité au Point de Vente (POS / Caisse / Stocks).
-- Aucune modification sur le CRM (devis, factures, commissions, etc.).
-- ============================================================================

-- 1. Nettoyage préventif des ébauches antérieures erronées (faute de frappe 'magusin')
DROP TABLE IF EXISTS public.pos_user_magusin CASCADE;

-- 2. Table des Librairies / Magasins / Boutiques
CREATE TABLE IF NOT EXISTS public.pos_magasins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE,
    nom TEXT NOT NULL,
    adresse TEXT,
    code_postal TEXT,
    ville TEXT,
    telephone TEXT,
    email TEXT,
    ticket_message TEXT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    actif BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_pos_magasins_actif ON public.pos_magasins(actif);
CREATE INDEX IF NOT EXISTS idx_pos_magasins_nom ON public.pos_magasins(nom);

-- Insertion de la Librairie Principale initiale si aucune n'existe
INSERT INTO public.pos_magasins (id, code, nom, is_default, actif)
VALUES ('00000000-0000-0000-0000-000000000001', 'MAG-PRINCIPAL', 'Librairie Principale', true, true)
ON CONFLICT (id) DO NOTHING;

-- 3. Table d'affectation Utilisateurs <-> Magasins
CREATE TABLE IF NOT EXISTS public.pos_user_magasins (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    magasin_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE CASCADE,
    role_on_store TEXT NOT NULL DEFAULT 'Caissier' CHECK (role_on_store IN ('Caissier', 'Gérant', 'Encaisseur')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    PRIMARY KEY (profile_id, magasin_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_user_magasins_profile ON public.pos_user_magasins(profile_id);
CREATE INDEX IF NOT EXISTS idx_pos_user_magasins_magasin ON public.pos_user_magasins(magasin_id);

-- 4. Table des Stocks par Magasin
CREATE TABLE IF NOT EXISTS public.pos_stock_magasin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    magasin_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.pos_products(id) ON DELETE CASCADE,
    quantite_stock NUMERIC NOT NULL DEFAULT 0,
    quantite_reserve NUMERIC NOT NULL DEFAULT 0,
    seuil_alerte NUMERIC NOT NULL DEFAULT 5,
    date_dernier_inventaire TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    CONSTRAINT uq_pos_stock_magasin UNIQUE (magasin_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_stock_magasin_magasin ON public.pos_stock_magasin(magasin_id);
CREATE INDEX IF NOT EXISTS idx_pos_stock_magasin_product ON public.pos_stock_magasin(product_id);

-- 5. Table des Transferts de Stock Inter-Librairies
CREATE TABLE IF NOT EXISTS public.pos_stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT NOT NULL UNIQUE,
    magasin_source_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    magasin_dest_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'Brouillon' CHECK (status IN ('Brouillon', 'Expédié', 'Réceptionné', 'Annulé')),
    shipped_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    received_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    shipped_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    notes TEXT,
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_pos_transfers_source ON public.pos_stock_transfers(magasin_source_id);
CREATE INDEX IF NOT EXISTS idx_pos_transfers_dest ON public.pos_stock_transfers(magasin_dest_id);
CREATE INDEX IF NOT EXISTS idx_pos_transfers_status ON public.pos_stock_transfers(status);

-- 6. Extension des tables transactionnelles du POS avec la clé magasin
ALTER TABLE public.pos_transactions
ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;

ALTER TABLE public.pos_cash_sessions
ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;

ALTER TABLE public.pos_returns
ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;

ALTER TABLE public.pos_stock_movements
ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pos_default_magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;

-- 7. Rétro-affectation sécurisée : lier les anciennes ventes / sessions à la Librairie Principale si null
UPDATE public.pos_transactions
SET magasin_id = '00000000-0000-0000-0000-000000000001'
WHERE magasin_id IS NULL;

UPDATE public.pos_cash_sessions
SET magasin_id = '00000000-0000-0000-0000-000000000001'
WHERE magasin_id IS NULL;

UPDATE public.pos_returns
SET magasin_id = '00000000-0000-0000-0000-000000000001'
WHERE magasin_id IS NULL;

-- 8. Sécurité RLS (Row Level Security)
ALTER TABLE public.pos_magasins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_user_magasins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_stock_magasin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_stock_transfers ENABLE ROW LEVEL SECURITY;

-- Politiques de lecture partagée pour tous les utilisateurs authentifiés
DROP POLICY IF EXISTS "pos_magasins_read_all" ON public.pos_magasins;
CREATE POLICY "pos_magasins_read_all" ON public.pos_magasins
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pos_user_magasins_read_all" ON public.pos_user_magasins;
CREATE POLICY "pos_user_magasins_read_all" ON public.pos_user_magasins
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pos_stock_magasin_read_all" ON public.pos_stock_magasin;
CREATE POLICY "pos_stock_magasin_read_all" ON public.pos_stock_magasin
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "pos_stock_transfers_read_all" ON public.pos_stock_transfers;
CREATE POLICY "pos_stock_transfers_read_all" ON public.pos_stock_transfers
    FOR SELECT TO authenticated USING (true);

-- Politiques de gestion (création/modification)
DROP POLICY IF EXISTS "pos_magasins_manage" ON public.pos_magasins;
CREATE POLICY "pos_magasins_manage" ON public.pos_magasins
    FOR ALL TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
        )
    );

DROP POLICY IF EXISTS "pos_stock_magasin_write" ON public.pos_stock_magasin;
CREATE POLICY "pos_stock_magasin_write" ON public.pos_stock_magasin
    FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "pos_stock_transfers_write" ON public.pos_stock_transfers;
CREATE POLICY "pos_stock_transfers_write" ON public.pos_stock_transfers
    FOR ALL TO authenticated USING (true);
