import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { action } = body;

    let messages: { role: string; content: string }[] = [];
    let model = "google/gemini-3-flash-preview";

    if (action === "replace_mnemonic") {
      const { mnemonicInput } = body;
      messages = [
        {
          role: "system",
          content: `Você é o 'Mestre Mnemônico 2.0'. Gere APENAS UM objeto JSON para substituir um mnemônico que o usuário não gostou. 
Mantenha o mesmo nível de criatividade e o tema de: "${mnemonicInput}".
RETORNE APENAS: { "type": string, "text": string, "explanation": string, "tip": string }`,
        },
        { role: "user", content: `Gere uma nova alternativa para: "${mnemonicInput}"` },
      ];
    } else if (action === "generate_similar") {
      const { mnemonicInput, parentText } = body;
      messages = [
        {
          role: "system",
          content: `Você é o 'Mestre Mnemônico 2.0'. O usuário adorou este mnemônico: "${parentText}". 
Gere EXATAMENTE 3 NOVOS mnemônicos que sigam EXATAMENTE o mesmo estilo, tom e tema visual para o assunto: "${mnemonicInput}".
RETORNE APENAS UM ARRAY JSON de objetos com campos: type, text, explanation, tip.`,
        },
        { role: "user", content: `Baseado no estilo de "${parentText}", gere 3 semelhantes para "${mnemonicInput}"` },
      ];
    } else if (action === "generate_mnemonic") {
      const { rawInput, favoritesContext } = body;
      messages = [
        {
          role: "system",
          content: `Você é o 'Mestre Mnemônico 2.0', um cientista cognitivo e campeão mundial de memória.
Seu objetivo é criar associações técnicas de altíssima retenção.

DIRETRIZES DE OURO:
1. RECONHEÇA COMANDOS: O usuário fornece um Assunto + Instruções. Respeite sempre o tom pedido.
2. MAPEAMENTO OBRIGATÓRIO: Em fórmulas ou listas, cada palavra do mnemônico DEVE começar com a letra correspondente.
3. FORMATO DO TEXTO: Forneça apenas a frase da associação de forma limpa. NÃO use parênteses.${favoritesContext || ''}

ESTRUTURA DE RESPOSTA (JSON):
Retorne um array de 5 objetos:
{
  "type": string (categoria),
  "text": string (mnemônico limpo),
  "explanation": string,
  "tip": string
}`,
        },
        { role: "user", content: `Desafio de Memorização: "${rawInput}"` },
      ];
    } else if (action === "generate_curiosity") {
      const { prompt } = body;
      messages = [
        { role: "system", content: "Retorne APENAS JSON válido, sem markdown." },
        { role: "user", content: prompt },
      ];
    } else if (action === "generate_curiosity_image") {
      const { imagePrompt } = body;
      model = "google/gemini-3-pro-image-preview";
      messages = [
        { role: "user", content: `Ilustração digital 3D estilo Pixar, vibrant, NO TEXT: ${imagePrompt}` },
      ];
    } else if (action === "generate_motivation") {
      messages = [
        { role: "system", content: "Você gera frases motivacionais curtas e poderosas." },
        { role: "user", content: "Gere uma frase de motivação curta e poderosa para produtividade. Apenas a frase em português." },
      ];
    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar requisição de IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("study-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
