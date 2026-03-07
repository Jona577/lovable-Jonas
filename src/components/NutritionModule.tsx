import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateLocalDiet } from '@/utils/localDietGenerator';

interface NutritionProfile {
  age: string;
  height: string;
  weight: string;
  gender: 'male' | 'female' | null;
  objective: string;
  activityLevel: string;
  weeklyTrainings: number;
  trainingIntensity: string;
  desiredWeight: string;
  realisticDeadline: string;
  hasRestriction: boolean;
  restrictions: {
    vegetarian: boolean;
    intolerant: boolean;
    intoleranceDesc: string;
    allergies: boolean;
    allergiesDesc: string;
    dislikedFoods: boolean;
    dislikedFoodsDesc: string;
  };
  monthlyBudget: string;
  culinaryPreference: string;
  mealsPerDay: string;
}

interface MealAlternative {
  name: string;
  description: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime: string;
  ingredients: string[];
  estimatedCost: number;
  preparation?: string;
  micros?: Record<string, string>;
}

interface Meal {
  meal: string;
  time: string;
  alternatives: MealAlternative[];
}

interface WeeklyDiet {
  [day: string]: Meal[];
}

interface DietData {
  weeklyDiet: WeeklyDiet;
  weeklyEstimatedCost: number;
  monthlyEstimatedCost: number;
  dailyCalories: number;
  macroSplit: { protein: number; carbs: number; fat: number };
  shoppingList: ShoppingItem[];
  tips: string[];
}

interface ShoppingItem {
  item: string;
  quantity: string;
  estimatedPrice: number;
  category?: string;
  cheaperAlternative?: string;
  owned?: boolean;
}

