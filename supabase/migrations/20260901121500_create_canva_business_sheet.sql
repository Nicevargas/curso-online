-- ==============================================================================
-- Migration: Tabela Ficha do Negócio para o Curso Canva com IA 2.0
-- Created: 2026-09-01
-- Descrição: Cria a tabela vinculada ao usuário para armazenar os 8 campos
-- da "Ficha do Seu Negócio" exclusivos para o Curso de Canva com IA 2.0.
-- ==============================================================================

-- 1. Criar tabela canva_business_sheets (e tabela business_sheets para compatibilidade)
CREATE TABLE IF NOT EXISTS public.canva_business_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  course_slug TEXT DEFAULT 'canva-com-ia-2-0' NOT NULL,
  business_name TEXT DEFAULT '',
  segment TEXT DEFAULT '',
  what_you_sell TEXT DEFAULT '',
  target_audience TEXT DEFAULT '',
  main_benefit TEXT DEFAULT '',
  tone_of_voice TEXT DEFAULT 'Amigável',
  brand_colors JSONB DEFAULT '[]'::jsonb,
  contact_channel TEXT DEFAULT 'WhatsApp',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela business_sheets (compatibilidade direta com referências legadas)
CREATE TABLE IF NOT EXISTS public.business_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  course_slug TEXT DEFAULT 'canva-com-ia-2-0' NOT NULL,
  business_name TEXT DEFAULT '',
  segment TEXT DEFAULT '',
  what_you_sell TEXT DEFAULT '',
  target_audience TEXT DEFAULT '',
  main_benefit TEXT DEFAULT '',
  tone_of_voice TEXT DEFAULT 'Amigável',
  brand_colors JSONB DEFAULT '[]'::jsonb,
  contact_channel TEXT DEFAULT 'WhatsApp',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Índices para performance em buscas por usuário
CREATE INDEX IF NOT EXISTS idx_canva_business_sheets_user_id ON public.canva_business_sheets(user_id);
CREATE INDEX IF NOT EXISTS idx_business_sheets_user_id ON public.business_sheets(user_id);

-- 3. Habilitar Segurança por Linha (Row Level Security - RLS)
ALTER TABLE public.canva_business_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_sheets ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de RLS para canva_business_sheets (Acesso exclusivo do próprio usuário autenticado)
DO $$ 
BEGIN
    -- SELECT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canva_business_sheets' AND policyname = 'canva_sheets_select_own') THEN
        CREATE POLICY "canva_sheets_select_own" ON public.canva_business_sheets
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    -- INSERT
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canva_business_sheets' AND policyname = 'canva_sheets_insert_own') THEN
        CREATE POLICY "canva_sheets_insert_own" ON public.canva_business_sheets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    -- UPDATE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canva_business_sheets' AND policyname = 'canva_sheets_update_own') THEN
        CREATE POLICY "canva_sheets_update_own" ON public.canva_business_sheets
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    -- DELETE
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canva_business_sheets' AND policyname = 'canva_sheets_delete_own') THEN
        CREATE POLICY "canva_sheets_delete_own" ON public.canva_business_sheets
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 5. Políticas de RLS para business_sheets
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_sheets' AND policyname = 'business_sheets_select_own') THEN
        CREATE POLICY "business_sheets_select_own" ON public.business_sheets
            FOR SELECT USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_sheets' AND policyname = 'business_sheets_insert_own') THEN
        CREATE POLICY "business_sheets_insert_own" ON public.business_sheets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_sheets' AND policyname = 'business_sheets_update_own') THEN
        CREATE POLICY "business_sheets_update_own" ON public.business_sheets
            FOR UPDATE USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_sheets' AND policyname = 'business_sheets_delete_own') THEN
        CREATE POLICY "business_sheets_delete_own" ON public.business_sheets
            FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- 6. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_canva_business_sheets_updated_at ON public.canva_business_sheets;
CREATE TRIGGER tr_canva_business_sheets_updated_at
    BEFORE UPDATE ON public.canva_business_sheets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at_timestamp();

DROP TRIGGER IF EXISTS tr_business_sheets_updated_at ON public.business_sheets;
CREATE TRIGGER tr_business_sheets_updated_at
    BEFORE UPDATE ON public.business_sheets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at_timestamp();
