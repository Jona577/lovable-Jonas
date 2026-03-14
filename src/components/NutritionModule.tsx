import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { generateLocalDiet } from '@/utils/localDietGenerator';
import { callGroq } from '@/utils/groqAiClient';
import jsPDF from 'jspdf';

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

interface ChatHistoryEntry {
  id: string;
  title: string;
  date: string;
  messages: ChatMessage[];
}

interface GoalEntry {
  date: string;
  weight: string;
}

type NutritionTab = 'dieta' | 'regiao' | 'chat' | 'compras' | 'metas' | 'dados';

interface NutritionModuleProps {
  profile: NutritionProfile;
  isDarkMode?: boolean;
  onBack: () => void;
  onProfileUpdate?: (newProfile: NutritionProfile) => void;
  onEditProfile?: () => void;
}


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

const calcDisplayMacros = (profile: any) => {
  if (!profile) return { dailyCalories: 0, protein: 0, carbs: 0, fat: 0 };
  const weight = parseFloat(profile.weight) || 70;
  const height = parseFloat(profile.height) || 170;
  const age = parseInt(profile.age) || 25;
  const gender = profile.gender || 'male';

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

  const protein = Math.round(weight * 2.0);
  const proteinCals = protein * 4;
  const fat = Math.round((dailyCalories * 0.25) / 9);
  const fatCals = fat * 9;
  const carbs = Math.round((dailyCalories - proteinCals - fatCals) / 4);

  return { dailyCalories, protein, carbs, fat };
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
          <span className="text-4xl sm:text-6xl mb-4 sm:mb-6 block">⚠️</span>
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

const NutritionModule: React.FC<NutritionModuleProps> = ({ profile, isDarkMode, onBack, onProfileUpdate, onEditProfile }) => {
  return (
    <NutritionErrorBoundary
      isDarkMode={isDarkMode}
      onReset={() => {
        localStorage.removeItem('produtivity_nutrition_diet');
        localStorage.removeItem('produtivity_nutrition_profile');
        window.location.reload();
      }}
    >
      <NutritionModuleContent profile={profile} isDarkMode={isDarkMode} onBack={onBack} onProfileUpdate={onProfileUpdate} onEditProfile={onEditProfile} />
    </NutritionErrorBoundary>
  );
};

const NutritionModuleContent: React.FC<NutritionModuleProps> = ({ profile, isDarkMode, onBack, onProfileUpdate, onEditProfile }) => {
  const [activeTab, setActiveTab] = useState<NutritionTab>('dieta');

  // --- Edit Profile States ---
  const [profileChanged, setProfileChanged] = useState(() => {
    return localStorage.getItem('produtivity_nutrition_profile_changed') === 'true';
  });
  const currentProfile = profile;

  // Quick Update States
  const [isQuickUpdating, setIsQuickUpdating] = useState(false);
  const [quickWeight, setQuickWeight] = useState(profile.weight);
  const [quickDesiredWeight, setQuickDesiredWeight] = useState(profile.desiredWeight);

  const [dietData, setDietData] = useState<DietData | null>(() => {
    try {
      const saved = localStorage.getItem('produtivity_nutrition_diet');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.weeklyDiet) {
          parsed.weeklyDiet = preprocessWeeklyDiet(parsed.weeklyDiet);
        }
        return parsed;
      }
    } catch (e) {
      console.error("Error loading saved diet:", e);
    }
    return null;
  });
  const [isGeneratingDiet, setIsGeneratingDiet] = useState(false);
  const [selectedDay, setSelectedDay] = useState('monday');
  const [selectedMealIdx, setSelectedMealIdx] = useState<number | null>(null);
  const [selectedAltIdx, setSelectedAltIdx] = useState<Record<string, number>>({});
  const [showSubstitutions, setShowSubstitutions] = useState<Record<string, boolean>>({});
  const [checkedMeals, setCheckedMeals] = useState<Record<string, number | null>>(() => {
    try {
      const saved = localStorage.getItem('produtivity_nutrition_checked');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleCheckedMeal = (day: string, mIdx: number, aIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckedMeals(prev => {
      const key = `${day}-${mIdx}`;
      const isAlreadyChecked = prev[key] === aIdx;
      const next = { ...prev };
      if (isAlreadyChecked) {
        delete next[key]; // Uncheck
      } else {
        next[key] = aIdx; // Check
      }
      localStorage.setItem('produtivity_nutrition_checked', JSON.stringify(next));
      return next;
    });
  };
  const [detailMeal, setDetailMeal] = useState<{ data: MealAlternative; origin: { x: number; y: number } } | null>(null);
  const [isClosingDetailMeal, setIsClosingDetailMeal] = useState(false);

  const handleCloseDetailMeal = () => {
    if (isClosingDetailMeal) return;
    setIsClosingDetailMeal(true);
    setTimeout(() => {
      setIsClosingDetailMeal(false);
      setDetailMeal(null);
    }, 380);
  };

  const handleShowDetail = (alt: MealAlternative, e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDetailMeal({
      data: alt,
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    });
  };

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('produtivity_nutrition_chat');
    return saved ? JSON.parse(saved) : [{
      role: 'assistant',
      content: 'Olá! Eu sou a Maria, sua nutricionista pessoal.\n\nEstou aqui para cuidar de cada detalhe da sua alimentação. Eu conheço suas metas e restrições, e tenho autonomia total para ajustar sua dieta sempre que precisar.\n\nComo posso te ajudar hoje?'
    }];
  });

  const [chatHistory, setChatHistory] = useState<ChatHistoryEntry[]>(() => {
    const saved = localStorage.getItem('produtivity_nutrition_chat_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editChatTitle, setEditChatTitle] = useState('');
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  // Tracks which history entry is currently loaded so we update it instead of creating a new card
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);

  const saveCurrentChatToHistory = () => {
    if (chatMessages.length <= 1) return; // Don't save if it's just the greeting

    // If we are continuing an existing history entry, update it in place
    if (activeHistoryId) {
      const updated = chatHistory.map(h =>
        h.id === activeHistoryId
          ? { ...h, messages: [...chatMessages], date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }
          : h
      );
      setChatHistory(updated);
      localStorage.setItem('produtivity_nutrition_chat_history', JSON.stringify(updated));
      return;
    }

    // Check if the exact same message chain is already saved
    const isAlreadySaved = chatHistory.some(h =>
      h.messages.length === chatMessages.length &&
      JSON.stringify(h.messages) === JSON.stringify(chatMessages)
    );
    if (isAlreadySaved) return;

    // Find the first user message for a title summary, fallback to simple date
    const firstUserMsg = chatMessages.find(m => m.role === 'user');
    let generatedTitle = `Conversa em ${new Date().toLocaleDateString('pt-BR')}`;
    if (firstUserMsg && firstUserMsg.content) {
      let txt = firstUserMsg.content.trim().split('\n')[0]; // Pega só a primeira linha
      if (txt.length > 50) txt = txt.substring(0, 50) + '...';
      // Capitalize first letter
      txt = txt.charAt(0).toUpperCase() + txt.slice(1);
      generatedTitle = `"${txt}"`;
    }

    const newEntry: ChatHistoryEntry = {
      id: Date.now().toString(),
      title: generatedTitle,
      date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
      messages: [...chatMessages]
    };

    const updatedHistory = [newEntry, ...chatHistory];
    setChatHistory(updatedHistory);
    localStorage.setItem('produtivity_nutrition_chat_history', JSON.stringify(updatedHistory));
  };
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [showAllCommands, setShowAllCommands] = useState(false);
  const [chatMealContext, setChatMealContext] = useState<string | null>(null);
  const [activeMealEdit, setActiveMealEdit] = useState<{ day: string; mealIdx: number; meal: any } | null>(null);

  // Region
  const [regionData, setRegionData] = useState<any>(() => {
    const saved = localStorage.getItem('produtivity_nutrition_region');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoadingRegion, setIsLoadingRegion] = useState(false);

  // Shopping
  const [shoppingData, setShoppingData] = useState<ShoppingCategory[] | null>(() => {
    const saved = localStorage.getItem('produtivity_nutrition_shopping');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoadingShopping, setIsLoadingShopping] = useState(false);
  const [ownedItems, setOwnedItems] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('produtivity_nutrition_owned');
    return saved ? JSON.parse(saved) : {};
  });
  const [shoppingFlow, setShoppingFlow] = useState<'home' | 'options' | 'select_days' | 'select_times' | 'select_meals' | 'list' | 'minhas_listas'>('home');
  const [savedLists, setSavedLists] = useState<{ id: string; date: string; name: string; data: ShoppingCategory[] }[]>(() => {
    const saved = localStorage.getItem('produtivity_nutrition_saved_lists');
    return saved ? JSON.parse(saved) : [];
  });
  const [viewingSavedListId, setViewingSavedListId] = useState<string | null>(null);

  const [showSaveListModal, setShowSaveListModal] = useState(false);
  const [saveListNameInput, setSaveListNameInput] = useState('');

  const [showDeleteListModal, setShowDeleteListModal] = useState(false);
  const [listIdToDelete, setListIdToDelete] = useState<string | null>(null);
  const [shoppingMode, setShoppingMode] = useState<'today' | 'day' | 'week' | null>(null);
  const [shoppingSelectedDay, setShoppingSelectedDay] = useState<string>('monday');
  const [selectedShoppingMeals, setSelectedShoppingMeals] = useState<Record<string, boolean>>({});
  const [shoppingSelectedDaysList, setShoppingSelectedDaysList] = useState<string[]>([]);
  const [shoppingSelectedTimes, setShoppingSelectedTimes] = useState<Record<string, boolean>>({});
  const [shoppingSelectedAlts, setShoppingSelectedAlts] = useState<Record<string, number[]>>({});

  // Goals
  const [goalEntries, setGoalEntries] = useState<GoalEntry[]>(() => {
    const saved = localStorage.getItem('produtivity_nutrition_goals');
    return saved ? JSON.parse(saved) : [];
  });
  const [newWeight, setNewWeight] = useState('');

  // Messages
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Weekly adjustment
  const [showWeeklyPrompt, setShowWeeklyPrompt] = useState(false);

  useEffect(() => {

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
    const res = await callGroq(body);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
      throw new Error(err.error || `Erro ${res.status}`);
    }
    return res;
  };

  // Auto-send meal context when opening chat via "Mudar Algo"
  useEffect(() => {
    if (!chatMealContext || activeTab !== 'chat') return;
    // Small delay to ensure chat is mounted and animations are done
    const timer = setTimeout(() => {
      const contextMsg = chatMealContext;
      setChatMealContext(null);
      // Inject as user message and auto-send
      const userMsg: ChatMessage = { role: 'user', content: contextMsg };
      const updatedMsgs = [...chatMessages, userMsg];
      setChatMessages(updatedMsgs);
      setChatInput('');
      setIsChatLoading(true);

      callGroq({
        action: 'chat',
        profile: {
          ...profile,
          currentWeight: goalEntries.length > 0 ? goalEntries[goalEntries.length - 1].weight : profile.weight,
        },
        diet: dietData,
        messages: updatedMsgs.map(m => ({ role: m.role, content: m.content })),
      }).then(async (res) => {
        if (!res.ok) throw new Error('Erro ao chamar IA');
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
                setChatMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'assistant') {
                    return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                  }
                  return [...prev, { role: 'assistant', content: assistantContent }];
                });
              }
            } catch { /* partial */ }
          }
        }
        setChatMessages(prev => {
          localStorage.setItem('produtivity_nutrition_chat', JSON.stringify(prev));
          return prev;
        });
      }).catch((e) => {
        setErrorMsg(e.message);
        setTimeout(() => setErrorMsg(null), 5000);
      }).finally(() => {
        setIsChatLoading(false);
      });
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatMealContext, activeTab]);

  const generateDiet = async () => {
    setIsGeneratingDiet(true);
    setErrorMsg(null);
    try {
      const res = await callNutritionAI({ action: 'generate_diet', profile: profile });
      const data = await res.json();

      let generatedDiet = data.parsed || extractAndCleanJson(data.content);

      if (!generatedDiet || !generatedDiet.weeklyDiet) {
        throw new Error('A IA não retornou uma dieta válida. Tente novamente.');
      }

      // Preprocess keys to ensure normalization
      const processedData = {
        ...generatedDiet,
        weeklyDiet: preprocessWeeklyDiet(generatedDiet.weeklyDiet)
      };

      setDietData(processedData);
      localStorage.setItem('produtivity_nutrition_diet', JSON.stringify(processedData));
      localStorage.removeItem('produtivity_nutrition_profile_changed');
      setProfileChanged(false);
      setSuccessMsg('Dieta gerada com sucesso pela Maria! 🎉');
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

      // Final processing: detect 'ALTERAÇÃO CONFIRMADA' and apply real meal change
      const confirmationPhrase = 'ALTERAÇÃO CONFIRMADA';
      if (assistantContent.trim().toUpperCase().includes(confirmationPhrase) && activeMealEdit) {
        // Build conversation summary from last few messages (excluding the very last assistant message)
        const conversationHistory = updatedMsgs.slice(-8);
        const conversationSummary = conversationHistory
          .map(m => `${m.role === 'user' ? 'CLIENTE' : 'NUTRICIONISTA'}: ${m.content.substring(0, 400)}`)
          .join('\n');

        // Replace the assistant message with a friendly loading message
        setChatMessages(prev => prev.map((m, i) => i === prev.length - 1
          ? { ...m, content: 'Aplicando as alterações na sua refeição...' }
          : m
        ));

        try {
          const applyRes = await callNutritionAI({
            action: 'apply_meal_change',
            profile,
            mealData: activeMealEdit.meal,
            conversationSummary,
          });

          if (applyRes.ok) {
            const applyData = await applyRes.json();
            let updatedMeal = applyData.parsed || null;

            // Try to parse from content if parsed is missing
            if (!updatedMeal && applyData.content) {
              try {
                updatedMeal = JSON.parse(applyData.content);
              } catch {
                const jsonMatch = applyData.content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  try { updatedMeal = JSON.parse(jsonMatch[0]); } catch { /* ignore */ }
                }
              }
            }

            if (updatedMeal && (updatedMeal.meal || updatedMeal.alternatives)) {
              const { day, mealIdx } = activeMealEdit;
              setDietData(prev => {
                if (!prev) return prev;
                const newWeeklyDiet = { ...prev.weeklyDiet };
                // Apply the change ONLY to the specific day and meal that was clicked
                if (newWeeklyDiet[day] && newWeeklyDiet[day][mealIdx]) {
                  newWeeklyDiet[day] = newWeeklyDiet[day].map((m: any, idx: number) =>
                    idx === mealIdx ? { ...m, ...updatedMeal } : m
                  );
                }
                const newDiet = { ...prev, weeklyDiet: newWeeklyDiet };
                localStorage.setItem('produtivity_nutrition_diet', JSON.stringify(newDiet));
                return newDiet;
              });

              const mealName = updatedMeal.meal || activeMealEdit.meal?.meal || 'Refeição';
              setChatMessages(prev => prev.map((m, i) => i === prev.length - 1
                ? { ...m, content: `Pronto! A refeição "${mealName}" foi atualizada com sucesso naquele dia e horário. Volte à aba Dieta para conferir as mudanças!` }
                : m
              ));
              setSuccessMsg(`Refeição atualizada com sucesso!`);
              setTimeout(() => setSuccessMsg(null), 4000);
              setActiveMealEdit(null);
            } else {
              setChatMessages(prev => prev.map((m, i) => i === prev.length - 1
                ? { ...m, content: 'Não consegui processar a alteração. Pode descrever o que gostaria de mudar com mais detalhes?' }
                : m
              ));
            }
          }
        } catch (applyErr: any) {
          console.error('apply_meal_change error:', applyErr);
          setChatMessages(prev => prev.map((m, i) => i === prev.length - 1
            ? { ...m, content: 'Ocorreu um erro ao aplicar a alteração. Tente novamente.' }
            : m
          ));
        }

        // Save chat after confirmation handling
        setChatMessages(prev => {
          localStorage.setItem('produtivity_nutrition_chat', JSON.stringify(prev));
          return prev;
        });
        setIsChatLoading(false);
        return;
      }

      // Final processing: Check for diet updates via JSON blocks (legacy mechanism)
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
      const finalData = data.parsed || data.content;
      setRegionData(finalData);
      localStorage.setItem('produtivity_nutrition_region', JSON.stringify(finalData));
    } catch (e: any) {
      setErrorMsg(e.message);
      setTimeout(() => setErrorMsg(null), 5000);
    } finally {
      setIsLoadingRegion(false);
    }
  };

  const handleStartShoppingFlow = (mode: 'today' | 'day' | 'week') => {
    setShoppingMode(mode);
    setShoppingFlow('select_days');

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = days[new Date().getDay()];

    if (mode === 'today') {
      setShoppingSelectedDaysList([todayName]);
    } else if (mode === 'day') {
      setShoppingSelectedDaysList([shoppingSelectedDay || 'monday']);
    } else if (mode === 'week') {
      setShoppingSelectedDaysList([...days]);
    }

    // reset selection state
    setShoppingSelectedTimes({});
    setShoppingSelectedAlts({});
  };

  const generateShoppingList = async () => {
    if (!dietData) return;
    setIsLoadingShopping(true);

    // Build filtered diet based on shoppingSelectedAlts
    const filteredDiet: any = { weeklyDiet: {} };
    let hasSelection = false;

    Object.entries(shoppingSelectedAlts).forEach(([key, altIndices]) => {
      const [day, mealIdxStr] = key.split('-');
      const mIdx = parseInt(mealIdxStr);

      if (altIndices.length > 0) {
        hasSelection = true;
        if (!filteredDiet.weeklyDiet[day]) filteredDiet.weeklyDiet[day] = [];
        const fullMeal = (dietData.weeklyDiet as any)[day][mIdx];

        altIndices.forEach((altIdx, idxForAlt) => {
          const selectedAlt = fullMeal.alternatives[altIdx];
          filteredDiet.weeklyDiet[day].push({
            meal: `${fullMeal.meal}${altIndices.length > 1 ? ` (Opção ${idxForAlt + 1})` : ''}`,
            time: fullMeal.time,
            selectedAlternative: selectedAlt,
            alternatives: [selectedAlt]
          });
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
        setViewingSavedListId(null);
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

  const handleDownloadPDF = () => {
    if (!shoppingData || !Array.isArray(shoppingData)) return;

    const doc = new jsPDF();
    let y = 20;

    let listName = 'lista_de_compras';
    if (viewingSavedListId) {
      const foundList = savedLists.find(l => l.id === viewingSavedListId);
      if (foundList) {
        listName = foundList.name;
        // Strip accents for filename
        listName = listName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_');
      }
    }

    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Lista de Compras", 105, y, { align: "center" });
    y += 15;

    shoppingData.forEach((cat) => {
      if (!cat || !Array.isArray(cat.items)) return;

      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text((cat.name || 'Categoria').toUpperCase(), 20, y);
      y += 10;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");

      cat.items.forEach((item) => {
        if (!item) return;

        if (y > 280) {
          doc.addPage();
          y = 20;
        }

        const quantityText = item.quantity ? ` (${item.quantity})` : '';
        const text = `• ${item.item || 'Item'}${quantityText}`;
        const splitText = doc.splitTextToSize(text, 170);

        doc.text(splitText, 25, y);
        y += (7 * splitText.length);
      });

      y += 5; // space between categories
    });

    doc.save(`${listName}.pdf`);
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
    { id: 'dados', label: 'Meus Dados', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
    { id: 'dieta', label: 'Dieta', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" /><path d="M10 2c1 .5 2 2 2 5" /></svg> },
    { id: 'regiao', label: 'Minha Região', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg> },
    { id: 'chat', label: 'Minha Nutri', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> },
    { id: 'compras', label: 'Lista de Compras', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path strokeLinecap="round" strokeLinejoin="round" d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" /></svg> },
  ];

  const quickCommands = [
    'Tive um dia difícil e comi besteira',
    'Tô com muita vontade de doce',
    'Não tenho tempo pra cozinhar hoje',
    'Preciso de motivação!',
    'Substituir o jantar de hoje',
    'Fiz exercício extra! Posso comer mais?',
    'Tô sem fome nenhuma',
    'Receita rápida com ovos',
    'Vou sair pra jantar, o que escolher?',
    'Me explica por que escolheu isso?',
  ];

  const [isChatClosing, setIsChatClosing] = useState(false);
  const [isChatMounted, setIsChatMounted] = useState(false);
  const [isComprasClosing, setIsComprasClosing] = useState(false);
  const [isComprasMounted, setIsComprasMounted] = useState(false);
  const [previousTab, setPreviousTab] = useState<NutritionTab>('dieta');
  const [tabTransition, setTabTransition] = useState(false);

  const handleTabChange = (tabId: NutritionTab) => {
    if (tabId === activeTab) return;
    if (tabId === 'chat' || tabId === 'compras') {
      setPreviousTab(activeTab);
      if (tabId === 'chat') {
        setIsChatMounted(false);
      } else {
        setIsComprasMounted(false);
      }
      setActiveTab(tabId);
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (tabId === 'chat') {
            setIsChatMounted(true);
          } else {
            setIsComprasMounted(true);
          }
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

  const handleMudarAlgoMeal = (meal: any, alt: any, mealIdx: number, altIdx: number, day: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const dayLabel = dayLabels[day] || day;
    const altLabel = altIdx === 0 ? 'Opção Principal' : `Substituição ${altIdx}`;
    const ingredientsList = Array.isArray(alt.ingredients) ? alt.ingredients.join(', ') : 'não especificados';
    const microsStr = alt.micros && Object.keys(alt.micros).length > 0
      ? Object.entries(alt.micros).map(([k, v]) => `${k}: ${v}`).join(' | ')
      : 'não disponíveis';

    const contextMsg = `Preciso que você me ajude a mudar algo na minha refeição abaixo. Mantenha os macros e quantidade praticamente iguais, apenas ajuste o que for necessário conforme meu pedido.

📅 DIA: ${dayLabel} — Refeição ${mealIdx + 1}: ${meal.meal} (${meal.time})
🍽️ OPÇÃO: ${altLabel} — "${alt.name || 'Sem nome'}"
📝 Descrição: ${alt.description || 'Sem descrição'}

📊 MACROS ATUAIS (MANTER PRÓXIMOS DESSES VALORES):
• Calorias: ${alt.calories || 0} kcal
• Proteína: ${alt.protein || 0}g
• Carboidratos: ${alt.carbs || 0}g
• Gordura: ${alt.fat || 0}g

🛒 Ingredientes: ${ingredientsList}
⏱ Tempo de preparo: ${alt.prepTime || 'N/A'}
💰 Custo estimado: R$ ${Number(alt.estimatedCost || 0).toFixed(2)}
🔬 Micronutrientes: ${microsStr}

O que você quer que eu mude nessa refeição?`;

    // Store reference to the full meal (all its alternatives) for the apply step
    setActiveMealEdit({ day, mealIdx, meal });
    setChatMealContext(contextMsg);
    handleTabChange('chat');
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

  const handleCloseCompras = () => {
    if (shoppingFlow === 'list') {
      if (viewingSavedListId) setShoppingFlow('minhas_listas');
      else setShoppingFlow('select_meals');
    } else if (shoppingFlow === 'select_days') {
      setShoppingFlow('options');
    } else if (shoppingFlow === 'select_times') {
      setShoppingFlow('select_days');
    } else if (shoppingFlow === 'select_meals') {
      setShoppingFlow('select_times');
    } else if (shoppingFlow === 'options' || shoppingFlow === 'minhas_listas') {
      setShoppingFlow('home');
    } else {
      setIsComprasMounted(false);
      setActiveTab(previousTab);
      setIsComprasClosing(true);
      setTimeout(() => {
        setIsComprasClosing(false);
      }, 400);
    }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
          <button onClick={() => {
            if (activeTab === 'dieta') {
              onBack();
            } else {
              handleTabChange('dieta');
            }
          }}
            className={`p-3 rounded-2xl border-2 transition-all shrink-0 hover:scale-105 active:scale-95 ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/10 text-black hover:bg-black/5'}`}>
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h2 className={`text-2xl sm:text-3xl font-black ${textColor} uppercase tracking-tighter truncate leading-none`}>Nutrição</h2>
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
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              <span className="truncate">Resetar Dados</span>
            </button>
          </div>
        </div>
        <div className="w-full sm:w-auto sm:ml-auto overflow-hidden">
          <div className="flex gap-1.5 bg-white/80 border border-black/20 rounded-2xl p-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                className={`p-2 shrink-0 rounded-xl border transition-all duration-200 active:scale-90 ${activeTab === tab.id
                  ? 'bg-sky-400 border-sky-400 text-white'
                  : 'bg-white border-black/20 text-black hover:border-sky-400'
                  }`}
                title={tab.label}>
                {tab.icon}
              </button>
            ))}
          </div>
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
            ) : (() => {
              const uiMacros = calcDisplayMacros(profile);
              return (
                <div>
                  {/* Summary */}
                  <div className={`${cardBg} border-2 rounded-3xl p-6 mb-6`}>
                    <div className="flex flex-wrap gap-6 justify-center">
                      <div className="text-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Calorias/dia</span>
                        <span className={`text-2xl font-black ${textColor}`}>{uiMacros.dailyCalories || 0}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Proteína</span>
                        <span className={`text-2xl font-black ${textColor}`}>{uiMacros.protein || 0}g</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Carbs</span>
                        <span className={`text-2xl font-black ${textColor}`}>{uiMacros.carbs || 0}g</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Gordura</span>
                        <span className={`text-2xl font-black ${textColor}`}>{uiMacros.fat || 0}g</span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Custo/mês</span>
                        <span className="text-2xl font-black text-slate-500">R${profile?.monthlyBudget || dietData?.monthlyEstimatedCost || 0}</span>
                      </div>
                    </div>
                  </div>

                  {/* Horizontal day buttons */}
                  <div className="flex flex-col w-full gap-6">
                    <div className="flex flex-row flex-nowrap md:flex-wrap gap-2 overflow-x-auto pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {dayNames.map(day => (
                        <button key={day} onClick={() => handleDayChange(day)}
                          className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest whitespace-nowrap transition-all duration-300 border-2 flex-1 min-w-fit ${selectedDay === day
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
                            <div key={mIdx} className={`${cardBg} border-2 border-slate-300 rounded-2xl p-5 mb-4 cursor-pointer transition-all hover:shadow-lg ${selectedMealIdx === mIdx ? 'border-slate-500' : ''}`}>
                              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4"
                                onClick={() => setSelectedMealIdx(selectedMealIdx === mIdx ? null : mIdx)}>
                                <div className={`transition-all ${checkedMeals[`${selectedDay}-${mIdx}`] != null ? 'line-through opacity-60' : ''}`}>
                                  <span className="block text-sky-900 font-black text-xs uppercase tracking-widest mb-1">Refeição {mIdx + 1}</span>
                                  <span className="font-black text-lg text-black">{meal.meal || 'Sem nome'}</span>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"></path></svg>
                                    <span className="text-black font-bold text-sm">{meal.time || '--:--'}</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                                  {selectedMealIdx === mIdx && meal.alternatives?.length > 1 && (
                                    <button onClick={(e) => { e.stopPropagation(); setShowSubstitutions(prev => ({ ...prev, [`${selectedDay}-${mIdx}`]: !prev[`${selectedDay}-${mIdx}`] })); }}
                                      className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-200 hover:bg-slate-200 transition-all duration-300 transform active:scale-95">
                                      {showSubstitutions[`${selectedDay}-${mIdx}`] ? 'Ocultar substituições' : 'Ver substituições'}
                                    </button>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); setSelectedMealIdx(selectedMealIdx === mIdx ? null : mIdx); }}
                                    className="bg-sky-400/60 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-sky-500/60 transition-all duration-300 transform active:scale-95">
                                    {selectedMealIdx === mIdx ? 'Ocultar Refeição' : 'Ver Refeição'}
                                  </button>
                                </div>
                              </div>

                              <div className={`grid transition-[grid-template-rows] duration-500 ease-in-out ${selectedMealIdx === mIdx ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                                <div className="overflow-hidden">
                                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                                    {Array.isArray(meal.alternatives) && meal.alternatives.map((alt: any, aIdx: number) => {
                                      if (!alt) return null;
                                      const key = `${selectedDay}-${mIdx}`;
                                      if (aIdx > 0 && !showSubstitutions[key]) return null;
                                      const isSelected = (selectedAltIdx[key] ?? 0) === aIdx;

                                      return (
                                        <div key={aIdx} onClick={(e) => { e.stopPropagation(); setSelectedAltIdx(prev => ({ ...prev, [key]: aIdx })); }}
                                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer relative ${isSelected
                                            ? 'border-sky-500 bg-sky-50/30' : isDarkMode ? 'border-slate-700 hover:border-slate-500 bg-slate-800/50' : 'border-slate-100 hover:border-sky-200 bg-slate-50/30'
                                            }`}>
                                          {aIdx === 0 && <span className="absolute -top-2 -left-2 bg-black text-white px-2 py-0.5 rounded text-[8px] font-black uppercase">Principal</span>}
                                          {aIdx > 0 && <span className="absolute -top-2 -left-2 bg-slate-200 text-slate-600 px-2 py-0.5 rounded text-[8px] font-black uppercase">Substituição {aIdx}</span>}

                                          <div className="flex justify-between items-start mb-2 mt-1">
                                            <div className="flex items-start gap-3">
                                              <div
                                                onClick={(e) => toggleCheckedMeal(selectedDay, mIdx, aIdx, e)}
                                                className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${checkedMeals[key] === aIdx ? 'bg-black border-black shadow-md shadow-black/30' : 'bg-white border-slate-300 hover:border-black'}`}
                                              >
                                                {checkedMeals[key] === aIdx && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                              </div>
                                              <div>
                                                <span className={`font-black text-sm leading-tight text-sky-900 transition-all ${checkedMeals[key] === aIdx ? 'line-through opacity-60' : ''}`}>{alt.name || 'Opção'}</span>
                                                <p className={`text-[11px] font-medium leading-relaxed mb-3 line-clamp-3 mt-1 text-slate-500 transition-all ${checkedMeals[key] === aIdx ? 'line-through opacity-60' : ''}`}>{alt.description || 'Sem descrição'}</p>
                                              </div>
                                            </div>
                                            <span className={`text-slate-600 text-xs font-black shrink-0 transition-all ${checkedMeals[key] === aIdx ? 'line-through opacity-60' : ''}`}>~R${Number(alt.estimatedCost || 0).toFixed(2)}</span>
                                          </div>

                                          <div className={`grid grid-cols-2 gap-y-2 gap-x-1 border-t border-black/5 pt-3 mt-auto transition-all ${checkedMeals[key] === aIdx ? 'line-through opacity-60' : ''}`}>
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
                                          <div className={`mt-3 flex flex-col gap-1.5 transition-all ${checkedMeals[key] === aIdx ? 'opacity-40' : ''}`}>
                                            <div className="flex items-center justify-between opacity-60">
                                              <span className="text-[9px] font-black text-slate-400">⏱ {alt.prepTime || 'N/A'}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-2">
                                              <button
                                                onClick={(e) => handleMudarAlgoMeal(meal, alt, mIdx, aIdx, selectedDay, e)}
                                                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white border border-slate-200 text-slate-400 text-[9px] font-black uppercase tracking-wider hover:bg-slate-50 hover:border-slate-300 hover:text-slate-500 transition-all active:scale-95"
                                              >
                                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                Mudar Algo
                                              </button>
                                              <button onClick={(e) => handleShowDetail(alt, e)}
                                                className="flex-1 text-[9px] font-black text-sky-500 uppercase tracking-wider hover:text-sky-700 transition-colors text-center py-1.5">
                                                Ver detalhes →
                                              </button>
                                            </div>
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

                      {/* Daily Consumed Macros Summary */}
                      {(() => {
                        if (!dietData?.weeklyDiet) return null;
                        const normalizedKey = normalizeDayKey(selectedDay);
                        const dayMeals = dietData.weeklyDiet[normalizedKey] || (dietData.weeklyDiet as any)[selectedDay];
                        if (!Array.isArray(dayMeals) || dayMeals.length === 0) return null;

                        let totCals = 0;
                        let totProt = 0;
                        let totCarbs = 0;
                        let totFat = 0;

                        dayMeals.forEach((meal: any, mIdx: number) => {
                          const checkedAltIdx = checkedMeals[`${selectedDay}-${mIdx}`];
                          if (checkedAltIdx !== undefined && checkedAltIdx !== null && meal.alternatives?.[checkedAltIdx]) {
                            const alt = meal.alternatives[checkedAltIdx];
                            totCals += extractNumber(alt.calories);
                            totProt += extractNumber(alt.protein);
                            totCarbs += extractNumber(alt.carbs);
                            totFat += extractNumber(alt.fat);
                          }
                        });

                        return (
                          <div className={`${cardBg} border-2 rounded-2xl p-6 mt-6 mb-8`}>
                            <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'} mb-4 flex items-center gap-2`}>
                              <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              Consumido Hoje ({dayLabels[selectedDay] || selectedDay})
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <span className="block text-[9px] font-black uppercase text-black tracking-widest mb-1.5">Calorias</span>
                                <span className="text-2xl font-black text-slate-500">{totCals.toFixed(0)} <span className="text-xs">kcal</span> <span className="text-[10px] text-slate-400">({uiMacros.dailyCalories} kcal)</span></span>
                              </div>
                              <div>
                                <span className="block text-[9px] font-black uppercase text-black tracking-widest mb-1.5">Proteína</span>
                                <span className="text-2xl font-black text-slate-500">{totProt.toFixed(1)} <span className="text-xs">g</span> <span className="text-[10px] text-slate-400">({uiMacros.protein} g)</span></span>
                              </div>
                              <div>
                                <span className="block text-[9px] font-black uppercase text-black tracking-widest mb-1.5">Carbs</span>
                                <span className="text-2xl font-black text-slate-500">{totCarbs.toFixed(1)} <span className="text-xs">g</span> <span className="text-[10px] text-slate-400">({uiMacros.carbs} g)</span></span>
                              </div>
                              <div>
                                <span className="block text-[9px] font-black uppercase text-black tracking-widest mb-1.5">Gordura</span>
                                <span className="text-2xl font-black text-slate-500">{totFat.toFixed(1)} <span className="text-xs">g</span> <span className="text-[10px] text-slate-400">({uiMacros.fat} g)</span></span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>{/* end meals content */}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* MEAL DETAIL MODAL */}
        {detailMeal && createPortal(
          <div className={`fixed inset-0 z-[2000] flex items-start justify-start transition-all duration-300 ${isClosingDetailMeal ? 'bg-transparent backdrop-blur-none' : 'bg-black/20 backdrop-blur-sm'}`} onClick={handleCloseDetailMeal}>
            <div
              className={`${isDarkMode ? 'bg-slate-900 text-white' : 'bg-white text-slate-800'} w-full h-[100dvh] overflow-y-auto p-6 sm:p-8 shadow-2xl transition-all duration-300 ease-out`}
              style={{
                transformOrigin: `${detailMeal.origin.x}px ${detailMeal.origin.y}px`,
                animation: isClosingDetailMeal ? 'collapseToOrigin 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards' : 'expandFromOrigin 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <style>{`
              @keyframes expandFromOrigin {
                0% { transform: scale(0.5); opacity: 0; }
                100% { transform: scale(1); opacity: 1; }
              }
              @keyframes collapseToOrigin {
                0% { transform: scale(1); opacity: 1; }
                100% { transform: scale(0.5); opacity: 0; }
              }
            `}</style>
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-black text-black">{detailMeal.data.name}</h3>
                <button onClick={handleCloseDetailMeal} className="p-1 rounded-full hover:bg-black/10 transition-colors">
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
          </div>,
          document.body
        )}


        {activeTab === 'dados' && (() => {
          const macros = calcDisplayMacros(currentProfile);
          const restrictionsList: string[] = [];
          if (currentProfile.restrictions?.vegetarian) restrictionsList.push('Vegetariano');
          if (currentProfile.restrictions?.intolerant && currentProfile.restrictions.intoleranceDesc) restrictionsList.push(`Intolerância: ${currentProfile.restrictions.intoleranceDesc}`);
          if (currentProfile.restrictions?.allergies && currentProfile.restrictions.allergiesDesc) restrictionsList.push(`Alergia: ${currentProfile.restrictions.allergiesDesc}`);
          if (currentProfile.restrictions?.dislikedFoods && currentProfile.restrictions.dislikedFoodsDesc) restrictionsList.push(`Não gosta: ${currentProfile.restrictions.dislikedFoodsDesc}`);

          // Círculo de progresso: (pesoAtual / metaPeso) * 100
          // Ex: meta 90kg, peso atual 70kg → 70/90 = 77,8%
          const progressPct = (() => {
            const goal = parseFloat(currentProfile.desiredWeight) || 0;
            const currentWeight = goalEntries.length > 0
              ? parseFloat(goalEntries[goalEntries.length - 1].weight)
              : parseFloat(currentProfile.weight) || 0;
            if (goal === 0) return 0;
            return Math.min(Math.max((currentWeight / goal) * 100, 0), 100);
          })();

          const radius = 60;
          const circ = 2 * Math.PI * radius;
          const offset = circ - (progressPct / 100) * circ;

          const getDeadlineText = () => {
            if (!currentProfile.realisticDeadline || currentProfile.realisticDeadline === 'Sem meta') return '—';

            // Usa sempre a data de hoje como início do prazo (data que foi salvo o perfil)
            // A data em goalEntries está em formato pt-BR DD/MM/YYYY - não parsear diretamente com new Date()
            const startDate = new Date(); // Hoje = data de início do prazo

            const match = currentProfile.realisticDeadline.match(/(\d+)\s*(dias?|meses?|mês|semanas?|anos?)/i);
            if (!match) return currentProfile.realisticDeadline;

            const num = parseInt(match[1]);
            const unit = match[2].toLowerCase();

            const endDate = new Date(startDate);
            if (unit.startsWith('dia')) endDate.setDate(endDate.getDate() + num);
            else if (unit.startsWith('semana')) endDate.setDate(endDate.getDate() + num * 7);
            else if (unit.startsWith('m')) endDate.setMonth(endDate.getMonth() + num);
            else if (unit.startsWith('ano')) endDate.setFullYear(endDate.getFullYear() + num);

            const formatDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            return `${formatDate(startDate)} a ${formatDate(endDate)}`;
          };

          const currentWeightNum = goalEntries.length > 0 ? parseFloat(goalEntries[goalEntries.length - 1].weight) : parseFloat(currentProfile.weight);
          const goalWeightNum = parseFloat(currentProfile.desiredWeight);
          const weightDiffPct = currentWeightNum > 0 ? ((goalWeightNum - currentWeightNum) / currentWeightNum) * 100 : 0;
          const weightDiffText = weightDiffPct > 0 ? `+${weightDiffPct.toFixed(1)}%` : `${weightDiffPct.toFixed(1)}%`;
          const weightDiffColor = weightDiffPct > 0 ? 'text-blue-500' : (weightDiffPct < 0 ? 'text-green-500' : 'text-slate-400');

          return (
            <div className="animate-fadeIn space-y-6">
              {/* Header card */}
              <div className={`${cardBg} border-2 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center gap-6`}>
                {/* Circle progress */}
                <div className="relative flex items-center justify-center w-36 h-36 shrink-0 mx-auto sm:mx-0">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="12" />
                    <circle cx="70" cy="70" r={radius} fill="none" stroke="#94a3b8" strokeWidth="12"
                      strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black text-slate-500">{progressPct.toFixed(0)}%</span>
                    <span className="text-[9px] font-bold text-black mt-1 uppercase tracking-widest">da meta</span>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center">
                    <span className="block text-[10px] font-black uppercase text-black tracking-widest mb-1">Peso Atual</span>
                    <span className={`text-2xl font-black text-blue-900`}>{goalEntries.length > 0 ? goalEntries[goalEntries.length - 1].weight : currentProfile.weight}<span className="text-sm ml-1">kg</span></span>
                  </div>
                  <div className="text-center flex flex-col justify-center items-center">
                    <span className="block text-[10px] font-black uppercase text-black tracking-widest mb-1">Meta</span>
                    <span className="text-2xl font-black text-slate-500 leading-none">{currentProfile.desiredWeight}<span className="text-sm ml-1">kg</span></span>
                    {currentWeightNum !== goalWeightNum && (
                      <span className={`text-[10px] font-bold ${weightDiffColor} mt-1 leading-none`}>({weightDiffText})</span>
                    )}
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] font-black uppercase text-black tracking-widest mb-1">Calorias/dia</span>
                    <span className={`text-2xl font-black text-blue-900`}>{macros.dailyCalories}</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[10px] font-black uppercase text-black tracking-widest mb-1">Prazo</span>
                    <span className={`text-sm font-black text-blue-900`}>{getDeadlineText()}</span>
                  </div>
                </div>

                {/* Edit button */}
                <div className="shrink-0 flex flex-col items-end gap-2">
                  <button
                    onClick={() => { if (onEditProfile) onEditProfile() }}
                    className="w-full flex justify-center items-center gap-2 px-5 py-3 rounded-2xl border-2 border-black bg-black text-white font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar Perfil
                  </button>
                  <button
                    onClick={() => {
                      setQuickWeight(currentProfile.weight);
                      setQuickDesiredWeight(currentProfile.desiredWeight);
                      setIsQuickUpdating(true);
                    }}
                    className="w-full flex justify-center items-center gap-2 px-5 py-3 rounded-2xl border-2 border-slate-200 bg-white text-slate-700 font-black uppercase text-[10px] tracking-widest hover:border-black transition-all hover:scale-105 active:scale-95"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Atualizar
                  </button>
                  {profileChanged && (
                    <button
                      onClick={generateDiet}
                      disabled={isGeneratingDiet}
                      className="w-full flex justify-center items-center gap-2 px-5 py-3 rounded-2xl border-2 border-green-600 bg-green-600 text-white font-black uppercase text-[10px] tracking-widest hover:scale-105 active:scale-95 transition-all animate-pulse disabled:opacity-60 disabled:animate-none mt-1"
                    >
                      {isGeneratingDiet ? (
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      )}
                      {isGeneratingDiet ? 'Gerando...' : 'Gerar Minha Dieta'}
                    </button>
                  )}
                </div>
              </div>

              {/* Three info cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Card 1: Dados Físicos */}
                <div className={`${cardBg} border-2 rounded-3xl p-6`}>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-black mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Dados Físicos
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Peso Inicial', value: `${currentProfile.weight} kg` },
                      { label: 'Altura', value: `${currentProfile.height} cm` },
                      { label: 'Idade', value: `${currentProfile.age} anos` },
                      { label: 'Gênero', value: currentProfile.gender === 'male' ? 'Masculino' : 'Feminino' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center border-b border-black/5 pb-2 last:border-0 last:pb-0">
                        <span className="text-black text-sm font-bold">{row.label}</span>
                        <span className={`font-black text-sm text-blue-900`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 2: Atividade & Objetivo */}
                <div className={`${cardBg} border-2 rounded-3xl p-6`}>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-black mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    Atividade & Objetivo
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Objetivo', value: currentProfile.objective },
                      { label: 'Nível de Atividade', value: currentProfile.activityLevel },
                      { label: 'Treinos/Semana', value: `${currentProfile.weeklyTrainings}x` },
                      { label: 'Intensidade', value: currentProfile.trainingIntensity },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center border-b border-black/5 pb-2 last:border-0 last:pb-0">
                        <span className="text-black text-sm font-bold">{row.label}</span>
                        <span className={`font-black text-sm text-blue-900 text-right max-w-[55%] truncate`}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card 3: Preferências & Restrições */}
                <div className={`${cardBg} border-2 rounded-3xl p-6`}>
                  <h3 className="text-[10px] font-black uppercase tracking-widest text-black mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    Preferências
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Refeições/Dia', value: currentProfile.mealsPerDay },
                      { label: 'Orçamento Mensal', value: `R$ ${currentProfile.monthlyBudget}` },
                      { label: 'Culinária', value: currentProfile.culinaryPreference || '—' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center border-b border-black/5 pb-2 last:border-0 last:pb-0">
                        <span className="text-black text-sm font-bold">{row.label}</span>
                        <span className={`font-black text-sm text-blue-900`}>{row.value}</span>
                      </div>
                    ))}
                    <div className="pt-1">
                      <span className="text-[10px] font-black uppercase tracking-widest text-black block mb-2">Restrições</span>
                      {restrictionsList.length === 0 ? (
                        <span className="text-black font-bold text-xs">Nenhuma restrição</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {restrictionsList.map((r, i) => (
                            <span key={i} className="text-xs font-black text-orange-500 bg-orange-50 px-2 py-1 rounded-lg border border-orange-100">{r}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Macros card */}
              <div className={`${cardBg} border-2 rounded-3xl p-6`}>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-black mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                  Suas Metas Nutricionais Calculadas
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Calorias/dia', value: `${macros.dailyCalories} kcal`, color: 'text-blue-900' },
                    { label: 'Proteína', value: `${macros.protein}g`, color: 'text-blue-900' },
                    { label: 'Carboidratos', value: `${macros.carbs}g`, color: 'text-blue-900' },
                    { label: 'Gordura', value: `${macros.fat}g`, color: 'text-blue-900' },
                  ].map(item => (
                    <div key={item.label} className={`${isDarkMode ? 'bg-slate-800' : 'bg-slate-50'} rounded-2xl p-4 text-center border border-black/5`}>
                      <span className="block text-[9px] font-black uppercase tracking-widest text-black mb-2">{item.label}</span>
                      <span className={`text-xl font-black ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

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
                <button id="btn-hidden-reload-region" onClick={loadRegionData} className="hidden"></button>
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

                <button onClick={() => {
                  localStorage.removeItem('produtivity_nutrition_region');
                  setRegionData(null);
                  // Usamos um truque pequeno para rodar o fetch na próxima task,
                  // escapando do valor estático de regionData que faria ele dar return precoce
                  setTimeout(() => {
                    const btn = document.getElementById('btn-hidden-reload-region');
                    if (btn) btn.click();
                  }, 50);
                }}
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
        {activeTab === 'compras' && isComprasMounted && (
          <div className="text-center py-10">
            <span className="text-4xl mb-3 block">🛒</span>
            <p className={`font-black ${textColor}`}>Abrindo suas compras...</p>
          </div>
        )}
        {(activeTab === 'compras' || isComprasClosing) && createPortal(
          <div
            className={`fixed inset-0 z-[1000] flex flex-col transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isComprasMounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              } ${isDarkMode ? 'bg-black' : 'bg-white'}`}
            style={{ height: '100dvh' }}
          >
            <div className={`flex flex-col sm:flex-row sm:items-start justify-between px-4 sm:px-8 py-4 border-b shrink-0 gap-4 sm:gap-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                <button
                  onClick={handleCloseCompras}
                  className={`px-3 sm:px-4 py-2 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] sm:text-xs tracking-widest shrink-0 ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/10 text-black hover:bg-black/5'}`}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Voltar</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col flex-1 min-h-0 w-full px-4 sm:px-8 py-2 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                {shoppingFlow === 'home' && (
                  <div className="text-center py-4 flex flex-col justify-center h-full min-h-[60vh]">
                    <div className="mb-6">
                      <span className="text-4xl mb-2 block">🛒</span>
                      <h3 className={`text-xl font-black ${textColor} mb-2`}>Listas de Compras</h3>
                      <p className="text-slate-400 font-bold text-sm max-w-md mx-auto">
                        Acesse suas listas salvas ou crie uma nova.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto w-full">
                      <button onClick={() => setShoppingFlow('minhas_listas')}
                        className={`${cardBg} border-2 p-4 rounded-2xl flex items-center justify-center text-center hover:border-black transition-all group`}>
                        <div>
                          <span className={`block font-black text-sm uppercase ${textColor}`}>Minhas Listas</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Ver listas salvas ({savedLists.length})</span>
                        </div>
                      </button>
                      <button onClick={() => setShoppingFlow('options')}
                        className={`${cardBg} border-2 p-4 rounded-2xl flex items-center justify-center text-center hover:border-black transition-all group`}>
                        <div>
                          <span className={`block font-black text-sm uppercase ${textColor}`}>Nova Lista</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Criar lista de compras</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {shoppingFlow === 'minhas_listas' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex justify-center mb-6">
                      <h3 className={`text-lg font-black ${textColor} uppercase tracking-tight`}>Minhas Listas Salvas</h3>
                    </div>
                    {savedLists.length === 0 ? (
                      <div className="text-center py-10 opacity-60">
                        <span className="text-4xl mb-3 block">📝</span>
                        <p className="font-bold text-slate-500">Você ainda não salvou nenhuma lista.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {savedLists.map(list => (
                          <div key={list.id} className={`${cardBg} border-2 p-5 rounded-2xl cursor-pointer hover:border-black transition-all relative group`}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setListIdToDelete(list.id);
                                setShowDeleteListModal(true);
                              }}
                              className="absolute top-3 right-3 text-red-400 hover:text-red-600 p-2 opacity-50 hover:opacity-100 transition-opacity z-10"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                            <div onClick={() => {
                              setShoppingData(list.data);
                              setViewingSavedListId(list.id);
                              setShoppingFlow('list');
                            }}>
                              <h4 className={`font-black text-sm uppercase ${textColor} pr-6`}>{list.name}</h4>
                              <p className="text-slate-400 text-xs font-bold mt-1">{list.date}</p>
                              <div className="mt-3 text-[10px] text-blue-900 font-black uppercase tracking-widest bg-blue-50/50 inline-block px-2 py-1 rounded">
                                {list.data.reduce((acc, cat) => acc + cat.items.length, 0)} itens
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {shoppingFlow === 'options' && (
                  <div className="text-center py-4 flex flex-col justify-center h-full min-h-[70vh]">
                    <div className="mb-6">
                      <span className="text-4xl mb-2 block">🛒</span>
                      <h3 className={`text-xl font-black ${textColor} mb-2`}>Como quer comprar?</h3>
                      <p className="text-slate-400 font-bold text-sm max-w-md mx-auto">
                        Selecione o período para que eu possa calcular as quantidades exatas.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto w-full">
                      <button onClick={() => handleStartShoppingFlow('today')}
                        className={`${cardBg} border-2 p-4 rounded-2xl flex items-center justify-center text-center hover:border-black transition-all group`}>
                        <div>
                          <span className={`block font-black text-sm uppercase ${textColor}`}>Para Hoje</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Refeições de hoje</span>
                        </div>
                      </button>
                      <button onClick={() => handleStartShoppingFlow('day')}
                        className={`${cardBg} border-2 p-4 rounded-2xl flex items-center justify-center text-center hover:border-black transition-all group`}>
                        <div>
                          <span className={`block font-black text-sm uppercase ${textColor}`}>Algum dia da semana</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Escolha um dia específico</span>
                        </div>
                      </button>
                      <button onClick={() => handleStartShoppingFlow('week')}
                        className={`${cardBg} border-2 p-4 rounded-2xl flex items-center justify-center text-center hover:border-black transition-all group`}>
                        <div>
                          <span className={`block font-black text-sm uppercase ${textColor}`}>Para a semana</span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Plano semanal completo</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {shoppingFlow === 'select_days' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex justify-center mb-6">
                      <h3 className={`text-lg font-black ${textColor} uppercase tracking-tight`}>Dias da Semana</h3>
                    </div>

                    <p className="text-sm font-bold text-blue-900 mb-4">Quais dias você deseja planejar?</p>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {dayNames.map(day => {
                        const isSelected = shoppingSelectedDaysList.includes(day);
                        const disabled = shoppingMode === 'today' || shoppingMode === 'week';
                        const showHoje = (shoppingMode === 'today' && isSelected) || day === dayNames[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
                        return (
                          <button key={day}
                            disabled={disabled}
                            onClick={() => {
                              if (disabled) return;
                              if (shoppingMode === 'day') {
                                setShoppingSelectedDaysList([day]);
                              } else {
                                if (isSelected) setShoppingSelectedDaysList(prev => prev.filter(d => d !== day));
                                else setShoppingSelectedDaysList(prev => [...prev, day]);
                              }
                            }}
                            className={`p-4 rounded-xl border-2 font-black transition-all text-sm uppercase flex items-center justify-between ${isSelected ? 'border-black bg-slate-50 text-black' : 'border-slate-100 text-slate-400'} ${disabled ? 'opacity-80 cursor-default' : 'hover:border-slate-300'}`}>
                            <span>{dayLabels[day]} {showHoje && <span className="text-[10px] ml-1 flex-1 opacity-70">(Hoje)</span>}</span>
                            {isSelected && <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-6 border-t border-black/5">
                      <button onClick={() => {
                        if (shoppingSelectedDaysList.length === 0) {
                          setErrorMsg("Selecione pelo menos um dia.");
                          setTimeout(() => setErrorMsg(null), 3000);
                          return;
                        }
                        setShoppingFlow('select_times');
                      }}
                        className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
                        Próximo
                      </button>
                    </div>
                  </div>
                )}

                {shoppingFlow === 'select_times' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex justify-center mb-6">
                      <h3 className={`text-lg font-black ${textColor} uppercase tracking-tight`}>Quais Horários?</h3>
                    </div>

                    <div className="flex justify-between items-center mb-4">
                      <p className="text-sm font-bold text-slate-500">Escolha os horários das refeições que entrarão na lista:</p>

                      {(() => {
                        let totalMeals = 0;
                        let selectedMeals = 0;
                        shoppingSelectedDaysList.forEach(day => {
                          const meals = (dietData?.weeklyDiet || {} as Record<string, any[]>)[day] || [];
                          totalMeals += meals.length;
                          meals.forEach((_, mIdx) => {
                            if (shoppingSelectedTimes[`${day}-${mIdx}`]) selectedMeals++;
                          });
                        });
                        const allSelected = totalMeals > 0 && selectedMeals === totalMeals;

                        return (
                          <button
                            onClick={() => {
                              const newSelection: Record<string, boolean> = {};
                              if (!allSelected) {
                                shoppingSelectedDaysList.forEach(day => {
                                  const meals = (dietData?.weeklyDiet || {} as Record<string, any[]>)[day] || [];
                                  meals.forEach((_, mIdx) => {
                                    newSelection[`${day}-${mIdx}`] = true;
                                  });
                                });
                              }
                              setShoppingSelectedTimes(newSelection);
                            }}
                            className={`font-black uppercase text-[10px] transition-all shrink-0 ${allSelected ? 'text-black' : 'text-slate-400'}`}
                          >
                            {allSelected ? 'Desmarcar Tudo' : 'Selecionar Tudo'}
                          </button>
                        );
                      })()}
                    </div>

                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                      {shoppingSelectedDaysList.map(day => {
                        const meals = (dietData?.weeklyDiet || {} as Record<string, any[]>)[day] || [];
                        if (meals.length === 0) return null;
                        return (
                          <div key={day} className="space-y-2 mb-6">
                            <div className={`text-xs font-black uppercase text-slate-400 mb-2 border-b-2 border-slate-100 pb-1`}>{dayLabels[day]}</div>
                            {meals.map((meal, mIdx) => {
                              const key = `${day}-${mIdx}`;
                              const isSelected = !!shoppingSelectedTimes[key];
                              return (
                                <div key={mIdx} onClick={() => setShoppingSelectedTimes(prev => ({ ...prev, [key]: !prev[key] }))}
                                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'border-black bg-slate-50' : 'border-slate-100'}`}>
                                  <div>
                                    <span className={`block font-black text-sm ${textColor}`}>{meal.meal}</span>
                                    <span className="text-[10px] text-slate-500 font-bold uppercase">{meal.time}</span>
                                  </div>
                                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-black border-black' : 'border-slate-300'}`}>
                                    {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-6 border-t border-black/5">
                      <button onClick={() => {
                        if (Object.values(shoppingSelectedTimes).every(v => !v)) {
                          setErrorMsg("Selecione pelo menos um horário.");
                          setTimeout(() => setErrorMsg(null), 3000);
                          return;
                        }
                        setShoppingFlow('select_meals');
                      }}
                        className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all">
                        Próximo
                      </button>
                    </div>
                  </div>
                )}

                {shoppingFlow === 'select_meals' && (
                  <div className="space-y-6 animate-fadeIn">
                    <div className="flex justify-center mb-6">
                      <h3 className={`text-lg font-black ${textColor} uppercase tracking-tight`}>Quais Opções?</h3>
                    </div>

                    <p className="text-sm font-bold text-slate-500 mb-4">Escolha até 2 opções de refeição para a lista.</p>
                    <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                      {shoppingSelectedDaysList.map(day => {
                        const meals = (dietData?.weeklyDiet || {} as Record<string, any[]>)[day] || [];
                        return meals.map((meal, mIdx) => {
                          const key = `${day}-${mIdx}`;
                          if (!shoppingSelectedTimes[key]) return null;
                          const altsSelected = shoppingSelectedAlts[key] || [];

                          return (
                            <div key={key} className="p-4 rounded-xl border-2 border-slate-100 space-y-3 z-0">
                              <div className="flex justify-between items-center mb-2">
                                <div className="font-black text-sm text-black">{meal.meal} <span className="text-slate-400 font-bold ml-1">({meal.time})</span></div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">{dayLabels[day]}</div>
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                {meal.alternatives.map((alt: any, altIdx: number) => {
                                  const isSelected = altsSelected.includes(altIdx);
                                  return (
                                    <button key={altIdx}
                                      onClick={() => {
                                        setShoppingSelectedAlts(prev => {
                                          const curr = prev[key] || [];
                                          if (curr.includes(altIdx)) {
                                            return { ...prev, [key]: curr.filter(i => i !== altIdx) };
                                          } else {
                                            if (curr.length >= 2) {
                                              setErrorMsg("Você só pode escolher até duas opções por horário.");
                                              setTimeout(() => setErrorMsg(null), 3000);
                                              return prev;
                                            }
                                            return { ...prev, [key]: [...curr, altIdx] };
                                          }
                                        });
                                      }}
                                      className={`p-3 rounded-xl border-2 font-bold text-xs text-left transition-all flex items-center justify-between ${isSelected ? 'border-sky-500 bg-sky-50 text-sky-900' : 'border-slate-100 text-slate-600 hover:border-slate-200'} cursor-pointer`}>
                                      <span className="flex-1 pr-2 truncate">Opção {altIdx + 1}: {alt.name}</span>
                                      <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 ${isSelected ? 'bg-sky-500 border-sky-500' : 'border-slate-300'}`}>
                                        {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })}
                    </div>

                    <div className="pt-6 border-t border-black/5">
                      <button onClick={generateShoppingList} disabled={isLoadingShopping}
                        className="w-full py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">
                        {isLoadingShopping ? 'Gerando Lista...' : 'Gerar Lista Final'}
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

                    <div className="grid grid-cols-1 gap-3 pb-4">
                      <button onClick={handleDownloadPDF}
                        className="w-full py-3 border-2 border-slate-200 bg-white text-black rounded-2xl font-black uppercase text-sm hover:border-black active:scale-95 transition-all flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        Baixar PDF
                      </button>

                      {!viewingSavedListId && (
                        <button onClick={() => {
                          setSaveListNameInput(`Lista ${new Date().toLocaleDateString('pt-BR')}`);
                          setShowSaveListModal(true);
                        }}
                          className="w-full py-3 bg-black text-white rounded-2xl font-black uppercase text-sm shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          Salvar Lista
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Save List Modal */}
            {showSaveListModal && (
              <div className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">
                <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} p-6 rounded-2xl max-w-sm w-full space-y-4 animate-fadeIn shadow-2xl`}>
                  <h4 className={`text-lg font-black ${textColor}`}>Nome da Lista</h4>
                  <p className="text-sm text-slate-500 font-bold font-sans">Como deseja chamar esta lista para encontrá-la depois?</p>

                  <input
                    type="text"
                    value={saveListNameInput}
                    onChange={e => setSaveListNameInput(e.target.value)}
                    className="w-full p-3 rounded-xl border-2 border-slate-200 focus:border-black outline-none transition-colors"
                  />

                  <div className="pt-2 grid grid-cols-2 gap-3 w-full">
                    <button onClick={() => setShowSaveListModal(false)}
                      className="py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-black uppercase text-sm hover:border-black hover:text-black transition-all">
                      Cancelar
                    </button>
                    <button onClick={() => {
                      if (!saveListNameInput.trim()) return;
                      const newList = {
                        id: Date.now().toString(),
                        date: new Date().toLocaleDateString('pt-BR'),
                        name: saveListNameInput.trim(),
                        data: shoppingData!
                      };
                      const updated = [newList, ...savedLists];
                      setSavedLists(updated);
                      localStorage.setItem('produtivity_nutrition_saved_lists', JSON.stringify(updated));
                      setViewingSavedListId(newList.id);
                      setShowSaveListModal(false);
                      setShoppingFlow('minhas_listas');
                    }}
                      className="py-3 rounded-xl bg-black text-white font-black uppercase text-sm hover:scale-105 transition-all shadow-xl">
                      Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete List Modal */}
            {showDeleteListModal && (
              <div className="fixed inset-0 z-[1100] bg-black/50 flex items-center justify-center p-4">
                <div className={`${isDarkMode ? 'bg-slate-900' : 'bg-white'} p-6 rounded-2xl max-w-sm w-full space-y-4 animate-fadeIn shadow-2xl`}>
                  <h4 className={`text-lg font-black text-red-500`}>Excluir Lista?</h4>
                  <p className="text-sm text-slate-500 font-bold font-sans">Tem certeza que deseja apagar esta lista? Esta ação não pode ser desfeita.</p>

                  <div className="pt-2 grid grid-cols-2 gap-3 w-full">
                    <button onClick={() => {
                      setShowDeleteListModal(false);
                      setListIdToDelete(null);
                    }}
                      className="py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-black uppercase text-sm hover:border-black hover:text-black transition-all">
                      Cancelar
                    </button>
                    <button onClick={() => {
                      if (listIdToDelete) {
                        const updated = savedLists.filter(l => l.id !== listIdToDelete);
                        setSavedLists(updated);
                        localStorage.setItem('produtivity_nutrition_saved_lists', JSON.stringify(updated));
                      }
                      setShowDeleteListModal(false);
                      setListIdToDelete(null);
                    }}
                      className="py-3 rounded-xl bg-red-500 text-white font-black uppercase text-sm hover:scale-105 transition-all shadow-xl">
                      Sim, Excluir
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>,
          document.body
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
                  <span className={`font-black text-sm ${textColor}`}>{calcDisplayMacros(profile).dailyCalories || '-'} kcal</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-900 text-sm font-bold">Proteína</span>
                  <span className={`font-black text-sm ${textColor}`}>{calcDisplayMacros(profile).protein || '-'}g</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-900 text-sm font-bold">Custo mensal</span>
                  <span className="font-black text-sm text-slate-500">R${profile?.monthlyBudget || dietData?.monthlyEstimatedCost || '-'}</span>
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

            {/* Header com sugestões ao lado do emoji */}
            <div className={`flex flex-col sm:flex-row sm:items-start justify-between px-4 sm:px-8 py-4 border-b shrink-0 gap-4 sm:gap-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
                <button
                  onClick={handleCloseChat}
                  className={`px-3 sm:px-4 py-2 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] sm:text-xs tracking-widest shrink-0 ${isDarkMode ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/10 text-black hover:bg-black/5'}`}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Voltar</span>
                </button>
                <div className="flex flex-wrap gap-2 items-center">
                  {(showAllCommands ? quickCommands : quickCommands.slice(0, 3)).map(cmd => (
                    <button key={cmd} onClick={() => setChatInput(cmd)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border ${isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300'}`}>
                      {cmd}
                    </button>
                  ))}
                  {!showAllCommands && quickCommands.length > 3 && (
                    <button onClick={() => setShowAllCommands(true)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isDarkMode ? 'text-sky-400 border-sky-900/50 bg-sky-900/20 hover:bg-sky-900/40' : 'text-white border-slate-300 bg-slate-400 hover:bg-slate-500'}`}>
                      + mais
                    </button>
                  )}
                  {showAllCommands && (
                    <button onClick={() => setShowAllCommands(false)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border border-transparent ${isDarkMode ? 'text-slate-400 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                      - ocultar
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setShowChatHistory(true)}
                  className={`px-3 sm:px-4 py-2 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] sm:text-xs tracking-widest border-[#4A69A2] bg-[#4A69A2] text-white hover:bg-[#3b5482] hover:border-[#3b5482]`}
                  title="Histórico de Conversas"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Histórico</span>
                </button>
                <button
                  onClick={() => setShowNewChatConfirm(true)}
                  className={`px-3 sm:px-4 py-2 rounded-2xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] sm:text-xs tracking-widest border-[#4A69A2] bg-[#4A69A2] text-white hover:bg-[#3b5482] hover:border-[#3b5482]`}
                  title="Nova Conversa"
                >
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Nova</span>
                </button>
              </div>
            </div>

            {/* Chat content */}
            <div className="flex flex-col flex-1 min-h-0 w-full px-4 sm:px-8 py-4">

              {/* Meal context banner — shown briefly when "Mudar Algo" is triggered */}
              {isChatLoading && chatMessages.length > 0 && chatMessages[chatMessages.length - 1]?.role === 'user' && chatMessages[chatMessages.length - 1]?.content?.includes('MACROS ATUAIS') && (
                <div className="mb-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl flex items-center gap-2 shrink-0 animate-fadeIn">
                  <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Maria recebeu todos os dados da refeição e está analisando suas opções...</span>
                </div>
              )}

              {/* Messages (Now on top, expanding to fill space) */}
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-4 custom-scrollbar pb-6">
                {chatMessages.length === 0 && (
                  <div className="flex justify-start mt-4">
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-black/10'}`}>
                      <span className="text-sm">👩‍⚕️</span>
                    </div>
                    <div className="bg-sky-50 text-slate-800 border border-sky-100 rounded-bl-sm max-w-full sm:max-w-[80%] px-5 py-3.5 rounded-2xl text-sm font-medium shadow-sm">
                      Olá! Sou a <strong>Maria</strong>, sua nutricionista pessoal.
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
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-black/10'}`}>
                        <span className="text-sm">👩‍⚕️</span>
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
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mr-2 mt-1 shadow-sm ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-black/10'}`}>
                      <span className="text-sm">👩‍⚕️</span>
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



              {/* Input (Now at the bottom with auto-expand) */}
              <div className="flex gap-3 shrink-0 items-end">
                <textarea
                  value={chatInput}
                  onChange={e => {
                    setChatInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (chatInput.trim() && !isChatLoading) {
                        sendChatMessage();
                        e.currentTarget.style.height = 'auto';
                      }
                    }
                  }}
                  placeholder="Pergunte sobre sua dieta..."
                  rows={1}
                  className={`flex-1 p-4 border-2 rounded-2xl font-bold text-sm outline-none transition-all resize-none custom-scrollbar ${inputBg}`}
                  style={{ minHeight: '56px', maxHeight: '200px' }}
                />
                <button
                  onClick={(e) => {
                    sendChatMessage();
                    const textarea = e.currentTarget.previousElementSibling as HTMLTextAreaElement;
                    if (textarea) textarea.style.height = 'auto';
                  }}
                  disabled={isChatLoading || !chatInput.trim()}
                  className={`px-6 py-4 rounded-2xl font-black uppercase text-xs hover:scale-105 active:scale-95 transition-all h-[56px] shrink-0 bg-black text-white ${(!chatInput.trim() || isChatLoading) ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                  {isChatLoading ? '...' : 'Enviar'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }

      {/* Chat History Modal */}
      {showChatHistory && createPortal(
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-fadeIn max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Histórico de Conversas</h3>
              <button onClick={() => setShowChatHistory(false)} className="w-8 h-8 flex items-center justify-center border-2 border-slate-200 rounded-xl text-slate-400 hover:text-black hover:border-black transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
              {chatHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-bold text-sm">Nenhuma conversa salva no histórico.</div>
              ) : (
                chatHistory.map(entry => (
                  <div key={entry.id} className="group relative bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl hover:border-[#4A69A2] hover:bg-blue-50/30 transition-all cursor-pointer overflow-hidden flex flex-col justify-center min-h-[5rem]"
                    onClick={() => {
                      if (editingChatId) return;
                      saveCurrentChatToHistory();
                      setChatMessages([...entry.messages]);
                      setActiveHistoryId(entry.id); // track which entry we resumed
                      localStorage.setItem('produtivity_nutrition_chat', JSON.stringify(entry.messages));
                      setShowChatHistory(false);
                    }}>
                    {editingChatId === entry.id ? (
                      <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editChatTitle}
                          onChange={e => setEditChatTitle(e.target.value)}
                          className="w-full p-2 border-2 border-[#4A69A2] rounded-xl font-bold text-slate-800 outline-none"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              const updated = chatHistory.map(h => h.id === entry.id ? { ...h, title: editChatTitle || 'Sem título' } : h);
                              setChatHistory(updated);
                              localStorage.setItem('produtivity_nutrition_chat_history', JSON.stringify(updated));
                              setEditingChatId(null);
                            } else if (e.key === 'Escape') setEditingChatId(null);
                          }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => {
                            const updated = chatHistory.map(h => h.id === entry.id ? { ...h, title: editChatTitle || 'Sem título' } : h);
                            setChatHistory(updated);
                            localStorage.setItem('produtivity_nutrition_chat_history', JSON.stringify(updated));
                            setEditingChatId(null);
                          }} className="text-[10px] uppercase tracking-widest font-black text-white bg-[#4A69A2] px-3 py-1.5 rounded-lg border-2 border-[#4A69A2] hover:bg-[#3b5482]">Salvar</button>
                          <button onClick={() => setEditingChatId(null)} className="text-[10px] uppercase tracking-widest font-black text-slate-500 bg-slate-200 px-3 py-1.5 rounded-lg border-2 border-slate-300 hover:bg-slate-300">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-black text-slate-800 text-sm pr-16">{entry.title}</h4>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{entry.date} • {entry.messages.length} msgs</span>

                        <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity bg-slate-50 group-hover:bg-[#f2f6fc] pl-2 py-2">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setEditingChatId(entry.id);
                            setEditChatTitle(entry.title);
                          }} className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors border border-transparent hover:border-blue-200" title="Editar nome">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            setChatToDelete(entry.id);
                          }} className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors border border-transparent hover:border-red-200" title="Apagar conversa">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Delete Chat Conform Modal */}
      {chatToDelete && createPortal(
        <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fadeIn text-center">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">
              Apagar Conversa?
            </h3>
            <p className="text-sm font-bold text-slate-500 mb-8">
              Esta ação removerá a conversa do seu histórico permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setChatToDelete(null)}
                className="flex-1 py-3 px-4 font-black text-slate-500 uppercase tracking-widest text-xs border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const updated = chatHistory.filter(h => h.id !== chatToDelete);
                  setChatHistory(updated);
                  localStorage.setItem('produtivity_nutrition_chat_history', JSON.stringify(updated));
                  setChatToDelete(null);
                }}
                className="flex-1 py-3 px-4 font-black text-white bg-red-500 uppercase tracking-widest text-xs border-2 border-red-500 rounded-xl hover:bg-red-600 hover:border-red-600 transition-colors"
              >
                Apagar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* New Chat Custom Modal */}
      {showNewChatConfirm && createPortal(
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fadeIn text-center">
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">
              Iniciar nova conversa?
            </h3>
            <p className="text-sm font-bold text-slate-500 mb-8">
              {chatMessages.length > 1
                ? "Sua conversa atual será fechada e salva automaticamente no seu Histórico de Conversas."
                : "A conversa atual será apagada e uma nova será iniciada."}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewChatConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl font-black bg-slate-100 text-slate-500 hover:bg-slate-200 uppercase text-xs tracking-widest transition-colors border-2 border-slate-200"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  saveCurrentChatToHistory();
                  const initMsg = [{
                    role: 'assistant' as const,
                    content: 'Olá! Eu sou a Maria, sua nutricionista pessoal.\n\nEstou aqui para cuidar de cada detalhe da sua alimentação. Eu conheço suas metas e restrições, e tenho autonomia total para ajustar sua dieta sempre que precisar.\n\nComo posso te ajudar hoje?'
                  }];
                  setChatMessages(initMsg);
                  setActiveHistoryId(null); // fresh conversation, no active history entry
                  localStorage.setItem('produtivity_nutrition_chat', JSON.stringify(initMsg));
                  setShowNewChatConfirm(false);
                }}
                className="flex-1 py-3 px-4 rounded-xl font-black bg-[#4A69A2] text-white hover:bg-[#3b5482] uppercase text-xs tracking-widest transition-colors border-2 border-[#4A69A2]"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Quick Update Modal */}
      {isQuickUpdating && createPortal(
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-fadeIn">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Atualizar Medidas</h3>
              <button onClick={() => setIsQuickUpdating(false)} className="w-8 h-8 flex items-center justify-center border-2 border-slate-200 rounded-xl text-slate-400 hover:text-black hover:border-black transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Peso Atual (kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickWeight}
                  onChange={e => setQuickWeight(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="w-full p-4 border-2 border-slate-200 rounded-xl font-black text-slate-800 focus:border-blue-500 focus:bg-blue-50 transition-all outline-none"
                  placeholder="Ex: 75.5"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest ml-1">Meta Desejada (kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={quickDesiredWeight}
                  onChange={e => setQuickDesiredWeight(e.target.value.replace(/[^0-9.,]/g, ''))}
                  className="w-full p-4 border-2 border-slate-200 rounded-xl font-black text-slate-800 focus:border-green-500 focus:bg-green-50 transition-all outline-none"
                  placeholder="Ex: 68.0"
                />
              </div>

              <button
                onClick={() => {
                  const newWeight = quickWeight.replace(',', '.');
                  const newMeta = quickDesiredWeight.replace(',', '.');

                  if (!newWeight || !newMeta || isNaN(Number(newWeight)) || isNaN(Number(newMeta))) {
                    setSuccessMsg("Preencha valores numéricos validos.");
                    setTimeout(() => setSuccessMsg(null), 3000);
                    return;
                  }

                  const newProfile: NutritionProfile = {
                    ...currentProfile,
                    weight: newWeight,
                    desiredWeight: newMeta
                  };

                  const changed = newWeight !== currentProfile.weight || newMeta !== currentProfile.desiredWeight;

                  // Always save local first
                  localStorage.setItem('produtivity_nutrition_profile', JSON.stringify(newProfile));
                  if (changed) {
                    localStorage.setItem('produtivity_nutrition_profile_changed', 'true');
                    setProfileChanged(true);
                  } else {
                    localStorage.removeItem('produtivity_nutrition_profile_changed');
                    setProfileChanged(false);
                  }

                  // Force update goalEntries so the UI reflects the new weight immediately
                  const currentLatestWeight = goalEntries.length > 0 ? goalEntries[goalEntries.length - 1].weight : currentProfile.weight;
                  if (newWeight !== currentLatestWeight) {
                    const updatedGoals = [...goalEntries, { date: new Date().toISOString(), weight: newWeight }];
                    setGoalEntries(updatedGoals);
                    localStorage.setItem('produtivity_nutrition_goals', JSON.stringify(updatedGoals));
                  }

                  // Propagate to Others (which triggers setNutritionProfile up there)
                  if (onProfileUpdate) {
                    onProfileUpdate(newProfile);
                  }

                  setIsQuickUpdating(false);
                  setSuccessMsg(changed ? 'Medidas atualizadas! Clique em "Gerar Minha Dieta" para ajustar seus nutrientes.' : 'Nenhuma alteração detectada.');
                  setTimeout(() => setSuccessMsg(null), 3500);
                }}
                className="w-full py-4 mt-2 bg-black text-white rounded-xl font-black text-xs uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div >
  );
};

export default NutritionModule;

