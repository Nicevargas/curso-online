-- Migration: corrigir relações da comunidade, curtidas e atualização em tempo real
-- Corrige: post publicado não aparece no feed (embed profiles falhava), curtir não
-- funcionava (coluna interaction_type inexistente), outros alunos não viam posts
-- novos sem recarregar (tabelas fora da publicação supabase_realtime).
-- Idempotente.

-- 1a. Perfis "órfãos": mesmo e-mail de um usuário do Auth, mas com id que não existe
--     mais no Auth (conta apagada e recriada). Religa o perfil ao usuário atual em vez
--     de criar outro — evita "duplicate key value violates unique constraint profiles_email_key".
UPDATE public.profiles p
SET id = u.id
FROM auth.users u
WHERE lower(p.email) = lower(u.email)
  AND p.id <> u.id
  AND NOT EXISTS (SELECT 1 FROM auth.users x WHERE x.id = p.id)
  AND NOT EXISTS (SELECT 1 FROM public.profiles q WHERE q.id = u.id);

-- 1b. Garantir que todo usuário do Auth tenha um perfil (necessário para a FK abaixo).
--     ON CONFLICT DO NOTHING sem alvo: ignora conflito tanto de id quanto de e-mail.
INSERT INTO public.profiles (id, name, email)
SELECT u.id,
       COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
       u.email
FROM auth.users u
ON CONFLICT DO NOTHING;

-- 1c. Posts/curtidas cujo autor não tem perfil (não pode acontecer após 1a/1b, mas
--     protege a criação da FK abaixo)
DELETE FROM public.post_interactions WHERE user_id NOT IN (SELECT id FROM public.profiles);
DELETE FROM public.community_posts    WHERE user_id NOT IN (SELECT id FROM public.profiles);

-- 2. FK community_posts.user_id -> profiles.id e post_interactions.user_id -> profiles.id
--    Permite o embed `profiles(...)` no PostgREST e o join de autores.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'community_posts_user_id_profiles_fkey') THEN
    ALTER TABLE public.community_posts
      ADD CONSTRAINT community_posts_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_interactions_user_id_profiles_fkey') THEN
    ALTER TABLE public.post_interactions
      ADD CONSTRAINT post_interactions_user_id_profiles_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Coluna interaction_type (o app enviava esse campo e a inserção falhava)
ALTER TABLE public.post_interactions ADD COLUMN IF NOT EXISTS interaction_type TEXT DEFAULT 'like';

-- 4. Índices para o feed
CREATE INDEX IF NOT EXISTS community_posts_created_at_idx ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS post_interactions_post_id_idx ON public.post_interactions (post_id);

-- 5. Tempo real: o app assina mudanças em community_posts; a tabela precisa estar na publicação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'community_posts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'post_interactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.post_interactions;
  END IF;
END $$;

-- 6. Permissões
GRANT SELECT, INSERT, DELETE ON public.community_posts TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.post_interactions TO authenticated;
GRANT SELECT ON public.community_posts, public.post_interactions TO anon;
