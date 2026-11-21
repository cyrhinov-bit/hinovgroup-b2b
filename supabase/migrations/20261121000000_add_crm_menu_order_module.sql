-- Migration : ajout du module d'organisation du menu latéral CRM
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS crm_menu_order_enabled BOOLEAN DEFAULT false;

-- Par défaut activé pour la Direction
UPDATE public.profiles 
SET crm_menu_order_enabled = true 
WHERE role IN ('Directeur', 'Directeur adjoint', 'SuperAdmin');

-- Par défaut false si null pour les autres
UPDATE public.profiles 
SET crm_menu_order_enabled = false 
WHERE crm_menu_order_enabled IS NULL;

-- Mise à jour du trigger RLS de protection des champs sensibles de profiles
CREATE OR REPLACE FUNCTION public.check_profile_admin_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  -- Récupérer le rôle réel de l'appelant connecté
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- Si l'appelant est Direction / SuperAdmin, autoriser toute modification
  IF v_caller_role IN ('Directeur', 'Directeur adjoint', 'SuperAdmin') THEN
    RETURN NEW;
  END IF;

  -- Si un utilisateur non-admin tente de modifier un champ restreint
  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.active IS DISTINCT FROM OLD.active
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.service_id IS DISTINCT FROM OLD.service_id
    OR NEW.pos_role IS DISTINCT FROM OLD.pos_role
    OR NEW.pos_returns_enabled IS DISTINCT FROM OLD.pos_returns_enabled
    OR NEW.pos_catalogue_enabled IS DISTINCT FROM OLD.pos_catalogue_enabled
    OR NEW.pos_supply_enabled IS DISTINCT FROM OLD.pos_supply_enabled
    OR NEW.pos_inventory_enabled IS DISTINCT FROM OLD.pos_inventory_enabled
    OR NEW.pos_stock_enabled IS DISTINCT FROM OLD.pos_stock_enabled
    OR NEW.crm_prestations_enabled IS DISTINCT FROM OLD.crm_prestations_enabled
    OR NEW.crm_caisse_enabled IS DISTINCT FROM OLD.crm_caisse_enabled
    OR NEW.crm_maintenance_enabled IS DISTINCT FROM OLD.crm_maintenance_enabled
    OR NEW.crm_stocks_enabled IS DISTINCT FROM OLD.crm_stocks_enabled
    OR NEW.crm_tiers_enabled IS DISTINCT FROM OLD.crm_tiers_enabled
    OR NEW.crm_commerciaux_enabled IS DISTINCT FROM OLD.crm_commerciaux_enabled
    OR NEW.crm_commissions_enabled IS DISTINCT FROM OLD.crm_commissions_enabled
    OR NEW.crm_facturation_enabled IS DISTINCT FROM OLD.crm_facturation_enabled
    OR NEW.crm_sup_factures_enabled IS DISTINCT FROM OLD.crm_sup_factures_enabled
    OR NEW.crm_reports_enabled IS DISTINCT FROM OLD.crm_reports_enabled
    OR NEW.crm_team_reports_enabled IS DISTINCT FROM OLD.crm_team_reports_enabled
    OR NEW.crm_menu_order_enabled IS DISTINCT FROM OLD.crm_menu_order_enabled
  THEN
    RAISE EXCEPTION 'Acces refuse : seul la Direction peut modifier role/statut/modules (tentative sur profil %)', OLD.id
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
