-- 015_analytics_structured_fields.sql
-- Adds structured analytics metadata columns to research_entries.
-- All columns nullable — existing Interview/Survey/Market Insight rows unaffected.
-- Run order: must come after 014_create_feedback_entries.sql

ALTER TABLE research_entries ADD COLUMN IF NOT EXISTS metric_name     TEXT;
ALTER TABLE research_entries ADD COLUMN IF NOT EXISTS metric_value    NUMERIC;
ALTER TABLE research_entries ADD COLUMN IF NOT EXISTS metric_baseline NUMERIC;
ALTER TABLE research_entries ADD COLUMN IF NOT EXISTS metric_unit     TEXT;
ALTER TABLE research_entries ADD COLUMN IF NOT EXISTS time_period     TEXT;
ALTER TABLE research_entries ADD COLUMN IF NOT EXISTS data_source     TEXT;
