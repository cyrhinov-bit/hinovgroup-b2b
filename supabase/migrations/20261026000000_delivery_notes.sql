-- Module Bon de Livraison (CRM) : persistance, numérotation et RLS.
-- Le BL est séparé du POS : aucune table ni policy POS n'est touchée ici.
-- Date: 2026-10-26

CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id UUID PRIMARY KEY,
  delivery_number TEXT NOT NULL UNIQUE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  quote_number TEXT NOT NULL DEFAULT '',
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name TEXT,
  commercial_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  date DATE,
  lines JSONB NOT NULL DEFAULT '[]'::JSONB,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Émis',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_notes_quote_idx ON public.delivery_notes(quote_id);
CREATE INDEX IF NOT EXISTS delivery_notes_client_idx ON public.delivery_notes(client_id);
CREATE INDEX IF NOT EXISTS delivery_notes_commercial_idx ON public.delivery_notes(commercial_id);
CREATE INDEX IF NOT EXISTS delivery_notes_created_at_idx ON public.delivery_notes(created_at DESC);

-- Numérotation serveur séquentielle BL-YYYY-XXXX (anti-doublon multi-postes).
CREATE OR REPLACE FUNCTION public.next_delivery_number(p_year INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix TEXT := 'BL-' || p_year || '-';
  v_max INT := 0;
BEGIN
  SELECT COALESCE(MAX((regexp_match(delivery_number, '^BL-\d{4}-(\d+)$'))[1]::INT), 0)
    INTO v_max
  FROM public.delivery_notes
  WHERE delivery_number LIKE v_prefix || '%';
  RETURN v_prefix || lpad((v_max + 1)::TEXT, 4, '0');
END;
$$;

ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;

-- Lecture : direction = tout ; sinon propriétaire (commercial ou créateur).
DROP POLICY IF EXISTS "delivery_notes_select_owner" ON public.delivery_notes;
CREATE POLICY "delivery_notes_select_owner" ON public.delivery_notes
  FOR SELECT TO authenticated
  USING (
    public.is_director()
    OR commercial_id IS NULL
    OR commercial_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "delivery_notes_insert_owner" ON public.delivery_notes;
CREATE POLICY "delivery_notes_insert_owner" ON public.delivery_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_director()
    OR commercial_id IS NULL
    OR commercial_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "delivery_notes_update_owner" ON public.delivery_notes;
CREATE POLICY "delivery_notes_update_owner" ON public.delivery_notes
  FOR UPDATE TO authenticated
  USING (
    public.is_director()
    OR commercial_id = auth.uid()
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.is_director()
    OR commercial_id IS NULL
    OR commercial_id = auth.uid()
    OR created_by = auth.uid()
  );

DROP POLICY IF EXISTS "delivery_notes_delete_owner" ON public.delivery_notes;
CREATE POLICY "delivery_notes_delete_owner" ON public.delivery_notes
  FOR DELETE TO authenticated
  USING (
    public.is_director()
    OR commercial_id = auth.uid()
    OR created_by = auth.uid()
  );

-- Le numéro doit rester unique même en cas de numérotation locale concurrente.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_notes TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_delivery_number(INT) TO authenticated;
