-- ============================================================================
-- Copia as aulas antigas da tabela `content` para `lessons`
-- ============================================================================
-- Rode DEPOIS de 20260902180000_setup_completo.sql.
--
-- Por que: o painel admin grava em `lessons` e é lá que a jornada procura as aulas.
-- As aulas antigas ficaram em `content`, então a página aparecia vazia.
--
-- Os IDs são preservados: uma aula copiada mantém o mesmo UUID que tinha em
-- `content`, então o progresso já registrado em `lesson_progress` continua valendo.
-- Seguro rodar mais de uma vez (ON CONFLICT DO NOTHING).
-- ============================================================================

-- 1. Aulas com curso definido em content.journey_id
INSERT INTO public.lessons (id, journey_id, titulo, descricao, capa_url, video_url, pdf_url, dia, created_at)
SELECT
  c.id,
  c.journey_id,
  COALESCE(NULLIF(trim(c.title), ''), 'Aula'),
  c.description,
  c.thumbnail_url,
  c.media_url,
  -- em `content`, `url` costuma ser o material de apoio (só usa se for diferente do vídeo)
  CASE WHEN c.url IS DISTINCT FROM c.media_url THEN c.url END,
  -- "Dia 03: ..." vira ordem 3; sem número, fica nulo e ordena pela data
  NULLIF(substring(c.title from '[Dd]ia\s*0*([0-9]+)'), '')::int,
  c.created_at
FROM public.content c
WHERE c.journey_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.journeys j WHERE j.id = c.journey_id)
ON CONFLICT (id) DO NOTHING;

-- 2. Aulas sem journey_id: vincula pelo archetype, quando bate com o de um curso
INSERT INTO public.lessons (id, journey_id, titulo, descricao, capa_url, video_url, pdf_url, dia, created_at)
SELECT
  c.id,
  j.id,
  COALESCE(NULLIF(trim(c.title), ''), 'Aula'),
  c.description,
  c.thumbnail_url,
  c.media_url,
  CASE WHEN c.url IS DISTINCT FROM c.media_url THEN c.url END,
  NULLIF(substring(c.title from '[Dd]ia\s*0*([0-9]+)'), '')::int,
  c.created_at
FROM public.content c
JOIN public.journeys j ON lower(j.archetype) = lower(c.archetype)
WHERE c.journey_id IS NULL
  AND c.archetype IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- 3. Sobrou algo sem curso (ex.: "Vídeo Boas-vindas", archetype 'Boas-vindas')?
--    Vai para o curso padrão, na frente da trilha (dia 0).
INSERT INTO public.lessons (id, journey_id, titulo, descricao, capa_url, video_url, pdf_url, dia, created_at)
SELECT
  c.id,
  'fa512a52-9742-410f-a71b-0bd4013bec8d',
  COALESCE(NULLIF(trim(c.title), ''), 'Aula'),
  c.description,
  c.thumbnail_url,
  c.media_url,
  CASE WHEN c.url IS DISTINCT FROM c.media_url THEN c.url END,
  0,
  c.created_at
FROM public.content c
WHERE NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.id = c.id)
  AND EXISTS (SELECT 1 FROM public.journeys j WHERE j.id = 'fa512a52-9742-410f-a71b-0bd4013bec8d')
ON CONFLICT (id) DO NOTHING;

-- 4. Preenche a ordem das aulas que ficaram sem número, pela data de criação
WITH ordenadas AS (
  SELECT id, row_number() OVER (PARTITION BY journey_id ORDER BY created_at) + 100 AS pos
  FROM public.lessons
  WHERE dia IS NULL
)
UPDATE public.lessons l
SET dia = o.pos
FROM ordenadas o
WHERE l.id = o.id;

-- 5. Confirmação: quantas aulas cada curso tem agora
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT j.title, count(l.id) AS total
    FROM public.journeys j
    LEFT JOIN public.lessons l ON l.journey_id = j.id
    GROUP BY j.title
    ORDER BY j.title
  LOOP
    RAISE NOTICE 'Curso "%": % aula(s)', r.title, r.total;
  END LOOP;
END $$;
