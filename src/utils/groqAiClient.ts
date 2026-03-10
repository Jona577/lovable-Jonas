// ── Helper: pre-calculate macros with Harris-Benedict ──
function calcMacros(profile: any): { dailyCalories: number; protein: number; carbs: number; fat: number; proteinPerMeal: number } {
  const weight = parseFloat(profile.weight) || 70;
  const height = parseFloat(profile.height) || 170;
  const age = parseInt(profile.age) || 25;
  const gender = profile.gender || 'male';
  const mealsPerDay = parseInt(profile.mealsPerDay) || 5;

  const bmr = gender === 'female'
    ? 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age)
    : 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);

  const activityMap: Record<string, number> = {
    'sedentario': 1.2, 'sedentário': 1.2, 'sedentary': 1.2,
    'leve': 1.375, 'light': 1.375, 'levemente ativo': 1.375,
    'moderado': 1.55, 'moderate': 1.55, 'moderadamente ativo': 1.55,
    'ativo': 1.725, 'active': 1.725, 'muito ativo': 1.725,
    'super ativo': 1.9, 'very active': 1.9, 'extremamente ativo': 1.9,
  };
  let actMult = activityMap[(profile.activityLevel || '').toLowerCase()] || 1.55;
  if ((profile.weeklyTrainings || 0) >= 5) actMult += 0.1;
  let tdee = bmr * actMult;

  const obj = (profile.objective || '').toLowerCase();
  let dailyCalories: number;
  if (obj.includes('emagrec') || obj.includes('perder') || obj.includes('secar') || obj.includes('definir')) {
    dailyCalories = Math.round(tdee * 0.80);
  } else if (obj.includes('ganhar') || obj.includes('massa') || obj.includes('hipertro') || obj.includes('bulk')) {
    dailyCalories = Math.round(tdee * 1.15);
  } else {
    dailyCalories = Math.round(tdee);
  }

  // 2g protein per kg of bodyweight — proven sports nutrition standard
  const protein = Math.round(weight * 2.0);
  const proteinCals = protein * 4;
  const fat = Math.round((dailyCalories * 0.25) / 9);
  const fatCals = fat * 9;
  const carbs = Math.round((dailyCalories - proteinCals - fatCals) / 4);
  const proteinPerMeal = Math.round(protein / mealsPerDay);

  return { dailyCalories, protein, carbs, fat, proteinPerMeal };
}

