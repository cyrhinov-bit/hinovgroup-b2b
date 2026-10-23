-- ---------------------------------------------------------------
-- 20261025000000_pos_magasins.sql
-- ---------------------------------------------------------------
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

ALTER TABLE public.pos_magasins
    ADD COLUMN IF NOT EXISTS code TEXT,
    ADD COLUMN IF NOT EXISTS ticket_message TEXT,
    ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Index for quick look‑ups
CREATE INDEX IF NOT EXISTS idx_pos_magasins_actif ON public.pos_magasins(actif);
CREATE INDEX IF NOT EXISTS idx_pos_magasins_nom ON public.pos_magasins(nom);

INSERT INTO public.pos_magasins (id, code, nom, is_default, actif)
VALUES ('00000000-0000-0000-0000-000000000001', 'MAG-PRINCIPAL', 'Librairie Principale', true, true)
ON CONFLICT (id) DO NOTHING;