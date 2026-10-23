-- 20261029000000_pos_stock_magasin.sql
-- Stock par magasin

CREATE TABLE IF NOT EXISTS public.pos_stock_magasin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    magasin_id UUID NOT NULL
        REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL
        REFERENCES public.pos_products(id) ON DELETE RESTRICT,
    quantite_stock NUMERIC NOT NULL DEFAULT 0,
    quantite_reserve NUMERIC NOT NULL DEFAULT 0,
    seuil_alerte     NUMERIC NOT NULL DEFAULT 5,
    date_dernier_inventaire TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW())
);

ALTER TABLE public.pos_stock_magasin
    ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.pos_products(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS quantite_stock NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS quantite_reserve NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS seuil_alerte NUMERIC NOT NULL DEFAULT 5,
    ADD COLUMN IF NOT EXISTS date_dernier_inventaire TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW());

CREATE INDEX IF NOT EXISTS idx_pos_stock_magasin_magasin ON public.pos_stock_magasin(magasin_id);
CREATE INDEX IF NOT EXISTS idx_pos_stock_magasin_product ON public.pos_stock_magasin(product_id);