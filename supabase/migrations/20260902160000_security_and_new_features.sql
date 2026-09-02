-- Migration: segurança do perfil + tabelas do planner, dicas, favoritos e conversas
-- Rodar depois de 20260901150000, 20260902090000 e 20260902120000.
-- Idempotente.

-- ============================================================
-- 1. A aluna não pode mais liberar o próprio acesso
-- ============================================================
-- Antes, /perfil deixava escolher o plano ("Sem cobrança" desbloqueava tudo) e a jornada,
-- gravando direto em profiles. A UI foi removida; aqui bloqueamos no banco.
-- Regra: a aluna atualiza apenas name/bio/avatar_url/theme. Colunas sensíveis
-- (plan, is_paid, status, role, journey_id, points, level, streak, plan_expires_at)
-- só mudam via service role (webhook de pagamento, painel admin) ou por um admin.

-- Função auxiliar: o usuário logado é admin? (evita recursão de RLS via SECURITY DEFINER)
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

CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- service_role (webhook/admin API) e postgres passam direto
  IF current_setting('request.jwt.claims', true) IS NULL
     OR coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT public.is_admin_user() INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Aluna comum: preserva os valores antigos das colunas sensíveis
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

-- A matrícula também deixa de ser self-service: a aluna lê as suas, mas quem cria/atualiza
-- é o admin ou o service role (webhook de pagamento).
DROP POLICY IF EXISTS "Authenticated users can insert own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "Users can update their own enrollments" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_insert_admin" ON public.enrollments;
DROP POLICY IF EXISTS "enrollments_update_admin" ON public.enrollments;

CREATE POLICY "enrollments_insert_admin" ON public.enrollments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "enrollments_update_admin" ON public.enrollments
  FOR UPDATE TO authenticated
  USING (public.is_admin_user());

-- ============================================================
-- 2. Planner de estudos (antes só existia no localStorage do navegador)
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
-- 3. Dicas & prompts editáveis pelo admin (antes fixos no código)
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

GRANT SELECT ON public.tips TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tips TO authenticated;

-- Favoritos da aluna
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

-- Conteúdo inicial (o mesmo que estava fixo em app/dicas/page.tsx)
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
-- 4. Conversas com a consultora (histórico que hoje se perde ao trocar de página)
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
-- 5. Diário: garantir a coluna de humor e as políticas
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
-- 6. Aulas: colunas que o painel admin passa a preencher
-- ============================================================
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS duracao TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS dia INTEGER;
CREATE INDEX IF NOT EXISTS lessons_journey_dia_idx ON public.lessons (journey_id, dia);

-- Progresso: evitar duplicatas (a mesma aula era contada duas vezes na pontuação)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lesson_progress_user_lesson_key'
  ) THEN
    BEGIN
      ALTER TABLE public.lesson_progress
        ADD CONSTRAINT lesson_progress_user_lesson_key UNIQUE (user_id, lesson_id);
    EXCEPTION WHEN others THEN
      RAISE WARNING 'Não foi possível criar a restrição única em lesson_progress: %', SQLERRM;
    END;
  END IF;
END $$;

ALTER TABLE public.lesson_progress ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
