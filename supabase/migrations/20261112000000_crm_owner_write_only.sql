-- Restrict writes to CRM maintenance and expenses to the record creator.
-- Direction users retain read access through the existing SELECT policies.

DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'mouvements_caisse',
    'interventions_maintenance',
    'techniciens_maintenance'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all access to ' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all for anon and auth', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'crm_insert_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'crm_update_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'crm_delete_' || table_name, table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (cree_par::text = (auth.uid())::text)',
      'crm_insert_' || table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (cree_par::text = (auth.uid())::text) WITH CHECK (cree_par::text = (auth.uid())::text)',
      'crm_update_' || table_name,
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (cree_par::text = (auth.uid())::text)',
      'crm_delete_' || table_name,
      table_name
    );
  END LOOP;
END $$;
