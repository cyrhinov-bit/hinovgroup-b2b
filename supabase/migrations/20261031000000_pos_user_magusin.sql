-- 20261031000000_pos_user_magusin.sql
-- Affectation utilisateur -> magasin

CREATE TABLE IF NOT EXISTS public.pos_user_magasins (
    profile_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    magasin_id UUID NOT NULL
        REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    role_on_store TEXT NOT NULL
        CHECK (role_on_store IN ('Caissier', 'Gérant', 'Encaisseur')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_profile_magasins UNIQUE (profile_id, magasin_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_user_magasins_profile ON public.pos_user_magasins(profile_id);
CREATE INDEX IF NOT EXISTS idx_pos_user_magasins_magasin ON public.pos_user_magasins(magasin_id);