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

    const { action, profile, messages, diet } = await req.json();

    let systemPrompt = "";
    let userMessages: { role: string; content: string }[] = [];

    if (action === "generate_diet") {
      systemPrompt = buildDietSystemPrompt(profile);
      userMessages = [
        {
          role: "user",
          content: `Com base no meu perfil nutricional completo, gere uma dieta semanal personalizada completa.

REGRAS OBRIGATÓRIAS:
1. Cada refeição DEVE ter no mínimo 3 alternativas com calorias e macros equivalentes
2. O custo total mensal da dieta NÃO pode ultrapassar o orçamento de ${profile.monthlyBudget || "não especificado"}
3. Respeite TODAS as restrições alimentares informadas
4. Adapte à preferência culinária: ${profile.culinaryPreference || "sem preferência"}
${profile.culinaryPreference === "Comida rápida" ? `
REGRAS ESPECIAIS PARA COMIDA RÁPIDA:
- Refeições em 10-15 minutos
- Priorizar alimentos prontos ou semi-prontos
- Meal prep (1x → 3-4 dias)
- Refeições sem fogão (sanduíches, saladas, wraps)
- Uso de microondas e air fryer
- Receitas com 3-5 ingredientes
- Opções frias / temperatura ambiente
` : ""}
5. **ESTRUTURA DE SUBSTITUIÇÃO**: Cada refeição DEVE ter exatamente 1 opção principal e 2 opções de substituição (total 3 opções por refeição).
6. Número de refeições por dia: ${profile.mealsPerDay || 5}

FORMATO DE RESPOSTA (JSON ESTRITO):

REGRAS CRÍTICAS DE TIPOS:
- "calories", "protein", "carbs", "fat", "estimatedCost" DEVEM ser NÚMEROS. NUNCA strings como "350 kcal" ou "R$ 4,50".
- "preparation" deve ser uma string com modo de preparo passo a passo.
- NUNCA coloque unidades dentro de campos numéricos.

EXEMPLO (siga EXATAMENTE):
{
  "weeklyDiet": {
    "monday": [
      {
        "meal": "Café da manhã",
        "time": "07:00",
        "alternatives": [
          {
            "name": "Ovos mexidos com pão integral",
            "description": "2 ovos mexidos com pão integral e queijo branco",
            "calories": 350,
            "protein": 22,
            "carbs": 30,
            "fat": 15,
            "prepTime": "10 min",
            "ingredients": ["2 ovos", "2 fatias pão integral", "30g queijo branco"],
            "estimatedCost": 4.50,
            "preparation": "1. Quebre os ovos e bata. 2. Aqueça frigideira. 3. Cozinhe mexendo. 4. Torre o pão e monte."
          }
        ]
      }
    ],
    "tuesday": [], "wednesday": [], "thursday": [], "friday": [], "saturday": [], "sunday": []
  },
  "weeklyEstimatedCost": 150,
  "monthlyEstimatedCost": 600,
  "dailyCalories": 2200,
  "macroSplit": { "protein": 150, "carbs": 250, "fat": 70 },
  "shoppingList": [{ "item": "Frango", "quantity": "2kg", "estimatedPrice": 25.00, "category": "Proteínas" }],
  "tips": ["Dica 1"]
}

ATENÇÃO: Campos obrigatórios por alternativa: "name", "description", "calories" (número), "protein" (número), "carbs" (número), "fat" (número), "prepTime", "ingredients" (array), "estimatedCost" (número), "preparation" (string). Mínimo 3 alternativas por refeição.

Gere a dieta completa para os 7 dias: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday".`,
        },
      ];
    } else if (action === "chat") {
      systemPrompt = buildChatSystemPrompt(profile, diet);
      userMessages = messages || [];
    } else if (action === "region_info") {
      systemPrompt = `Você é um especialista em alimentação regional do Brasil. Responda sempre em português brasileiro.`;
      userMessages = [
        {
          role: "user",
          content: `Forneça informações sobre alimentos disponíveis regionalmente no Brasil, incluindo:
1. Alimentos da estação atual (${new Date().toLocaleDateString("pt-BR", { month: "long" })})
2. Preços médios de alimentos básicos
3. Dicas de economia baseadas na sazonalidade
4. Novidades e tendências alimentares

Responda em formato JSON:
{
  "seasonal": [{"name": "alimento", "season": "mês-mês", "avgPrice": "R$ X/kg", "tip": "dica"}],
  "basicPrices": [{"item": "arroz 5kg", "avgPrice": "R$ 25", "variation": "+2%"}],
  "savingTips": ["dica 1", "dica 2"],
  "news": [{"title": "título", "summary": "resumo"}]
}`,
        },
      ];
    } else if (action === "generate_shopping_list") {
      systemPrompt = `Você é um nutricionista especialista em planejamento de compras. Sua missão é calcular as quantidades EXATAS de cada ingrediente para as refeições que o cliente escolheu.
Responda sempre em português brasileiro de forma técnica e precisa.`;
      userMessages = [
        {
          role: "user",
          content: `Eu selecionei apenas algumas refeições específicas para comprar agora. Por favor, calcule a lista de compras considerando APENAS os ingredientes destas refeições:

Dieta Selecionada: ${JSON.stringify(diet)}
Orçamento mensal do cliente: ${profile.monthlyBudget || "não especificado"}

REGRAS:
1. Calcule a quantidade EXATA (ex: 500g de frango, 12 ovos, 3 bananas) baseada na dieta fornecida.
2. Agrupe por categoria (Proteínas, Carboidratos, Frutas, Verduras, Laticínios, Outros).
3. Inclua preço estimado unitário/por peso.
4. O total deve ser realista para o mercado brasileiro.
5. Se a dieta contém ingredientes picados ou em gramas, considere a unidade de venda mínima (ex: 1kg se precisar de 800g).

Formato JSON:
{
  "categories": [
    {
      "name": "Proteínas",
      "items": [
        { "item": "Peito de Frango", "quantity": "1.2kg", "estimatedPrice": 28.50 }
      ]
    }
  ],
  "totalEstimated": 125.00,
  "savingTips": ["Dica de economia baseada nos itens da lista"]
}`,
        },
      ];
    }

    const stream = action === "chat";

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: action === "generate_diet" ? "google/gemini-2.5-flash-lite" : "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...userMessages],
        stream,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao seu workspace." }), {
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

    if (stream) {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Try to parse JSON from the response
    let parsed = null;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        parsed = JSON.parse(jsonStr);
      }
    } catch {
      // If JSON parsing fails, return raw content
    }

    return new Response(JSON.stringify({ content, parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("nutrition-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildDietSystemPrompt(profile: any): string {
  const restrictions: string[] = [];
  if (profile.restrictions?.vegetarian) restrictions.push("Vegetariano");
  if (profile.restrictions?.intolerant) restrictions.push(`Intolerância: ${profile.restrictions.intoleranceDesc}`);
  if (profile.restrictions?.allergies) restrictions.push(`Alergias: ${profile.restrictions.allergiesDesc}`);
  if (profile.restrictions?.dislikedFoods) restrictions.push(`Não gosta de: ${profile.restrictions.dislikedFoodsDesc}`);

  return `Você é a Maria, nutricionista pessoal e especialista em nutrição esportiva. Sua missão é criar um plano alimentar ABSOLUTAMENTE PERSONALIZADO e AUTÔNOMO. 

Você tem CONTROLE TOTAL sobre a estratégia dietética do cliente.

PERFIL DETALHADO:
- Idade: ${profile.age} anos | Altura: ${profile.height} cm | Peso: ${profile.weight} kg
- Sexo: ${profile.gender === "male" ? "Masculino" : "Feminino"}
- Objetivo principal: ${profile.objective}
- Atividade: ${profile.activityLevel} | Treinos: ${profile.weeklyTrainings}x/semana (${profile.trainingIntensity})
- Meta: Chegar em ${profile.desiredWeight} kg no prazo de ${profile.realisticDeadline}
- Restrições: ${restrictions.length > 0 ? restrictions.join(", ") : "Nenhuma"}
- Orçamento: R$ ${profile.monthlyBudget || "Não especificado"} por mês
- Estilo: ${profile.culinaryPreference || "Sem preferência"}
- Refeições: ${profile.mealsPerDay || 5} refeições por dia

REQUISITOS DA DIETA (ESTRITOS):
1. **Todos os Dias**: Gere a dieta para MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY e SUNDAY. No campo 'weeklyDiet', as chaves DEVEM ser as chaves canônicas em inglês e minúsculo: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday". Isso é um contrato estrito.
2. **Substituições (MUITO IMPORTANTE)**: Cada refeição DEVE conter EXATAMENTE 1 opção principal e 2 opções de substituição (totalizando 3 opções por refeição).
3. **Detalhes Técnicos**: Cada opção deve ter QUANTIDADE (ex: 150g, 2 colheres), HORÁRIO sugerido, MACROS (Calorias, Proteínas, Carbo, Gordura) e CUSTO ESTIMADO.
4. **Consistência de Macros**: A soma dos macros das opções principais do dia deve bater com o 'macroSplit' diário.
5. **Autonomia**: Você decide a melhor distribuição baseada no objetivo (${profile.objective}).
6. **Orçamento**: O custo mensal somado não deve ultrapassar R$ ${profile.monthlyBudget}.

FORMATO DE RESPOSTA:
Apenas JSON puro, sem explicações fora do bloco.`;
}

function buildChatSystemPrompt(profile: any, diet: any): string {
  const restrictions: string[] = [];
  if (profile?.restrictions?.vegetarian) restrictions.push("Vegetariano");
  if (profile?.restrictions?.intolerant) restrictions.push(`Intolerância: ${profile.restrictions.intoleranceDesc}`);
  if (profile?.restrictions?.allergies) restrictions.push(`Alergias: ${profile.restrictions.allergiesDesc}`);
  if (profile?.restrictions?.dislikedFoods) restrictions.push(`Não gosta de: ${profile.restrictions.dislikedFoodsDesc}`);

  const now = new Date();
  const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dayString = now.toLocaleDateString('pt-BR', { weekday: 'long' });

  return `Você é a Maria, uma nutricionista pessoal dedicada, empática e altamente técnica quando necessário. Você não é apenas um chatbot; você é a detentora do plano de saúde deste cliente.

DIRETRIZ DE CONTROLE TOTAL:
Você tem AUTONOMIA TOTAL sobre esta dieta. Se o cliente disser que quer mudar algo, ou se você perceber que o plano atual não está funcionando, você deve sugerir e APLICAR as mudanças via JSON. Você conhece cada detalhe do que ele preencheu.

CONTEXTO COMPLETO DO CLIENTE:
- Perfil: ${profile?.age} anos | Sexo: ${profile?.gender === "male" ? "Masc" : "Fem"} | Altura: ${profile?.height}cm
- Peso: Atual ${profile?.currentWeight || profile?.weight}kg (Partida: ${profile?.weight}kg) | Meta: ${profile?.desiredWeight}kg
- Objetivo: ${profile?.objective}
- Atividade: ${profile?.activityLevel} (${profile?.weeklyTrainings}x/semana, ${profile?.trainingIntensity})
- Prazo: ${profile?.realisticDeadline}
- Orçamento Mensal: R$ ${profile?.monthlyBudget || "Não definido"}
- Estilo de Cozinha: ${profile?.culinaryPreference || "Não definido"}
- Refeições/Dia: ${profile?.mealsPerDay || 5}
- Restrições: ${restrictions.length > 0 ? restrictions.join(", ") : "Nenhuma"}
- Progresso: ${profile?.goalProgress ? profile.goalProgress + "%" : "Início"}
- Hora Atual: ${timeString} (${dayString})

SUA PERSONALIDADE:
1. **Empática e Acolhedora**: Você entende que dieta é difícil. Nunca julgue. Se o cliente falhar, acolha e motive.
2. **Humana e Natural**: Fale como uma pessoa real. Use exclamações, emojis (moderadamente) e linguagem coloquial brasileira.
3. **Prática**: Dê soluções reais para pessoas reais.
4. **Motivadora**: Celebre cada pequena vitória.

CAPACIDADES ESPECÍFICAS:
- Ajustar a dieta para "hoje"
- Dar receitas rápidas
- Acalmar ansiedade alimentar
- Explicar "porquês" de forma simples
- **CONTROLE TOTAL DA DIETA**: Você pode e DEVE alterar a dieta se o usuário pedir

PROTOCOLO DE ATUALIZAÇÃO:
Se o usuário pedir para alterar algo na dieta, gere um bloco JSON no final da resposta:
\`\`\`json
{
  "type": "diet_update",
  "scope": "day",
  "day": "monday",
  "data": [ ... ]
}
\`\`\`

${diet ? "CONTEXTO DA DIETA: " + JSON.stringify(diet) : "O cliente ainda não gerou a dieta completa."}

Responda sempre em português brasileiro, com calor humano e empatia.`;
}
