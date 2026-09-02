# Melhorias implementadas — 02/09/2026

Todos os itens da análise foram aplicados. Build verificado (21 páginas, sem erros de tipo).

## O que você precisa fazer para tudo funcionar

1. **Rodar UM único arquivo no SQL Editor do Supabase:**
   `supabase/migrations/20260902180000_setup_completo.sql`

   Ele cria tudo o que falta no banco (perfis, cursos, aulas, progresso, matrículas,
   comunidade, planner, dicas, conversas, diário e ficha), na ordem certa, e pode ser
   executado mais de uma vez sem duplicar nada. Testado num Postgres real, inclusive
   com banco "sujo" (tabelas antigas incompletas, perfil órfão com e-mail duplicado e
   progresso duplicado). As migrations anteriores foram movidas para
   `supabase/migrations/_antigas/` e não precisam ser executadas.
2. **Variáveis na Vercel** — as três de sempre (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) mais, opcionalmente:
   - `MP_WEBHOOK_SECRET` — assinatura secreta do webhook (Mercado Pago → Suas integrações → Webhooks). **Sem ela o webhook recusa as notificações em produção.**
   - `COURSE_PRICE` e `COURSE_TITLE` — preço e nome do curso no checkout (antes `29.90` estava fixo no código).
   - `GEMINI_MODEL` — se quiser trocar o modelo de fallback da IA.
3. **Marcar `SUPABASE_SERVICE_ROLE_KEY` e `OPENAI_API_KEY` também em Preview**, se você testa em deploys de preview.
4. **Cadastrar as aulas pelo painel admin** — agora com curso, ordem, duração e material; elas vão para a tabela `lessons`, que é a que as alunas leem.

## 1. Bugs que travavam funcionalidades

| Problema | Como ficou |
|---|---|
| Checkout devolvia 401 para todo mundo | O cliente envia `Authorization: Bearer <token>` (`lib/checkout.ts`) e a rota valida com um cliente server-side (`lib/apiAuth.ts`). Preço e título saíram do código para variáveis de ambiente. |
| Aulas do admin não apareciam para as alunas | O painel grava em `lessons` com `journey_id`, `dia`, `duracao` e `pdf_url` — campos novos no formulário. A leitura da jornada continua em `lessons` com fallback em `content`. |
| Aluna liberava o próprio acesso | Os selects de plano e jornada saíram do perfil, e um trigger no banco (`protect_profile_columns`) impede que `plan`, `is_paid`, `status`, `role`, `points`, `level` e `streak` sejam alterados por quem não é admin. Matrícula também virou ação de admin/webhook. |
| Webhook do Mercado Pago sem validação | Valida `x-signature` (HMAC SHA256) e revoga o acesso em estorno, contestação e cancelamento. |
| `/api/ficha` aceitava `userId` do corpo | Lê e grava sempre a ficha do usuário do token. |
| `/api/consultor` sem autenticação nem limite | Exige login e tem limite de 20 perguntas por minuto por usuária. Modelo Gemini corrigido (`gemini-2.5-flash`). |
| Gamificação contava errado | `lib/gamification.ts` só pontua quando o estado muda (fim do +20 pela mesma aula), a sequência usa `completed_at` e o nível é calculado a partir dos pontos. Restrição única em `lesson_progress`. |
| `/jornada/[id]` órfã e quebrada | Virou a página real do curso: capa, progresso, lista de aulas com concluir e assistir, tema claro/escuro. Linkada pelo modal "Ver detalhes e aulas" da home. |

## 2. O que ficou mais dinâmico

