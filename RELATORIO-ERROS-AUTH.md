# Relatório — erros de acesso (login) e criação de conta

Repositório analisado: `Nicevargas/curso-online` (commit `70134ec`, 01/09/2026).

## Erro 1 (crítico) — Login e cadastro não conseguem falar com o Supabase no navegador

**Onde:** `lib/supabase.ts` (introduzido no último commit, "migrate Supabase env variables to private").

**O que acontece:** esse arquivo é importado por páginas `'use client'` (`/login`, `/cadastro`, `SubscriptionGuard`, `BottomNav`, `perfil`, etc.). No Next.js, o navegador só recebe variáveis que começam com `NEXT_PUBLIC_`. Ao trocar para `SUPABASE_URL` / `SUPABASE_ANON_KEY` sem mapeá-las no `next.config.ts`, no bundle do cliente essas variáveis viram `undefined` e o app cai no fallback `https://placeholder.supabase.co`. Resultado: `signInWithPassword` e `getUser()` falham com "Failed to fetch", e o login-automático após cadastro também falha (a conta até é criada pelo `/api/auth/cadastro`, que roda no servidor, mas a usuária não consegue entrar).

**Confirmação:** compilei o projeto com `SUPABASE_URL=https://abc.supabase.co` — o bundle em `.next/static` só contém `placeholder.supabase.co`. Com `NEXT_PUBLIC_SUPABASE_URL`, a URL real aparece no bundle.

**Correção aplicada:** o código passa a usar somente os três nomes cadastrados na Vercel — `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` (a Vercel pediu para remover o prefixo `NEXT_PUBLIC_`). Como o navegador não enxerga variáveis sem esse prefixo, o `next.config.ts` agora tem um bloco `env` que injeta apenas `SUPABASE_URL` e `SUPABASE_ANON_KEY` no bundle do cliente (as duas são públicas por design; a segurança vem do RLS). A `SUPABASE_SERVICE_ROLE_KEY` fica só no servidor. `lib/supabaseServer.ts` foi simplificado para ler exatamente esses nomes, sem a lista de apelidos. Verificado no build: URL e anon key aparecem no bundle do navegador, a service role não. **Ação sua:** manter na Vercel só essas três variáveis (pode apagar as `NEXT_PUBLIC_*`) e fazer um novo deploy.

## Erro 2 — "Database error saving new user" / perfil não criado

**Onde:** banco Supabase, trigger `on_auth_user_created` → `public.handle_new_user()`.

**O que acontece:** nenhuma migration do repositório cria a tabela `profiles` nem suas políticas RLS — as migrations só fazem `ALTER TABLE profiles ADD COLUMN`. Se a tabela/colunas não batem com o INSERT do trigger, ou se a função não encontra `public.profiles` no `search_path` (o trigger roda como `supabase_auth_admin`), o `auth.admin.createUser` retorna exatamente "Database error saving new user". O arquivo `supabase/migrations/fix_handle_new_user_trigger.sql` corrige isso, mas não tem timestamp no nome, então o `supabase db push` o ignora — ele só funciona se for colado manualmente no SQL Editor. Além disso, o `EXCEPTION WHEN OTHERS THEN RETURN NEW` engole o erro sem registrar nada, o que dificulta o diagnóstico.

**Correção aplicada:** nova migration `20260901150000_fix_profiles_table_rls_and_trigger.sql`, idempotente: cria `profiles` se não existir, garante todas as colunas usadas pelo app (`avatar_url`, `journey_id`, `theme`, `plan_expires_at`…), recria a função com `SET search_path = public` e `RAISE WARNING` em caso de falha (aparece em Logs → Postgres), e recria o trigger. **Ação sua:** rodar `supabase db push` ou colar o SQL no SQL Editor do painel.

## Erro 3 — Perfil não é criado/atualizado a partir do navegador (RLS)

**Onde:** `components/SubscriptionGuard.tsx` (self-heal `upsert`), `app/perfil/page.tsx` (update), `lib/ThemeContext.tsx` (update de tema), `lib/gamification.ts`.

**O que acontece:** esses componentes escrevem em `profiles` com a anon key + sessão da usuária. Sem políticas RLS de `INSERT`/`UPDATE` em `profiles` (não existem no repositório), o Supabase devolve `new row violates row-level security policy` e o código só faz `console.warn`, então a usuária entra mas fica sem perfil, sem plano de 7 dias e o `SubscriptionGuard` pode bloquear o acesso.

**Correção aplicada:** a mesma migration acima cria as políticas `profiles_select_own`, `profiles_insert_own`, `profiles_update_own` e uma de leitura pública (necessária porque `/comunidade` lista nome e avatar de outros usuários — remova `profiles_select_public` se preferir não expor nomes).

## Erro 4 (menor) — Mensagens de erro na tela de login

**Onde:** `app/login/page.tsx`.

- O `finally` lia a variável `error` da closure antiga, então o `status` ("Verificando credenciais...") podia ficar na tela junto com a mensagem de erro.
- Ao voltar do cadastro com `/login?cadastrado=true`, a página ignorava o parâmetro e não mostrava nada.
- "Failed to fetch" (o sintoma do Erro 1) aparecia sem explicação.

**Correção aplicada:** status é limpo no `catch`, mensagem "Conta criada! Entre com seu e-mail e senha." quando `cadastrado=true` (com `Suspense`, exigido pelo `useSearchParams`), e mensagem clara quando não há conexão com o Supabase.

## Pontos de atenção que não mudei

- Se em **Authentication → Providers → Email** a opção "Confirm email" estiver ligada e a `SUPABASE_SERVICE_ROLE_KEY` não estiver configurada no servidor, o `/api/auth/cadastro` cai no fallback `signUp` e a conta fica pendente de confirmação — a usuária vê "Email not confirmed" ao logar. Com a Service Role configurada, o cadastro usa `email_confirm: true` e isso não acontece.
- Verifiquei que o projeto compila com as correções (`next build` OK, 24 páginas).

## Arquivos alterados

- `next.config.ts` — bloco `env` expondo URL e anon key ao navegador
- `lib/supabase.ts` e `lib/supabaseServer.ts` — somente `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `.env.example` — nomes corretos e comentários
- `app/login/page.tsx` — mensagens de erro / `?cadastrado=true`
- `supabase/migrations/20260901150000_fix_profiles_table_rls_and_trigger.sql` — novo
