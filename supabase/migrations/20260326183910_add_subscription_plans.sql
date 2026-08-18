-- Migration: Add subscription plans and payment status to profiles
-- Created at: 2026-03-26T18:39:10Z

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT '7_days_free';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;

-- Add comment to explain plan types
COMMENT ON COLUMN profiles.plan IS 'Subscription plan type: 7_days_free, 30_days_free, no_charge, or custom';
