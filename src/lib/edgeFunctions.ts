/**
 * edgeFunctions.ts
 *
 * Chamadas diretas às APIs de IA:
 *   - SambaNova Cloud (Mnemônicos)
 *   - Google Gemini 1.5 Flash (Curiosidades - Texto)
 *   - Together AI / FLUX (Curiosidades - Imagem)
 *
 * Em DEV usa proxy do Vite. Em produção chama direto.
 */

// ---------------------------------------------------------------------------
// Configuração — SambaNova Cloud (Mnemônicos)
// ---------------------------------------------------------------------------
const SAMBA_API_KEY = import.meta.env.VITE_SAMBA_API_KEY || '';
const SAMBA_MODEL = 'Meta-Llama-3.1-8B-Instruct';
const SAMBA_ENDPOINT = import.meta.env.DEV
  ? '/api/samba/v1/chat/completions'
  : 'https://api.sambanova.ai/v1/chat/completions';

// ---------------------------------------------------------------------------
// Configuração — Google Gemini 1.5 Flash (Curiosidades Texto)
// ---------------------------------------------------------------------------
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-flash-lite-latest';
const GEMINI_ENDPOINT = import.meta.env.DEV
  ? `/api/gemini/v1beta/models/${GEMINI_MODEL}:generateContent`
  : `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;



// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export interface EdgeFunctionResponse<T = Record<string, unknown>> {
  data: T | null;
  error: Error | null;
}

export interface MnemonicResponse {
  content: string;
}

export interface CuriosityTextResponse {
  content: string;
}

export interface CuriosityImageResponse {
  imageUrl: string;
}

// ---------------------------------------------------------------------------
// 1. MNEMÔNICOS — SambaNova Cloud
// ---------------------------------------------------------------------------
function buildMnemonicMessages(
  action: string,
  params: Record<string, unknown>
): { role: string; content: string }[] {
  if (action === 'generate_mnemonic') {
    const { rawInput, favoritesContext = '' } = params;
    return [
      {
        role: 'system',
        content: 'Você é um especialista em mnemônicos e técnicas de memorização. Crie mnemônicos criativos e eficazes em português brasileiro. Responda APENAS em JSON puro.',
      },
      {
        role: 'user',
        content: `Crie 3 mnemônicos diferentes e criativos para memorizar o seguinte conteúdo:\n"${rawInput}"\n${favoritesContext}\n\nRetorne um array JSON com 3 objetos, cada um com:\n- "type": tipo do mnemônico (ex: "Frase Narrativa", "Acrônimo", "Imagem Visual", "Rima ou Música")\n- "text": o mnemônico em si (curto e impactante)\n- "explanation": explicação de como ele ajuda a memorizar o conteúdo\n- "tip": dica de como fixar ainda mais na memória\n\nFormato:\n[\n  { "type": "...", "text": "...", "explanation": "...", "tip": "..." }\n]`,
      },
    ];
  }

  if (action === 'replace_mnemonic') {
    const { mnemonicInput } = params;
    return [
      {
        role: 'system',
        content: 'Você é um especialista em mnemônicos. Crie um mnemônico alternativo criativo. Responda APENAS em JSON puro.',
      },
      {
        role: 'user',
        content: `Crie 1 novo mnemônico para memorizar: "${mnemonicInput}"\n\nRetorne um único objeto JSON:\n{ "type": "...", "text": "...", "explanation": "...", "tip": "..." }`,
      },
    ];
  }

  if (action === 'generate_similar') {
    const { mnemonicInput, parentText } = params;
    return [
      {
        role: 'system',
        content: 'Você é um especialista em mnemônicos. Crie variações criativas de um mnemônico existente. Responda APENAS em JSON puro.',
      },
      {
        role: 'user',
        content: `Com base no mnemônico "${parentText}" para o conteúdo "${mnemonicInput}", crie 2 mnemônicos semelhantes mas com abordagens diferentes.\n\nRetorne um array JSON:\n[\n  { "id": "sim1", "type": "...", "text": "...", "explanation": "..." },\n  { "id": "sim2", "type": "...", "text": "...", "explanation": "..." }\n]`,
      },
    ];
  }

  return [];
}

export async function generateMnemonic(
  action: 'generate_mnemonic' | 'replace_mnemonic' | 'generate_similar',
  params: Record<string, unknown> = {}
): Promise<EdgeFunctionResponse<MnemonicResponse>> {
  if (!SAMBA_API_KEY) {
    return { data: null, error: new Error('VITE_SAMBA_API_KEY não configurada.') };
  }

  try {
    const messages = buildMnemonicMessages(action, params);

    const response = await fetch(SAMBA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SAMBA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: SAMBA_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      let errorMsg = `SambaNova API error ${response.status}`;
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
    console.error('[SambaNova] Erro:', error.message);
    return { data: null, error };
  }
}

// ---------------------------------------------------------------------------
// 2. CURIOSIDADE TEXTO — Google Gemini 1.5 Flash
// ---------------------------------------------------------------------------
export async function generateCuriosityText(
  prompt: string
): Promise<EdgeFunctionResponse<CuriosityTextResponse>> {
  if (!GEMINI_API_KEY) {
    return { data: null, error: new Error('VITE_GEMINI_API_KEY não configurada.') };
  }

  try {
    const url = `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => `HTTP ${response.status}`);
      let errorMsg = `Gemini API error ${response.status}`;
      try {
        const parsed = JSON.parse(errorText);
        errorMsg = parsed?.error?.message || errorMsg;
      } catch {
        errorMsg = errorText || errorMsg;
      }
      throw new Error(errorMsg);
    }

    const json = await response.json();
    const content: string = json.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return { data: { content }, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[Gemini] Erro:', error.message);
    return { data: null, error };
  }
}

// ---------------------------------------------------------------------------
// 3. CURIOSIDADE IMAGEM — Together AI (FLUX)
// ---------------------------------------------------------------------------
export async function generateCuriosityImage(
  imagePrompt: string
): Promise<EdgeFunctionResponse<CuriosityImageResponse>> {
  try {
    // Usando Pollinations.ai (100% Gratuito)
    // Filtro robusto para o prompt
    const cleanPrompt = imagePrompt
      .replace(/[^a-zA-Z0-9\s]/g, '') 
      .replace(/\s+/g, ' ')
      .substring(0, 100)
      .trim();
      
    const encodedPrompt = encodeURIComponent(cleanPrompt);
    
    // Forçamos o uso do proxy do Vite para evitar CORS e OpaqueResponseBlocking
    // A requisição parte do seu próprio localhost para o servidor interno do Vite
    const proxyUrl = `/api/pollinations/prompt/${encodedPrompt}?width=512&height=512&nologo=true`;

    // Baixamos a imagem em formato Blob blindado
    const imgResponse = await fetch(proxyUrl);
    if (!imgResponse.ok) {
      throw new Error(`Proxy error: ${imgResponse.status}`);
    }
    
    const blob = await imgResponse.blob();
    const objectUrl = URL.createObjectURL(blob); // Transforma num link "blob:http://localhost:8080/..."

    return { data: { imageUrl: objectUrl }, error: null };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[Image Generation] Erro:', error.message);
    return { data: null, error };
  }
}