export const callGroq = async (body: any) => {
  const { action, profile, messages, diet } = body;
  let GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

  if (action === "chat" || action === "chat_nutri") {
    GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY_CHAT || import.meta.env.VITE_GROQ_API_KEY;
  } else if (action === "generate_diet" || action === "generate_shopping_list" || action === "apply_meal_change") {
    GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY_DIET || import.meta.env.VITE_GROQ_API_KEY;
  } else if (action === "region_info" || action === "generate_curiosity") {
    GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY_REGION || import.meta.env.VITE_GROQ_API_KEY;
  }

  let systemPrompt = "";
  let userMessages: { role: string; content: string }[] = [];

  if (action === "generate_diet") {
    const macros = calcMacros(profile);
    const mealsPerDay = parseInt(profile.mealsPerDay) || 5;

    systemPrompt = buildDietSystemPrompt(profile, macros);
    userMessages = [
      {
        role: "user",
        content: `Gere meu plano alimentar para o dia "monday" em JSON. O sistema replica para os demais dias automaticamente.

METAS DIÁRIAS:
- Calorias: ${macros.dailyCalories} kcal
- Proteína: ${macros.protein}g (OBRIGATÓRIO fechar esse valor somando as opções principais)
- Carboidratos: ${macros.carbs}g
- Gorduras: ${macros.fat}g
- Proteína mínima por refeição: ${macros.proteinPerMeal - 5}g

⚠️ REGRA CRÍTICA — NÚMERO DE REFEIÇÕES:
O array "monday" DEVE conter EXATAMENTE ${mealsPerDay} objetos de refeição. NÃO GERE MENOS QUE ${mealsPerDay} REFEIÇÕES.
Distribua as calorias e macros igualmente entre as ${mealsPerDay} refeições.
Horários sugeridos para ${mealsPerDay} refeições:
${mealsPerDay === 1 ? '  1. Almoço (12:00)' :
            mealsPerDay === 2 ? '  1. Café da manhã (07:00)\n  2. Almoço/Jantar (13:00)' :
              mealsPerDay === 3 ? '  1. Café da manhã (07:00)\n  2. Almoço (12:00)\n  3. Jantar (19:00)' :
                mealsPerDay === 4 ? '  1. Café da manhã (07:00)\n  2. Lanche da manhã (10:00)\n  3. Almoço (13:00)\n  4. Jantar (19:00)' :
                  mealsPerDay === 5 ? '  1. Café da manhã (07:00)\n  2. Lanche da manhã (10:00)\n  3. Almoço (13:00)\n  4. Lanche da tarde (16:00)\n  5. Jantar (19:30)' :
                    mealsPerDay === 6 ? '  1. Café da manhã (06:30)\n  2. Lanche da manhã (09:30)\n  3. Almoço (12:30)\n  4. Lanche da tarde (15:30)\n  5. Jantar (18:30)\n  6. Ceia (21:00)' :
                      `  ${mealsPerDay} refeições entre 06:30 e 22:00`}
VALIDAÇÃO OBRIGATÓRIA: Antes de encerrar o JSON, conte os itens do array monday. Se não totalizar ${mealsPerDay}, ADICIONE as refeições faltantes.

REGRAS:
1. Cada refeição: 1 opção principal + 5 substitutas (6 no total em "alternatives").
2. Toda alternativa deve ser refeição COMPLETA (proteína+carb+gordura). Fruta ou vegetal sozinho é INVÁLIDO.
3. Orçamento: R$ ${profile.monthlyBudget || 'sem limite'}/mês.
4. Restrições: ${profile.restrictions?.vegetarian ? 'Vegetariano. ' : ''}${profile.restrictions?.intolerant ? `Intolerância: ${profile.restrictions.intoleranceDesc}. ` : ''}${profile.restrictions?.allergies ? `Alergias: ${profile.restrictions.allergiesDesc}. ` : ''}${profile.restrictions?.dislikedFoods ? `Não gosta: ${profile.restrictions.dislikedFoodsDesc}.` : 'Nenhuma.'}
${profile.culinaryPreference === 'Comida rápida' ? '5. Preparo máximo 15min por refeição.\n' : ''}
MUITO IMPORTANTE:
- Nas DESCRIÇÕES ("description") e na lista de INGREDIENTES ("ingredients"), você DEVE colocar a QUANTIDADE EXATA usando sempre medida caseira seguida do peso/volume em gramas ou ml entre parênteses. Exemplo OBRIGATÓRIO: "1 colher de sopa cheia (15g)", "2 fatias médias (50g)", "1 xícara (200ml)".
- O campo "description" deve ser um resumo rápido de todos os itens e suas quantidades daquela refeição.
- O campo "preparation" (Modo de preparo) deve ser UM TEXTO LONGO E EXTREMAMENTE DETALHADO, focado em quem NUNCA cozinhou na vida. Deve conter no mínimo 4 ou 5 passos ricos em detalhes textuais (como ponto do fogo, temperos, texturas). Use OBRIGATORIAMENTE duas quebras de linha (\\n\\n) para separar visualmente um passo do outro. Exemplo: "Passo 1: ...\\n\\nPasso 2: ...\\n\\nPasso 3: ..."

FORMATO JSON — O ARRAY monday DEVE TER ${mealsPerDay} ITENS (campos numéricos devem ser NUMBER, nunca string):
{
  "weeklyDiet": {
    "monday": [
      { "meal": "Café da manhã", "time": "07:00", "alternatives": [
        { "name": "", "description": "Resumo c/ quantidades exatas", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prepTime": "", "ingredients": [], "estimatedCost": 0, "preparation": "Passo 1: ...\\n\\nPasso 2: ...", "micros": {} }
      ]},
      ${mealsPerDay >= 2 ? '{ "meal": "Lanche da manhã", "time": "10:00", "alternatives": [{ "name": "", "description": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prepTime": "", "ingredients": [], "estimatedCost": 0, "preparation": "", "micros": {} }] },' : ''}
      ${mealsPerDay >= 3 ? '{ "meal": "Almoço", "time": "13:00", "alternatives": [{ "name": "", "description": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prepTime": "", "ingredients": [], "estimatedCost": 0, "preparation": "", "micros": {} }] },' : ''}
      ${mealsPerDay >= 4 ? '{ "meal": "Lanche da tarde", "time": "16:00", "alternatives": [{ "name": "", "description": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prepTime": "", "ingredients": [], "estimatedCost": 0, "preparation": "", "micros": {} }] },' : ''}
      ${mealsPerDay >= 5 ? '{ "meal": "Jantar", "time": "19:30", "alternatives": [{ "name": "", "description": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prepTime": "", "ingredients": [], "estimatedCost": 0, "preparation": "", "micros": {} }] },' : ''}
      ${mealsPerDay >= 6 ? '{ "meal": "Ceia", "time": "21:00", "alternatives": [{ "name": "", "description": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prepTime": "", "ingredients": [], "estimatedCost": 0, "preparation": "", "micros": {} }] }' : ''}
    ],
    "tuesday": [], "wednesday": [], "thursday": [], "friday": [], "saturday": [], "sunday": []
  },
  "weeklyEstimatedCost": 0,
  "monthlyEstimatedCost": 0,
  "dailyCalories": ${macros.dailyCalories},
  "macroSplit": { "protein": ${macros.protein}, "carbs": ${macros.carbs}, "fat": ${macros.fat} },
  "shoppingList": [{ "item": "", "quantity": "", "estimatedPrice": 0, "category": "" }],
  "tips": []
}

RELEMBRANDO: O array monday deve ter EXATAMENTE ${mealsPerDay} refeições. Preparation deve ter quebras duplas (\\n\\n). micros no formato "Valor (Benefício)".`,
      },
    ];
  } else if (action === "chat") {
    systemPrompt = buildChatSystemPrompt(profile, diet);
    // Limit conversation history to last 8 messages to avoid TPM limit
    const allMsgs = messages || [];
    userMessages = allMsgs.slice(-8);
  } else if (action === "region_info") {
    systemPrompt = `Você é um especialista em alimentação regional do Brasil e economia doméstica. Responda sempre em português brasileiro de forma altamente detalhada e aprofundada.`;
    userMessages = [
      {
        role: "user",
        content: `Forneça informações DETALHADAS sobre alimentos disponíveis regionalmente no Brasil, incluindo:
1. Alimentos da estação atual (${new Date().toLocaleDateString("pt-BR", { month: "long" })}): liste pelo menos 6 alimentos, especificando os melhores, por que estão bons agora e como escolhê-los.
2. Preços médios de alimentos básicos: liste pelo menos 6 alimentos da cesta básica, com variação de preço esperada e como avaliar o custo-benefício.
3. Dicas de economia baseadas na sazonalidade: forneça pelo menos 5 dicas longas, aprofundadas e práticas para o dia a dia.
4. Novidades e tendências alimentares da região: gere pelo menos 4 resumos informativos e completos sobre tendências e curiosidades.

Responda em formato JSON rigoroso:
{
  "seasonal": [{"name": "alimento", "season": "mês-mês", "avgPrice": "R$ X/kg", "tip": "dica muito detalhada e longa sobre benefícios e como escolher"}],
  "basicPrices": [{"item": "arroz 5kg", "avgPrice": "R$ 25", "variation": "+2% (esperado cair no próximo mês)"}],
  "savingTips": ["Dica 1: parágrafo longo e muito explicativo", "Dica 2: parágrafo longo e muito explicativo"],
  "news": [{"title": "título chamativo", "summary": "resumo bastante aprofundado e rico em detalhes"}]
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
1. Calcule a quantidade baseada na dieta fornecida E ADICIONE UMA MARGEM DE ERRO/SEGURANÇA para que não falte nada (ex: se o cálculo der 400g de frango, peça 500g; se der 10 ovos, peça 1 dúzia).
2. Agrupe por categoria (Proteínas, Carboidratos, Frutas, Verduras, Laticínios, Outros).
3. Inclua preço estimado unitário/por peso.
4. O total deve ser realista para o mercado brasileiro.
5. Considere sempre a unidade de venda padrão comercial (ex: pacotes fechados de 1kg, 500g, dúzias) aplicando a margem de erro.

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
  } else if (action === "apply_meal_change") {
    // Uses conversation history to understand the agreed change, then generates updated meal JSON
    const { mealData, conversationSummary } = body;
    const macros = calcMacros(profile);
    systemPrompt = `Você é a Maria, nutricionista pessoal especialista em nutrição esportiva brasileira. Sua missão agora é EXECUTAR uma alteração de dieta que foi autorizada pelo cliente.
Responda APENAS em JSON puro, sem texto adicional.

PERFIL DO CLIENTE:
- Objetivo: ${profile.objective}
- Calorias diárias: ${macros.dailyCalories} kcal
- Restrições: ${profile.restrictions?.vegetarian ? 'Vegetariano. ' : ''}${profile.restrictions?.allergies ? 'Alergias: ' + profile.restrictions.allergiesDesc + '. ' : ''}${profile.restrictions?.dislikedFoods ? 'Não gosta: ' + profile.restrictions.dislikedFoodsDesc : ''}`;
    userMessages = [
      {
        role: "user",
        content: `O cliente pediu a seguinte alteração na refeição e CONFIRMOU a aplicação:

RESUMO DA CONVERSA: ${conversationSummary}

REFEIÇÃO ORIGINAL COMPLETA:
${JSON.stringify(mealData, null, 2)}

Sua tarefa:
1. Entenda qual foi a alteração acordada no resumo da conversa
2. Aplique a alteração no JSON da refeição
3. Mantenha os macros (calorias, proteína, carbs, gordura) o mais próximo possível dos valores originais (variação máxima de 15%)
4. Mantenha a mesma estrutura JSON com todos os campos. O campo preparation deve ser UM TEXTO MUITO MAIS LONGO E DETALHADO DO QUE O ORIGINAL, com no mínimo 4 ou 5 passos ricos, usando OBRIGATORIAMENTE duas quebras de linha (\\n\\n) entre os passos (Ex: Passo 1: ...\\n\\nPasso 2: ...). Nas DESCRIÇÕES e INGREDIENTES, coloque a QUANTIDADE EXATA usando sempre medida caseira seguida do peso/volume em parênteses.
5. Nas "alternatives", mantenha 6 opções (a principal alterada + 5 substituições coerentes)
6. Retorne APENAS o JSON da refeição atualizada, no formato exato:
{
  "meal": "${mealData?.meal || 'Refeição'}",
  "time": "${mealData?.time || '00:00'}",
  "alternatives": [
    { "name": "", "description": "", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "prepTime": "", "ingredients": [], "estimatedCost": 0, "preparation": "Passo 1: ...\\n\\nPasso 2: ...", "micros": {} }
  ]
}`,
      },
    ];
  }

  const stream = action === "chat";

  let GROQ_MODEL = "llama-3.3-70b-versatile";
  if (action === "chat") {
    GROQ_MODEL = "llama-3.1-8b-instant";
  } else if (action === "region_info") {
    GROQ_MODEL = "llama-3.1-8b-instant";
  } else if (action === "generate_shopping_list" || action === "apply_meal_change") {
    GROQ_MODEL = "llama-3.3-70b-versatile";
  }

  const response = await fetch("/api/groq/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...userMessages],
      stream,
      temperature: 0.4,
      max_completion_tokens: action === "chat" ? 1024 : 6000,
      response_format: action !== "chat" ? { type: "json_object" } : undefined,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Limite do Groq atingido. Tente novamente em instantes." }), { status: 429 });
    }
    const t = await response.text();
    console.error("Groq error:", response.status, t);
    let groqMsg = "";
    try { groqMsg = JSON.parse(t)?.error?.message || t; } catch { groqMsg = t; }
    return new Response(JSON.stringify({ error: `Erro Groq (${response.status}): ${groqMsg}` }), { status: 500 });
  }

  if (stream) {
    return response;
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "";

  let parsed = null;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        parsed = JSON.parse(jsonStr);
      }
    } catch {
      console.error("Failed to parse AI JSON response");
    }
  }

  // Replicar monday para os demais dias se a IA só gerou monday
  if (action === "generate_diet" && parsed?.weeklyDiet?.monday?.length > 0) {
    const defaultDays = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    defaultDays.forEach(day => {
      if (!parsed.weeklyDiet[day] || parsed.weeklyDiet[day].length === 0) {
        parsed.weeklyDiet[day] = JSON.parse(JSON.stringify(parsed.weeklyDiet.monday));
      }

      // Regra: Sábado e Domingo a partir da refeição 4 (índice 3) devem ser opções livros de "porcarias" com a mesma caloria.
      if (day === "saturday" || day === "sunday") {
        parsed.weeklyDiet[day].forEach((meal: any, index: number) => {
          if (index >= 3) {
            meal.meal += " (Livre)";
            meal.alternatives = meal.alternatives.map((alt: any, altIndex: number) => {
              const porcariasOptions = [
                { name: "Pizza (Refeição Livre)", desc: "Coma o que tiver vontade (ex: fatias de pizza), mas mantenha as calorias ao redor do alvo listado para manter o equilíbrio!" },
                { name: "Hambúrguer Artesanal", desc: "Aproveite um lanche gostoso. O segredo da constância é encaixar sua porcaria favorita nos macros da refeição livre!" },
                { name: "Sua Sobremesa Favorita", desc: "Aquele bolo trufado, açaí ou sorvete que você estava querendo. Respeite as calorias totais dessa refeição e seja feliz." },
                { name: "Sushi / Comida Japonesa", desc: "Sushi, temaki ou yakisoba para dar aquela variada deliciosa no fim de semana." },
                { name: "Porção de Frituras ou Salgados", desc: "Livre e sem culpa. A dieta funciona a longo prazo justamente porque tem espaço pra isso." },
                { name: "Refeição Flexível (O que quiser!)", desc: "Qualquer comida que você queira muito comer neste momento. Apenas mate sua vontade sem ultrapassar exageradamente do que está descrito aqui." }
              ];

              const junk = porcariasOptions[altIndex % porcariasOptions.length];
              return {
                ...alt,
                name: junk.name,
                description: junk.desc,
                prepTime: "Pronto ou Delivery",
                preparation: "Essa é sua refeição livre! Peça no delivery, saia para comer ou simplesmente coma algo que você ama sem se preocupar com preparos complexos.\\n\\nAproveite sem peso na consciência: o que engorda não é uma refeição livre no fds, mas sim a dieta irrestrita dos outros dias. Equilíbrio!",
                ingredients: ["Seu desejo do dia", "Liberdade", "Equilíbrio e Foco no longo prazo"],
                micros: {
                  "Saúde Mental": "100% (Previne extremismos)",
                  "Endorfina e Alegria": "Máxima (Para te dar forças de recomeçar a dieta na segunda)"
                }
              };
            });
          }
        });
      }
    });
  }

  return new Response(JSON.stringify({ content, parsed }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

function buildDietSystemPrompt(profile: any, macros?: { dailyCalories: number; protein: number; carbs: number; fat: number }): string {
  const restrictions: string[] = [];
  if (profile.restrictions?.vegetarian) restrictions.push("Vegetariano");
  if (profile.restrictions?.intolerant) restrictions.push(`Intolerância: ${profile.restrictions.intoleranceDesc}`);
  if (profile.restrictions?.allergies) restrictions.push(`Alergias: ${profile.restrictions.allergiesDesc}`);
  if (profile.restrictions?.dislikedFoods) restrictions.push(`Não gosta de: ${profile.restrictions.dislikedFoodsDesc}`);

  const m = macros || { dailyCalories: 2200, protein: 170, carbs: 220, fat: 60 };

  return `Você é a Maria, nutricionista pessoal e especialista em nutrição esportiva brasileira.

PERFIL DO CLIENTE:
- Idade: ${profile.age} anos | Altura: ${profile.height} cm | Peso: ${profile.weight} kg
- Sexo: ${profile.gender === "male" ? "Masculino" : "Feminino"}
- Objetivo: ${profile.objective}
- Atividade: ${profile.activityLevel} | ${profile.weeklyTrainings}x/semana (${profile.trainingIntensity})
- Meta: ${profile.desiredWeight} kg em ${profile.realisticDeadline}
- Restrições: ${restrictions.length > 0 ? restrictions.join(", ") : "Nenhuma"}
- Orçamento: R$ ${profile.monthlyBudget || "não especificado"}/mês
- Estilo culinário: ${profile.culinaryPreference || "Sem preferência"}
- Refeições/dia: ${profile.mealsPerDay || 5}

METAS CALCULADAS (Harris-Benedict + TDEE):
- Calorias: ${m.dailyCalories} kcal/dia
- Proteína: ${m.protein}g/dia  ← TARGET OBRIGATÓRIO
- Carboidratos: ${m.carbs}g/dia
- Gorduras: ${m.fat}g/dia

SUAS OBRIGAÇÕES COMO NUTRICIONISTA:
1. Criar refeições COMPLETAS e SUBSTANCIAIS — nunca uma fruta isolada como refeição.
2. Garantir que a soma dos macros das opções principais feche EXATAMENTE nos valores acima.
3. Usar ingredientes reais do mercado brasileiro com preços realistas.
4. Incluir modo de preparo passo a passo em cada alternativa.
5. Responder APENAS em JSON puro, sem texto adicional.`;
}

function buildChatSystemPrompt(profile: any, diet: any): string {
  const restrictions: string[] = [];
  if (profile?.restrictions?.vegetarian) restrictions.push("Vegetariano");
  if (profile?.restrictions?.intolerant) restrictions.push(`Intolerância: ${profile.restrictions.intoleranceDesc} `);
  if (profile?.restrictions?.allergies) restrictions.push(`Alergias: ${profile.restrictions.allergiesDesc} `);
  if (profile?.restrictions?.dislikedFoods) restrictions.push(`Não gosta de: ${profile.restrictions.dislikedFoodsDesc} `);

  const macros = calcMacros(profile);
  const now = new Date();
  const timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dayString = now.toLocaleDateString('pt-BR', { weekday: 'long' });

  return `Você é a Maria, uma nutricionista pessoal dedicada, empática e altamente técnica quando necessário. Você não é apenas um chatbot; você é a detentora do plano de saúde deste cliente.

DIRETRIZ DE ATENDIMENTO:
Você não é apenas um chatbot passageiro; você é a detentora do plano de saúde deste cliente. Responda de forma altamente inteligente, completa e detalhada.
Mantenha o FOCO TOTAL na pergunta do usuário. Não mude de assunto, não alucine informações e não fuja da pergunta inicial. Se aprofunde na explicação para mostrar autoridade no assunto.

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
- Metas nutricionais: ${macros.dailyCalories} kcal | ${macros.protein}g proteína | ${macros.carbs}g carbs | ${macros.fat}g gordura

SUA PERSONALIDADE:
1. **Inteligente e Aprofundada**: Nunca dê respostas curtas ou rasas. Explique o "porquê" científico por trás das suas afirmações.
2. **Foco e Precisão**: Responda estritamente à pergunta do cliente. Não fuja do assunto.
3. **Empática e Acolhedora**: Você entende que dieta é difícil. Nunca julgue.
4. **Humana e Natural**: Fale como uma pessoa real. Use excelência na comunicação. **NUNCA use emojis em suas respostas.**

CAPACIDADES ESPECÍFICAS:
- Dar dicas detalhadas e receitas.
- Explicar "porquês" de forma técnica e clara.
- Oferecer orientação psicológica para compulsão e ansiedade alimentar.
- **ALTERAÇÃO DE DIETA**: Se o cliente pedir para alterar, remover ou trocar algo da dieta (especialmente quando vier pela função "Mudar Algo"):
  1. Analise os dados completos da refeição que o cliente enviou.
  2. Proponha a alteração de forma detalhada: descreva o que mudaria, qual substituto usaria e o impacto nutricional (ex: "Trocaria o frango por atum. O atum tem perfil proteico similar com menos gordura saturada...").
  3. FINALIZE SEMPRE COM A PERGUNTA: "Posso aplicar essa alteração agora?"
  4. Quando o cliente confirmar com "SIM", "PODE", "CONFIRMO", "APLICA" ou similar, responda EXCLUSIVAMENTE com esta frase exata (sem mais nada): ALTERAÇÃO CONFIRMADA
  5. Não adicione nenhum texto além de "ALTERAÇÃO CONFIRMADA" quando o usuário confirmar — o sistema fará o resto automaticamente.

${diet ? `RESUMO DA DIETA (não repita isso ao usuário):
- Calorias/dia: ${diet.dailyCalories || '?'} kcal
- Macros: ${diet.macroSplit?.protein || '?'}g prot | ${diet.macroSplit?.carbs || '?'}g carbs | ${diet.macroSplit?.fat || '?'}g gord
- Refeições hoje: ${(diet.weeklyDiet?.monday || []).map((m: any) => m.meal).join(', ') || 'não definidas'}
- Custo estimado/mês: R$ ${diet.monthlyEstimatedCost || '?'}` : 'O cliente ainda não gerou a dieta completa.'}

Responda sempre em português brasileiro, com calor humano e empatia.`;
}
