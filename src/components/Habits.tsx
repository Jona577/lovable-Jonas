
import React, { useState, useEffect, useRef } from 'react';

type ViewState = 'list' | 'categories' | 'create_category' | 'add_type_selection' | 'suggested_list' | 'custom_form';
type HabitType = 'adquirir' | 'abandonar';
type Frequency = 'Diário' | 'Semanal' | 'Específico';
type DurationType = 'longo' | 'rapido' | 'sem_duracao';
type GoalType = 'sem_meta' | 'dias' | 'meses' | 'anos';
type Difficulty = 'fácil' | 'médio' | 'difícil';
type HabitSort = 'intention' | 'alphabetical' | 'frequency' | 'repetition' | 'duration' | 'goal' | 'time' | 'consistency' | 'category';

interface DailyLog {
  difficulty: Difficulty;
  strategy?: string;
}

interface HabitCategory {
  id: string;
  name: string;
  color: string;
}

interface HabitRecord {
  id: string;
  title: string;
  type: HabitType;
  frequency: Frequency;
  selectedDays?: string[];
  timesPerDay?: number;
  durationType: DurationType;
  durationHours?: number;
  durationMinutes?: number;
  goalType: GoalType;
  goalValue?: number;
  timeEnabled: boolean;
  time?: string;
  location?: string;
  afterActivity?: string;
  motivation?: string;
  successFeeling?: string;
  difficulties?: string;
  overcomeStrategy?: string;
  supportNetwork?: string;
  categoryName?: string;
  categoryId?: string;
  categoryColor?: string;
  createdAt: string;
  lastModified: string;
  completedDates: string[]; // Formato YYYY-MM-DD
  dailyLogs?: Record<string, DailyLog>; // Mapeamento data -> log
}

interface HabitsProps {
  isDarkMode?: boolean;
}

const weekDaysLong = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
const customColors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#c084fc', '#f472b6', '#fb923c'];

const suggestedHabitsConfig: Record<string, { type: HabitType, icon: string }> = {
  "Beber água": { type: 'adquirir', icon: '💧' },
  "Meditar 5min": { type: 'adquirir', icon: '🧘' },
  "Leitura matinal": { type: 'adquirir', icon: '📚' },
  "Exercício físico": { type: 'adquirir', icon: '🏋️' },
  "Parar de fumar": { type: 'abandonar', icon: '🚭' },
  "Reduzir redes sociais": { type: 'abandonar', icon: '📱' },
  "Parar de roer unhas": { type: 'abandonar', icon: '💅' },
  "Dormir sem celular": { type: 'abandonar', icon: '📵' }
};

const suggestedHabits = Object.keys(suggestedHabitsConfig);

