-- Migration: Create business_sheets table for "A Ficha do Seu Negócio"
-- Created at: 2026-09-01T09:00:00-07:00

CREATE TABLE IF NOT EXISTS business_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  business_name TEXT,
  segment TEXT,
  what_you_sell TEXT,
  target_audience TEXT,
  main_benefit TEXT,
  tone_of_voice TEXT DEFAULT 'Amigável',
  brand_colors JSONB DEFAULT '[]'::jsonb,
  contact_channel TEXT DEFAULT 'WhatsApp',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE business_sheets ENABLE ROW LEVEL SECURITY;

-- Policies for business_sheets
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view their own business sheet') THEN
        CREATE POLICY "Users can view their own business sheet" ON business_sheets FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can insert their own business sheet') THEN
        CREATE POLICY "Users can insert their own business sheet" ON business_sheets FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own business sheet') THEN
        CREATE POLICY "Users can update their own business sheet" ON business_sheets FOR UPDATE USING (auth.uid() = user_id);
    END IF;
END $$;
