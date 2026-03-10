/**
 * aiClient.ts
 *
 * Integração direta com a API da Groq (modelos Llama).
 * Utiliza o endpoint compatível com OpenAI via proxy Vite (dev) ou direto (produção).
 *
 * Configuração:
 *   VITE_GROQ_API_KEY=sua_chave_aqui  (no arquivo .env ou variável de ambiente no Vercel)
 *
 * Uso:
 *   import { generateAIResponse } from '@/lib/aiClient';
 *   const resposta = await generateAIResponse({ action: 'generate_mnemonic', rawInput: 'P.V=N.R.T' });
 *
 * Preparado para futura integração com banco de dados:
 *   O módulo /services/databaseService.ts poderá ser criado para persistência do histórico.
 */

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';
const GROQ_MODEL = 'llama3-70b-8192';

// Detecta se está rodando no dev server (proxy Vite ativo) ou em produção
const GROQ_ENDPOINT = import.meta.env.DEV
  ? '/api/groq/openai/v1/chat/completions'
  : 'https://api.groq.com/openai/v1/chat/completions';

// Verifica chave no carregamento do módulo
if (!import.meta.env.VITE_GROQ_API_KEY) {
  console.error(
    '[aiClient] ⚠️  VITE_GROQ_API_KEY não está configurada.\n' +
    'Por favor, adicione VITE_GROQ_API_KEY ao seu arquivo .env ou ' +
    'nas variáveis de ambiente do Vercel antes de usar as funcionalidades de IA.'
  );
}

// ---------------------------------------------------------------------------
// Tipos internos para as ações do study-ai
// ---------------------------------------------------------------------------
export interface AIRequestBody {
  action: string;
  [key: string]: unknown;
}

export interface AIResponseData {
  content: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Construtores de prompt por action
// ---------------------------------------------------------------------------
function buildMessages(body: AIRequestBody): { role: string; content: string }[] {
  const { action } = body;

  // --- Mnemônico ---
  if (action === 'generate_mnemonic') {
    const { rawInput, favoritesContext = '' } = body as any;
    return [
      {
        role: 'system',
        content:
          'Você é um especialista em mnemônicos e técnicas de memorização. Crie mnemônicos criativos e eficazes em português brasileiro. Responda APENAS em JSON puro.',
      },
      {
        role: 'user',
        content: `Crie 3 mnemônicos diferentes e criativos para memorizar o seguinte conteúdo:
"${rawInput}"
${favoritesContext}

Retorne um array JSON com 3 objetos, cada um com:
- "type": tipo do mnemônico (ex: "Frase Narrativa", "Acrônimo", "Imagem Visual", "Rima ou Música")
- "text": o mnemônico em si (curto e impactante)
- "explanation": explicação de como ele ajuda a memorizar o conteúdo
- "tip": dica de como fixar ainda mais na memória

Formato:
[
  { "type": "...", "text": "...", "explanation": "...", "tip": "..." }
]`,
      },
    ];
  }

  // --- Substituir mnemônico ---
  if (action === 'replace_mnemonic') {
    const { mnemonicInput } = body as any;
    return [
      {
        role: 'system',
        content: 'Você é um especialista em mnemônicos. Crie um mnemônico alternativo criativo. Responda APENAS em JSON puro.',
      },
      {
        role: 'user',
        content: `Crie 1 novo mnemônico para memorizar: "${mnemonicInput}"

Retorne um único objeto JSON:
{ "type": "...", "text": "...", "explanation": "...", "tip": "..." }`,
      },
    ];
  }

  // --- Gerar mnemônicos semelhantes ---
  if (action === 'generate_similar') {
    const { mnemonicInput, parentText } = body as any;
    return [
      {
        role: 'system',
        content: 'Você é um especialista em mnemônicos. Crie variações criativas de um mnemônico existente. Responda APENAS em JSON puro.',
      },
      {
        role: 'user',
        content: `Com base no mnemônico "${parentText}" para o conteúdo "${mnemonicInput}", crie 2 mnemônicos semelhantes mas com abordagens diferentes.

Retorne um array JSON:
[
  { "id": "sim1", "type": "...", "text": "...", "explanation": "..." },
  { "id": "sim2", "type": "...", "text": "...", "explanation": "..." }
]`,
      },
    ];
  }

  // --- Curiosidade científica ---
  if (action === 'generate_curiosity') {
    const { prompt } = body as any;
    return [
      {
        role: 'system',
        content:
          'Você é uma autoridade científica. Responda APENAS em JSON puro, sem texto adicional.',
      },
      { role: 'user', content: prompt },
    ];
  }

  // --- Imagem de curiosidade (ignorada nesta versão — retorna vazio) ---
  if (action === 'generate_curiosity_image') {
    return [
      { role: 'system', content: 'Responda apenas: {}' },
      { role: 'user', content: '{}' },
    ];
  }

  // --- Motivação ---
  if (action === 'generate_motivation') {
    return [
      {
        role: 'system',
        content:
          'Você é um coach motivacional brasileiro de alto desempenho. Responda de forma direta, poderosa e inspiradora, em português do Brasil. Sem emojis.',
      },
      {
        role: 'user',
        content:
          'Gere UMA frase motivacional única, profunda e impactante para alguém que está estudando e buscando se superar. A frase deve ser curta (máximo 2 linhas), original e que desperte ação imediata. Retorne APENAS a frase, sem aspas, sem explicação.',
      },
    ];
  }

  // --- Fallback genérico ---
  return [
    { role: 'system', content: 'Você é um assistente inteligente. Responda em português do Brasil.' },
    { role: 'user', content: JSON.stringify(body) },
  ];
}

// ---------------------------------------------------------------------------
// Função principal — equivalente ao supabase.functions.invoke('study-ai', ...)
// ---------------------------------------------------------------------------
/**
 * Envia uma requisição para a API da Groq e retorna { data, error }
 * simulando o formato que era usado com `supabase.functions.invoke`.
 *
 * @example
 * const { data, error } = await generateAIResponse({ action: 'generate_mnemonic', rawInput: 'P.V=N.R.T' });
 * if (error) throw error;
 * const result = JSON.parse(data.content);
 */
export async function generateAIResponse(
  body: AIRequestBody
): Promise<{ data: AIResponseData | null; error: Error | null }> {
  if (!GROQ_API_KEY) {
    const msg =
      'VITE_GROQ_API_KEY não configurada. Adicione a chave Groq ao seu ambiente (.env ou Vercel).';
    console.error('[aiClient]', msg);
    return { data: null, error: new Error(msg) };
  }

  try {
    const messages = buildMessages(body);

    const response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      let errorMsg = `Groq API error ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed?.error?.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const content: string = json.choices?.[0]?.message?.content || '';

    return { data: { content }, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[aiClient] Erro ao chamar Groq:', error.message);
    return { data: null, error };
  }
}
