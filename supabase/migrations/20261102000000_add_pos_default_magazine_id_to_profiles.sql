-- ---------------------------------------------------------------
-- 20261102000000_add_pos_default_magazine_id_to_profiles.sql
-- ---------------------------------------------------------------
-- Facultatif : garde une "valeur par défaut" pour les vieux codes qui
-- n'utilisent pas encore la table d'affectation many‑to‑many.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pos_default_magazine_id UUID
    REFERENCES public.pos_magasins(id) ON DELETE SET NULL;