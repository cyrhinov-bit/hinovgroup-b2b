-- Migration: lecture partagée des tiers (clients/fournisseurs/partenaires) pour la
-- sélection dans les modules (Maintenance, Prestations, Caisse, Stocks, ...).
-- Contexte : 20261012000008_owner_read_scope.sql a rescopé la lecture de
-- clients_fournisseurs à son propriétaire (cree_par), ce qui empêchait un
-- utilisateur de sélectionner un tiers créé par un autre (ex. client créé par
-- la Direction non visible dans le formulaire "Nouveau ticket" Maintenance).
-- La gestion (création / modification / suppression) reste scopée propriétaire
-- (policies crm_update_*/crm_delete_* inchangées). Seule la LECTURE devient
-- partagée, comme pour la table historique `clients` (20261022000000).
DROP POLICY IF EXISTS "crm_select_clients_fournisseurs" ON public.clients_fournisseurs;
CREATE POLICY "crm_select_clients_fournisseurs" ON public.clients_fournisseurs
    FOR SELECT TO authenticated
    USING (true);