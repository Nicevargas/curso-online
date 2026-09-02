-- Migration: comunidade por jornada/curso + comentários
-- Cada post pertence a uma jornada (curso). Só quem participa da jornada
-- (matriculado em `enrollments`, jornada ativa no perfil, ou admin) lê e escreve.
-- Idempotente. Rodar DEPOIS de 20260901150000 (profiles) e 20260902090000 (comunidade).

-- 0. Tabela de matrículas (a migration 20260901130000 pode não ter sido aplicada no banco)
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, journey_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enrollments' AND policyname = 'Users can view their own enrollments') THEN
    CREATE POLICY "Users can view their own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enrollments' AND policyname = 'Authenticated users can insert own enrollments') THEN
    CREATE POLICY "Authenticated users can insert own enrollments" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'enrollments' AND policyname = 'Users can update their own enrollments') THEN
    CREATE POLICY "Users can update their own enrollments" ON public.enrollments FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.enrollments TO authenticated;

-- 1. Função: o usuário logado participa da jornada?
CREATE OR REPLACE FUNCTION public.is_journey_member(jid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    jid IS NULL
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'admin'
          OR p.journey_id = jid
          -- sem jornada definida no perfil, o app considera a jornada padrão (lib/courses.ts)
          OR (p.journey_id IS NULL AND jid = 'fa512a52-9742-410f-a71b-0bd4013bec8d')
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.user_id = auth.uid()
        AND e.journey_id = jid
        AND COALESCE(e.status, 'active') = 'active'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_journey_member(UUID) TO authenticated, anon;

-- 2. Posts pertencem a uma jornada
ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE;

-- Backfill: posts antigos vão para a jornada padrão do app, se ela existir
UPDATE public.community_posts
SET journey_id = 'fa512a52-9742-410f-a71b-0bd4013bec8d'
WHERE journey_id IS NULL
  AND EXISTS (SELECT 1 FROM public.journeys WHERE id = 'fa512a52-9742-410f-a71b-0bd4013bec8d');

CREATE INDEX IF NOT EXISTS community_posts_journey_created_idx
  ON public.community_posts (journey_id, created_at DESC);

-- 3. Comentários
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS post_comments_post_created_idx
  ON public.post_comments (post_id, created_at);

ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- 4. Políticas: substituir as antigas ("qualquer um vê") por "só membros da jornada"
DROP POLICY IF EXISTS "Anyone can view community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authenticated users can create community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can delete their own community posts" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_select_members" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert_members" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete_own" ON public.community_posts;

CREATE POLICY "community_posts_select_members" ON public.community_posts
  FOR SELECT TO authenticated
  USING (public.is_journey_member(journey_id));

CREATE POLICY "community_posts_insert_members" ON public.community_posts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.is_journey_member(journey_id));

CREATE POLICY "community_posts_delete_own" ON public.community_posts
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view post interactions" ON public.post_interactions;
DROP POLICY IF EXISTS "Authenticated users can create post interactions" ON public.post_interactions;
DROP POLICY IF EXISTS "Users can delete their own post interactions" ON public.post_interactions;
DROP POLICY IF EXISTS "post_interactions_select_members" ON public.post_interactions;
DROP POLICY IF EXISTS "post_interactions_insert_own" ON public.post_interactions;
DROP POLICY IF EXISTS "post_interactions_delete_own" ON public.post_interactions;

CREATE POLICY "post_interactions_select_members" ON public.post_interactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts cp
                 WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));

CREATE POLICY "post_interactions_insert_own" ON public.post_interactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id
              AND EXISTS (SELECT 1 FROM public.community_posts cp
                          WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));

CREATE POLICY "post_interactions_delete_own" ON public.post_interactions
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_comments_select_members" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;

CREATE POLICY "post_comments_select_members" ON public.post_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts cp
                 WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));

CREATE POLICY "post_comments_insert_own" ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id
              AND EXISTS (SELECT 1 FROM public.community_posts cp
                          WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));

CREATE POLICY "post_comments_delete_own" ON public.post_comments
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 5. Permissões e tempo real
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
REVOKE ALL ON public.community_posts, public.post_interactions, public.post_comments FROM anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
  END IF;
END $$;
