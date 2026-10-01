-- Migration: Ajout du module CRM Rapports Hebdo et verrouillage d'intégrité

-- 1. Colonne de permission sur profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_reports_enabled BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS crm_team_reports_enabled BOOLEAN DEFAULT true;

-- 2. Colonne de verrouillage sur v2_daily_reports
ALTER TABLE v2_daily_reports ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE v2_daily_reports ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Opérationnel';

-- 3. Mise à jour de la table v2_weekly_reports
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
ALTER TABLE v2_weekly_reports ADD COLUMN IF NOT EXISTS pdf_url TEXT;
