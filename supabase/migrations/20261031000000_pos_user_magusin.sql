-- 20261031000000_pos_user_magusin.sql
-- Affectation utilisateur -> magasin

DROP TABLE IF EXISTS public.pos_user_magusin CASCADE;

CREATE TABLE IF NOT EXISTS public.pos_user_magusin (
    profile_id UUID NOT NULL
        REFERENCES public.profiles(id) ON DELETE CASCADE,
    magazine_id UUID NOT NULL
        REFERENCES public.pos_magasins(id) ON DELETE CASCADE,
    role_on_store TEXT NOT NULL
        CHECK (role_on_store IN ('Caissier','Gérant','Encaisseur')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_profile_magazine UNIQUE (profile_id, magazine_id)
);

CREATE INDEX idx_pos_user_magusin_profile ON public.pos_user_magusin(profile_id);
CREATE INDEX idx_pos_user_magusin_magaza ON public.pos_user_magusin(magazine_id);