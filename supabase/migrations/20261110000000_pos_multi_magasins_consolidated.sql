-- ============================================================================
-- Module POS multi-magasins.
-- Additive and data-preserving: no existing table or policy is dropped.
-- The RLS policies below are a restrictive proposal and must be validated
-- against the intended role assignments before this migration is applied.
-- ============================================================================

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

CREATE INDEX IF NOT EXISTS idx_pos_magasins_actif ON public.pos_magasins(actif);
CREATE INDEX IF NOT EXISTS idx_pos_magasins_nom ON public.pos_magasins(nom);

INSERT INTO public.pos_magasins (id, code, nom, is_default, actif)
VALUES ('00000000-0000-0000-0000-000000000001', 'MAG-PRINCIPAL', 'Librairie Principale', true, true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.pos_user_magasins (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    magasin_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    role_on_store TEXT NOT NULL DEFAULT 'Caissier'
        CHECK (role_on_store IN ('Caissier', 'Gérant', 'Encaisseur')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_profile_magasins UNIQUE (profile_id, magasin_id)
);

CREATE INDEX IF NOT EXISTS idx_pos_user_magasins_profile ON public.pos_user_magasins(profile_id);
CREATE INDEX IF NOT EXISTS idx_pos_user_magasins_magasin ON public.pos_user_magasins(magasin_id);

CREATE TABLE IF NOT EXISTS public.pos_stock_magasin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    magasin_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.pos_products(id) ON DELETE RESTRICT,
    quantite_stock NUMERIC NOT NULL DEFAULT 0,
    quantite_reserve NUMERIC NOT NULL DEFAULT 0,
    seuil_alerte NUMERIC NOT NULL DEFAULT 5,
    date_dernier_inventaire TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', NOW()),
    CONSTRAINT uq_pos_stock_magasin UNIQUE (magasin_id, product_id)
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

DO $migration$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pos_stock_magasin'
          AND column_name = 'magazine_id'
    ) THEN
        EXECUTE $sql$
            UPDATE public.pos_stock_magasin
            SET magasin_id = magazine_id
            WHERE magasin_id IS NULL AND magazine_id IS NOT NULL
        $sql$;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pos_stock_magasin'
          AND column_name = 'product_global_id'
    ) THEN
        EXECUTE $sql$
            UPDATE public.pos_stock_magasin
            SET product_id = product_global_id
            WHERE product_id IS NULL AND product_global_id IS NOT NULL
        $sql$;
    END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_pos_stock_magasin_magasin ON public.pos_stock_magasin(magasin_id);
CREATE INDEX IF NOT EXISTS idx_pos_stock_magasin_product ON public.pos_stock_magasin(product_id);

