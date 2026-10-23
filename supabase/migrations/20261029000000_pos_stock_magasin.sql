-- 20261029000000_pos_stock_magasin.sql
-- Stock par magasin

DROP TABLE IF EXISTS public.pos_stock_magasin CASCADE;

CREATE TABLE IF NOT EXISTS public.pos_stock_magasin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    magazine_id UUID NOT NULL
        REFERENCES public.pos_magasins(id) ON DELETE CASCADE,
    product_global_id UUID REFERENCES public.pos_products(id) ON DELETE SET NULL,
    product_magasin_id UUID
        REFERENCES public.pos_products_magasin(id) ON DELETE CASCADE,
    quantite_stock NUMERIC NOT NULL DEFAULT 0,
    quantite_reserve NUMERIC NOT NULL DEFAULT 0,
    seuil_alerte     NUMERIC NOT NULL DEFAULT 5,
    date_dernier_inventaire TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    CONSTRAINT chk_stock_product CHECK (
        (product_global_id IS NOT NULL AND product_magasin_id IS NULL) OR
        (product_global_id IS NULL AND product_magasin_id IS NOT NULL)
    )
);

CREATE INDEX idx_pos_stock_magasin_magaza ON public.pos_stock_magasin(magazine_id);
CREATE INDEX idx_pos_stock_magasin_product ON public.pos_stock_magasin (COALESCE(product_global_id, product_magasin_id));