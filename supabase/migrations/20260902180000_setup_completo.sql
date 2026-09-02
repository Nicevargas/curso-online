-- ============================================================================
-- SETUP COMPLETO DA PLATAFORMA — rode SOMENTE este arquivo no SQL Editor
-- ============================================================================
-- Substitui as migrations anteriores: cria tudo o que falta, na ordem certa, e
-- é seguro rodar mais de uma vez (tudo é IF NOT EXISTS / CREATE OR REPLACE).
--
-- Cobre: profiles + trigger de cadastro, jornadas, aulas, progresso, matrículas,
-- comunidade por jornada com comentários, planner, dicas, favoritos, conversas
-- da Lyra, diário, ficha do negócio e as políticas de segurança.
-- ============================================================================

-- ============================================================
-- 1. PERFIS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'usuario';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Ativo';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT '7_days_free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS journey_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT;

-- Perfis órfãos: mesmo e-mail de um usuário do Auth, mas com id que não existe mais
-- (conta apagada e recriada). Religa em vez de tentar criar outro.
UPDATE public.profiles p
SET id = u.id
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND p.id <> u.id
  AND NOT EXISTS (SELECT 1 FROM auth.users x WHERE x.id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.profiles q WHERE q.id = u.id);

-- Todo usuário do Auth precisa de um perfil (as chaves estrangeiras dependem disso)
INSERT INTO public.profiles (id, name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
       u.email
FROM auth.users u
ON CONFLICT DO NOTHING;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_select_public') THEN
    CREATE POLICY "profiles_select_public" ON public.profiles FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_insert_own') THEN
    CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Quem é admin? (SECURITY DEFINER evita recursão de RLS)
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND lower(coalesce(role, '')) IN ('admin', 'admin master', 'administrador')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, anon;

-- Cria o perfil automaticamente ao cadastrar
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET id = NEW.id
  WHERE lower(email) = lower(NEW.email)
    AND id <> NEW.id
    AND NOT EXISTS (SELECT 1 FROM auth.users x WHERE x.id = public.profiles.id);

  INSERT INTO public.profiles (id, name, email, role, level, status, points, streak, plan, is_paid)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    'usuario', 1, 'Ativo', 0, 0, '7_days_free', false
  )
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name  = COALESCE(EXCLUDED.name, public.profiles.name);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user falhou para %: % (%)', NEW.id, SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- A aluna não altera plano, pagamento, papel nem pontuação
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claims', true) IS NULL
     OR coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin_user() THEN
    RETURN NEW;
  END IF;

  NEW.plan            := OLD.plan;
  NEW.plan_expires_at := OLD.plan_expires_at;
  NEW.is_paid         := OLD.is_paid;
  NEW.status          := OLD.status;
  NEW.role            := OLD.role;
  NEW.points          := OLD.points;
  NEW.level           := OLD.level;
  NEW.streak          := OLD.streak;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns_trigger ON public.profiles;
CREATE TRIGGER protect_profile_columns_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_columns();

-- ============================================================
-- 2. CURSOS (jornadas) E AULAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.journeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  archetype TEXT DEFAULT 'Jornada',
  description TEXT,
  image_url TEXT,
  duration TEXT,
  steps INTEGER DEFAULT 10,
  participants INTEGER DEFAULT 0,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS archetype TEXT DEFAULT 'Jornada';
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS steps INTEGER DEFAULT 10;
ALTER TABLE public.journeys ADD COLUMN IF NOT EXISTS participants INTEGER DEFAULT 0;

ALTER TABLE public.journeys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journeys' AND policyname = 'journeys_select_all') THEN
    CREATE POLICY "journeys_select_all" ON public.journeys FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'journeys' AND policyname = 'journeys_write_admin') THEN
    CREATE POLICY "journeys_write_admin" ON public.journeys
      FOR ALL TO authenticated
      USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;
END $$;

GRANT SELECT ON public.journeys TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.journeys TO authenticated;

-- Curso padrão (id fixo usado pelo app em lib/courses.ts)
INSERT INTO public.journeys (id, title, archetype, description, duration, steps)
VALUES (
  'fa512a52-9742-410f-a71b-0bd4013bec8d',
  'Canva com IA 2.0 - O Desafio',
  'Jornada',
  'Domine a criação de designs profissionais, prompts e carrosséis com as ferramentas de inteligência artificial do Canva.',
  '10 Módulos',
  10
)
ON CONFLICT (id) DO NOTHING;

