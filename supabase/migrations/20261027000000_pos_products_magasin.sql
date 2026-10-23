-- 20261027000000_pos_products_magasin.sql
-- Création de la table des produits par magasin

DROP TABLE IF EXISTS public.pos_products_magasin CASCADE;

CREATE TABLE IF NOT EXISTS public.pos_products_magasin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    magazine_id UUID NOT NULL
        REFERENCES public.pos_magasins(id) ON DELETE CASCADE,
    product_global_id UUID REFERENCES public.pos_products(id) ON DELETE SET NULL,
    product_magasin_id UUID
        REFERENCES public.pos_products_magasin(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    name        TEXT NOT NULL,
    family      TEXT NOT NULL
        CHECK (family IN ('Livre','Fourniture')),
    purchase_price NUMERIC NOT NULL DEFAULT 0,
    selling_price  NUMERIC NOT NULL DEFAULT 0,
    quantite_stock NUMERIC NOT NULL DEFAULT 0,
    seuil_alerte   NUMERIC NOT NULL DEFAULT 5,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    CONSTRAINT chk_product_link CHECK (
        (product_global_id IS NOT NULL AND product_magasin_id IS NULL) OR
        (product_global_id IS NULL AND product_magasin_id IS NOT NULL)
    )
);

CREATE INDEX idx_pos_products_magasin_magaza ON public.pos_products_magasin(magasin_id);
CREATE INDEX idx_pos_products_magasin_ref ON public.pos_products_magasin(reference);