- **Progresso visível**: barra animada no topo da jornada ("3 de 10 aulas concluídas"), no card de cada curso, na página do curso e no planner ("3 de 5 tarefas de hoje").
- **Celebração**: confete + toast "+10 pontos" ao concluir uma aula, aviso de novo nível, e um modal de troféu ao fechar o curso com convite para contar na comunidade. Zerar a lista do planner também celebra.
- **Trilha de aulas**: timeline numerada com estados concluída / atual / pendente, busca de aulas, botões "Aula anterior / Próxima aula" e avanço automático para a próxima aula não concluída.
- **Pontos, sequência e nível**: no header (chip 🔥 5 · ⭐ 120), no perfil (painel com barra de XP) e em conquistas reais — 10 badges com estado bloqueado e barra de progresso ("Primeira aula", "Semana completa", "Curso concluído", "Marca definida"…).
- **Lyra**: respostas em Markdown formatado (nada de `**negrito**` cru), **streaming** palavra a palavra, histórico salvo por aluna (`lyra_messages`), botão "Nova conversa", e erros viram aviso em vez de entrarem no contexto da IA.
- **Diário de evolução**: seletor de humor com emojis e lista dos registros anteriores (antes a aluna escrevia e nunca mais via).
- **Planner**: agora no Supabase (`planner_tasks`) — sincroniza entre celular e computador, prazo com data real (com aviso de atraso), prioridade com campo e etiqueta, filtro por categoria, progresso do dia.
- **Dicas & Prompts**: vêm da tabela `tips` (editável, não precisa de deploy), com favoritos, "Copiar com minha marca" (usa a Ficha do Negócio) e "Enviar para a Lyra" com o prompt pronto. Busca vazia mostra empty state.
- **Ficha do Negócio**: auto-save com "salvo às 14:32", indicador "6 de 8 campos preenchidos", fecha com Esc e clique fora, e `@media print` para imprimir só a ficha. O botão só diz "salvo" quando o servidor confirma.
- **Cadastro**: mini-onboarding opcional (nome do negócio + segmento) que já inicia a Ficha, e botão de mostrar senha.
- **Navegação**: Lyra, Dicas, Planner, Ficha e Perfil agora aparecem no menu "Mais" da barra inferior. Header com voltar, avatar e estatísticas. Manifest + viewport: instala como app no celular.
- **Toasts e skeletons**: um `ToastProvider` global substituiu os três `alert()` e os banners espalhados; skeletons no lugar dos spinners de tela cheia.

## 3. Desempenho e organização

- **`SessionProvider`**: uma única leitura de sessão e perfil para o app inteiro. Antes eram 3 chamadas de autenticação e 3 consultas ao perfil (guard, tema e menu) a cada navegação, com spinner de tela cheia. O guard agora renderiza de forma otimista.
- **Fim do carregamento duplo** na jornada e no admin (os `useEffect` dependiam do estado que eles próprios definiam).
- **`lib/courses.ts`**: 6 consultas em paralelo em vez de sequenciais, e o progresso de cada curso conta só as aulas daquele curso (antes inflava o percentual).
- **Tema**: uma fonte de verdade — script no `<head>` aplica antes do primeiro paint e o provider sincroniza com o perfil já carregado. Fim do flash escuro→claro e da manipulação de `window.fetch`.
- **Ficha do Negócio deduplicada**: a lógica virou o hook `lib/useBusinessSheet.ts` e a página `/ficha` passou de ~700 linhas para 35 — ela renderiza o mesmo componente do modal.
- **Código morto removido**: `Hero`, `VideoSection`, `TechniqueCard`, `BehavioralExercise`, `RealChallenge` (conteúdo de outro produto), `MediaProtection` (bloqueava Ctrl+C/F12 sem proteger nada), rotas `api/lyra` e `api/consultora` (duplicadas) e a página `/escrita` (agora é redirect no `next.config.ts`).
- **`lib/roles.ts`**: fim do typo `'admim master'` em três lugares e do `email.includes('admin')` que dava painel de admin para qualquer e-mail com "admin".
- **`FeaturedLesson`**: `.maybeSingle()` no lugar de `.single()` — o console não enche mais de erro a cada aula não concluída.

## 4. Arquivos novos

`lib/apiAuth.ts` · `lib/checkout.ts` · `lib/roles.ts` · `lib/achievements.ts` · `lib/SessionContext.tsx` · `lib/useBusinessSheet.ts` · `components/ToastProvider.tsx` · `public/manifest.webmanifest` · `supabase/migrations/20260902180000_setup_completo.sql`