-- Aulas (é a tabela que a página da aluna lê e que o painel admin grava)
CREATE TABLE IF NOT EXISTS public.lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  capa_url TEXT,
  video_url TEXT,
  pdf_url TEXT,
  duracao TEXT,
  dia INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS journey_id UUID;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS descricao TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS capa_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS duracao TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS dia INTEGER;

CREATE INDEX IF NOT EXISTS lessons_journey_dia_idx ON public.lessons (journey_id, dia);
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lessons' AND policyname = 'lessons_select_all') THEN
    CREATE POLICY "lessons_select_all" ON public.lessons FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lessons' AND policyname = 'lessons_write_admin') THEN
    CREATE POLICY "lessons_write_admin" ON public.lessons
      FOR ALL TO authenticated
      USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO authenticated;

-- Conteúdo legado (fallback do app)
CREATE TABLE IF NOT EXISTS public.content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  archetype TEXT DEFAULT 'Jornada',
  thumbnail_url TEXT,
  media_url TEXT,
  url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.content ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content' AND policyname = 'content_select_all') THEN
    CREATE POLICY "content_select_all" ON public.content FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'content' AND policyname = 'content_write_admin') THEN
    CREATE POLICY "content_write_admin" ON public.content
      FOR ALL TO authenticated
      USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content TO authenticated;

-- Progresso das aulas
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL,
  completed BOOLEAN DEFAULT true,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS lesson_progress_user_idx ON public.lesson_progress (user_id, completed);

-- Uma linha por aula/aluna (evitava pontuação dobrada)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_user_lesson_key') THEN
    BEGIN
      DELETE FROM public.lesson_progress a
      USING public.lesson_progress b
      WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.lesson_id = b.lesson_id;

      ALTER TABLE public.lesson_progress
        ADD CONSTRAINT lesson_progress_user_lesson_key UNIQUE (user_id, lesson_id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'Restrição única em lesson_progress não criada: %', SQLERRM;
    END;
  END IF;
END $$;

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lesson_progress' AND policyname = 'lesson_progress_own') THEN
    CREATE POLICY "lesson_progress_own" ON public.lesson_progress
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_progress TO authenticated;

-- ============================================================
-- 3. MATRÍCULAS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, journey_id)
);

ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update their own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_select_own" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_admin" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_update_admin" ON public.enrollments;

CREATE POLICY "enrollments_select_own" ON public.enrollments
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin_user());

CREATE POLICY "enrollments_insert_admin" ON public.enrollments
  FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());

CREATE POLICY "enrollments_update_admin" ON public.enrollments
  FOR UPDATE TO authenticated USING (public.is_admin_user());

GRANT SELECT, INSERT, UPDATE ON public.enrollments TO authenticated;

-- Participa da jornada? (matriculada, jornada ativa no perfil, ou admin)
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
          lower(coalesce(p.role, '')) IN ('admin', 'admin master', 'administrador')
          OR p.journey_id = jid
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

-- ============================================================
-- 4. COMUNIDADE POR JORNADA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  journey_id UUID REFERENCES public.journeys(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS journey_id UUID;

CREATE TABLE IF NOT EXISTS public.post_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
  interaction_type TEXT DEFAULT 'like',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, post_id)
);

ALTER TABLE public.post_interactions ADD COLUMN IF NOT EXISTS interaction_type TEXT DEFAULT 'like';

CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 2000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Posts antigos vão para o curso padrão
UPDATE public.community_posts
SET journey_id = 'fa512a52-9742-410f-a71b-0bd4013bec8d'
WHERE journey_id IS NULL;

-- Chave estrangeira para profiles (permite juntar o autor de cada post)
DO $$
BEGIN
  DELETE FROM public.post_interactions WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.profiles);
  DELETE FROM public.community_posts   WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM public.profiles);

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_user_id_profiles_fkey') THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  RAISE WARNING 'FK de community_posts não criada: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS community_posts_journey_created_idx ON public.community_posts (journey_id, created_at DESC);
CREATE INDEX IF NOT EXISTS post_interactions_post_id_idx ON public.post_interactions (post_id);
CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON public.post_comments (post_id, created_at);

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;

