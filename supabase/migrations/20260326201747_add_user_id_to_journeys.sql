-- Migration: Add user_id to journeys and set up RLS
-- Created at: 2026-03-26T20:17:47Z

-- Add user_id column to journeys table
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on journeys table
ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;

-- Create policies for journeys
DO $$ 
BEGIN
    -- Policy: Anyone can view journeys (to keep home page working)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view journeys') THEN
        CREATE POLICY "Anyone can view journeys" ON journeys FOR SELECT USING (true);
    END IF;

    -- Policy: Authenticated users can create journeys
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can create journeys') THEN
        CREATE POLICY "Authenticated users can create journeys" ON journeys FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;

    -- Policy: Users can update their own journeys
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update their own journeys') THEN
        CREATE POLICY "Users can update their own journeys" ON journeys FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- Policy: Users can delete their own journeys
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete their own journeys') THEN
        CREATE POLICY "Users can delete their own journeys" ON journeys FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