const Habits: React.FC<HabitsProps> = ({ isDarkMode }) => {
  const [view, setView] = useState<ViewState>('list');
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [categories, setCategories] = useState<HabitCategory[]>([]);
  const [showExtraOptions, setShowExtraOptions] = useState(false);
  const [showValidationAlert, setShowValidationAlert] = useState(false);
  const [showDayWarning, setShowDayWarning] = useState(false);
  const [isRecommendedMode, setIsRecommendedMode] = useState(false);
  const [sortBy, setSortBy] = useState<HabitSort>('alphabetical');

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStep, setSaveStep] = useState<'initial' | 'picking' | 'confirm'>('initial');
  const [tempCat, setTempCat] = useState<HabitCategory | null>(null);

  const [habitBeingCompleted, setHabitBeingCompleted] = useState<HabitRecord | null>(null);
  const [completionStep, setCompletionStep] = useState<'idle' | 'timer_prompt' | 'timer_running' | 'difficulty'>('idle');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  const [difficultyStrategy, setDifficultyStrategy] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(true);
  const timerRef = useRef<number | null>(null);

  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<HabitRecord>>({
    type: 'adquirir',
    title: '',
    frequency: 'Diário',
    selectedDays: [],
    timesPerDay: 1,
    durationType: 'rapido',
    durationHours: 0,
    durationMinutes: 30,
    goalType: 'sem_meta',
    goalValue: 1,
    timeEnabled: true,
    time: '09:00',
    completedDates: []
  });

  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState(customColors[0]);
  const [editingHabitCategory, setEditingHabitCategory] = useState<HabitCategory | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<HabitRecord | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<HabitCategory | null>(null);

  useEffect(() => {
    const savedHabits = localStorage.getItem('produtivity_habits_record_list');
    if (savedHabits) setHabits(JSON.parse(savedHabits));
    const savedCats = localStorage.getItem('produtivity_habits_cats');
    if (savedCats) setCategories(JSON.parse(savedCats));

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const playDoneSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextClass();

      const playNote = (freq: number, startTime: number) => {
        const osc = context.createOscillator();
        const gain = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.4, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(startTime);
        osc.stop(startTime + 0.6);
      };

      const now = context.currentTime;
      for (let i = 0; i < 3; i++) {
        const startOffset = i * 1.5;
        playNote(880, now + startOffset);
        playNote(880, now + startOffset + 0.2);
        playNote(1108.73, now + startOffset + 0.4);
      }
    } catch (e) {
      console.warn("Audio Context não suportado.");
    }
  };

  useEffect(() => {
    if (completionStep === 'timer_running' && !isTimerPaused && timeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);

            playDoneSound();
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Tempo Esgotado!", {
                body: `O tempo planejado para o hábito "${habitBeingCompleted?.title}" terminou. Hora de avaliar!`,
                icon: "/favicon.ico"
              });
            }

            setCompletionStep('difficulty');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [completionStep, isTimerPaused, timeLeft, habitBeingCompleted]);

  const getLocalDateStr = (d: Date = new Date()) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTodayDayName = () => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[new Date().getDay()];
  };

  const isDayCompletedInCurrentWeek = (habit: HabitRecord, dayName: string) => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(new Date(today).setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const dayIndex = weekDaysLong.indexOf(dayName);
    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayIndex);

    const targetDateStr = getLocalDateStr(targetDate);
    return habit.completedDates.includes(targetDateStr);
  };

  const saveHabitsLocal = (updated: HabitRecord[]) => {
    setHabits(updated);
    localStorage.setItem('produtivity_habits_record_list', JSON.stringify(updated));
  };

  const saveCategoriesLocal = (updated: HabitCategory[]) => {
    setCategories(updated);
    localStorage.setItem('produtivity_habits_cats', JSON.stringify(updated));
  };

  const handleTriggerSave = () => {
    if (!form.title?.trim()) {
      setShowValidationAlert(true);
      return;
    }

    if (form.id && habits.some(h => h.id === form.id)) {
      finalizeSaveHabit();
      return;
    }

    setShowSaveModal(true);
    setSaveStep('initial');
    setTempCat(null);
  };

  const finalizeSaveHabit = () => {
    const now = new Date().toLocaleString('pt-BR');
    const defaultColor = '#e2e8f0';
    const existing = form.id ? habits.find(h => h.id === form.id) : null;

    const newRecord: HabitRecord = {
      ...(form as HabitRecord),
      id: form.id || Date.now().toString(),
      createdAt: form.createdAt || now,
      lastModified: now,
      categoryId: tempCat ? tempCat.id : (existing?.categoryId || form.categoryId),
      categoryName: tempCat ? tempCat.name : (existing?.categoryName || form.categoryName || 'Sem categoria'),
      categoryColor: tempCat ? tempCat.color : (existing?.categoryColor || form.categoryColor || defaultColor),
      completedDates: form.completedDates || [],
      dailyLogs: form.dailyLogs || {}
    };

    const existsIndex = habits.findIndex(h => h.id === newRecord.id);
    if (existsIndex !== -1) {
      const updated = [...habits];
      updated[existsIndex] = newRecord;
      saveHabitsLocal(updated);
    } else {
      saveHabitsLocal([newRecord, ...habits]);
    }

    setView('list');
    setShowSaveModal(false);
    resetForm();
  };

  const resetForm = () => {
    setForm({
      type: 'adquirir',
      title: '',
      frequency: 'Diário',
      selectedDays: [],
      timesPerDay: 1,
      durationType: 'rapido',
      durationHours: 0,
      durationMinutes: 30,
      goalType: 'sem_meta',
      goalValue: 1,
      timeEnabled: true,
      time: '09:00',
      completedDates: [],
      dailyLogs: {}
    });
    setShowExtraOptions(false);
    setTempCat(null);
    setIsRecommendedMode(false);
  };

  const toggleDay = (day: string) => {
    const currentDays = form.selectedDays || [];
    if (form.frequency === 'Semanal') {
      setForm(prev => ({ ...prev, selectedDays: [day] }));
    } else if (form.frequency === 'Específico') {
      if (currentDays.includes(day)) {
        setForm(prev => ({ ...prev, selectedDays: currentDays.filter(d => d !== day) }));
      } else if (currentDays.length < 7) {
        setForm(prev => ({ ...prev, selectedDays: [...currentDays, day] }));
      }
    }
  };

  const handleNumericChange = (field: keyof HabitRecord, val: string) => {
    if (val === '') {
      setForm(prev => ({ ...prev, [field]: undefined }));
      return;
    }
    let parsed = parseInt(val);
    if (isNaN(parsed)) parsed = 0;
    if (field === 'durationHours') parsed = Math.min(23, parsed);
    if (field === 'durationMinutes') parsed = Math.min(59, parsed);
    if (field === 'goalValue') {
      if (form.goalType === 'dias') parsed = Math.min(31, parsed);
      if (form.goalType === 'meses') parsed = Math.min(12, parsed);
      if (form.goalType === 'anos') parsed = Math.min(10, parsed);
    }
    setForm(prev => ({ ...prev, [field]: parsed }));
  };

  const toggleHabitCompletion = (habit: HabitRecord) => {
    const today = getLocalDateStr();
    const countToday = habit.completedDates.filter(d => d === today).length;

    if (habit.frequency === 'Semanal' || habit.frequency === 'Específico') {
      const todayName = getTodayDayName();
      const isAllowedDay = habit.selectedDays?.includes(todayName);

      if (!isAllowedDay) {
        setShowDayWarning(true);
        return;
      }
    }

    const limit = habit.type === 'abandonar' ? 1 : (habit.frequency === 'Diário' ? (habit.timesPerDay || 1) : 1);

    if (countToday < limit) {
      setHabitBeingCompleted(habit);
      setSelectedDifficulty(null);
      setDifficultyStrategy('');

      if (habit.type === 'adquirir' && habit.durationType !== 'sem_duracao') {
        setCompletionStep('timer_prompt');
      } else {
        setCompletionStep('difficulty');
      }
    }
  };

  const startTimerProcess = () => {
    if (!habitBeingCompleted) return;
    const h = habitBeingCompleted.durationHours || 0;
    const m = habitBeingCompleted.durationMinutes || 0;
    const totalSecs = (h * 3600) + (m * 60);
    setTimeLeft(totalSecs);
    setIsTimerPaused(true);
    setCompletionStep('timer_running');
  };

  const restartTimer = () => {
    if (!habitBeingCompleted) return;
    const h = habitBeingCompleted.durationHours || 0;
    const m = habitBeingCompleted.durationMinutes || 0;
    const totalSecs = (h * 3600) + (m * 60);
    setTimeLeft(totalSecs);
    setIsTimerPaused(true);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const finalizeCompletion = () => {
    if (!habitBeingCompleted) return;
    const today = getLocalDateStr();

    const newDates = [...habitBeingCompleted.completedDates, today];

    const newLogs = { ...(habitBeingCompleted.dailyLogs || {}) };
    newLogs[today] = {
      difficulty: selectedDifficulty!,
      strategy: selectedDifficulty === 'difícil' ? difficultyStrategy : undefined
    };

    const updatedHabits = habits.map(h => h.id === habitBeingCompleted.id ? { ...h, completedDates: newDates, dailyLogs: newLogs } : h);
    saveHabitsLocal(updatedHabits);

    setHabitBeingCompleted(null);
    setCompletionStep('idle');
    setSelectedDifficulty(null);
    setDifficultyStrategy('');
    setIsTimerPaused(true);
  };

  const calculateStreak = (completedDates: string[]) => {
    if (!completedDates || completedDates.length === 0) return 0;
    const uniqueCompletedDates = new Set(completedDates);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const todayStr = getLocalDateStr(today);
    const yesterdayStr = getLocalDateStr(yesterday);
    if (!uniqueCompletedDates.has(todayStr) && !uniqueCompletedDates.has(yesterdayStr)) return 0;
    let streak = 0;
    let checkDate = new Date(uniqueCompletedDates.has(todayStr) ? today : yesterday);
    while (true) {
      const dateStr = getLocalDateStr(checkDate);
      if (uniqueCompletedDates.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else { break; }
    }
    return streak;
  };

  const calculateMonthlyTotal = (completedDates: string[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const uniqueInMonth = new Set(
      completedDates.filter(dateStr => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const dObj = new Date(y, m - 1, d);
        return dObj.getMonth() === currentMonth && dObj.getFullYear() === currentYear;
      })
    );
    return uniqueInMonth.size;
  };

  const getGoalProgress = (habit: HabitRecord) => {
    if (habit.goalType === 'sem_meta') return { text: 'Sem meta', percent: 0 };
    const currentProgress = new Set(habit.completedDates).size;
    let totalGoalDays = 0;
    const val = habit.goalValue || 0;
    if (habit.goalType === 'dias') totalGoalDays = val;
    else if (habit.goalType === 'meses') totalGoalDays = val * 30;
    else if (habit.goalType === 'anos') totalGoalDays = val * 365;
    const percent = Math.min(100, Math.round((currentProgress / totalGoalDays) * 100));
    let description = '';
    if (totalGoalDays > 31) {
      const years = Math.floor(totalGoalDays / 365);
      const remainingAfterYears = totalGoalDays % 365;
      const months = Math.floor(remainingAfterYears / 30);
      const days = remainingAfterYears % 30;
      let parts = [];
      if (years > 0) parts.push(`${years} ${years === 1 ? 'ano' : 'anos'}`);
      if (months > 0) parts.push(`${months} ${months === 1 ? 'mês' : 'meses'}`);
      if (days > 0) parts.push(`${days} ${days === 1 ? 'dia' : 'dias'}`);
      description = ` (${parts.join(' e ')})`;
    }
    return { text: `${currentProgress}/${totalGoalDays} dias${description}`, percent };
  };

  const getSortedHabits = () => {
    return [...habits].sort((a, b) => {
      switch (sortBy) {
        case 'intention':
          if (a.type === b.type) return a.title.localeCompare(b.title);
          return a.type === 'adquirir' ? -1 : 1;
        case 'alphabetical':
          return a.title.localeCompare(b.title);
        case 'frequency': {
          const weights = { 'Diário': 0, 'Semanal': 1, 'Específico': 2 };
          const weightA = weights[a.frequency] ?? 3;
          const weightB = weights[b.frequency] ?? 3;
          if (weightA !== weightB) return weightA - weightB;
          return a.title.localeCompare(b.title);
        }
        case 'repetition': {
          const repA = a.timesPerDay || 0;
          const repB = b.timesPerDay || 0;
          if (repA !== repB) return repB - repA;
          return a.title.localeCompare(b.title);
        }
        case 'duration': {
          const weights = { 'longo': 0, 'rapido': 1, 'sem_duracao': 2 };
          const weightA = weights[a.durationType];
          const weightB = weights[b.durationType];
          if (weightA !== weightB) return weightA - weightB;
          return a.title.localeCompare(b.title);
        }
        case 'goal': {
          const weights = { 'anos': 0, 'meses': 1, 'dias': 2, 'sem_meta': 3 };
          const weightA = weights[a.goalType];
          const weightB = weights[b.goalType];
          if (weightA !== weightB) return weightA - weightB;
          return a.title.localeCompare(b.title);
        }
        case 'time': {
          // Normaliza se tem horário efetivo ou não
          const timeA = (a.type === 'adquirir' && a.timeEnabled) ? a.time : null;
          const timeB = (b.type === 'adquirir' && b.timeEnabled) ? b.time : null;

          if (!timeA && !timeB) return a.title.localeCompare(b.title);
          if (!timeA) return 1; // Sem horário vai por último
          if (!timeB) return -1; // Com horário vem primeiro
          return timeA.localeCompare(timeB); // Compara strings HH:MM
        }
        case 'consistency': {
          const countA = new Set(a.completedDates).size;
          const countB = new Set(b.completedDates).size;
          if (countA !== countB) return countB - countA;
          return a.title.localeCompare(b.title);
        }
        case 'category': {
          const catA = a.categoryName || '';
          const catB = b.categoryName || '';
          const isAUncategorized = catA === '' || catA === 'Sem categoria';
          const isBUncategorized = catB === '' || catB === 'Sem categoria';
          if (!isAUncategorized && isBUncategorized) return -1;
          if (isAUncategorized && !isBUncategorized) return 1;
          if (!isAUncategorized && !isBUncategorized) {
            if (catA === catB) return a.title.localeCompare(b.title);
            return catA.localeCompare(catB);
          }
          return a.title.localeCompare(b.title);
        }
        default:
          return 0;
      }
    });
  };

  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';

  const renderValidationModal = () => {
    if (!showValidationAlert) return null;
    return (
      <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-[3px] border-black">
          <div className="w-20 h-20 bg-white border-[3px] border-yellow-400 rounded-full flex items-center justify-center mx-auto mb-6">
            <div className="w-12 h-12 border-[3px] border-yellow-400 rounded-full flex flex-col items-center justify-center">
              <span className="text-yellow-400 font-black text-2xl">!</span>
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">OPA</h3>
          <p className="text-slate-500 font-bold mb-8">Por favor, digite um nome para o hábito</p>
          <button onClick={() => setShowValidationAlert(false)} className="w-full py-4 bg-[#3B82F6] text-white font-black rounded-2xl shadow-[0_4px_0_0_#2563EB] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all">Entendido</button>
        </div>
      </div>
    );
  };

  const renderDayWarningModal = () => {
    if (!showDayWarning) return null;
    return (
      <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center border-[3px] border-black">
          <div className="w-20 h-20 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-2 uppercase tracking-tighter">ATENÇÃO</h3>
          <p className="text-slate-500 font-bold mb-8 leading-tight">Você só pode marcar este hábito nos dias da semana selecionados em sua configuração.</p>
          <button onClick={() => setShowDayWarning(false)} className="w-full py-4 bg-red-500 text-white font-black rounded-2xl shadow-[0_4px_0_0_#B91C1C] hover:brightness-110 active:translate-y-[2px] active:shadow-none transition-all">Entendido</button>
        </div>
      </div>
    );
  };

  const renderTimerPromptModal = () => {
    if (completionStep !== 'timer_prompt') return null;
    return (
      <div className="fixed inset-0 z-[2500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-[3px] border-black">
          <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-4 uppercase tracking-tighter leading-tight">Quer cronometrar?</h3>
          <div className="flex gap-4">
            <button onClick={() => setCompletionStep('difficulty')} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-xs">Não</button>
            <button onClick={startTimerProcess} className="flex-1 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 active:scale-95 transition-all uppercase text-xs">Sim</button>
          </div>
        </div>
      </div>
    );
  };

  const renderTimerModal = () => {
    if (completionStep !== 'timer_running' || !habitBeingCompleted) return null;

    const habitColor = habitBeingCompleted.categoryColor || '#3B82F6';
    const isBlackBg = habitColor.toLowerCase() === '#000000';
    const totalDuration = (habitBeingCompleted.durationHours || 0) * 3600 + (habitBeingCompleted.durationMinutes || 0) * 60;
    const progressPercent = totalDuration > 0 ? (timeLeft / totalDuration) * 100 : 0;

    const circumference = 2 * Math.PI * 165;
    const dashOffset = circumference - (circumference * progressPercent) / 100;

    const contentColorClass = isBlackBg ? 'text-white' : 'text-black';

    return (
      <div className="fixed inset-0 z-[3000] flex flex-col items-center justify-center p-4 animate-fadeIn transition-colors duration-500" style={{ backgroundColor: habitColor }}>

        <div className="text-center max-w-3xl w-full relative z-10 flex flex-col items-center justify-center h-full gap-16">

          <div className="relative w-[340px] h-[340px] md:w-[450px] md:h-[450px] flex items-center justify-center bg-transparent rounded-full">
            <svg className="absolute inset-0 w-full h-full -rotate-90 scale-[1.05]" viewBox="0 0 400 400">
              <circle
                cx="200" cy="200" r="165"
                stroke={isBlackBg ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'} strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="200" cy="200" r="165"
                stroke={isBlackBg ? '#FFFFFF' : '#000000'} strokeWidth="12"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>

            <div className="flex flex-col items-center gap-2 z-10">
              <span className={`text-[14px] font-black uppercase tracking-widest mb-2 ${contentColorClass} opacity-60`}>Tempo Restante</span>
              <div className={`font-black text-8xl md:text-9xl font-mono tabular-nums tracking-tighter ${contentColorClass}`}>
                {formatTime(timeLeft)}
              </div>
              <div className={`mt-4 px-6 py-2 rounded-full text-[12px] font-black uppercase tracking-widest border-2 ${isTimerPaused ? 'opacity-40 border-transparent' : 'animate-pulse border-white/20'} ${contentColorClass}`}>
                {isTimerPaused ? 'Pausado' : 'Em progresso'}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-8 w-full max-w-sm">
            <div className="flex items-center gap-10">
              <button
                onClick={restartTimer}
                title="Reiniciar"
                className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all ${isBlackBg ? 'text-white border-2 border-white/20' : 'text-black border-2 border-black/10'}`}
                style={{ backgroundColor: isBlackBg ? '#000000' : habitColor }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              </button>

              <button
                onClick={() => setIsTimerPaused(!isTimerPaused)}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all ${isBlackBg ? 'text-white border-2 border-white/20' : 'text-black border-2 border-black/10'}`}
                style={{ backgroundColor: isBlackBg ? '#000000' : habitColor }}
              >
                {isTimerPaused ? (
                  <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                )}
              </button>
            </div>

            <div className="w-full px-6">
              <button
                onClick={() => setCompletionStep('difficulty')}
                className={`w-full py-4 font-black text-[10px] uppercase tracking-widest border-2 rounded-2xl transition-all ${isBlackBg ? 'text-white border-white' : 'text-black border-slate-300 hover:bg-black/5'}`}
              >
                Finalizar Agora
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderDifficultyModal = () => {
    if (completionStep !== 'difficulty' || !habitBeingCompleted) return null;
    return (
      <div className="fixed inset-0 z-[2500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-lg w-full border-[3px] border-black">
          <h3 className="text-2xl font-black text-slate-800 mb-8 text-center uppercase tracking-tighter">Grau de dificuldade para realizar</h3>
          <div className="grid grid-cols-3 gap-4 mb-8">
            {([
              { label: 'fácil', color: 'bg-green-500', hover: 'hover:bg-green-500' },
              { label: 'médio', color: 'bg-yellow-400', hover: 'hover:bg-yellow-400' },
              { label: 'difícil', color: 'bg-red-500', hover: 'hover:bg-red-500' }
            ] as const).map((opt) => {
              const isActive = selectedDifficulty === opt.label;
              return (
                <button key={opt.label} onClick={() => setSelectedDifficulty(opt.label)} className={`flex flex-col items-center gap-3 p-5 border-2 border-black rounded-2xl transition-all group ${isActive ? opt.color + ' text-white' : 'bg-white text-slate-800 ' + opt.hover + ' hover:text-white'}`}>
                  <div className={`w-8 h-8 rounded-lg border-2 border-black shadow-sm ${opt.color}`}></div>
                  <span className="font-black text-sm uppercase tracking-tighter">{opt.label}</span>
                </button>
              );
            })}
          </div>
          {selectedDifficulty === 'difícil' && (
            <div className="mb-8 animate-fadeIn">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">O QUE POSSO FAÇA PARA FACILITÁ-LO?</label>
              <textarea value={difficultyStrategy} onChange={(e) => setDifficultyStrategy(e.target.value)} placeholder="Ex: Preparar a roupa da academia na noite anterior..." className="w-full p-4 border-2 border-black rounded-xl outline-none font-bold text-slate-800 bg-white placeholder:text-slate-300 min-h-[100px] resize-none" />
            </div>
          )}
          <div className="flex gap-4">
            <button onClick={() => { setHabitBeingCompleted(null); setCompletionStep('idle'); }} className="flex-1 py-4 text-slate-400 font-black hover:text-slate-600 transition-colors uppercase text-sm">Cancelar</button>
            <button onClick={finalizeCompletion} disabled={!selectedDifficulty} className={`flex-1 py-4 font-black rounded-2xl shadow-xl transition-all uppercase text-sm ${selectedDifficulty ? 'bg-[#3B82F6] text-white hover:bg-blue-600 active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>Concluir</button>
          </div>
        </div>
      </div>
    );
  };

  const renderCalendarInline = (habit: HabitRecord) => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const startDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysArr = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const streak = calculateStreak(habit.completedDates);
    const monthTotal = calculateMonthlyTotal(habit.completedDates);
    const goalData = getGoalProgress(habit);
    const selectedLog = selectedCalendarDay ? habit.dailyLogs?.[selectedCalendarDay] : null;

    return (
      <div className="mt-4 p-8 bg-white border-2 border-black rounded-[2.5rem] shadow-inner animate-fadeIn space-y-10">
        <div className="flex flex-col lg:flex-row gap-12">
          <div className="flex-1">
            <div className="flex justify-between items-center mb-6">
              <h5 className="font-black text-slate-800 text-lg uppercase tracking-tighter">
                {today.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </h5>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase">Concluído</span>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => (
                <div key={d} className="text-center font-black text-[10px] text-slate-300 py-2">{d}</div>
              ))}
              {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {daysArr.map(d => {
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const isToday = dateStr === getLocalDateStr();
                const isSelected = selectedCalendarDay === dateStr;
                const isCompleted = habit.completedDates.includes(dateStr);
                return (
                  <button
                    key={d}
                    onClick={() => setSelectedCalendarDay(dateStr)}
                    className={`aspect-square rounded-xl flex items-center justify-center font-black text-sm transition-all border-2 
                      ${isCompleted ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-slate-50 text-slate-400 border-transparent'} 
                      ${isToday && !isCompleted ? '!border-blue-500 !border-[3px]' : ''} 
                      ${isSelected ? '!border-black !border-[3px]' : ''} 
                      hover:scale-110 active:scale-95`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-8 justify-center min-w-[280px]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-orange-100 rounded-2xl flex items-center justify-center text-orange-500"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M17.5 10c0 4.142-3.358 7.5-7.5 7.5s-7.5-3.358-7.5-7.5S5.858 2.5 10 2.5s7.5 3.358 7.5 7.5zM10 4.5c-3.037 0-5.5 2.463-5.5 5.5s2.463 5.5 5.5 5.5 5.5-2.463 5.5-5.5-2.463-5.5-5.5-5.5z" /><path d="M11 7v3l2.5 1.5.5-.8L12 9.5V7z" /><path d="M14 17.5l2 2m0-2l-2 2m5-3l1.5 1.5-1.5 1.5m-3 3l1.5 1.5L14.5 21" /></svg></div>
              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sequência Atual</p><p className="text-xl font-black text-[#1e293b]">{streak} dias</p></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
              <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Totais esse Mês</p><p className="text-xl font-black text-[#1e293b]">{monthTotal} dias</p></div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-2xl flex items-center justify-center text-green-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
              <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sua Meta</p>
                <p className="text-xl font-black text-[#1e293b]">{goalData.text}</p>
                {habit.goalType !== 'sem_meta' && (
                  <div className="mt-2 w-full max-w-[150px] h-6 bg-slate-100 rounded-full border-2 border-black overflow-hidden relative shadow-sm">
                    <div className="h-full bg-green-500 transition-all duration-1000 flex items-center justify-center" style={{ width: `${goalData.percent}%` }}>
                      {goalData.percent >= 20 && (
                        <span className="text-[10px] font-black text-white">{goalData.percent}%</span>
                      )}
                    </div>
                    {goalData.percent < 20 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-black text-black">{goalData.percent}%</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
          <h6 className="text-[#3B82F6] font-black text-[10px] uppercase tracking-widest mb-6">AVALIAÇÃO DO DIA</h6>
          <div className="flex flex-col items-center justify-center min-h-[120px] text-center">
            {selectedLog ? (
              <div className="w-full text-left animate-fadeIn">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Grau de dificuldade:</span>
                  <span className={`px-4 py-1 rounded-full text-white font-black text-xs uppercase ${selectedLog.difficulty === 'fácil' ? 'bg-green-500' : selectedLog.difficulty === 'médio' ? 'bg-yellow-400' : 'bg-red-500'}`}>
                    {selectedLog.difficulty}
                  </span>
                </div>
                {selectedLog.difficulty === 'difícil' && selectedLog.strategy && (
                  <div className="mt-4">
                    <span className="text-slate-400 font-bold uppercase text-[10px] block mb-2">O QUE POSSO FAÇA PARA FACILITÁ-LO:</span>
                    <p className="text-slate-700 font-medium italic">"{selectedLog.strategy}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 opacity-30">
                <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-slate-400 font-black text-xs uppercase tracking-widest text-center">CLIQUE EM QUALQUER DIA DO CALENDÁRIO <br /> PARA VER A AVALIAÇÃO DO DIA</p>
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
            <h6 className="text-[#3B82F6] font-black text-[10px] uppercase tracking-widest mb-8">INFORMAÇÕES PRINCIPAIS</h6>
            <div className="grid grid-cols-2 gap-y-8">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">FREQUÊNCIA</span>
                <span className="text-slate-800 font-black">{habit.type === 'abandonar' ? '-' : habit.frequency}</span>
                {habit.type !== 'abandonar' && habit.frequency === 'Semanal' && habit.selectedDays && habit.selectedDays.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 block mt-1">({habit.selectedDays[0]})</span>
                )}
                {habit.type !== 'abandonar' && habit.frequency === 'Específico' && habit.selectedDays && habit.selectedDays.length > 0 && (
                  <span className="text-[10px] font-bold text-slate-500 block mt-1">({habit.selectedDays.join(', ')})</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">VEZES AO DIA</span>
                <span className="text-slate-800 font-black">{(habit.type !== 'abandonar' && habit.frequency === 'Diário') ? (habit.timesPerDay + 'x') : '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">HORÁRIO</span>
                <span className="text-slate-800 font-black">{(habit.type !== 'abandonar' && habit.timeEnabled) ? habit.time : '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[10px] block mb-1">DURAÇÃO</span>
                <span className="text-slate-800 font-black">
                  {(habit.type === 'abandonar' || habit.durationType === 'sem_duracao') ? '-' :
                    `${habit.durationHours ? habit.durationHours + 'h ' : ''}${habit.durationMinutes || 0} min`}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100">
            <h6 className="text-[#3B82F6] font-black text-[10px] uppercase tracking-widest mb-6">MAIS OPÇÕES</h6>
            <div className="space-y-4">
              <div className="flex gap-4 border-b border-slate-200 pb-2">
                <div className="flex-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">LOCAL</span>
                  <span className="text-slate-800 font-black text-sm">{habit.location || '-'}</span>
                </div>
                <div className="flex-1">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">APÓS</span>
                  <span className="text-slate-800 font-black text-sm">{habit.afterActivity || '-'}</span>
                </div>
              </div>
              <div className="border-b border-slate-200 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">MOTIVAÇÃO</span>
                <span className="text-slate-800 font-black text-sm italic">"{habit.motivation || '-'}"</span>
              </div>
              <div className="border-b border-slate-200 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">SENTIMENTO PÓS REALIZAÇÃO</span>
                <span className="text-slate-800 font-black text-sm">{habit.successFeeling || '-'}</span>
              </div>
              <div className="border-b border-slate-200 pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">DIFICULDADES E SUPERAÇÃO</span>
                <span className="text-slate-800 font-black text-sm">{habit.difficulties || '-'} / {habit.overcomeStrategy || '-'}</span>
              </div>
              <div className="pb-2">
                <span className="text-slate-400 font-bold uppercase text-[10px] block">REDE DE APOIO</span>
                <span className="text-slate-800 font-black text-sm">{habit.supportNetwork || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSelection = () => (
    <div className="bg-white border-2 border-black rounded-[2rem] p-10 max-w-3xl mx-auto shadow-2xl animate-fadeIn">
      <div className="flex items-center gap-4 mb-10">
        <button onClick={() => setView('list')} className="w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center hover:bg-slate-50 transition-all">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-green-500 rounded-full flex items-center justify-center text-green-500 font-bold text-xs">+</div>
          <span className="font-black text-slate-800">Novo Hábito</span>
        </div>
      </div>
      <div className="flex flex-col gap-6">
        <button onClick={() => { setIsRecommendedMode(false); setView('custom_form'); }} className="w-full py-8 bg-white border-2 border-black rounded-[1.5rem] font-black text-xl text-black hover:bg-black hover:text-white transition-all active:bg-black active:text-white">Hábito Personalizado</button>
        <button onClick={() => setView('suggested_list')} className="w-full py-8 bg-white border-2 border-black rounded-[1.5rem] font-black text-xl text-black hover:bg-black hover:text-white transition-all active:bg-black active:text-white">Sugestões de Hábitos</button>
      </div>
    </div>
  );

  const renderSuggestedList = () => (
    <div className="bg-white border-2 border-black rounded-[2rem] p-10 max-w-3xl mx-auto shadow-2xl animate-fadeIn">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Hábitos Recomendados</h2>
        <button onClick={() => setView('add_type_selection')} className="flex items-center gap-1 text-slate-400 font-bold hover:text-black">
          <span className="text-xs">‹</span> Voltar
        </button>
      </div>
      <div className="space-y-4">
        {suggestedHabits.map((item, idx) => (
          <button key={idx} onClick={() => {
            const config = suggestedHabitsConfig[item];
            setForm(prev => ({ ...prev, title: item, type: config.type }));
            setIsRecommendedMode(true);
            setView('custom_form');
          }} className="w-full p-6 bg-white border-2 border-black rounded-2xl text-left font-black text-slate-800 hover:bg-black hover:text-white transition-all active:bg-black active:text-white">{item}</button>
        ))}
      </div>
    </div>
  );

  const renderCustomForm = () => {
    const isAbandonar = form.type === 'abandonar';
    const hoursArr = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const minutesArr = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
    const isEditing = !!form.id;
    const recommendedConfig = isRecommendedMode || (form.title && suggestedHabitsConfig[form.title]) ? suggestedHabitsConfig[form.title || ''] : null;
    const shouldDisableName = !!recommendedConfig;

    return (
      <div className="bg-white border-2 border-black rounded-[2rem] p-10 max-w-4xl mx-auto shadow-2xl animate-fadeIn">
        <style>{` input[type=number]::-webkit-inner-spin-button, input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; } input[type=number] { -moz-appearance: textfield; } `}</style>
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => { if (isEditing) setView('list'); else if (isRecommendedMode) setView('suggested_list'); else setView('add_type_selection'); }} className="w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center hover:bg-slate-50 transition-all"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg></button>
          <div className="flex items-center gap-2"><div className="w-6 h-6 border-2 border-green-500 rounded-full flex items-center justify-center text-green-500 font-bold text-xs">+</div><span className="font-black text-slate-800">{isRecommendedMode || recommendedConfig ? `Hábito Recomendado ${recommendedConfig?.icon || ''}` : isEditing ? 'Editar Hábito' : 'Novo Hábito Personalizado'}</span></div>
        </div>
        <div className="space-y-12 pb-10">
          {!isEditing && (
            <div>
              <div className="flex items-center gap-3 mb-6"><div className="w-6 h-6 border-2 border-blue-500 rounded-full flex items-center justify-center text-blue-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg></div><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">O QUE VOCÊ QUER FAZER?</label></div>
              <div className="flex gap-4">
                <button onClick={() => !isRecommendedMode && setForm(f => ({ ...f, type: 'adquirir' }))} className={`flex-1 py-6 rounded-2xl font-black text-sm flex flex-col items-center justify-center gap-2 border-2 transition-all ${form.type === 'adquirir' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100'} ${isRecommendedMode ? 'cursor-default opacity-80' : ''}`} style={isRecommendedMode && form.type !== 'adquirir' ? { display: 'none' } : {}}><span className="text-2xl">+</span> Adquirir um hábito</button>
                <button onClick={() => !isRecommendedMode && setForm(f => ({ ...f, type: 'abandonar' }))} className={`flex-1 py-6 rounded-2xl font-black text-sm flex flex-col items-center justify-center gap-2 border-2 transition-all ${form.type === 'abandonar' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100'} ${isRecommendedMode ? 'cursor-default opacity-80' : ''}`} style={isRecommendedMode && form.type !== 'abandonar' ? { display: 'none' } : {}}><span className="text-2xl">--</span> Abandonar um vício</button>
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center gap-3 mb-6"><div className="text-purple-500"><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.9 6.85c.18.3.29.66.29 1.03 0 .37-.11.73-.29 1.03l-2.07 3.5c-.18.3-.43.55-.73.73-.3.18-.66.29-1.03.29-.37 0-.73-.11-1.03-.29l-3.5-2.07c-.3-.18-.55-.43-.73-.73-.18-.3-.29-.66-.29-1.03 0-.37.11-.73.29-1.03l2.07-3.5c.18-.3.43-.55.73-.73.3-.18.66-.29 1.03-.29.37 0 .73.11 1.03.29l3.5 2.07zm-2.03.88l-1.31-.77-1.31.77.77 1.31.77-1.31zM21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.23-1.06-.59-1.42zM5.5 7c-.83 0-1.5-.67-1.5-1.5S4.67 4 5.5 4 7 4.67 7 5.5 6.33 7 5.5 7z" /></svg></div><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">NOME DO HÁBITO</label></div>
            <input type="text" value={form.title} readOnly={shouldDisableName} onChange={(e) => !shouldDisableName && setForm(f => ({ ...f, title: e.target.value }))} placeholder={isAbandonar ? "Ex: Roer unhas" : "Ex: Beber água"} className={`w-full p-6 border-2 border-black rounded-2xl outline-none font-bold text-slate-800 placeholder:text-slate-300 bg-white ${shouldDisableName ? 'bg-slate-50 cursor-default opacity-80' : ''}`} />
          </div>
          {!isAbandonar && (
            <>
              <div>
                <div className="flex items-center gap-3 mb-6"><div className="text-green-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">FREQUÊNCIA</label></div>
                <div className="flex gap-4 mb-6">{['Diário', 'Semanal', 'Específico'].map(freq => (<button key={freq} onClick={() => setForm(f => ({ ...f, frequency: freq as Frequency, selectedDays: [] }))} className={`flex-1 py-4 border-2 rounded-2xl font-black text-sm transition-all ${form.frequency === freq ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-black'}`}>{freq}</button>))}</div>
                {(form.frequency === 'Semanal' || form.frequency === 'Específico') && (<div className="animate-fadeIn"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Escolha os dias:</p><div className="flex flex-wrap gap-2">{weekDaysLong.map(day => { const isSel = form.selectedDays?.includes(day); return (<button key={day} onClick={() => toggleDay(day)} className={`px-6 py-3 rounded-full border-2 font-black text-sm transition-all ${isSel ? 'bg-[#334155] text-white border-[#334155]' : 'bg-white text-slate-400 border-slate-100 hover:border-black'}`}>{day}</button>); })}</div></div>)}
              </div>
              {form.frequency === 'Diário' && (
                <div className="animate-fadeIn"><div className="flex items-center gap-3 mb-6"><span className="text-2xl text-orange-500 font-black">#</span><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">QUANTAS VEZES POR DIA?</label></div><div className="flex items-center gap-4"><button onClick={() => setForm(f => ({ ...f, timesPerDay: Math.max(1, (f.timesPerDay || 1) - 1) }))} className="w-10 h-10 border-2 border-black rounded-lg flex items-center justify-center font-black text-xl hover:bg-slate-50">-</button><div className="relative border-2 border-black rounded-xl bg-white p-2 w-24"><input type="number" value={form.timesPerDay === undefined ? '' : form.timesPerDay} onFocus={() => setForm(f => ({ ...f, timesPerDay: undefined }))} onBlur={() => { if (form.timesPerDay === undefined) setForm(f => ({ ...f, timesPerDay: 1 })); }} onChange={(e) => handleNumericChange('timesPerDay', e.target.value)} className="w-full text-3xl font-black text-slate-800 text-center outline-none bg-transparent" /></div><button onClick={() => setForm(f => ({ ...f, timesPerDay: (f.timesPerDay || 1) + 1 }))} className="w-10 h-10 border-2 border-black rounded-lg flex items-center justify-center font-black text-xl hover:bg-slate-50">+</button></div></div>
              )}
              <div>
                <div className="flex items-center gap-3 mb-6"><div className="text-red-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">DURAÇÃO</label></div>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex-1 space-y-4">
                    <button onClick={() => setForm(f => ({ ...f, durationType: 'longo' }))} className={`w-full p-6 border-2 rounded-2xl text-left transition-all ${form.durationType === 'longo' ? 'bg-black text-white border-black' : 'bg-white border-black text-slate-800'}`}><p className="font-black text-sm">Vou demorar muito</p></button>
                    <button onClick={() => setForm(f => ({ ...f, durationType: 'rapido' }))} className={`w-full p-6 border-2 rounded-2xl text-left transition-all ${form.durationType === 'rapido' ? 'bg-black text-white border-black' : 'bg-white border-black text-slate-800'}`}><p className="font-black text-sm">Vou fazer rápido</p></button>
                    <button onClick={() => setForm(f => ({ ...f, durationType: 'sem_duracao' }))} className={`w-full p-6 border-2 rounded-2xl text-left transition-all ${form.durationType === 'sem_duracao' ? 'bg-black text-white border-black' : 'bg-white border-black text-slate-800'}`}><p className="font-black text-sm">Não tem duração</p></button>
                  </div>
                  <div className="flex-1">
                    {form.durationType !== 'sem_duracao' && (
                      <div className="border-2 border-black rounded-[2rem] p-6 space-y-6 bg-slate-50">
                        {form.durationType === 'longo' && (
                          <div className="animate-fadeIn"><p className="text-[10px] font-black text-slate-300 uppercase mb-2">HORAS (MÁX 23)</p><div className="flex items-center gap-2 border-2 border-black rounded-xl p-2 bg-white"><button onClick={() => setForm(f => ({ ...f, durationHours: Math.max(0, (f.durationHours || 0) - 1) }))} className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-slate-400 hover:text-black">-</button><input type="number" value={form.durationHours === undefined ? '' : form.durationHours} onFocus={() => setForm(f => ({ ...f, durationHours: undefined }))} onBlur={() => { if (form.durationHours === undefined) setForm(f => ({ ...f, durationHours: 0 })); }} onChange={(e) => handleNumericChange('durationHours', e.target.value)} className="flex-1 text-center font-black text-xl outline-none bg-transparent" /><button onClick={() => setForm(f => ({ ...f, durationHours: Math.min(23, (f.durationHours || 0) + 1) }))} className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-slate-400 hover:text-black">+</button></div></div>
                        )}
                        <div className="animate-fadeIn"><p className="text-[10px] font-black text-slate-300 uppercase mb-2">MINUTOS (MÁX 59)</p><div className="flex items-center gap-2 border-2 border-black rounded-xl p-2 bg-white"><button onClick={() => setForm(f => ({ ...f, durationMinutes: Math.max(0, (f.durationMinutes || 0) - 1) }))} className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-slate-400 hover:text-black">-</button><input type="number" value={form.durationMinutes === undefined ? '' : form.durationMinutes} onFocus={() => setForm(f => ({ ...f, durationMinutes: undefined }))} onBlur={() => { if (form.durationMinutes === undefined) setForm(f => ({ ...f, durationMinutes: 0 })); }} onChange={(e) => handleNumericChange('durationMinutes', e.target.value)} className="flex-1 text-center font-black text-xl outline-none bg-transparent" /><button onClick={() => setForm(f => ({ ...f, durationMinutes: Math.min(59, (f.durationMinutes || 0) + 1) }))} className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-slate-400 hover:text-black">+</button></div></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 mb-6"><div className="text-teal-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">HORÁRIO</label></div>
                <div className="flex gap-4 mb-6"><button onClick={() => setForm(f => ({ ...f, timeEnabled: true }))} className={`flex-1 py-4 rounded-2xl font-black transition-all ${form.timeEnabled ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-black'}`}>Com horário</button><button onClick={() => setForm(f => ({ ...f, timeEnabled: false }))} className={`flex-1 py-4 border-2 rounded-2xl font-black transition-all ${!form.timeEnabled ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-black'}`}>Sem horário</button></div>
                {form.timeEnabled && (<div className="animate-fadeIn"><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest mb-4 block">A QUE HORAS COMEÇAR?</label><div className="flex items-center gap-4"><div className="border-2 border-black rounded-xl p-3 flex items-center gap-2 bg-white"><select value={form.time?.split(':')[0]} onChange={(e) => setForm(f => ({ ...f, time: `${e.target.value}:${f.time?.split(':')[1] || '00'}` }))} className="font-black text-2xl outline-none appearance-none bg-transparent">{hoursArr.map(h => <option key={h} value={h}>{h}</option>)}</select></div><span className="text-3xl font-black text-slate-800">:</span><div className="border-2 border-black rounded-xl p-3 flex items-center gap-2 bg-white"><select value={form.time?.split(':')[1]} onChange={(e) => setForm(f => ({ ...f, time: `${f.time?.split(':')[0] || '00'}:${e.target.value}` }))} className="font-black text-2xl outline-none appearance-none bg-transparent">{minutesArr.map(m => <option key={m} value={m}>{m}</option>)}</select></div></div></div>)}
              </div>
            </>
          )}
          <div>
            <div className="flex items-center gap-3 mb-6"><div className="text-indigo-500"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-7h.01" /></svg></div><label className="text-[10px] font-black text-slate-800 uppercase tracking-widest">DEFINA SUA META</label></div>
            <div className="flex gap-4 mb-6">{['sem_meta', 'dias', 'meses', 'anos'].map(meta => (<button key={meta} onClick={() => setForm(f => ({ ...f, goalType: meta as GoalType, goalValue: 1 }))} className={`flex-1 py-4 border-2 rounded-2xl font-black text-sm transition-all ${form.goalType === meta ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-black'}`}>{meta === 'sem_meta' ? 'Sem meta' : meta.charAt(0).toUpperCase() + meta.slice(1)}</button>))}</div>
            {form.goalType !== 'sem_meta' && (
              <div className="animate-fadeIn mt-4 flex items-center gap-4">
                <button onClick={() => setForm(f => ({ ...f, goalValue: Math.max(1, (f.goalValue || 1) - 1) }))} className="w-12 h-12 border-2 border-black rounded-xl flex items-center justify-center font-black text-2xl hover:bg-slate-50">-</button>
                <div className="relative border-2 border-black rounded-xl bg-white p-2 w-24">
                  <input type="number" value={form.goalValue === undefined ? '' : form.goalValue} onFocus={() => setForm(f => ({ ...f, goalValue: undefined }))} onBlur={() => { if (form.goalValue === undefined) setForm(f => ({ ...f, goalValue: 1 })); }} onChange={(e) => handleNumericChange('goalValue', e.target.value)} className="w-full text-3xl font-black text-slate-800 text-center outline-none bg-transparent" />
                </div>
                <button onClick={() => {
                  let max = 31;
                  if (form.goalType === 'dias') max = 31;
                  if (form.goalType === 'meses') max = 12;
                  if (form.goalType === 'anos') max = 10;
                  setForm(f => ({ ...f, goalValue: Math.min(max, (f.goalValue || 1) + 1) }));
                }} className="w-12 h-12 border-2 border-black rounded-xl flex items-center justify-center font-black text-2xl hover:bg-slate-50">+</button>
                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{form.goalType}</span>
              </div>
            )}
          </div>
          <div className="h-px bg-slate-100" />
          <div>
            <button onClick={() => setShowExtraOptions(!showExtraOptions)} className="flex items-center gap-2 text-[#4A69A2] font-black hover:scale-105 transition-all"><div className="w-6 h-6 border-2 border-[#4A69A2] rounded-full flex items-center justify-center">{showExtraOptions ? <span>-</span> : <span>+</span>}</div><span className="text-[10px] uppercase tracking-widest">{showExtraOptions ? 'Menos opções' : 'Mais opções'}</span></button>
            {showExtraOptions && (
              <div className="mt-8 space-y-10 animate-fadeIn">
                <div className="bg-[#f0f7ff] p-8 rounded-[2rem] border-2 border-[#d9e8ff]"><h4 className="font-black text-[#4A69A2] text-sm uppercase mb-1 tracking-widest">{isAbandonar ? 'Responda para ajudar a abandonar este vício' : 'Responda para ajudar a construir este hábito'}</h4></div>
                {[
                  { label: 'LOCAL', field: 'location', placeholder: 'Ex: Na academia, em casa, no escritório...' },
                  { label: 'APÓS QUAL ATIVIDADE?', field: 'afterActivity', placeholder: 'Ex: Logo após acordar, depois do almoço...' },
                  { label: isAbandonar ? 'O que motiva você a abandonar?' : 'O que motiva você?', field: 'motivation', placeholder: 'Ex: Ter mais saúde, economizar dinheiro...' },
                  { label: isAbandonar ? 'Como você se sentirá após abandonar?' : 'Como você se sentirá após o sucesso?', field: 'successFeeling', placeholder: 'Ex: Sensação de dever cumprido, mais energia...' },
                  { label: isAbandonar ? 'Quais as dificuldades para abandonar?' : 'Quais as possíveis dificuldades?', field: 'difficulties', placeholder: 'Ex: Preguiça matinal, falta de tempo...' },
                  { label: isAbandonar ? 'Como você pretende superar essas dificuldades?' : 'Como superar dificuldades?', field: 'overcomeStrategy', placeholder: 'Ex: Deixar a roupa pronta, bloquear apps...' },
                  { label: 'Qual sua rede de apoio?', field: 'supportNetwork', placeholder: 'Ex: Amigos, família, grupo de foco...' }
                ].map((item, idx) => (
                  <div key={idx}><label className="block text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest">{item.label}</label><input type="text" value={(form as any)[item.field] || ''} onChange={(e) => setForm(f => ({ ...f, [item.field]: e.target.value }))} className="w-full p-4 border-2 border-black rounded-xl outline-none font-bold text-slate-800 bg-white" placeholder={item.placeholder} /></div>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleTriggerSave} className="w-full py-6 bg-blue-600 text-white font-black text-xl rounded-[1.5rem] shadow-xl hover:bg-blue-700 active:scale-95 transition-all">{isEditing ? 'Salvar Alterações' : 'Salvar Hábito'}</button>
        </div>
      </div>
    );
  };

  const renderSaveModal = () => (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full border-2 border-black text-center">
        <h3 className="text-lg font-black text-slate-800 mb-1">Organizar</h3>
        <p className="text-slate-400 font-bold mb-6 text-[8px] uppercase tracking-widest">Escolha a categoria:</p>
        {saveStep === 'initial' && (
          <div className="flex gap-3">
            <button onClick={() => { setTempCat(null); setSaveStep('confirm'); }} className="flex-1 py-3 px-2 rounded-xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase hover:bg-slate-200 transition-all">Nenhuma</button>
            <button onClick={() => setSaveStep('picking')} className="flex-1 py-3 px-2 rounded-xl bg-[#1e293b] text-white font-black text-[10px] uppercase hover:bg-black transition-all">Escolher</button>
          </div>
        )}
        {saveStep === 'picking' && (
          <div className="animate-fadeIn">
            {categories.length === 0 ? (
              <div className="text-center py-4"><p className="text-slate-400 font-bold mb-4 text-[10px]">Sem categorias salvas.</p><div className="flex gap-3"><button onClick={() => { setTempCat(null); setSaveStep('confirm'); }} className="flex-1 py-3 bg-black text-white rounded-xl font-black text-[10px] uppercase">Salvar</button><button onClick={() => setShowSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase">Cancelar</button></div></div>
            ) : (
              <>
                <div className="space-y-2 max-h-40 overflow-y-auto mb-4 pr-1 custom-scrollbar">
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => { setTempCat(cat); setSaveStep('confirm'); }} style={{ backgroundColor: cat.color }} className="w-full p-3 rounded-xl text-white font-black text-left text-xs shadow-sm hover:brightness-90 transition-all border border-transparent active:border-black">{cat.name}</button>
                  ))}
                </div>
                <button onClick={() => setSaveStep('initial')} className="w-full py-2 text-slate-400 font-bold text-[9px] uppercase tracking-widest">Voltar</button>
              </>
            )}
          </div>
        )}
        {saveStep === 'confirm' && (
          <div className="animate-fadeIn">
            <div className="p-4 rounded-xl border border-dashed border-slate-200 mb-4 text-center">
              <span className="text-[9px] font-black text-slate-300 uppercase block mb-1">CATEGORIA:</span>
              <span className="font-black text-base" style={{ color: tempCat?.color || '#94a3b8' }}>
                {tempCat?.name || 'Nenhuma'}
              </span>
            </div>
            <div className="flex gap-3">
              <button onClick={finalizeSaveHabit} className="flex-1 py-3 bg-black text-white font-black rounded-xl text-[10px] uppercase">Salvar</button>
              <button onClick={() => setSaveStep('initial')} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase">Voltar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderHabitListContent = () => {
    const sortedHabits = getSortedHabits();
    const today = getLocalDateStr();
    return (
      <div className="space-y-8 mb-12 animate-fadeIn">
        <style>{`
          @keyframes habitCardReorder {
            0% { opacity: 0; transform: translateY(15px) scale(0.98); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          .habit-card-anim {
            animation: habitCardReorder 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
          }
        `}</style>
        <div className="flex justify-end items-center gap-3">
          <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ordenar por</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as HabitSort)}
            className="bg-white border-2 border-black rounded-xl px-4 py-2 text-xs font-black outline-none cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
          >
            <option value="alphabetical">Ordem Alfabética</option>
            <option value="intention">Intenção</option>
            <option value="category">Categoria</option>
            <option value="frequency">Frequência</option>
            <option value="repetition">Taxa de repetição diária</option>
            <option value="duration">Duração</option>
            <option value="goal">Meta</option>
            <option value="time">Horário</option>
            <option value="consistency">Maior consistência</option>
          </select>
        </div>
        {habits.length === 0 ? (
          <div className="h-44 border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-400 gap-4 bg-white/50"><span className="font-bold">Nenhum hábito registrado.</span></div>
        ) : (
          <div className="space-y-4">
            {sortedHabits.map((h, idx) => {
              const countToday = h.completedDates.filter(d => d === today).length;
              const limit = h.type === 'abandonar' ? 1 : (h.frequency === 'Diário' ? (h.timesPerDay || 1) : 1);
              const isTodayCompleted = countToday >= limit;
              const isBlackBg = h.categoryColor?.toLowerCase() === '#000000';
              const contentColor = isBlackBg ? 'text-white' : 'text-black';
              const checklistBorderColor = isBlackBg ? 'border-white' : 'border-black';

              return (
                <div key={`${h.id}-${sortBy}`} className="flex flex-col gap-1 habit-card-anim" style={{ animationDelay: `${idx * 40}ms` }}>
                  <div className="flex px-3"><span className={`px-3 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${h.categoryName === 'Sem categoria' ? 'text-black' : 'text-white'}`} style={{ backgroundColor: h.categoryColor }}>{h.categoryName}</span></div>
                  <div className="p-4 rounded-3xl border-2 border-black shadow-lg flex items-center justify-between transition-all group relative" style={{ backgroundColor: h.categoryColor }}>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <button
                          onClick={() => toggleHabitCompletion(h)}
                          disabled={isTodayCompleted}
                          className={`w-8 h-8 rounded-lg border-[3px] transition-all flex items-center justify-center bg-transparent ${checklistBorderColor} ${contentColor} ${isTodayCompleted ? 'cursor-default' : 'hover:scale-110 active:scale-95'}`}
                        >
                          {isTodayCompleted && (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>)}
                          {!isTodayCompleted && countToday > 0 && <span className="text-[10px] font-bold">{countToday}</span>}
                        </button>
                      </div>

                      <div className="flex items-center gap-2.5 py-1">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${contentColor} shrink-0`}>
                          {h.type === 'adquirir' ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 10l7-7 7 7M12 3v18" /></svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M19 14l-7 7-7-7M12 21V3" /></svg>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <h4 className={`text-lg font-black ${contentColor} tracking-tight ${isTodayCompleted ? 'line-through opacity-60' : ''}`}>
                            {h.title}
                          </h4>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setExpandedHabitId(expandedHabitId === h.id ? null : h.id)} className={`w-8 h-8 flex items-center justify-center transition-all ${contentColor} ${expandedHabitId === h.id ? 'rotate-180' : ''}`} title="Ver mais"><svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg></button>
                      <button onClick={() => { setForm(h); setView('custom_form'); }} className={`w-8 h-8 flex items-center justify-center transition-all ${contentColor}`} title="Editar"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                      <button onClick={() => setHabitToDelete(h)} className={`w-8 h-8 flex items-center justify-center transition-all ${contentColor}`} title="Excluir"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  </div>
                  {expandedHabitId === h.id && renderCalendarInline(h)}
                </div>
              );
            })}
          </div>
        )}
        {!expandedHabitId && (<button onClick={() => setView('add_type_selection')} className="w-full py-5 border-2 border-black rounded-2xl flex items-center justify-center gap-3 font-black text-slate-800 hover:bg-slate-50 transition-all active:scale-95 shadow-lg bg-white"><span className="text-2xl">+</span> Adicionar Hábito</button>)}
      </div>
    );
  };

  const renderCategoriesContent = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
      {categories.length === 0 ? (
        <div className="col-span-full h-44 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center text-slate-400 font-bold w-full text-center px-8 bg-white/50">Nenhuma categoria cadastrada.</div>
      ) : (
        categories.map(cat => (
          <div key={cat.id} className="h-32 rounded-3xl flex items-center justify-center shadow-md relative group transition-all" style={{ backgroundColor: cat.color }}>
            <span className="text-white font-black text-xl">{cat.name}</span>
            <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingHabitCategory(cat); setNewCatName(cat.name); setSelectedColor(cat.color); setView('create_category'); }} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-lg flex items-center justify-center text-white transition-all shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button><button onClick={() => setCategoryToDelete(cat)} className="w-8 h-8 bg-white/20 hover:bg-red-500 rounded-lg flex items-center justify-center text-white transition-all shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div>
          </div>
        ))
      )}
    </div>
  );

  const renderCreateCategoryContent = () => (
    <div className="animate-fadeIn max-w-xl mx-auto space-y-10 py-6">
      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{editingHabitCategory ? 'EDITAR CATEGORIA' : 'NOVA CATEGORIA'}</label><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="ex: Saúde" className="w-full p-4 rounded-xl border-2 border-black bg-white outline-none font-bold text-black shadow-sm" /></div>
      <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ESCOLHA UMA COR</label><div className="flex flex-wrap gap-3">{customColors.map(c => (<button key={c} onClick={() => setSelectedColor(c)} className={`w-12 h-12 rounded-2xl border-2 transition-all shadow-sm ${selectedColor === c ? 'border-black scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`} style={{ backgroundColor: c }} />))}</div></div>
      <button onClick={() => { if (!newCatName.trim()) return; if (editingHabitCategory) { const updated = categories.map(c => c.id === editingHabitCategory.id ? { ...c, name: newCatName, color: selectedColor } : c); saveCategoriesLocal(updated); setEditingHabitCategory(null); } else { saveCategoriesLocal([...categories, { id: Date.now().toString(), name: newCatName, color: selectedColor }]); } setNewCatName(''); setView('categories'); }} className="w-full py-5 rounded-2xl bg-black text-white font-black text-lg shadow-xl active:scale-95 transition-all">{editingHabitCategory ? 'Salvar Alterações' : 'Criar Categoria'}</button>
    </div>
  );

  const isTabbedView = view === 'list' || view === 'categories' || view === 'create_category';

  return (
    <div className="min-h-screen">
      {renderValidationModal()}
      {renderDayWarningModal()}
      {renderTimerPromptModal()}
      {renderTimerModal()}
      {renderDifficultyModal()}
      {categoryToDelete && (
        <div className="fixed inset-0 z-[2000] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-[2rem] shadow-2xl max-w-xs w-full text-center border-2 border-black">
            <h3 className="text-base font-black text-slate-800 mb-1">Excluir?</h3>
            <p className="text-slate-500 font-bold mb-6 text-[10px] uppercase tracking-widest leading-tight">Apagar categoria "<span className="text-black">{categoryToDelete.name}</span>"?</p>
            <div className="flex gap-3">
              <button onClick={() => setCategoryToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-[10px] uppercase transition-all">Não</button>
              <button onClick={() => { saveCategoriesLocal(categories.filter(c => c.id !== categoryToDelete.id)); setCategoryToDelete(null); }} className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl text-[10px] uppercase transition-all shadow-md">Sim</button>
            </div>
          </div>
        </div>
      )}
      {habitToDelete && (
        <div className="fixed inset-0 z-[1200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-[280px] w-full text-center border-2 border-black">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></div>
            <h3 className="text-lg font-black text-slate-800 mb-2">Excluir?</h3><p className="text-slate-500 mb-6 font-medium text-sm leading-tight">Apagar "{habitToDelete.title}"?</p>
            <div className="flex gap-3">
              <button onClick={() => setHabitToDelete(null)} className="flex-1 py-2 bg-slate-100 font-bold rounded-xl text-black text-sm">Não</button>
              <button onClick={() => {
                saveHabitsLocal(habits.filter(h => h.id !== habitToDelete.id));
                setHabitToDelete(null);
                setExpandedHabitId(null); // Resetar expansão para garantir que o botão "Adicionar" reapareça
              }} className="flex-1 py-2 bg-red-500 text-white font-black rounded-xl text-sm">Sim</button>
            </div>
          </div>
        </div>
      )}
      {isTabbedView ? (
        <div className="animate-fadeIn">
          <header className="mb-12"><h2 className={`text-5xl font-black ${textColor} tracking-tight`}>Meus Hábitos</h2><p className="text-slate-500 mt-3 font-medium text-lg">Gerencie sua evolução constante.</p></header>
          <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6"><div className="bg-white border-2 border-black p-0.5 rounded-2xl flex shadow-sm"><button onClick={() => setView('list')} className={`py-2 px-8 rounded-xl font-bold text-sm transition-all ${view === 'list' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}>Meus hábitos</button></div><div className="flex items-center gap-4"><button onClick={() => setView('categories')} className={`px-8 py-2.5 rounded-xl border-2 border-[#A855F7] font-bold text-sm transition-all shadow-sm ${view === 'categories' ? 'bg-[#A855F7] text-white' : 'text-[#A855F7] bg-white'}`}>Minhas Categorias</button><button onClick={() => setView('create_category')} className={`px-8 py-2.5 rounded-xl border-2 border-[#3B82F6] font-bold text-sm transition-all shadow-sm ${view === 'create_category' ? 'bg-[#3B82F6] text-white' : 'text-[#3B82F6] bg-white'}`}>Criar Categoria</button></div></div>
          <div className="mt-6">{view === 'list' && renderHabitListContent()}{view === 'categories' && renderCategoriesContent()}{view === 'create_category' && renderCreateCategoryContent()}</div>
        </div>
      ) : (
        <>{view === 'add_type_selection' && renderSelection()}{view === 'suggested_list' && renderSuggestedList()}{view === 'custom_form' && renderCustomForm()}{showSaveModal && renderSaveModal()}</>
      )}
    </div>
  );
};

export default Habits;