-- Só membros da jornada leem e escrevem
DROP POLICY IF EXISTS "Anyone can view community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Authenticated users can create community posts" ON public.community_posts;
DROP POLICY IF EXISTS "Users can delete their own community posts" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_select_members" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_insert_members" ON public.community_posts;
DROP POLICY IF EXISTS "community_posts_delete_own" ON public.community_posts;

CREATE POLICY "community_posts_select_members" ON public.community_posts
  FOR SELECT TO authenticated USING (public.is_journey_member(journey_id));
CREATE POLICY "community_posts_insert_members" ON public.community_posts
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.is_journey_member(journey_id));
CREATE POLICY "community_posts_delete_own" ON public.community_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view post interactions" ON public.post_interactions;
DROP POLICY IF EXISTS "Authenticated users can create post interactions" ON public.post_interactions;
DROP POLICY IF EXISTS "Users can delete their own post interactions" ON public.post_interactions;
DROP POLICY IF EXISTS "post_interactions_select_members" ON public.post_interactions;
DROP POLICY IF EXISTS "post_interactions_insert_own" ON public.post_interactions;
DROP POLICY IF EXISTS "post_interactions_delete_own" ON public.post_interactions;

CREATE POLICY "post_interactions_select_members" ON public.post_interactions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));
CREATE POLICY "post_interactions_insert_own" ON public.post_interactions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id
              AND EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));
CREATE POLICY "post_interactions_delete_own" ON public.post_interactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "post_comments_select_members" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_insert_own" ON public.post_comments;
DROP POLICY IF EXISTS "post_comments_delete_own" ON public.post_comments;

CREATE POLICY "post_comments_select_members" ON public.post_comments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));
CREATE POLICY "post_comments_insert_own" ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id
              AND EXISTS (SELECT 1 FROM public.community_posts cp WHERE cp.id = post_id AND public.is_journey_member(cp.journey_id)));
CREATE POLICY "post_comments_delete_own" ON public.post_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_interactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;

-- Tempo real (o feed atualiza sozinho para quem está na mesma jornada)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['community_posts', 'post_interactions', 'post_comments'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
EXCEPTION WHEN others THEN
  RAISE WARNING 'Publicação realtime não configurada: %', SQLERRM;
END $$;

-- ============================================================
-- 5. DIÁRIO DE EVOLUÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.diary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mood TEXT DEFAULT 'neutral',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.diary_entries ADD COLUMN IF NOT EXISTS mood TEXT DEFAULT 'neutral';
CREATE INDEX IF NOT EXISTS diary_entries_user_idx ON public.diary_entries (user_id, created_at DESC);
ALTER TABLE public.diary_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'diary_entries' AND policyname = 'diary_entries_own') THEN
    CREATE POLICY "diary_entries_own" ON public.diary_entries
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diary_entries TO authenticated;

-- ============================================================
-- 6. PLANNER DE ESTUDOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.planner_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 300),
  category TEXT DEFAULT 'Estudo',
  priority TEXT DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baixa')),
  due_date DATE,
  completed BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS planner_tasks_user_idx ON public.planner_tasks (user_id, completed, due_date);
ALTER TABLE public.planner_tasks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'planner_tasks' AND policyname = 'planner_tasks_own') THEN
    CREATE POLICY "planner_tasks_own" ON public.planner_tasks
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planner_tasks TO authenticated;

-- ============================================================
-- 7. DICAS & PROMPTS + FAVORITOS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Prompts',
  description TEXT,
  content TEXT NOT NULL,
  copy_count INTEGER DEFAULT 0,
  position INTEGER DEFAULT 0,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tips' AND policyname = 'tips_select_all') THEN
    CREATE POLICY "tips_select_all" ON public.tips
      FOR SELECT TO authenticated USING (published OR public.is_admin_user());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tips' AND policyname = 'tips_write_admin') THEN
    CREATE POLICY "tips_write_admin" ON public.tips
      FOR ALL TO authenticated
      USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tips TO authenticated;

CREATE TABLE IF NOT EXISTS public.tip_favorites (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tip_id UUID NOT NULL REFERENCES public.tips(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, tip_id)
);

ALTER TABLE public.tip_favorites ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tip_favorites' AND policyname = 'tip_favorites_own') THEN
    CREATE POLICY "tip_favorites_own" ON public.tip_favorites
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, DELETE ON public.tip_favorites TO authenticated;

