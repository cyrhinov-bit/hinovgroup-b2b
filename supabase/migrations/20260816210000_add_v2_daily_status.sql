-- Migration: Add status to v2_daily_reports

ALTER TABLE v2_daily_reports 
ADD COLUMN status TEXT DEFAULT 'Brouillon';