interface ShoppingCategory {
  name: string;
  items: ShoppingItem[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface GoalEntry {
  date: string;
  weight: string;
}

type NutritionTab = 'dieta' | 'regiao' | 'chat' | 'compras' | 'metas';

interface NutritionModuleProps {
  profile: NutritionProfile;
  isDarkMode?: boolean;
  onBack: () => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayLabels: Record<string, string> = {
  monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta', thursday: 'Quinta',
  friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo'
};

const normalizeDayKey = (day: string): string => {
  if (!day) return '';
  const cleanDay = day.trim().toLowerCase();
  const map: Record<string, string> = {
    'monday': 'monday', 'segunda': 'monday', 'segunda-feira': 'monday',
    'tuesday': 'tuesday', 'terça': 'tuesday', 'terca': 'tuesday', 'terça-feira': 'tuesday',
    'wednesday': 'wednesday', 'quarta': 'wednesday', 'quarta-feira': 'wednesday',
    'thursday': 'thursday', 'quinta': 'thursday', 'quinta-feira': 'thursday',
    'friday': 'friday', 'sexta': 'friday', 'sexta-feira': 'friday',
    'saturday': 'saturday', 'sábado': 'saturday', 'sabado': 'saturday',
    'sunday': 'sunday', 'domingo': 'sunday'
  };

  // Try direct map first
  if (map[cleanDay]) return map[cleanDay];

  // Try partial match (e.g. "seg" -> "segunda")
  if (cleanDay.startsWith('seg')) return 'monday';
  if (cleanDay.startsWith('mon')) return 'monday';
  if (cleanDay.startsWith('ter')) return 'tuesday';
  if (cleanDay.startsWith('tue')) return 'tuesday';
  if (cleanDay.startsWith('qua')) return 'wednesday';
  if (cleanDay.startsWith('wed')) return 'wednesday';
  if (cleanDay.startsWith('qui')) return 'thursday';
  if (cleanDay.startsWith('thu')) return 'thursday';
  if (cleanDay.startsWith('sex')) return 'friday';
  if (cleanDay.startsWith('fri')) return 'friday';
  if (cleanDay.startsWith('sab')) return 'saturday';
  if (cleanDay.startsWith('sat')) return 'saturday';
  if (cleanDay.startsWith('dom')) return 'sunday';
  if (cleanDay.startsWith('sun')) return 'sunday';

  return cleanDay;
};

/**
 * Pre-processes the weekly diet object to ensure all keys are normalized
 * and match our internal dayNames list. Supports both objects and arrays.
 */
/** Extract a number from a value that may be a string like "350 kcal", "R$ 4,50", "15 min" */
const extractNumber = (val: any): number => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  if (typeof val === 'string') {
    // Replace comma decimal separator with dot
    const cleaned = val.replace(/\./g, '').replace(',', '.');
    const match = cleaned.match(/([\d]+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }
  return 0;
};

const normalizeAlternative = (raw: any): MealAlternative => {
  if (!raw || typeof raw !== 'object') return { name: 'Opção', description: '', calories: 0, protein: 0, carbs: 0, fat: 0, prepTime: '', ingredients: [], estimatedCost: 0, preparation: '' };

  // Handle nested macros objects (e.g. raw.macros.protein, raw.nutritionalInfo.calories)
  const macros = raw.macros || raw.macronutrientes || raw.nutritionalInfo || {};

  const calories = extractNumber(raw.calories ?? raw.calorias ?? raw.kcal ?? macros.calories ?? macros.calorias ?? 0);
  const protein = extractNumber(raw.protein ?? raw.proteina ?? raw.proteinas ?? macros.protein ?? macros.proteina ?? 0);
  const carbs = extractNumber(raw.carbs ?? raw.carboidratos ?? raw.carbos ?? macros.carbs ?? macros.carboidratos ?? 0);
  const fat = extractNumber(raw.fat ?? raw.gordura ?? raw.gorduras ?? raw.lipidios ?? macros.fat ?? macros.gordura ?? 0);
  const estimatedCost = extractNumber(raw.estimatedCost ?? raw.estimated_cost ?? raw.custo ?? raw.preco ?? raw.custoEstimado ?? raw.cost ?? 0);

  // Ensure ingredients is always an array
  let ingredients = raw.ingredients || raw.ingredientes || [];
  if (typeof ingredients === 'string') {
    ingredients = ingredients.split(',').map((s: string) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(ingredients)) ingredients = [];

  return {
    name: raw.name || raw.nome || raw.titulo || 'Opção',
    description: raw.description || raw.descricao || raw.desc || '',
    calories,
    protein,
    carbs,
    fat,
    prepTime: raw.prepTime || raw.tempoPreparo || raw.tempo_preparo || raw.prep_time || raw.tempo || '',
    ingredients,
    estimatedCost,
    preparation: raw.preparation || raw.modoPreparo || raw.modo_preparo || raw.preparo || raw.instructions || raw.instrucoes || '',
    micros: raw.micros || raw.micronutrients || raw.micronutrientes || raw.vitaminas || {},
  };
};

const normalizeMeal = (raw: any): Meal => {
  if (!raw || typeof raw !== 'object') return { meal: 'Refeição', time: '--:--', alternatives: [] };

  const mealName = raw.meal || raw.name || raw.refeicao || raw.titulo || 'Refeição';
  const time = raw.time || raw.horario || raw.hora || raw.schedule || '--:--';
  const alts = raw.alternatives || raw.opcoes || raw.options || raw.substituicoes || raw.opcoes_substituicao || raw.alternativas || raw.substitutions || [];

  let alternatives: MealAlternative[] = [];
  if (Array.isArray(alts) && alts.length > 0) {
    alternatives = alts.map(normalizeAlternative);
  } else {
    // Check if properties like principal, sub1 exist
    const collected: any[] = [];
    if (raw.principal) collected.push(raw.principal);
    for (let i = 1; i <= 6; i++) {
      if (raw[`sub${i}`] || raw[`substituicao${i}`] || raw[`option${i}`]) {
        collected.push(raw[`sub${i}`] || raw[`substituicao${i}`] || raw[`option${i}`]);
      }
    }
    if (collected.length > 0) {
      alternatives = collected.map(normalizeAlternative);
    } else if (raw.calories || raw.calorias || raw.macros) {
      alternatives = [normalizeAlternative(raw)];
    }
  }

  return { meal: mealName, time, alternatives };
};

const preprocessWeeklyDiet = (diet: any): WeeklyDiet => {
  if (!diet) return {};
  const normalizedDiet: WeeklyDiet = {};

  if (Array.isArray(diet)) {
    diet.forEach((item, idx) => {
      const dayKey = dayNames[idx] || `extra_${idx}`;
      const mealsRaw = Array.isArray(item) ? item : (item?.meals || item?.items || item?.refeicoes || []);
      normalizedDiet[dayKey] = Array.isArray(mealsRaw) ? mealsRaw.map(normalizeMeal) : [];
    });
  } else if (typeof diet === 'object') {
    Object.keys(diet).forEach(key => {
      const normalizedKey = normalizeDayKey(key);
      const value = diet[key];
      let mealsRaw: any[] = [];
      if (Array.isArray(value)) {
        mealsRaw = value;
      } else if (value && typeof value === 'object') {
        mealsRaw = value.meals || value.items || value.refeicoes || [];
      }
      normalizedDiet[normalizedKey] = Array.isArray(mealsRaw) ? mealsRaw.map(normalizeMeal) : [];
    });
  }

  return normalizedDiet;
};

const extractAndCleanJson = (text: string): any => {
  // Try ```json blocks first
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  let jsonStr = jsonBlockMatch ? jsonBlockMatch[1] : null;

  // Try raw JSON object
  if (!jsonStr) {
    const rawMatch = text.match(/\{[\s\S]*\}/);
    jsonStr = rawMatch ? rawMatch[0] : null;
  }

  if (!jsonStr) return null;

  // Clean common issues
  jsonStr = jsonStr
    .replace(/,\s*([}\]])/g, '$1') // trailing commas
    .replace(/[\x00-\x1F\x7F]/g, ' ') // control characters
    .replace(/\n/g, ' ');

  try {
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
};

// --- ERROR BOUNDARY COMPONENT ---
class NutritionErrorBoundary extends React.Component<{ children: React.ReactNode; isDarkMode?: boolean; onReset: () => void }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("NutritionModule Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={`p-10 text-center ${this.props.isDarkMode ? 'text-white' : 'text-slate-800'}`}>
          <span className="text-6xl mb-6 block">⚠️</span>
          <h2 className="text-2xl font-black mb-4 uppercase">Ops! Algo deu errado na exibição.</h2>
          <p className="text-slate-400 font-bold mb-8 max-w-md mx-auto">
            Os dados recebidos da Maria podem estar em um formato inesperado. Tente limpar os dados locais e gerar novamente.
          </p>
          <div className="flex flex-col gap-3 max-w-xs mx-auto">
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="px-6 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all"
            >
              Recarregar App
            </button>
            <button
              onClick={this.props.onReset}
              className="px-6 py-3 border-2 border-red-500 text-red-500 rounded-2xl font-black uppercase text-xs hover:bg-red-50 transition-all"
            >
              Limpar Dados da Maria (Reset)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const NutritionModule: React.FC<NutritionModuleProps> = ({ profile, isDarkMode, onBack }) => {
  return (
    <NutritionErrorBoundary
      isDarkMode={isDarkMode}
      onReset={() => {
        localStorage.removeItem('produtivity_nutrition_diet');
        localStorage.removeItem('produtivity_nutrition_profile');
        window.location.reload();
      }}
    >
      <NutritionModuleContent profile={profile} isDarkMode={isDarkMode} onBack={onBack} />
    </NutritionErrorBoundary>
  );
};

const NutritionModuleContent: React.FC<NutritionModuleProps> = ({ profile, isDarkMode, onBack }) => {
  const [activeTab, setActiveTab] = useState<NutritionTab>('dieta');
  const [dietData, setDietData] = useState<DietData | null>(null);
  const [isGeneratingDiet, setIsGeneratingDiet] = useState(false);
  const [selectedDay, setSelectedDay] = useState('monday');
  const [selectedMealIdx, setSelectedMealIdx] = useState<number | null>(null);
  const [selectedAltIdx, setSelectedAltIdx] = useState<Record<string, number>>({});
  const [showSubstitutions, setShowSubstitutions] = useState<Record<string, boolean>>({});
  const [detailMeal, setDetailMeal] = useState<{ data: MealAlternative; origin: { x: number; y: number } } | null>(null);

  const handleShowDetail = (alt: MealAlternative, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDetailMeal({
      data: alt,
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    });
  };

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Region
  const [regionData, setRegionData] = useState<any>(null);
  const [isLoadingRegion, setIsLoadingRegion] = useState(false);

  // Shopping
  const [shoppingData, setShoppingData] = useState<ShoppingCategory[] | null>(null);
  const [isLoadingShopping, setIsLoadingShopping] = useState(false);
  const [ownedItems, setOwnedItems] = useState<Record<string, boolean>>({});
  const [shoppingFlow, setShoppingFlow] = useState<'options' | 'meal_selection' | 'list'>('options');
  const [shoppingMode, setShoppingMode] = useState<'today' | 'day' | 'week' | null>(null);
  const [shoppingSelectedDay, setShoppingSelectedDay] = useState<string>('monday');
  const [selectedShoppingMeals, setSelectedShoppingMeals] = useState<Record<string, boolean>>({});

  // Goals
  const [goalEntries, setGoalEntries] = useState<GoalEntry[]>([]);
  const [newWeight, setNewWeight] = useState('');

  // Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Weekly adjustment
  const [showWeeklyPrompt, setShowWeeklyPrompt] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('produtivity_nutrition_diet');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.weeklyDiet) {
          parsed.weeklyDiet = preprocessWeeklyDiet(parsed.weeklyDiet);
        }
        setDietData(parsed);
      } catch (e) {
        console.error("Error loading saved diet:", e);
      }
    }
    const savedChat = localStorage.getItem('produtivity_nutrition_chat');
    if (savedChat) {
      setChatMessages(JSON.parse(savedChat));
    } else {
      setChatMessages([{
        role: 'assistant',
        content: 'Olá! Eu sou a Maria, sua nutricionista pessoal. 👩‍⚕️\n\nEstou aqui para cuidar de cada detalhe da sua alimentação. Eu conheço suas metas e restrições, e tenho autonomia total para ajustar sua dieta sempre que precisar.\n\nComo posso te ajudar hoje?'
      }]);
    }
    const savedGoals = localStorage.getItem('produtivity_nutrition_goals');
    if (savedGoals) setGoalEntries(JSON.parse(savedGoals));
    const savedShopping = localStorage.getItem('produtivity_nutrition_shopping');
    if (savedShopping) setShoppingData(JSON.parse(savedShopping));
    const savedOwned = localStorage.getItem('produtivity_nutrition_owned');
    if (savedOwned) setOwnedItems(JSON.parse(savedOwned));

    // Weekly Monday prompt
    const today = new Date();
    if (today.getDay() === 1) {
      const lastPrompt = localStorage.getItem('produtivity_nutrition_last_weekly_prompt');
      const thisMonday = today.toISOString().split('T')[0];
      if (lastPrompt !== thisMonday) {
        setShowWeeklyPrompt(true);
        localStorage.setItem('produtivity_nutrition_last_weekly_prompt', thisMonday);
      }
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const callNutritionAI = async (body: any) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/nutrition-ai`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || `Erro ${res.status}`);
    }
    return res;
  };

  const generateDiet = async () => {
    setIsGeneratingDiet(true);
    setErrorMsg(null);
    try {
      // Generate diet locally with precise calorie/macro calculations based on profile
      const generated = generateLocalDiet(profile);

      // Preprocess keys to ensure normalization
      const processedData = {
        ...generated,
        weeklyDiet: preprocessWeeklyDiet(generated.weeklyDiet)
      };

      setDietData(processedData);
      localStorage.setItem('produtivity_nutrition_diet', JSON.stringify(processedData));
      setSuccessMsg('Dieta gerada com sucesso! 🎉');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      console.error('generateDiet error:', e);
      setErrorMsg(e.message || 'Erro ao gerar dieta');
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsGeneratingDiet(false);
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    const updatedMsgs = [...chatMessages, userMsg];
    setChatMessages(updatedMsgs);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await callNutritionAI({
        action: 'chat',
        profile: {
          ...profile,
          // Add dynamic context
          currentWeight: goalEntries.length > 0 ? goalEntries[goalEntries.length - 1].weight : profile.weight,
          lastWeighIn: goalEntries.length > 0 ? goalEntries[goalEntries.length - 1].date : null,
          goalProgress: goalEntries.length > 0
            ? ((Math.abs(parseFloat(goalEntries[goalEntries.length - 1].weight) - parseFloat(profile.weight)) / Math.abs(parseFloat(profile.desiredWeight) - parseFloat(profile.weight))) * 100).toFixed(1)
            : 0,
        },
        diet: dietData,
        messages: updatedMsgs.map(m => ({ role: m.role, content: m.content })),
      });

      // Stream response
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;

              // Only update chat view with clean content (hide JSON blocks being formed)
              // Ideally we parse at the end, but for live typing we show everything until the end
              // Or we can just show it. Let's just show it for now, and clean it up at the end.

              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch { /* partial json */ }
        }
      }

      // Final processing: Check for diet updates in the full content
      // Regex to find ```json ... ``` blocks
      const jsonBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```/g;
      let match;
      let cleanContent = assistantContent;
      let updatesFound = false;

      while ((match = jsonBlockRegex.exec(assistantContent)) !== null) {
        try {
          const jsonStr = match[1];
          const updateData = JSON.parse(jsonStr);

          if (updateData.type === 'diet_update') {
            console.log('Applying diet update:', updateData);

            setDietData(prev => {
              if (!prev) return prev;

              let newDiet = { ...prev };

              if (updateData.scope === 'day' && updateData.day && updateData.data) {
                // Update specific day
                const normalizedDay = normalizeDayKey(updateData.day);
                newDiet.weeklyDiet = {
                  ...newDiet.weeklyDiet,
                  [normalizedDay]: updateData.data
                };
                setSuccessMsg(`Dieta de ${dayLabels[normalizedDay] || normalizedDay} atualizada!`);
              } else if (updateData.scope === 'full' && updateData.data) {
                // Update full diet
                newDiet.weeklyDiet = preprocessWeeklyDiet(updateData.data);
                setSuccessMsg('Plano alimentar completo atualizado!');
              }

              localStorage.setItem('produtivity_nutrition_diet', JSON.stringify(newDiet));
              return newDiet;
            });
            updatesFound = true;
          }

          // Remove the JSON block from the displayed message
          cleanContent = cleanContent.replace(match[0], '').trim();

        } catch (e) {
          console.error('Error parsing diet update JSON:', e);
        }
      }

      if (updatesFound) {
        // Update the last message with clean content (without JSON)
        setChatMessages(prev => {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: cleanContent } : m);
        });
        setTimeout(() => setSuccessMsg(null), 3000);
      }

      // Save chat
      setChatMessages(prev => {
        localStorage.setItem('produtivity_nutrition_chat', JSON.stringify(prev));
        return prev;
      });
    } catch (e: any) {
      setErrorMsg(e.message);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsChatLoading(false);
    }
  };

  const loadRegionData = async () => {
    if (regionData) return;
    setIsLoadingRegion(true);
    try {
      const res = await callNutritionAI({ action: 'region_info', profile });
      const data = await res.json();
      setRegionData(data.parsed || data.content);
    } catch (e: any) {
      setErrorMsg(e.message);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsLoadingRegion(false);
    }
  };

  const handleStartShoppingFlow = (mode: 'today' | 'day' | 'week') => {
    setShoppingMode(mode);
    setShoppingFlow('meal_selection');

    // Auto-select meals based on mode
    const newSelection: Record<string, boolean> = {};
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = days[new Date().getDay()];
    const targetDay = mode === 'today' ? todayName : (mode === 'day' ? shoppingSelectedDay : null);

    Object.entries(dietData?.weeklyDiet || {}).forEach(([day, meals]) => {
      const isVisible = mode === 'week' || day === targetDay;
      if (isVisible) {
        meals.forEach((_, idx) => {
          newSelection[`${day}-${idx}`] = true;
        });
      }
    });

    setSelectedShoppingMeals(newSelection);
  };

  const generateShoppingList = async () => {
    if (!dietData) return;
    setIsLoadingShopping(true);

    // Build filtered diet based on selectedShoppingMeals
    const filteredDiet: any = { weeklyDiet: {} };
    let hasSelection = false;

    Object.entries(selectedShoppingMeals).forEach(([key, isSelected]) => {
      if (isSelected) {
        hasSelection = true;
        const [day, mealIdxStr] = key.split('-');
        const mIdx = parseInt(mealIdxStr);
        if (!filteredDiet.weeklyDiet[day]) filteredDiet.weeklyDiet[day] = [];

        const fullMeal = (dietData.weeklyDiet as any)[day][mIdx];
        const altIdx = selectedAltIdx[`${day}-${mIdx}`] || 0;
        const selectedAlt = fullMeal.alternatives[altIdx];

        filteredDiet.weeklyDiet[day].push({
          meal: fullMeal.meal,
          time: fullMeal.time,
          selectedAlternative: selectedAlt
        });
      }
    });

    if (!hasSelection) {
      setErrorMsg("Selecione pelo menos uma refeição para sua lista.");
      setTimeout(() => setErrorMsg(null), 3000);
      setIsLoadingShopping(false);
      return;
    }

    try {
      const res = await callNutritionAI({ action: 'generate_shopping_list', profile, diet: filteredDiet });
      const data = await res.json();
      if (data.parsed?.categories) {
        setShoppingData(data.parsed.categories);
        setShoppingFlow('list');
        localStorage.setItem('produtivity_nutrition_shopping', JSON.stringify(data.parsed.categories));
        setSuccessMsg('Lista de compras gerada com base nas suas seleções!');
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsLoadingShopping(false);
    }
  };

  const addGoalEntry = () => {
    if (!newWeight.trim()) return;
    const entry: GoalEntry = { date: new Date().toLocaleDateString('pt-BR'), weight: newWeight };
    const updated = [...goalEntries, entry];
    setGoalEntries(updated);
    localStorage.setItem('produtivity_nutrition_goals', JSON.stringify(updated));
    setNewWeight('');
  };

  const toggleOwned = (item: string) => {
    const updated = { ...ownedItems, [item]: !ownedItems[item] };
    setOwnedItems(updated);
    localStorage.setItem('produtivity_nutrition_owned', JSON.stringify(updated));
  };

  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';
  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-black/10';
  const inputBg = isDarkMode ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-50 border-black text-slate-800';

  const tabs: { id: NutritionTab; label: string; icon: React.ReactNode }[] = [
    { id: 'dieta', label: 'Dieta', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 2l1 18c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2l1-18M7 2v4M12 2v4M17 2v4" /></svg> },
    { id: 'regiao', label: 'Minha Região', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg> },
    { id: 'chat', label: 'Minha Nutri', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> },
    { id: 'compras', label: 'Lista de Compras', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path strokeLinecap="round" strokeLinejoin="round" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg> },
    { id: 'metas', label: 'Metas', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" strokeLinecap="round" strokeLinejoin="round" /><polyline points="17 6 23 6 23 12" strokeLinecap="round" strokeLinejoin="round" /></svg> },
  ];

  const quickCommands = [
    'Tive um dia difícil e comi besteira 😔',
    'Tô com muita vontade de doce 🍫',
    'Não tenho tempo pra cozinhar hoje ⏰',
    'Preciso de motivação! 💪',
    'Substituir o jantar de hoje 🔄',
    'Fiz exercício extra! Posso comer mais? 🏃‍♂️',
    'Tô sem fome nenhuma 🤐',
    'Receita rápida com ovos 🍳',
    'Vou sair pra jantar, o que escolher? 🍽️',
    'Me explica por que escolheu isso? 🤔',
  ];

  const [isChatClosing, setIsChatClosing] = useState(false);
  const [isChatMounted, setIsChatMounted] = useState(false);
  const [previousTab, setPreviousTab] = useState<NutritionTab>('dieta');
  const [tabTransition, setTabTransition] = useState(false);

  const handleTabChange = (tabId: NutritionTab) => {
    if (tabId === activeTab) return;
    if (tabId === 'chat') {
      setPreviousTab(activeTab);
      setIsChatMounted(false);
      setActiveTab('chat');
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsChatMounted(true);
        });
      });
      return;
    }
    setTabTransition(true);
    setTimeout(() => {
      setActiveTab(tabId);
      if (tabId === 'regiao') loadRegionData();
      setTimeout(() => setTabTransition(false), 50);
    }, 200);
  };

  const handleCloseChat = () => {
    setIsChatMounted(false);
    // Switch tab immediately so content behind is visible during fade-out
    setActiveTab(previousTab);
    // Keep portal alive briefly for exit animation, then clean up
    setIsChatClosing(true);
    setTimeout(() => {
      setIsChatClosing(false);
    }, 400);
  };

  const [dayTransition, setDayTransition] = useState(false);

  const handleDayChange = (day: string) => {
    if (day === selectedDay) return;
    setDayTransition(true);
    setTimeout(() => {
      setSelectedDay(day);
      setSelectedMealIdx(null);
      setTimeout(() => setDayTransition(false), 50);
    }, 200);
  };

  return (
    <div className="animate-fadeIn overflow-hidden">
      {/* Messages */}
      {errorMsg && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[2000] bg-red-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl animate-bounce text-center max-w-md">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[2000] bg-green-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl animate-fadeIn text-center">
          {successMsg}
        </div>
      )}

      {/* Weekly Prompt */}
      {showWeeklyPrompt && (
        <div className="fixed inset-0 z-[1500] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
            <span className="text-4xl mb-4 block">🔔</span>
            <h3 className="text-xl font-black text-slate-800 mb-2">Nova Semana!</h3>
            <p className="text-slate-500 font-bold mb-6">Precisa fazer algum ajuste na sua dieta?</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowWeeklyPrompt(false); handleTabChange('chat'); }}
                className="flex-1 py-3 bg-black text-white rounded-xl font-black uppercase text-sm">
                Sim, ajustar
              </button>
              <button onClick={() => setShowWeeklyPrompt(false)}
                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-black uppercase text-sm">
                Não, manter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack}
          className={`p-3 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/10 text-black hover:bg-black/5'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h2 className={`text-3xl font-black ${textColor} uppercase tracking-tighter`}>Nutrição</h2>
          <button
            onClick={() => {
              if (confirm('Deseja realmente apagar todos os dados da dieta e começar de novo?')) {
                localStorage.removeItem('produtivity_nutrition_diet');
                localStorage.removeItem('produtivity_nutrition_profile');
                localStorage.removeItem('produtivity_nutrition_shopping');
                window.location.reload();
              }
            }}
            className="text-[10px] font-black uppercase text-red-500 hover:text-red-700 flex items-center gap-1 mt-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Resetar Dados
          </button>
        </div>
        <div className="ml-auto flex gap-1.5 bg-white/80 border border-black/20 rounded-2xl p-1.5">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => handleTabChange(tab.id)}
              className={`p-2 rounded-xl border transition-all duration-200 active:scale-90 ${activeTab === tab.id
                ? 'bg-sky-400 border-sky-400 text-white'
                : 'bg-white border-black/20 text-black hover:border-sky-400'
                }`}
              title={tab.label}>
              {tab.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content with transition */}
      <div className={`transition-all duration-200 ease-out ${tabTransition ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}>

        {/* TAB 1: DIETA */}
        {activeTab === 'dieta' && (
          <div>
            {!dietData ? (
              <div className="text-center py-16">
                <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <span className="text-4xl">🥗</span>
                </div>
                <h3 className={`text-2xl font-black ${textColor} mb-3`}>Sua dieta personalizada</h3>
                <p className="text-slate-400 font-bold max-w-md mx-auto mb-8">
                  A IA vai analisar seu perfil completo e criar uma dieta semanal com alternativas por refeição.
                </p>
                <button onClick={generateDiet} disabled={isGeneratingDiet}
                  className="px-8 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                  {isGeneratingDiet ? (
                    <span className="flex items-center gap-3">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Gerando dieta...
                    </span>
                  ) : 'Gerar Minha Dieta'}
                </button>
              </div>
            ) : (
              <div>
                {/* Summary */}
                <div className={`${cardBg} border-2 rounded-3xl p-6 mb-6`}>
                  <div className="flex flex-wrap gap-6 justify-center">
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Calorias/dia</span>
                      <span className={`text-2xl font-black ${textColor}`}>{dietData?.dailyCalories || 0}</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Proteína</span>
                      <span className={`text-2xl font-black ${textColor}`}>{dietData?.macroSplit?.protein || 0}g</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Carbs</span>
                      <span className={`text-2xl font-black ${textColor}`}>{dietData?.macroSplit?.carbs || 0}g</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Gordura</span>
                      <span className={`text-2xl font-black ${textColor}`}>{dietData?.macroSplit?.fat || 0}g</span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Custo/mês</span>
                      <span className="text-2xl font-black text-slate-500">R${dietData?.monthlyEstimatedCost || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Horizontal day buttons */}
                <div className="flex flex-col w-full gap-6">
                  <div className="flex flex-row gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
                    {dayNames.map(day => (
                      <button key={day} onClick={() => handleDayChange(day)}
                        className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all duration-300 border-2 flex-1 min-w-[120px] ${selectedDay === day
                          ? 'border-black bg-black text-white shadow-lg shadow-black/20 scale-105'
                          : isDarkMode ? 'border-slate-800 bg-slate-900 text-slate-500 hover:border-slate-600' : 'border-slate-100 bg-white text-slate-400 hover:border-black/20'
                          }`}>
                        {dayLabels[day] || day}
                      </button>
                    ))}
                  </div>

                  {/* Meals content */}
                  <div className={`flex-1 min-w-0 transition-all duration-300 ease-out ${dayTransition ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}`}>
                    {(() => {
                      if (!dietData?.weeklyDiet) return null;
                      const normalizedKey = normalizeDayKey(selectedDay);
                      const dayMeals = dietData.weeklyDiet[normalizedKey] || (dietData.weeklyDiet as any)[selectedDay];

                      if (!Array.isArray(dayMeals) || dayMeals.length === 0) {
                        return (
                          <div className="text-center py-12 opacity-50">
                            <span className="text-4xl mb-3 block">🍽️</span>
                            <p className={`font-black ${textColor}`}>Nenhuma refeição planejada para este dia.</p>
                            <p className="text-xs uppercase font-bold tracking-widest mt-2">Maria está preparando algo especial!</p>
                          </div>
                        );
                      }

                      return dayMeals.map((meal: any, mIdx: number) => {
                        if (!meal) return null;
                        return (
                          <div key={mIdx} className={`${cardBg} border-2 rounded-2xl p-5 mb-4 cursor-pointer transition-all hover:shadow-lg ${selectedMealIdx === mIdx ? 'ring-2 ring-black' : ''}`}>
                            <div className="flex justify-between items-center"
                              onClick={() => setSelectedMealIdx(selectedMealIdx === mIdx ? null : mIdx)}>
                              <div>
                                <span className="block text-sky-900 font-black text-xs uppercase tracking-widest mb-1">Refeição {mIdx + 1}</span>
                                <span className={`font-black text-lg text-black`}>{meal.meal || 'Sem nome'}</span>
                                <div className="flex items-center gap-1.5 mt-1">
                                  <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"></path></svg>
                                  <span className="text-black font-bold text-sm">{meal.time || '--:--'}</span>
                                </div>
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setShowSubstitutions(prev => ({ ...prev, [`${selectedDay}-${mIdx}`]: !prev[`${selectedDay}-${mIdx}`] })); }}
                                className="bg-sky-50 text-sky-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-sky-100 hover:bg-sky-100 transition-all duration-300 transform active:scale-95">
                                {showSubstitutions[`${selectedDay}-${mIdx}`] ? 'Ocultar opções' : 'Ver substituições'}
                              </button>
                            </div>

                            <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${showSubstitutions[`${selectedDay}-${mIdx}`] ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                              <div className="overflow-hidden">
                                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                  {Array.isArray(meal.alternatives) && meal.alternatives.map((alt: any, aIdx: number) => {
                                    if (!alt) return null;
                                    const key = `${selectedDay}-${mIdx}`;
                                    const isSelected = (selectedAltIdx[key] ?? 0) === aIdx;

                                    return (
                                      <div key={aIdx} onClick={(e) => { e.stopPropagation(); setSelectedAltIdx(prev => ({ ...prev, [key]: aIdx })); }}
                                        onDoubleClick={(e) => handleShowDetail(alt, e)}
                                        className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${isSelected
                                          ? 'border-sky-500 bg-sky-50/30' : isDarkMode ? 'border-slate-700 hover:border-slate-500 bg-slate-800/50' : 'border-slate-100 hover:border-sky-200 bg-slate-50/30'
                                          }`}>
                                        {aIdx === 0 && <span className="absolute -top-2 -left-2 bg-black text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">Principal</span>}
                                        {aIdx > 0 && <span className="absolute -top-2 -left-2 bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">Substituição {aIdx}</span>}

                                        <div className="flex justify-between items-start mb-2 mt-1">
                                          <span className={`font-black text-sm leading-tight text-sky-900`}>{alt.name || 'Opção'}</span>
                                          <span className="text-slate-600 text-xs font-black shrink-0">~R${Number(alt.estimatedCost || 0).toFixed(2)}</span>
                                        </div>
                                        <p className="text-slate-500 text-[11px] font-medium leading-relaxed mb-3 line-clamp-3">{alt.description || 'Sem descrição'}</p>

                                        <div className="grid grid-cols-2 gap-y-2 gap-x-1 border-t border-black/5 pt-3 mt-auto">
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-slate-400">Calorias</span>
                                            <span className="text-xs font-black text-slate-700">{alt.calories || 0} kcal</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-slate-400">Proteína</span>
                                            <span className="text-xs font-black text-slate-700">{alt.protein || 0}g</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-slate-400">Carbos</span>
                                            <span className="text-xs font-black text-slate-700">{alt.carbs || 0}g</span>
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="text-[8px] font-black uppercase text-slate-400">Gordura</span>
                                            <span className="text-xs font-black text-slate-700">{alt.fat || 0}g</span>
                                          </div>
                                        </div>
                                        <div className="mt-3 flex items-center justify-between opacity-60">
                                          <span className="text-[9px] font-black text-slate-400">⏱ {alt.prepTime || 'N/A'}</span>
                                          <button onClick={(e) => handleShowDetail(alt, e)}
                                            className="text-[9px] font-black text-sky-500 uppercase tracking-wider hover:text-sky-700 transition-colors">
                                            Ver detalhes →
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}

                    {/* Tips section removed as requested by user - focal point is now the personalized meals */}
                  </div>{/* end meals content */}
                </div>
              </div>
            )}
          </div>
        )}

        {/* MEAL DETAIL MODAL */}
        {detailMeal && (
          <div className="fixed inset-0 z-[2000] bg-black/10 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDetailMeal(null)}>
            <div
              className={`${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'} rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl p-6 transition-all duration-300 ease-out`}
              style={{
                transformOrigin: `${detailMeal.origin.x}px ${detailMeal.origin.y}px`,
                animation: 'expandFromOrigin 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <style>{`
              @keyframes expandFromOrigin {
                0% { transform: scale(0.5); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
              }
            `}</style>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-black text-black">{detailMeal.data.name}</h3>
                <button onClick={() => setDetailMeal(null)} className="p-1 rounded-full hover:bg-black/10 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {detailMeal.data.description && (
                <p className="text-slate-500 text-sm font-medium mb-4">{detailMeal.data.description}</p>
              )}

              {/* Micros / Macros condensed */}
              <div className="mb-6 p-4 bg-sky-50 rounded-2xl border border-sky-100">
                <h4 className="text-xs font-black uppercase tracking-widest text-sky-800 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z" /></svg>
                  Informação Nutricional
                </h4>
                <div className="flex flex-wrap justify-between gap-y-4 text-center">
                  <div className="w-1/4">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Calorias</span>
                    <span className="font-black text-slate-700">{detailMeal.data.calories} kcal</span>
                  </div>

                  {/* Dynamic Micros if available, else placeholder */}
                  {detailMeal.data.micros && Object.keys(detailMeal.data.micros).length > 0 ? (
                    Object.entries(detailMeal.data.micros).slice(0, 3).map(([key, val], i) => (
                      <div key={i} className="w-1/4 border-l border-sky-200 pl-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase truncate" title={key}>{key}</span>
                        <span className="font-black text-slate-700 text-xs">{val}</span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="w-1/4 border-l border-sky-200 pl-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Ferro</span>
                        <span className="font-black text-slate-700">--</span>
                      </div>
                      <div className="w-1/4 border-l border-sky-200 pl-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Vit. A</span>
                        <span className="font-black text-slate-700">--</span>
                      </div>
                      <div className="w-1/4 border-l border-sky-200 pl-2">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Cálcio</span>
                        <span className="font-black text-slate-700">--</span>
                      </div>
                    </>
                  )}
                </div>
                {(!detailMeal.data.micros || Object.keys(detailMeal.data.micros).length === 0) && (
                  <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">Os micronutrientes serão calculados na próxima geração da dieta.</p>
                )}
              </div>

              <div className="flex justify-between items-center mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">⏱</span>
                  <span className="text-sm font-bold">{detailMeal.data.prepTime || 'N/A'}</span>
                </div>
                <span className="text-sm font-black text-slate-600">~R${Number(detailMeal.data.estimatedCost || 0).toFixed(2)}</span>
              </div>

              {/* Ingredients */}
              {Array.isArray(detailMeal.data.ingredients) && detailMeal.data.ingredients.length > 0 && (
                <div className="mb-5">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Ingredientes</h4>
                  <ul className="space-y-1.5">
                    {detailMeal.data.ingredients.map((ing, i) => (
                      <li key={i} className="text-sm font-medium flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preparation */}
              {detailMeal.data.preparation && (
                <div>
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Modo de Preparo</h4>
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-line text-slate-700">{detailMeal.data.preparation}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'regiao' && (
          <div>
            {isLoadingRegion ? (
              <div className="text-center py-16">
                <svg className="animate-spin h-10 w-10 mx-auto mb-4 text-slate-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                <p className="text-slate-400 font-bold">Carregando informações regionais...</p>
              </div>
            ) : !regionData ? (
              <div className="text-center py-16">
                <span className="text-4xl mb-4 block">📍</span>
                <p className="text-slate-400 font-bold mb-6">Carregue informações sobre alimentos da sua região</p>
                <button onClick={loadRegionData} className="px-6 py-3 bg-black text-white rounded-2xl font-black uppercase text-sm">
                  Carregar dados regionais
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Seasonal */}
                {Array.isArray(regionData?.seasonal) && (
                  <div className={`${cardBg} border-2 border-black rounded-2xl p-5`}>
                    <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                      Alimentos da Estação
                    </h4>
                    <div className="space-y-4">
                      {regionData.seasonal.map((item: any, i: number) => {
                        if (!item) return null;
                        return (
                          <div key={i} className="flex justify-between items-start gap-4">
                            <div className="flex items-start gap-2 flex-1 min-w-0">
                              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              <div className="min-w-0">
                                <span className={`font-black text-sm ${textColor}`}>{item.name || 'Alimento'}</span>
                                <span className="text-slate-400 text-xs ml-2">{item.season || ''}</span>
                                {item.tip && <p className="text-slate-400 text-[10px] mt-1">{item.tip}</p>}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-slate-500 font-black text-sm">{item.avgPrice || ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Basic Prices */}
                {Array.isArray(regionData?.basicPrices) && (
                  <div className={`${cardBg} border-2 border-black rounded-2xl p-5`}>
                    <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Preços Básicos
                    </h4>
                    <div className="space-y-2">
                      {regionData.basicPrices.map((item: any, i: number) => {
                        if (!item) return null;
                        return (
                          <div key={i} className="flex justify-between items-center gap-4">
                            <div className="flex items-center gap-2 min-w-0">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" /></svg>
                              <span className={`font-bold text-sm ${textColor}`}>{item.item || 'Item'}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-black text-sm text-slate-500">{item.avgPrice || ''}</span>
                              {item.variation && (
                                <span className="text-xs font-bold text-blue-800">
                                  {item.variation}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Saving Tips */}
                {Array.isArray(regionData?.savingTips) && (
                  <div className={`${cardBg} border-2 border-black rounded-2xl p-5`}>
                    <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                      Dicas de Economia
                    </h4>
                    <ul className="space-y-2">
                      {regionData.savingTips.map((tip: string, i: number) => (
                        <li key={i} className="text-slate-500 text-sm font-bold flex gap-2">
                          <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* News */}
                {Array.isArray(regionData?.news) && (
                  <div className={`${cardBg} border-2 border-black rounded-2xl p-5`}>
                    <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
                      Notícias
                    </h4>
                    <div className="space-y-3">
                      {regionData.news.map((n: any, i: number) => {
                        if (!n) return null;
                        return (
                          <div key={i} className="flex items-start gap-2">
                            <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                            <div>
                              <span className={`font-black text-sm ${textColor}`}>{n.title || 'Manchete'}</span>
                              <p className="text-slate-400 text-xs mt-1">{n.summary || ''}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button onClick={() => { setRegionData(null); loadRegionData(); }}
                  className="w-full py-3 border-2 border-black bg-white text-black rounded-2xl font-black uppercase text-sm hover:bg-blue-900 hover:border-blue-900 hover:text-white transition-all flex items-center justify-center gap-2 active:bg-blue-900 active:border-blue-900 active:text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Atualizar dados
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: NUTRICIONISTA IA - placeholder, rendered as portal */}
        {activeTab === 'chat' && isChatMounted && (
          <div className="text-center py-10">
            <span className="text-4xl mb-3 block">👩‍⚕️</span>
            <p className={`font-black ${textColor}`}>Chamando a Maria...</p>
          </div>
        )}

        {/* TAB 4: LISTA DE COMPRAS */}
        {activeTab === 'compras' && (
          <div className="space-y-6">
            {shoppingFlow === 'options' && (
              <div className="text-center py-12">
                <span className="text-4xl mb-4 block">🛒</span>
                <h3 className={`text-xl font-black ${textColor} mb-3`}>Como quer comprar?</h3>
                <p className="text-slate-400 font-bold max-w-md mx-auto mb-8">
                  Selecione o período para que eu possa calcular as quantidades exatas.
                </p>
                <div className="grid grid-cols-1 gap-4 max-w-sm mx-auto">
                  <button onClick={() => handleStartShoppingFlow('today')}
                    className={`${cardBg} border-2 p-5 rounded-2xl flex items-center justify-between hover:border-black transition-all group`}>
                    <div className="text-left">
                      <span className={`block font-black text-sm uppercase ${textColor}`}>Para Hoje</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Refeições de hoje</span>
                    </div>
                    <span className="text-xl group-hover:scale-125 transition-transform">📅</span>
                  </button>
                  <button onClick={() => handleStartShoppingFlow('day')}
                    className={`${cardBg} border-2 p-5 rounded-2xl flex items-center justify-between hover:border-black transition-all group`}>
                    <div className="text-left">
                      <span className={`block font-black text-sm uppercase ${textColor}`}>Algum dia da semana</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Escolha um dia específico</span>
                    </div>
                    <span className="text-xl group-hover:scale-125 transition-transform">🗓️</span>
                  </button>
                  <button onClick={() => handleStartShoppingFlow('week')}
                    className={`${cardBg} border-2 p-5 rounded-2xl flex items-center justify-between hover:border-black transition-all group`}>
                    <div className="text-left">
                      <span className={`block font-black text-sm uppercase ${textColor}`}>Para a semana</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Plano semanal completo</span>
                    </div>
                    <span className="text-xl group-hover:scale-125 transition-transform">📦</span>
                  </button>
                </div>
              </div>
            )}

            {shoppingFlow === 'meal_selection' && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                  <button onClick={() => setShoppingFlow('options')} className="text-slate-400 hover:text-black font-black text-xs uppercase flex items-center gap-2">
                    ← Voltar
                  </button>
                  <h3 className={`text-lg font-black ${textColor} uppercase tracking-tight`}>Quais refeições você vai fazer?</h3>
                  <div />
                </div>

                {shoppingMode === 'day' && (
                  <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                    {dayNames.map(day => (
                      <button key={day} onClick={() => {
                        setShoppingSelectedDay(day);
                        const newSelection: Record<string, boolean> = {};
                        dietData?.weeklyDiet?.[day]?.forEach((_, idx) => {
                          newSelection[`${day}-${idx}`] = true;
                        });
                        setSelectedShoppingMeals(newSelection);
                      }}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase whitespace-nowrap border-2 transition-all ${shoppingSelectedDay === day ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100'}`}>
                        {dayLabels[day]}
                      </button>
                    ))}
                  </div>
                )}

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.entries(dietData?.weeklyDiet || {}).map(([day, meals]) => {
                    const isVisible = shoppingMode === 'week' || (shoppingMode === 'day' && shoppingSelectedDay === day) || (shoppingMode === 'today' && day === (['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sabado'][new Date().getDay()]));
                    if (!isVisible) return null;

                    return (
                      <div key={day} className="space-y-3">
                        <div className={`text-[10px] font-black uppercase text-slate-400 mb-1`}>{dayLabels[day]}</div>
                        {meals.map((meal, mIdx) => {
                          const key = `${day}-${mIdx}`;
                          return (
                            <div key={mIdx} onClick={() => setSelectedShoppingMeals(prev => ({ ...prev, [key]: !prev[key] }))}
                              className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${selectedShoppingMeals[key] ? 'border-black bg-slate-50' : 'border-slate-100 opacity-60'}`}>
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${selectedShoppingMeals[key] ? 'bg-black border-black' : 'border-slate-300'}`}>
                                {selectedShoppingMeals[key] && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div className="flex-1">
                                <span className={`block font-black text-sm ${textColor}`}>{meal.meal}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{meal.time}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                <div className="pt-6 border-t border-black/5">
                  <button onClick={generateShoppingList} disabled={isLoadingShopping}
                    className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                    {isLoadingShopping ? 'Calculando quantidades...' : 'Gerar Lista Final'}
                  </button>
                </div>
              </div>
            )}

            {shoppingFlow === 'list' && shoppingData && (
              <div className="space-y-6 animate-fadeIn">
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`text-lg font-black ${textColor} uppercase tracking-tight`}>Sua Lista</h3>
                  <button onClick={() => setShoppingFlow('options')} className="text-sky-600 hover:text-sky-800 font-black text-xs uppercase flex items-center gap-2">
                    Nova Lista +
                  </button>
                </div>

                <div className="space-y-6">
                  {Array.isArray(shoppingData) && shoppingData.map((cat, cIdx) => {
                    if (!cat || !Array.isArray(cat.items)) return null;
                    return (
                      <div key={cIdx} className={`${cardBg} border-2 rounded-2xl p-5`}>
                        <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4`}>{cat.name || 'Categoria'}</h4>
                        <div className="space-y-2">
                          {cat.items.map((item, iIdx) => {
                            if (!item) return null;
                            return (
                              <div key={iIdx} className="flex items-center gap-3">
                                <button onClick={() => toggleOwned(item.item)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${ownedItems[item.item] ? 'bg-slate-600 border-slate-600' : 'border-slate-300'}`}>
                                  {ownedItems[item.item] && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                </button>
                                <div className={`flex-1 ${ownedItems[item.item] ? 'line-through opacity-50' : ''}`}>
                                  <span className={`font-bold text-sm ${textColor}`}>{item.item || 'Item'}</span>
                                  <span className="text-slate-700/60 text-xs ml-2">{item.quantity || ''}</span>
                                </div>
                                <span className="text-slate-500 font-black text-sm">R${Number(item.estimatedPrice || 0).toFixed(2)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button onClick={() => setShoppingFlow('options')}
                  className="w-full py-3 border-2 border-black bg-white text-black rounded-2xl font-black uppercase text-sm hover:border-black active:scale-95 transition-all flex items-center justify-center gap-2">
                  Gerar nova lista de compras
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: METAS E ORIENTAÇÕES */}
        {activeTab === 'metas' && (
          <div className="space-y-6">
            {/* Current profile summary */}
            <div className={`${cardBg} border-2 rounded-2xl p-6`}>
              <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                Suas Metas
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-900">Peso Atual</span>
                  <p className={`text-2xl font-black ${textColor}`}>{profile.weight} kg</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-900">Peso Desejado</span>
                  <p className="text-2xl font-black text-slate-500">{profile.desiredWeight} kg</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-900">Objetivo</span>
                  <p className={`font-black text-sm ${textColor}`}>{profile.objective}</p>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-900">Prazo</span>
                  <p className={`font-black text-sm ${textColor}`}>{profile.realisticDeadline}</p>
                </div>
              </div>
            </div>

            {/* Progress */}
            {goalEntries.length > 0 && (() => {
              const currentW = parseFloat(goalEntries[goalEntries.length - 1].weight);
              const startW = parseFloat(profile.weight);
              const goalW = parseFloat(profile.desiredWeight);
              const totalChange = Math.abs(goalW - startW);
              const currentChange = Math.abs(currentW - startW);
              const progress = totalChange > 0 ? Math.min((currentChange / totalChange) * 100, 100) : 0;
              const isLosing = goalW < startW;
              const weeksOfData = goalEntries.length;
              const weeklyRate = weeksOfData > 1 ? Math.abs(currentW - startW) / weeksOfData : 0;
              const remaining = Math.abs(goalW - currentW);
              const weeksToGoal = weeklyRate > 0 ? Math.ceil(remaining / weeklyRate) : null;

              return (
                <>
                  <div className={`${cardBg} border-2 rounded-2xl p-6`}>
                    <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      Progresso
                    </h4>
                    <div className="mb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-xs font-bold text-slate-400">{startW}kg</span>
                        <span className="text-xs font-bold text-green-500">{goalW}kg</span>
                      </div>
                      <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-center text-xs font-bold text-slate-400 mt-2">{progress.toFixed(0)}% concluído</p>
                    </div>
                    {weeksToGoal && (
                      <p className={`text-center font-black text-sm ${textColor}`}>
                        📅 No ritmo atual, atingirá a meta em ~{weeksToGoal} semana{weeksToGoal > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>

                  {/* Weight history */}
                  <div className={`${cardBg} border-2 rounded-2xl p-6`}>
                    <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      Registros
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                      {goalEntries.map((entry, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-slate-400 text-xs font-bold">{entry.date}</span>
                          <span className={`font-black text-sm ${textColor}`}>{entry.weight} kg</span>
                          {i > 0 && (() => {
                            const diff = parseFloat(entry.weight) - parseFloat(goalEntries[i - 1].weight);
                            return (
                              <span className={`text-xs font-black ${diff < 0 && isLosing ? 'text-green-500' : diff > 0 && !isLosing ? 'text-green-500' : 'text-red-400'}`}>
                                {diff > 0 ? '+' : ''}{diff.toFixed(1)}kg
                              </span>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              );
            })()}

            {/* Add weight */}
            <div className={`${cardBg} border-2 rounded-2xl p-6`}>
              <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
                Registrar Peso
              </h4>
              <div className="flex gap-3">
                <input type="text" inputMode="decimal" value={newWeight} onChange={e => { const v = e.target.value.replace(/[^0-9,]/g, ''); setNewWeight(v); }}
                  onKeyDown={e => { if (!/[0-9,]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault(); }}
                  placeholder="Seu peso hoje (kg)"
                  className={`flex-1 p-4 border-2 rounded-xl font-black text-lg outline-none ${inputBg}`} />
                <button onClick={addGoalEntry} disabled={!newWeight.trim()}
                  className={`px-6 py-4 rounded-xl font-black uppercase text-xs disabled:opacity-50 hover:scale-105 active:scale-95 transition-all ${newWeight.trim() ? 'bg-slate-600 text-white' : 'bg-black text-white'}`}>
                  Registrar
                </button>
              </div>
            </div>

            {/* Comparison */}
            <div className={`${cardBg} border-2 rounded-2xl p-6`}>
              <h4 className={`font-black text-sm ${textColor} uppercase tracking-widest mb-4 flex items-center gap-2`}>
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                Comparação
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-blue-900 text-sm font-bold">Calorias diárias</span>
                  <span className={`font-black text-sm ${textColor}`}>{dietData?.dailyCalories || '-'} kcal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-900 text-sm font-bold">Proteína</span>
                  <span className={`font-black text-sm ${textColor}`}>{dietData?.macroSplit?.protein || '-'}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-900 text-sm font-bold">Custo mensal</span>
                  <span className="font-black text-sm text-slate-500">R${dietData?.monthlyEstimatedCost || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-900 text-sm font-bold">Refeições/dia</span>
                  <span className={`font-black text-sm ${textColor}`}>{profile.mealsPerDay}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>{/* end tab transition wrapper */}

      {/* Fullscreen Chat Portal */}
      {
        (activeTab === 'chat' || isChatClosing) && createPortal(
          <div
            className={`fixed inset-0 z-[1000] flex flex-col transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isChatMounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              } ${isDarkMode ? 'bg-black' : 'bg-white'}`}
            style={{ height: '100dvh' }}
          >

            {/* Header */}
            <div className={`flex items-center justify-between px-4 sm:px-8 py-4 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">👩‍⚕️</span>
                <h2 className={`text-xl sm:text-2xl font-black uppercase tracking-tighter ${textColor}`}>Nutricionista Maria</h2>
                <span className="text-[10px] sm:text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-bold ml-1">ONLINE</span>
              </div>
              <button
                onClick={handleCloseChat}
                className={`px-4 py-2 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-black uppercase text-xs tracking-widest ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/10 text-black hover:bg-black/5'
                  }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Voltar
              </button>
            </div>

            {/* Chat content */}
            <div className="flex flex-col flex-1 min-h-0 max-w-4xl mx-auto w-full px-4 sm:px-8 py-4">
              {/* Input */}
              <div className="flex gap-3 mb-3 shrink-0">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Pergunte sobre sua dieta..."
                  className={`flex-1 p-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all ${inputBg}`}
                />
                <button onClick={sendChatMessage} disabled={isChatLoading || !chatInput.trim()}
                  className={`px-6 py-4 rounded-2xl font-black uppercase text-xs disabled:opacity-50 hover:scale-105 active:scale-95 transition-all ${chatInput.trim() ? 'bg-slate-600 text-white' : 'bg-slate-400 text-white'}`}>
                  {isChatLoading ? '...' : 'Enviar'}
                </button>
              </div>

              {/* Quick commands */}
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4 custom-scrollbar shrink-0">
                {quickCommands.map(cmd => (
                  <button key={cmd} onClick={() => { setChatInput(cmd); }}
                    className={`px-3 py-2 rounded-xl text-[10px] font-bold whitespace-nowrap transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {cmd}
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar">
                {chatMessages.length === 0 && (
                  <div className="flex justify-start animate-fadeIn mt-4">
                    <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center shrink-0 mr-2 mt-1">
                      <span className="text-white text-sm">👩‍⚕️</span>
                    </div>
                    <div className="bg-sky-50 text-slate-800 border border-sky-100 rounded-bl-sm max-w-full sm:max-w-[80%] px-5 py-3.5 rounded-2xl text-sm font-medium shadow-sm">
                      Olá! Sou a <strong>Maria</strong>, sua nutricionista pessoal. 👋
                      <br /><br />
                      Vi que seu objetivo é <strong className="text-sky-900">{profile.objective}</strong>. Estou aqui para te ajudar a chegar lá de forma leve!
                      <br /><br />
                      Como posso te ajudar hoje?
                    </div>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center shrink-0 mr-2 mt-1">
                        <span className="text-white text-sm">👩‍⚕️</span>
                      </div>
                    )}
                    <div className={`max-w-full sm:max-w-[80%] px-5 py-3.5 rounded-2xl text-sm font-medium shadow-sm ${msg.role === 'user'
                      ? 'bg-blue-900 text-white rounded-br-sm'
                      : 'bg-sky-50 text-slate-800 border border-sky-100 rounded-bl-sm'
                      }`}>
                      <div className="whitespace-pre-wrap leading-relaxed break-words" style={{ wordBreak: 'break-word' }}>
                        {msg.content.split(/(\*\*.*?\*\*)/g).map((part, idx) =>
                          part.startsWith('**') && part.endsWith('**')
                            ? <strong key={idx} className="font-black text-sky-900">{part.slice(2, -2)}</strong>
                            : part
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isChatLoading && chatMessages[chatMessages.length - 1]?.role !== 'assistant' && (
                  <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center shrink-0 mr-2 mt-1">
                      <span className="text-white text-sm">👩‍⚕️</span>
                    </div>
                    <div className="bg-sky-400 px-4 py-3 rounded-2xl">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </div>
          </div>,
          document.body
        )
      }

    </div >
  );
};

export default NutritionModule;