-- Conteúdo inicial das dicas
INSERT INTO public.tips (title, category, description, content, position)
SELECT * FROM (VALUES
  ('Prompt de imagem profissional', 'Prompts', 'Estrutura completa para gerar imagens realistas no Magic Media.',
   'Foto profissional de [SUJEITO], [ESTILO], iluminação [natural suave / estúdio], composição [regra dos terços], ângulo [frontal / 3/4], paleta [suas cores], atmosfera [aconchegante], alta resolução, sem texto.', 1),
  ('Carrossel de 7 slides que converte', 'Carrossel', 'Estrutura de slides com gancho, desenvolvimento e CTA.',
   'Slide 1: gancho com a dor do público. Slides 2-3: o erro comum. Slides 4-5: a solução em passos. Slide 6: prova ou exemplo. Slide 7: chamada para ação clara.', 2),
  ('Ganchos magnéticos para o primeiro slide', 'Copy', 'Modelos prontos de headline para segurar a atenção.',
   '"Pare de [erro comum] se você quer [resultado]." / "3 coisas que eu faria diferente se começasse hoje." / "O que ninguém te conta sobre [tema]."', 3),
  ('Paleta de cores da sua marca', 'Design', 'Como escolher e aplicar cores consistentes no Canva.',
   'Defina 1 cor principal, 1 de destaque e 2 neutras. Use a principal em 60% da arte, a neutra em 30% e o destaque em 10% (só no CTA). Salve tudo no Brand Kit.', 4),
  ('Legenda que gera comentários', 'Copy', 'Fórmula de legenda com pergunta final.',
   'Contexto em 1 linha + história curta em 3 linhas + aprendizado em 1 linha + pergunta aberta para a audiência responder.', 5),
  ('Removedor de fundo + Magic Expand', 'Design', 'Fluxo para transformar uma foto simples em capa de post.',
   'Suba a foto, use Removedor de Fundo, aplique Magic Expand para ampliar o cenário e finalize com um filtro de cor da sua paleta.', 6)
) AS t(title, category, description, content, position)
WHERE NOT EXISTS (SELECT 1 FROM public.tips);

-- ============================================================
-- 8. CONVERSAS COM A CONSULTORA (LYRA)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.lyra_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS lyra_messages_user_idx ON public.lyra_messages (user_id, created_at);
ALTER TABLE public.lyra_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'lyra_messages' AND policyname = 'lyra_messages_own') THEN
    CREATE POLICY "lyra_messages_own" ON public.lyra_messages
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, DELETE ON public.lyra_messages TO authenticated;

-- ============================================================
-- 9. FICHA DO NEGÓCIO
-- ============================================================
CREATE TABLE IF NOT EXISTS public.canva_business_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_slug TEXT DEFAULT 'canva-com-ia-2-0',
  business_name TEXT,
  segment TEXT,
  what_you_sell TEXT,
  target_audience TEXT,
  main_benefit TEXT,
  tone_of_voice TEXT DEFAULT 'Amigável',
  brand_colors JSONB DEFAULT '[]'::jsonb,
  contact_channel TEXT DEFAULT 'WhatsApp',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.business_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_slug TEXT DEFAULT 'canva-com-ia-2-0',
  business_name TEXT,
  segment TEXT,
  what_you_sell TEXT,
  target_audience TEXT,
  main_benefit TEXT,
  tone_of_voice TEXT DEFAULT 'Amigável',
  brand_colors JSONB DEFAULT '[]'::jsonb,
  contact_channel TEXT DEFAULT 'WhatsApp',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.canva_business_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_sheets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'canva_business_sheets' AND policyname = 'canva_sheets_own') THEN
    CREATE POLICY "canva_sheets_own" ON public.canva_business_sheets
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'business_sheets' AND policyname = 'business_sheets_own') THEN
    CREATE POLICY "business_sheets_own" ON public.business_sheets
      FOR ALL TO authenticated
      USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.canva_business_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_sheets TO authenticated;

-- ============================================================
-- FIM. Confira no Table Editor: profiles, journeys, lessons, lesson_progress,
-- enrollments, community_posts, post_comments, planner_tasks, tips e lyra_messages.
-- ============================================================
