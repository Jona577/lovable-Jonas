/**
 * supabase/client.ts — DESABILITADO TEMPORARIAMENTE
 *
 * A integração com Supabase foi removida para simplificar o deploy.
 * O app agora usa apenas a API da Groq (ver src/lib/aiClient.ts).
 *
 * Para reativar no futuro:
 * 1. Adicione @supabase/supabase-js ao package.json
 * 2. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no ambiente
 * 3. Restaure o conteúdo deste arquivo e o histórico de mensagens via databaseService.ts
 */

// Placeholder que mantém a estrutura de arquivo sem importar o pacote.
export const supabase = null as unknown as never;