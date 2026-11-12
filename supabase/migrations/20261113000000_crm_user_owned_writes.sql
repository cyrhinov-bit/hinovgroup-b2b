-- Keep CRM records readable across users for Direction, but restrict writes
-- to the record owner. UI filtering is not a substitute for server-side RLS.

DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'clients_fournisseurs',
    'prestations_commandes',
    'catalogue_articles'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all access to ' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow all for anon and auth', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'crm_select_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'crm_insert_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'crm_update_' || table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'crm_delete_' || table_name, table_name);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', 'crm_select_' || table_name, table_name);
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

-- Stock movements are append-only in the CRM UI and attributed to their author.
DROP POLICY IF EXISTS "mouvements_stock_insert" ON public.mouvements_stock;
DROP POLICY IF EXISTS "mouvements_stock_update" ON public.mouvements_stock;
DROP POLICY IF EXISTS "mouvements_stock_delete" ON public.mouvements_stock;
CREATE POLICY "mouvements_stock_insert" ON public.mouvements_stock
  FOR INSERT TO authenticated
  WITH CHECK (cree_par::text = (auth.uid())::text);
CREATE POLICY "mouvements_stock_update" ON public.mouvements_stock
  FOR UPDATE TO authenticated
  USING (cree_par::text = (auth.uid())::text)
  WITH CHECK (cree_par::text = (auth.uid())::text);
CREATE POLICY "mouvements_stock_delete" ON public.mouvements_stock
  FOR DELETE TO authenticated
  USING (cree_par::text = (auth.uid())::text);

-- Client invoice ownership: the assigned commercial is the primary owner,
-- falling back to the creator for older rows without a commercial.
DROP POLICY IF EXISTS "Allow all access to invoices" ON public.invoices;
DROP POLICY IF EXISTS "invoices_authenticated_all" ON public.invoices;
CREATE POLICY "invoices_authenticated_select" ON public.invoices
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_authenticated_insert" ON public.invoices
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "invoices_owner_update" ON public.invoices
  FOR UPDATE TO authenticated
  USING (COALESCE(commercial_id, created_by) = auth.uid())
  WITH CHECK (COALESCE(commercial_id, created_by) = auth.uid());
CREATE POLICY "invoices_owner_delete" ON public.invoices
  FOR DELETE TO authenticated
  USING (COALESCE(commercial_id, created_by) = auth.uid());

-- Child rows inherit the parent invoice's owner; payments must also be authored
-- by the active user so one user cannot erase another user's payment entry.
DROP POLICY IF EXISTS "Allow all access to invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "invoice_items_authenticated_all" ON public.invoice_items;
CREATE POLICY "invoice_items_authenticated_select" ON public.invoice_items
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_items_owner_insert" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
  ));
CREATE POLICY "invoice_items_owner_update" ON public.invoice_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
  ));
CREATE POLICY "invoice_items_owner_delete" ON public.invoice_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
  ));

DROP POLICY IF EXISTS "Allow all access to invoice_payments" ON public.invoice_payments;
DROP POLICY IF EXISTS "invoice_payments_authenticated_all" ON public.invoice_payments;
CREATE POLICY "invoice_payments_authenticated_select" ON public.invoice_payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_payments_owner_insert" ON public.invoice_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
    )
  );
CREATE POLICY "invoice_payments_owner_update" ON public.invoice_payments
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
    )
  );
CREATE POLICY "invoice_payments_owner_delete" ON public.invoice_payments
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND COALESCE(i.commercial_id, i.created_by) = auth.uid()
    )
  );

-- Supplier invoice module has independent TEXT creator IDs.
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY['sup_suppliers', 'sup_invoices', 'sup_payments'];
BEGIN
  FOREACH table_name IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_all', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', table_name || '_select', table_name);
  END LOOP;
END $$;

CREATE POLICY "sup_suppliers_insert" ON public.sup_suppliers
  FOR INSERT TO authenticated WITH CHECK (created_by::text = auth.uid()::text);
CREATE POLICY "sup_suppliers_update" ON public.sup_suppliers
  FOR UPDATE TO authenticated
  USING (created_by::text = auth.uid()::text)
  WITH CHECK (created_by::text = auth.uid()::text);
CREATE POLICY "sup_suppliers_delete" ON public.sup_suppliers
  FOR DELETE TO authenticated USING (created_by::text = auth.uid()::text);

CREATE POLICY "sup_invoices_insert" ON public.sup_invoices
  FOR INSERT TO authenticated WITH CHECK (created_by::text = auth.uid()::text);
CREATE POLICY "sup_invoices_update" ON public.sup_invoices
  FOR UPDATE TO authenticated
  USING (created_by::text = auth.uid()::text)
  WITH CHECK (created_by::text = auth.uid()::text);
CREATE POLICY "sup_invoices_delete" ON public.sup_invoices
  FOR DELETE TO authenticated USING (created_by::text = auth.uid()::text);

CREATE POLICY "sup_payments_insert" ON public.sup_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.sup_invoices i
      WHERE i.id = invoice_id AND i.created_by::text = auth.uid()::text
    )
  );
CREATE POLICY "sup_payments_update" ON public.sup_payments
  FOR UPDATE TO authenticated
  USING (
    created_by::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.sup_invoices i
      WHERE i.id = invoice_id AND i.created_by::text = auth.uid()::text
    )
  )
  WITH CHECK (
    created_by::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.sup_invoices i
      WHERE i.id = invoice_id AND i.created_by::text = auth.uid()::text
    )
  );
CREATE POLICY "sup_payments_delete" ON public.sup_payments
  FOR DELETE TO authenticated
  USING (
    created_by::text = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.sup_invoices i
      WHERE i.id = invoice_id AND i.created_by::text = auth.uid()::text
    )
  );

-- Delivery notes also use commercial/creator ownership. Reads remain shared.
DROP POLICY IF EXISTS "delivery_notes_insert_owner" ON public.delivery_notes;
DROP POLICY IF EXISTS "delivery_notes_update_owner" ON public.delivery_notes;
DROP POLICY IF EXISTS "delivery_notes_delete_owner" ON public.delivery_notes;
CREATE POLICY "delivery_notes_insert_owner" ON public.delivery_notes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "delivery_notes_update_owner" ON public.delivery_notes
  FOR UPDATE TO authenticated
  USING (COALESCE(commercial_id, created_by) = auth.uid())
  WITH CHECK (COALESCE(commercial_id, created_by) = auth.uid());
CREATE POLICY "delivery_notes_delete_owner" ON public.delivery_notes
  FOR DELETE TO authenticated
  USING (COALESCE(commercial_id, created_by) = auth.uid());