CREATE TABLE IF NOT EXISTS public.pos_stock_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number TEXT NOT NULL UNIQUE,
    magasin_source_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    magasin_dest_id UUID NOT NULL REFERENCES public.pos_magasins(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'Brouillon'
        CHECK (status IN ('Brouillon', 'Expédié', 'Réceptionné', 'Annulé')),
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

ALTER TABLE public.pos_transactions
    ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;
ALTER TABLE public.pos_cash_sessions
    ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;
ALTER TABLE public.pos_returns
    ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;
ALTER TABLE public.pos_stock_movements
    ADD COLUMN IF NOT EXISTS magasin_id UUID REFERENCES public.pos_magasins(id) ON DELETE SET NULL;

ALTER TABLE public.pos_magasins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_user_magasins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_stock_magasin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_stock_transfers ENABLE ROW LEVEL SECURITY;

DO $policies$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_magasins' AND policyname = 'pos_magasins_pos_read') THEN
        EXECUTE $sql$
            CREATE POLICY pos_magasins_pos_read ON public.pos_magasins
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND (p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant', 'Caissier')
                           OR p.pos_role IN ('Directeur', 'Gerant', 'Caissier'))
                )
                AND (
                    id = '00000000-0000-0000-0000-000000000001'
                    OR EXISTS (
                        SELECT 1 FROM public.pos_user_magasins a
                        WHERE a.profile_id = auth.uid() AND a.magasin_id = pos_magasins.id
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.profiles p
                        WHERE p.id = auth.uid()
                          AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                    )
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_magasins' AND policyname = 'pos_magasins_managers_write') THEN
        EXECUTE $sql$
            CREATE POLICY pos_magasins_managers_write ON public.pos_magasins
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_magasins' AND policyname = 'pos_magasins_managers_update') THEN
        EXECUTE $sql$
            CREATE POLICY pos_magasins_managers_update ON public.pos_magasins
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_user_magasins' AND policyname = 'pos_user_magasins_self_or_managers_read') THEN
        EXECUTE $sql$
            CREATE POLICY pos_user_magasins_self_or_managers_read ON public.pos_user_magasins
            FOR SELECT TO authenticated
            USING (
                profile_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_user_magasins' AND policyname = 'pos_user_magasins_managers_write') THEN
        EXECUTE $sql$
            CREATE POLICY pos_user_magasins_managers_write ON public.pos_user_magasins
            FOR ALL TO authenticated
            USING (public.is_direction())
            WITH CHECK (public.is_direction())
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_stock_magasin' AND policyname = 'pos_stock_magasin_assigned_pos_read') THEN
        EXECUTE $sql$
            CREATE POLICY pos_stock_magasin_assigned_pos_read ON public.pos_stock_magasin
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND (
                          p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                          OR p.role IN ('Caissier')
                          OR p.pos_role IN ('Directeur', 'Gerant', 'Caissier')
                      )
                )
                AND (
                    magasin_id = '00000000-0000-0000-0000-000000000001'
                    OR EXISTS (
                        SELECT 1 FROM public.pos_user_magasins a
                        WHERE a.profile_id = auth.uid() AND a.magasin_id = pos_stock_magasin.magasin_id
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.profiles p
                        WHERE p.id = auth.uid()
                          AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                    )
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_stock_magasin' AND policyname = 'pos_stock_magasin_assigned_pos_write') THEN
        EXECUTE $sql$
            CREATE POLICY pos_stock_magasin_assigned_pos_write ON public.pos_stock_magasin
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND (
                          p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant', 'Caissier')
                          OR p.pos_role IN ('Directeur', 'Gerant', 'Caissier')
                      )
                )
                AND (
                    magasin_id = '00000000-0000-0000-0000-000000000001'
                    OR EXISTS (
                        SELECT 1 FROM public.pos_user_magasins a
                        WHERE a.profile_id = auth.uid() AND a.magasin_id = pos_stock_magasin.magasin_id
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.profiles p
                        WHERE p.id = auth.uid()
                          AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                    )
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_stock_magasin' AND policyname = 'pos_stock_magasin_assigned_pos_update') THEN
        EXECUTE $sql$
            CREATE POLICY pos_stock_magasin_assigned_pos_update ON public.pos_stock_magasin
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND (
                          p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant', 'Caissier')
                          OR p.pos_role IN ('Directeur', 'Gerant', 'Caissier')
                      )
                )
                AND (
                    magasin_id = '00000000-0000-0000-0000-000000000001'
                    OR EXISTS (
                        SELECT 1 FROM public.pos_user_magasins a
                        WHERE a.profile_id = auth.uid() AND a.magasin_id = pos_stock_magasin.magasin_id
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.profiles p
                        WHERE p.id = auth.uid()
                          AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                    )
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND (
                          p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant', 'Caissier')
                          OR p.pos_role IN ('Directeur', 'Gerant', 'Caissier')
                      )
                )
                AND (
                    magasin_id = '00000000-0000-0000-0000-000000000001'
                    OR EXISTS (
                        SELECT 1 FROM public.pos_user_magasins a
                        WHERE a.profile_id = auth.uid() AND a.magasin_id = pos_stock_magasin.magasin_id
                    )
                    OR EXISTS (
                        SELECT 1 FROM public.profiles p
                        WHERE p.id = auth.uid()
                          AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                    )
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_stock_transfers' AND policyname = 'pos_stock_transfers_assigned_read') THEN
        EXECUTE $sql$
            CREATE POLICY pos_stock_transfers_assigned_read ON public.pos_stock_transfers
            FOR SELECT TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
                OR EXISTS (
                    SELECT 1 FROM public.pos_user_magasins a
                    WHERE a.profile_id = auth.uid()
                      AND a.magasin_id IN (magasin_source_id, magasin_dest_id)
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_stock_transfers' AND policyname = 'pos_stock_transfers_managers_write') THEN
        EXECUTE $sql$
            CREATE POLICY pos_stock_transfers_managers_write ON public.pos_stock_transfers
            FOR INSERT TO authenticated
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
            )
        $sql$;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'pos_stock_transfers' AND policyname = 'pos_stock_transfers_managers_update') THEN
        EXECUTE $sql$
            CREATE POLICY pos_stock_transfers_managers_update ON public.pos_stock_transfers
            FOR UPDATE TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles p
                    WHERE p.id = auth.uid()
                      AND p.role IN ('SuperAdmin', 'Directeur', 'Directeur adjoint', 'Gerant')
                )
            )
        $sql$;
    END IF;
END
$policies$;
