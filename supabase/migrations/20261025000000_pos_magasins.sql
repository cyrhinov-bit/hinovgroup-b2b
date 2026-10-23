-- ---------------------------------------------------------------
-- 20261025000000_pos_magasins.sql
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pos_magasins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    adresse TEXT,
    code_postal TEXT,
    ville TEXT,
    telephone TEXT,
    email TEXT,
    actif BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

-- Index for quick look‑ups
CREATE INDEX IF NOT EXISTS idx_pos_magasins_actif ON public.pos_magasins(actif);
CREATE INDEX IF NOT EXISTS idx_pos_magasins_nom ON public.pos_magasins(nom);