
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { generateAIResponse } from '@/lib/aiClient';
import { generateMnemonic, generateCuriosityText, generateCuriosityImage } from '@/lib/edgeFunctions';
import { sanitizeHtml } from '@/lib/sanitize';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadAllStudyItems,
  insertStudyItem,
  updateStudyItem,
  deleteStudyItem,
  saveAllStudyItems,
  savePathItems,
  recordBookProgress,
} from '@/services/studyBankService';

const DEFAULT_COLOR_PALETTE = ['#6279A8', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ec4899', '#06b6d4', '#4d7c0f', '#78350f', '#000000'];

// Mapa de cores em português: aliases → hex
const COLOR_NAME_MAP: { aliases: string[]; hex: string; name: string }[] = [
  { name: 'Azul', aliases: ['azul', 'blue', 'bluu', 'azuul'], hex: '#3b82f6' },
  { name: 'Vermelho', aliases: ['vermelho', 'vermelio', 'vermelo', 'red', 'vermelho'], hex: '#ef4444' },
  { name: 'Rosa', aliases: ['rosa', 'roza', 'rossa', 'rose', 'roxa', 'pink'], hex: '#ec4899' },
  { name: 'Verde', aliases: ['verde', 'verd', 'verdi', 'green', 'grene'], hex: '#10b981' },
  { name: 'Laranja', aliases: ['laranja', 'laranga', 'laranxa', 'laranjа', 'orange', 'orang'], hex: '#f97316' },
  { name: 'Amarelo', aliases: ['amarelo', 'amarelo', 'amarello', 'amarllo', 'yellow', 'yelo'], hex: '#f59e0b' },
  { name: 'Roxo', aliases: ['roxo', 'rocho', 'roxu', 'violet', 'purple', 'purplo', 'lilas', 'lilás', 'lilas'], hex: '#8b5cf6' },
  { name: 'Ciano', aliases: ['ciano', 'cyano', 'cyan', 'turquesa', 'turqueza', 'azul claro', 'celeste'], hex: '#06b6d4' },
  { name: 'Verde Escuro', aliases: ['verde escuro', 'verde dark', 'oliva', 'olivа'], hex: '#4d7c0f' },
  { name: 'Marrom', aliases: ['marrom', 'maron', 'marron', 'brown', 'cafe', 'café', 'chocolate'], hex: '#78350f' },
  { name: 'Preto', aliases: ['preto', 'pretu', 'black', 'negra', 'negro'], hex: '#000000' },
  { name: 'Azul Ardósia', aliases: ['ardosia', 'ardósia', 'azul ardosia', 'slate blue', 'indigo claro'], hex: '#6279A8' },
];

// Normaliza string: minúsculas + sem acentos
const normalizeStr = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

// Distância de edição simples (Levenshtein)
const levenshtein = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
};

// Detecta uma cor a partir do texto digitado
const resolveColorFromText = (text: string): { hex: string; name: string } | null => {
  if (!text.trim()) return null;
  const norm = normalizeStr(text);
  // 1. Correspondência exata por alias
  for (const c of COLOR_NAME_MAP) {
    if (c.aliases.some(a => normalizeStr(a) === norm)) return { hex: c.hex, name: c.name };
  }
  // 2. Correspondência por prefixo (>= 3 chars)
  if (norm.length >= 3) {
    for (const c of COLOR_NAME_MAP) {
      if (c.aliases.some(a => normalizeStr(a).startsWith(norm) || norm.startsWith(normalizeStr(a).slice(0, norm.length)))) {
        return { hex: c.hex, name: c.name };
      }
    }
  }
  // 3. Fuzzy match: distância de edição <= ceil(len/3)
  if (norm.length >= 3) {
    let best: { hex: string; name: string; dist: number } | null = null;
    for (const c of COLOR_NAME_MAP) {
      for (const alias of c.aliases) {
        const a = normalizeStr(alias);
        const threshold = Math.ceil(Math.max(norm.length, a.length) / 3);
        const dist = levenshtein(norm, a);
        if (dist <= threshold && (!best || dist < best.dist)) {
          best = { hex: c.hex, name: c.name, dist };
        }
      }
    }
    if (best) return { hex: best.hex, name: best.name };
  }
  return null;
};

const colorPalette = DEFAULT_COLOR_PALETTE;

const fonts = [
  { name: 'Arial', value: 'Arial, sans-serif' },
  { name: 'Georgia', value: 'Georgia, serif' },
  { name: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { name: 'Courier New', value: '"Courier New", Courier, monospace' },
  { name: 'Comic Sans', value: '"Comic Sans MS", cursive, sans-serif' },
  { name: 'Impact', value: 'Impact, Charcoal, sans-serif' }
];

const fontSizes = [
  { name: 'Muito Pequeno', value: '1' },
  { name: 'Pequeno', value: '2' },
  { name: 'Normal', value: '3' },
  { name: 'Médio', value: '4' },
  { name: 'Grande', value: '5' },
  { name: 'Muito Grande', value: '6' },
  { name: 'Gigante', value: '7' }
];

const markers = [
  { name: 'Bolinha', char: '●' },
  { name: 'Quadrado', char: '■' },
  { name: 'Triângulo', char: '▲' },
  { name: 'Estrela', char: '★' },
  { name: 'Seta', char: '➔' }
];

// Mapeamento de Disciplinas e suas Matérias específicas para uso no sistema de Curiosidades
const subjectsReference = {
  'Matemática': [
    'Matemática básica', 'Conjuntos', 'Funções', 'Geometria plana',
    'Sequências', 'Trigonometria', 'Matrizes', 'Análise combinatória',
    'Probabilidade', 'Geometria de posição', 'Geometria espacial',
    'Estatística', 'Geometria analítica'
  ],
  'Biologia': [
    'Introdução à biologia', 'Origem da vida', 'Bioquímica', 'Citologia',
    'Histologia humana', 'Reprodução humana e embriologia', 'Taxonomia',
    'Microbiologia', 'Botânica', 'Zoologia', 'Fisiologia humana',
    'Genética', 'Evolução', 'Ecologia'
  ],
  'Química': [
    'Introdução à química', 'Matéria e energia', 'Reações químicas',
    'Atomística', 'Química Inorgânica', 'Estequiometria', 'Soluções',
    'Propriedades coligativas', 'Nox', 'Eletroquímica', 'Termoquímica',
    'Cinética química', 'Equilíbrio química', 'Radioatividade',
    'Química orgânica', 'Química ambiental'
  ],
  'Física': [
    'Unidades de medida', 'Mecânica', 'Termologia', 'Ondulatória',
    'Óptica', 'Eletricidade', 'Física moderna'
  ],
  'Geografia': [
    'Cartologia', 'Geologia', 'Clima, Bioma e Meio ambiente', 'Hidrografia',
    'Estudo do solo', 'População', 'Urbanização', 'Economia'
  ],
  'História': [
    'Idade antiga', 'Idade Média', 'Idade Moderna', 'Idade Contemporânea',
    'Período Pré-colonial(1500-1530)', 'Período Colonial(1530-1822)',
    'Período Imperial(1822-1889)', 'Período Republicano(1889-2026)'
  ],
  'Sociologia': [
    'Introdução à sociologia', 'Sociólogos', 'Sociologia Brasileira',
    'Questões sociais', 'Antropologia'
  ],
  'Filosofia': [
    'Filosofia Pré-socrática', 'Filosofia Clássica', 'Filosofia Medieval',
    'Filosofia Moderna', 'Filosofia Contemporânea'
  ]
};

// Mapeamento para o formulário
const disciplineMatters: Record<string, string[]> = {
  ...subjectsReference,
  'Redação': ['Competências', 'Estrutura', 'repertório'],
  'Português': [],
  'Literatura': [
    'Introdução à literatura', 'Escolas literárias', 'Modernismo',
    'Autores no ENEM', 'Literatura Contemporânea', 'Poesia', 'História da Arte'
  ]
};

const areaMatters: Record<string, string[]> = {
  'Geografia física': ['Cartologia', 'Geologia', 'Clima, Bioma e Meio ambiente', 'Hidrografia', 'Estudo do solo'],
  'Geografia humana': ['População', 'Urbanização', 'Economia'],
  'História geral': ['Idade antiga', 'Idade Média', 'Idade Moderna', 'Idade Contemporânea'],
  'História do Brasil': ['Período Pré-colonial(1500-1530)', 'Período Colonial(1530-1822)', 'Período Imperial(1822-1889)', 'Período Republicano(1889-2026)'],
  'Gramática': ['Fonética, Q. ortográficas e R. semânticas', 'Morfologia', 'Sintaxe 1', 'Sintaxe 2', 'Concordância', 'Regência', 'Crase', 'Colocação pronominal', 'Pontuação', 'Semântica'],
  'Interpretação de texto': ['Interpretação 1', 'Interpretação 2', 'Funções da linguagem', 'Figuras de linguagem', 'Linguagem culta e linguagem coloquial', 'Estrategias de interpretação', 'Texto e contexto', 'Gêneros terxtuais']
};

const disciplinesList = [
  'Matemática', 'Redação', 'Biologia', 'Química', 'Física',
  'Geografia', 'História', 'Português', 'Filosofia', 'Sociologia', 'Literatura'
];

type StudyView = 'menu' | 'sessionType' | 'studyMaterialSelect' | 'sessionTypeChoice' | 'sessionUnique' | 'sessionPomodoro' | 'sessionPreDefined' | 'sessionCustomDuration' | 'sessionTimerActive' | 'pomodoroTimerActive' | 'knowledgeBank' | 'categoryDetail' | 'addBookForm' | 'addPdfForm' | 'addVideoForm' | 'addReviewForm' | 'addQuestionForm' | 'addSimuladoForm' | 'myBank' | 'vocabulary' | 'vocabRevisionMenu' | 'vocabRevisionSession' | 'vocabRevisionResult' | 'curiosity' | 'mnemonic' | 'activeReview' | 'otherSubjectsMenu' | 'addReviewFlashcardFront' | 'addReviewFlashcardBack' | 'activeReviewSession' | 'activeReviewResult';
type Relevance = 'Alta' | 'Média' | 'Baixa' | 'Baixíssima';

type VocabularySubView = 'categories' | 'create_category' | 'edit_category' | 'category_detail' | 'add_word';

interface Book {
  id: string;
  name: string;
  categoryId: string;
  type: string;
  estimateDays?: number;
  totalPages: number;
  readPages: number;
  color: string;
  dateAdded: string;
  relevance?: Relevance;
  videoFinality?: 'Para estudo' | 'Entretenimento';
  videoSource?: string;
  videoDuration?: string;
  videoCompletionTime?: string;
  reviewMethod?: 'Ativa' | 'Passiva';
  reviewRepetitions?: number;
  reviewDuration?: string;
  questionSource?: string;
  questionQuantity?: number;
  questionDuration?: string;
  simuladoOrigin?: 'ENEM' | 'Vestibulares' | 'Faculdade';
  simuladoYear?: string;
  simuladoTestType?: string;
  simuladoArea?: string;
  simuladoTestColorName?: string;
  simuladoDurationMins?: number;
  videoStudyType?: 'ensino_medio' | 'faculdade';
  videoDiscipline?: string;
  videoArea?: string;
  videoMatter?: string;
  videoTopic?: string;
  videoSubject?: string;
  videoSub1?: string;
  videoSub2?: string;
  videoSub3?: string;
  flashcardFront?: string;
  flashcardBack?: string;
  flashcardImages?: { id: string; src: string; x: number; y: number; size: number }[];
}

interface ReviewPendency {
  id: string;
  path: string; // e.g. "Matemática / Matemática Básica / Tópico"
  note: string; // what the user said was missing
  date: string;
  itemName: string;
  completed?: boolean;
}

interface VocabularyItem {
  id: string;
  term: string;
  meaning: string;
  categoryId: string;
  categoryName: string;
  color: string;
  lastModified: string;
  isReviewError?: boolean;
}

interface VocabularyCategory {
  id: string;
  name: string;
  color: string;
}

interface CategoryItem {
  label: string;
  icon: React.ReactNode;
  singular: string;
}

interface CuriosityFeedback {
  category: string;
  topic: string;
  liked: boolean;
  discipline?: string;
}

interface MnemonicResult {
  id: string;
  type: string;
  text: string;
  explanation: string;
  tip: string;
  liked?: boolean | null;
  similar?: MnemonicResult[];
}

interface StudyProps {
  isDarkMode?: boolean;
  onOpenDetail?: (item: Book) => void;
  onViewChange?: (view: string) => void;
}

const Study: React.FC<StudyProps> = ({ isDarkMode, onOpenDetail, onViewChange }) => {
  const { user } = useAuth();
  console.log('[Study] Renderizado. Usuário logado:', user?.id || 'não');
  const [view, setView] = useState<StudyView>('menu');
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  // Notify parent when view changes
  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);

  const [isFromActiveReview, setIsFromActiveReview] = useState(false);
  const [isFromOtherSubjectsMenu, setIsFromOtherSubjectsMenu] = useState(false);
  const [isFromStudyMaterialSelect, setIsFromStudyMaterialSelect] = useState(false);
  const [selectedStudyItemIds, setSelectedStudyItemIds] = useState<string[]>([]);
  const [selectedStudyItem, setSelectedStudyItem] = useState<Book | null>(null);
  const selectedStudyItemRef = useRef<Book | null>(null);
  useEffect(() => {
    selectedStudyItemRef.current = selectedStudyItem;
  }, [selectedStudyItem]);

  const [studySessionHasStarted, setStudySessionHasStarted] = useState(false);
  const [pendingHomeNavigation, setPendingHomeNavigation] = useState(false);

  // Post-session progress modal
  const [showPostSessionModal, setShowPostSessionModal] = useState(false);
  const [postSessionPagesInput, setPostSessionPagesInput] = useState('');
  const [postSessionPagesWarning, setPostSessionPagesWarning] = useState('');
  const [postSessionVideoH, setPostSessionVideoH] = useState<number | string>(0);
  const [postSessionVideoM, setPostSessionVideoM] = useState<number | string>(0);
  const [preFocusValueH, setPreFocusValueH] = useState<number | string>(0);
  const [preFocusValueM, setPreFocusValueM] = useState<number | string>(0);
  const [postSessionReviewDone, setPostSessionReviewDone] = useState<boolean | null>(null);
  const [postSessionReviewNote, setPostSessionReviewNote] = useState('');

  // Review pendencies
  const [reviewPendencies, setReviewPendencies] = useState<ReviewPendency[]>(() => {
    try { return JSON.parse(localStorage.getItem('produtivity_review_pendencies') || '[]'); } catch { return []; }
  });
  const [showPendencyDetail, setShowPendencyDetail] = useState<ReviewPendency | null>(null);
  const [pendencyToDelete, setPendencyToDelete] = useState<ReviewPendency | null>(null);
  const [activeReviewSubView, setActiveReviewSubView] = useState<'main' | 'pendencies'>('main');

  // Pomodoro states
  const [pomodoroFocusH, setPomodoroFocusH] = useState(0);
  const [pomodoroFocusM, setPomodoroFocusM] = useState(25);
  const [pomodoroFocusS, setPomodoroFocusS] = useState(0);
  const [pomodoroBreakM, setPomodoroBreakM] = useState(5);
  const [pomodoroBreakS, setPomodoroBreakS] = useState(0);
  // Custom duration states
  const [customDurationH, setCustomDurationH] = useState(0);
  const [customDurationM, setCustomDurationM] = useState(30);
  // Pomodoro active timer states
  const [pomodoroPhase, setPomodoroPhase] = useState<'focus' | 'break'>('focus');
  const [pomodoroTimerSecs, setPomodoroTimerSecs] = useState(0);
  const [pomodoroTotalSecs, setPomodoroTotalSecs] = useState(0);
  const [pomodoroIsRunning, setPomodoroIsRunning] = useState(false);
  const [pomodoroCompletedFocus, setPomodoroCompletedFocus] = useState(0);
  const [pomodoroCompletedBreak, setPomodoroCompletedBreak] = useState(0);
  const [showPomodoroResetMessage, setShowPomodoroResetMessage] = useState(false);
  const [pomodoroResetCountdown, setPomodoroResetCountdown] = useState(0);
  const [showEndPomodoroConfirm, setShowEndPomodoroConfirm] = useState(false);
  const pomodoroIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [totalSessionSeconds, setTotalSessionSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [timerAlarmActive, setTimerAlarmActive] = useState(false);
  const [pomodoroAlarmActive, setPomodoroAlarmActive] = useState(false);
  const alarmAudioCtxRef = useRef<AudioContext | null>(null);
  const alarmIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pendingPomodoroPhaseRef = useRef<(() => void) | null>(null);

  // Cache para acumular os segundos entre atualizações da localStorage
  const realtimeSessionSecondsAcc = useRef(0);

  // Função independente para incrementar 1 segundo do estudo na localStorage
  const incrementStudyRealtimeSecond = () => {
    realtimeSessionSecondsAcc.current += 1;
    // Quando fechar 60 segundos (1 minuto) de retenção, salta e salva na store
    if (realtimeSessionSecondsAcc.current >= 60) {
      realtimeSessionSecondsAcc.current = 0;
      try {
        const today = new Date();
        const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

        const savedV2 = localStorage.getItem('produtivity_study_session_dates_v2');
        const existingV2: Record<string, number> = savedV2 ? JSON.parse(savedV2) : {};
        existingV2[dateStr] = (existingV2[dateStr] || 0) + 1; // 1 minuto ganho
        localStorage.setItem('produtivity_study_session_dates_v2', JSON.stringify(existingV2));

        // Fallback pra V1 (apenas marcar que fez algo)
        const saved = localStorage.getItem('produtivity_study_session_dates');
        const existing: string[] = saved ? JSON.parse(saved) : [];
        if (!existing.includes(dateStr)) {
          const updated = [...existing, dateStr];
          localStorage.setItem('produtivity_study_session_dates', JSON.stringify(updated));
        }

        // Período do dia
        const h = today.getHours();
        const period = h >= 6 && h < 12 ? 'matutino' : h >= 12 && h < 18 ? 'vespertino' : h >= 18 ? 'noturno' : 'madrugada';
        const savedPeriods = localStorage.getItem('produtivity_study_time_periods');
        const periods: Record<string, Record<string, number>> = savedPeriods ? JSON.parse(savedPeriods) : {};
        if (!periods[dateStr]) periods[dateStr] = { matutino: 0, vespertino: 0, noturno: 0, madrugada: 0 };
        periods[dateStr][period] = (periods[dateStr][period] || 0) + 1;
        localStorage.setItem('produtivity_study_time_periods', JSON.stringify(periods));

        // Salvar tempo específico por Matéria (para o gráfico de pizza)
        const currentItem = selectedStudyItemRef.current;
        if (currentItem) {
          try {
            const timesStr = localStorage.getItem('produtivity_study_item_times') || '{}';
            const timesObj = JSON.parse(timesStr);
            timesObj[currentItem.id] = (timesObj[currentItem.id] || 0) + 1;
            localStorage.setItem('produtivity_study_item_times', JSON.stringify(timesObj));
          } catch { }
        }
      } catch {
        // ignore
      }
    }
  };

  const startAlarm = () => {
    const playBeep = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        alarmAudioCtxRef.current = ctx;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.6, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.5);
      } catch (e) { /* ignore audio errors */ }
    };
    playBeep();
    alarmIntervalRef.current = setInterval(playBeep, 900);
  };

  const stopAlarm = () => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = null;
    setTimerAlarmActive(false);
  };

  const stopPomodoroAlarm = () => {
    if (alarmIntervalRef.current) clearInterval(alarmIntervalRef.current);
    alarmIntervalRef.current = null;
    setPomodoroAlarmActive(false);
    if (pendingPomodoroPhaseRef.current) {
      pendingPomodoroPhaseRef.current();
      pendingPomodoroPhaseRef.current = null;
    }
  };

  // Timer Countdown Effect
  useEffect(() => {
    if (isTimerRunning && timerSeconds > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(s => Math.max(0, s - 1));
        incrementStudyRealtimeSecond();
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (timerSeconds === 0 && isTimerRunning) {
        setIsTimerRunning(false);
        setTimerAlarmActive(true);
        startAlarm();
      }
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isTimerRunning, timerSeconds]);

  // Pomodoro Countdown Effect
  useEffect(() => {
    if (pomodoroIsRunning && pomodoroTimerSecs > 0) {
      pomodoroIntervalRef.current = setInterval(() => {
        setPomodoroTimerSecs(s => Math.max(0, s - 1));
        if (pomodoroPhase === 'focus') {
          incrementStudyRealtimeSecond();
        }
      }, 1000);
    } else {
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
      if (pomodoroTimerSecs === 0 && pomodoroIsRunning) {
        setPomodoroIsRunning(false);

        if (pomodoroPhase === 'focus') {
          const nextFocusCount = Math.min(4, pomodoroCompletedFocus + 1);
          const breakSecs = pomodoroBreakM * 60 + pomodoroBreakS;
          // Queue the phase transition — only executes after alarm is dismissed
          pendingPomodoroPhaseRef.current = () => {
            setPomodoroCompletedFocus(nextFocusCount);
            setPomodoroPhase('break');
            setPomodoroTimerSecs(breakSecs);
            setPomodoroTotalSecs(breakSecs);
          };
          setPomodoroAlarmActive(true);
          startAlarm();
        } else {
          const nextBreakCount = Math.min(4, pomodoroCompletedBreak + 1);
          if (nextBreakCount === 4 && pomodoroCompletedFocus === 4) {
            pendingPomodoroPhaseRef.current = () => {
              setPomodoroCompletedBreak(nextBreakCount);
              setShowPomodoroResetMessage(true);
              setPomodoroResetCountdown(3);
              const countdownInterval = setInterval(() => {
                setPomodoroResetCountdown(prev => Math.max(0, prev - 1));
              }, 1000);
              setTimeout(() => {
                clearInterval(countdownInterval);
                setShowPomodoroResetMessage(false);
                setPomodoroResetCountdown(0);
                setPomodoroCompletedFocus(0);
                setPomodoroCompletedBreak(0);
                const focusSecs = pomodoroFocusH * 3600 + pomodoroFocusM * 60 + pomodoroFocusS;
                setPomodoroPhase('focus');
                setPomodoroTimerSecs(focusSecs);
                setPomodoroTotalSecs(focusSecs);
              }, 3000);
            };
          } else {
            const focusSecs = pomodoroFocusH * 3600 + pomodoroFocusM * 60 + pomodoroFocusS;
            pendingPomodoroPhaseRef.current = () => {
              setPomodoroCompletedBreak(nextBreakCount);
              setPomodoroPhase('focus');
              setPomodoroTimerSecs(focusSecs);
              setPomodoroTotalSecs(focusSecs);
            };
          }
          setPomodoroAlarmActive(true);
          startAlarm();
        }
      }
    }
    return () => {
      if (pomodoroIntervalRef.current) clearInterval(pomodoroIntervalRef.current);
    };
  }, [pomodoroIsRunning, pomodoroTimerSecs, pomodoroPhase, pomodoroBreakM, pomodoroBreakS, pomodoroFocusH, pomodoroFocusM, pomodoroFocusS, pomodoroCompletedFocus, pomodoroCompletedBreak]);

  // Flush accumulated study time when leaving timer active views
  useEffect(() => {
    const timerViews = ['sessionTimerActive', 'pomodoroTimerActive'];
    if (!timerViews.includes(view) && realtimeSessionSecondsAcc.current > 0) {
      // User navigated away from a timer view, save any accumulated seconds
      const accSecs = realtimeSessionSecondsAcc.current;
      if (accSecs > 0) {
        recordStudySessionDate(accSecs / 60);
        realtimeSessionSecondsAcc.current = 0;
      }
    }
  }, [view]);

  // Flush on component unmount (e.g., user changes page via sidebar)
  useEffect(() => {
    return () => {
      const accSecs = realtimeSessionSecondsAcc.current;
      if (accSecs > 0) {
        recordStudySessionDate(accSecs / 60);
        realtimeSessionSecondsAcc.current = 0;
      }
    };
  }, []);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const [showAddMoreFlashcardsModal, setShowAddMoreFlashcardsModal] = useState(false);
  const [pendingFlashcardContext, setPendingFlashcardContext] = useState<{
    reviewSubject: string;
    videoStudyType: string | null;
    videoDiscipline: string;
    videoArea: string;
    videoMatter: string;
    videoTopic: string;
    videoSub1: string;
    videoSub2: string;
    videoSub3: string;
    flashcardCountForSubject: number;
  } | null>(null);

  // Estados para navegação do Banco Padronizado (Vídeo, Revisão, Questão, Simulado)
  const [standardBankStep, setStandardBankStep] = useState<'disciplines' | 'areas' | 'matters' | 'topics' | 'sub1' | 'sub2' | 'sub3' | 'content' | 'sim_origins' | 'sim_years' | 'sim_types' | 'sim_areas'>('disciplines');
  const [standardBankPath, setStandardBankPath] = useState<{ label: string, type: string, value: string }[]>([]);
  const [standardBankMode, setStandardBankMode] = useState<'ensino_medio' | 'faculdade' | 'simulados'>('ensino_medio');

  // Vocabulary States
  const [vocabSubView, setVocabSubView] = useState<VocabularySubView>('categories');
  const [vocabulary, setVocabulary] = useState<VocabularyItem[]>([]);
  const [vocabCategories, setVocabCategories] = useState<VocabularyCategory[]>([]);
  const [newTerm, setnewTerm] = useState({ term: '', meaning: '', color: colorPalette[0] });
  const [newVocabCatName, setNewVocabCatName] = useState('');
  const [selectedVocabColor, setSelectedVocabColor] = useState(colorPalette[0]);
  const [editingVocabCategory, setEditingVocabCategory] = useState<VocabularyCategory | null>(null);
  const [vocabCategoryToDelete, setVocabCategoryToDelete] = useState<VocabularyCategory | null>(null);
  const [activeVocabCategory, setActiveVocabCategory] = useState<VocabularyCategory | null>(null);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});

  // Curiosity States
  const [curiosityStep, setCuriosityStep] = useState<'selection' | 'loading' | 'result'>('selection');
  const [curiosityData, setCuriosityData] = useState<{ title: string; text: string; details: string; imageUrl: string; category: string; topic: string; discipline: string } | null>(null);
  const [curiosityHistory, setCuriosityHistory] = useState<CuriosityFeedback[]>([]);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showCuriosityDetails, setShowCuriosityDetails] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);

  // Mnemonic AI States
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [isGeneratingMnemonic, setIsGeneratingMnemonic] = useState(false);
  const [loadingSimilarId, setLoadingSimilarId] = useState<string | null>(null);
  const [showSimilarIds, setShowSimilarIds] = useState<Record<string, boolean>>({});
  const [mnemonicResults, setMnemonicResults] = useState<MnemonicResult[]>([]);
  const [likedMnemonicsHistory, setLikedMnemonicsHistory] = useState<MnemonicResult[]>([]);
  const [replacingMnemonicId, setReplacingMnemonicId] = useState<string | null>(null);

  // Revision Session States
  const [revisionQueue, setRevisionQueue] = useState<VocabularyItem[]>([]);
  const [currentRevisionIndex, setCurrentRevisionIndex] = useState(0);
  const [revisionScore, setRevisionScore] = useState(0);
  const [isRevisionCardFlipped, setIsRevisionCardFlipped] = useState(false);
  const [revisionMode, setRevisionMode] = useState<'all' | 'category' | 'errors'>('all');
  const [selectedRevisionCategory, setSelectedRevisionCategory] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Active Review Session States
  const [activeReviewCards, setActiveReviewCards] = useState<Book[]>([]);
  const [currentActiveReviewIndex, setCurrentActiveReviewIndex] = useState(0);
  const [activeReviewScore, setActiveReviewScore] = useState(0);
  const [isActiveReviewCardFlipped, setIsActiveReviewCardFlipped] = useState(false);
  // Error review mode: tracks which session is an error-retry session
  const [isErrorReviewMode, setIsErrorReviewMode] = useState(false);
  // Set of flashcard IDs that were answered wrong, persisted in localStorage
  const [flashcardErrorIds, setFlashcardErrorIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('produtivity_flashcard_errors');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  const saveFlashcardErrorIds = (newSet: Set<string>) => {
    setFlashcardErrorIds(newSet);
    localStorage.setItem('produtivity_flashcard_errors', JSON.stringify([...newSet]));
  };

  // Form states
  const [bookName, setBookName] = useState('');
  const [bookType, setBookType] = useState<'didatico' | 'outro'>('didatico');
  const [bookRelevance, setBookRelevance] = useState<Relevance | null>('Média');
  const [estimateDays, setEstimateDays] = useState<number | undefined>(0);
  const [totalPages, setTotalPages] = useState<number | undefined>(0);
  const [selectedColor, setSelectedColor] = useState(colorPalette[0]);

  // PDF
  const [pdfSubject, setPdfSubject] = useState('');
  const [pdfType, setPdfType] = useState<'didatico' | 'outro'>('didatico');
  const [pdfPages, setPdfPages] = useState<number | undefined>(0);
  const [pdfRelevance, setPdfRelevance] = useState<Relevance | null>('Média');
  const [pdfColor, setPdfColor] = useState(colorPalette[0]);

  // Controle de Fluxo Universal (Passo 1 -> Passo 2)
  const [sharedFormStep, setSharedFormStep] = useState<'metadata' | 'study_details'>('metadata');

  // Video - Etapa 1
  const [videoSubject, setVideoSubject] = useState('');
  const [videoFinality, setVideoFinality] = useState<'Para estudo' | 'Entretenimento'>('Entretenimento');
  const [videoSource, setVideoSource] = useState<'YouTube' | 'Faculdade' | 'Curso preparatório' | 'Outro'>('YouTube');
  const [vDurationH, setVDurationH] = useState<number | undefined>(0);
  const [vDurationM, setVDurationM] = useState<number | undefined>(0);
  const [vCompletionH, setVCompletionH] = useState<number | undefined>(0);
  const [vCompletionM, setVCompletionM] = useState<number | undefined>(0);
  const [videoRelevance, setVideoRelevance] = useState<Relevance>('Média');
  const [videoColor, setVideoColor] = useState(colorPalette[0]);
  const [videoOtherSource, setVideoOtherSource] = useState('');

  // Review - Etapa 1
  const [reviewSubject, setReviewSubject] = useState('');
  const [reviewMethod, setReviewMethod] = useState<'Ativa' | 'Passiva' | null>(null);
  const [reviewRepetitions, setReviewRepetitions] = useState<number | undefined>(0);
  const [revDurationH, setRevDurationH] = useState<number | undefined>(0);
  const [revDurationM, setRevDurationM] = useState<number | undefined>(0);
  const [reviewRelevance, setReviewRelevance] = useState<Relevance>('Média');
  const [reviewColor, setReviewColor] = useState(colorPalette[0]);

  // Flashcard States for Active Review
  const [flashcardFront, setFlashcardFront] = useState('');
  const [flashcardBack, setFlashcardBack] = useState('');
  const flashcardEditorRef = useRef<HTMLDivElement>(null);
  const [activeBold, setActiveBold] = useState(false);
  const [activeAlign, setActiveAlign] = useState('justifyLeft');
  const [activeColor, setActiveColor] = useState('#000000');
  const [activeFont, setActiveFont] = useState('Arial');
  const [activeSize, setActiveSize] = useState('3');
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);
  const [isMarkersMenuOpen, setIsMarkersMenuOpen] = useState(false);
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const markersMenuRef = useRef<HTMLDivElement>(null);
  // Image insertion states
  const [flashcardImages, setFlashcardImages] = useState<{ id: string; src: string; x: number; y: number; size: number }[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [draggingImageId, setDraggingImageId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [resizingImage, setResizingImage] = useState<{ id: string; startMouseX: number; startMouseY: number; startSize: number; startX: number; startY: number; corner: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [showActiveReviewManageModal, setShowActiveReviewManageModal] = useState(false);
  const [manageSelectedCards, setManageSelectedCards] = useState<Book[]>([]);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState<'single' | 'all' | null>(null);
  const [cardToDeleteId, setCardToDeleteId] = useState<string | null>(null);
  const [cardUnderDeletionId, setCardUnderDeletionId] = useState<string | null>(null);

  // Questions - Etapa 1
  const [questionSubject, setQuestionSubject] = useState('');
  const [questionSource, setQuestionSource] = useState<string>('YouTube');
  const [questionOtherSource, setQuestionOtherSource] = useState('');
  const [questionQuantity, setQuestionQuantity] = useState<number | undefined>(0);
  const [questionQuantityLeft, setQuestionQuantityLeft] = useState<number | undefined>(0);
  const [qDurationH, setQDurationH] = useState<number | undefined>(0);
  const [qDurationM, setQDurationM] = useState<number | undefined>(0);
  const [questionRelevance, setQuestionRelevance] = useState<Relevance>('Média');
  const [questionColor, setQuestionColor] = useState(colorPalette[0]);

  // Etapa 2 - Detalhes do Estudo (Compartilhado entre Video, Review e Questão)
  const [videoStudyType, setVideoStudyType] = useState<'ensino_medio' | 'faculdade' | null>(null);
  const [videoDiscipline, setVideoDiscipline] = useState('');
  const [videoArea, setVideoArea] = useState('');
  const [videoMatter, setVideoMatter] = useState('');
  const [videoTopic, setVideoTopic] = useState('');
  const [videoSub1, setVideoSub1] = useState('');
  const [videoSub2, setVideoSub2] = useState('');
  const [videoSub3, setVideoSub3] = useState('');

  // Estados de listas de tópicos/subtópicos salvos — chaves dinâmicas por caminho
  // Não há mais estados fixos de arrays; usamos localStorage diretamente com chaves específicas
  const [savedItemsCache, setSavedItemsCache] = useState<Record<string, string[]>>({});

  const [topicMode, setTopicMode] = useState<'select' | 'add' | ''>('');
  const [sub1Mode, setSub1Mode] = useState<'select' | 'add' | ''>('');
  const [sub2Mode, setSub2Mode] = useState<'select' | 'add' | ''>('');
  const [sub3Mode, setSub3Mode] = useState<'select' | 'add' | ''>('');

  const [tempTopic, setTempTopic] = useState('');
  const [tempSub1, setTempSub1] = useState('');
  const [tempSub2, setTempSub2] = useState('');
  const [tempSub3, setTempSub3] = useState('');

  // Simulado
  const [simOrigin, setSimOrigin] = useState<'ENEM' | 'Vestibulares' | 'Faculdade' | null>(null);
  const [simuladosOriginFilter, setSimuladosOriginFilter] = useState<'ENEM' | 'Vestibulares' | 'Faculdade' | null>(null);
  const [simYear, setSimYear] = useState('');
  const [simType, setSimType] = useState('');
  const [simArea, setSimArea] = useState('');
  const [simTestColorName, setSimTestColorName] = useState('');
  const [simVestName, setSimVestName] = useState('');
  const [simSubject, setSimSubject] = useState('');
  const [simQty, setSimQty] = useState<number | undefined>(0);
  const [simDurH, setSimDurH] = useState<number | undefined>(0);
  const [simDurM, setSimDurM] = useState<number | undefined>(0);
  const [simColor, setSimColor] = useState(colorPalette[0]);
  const [dynamicPalette, setDynamicPalette] = useState<string[]>(DEFAULT_COLOR_PALETTE);
  const [detectedColorName, setDetectedColorName] = useState<string | null>(null);

  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';

  const relevanceColorMap: Record<Relevance, string> = {
    'Alta': '#ef4444',
    'Média': '#eab308',
    'Baixa': '#22c55e',
    'Baixíssima': '#6b7280'
  };

  const numericBtnClass = "w-12 h-12 rounded-xl bg-[#7EB1FF] border-black border-[#7EB1FF] flex items-center justify-center text-white font-black text-2xl hover:brightness-110 transition-all active:scale-95 shadow-sm";

  const getRelevanceBtnClass = (rel: Relevance, currentSelected: Relevance | null) => {
    const isSelected = currentSelected === rel;
    const base = "px-4 py-1.5 rounded-full font-black text-sm border-2 transition-all shadow-sm";
    const idleStyles = "bg-white text-black border-black/15 hover:bg-slate-50";
    const hoverStyles: Record<Relevance, string> = {
      'Alta': 'hover:border-red-500',
      'Média': 'hover:border-yellow-400',
      'Baixa': 'hover:border-green-500',
      'Baixíssima': 'hover:border-slate-500'
    };
    const selectedStyles: Record<Relevance, string> = {
      'Alta': 'bg-red-500 border-red-500 text-white',
      'Média': 'bg-yellow-400 border-yellow-400 text-white',
      'Baixa': 'bg-green-500 border-green-500 text-white',
      'Baixíssima': 'bg-slate-500 border-slate-500 text-white'
    };
    return `${base} ${hoverStyles[rel]} ${isSelected ? selectedStyles[rel] : idleStyles}`;
  };

  const updateToolbarState = useCallback(() => {
    setActiveBold(document.queryCommandState('bold'));
    if (document.queryCommandState('justifyCenter')) setActiveAlign('justifyCenter');
    else if (document.queryCommandState('justifyRight')) setActiveAlign('justifyRight');
    else setActiveAlign('justifyLeft');

    const color = document.queryCommandValue('foreColor');
    if (color) setActiveColor(color);

    const font = document.queryCommandValue('fontName');
    if (font) {
      const cleanFont = font.replace(/"/g, '').split(',')[0].trim();
      const match = fonts.find(f => f.value.toLowerCase().includes(cleanFont.toLowerCase()));
      if (match) setActiveFont(match.name);
    }

    const size = document.queryCommandValue('fontSize');
    if (size) setActiveSize(size.toString());
  }, []);

  const execCommand = (command: string, value: string | undefined = undefined) => {
    if (flashcardEditorRef.current) {
      flashcardEditorRef.current.focus();
      document.execCommand(command, false, value);
      updateToolbarState();
    }
  };

  const insertMarker = (symbol: string) => {
    if (flashcardEditorRef.current) {
      flashcardEditorRef.current.focus();
      document.execCommand('insertText', false, symbol + ' ');
      updateToolbarState();
      setIsMarkersMenuOpen(false);
    }
  };

  useEffect(() => {
    // Carrega livros do localStorage
    if (user) {
      loadAllStudyItems().then(items => {
        setBooks(items);
      }).catch(err => {
        console.error('[Study] Erro ao carregar itens:', err);
        // Fallback para localStorage
        const savedBooks = localStorage.getItem('produtivity_books');
        if (savedBooks) setBooks(JSON.parse(savedBooks));
      });
    } else {
      const savedBooks = localStorage.getItem('produtivity_books');
      if (savedBooks) setBooks(JSON.parse(savedBooks));
    }

    const savedVocab = localStorage.getItem('produtivity_vocabulary');
    if (savedVocab) setVocabulary(JSON.parse(savedVocab));

    const savedVocabCats = localStorage.getItem('produtivity_vocabulary_cats');
    if (savedVocabCats) setVocabCategories(JSON.parse(savedVocabCats));

    const savedCurHistory = localStorage.getItem('produtivity_curiosity_history');
    if (savedCurHistory) setCuriosityHistory(JSON.parse(savedCurHistory));

    const savedMnemonicFeedback = localStorage.getItem('produtivity_mnemonic_feedback_history');
    if (savedMnemonicFeedback) setLikedMnemonicsHistory(JSON.parse(savedMnemonicFeedback));

    // Load cached saved items (all keys at once)
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith('produtivity_saved_path_'));
    if (allKeys.length > 0) {
      const cache: Record<string, string[]> = {};
      allKeys.forEach(k => {
        try { cache[k] = JSON.parse(localStorage.getItem(k) || '[]'); } catch { }
      });
      setSavedItemsCache(cache);
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fontMenuRef.current && !fontMenuRef.current.contains(target)) setIsFontMenuOpen(false);
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(target)) setIsFontSizeMenuOpen(false);
      if (markersMenuRef.current && !markersMenuRef.current.contains(target)) setIsMarkersMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveBooks = (newBooks: Book[]) => {
    setBooks(newBooks);
    localStorage.setItem('produtivity_books', JSON.stringify(newBooks));

    // Sincroniza em background
    console.log('[Study] saveBooks chamado. Salvando...');
    if (true) { // Removido guard if (user) para deixar o service lidar e logar se o user for null
      // Detecta quais itens são novos vs atualizados comparando com o estado anterior
      const oldIds = new Set(books.map(b => b.id));
      const newIds = new Set(newBooks.map(b => b.id));

      // Itens novos (presentes em newBooks mas não em books)
      for (const item of newBooks) {
        if (!oldIds.has(item.id)) {
          insertStudyItem(item, newBooks).catch(err =>
            console.error('[Study] Erro ao inserir:', err)
          );
        }
      }

      // Itens atualizados (presentes em ambos, mas podem ter mudado)
      for (const item of newBooks) {
        if (oldIds.has(item.id)) {
          const oldItem = books.find(b => b.id === item.id);
          if (oldItem && JSON.stringify(oldItem) !== JSON.stringify(item)) {
            updateStudyItem(item, newBooks).catch(err =>
              console.error('[Study] Erro ao atualizar:', err)
            );
          }
        }
      }

      // Itens deletados (presentes em books mas não em newBooks)
      for (const item of books) {
        if (!newIds.has(item.id)) {
          deleteStudyItem(item.id, item.categoryId, newBooks).catch(err =>
            console.error('[Study] Erro ao deletar:', err)
          );
        }
      }
    }
  };

  const getPostSessionType = () => {
    if (!selectedStudyItem) return 'none';
    const cat = selectedStudyItem.categoryId;
    if (cat === 'Meus livros' || cat === "Meus PDF's") return 'pages';
    if (cat === 'Minhas questões') return 'questions';
    if (cat === 'Meus simulados') return 'simulado';
    if (cat === 'Minhas vídeo aulas') return 'video';
    if (cat === 'Minhas revisões') return 'review';
    return 'none';
  };

  const recordStudySessionDate = (minutes: number) => {
    if (minutes <= 0) return;
    try {
      const today = new Date();
      const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

      const savedV2 = localStorage.getItem('produtivity_study_session_dates_v2');
      const existingV2: Record<string, number> = savedV2 ? JSON.parse(savedV2) : {};
      existingV2[dateStr] = (existingV2[dateStr] || 0) + minutes;
      localStorage.setItem('produtivity_study_session_dates_v2', JSON.stringify(existingV2));

      // Fallback pra V1 (apenas marcar que fez algo)
      const saved = localStorage.getItem('produtivity_study_session_dates');
      const existing: string[] = saved ? JSON.parse(saved) : [];
      if (!existing.includes(dateStr)) {
        const updated = [...existing, dateStr];
        localStorage.setItem('produtivity_study_session_dates', JSON.stringify(updated));
      }

      // Período do dia
      const h = today.getHours();
      const period = h >= 6 && h < 12 ? 'matutino' : h >= 12 && h < 18 ? 'vespertino' : h >= 18 ? 'noturno' : 'madrugada';
      const savedPeriods = localStorage.getItem('produtivity_study_time_periods');
      const periods: Record<string, Record<string, number>> = savedPeriods ? JSON.parse(savedPeriods) : {};
      if (!periods[dateStr]) periods[dateStr] = { matutino: 0, vespertino: 0, noturno: 0, madrugada: 0 };
      periods[dateStr][period] = (periods[dateStr][period] || 0) + minutes;
      localStorage.setItem('produtivity_study_time_periods', JSON.stringify(periods));
    } catch {
      // ignore
    }
  };

  // Salva imediatamente os segundos acumulados no localStorage (ao pausar, sair, etc.)
  const flushAccumulatedStudyTime = () => {
    const accSecs = realtimeSessionSecondsAcc.current;
    if (accSecs > 0) {
      // Converte segundos acumulados em minutos fracionários para não perder tempo
      const fractionalMinutes = accSecs / 60;
      recordStudySessionDate(fractionalMinutes);
      realtimeSessionSecondsAcc.current = 0;

      const currentItem = selectedStudyItemRef.current;
      if (currentItem) {
        try {
          const timesStr = localStorage.getItem('produtivity_study_item_times') || '{}';
          const timesObj = JSON.parse(timesStr);
          timesObj[currentItem.id] = (timesObj[currentItem.id] || 0) + fractionalMinutes;
          localStorage.setItem('produtivity_study_item_times', JSON.stringify(timesObj));
        } catch { }
      }
    }
  };

  const handleFinalizeSession = () => {
    // Session finish - Flush any accumulated study time immediately
    flushAccumulatedStudyTime();

    setIsTimerRunning(false);
    setPomodoroIsRunning(false);
    setStudySessionHasStarted(false);
    setShowEndPomodoroConfirm(false);

    const postType = getPostSessionType();
    if (selectedStudyItem && postType !== 'none') {
      // Reset inputs
      setPostSessionPagesInput('');
      setPostSessionVideoH(0);
      setPostSessionVideoM(0);
      setPostSessionReviewDone(null);
      setPostSessionReviewNote('');
      setShowPostSessionModal(true);
    } else {
      if (pendingHomeNavigation) {
        setView('menu');
        setSelectedCategory(null);
        setIsFromActiveReview(false);
        setIsFromStudyMaterialSelect(false);
        setSelectedStudyItemIds([]);
        setPendingHomeNavigation(false);
      } else {
        setView('sessionType');
      }
    }
  };

  const handlePostSessionConfirm = () => {
    if (!selectedStudyItem) {
      if (pendingHomeNavigation) {
        setView('menu');
        setSelectedCategory(null);
        setIsFromActiveReview(false);
        setIsFromStudyMaterialSelect(false);
        setSelectedStudyItemIds([]);
        setPendingHomeNavigation(false);
      } else {
        setView('sessionType');
      }
      return;
    }
    const postType = getPostSessionType();

    if (postType === 'pages' || postType === 'questions' || postType === 'simulado') {
      const amount = parseInt(postSessionPagesInput) || 0;
      if (amount > 0 || postType === 'simulado') {
        let updated = books.map(b => b.id === selectedStudyItem.id ? { ...b, readPages: b.readPages + amount } : b);
        if (postType === 'simulado') {
          const mins = (Number(postSessionVideoH) || 0) * 60 + (Number(postSessionVideoM) || 0);
          if (mins > 0) {
            updated = updated.map(b => b.id === selectedStudyItem.id ? { ...b, simuladoDurationMins: (b.simuladoDurationMins || 0) + mins } : b);
          }
        }
        saveBooks(updated);

        // Se for um livro, registra o progresso no histórico
        if (selectedStudyItem.categoryId === 'Meus livros') {
          const updatedBook = updated.find(b => b.id === selectedStudyItem.id);
          if (updatedBook) {
            recordBookProgress(updatedBook.id, amount, updatedBook.totalPages).catch(err => {
              console.error("[Study] Erro ao registrar progresso do livro:", err);
            });
          }
        }
      }
    } else if (postType === 'video') {
      const mins = (Number(postSessionVideoH) || 0) * 60 + (Number(postSessionVideoM) || 0);
      if (mins > 0) {
        const updated = books.map(b => b.id === selectedStudyItem.id ? { ...b, readPages: b.readPages + mins } : b);
        saveBooks(updated);
      }
    } else if (postType === 'review') {
      if (postSessionReviewDone === true) {
        // Count 1 repetition
        const updated = books.map(b => b.id === selectedStudyItem.id ? { ...b, readPages: b.readPages + 1 } : b);
        saveBooks(updated);
      } else if (postSessionReviewDone === false && postSessionReviewNote.trim()) {
        // Build path from item metadata
        const parts = [
          selectedStudyItem.videoDiscipline,
          selectedStudyItem.videoMatter,
          selectedStudyItem.videoTopic,
          selectedStudyItem.videoSub1,
          selectedStudyItem.videoSub2,
          selectedStudyItem.videoSub3,
        ].filter(Boolean);
        const path = parts.length > 0 ? parts.join(' / ') : selectedStudyItem.name;
        const pendency: ReviewPendency = {
          id: Date.now().toString(),
          path,
          note: postSessionReviewNote.trim(),
          date: new Date().toLocaleDateString('pt-BR'),
          itemName: selectedStudyItem.name,
        };
        const updated = [...reviewPendencies, pendency];
        setReviewPendencies(updated);
        localStorage.setItem('produtivity_review_pendencies', JSON.stringify(updated));
      }
    }

    setShowPostSessionModal(false);
    if (pendingHomeNavigation) {
      setView('menu');
      setSelectedCategory(null);
      setIsFromActiveReview(false);
      setIsFromStudyMaterialSelect(false);
      setSelectedStudyItemIds([]);
      setPendingHomeNavigation(false);
    } else {
      setView('sessionType');
    }
  };

  const saveVocabulary = (newVocab: VocabularyItem[]) => {
    setVocabulary(newVocab);
    localStorage.setItem('produtivity_vocabulary', JSON.stringify(newVocab));
  };

  const saveVocabCategories = (newCats: VocabularyCategory[]) => {
    setVocabCategories(newCats);
    localStorage.setItem('produtivity_vocabulary_cats', JSON.stringify(newCats));
  };

  // Gera chave de armazenamento específica para o caminho atual
  const getPathKey = (type: 'topic' | 'sub1' | 'sub2' | 'sub3') => {
    const parts = [videoStudyType, videoDiscipline, videoArea, videoMatter].filter(Boolean);
    return `produtivity_saved_path_${type}__${parts.join('__').replace(/\s/g, '_')}`;
  };

  const getSavedListForPath = (type: 'topic' | 'sub1' | 'sub2' | 'sub3'): string[] => {
    const key = getPathKey(type);
    return savedItemsCache[key] || [];
  };

  const addNewSavedItem = (type: 'topic' | 'sub1' | 'sub2' | 'sub3', value: string) => {
    if (!value.trim() || !videoStudyType) return;

    const key = getPathKey(type);
    const currentList = savedItemsCache[key] || [];
    const newList = Array.from(new Set([...currentList, value.trim()]));

    localStorage.setItem(key, JSON.stringify(newList));
    setSavedItemsCache(prev => ({ ...prev, [key]: newList }));

    // Salva de forma assíncrona
    savePathItems(key, newList).catch(err => {
      console.error("[Study] Erro ao salvar path items:", err);
    });

    // Define valor no form e reseta temp
    if (type === 'topic') { setVideoTopic(value); setTopicMode('select'); setTempTopic(''); }
    else if (type === 'sub1') { setVideoSub1(value); setSub1Mode('select'); setTempSub1(''); }
    else if (type === 'sub2') { setVideoSub2(value); setSub2Mode('select'); setTempSub2(''); }
    else if (type === 'sub3') { setVideoSub3(value); setSub3Mode('select'); setTempSub3(''); }
  };

  const resetAllFormFields = () => {
    // Book
    setBookName('');
    setBookType('didatico');
    setBookRelevance('Média');
    setEstimateDays(0);
    setTotalPages(0);
    setSelectedColor(colorPalette[0]);

    // PDF
    setPdfSubject('');
    setPdfType('didatico');
    setPdfPages(0);
    setPdfRelevance('Média');
    setPdfColor(colorPalette[0]);

    // Video
    setVideoSubject('');
    setVideoFinality('Entretenimento');
    setVideoSource('YouTube');
    setVDurationH(0);
    setVDurationM(0);
    setVCompletionH(0);
    setVCompletionM(0);
    setVideoRelevance('Média');
    setVideoColor(colorPalette[0]);
    setVideoOtherSource('');

    // Review
    setReviewSubject('');
    setReviewMethod(null);
    setReviewRepetitions(0);
    setRevDurationH(0);
    setRevDurationM(0);
    setReviewRelevance('Média');
    setReviewColor(colorPalette[0]);

    // Question
    setQuestionSubject('');
    setQuestionSource('YouTube');
    setQuestionOtherSource('');
    setQuestionQuantity(0);
    setQuestionQuantityLeft(0);
    setQDurationH(0);
    setQDurationM(0);
    setQuestionRelevance('Média');
    setQuestionColor(colorPalette[0]);

    // Simulado
    setSimOrigin('ENEM');
    setSimYear('');
    setSimType('');
    setSimArea('');
    setSimTestColorName('');
    setSimVestName('');
    setSimSubject('');
    setSimQty(0);
    setSimDurH(0);
    setSimDurM(0);
    setSimColor(DEFAULT_COLOR_PALETTE[0]);
    setDynamicPalette(DEFAULT_COLOR_PALETTE);
    setDetectedColorName(null);

    // Shared step 2 fields
    setSharedFormStep('metadata');
    setVideoStudyType(null);
    setVideoDiscipline('');
    setVideoArea('');
    setVideoMatter('');
    setVideoTopic('');
    setVideoSub1('');
    setVideoSub2('');
    setVideoSub3('');
    setTopicMode('');
    setSub1Mode('');
    setSub2Mode('');
    setSub3Mode('');
    setTempTopic('');
    setTempSub1('');
    setTempSub2('');
    setTempSub3('');
  };

  const handleAddBook = () => {
    if (!bookName.trim()) {
      setErrorMsg("Por favor, preencha o nome do livro primeiro.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    if ((estimateDays || 0) === 0) {
      setErrorMsg("O tempo estimado de término do livro deve ser maior que zero.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    if ((totalPages || 0) === 0) {
      setErrorMsg("A quantidade total de páginas do livro deve ser maior que zero.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    const newBook: Book = {
      id: Date.now().toString(),
      name: bookName,
      categoryId: 'Meus livros',
      type: bookType,
      relevance: bookRelevance || undefined,
      estimateDays: estimateDays || 0,
      totalPages: totalPages || 0,
      readPages: 0,
      color: selectedColor,
      dateAdded: new Date().toISOString()
    };
    saveBooks([newBook, ...books]);
    resetAllFormFields();
    setView('myBank');
  };

  const handleAddPdf = () => {
    if (!pdfSubject.trim()) {
      setErrorMsg("Por favor, preencha o assunto do PDF primeiro.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    if ((pdfPages || 0) === 0) {
      setErrorMsg("Por favor, informe a quantidade de páginas do PDF.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    const newPdf: Book = {
      id: Date.now().toString(),
      name: pdfSubject,
      categoryId: "Meus PDF's",
      type: pdfType,
      totalPages: pdfPages || 0,
      readPages: 0,
      color: pdfColor,
      relevance: pdfRelevance || 'Média',
      dateAdded: new Date().toISOString()
    };
    saveBooks([newPdf, ...books]);
    resetAllFormFields();
    setView('myBank');
  };

  // Função Universal de Salvamento para Vídeo, Revisão e Questão (Passo 2)
  const handleFinalizeStudyItem = (isFinishing: boolean = false) => {
    if (isFromActiveReview && !reviewSubject.trim()) {
      setErrorMsg("Por favor, preencha o assunto da revisão.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if (!videoStudyType) {
      setErrorMsg("Selecione para o que você vai estudar.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if (videoStudyType === 'ensino_medio') {
      const needsArea = videoDiscipline === 'Geografia' || videoDiscipline === 'História' || videoDiscipline === 'Português';
      if (!videoDiscipline) {
        setErrorMsg("Por favor, preencha a disciplina.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (needsArea && !videoArea) {
        setErrorMsg("Por favor, preencha a área.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!videoMatter) {
        setErrorMsg("Por favor, preencha a matéria.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!videoTopic) {
        setErrorMsg("Por favor, preencha o tópico.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!videoSub1) {
        setErrorMsg("Por favor, preencha o subtópico 1.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    } else {
      if (!videoMatter) {
        setErrorMsg("Por favor, preencha o nome da matéria.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!videoTopic) {
        setErrorMsg("Por favor, preencha o assunto (tópico).");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    }

    let finalName = "";
    let baseData: Partial<Book> = {};

    // Coleta dados específicos do Passo 1 com base na categoria
    if (selectedCategory?.label === 'Minhas vídeo aulas') {
      finalName = videoSubject;
      baseData = {
        name: finalName,
        type: 'Vídeo Aula',
        color: videoColor,
        relevance: videoRelevance,
        videoFinality,
        videoSource: videoSource === 'Outro' ? videoOtherSource : videoSource,
        videoDuration: `${vDurationH || 0}h ${vDurationM || 0}min`,
        videoCompletionTime: `${vCompletionH || 0}h ${vCompletionM || 0}min`,
      };
    } else if (selectedCategory?.label === 'Minhas revisões') {
      finalName = reviewSubject;
      baseData = {
        name: finalName,
        type: `Revisão ${reviewMethod || 'Ativa'}`,
        color: isFromActiveReview ? '#A855F7' : reviewColor,
        relevance: reviewRelevance,
        reviewMethod: reviewMethod || 'Ativa',
        reviewRepetitions: reviewRepetitions || 0,
        reviewDuration: `${revDurationH || 0}h ${revDurationM || 0}min`,
      };
    } else if (selectedCategory?.label === 'Minhas questões') {
      finalName = questionSubject;
      const finalQSrc = questionSource === 'Outra fonte' ? questionOtherSource : questionSource;
      baseData = {
        name: finalName,
        type: 'Questões',
        color: questionColor,
        relevance: questionRelevance,
        questionSource: finalQSrc,
        questionQuantity: questionQuantity || 0,
        questionDuration: `${qDurationH || 0}h ${qDurationM || 0}min`,
      };
    }

    const totalDurationMin = (vDurationH || 0) * 60 + (vDurationM || 0);
    const totalCompletionMin = (vCompletionH || 0) * 60 + (vCompletionM || 0);
    const watchedMinutes = Math.max(0, totalDurationMin - totalCompletionMin);

    const questionsTotal = questionQuantity || 0;
    const questionsDone = 0;

    const newItem: Book = {
      ...(baseData as Book),
      id: Date.now().toString(),
      categoryId: selectedCategory?.label || '',
      totalPages: selectedCategory?.label === 'Minhas vídeo aulas' ? (totalDurationMin || 1) : (selectedCategory?.label === 'Minhas questões' ? (questionsTotal || 1) : ((baseData as any).questionQuantity || 100)),
      readPages: selectedCategory?.label === 'Minhas vídeo aulas' ? watchedMinutes : (selectedCategory?.label === 'Minhas questões' ? questionsDone : 0),
      videoStudyType,
      videoDiscipline,
      videoArea,
      videoMatter,
      videoTopic,
      videoSub1,
      videoSub2,
      videoSub3,
      dateAdded: new Date().toISOString(),
      flashcardFront: isFromActiveReview ? flashcardFront : undefined,
      flashcardBack: isFromActiveReview ? flashcardBack : undefined,
      flashcardImages: isFromActiveReview ? flashcardImages : undefined
    };

    saveBooks([newItem, ...books]);

    if (isFromActiveReview && !isFinishing) {
      // Contar quantos flashcards já existem para este assunto (mesmo tópico)
      const savedBooks = [newItem, ...books];
      const flashcardCountForSubject = savedBooks.filter(
        b => b.flashcardFront !== undefined &&
          b.videoTopic === videoTopic &&
          b.videoSub1 === videoSub1 &&
          b.videoMatter === videoMatter
      ).length;

      // Salvar contexto antes de resetar os campos
      setPendingFlashcardContext({
        reviewSubject,
        videoStudyType,
        videoDiscipline,
        videoArea,
        videoMatter,
        videoTopic,
        videoSub1,
        videoSub2,
        videoSub3,
        flashcardCountForSubject,
      });
    }

    resetAllFormFields();

    if (isFromActiveReview) {
      if (isFinishing) {
        setFlashcardFront('');
        setFlashcardBack('');
        setFlashcardImages([]);
        setPendingFlashcardContext(null);
        setView('activeReview');
      } else {
        setShowAddMoreFlashcardsModal(true);
      }
    } else {
      setView('categoryDetail');
    }
  };

  const handleAddSimulado = () => {
    if (!simOrigin) {
      setErrorMsg("Origem do simulado: Por favor, selecione para o que você vai estudar.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if (simOrigin === 'ENEM') {
      if (!simYear) {
        setErrorMsg("Ano do simulado: Por favor, selecione o ano.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!simType) {
        setErrorMsg("Tipo de aplicação: Por favor, selecione o tipo de aplicação (Regular, PPL, etc).");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!simArea) {
        setErrorMsg("Área do simulado: Por favor, selecione a área do simulado.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!simTestColorName.trim()) {
        setErrorMsg("Cor da prova: Por favor, preencha a cor da prova.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    }

    if (simOrigin === 'Vestibulares') {
      if (!simYear) {
        setErrorMsg("Ano do simulado: Por favor, selecione o ano.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!simArea) {
        setErrorMsg("Área do simulado: Por favor, selecione a área do simulado.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!simVestName.trim()) {
        setErrorMsg("Nome do vestibular: Por favor, preencha o nome do vestibular.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    }

    if (simOrigin === 'Faculdade') {
      if (!simYear) {
        setErrorMsg("Ano do simulado: Por favor, selecione o ano.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
      if (!simSubject.trim()) {
        setErrorMsg("Assunto da prova: Por favor, preencha o assunto da prova.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    }

    if ((simQty || 0) === 0) {
      setErrorMsg("Quantidade de questões: Por favor, preencha a quantidade de questões.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    if ((simDurH || 0) === 0 && (simDurM || 0) === 0) {
      setErrorMsg("Duração do simulado: Por favor, preencha a duração estimada.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    let finalName = '';
    if (simOrigin === 'ENEM') finalName = `ENEM ${simYear} - ${simArea}`;
    else if (simOrigin === 'Vestibulares') finalName = simVestName;
    else finalName = simSubject;

    const newSim: Book = {
      id: Date.now().toString(),
      name: finalName,
      categoryId: 'Meus simulados',
      type: `Simulado ${simOrigin}`,
      totalPages: simQty || 1,
      readPages: 0,
      color: simColor,
      simuladoOrigin: simOrigin,
      simuladoYear: simYear,
      simuladoTestType: simType,
      simuladoArea: simArea,
      simuladoTestColorName: simTestColorName,
      questionQuantity: simQty || 0,
      questionDuration: `${simDurH || 0}h ${simDurM || 0}min`,
      dateAdded: new Date().toISOString()
    };

    saveBooks([newSim, ...books]);
    resetAllFormFields();
    setView('categoryDetail');
  };

  const confirmDelete = () => {
    if (bookToDelete) {
      saveBooks(books.filter(b => b.id !== bookToDelete.id));
      setBookToDelete(null);
    }
  };

  const BackButton = ({ onClick }: { onClick: () => void }) => {
    const isStandardBank = view === 'myBank' && (selectedCategory?.label === 'Minhas vídeo aulas' || selectedCategory?.label === 'Minhas revisões' || selectedCategory?.label === 'Minhas questões');
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border-black font-black transition-all shadow-sm active:scale-95 text-[13px] ${isDarkMode ? 'bg-black text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 hover:border-black'}`}
      >
        <span>←</span> {isStandardBank && !isFromActiveReview ? 'Voltar para menu' : 'Voltar'}
      </button>
    );
  };

  const categories: CategoryItem[] = [
    { label: 'Meus livros', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>, singular: 'livro' },
    { label: "Meus PDF's", icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4h11l5 5v13H4V4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 4v5h5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 14h10M7 18.5h10" /></svg>, singular: 'PDF' },
    { label: 'Minhas vídeo aulas', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>, singular: 'vídeo aula' },
    { label: 'Minhas revisões', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, singular: 'revisão' },
    { label: 'Minhas questões', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, singular: 'questão' },
    { label: 'Meus simulados', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.875c0 .621.504 1.125 1.125 1.125H18M9 12.75l1.5 1.5 3-3" /></svg>, singular: 'simulado' },
  ];

  const filteredBooks = selectedCategory
    ? books.filter(b => b.categoryId === selectedCategory.label)
    : [];

  const isLivros = selectedCategory?.label === 'Meus livros';
  const isPdfs = selectedCategory?.label === "Meus PDF's";
  const isVideoAulas = selectedCategory?.label === 'Minhas vídeo aulas';
  const isRevisoes = selectedCategory?.label === 'Minhas revisões';
  const isQuestoes = selectedCategory?.label === 'Minhas questões';
  const isSimulados = selectedCategory?.label === 'Meus simulados';

  // --- Utility for API Retry ---
  const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded') || error.status === 'UNAVAILABLE';
        const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit');

        if (i === maxRetries - 1 || (!isOverloaded && !isRateLimit)) {
          throw error;
        }

        // Exponential backoff
        const waitTime = 1000 * Math.pow(2, i);
        setErrorMsg(`Servidor ocupado. Tentando novamente em ${Math.round(waitTime / 1000)}s... (${i + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, waitTime));
        setErrorMsg(null);
      }
    }
  };

  // --- Vocabulary Logic ---
  const handleAddTerm = () => {
    if (!newTerm.term.trim() || !newTerm.meaning.trim()) {
      setErrorMsg("Por favor, preencha a palavra e o significado primeiro.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    const item: VocabularyItem = {
      id: Date.now().toString(),
      term: newTerm.term,
      meaning: newTerm.meaning,
      categoryId: activeVocabCategory?.id || 'geral',
      categoryName: activeVocabCategory?.name || 'Geral',
      color: activeVocabCategory?.color || colorPalette[0],
      lastModified: new Date().toLocaleString('pt-BR'),
      isReviewError: false
    };
    saveVocabulary([item, ...vocabulary]);
    setnewTerm({ term: '', meaning: '', color: colorPalette[0] });
    setVocabSubView('category_detail');
  };

  const toggleFlip = (id: string) => {
    setFlippedCards(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const startRevision = (mode: 'all' | 'category' | 'errors', catId: string | null = null) => {
    let queue: VocabularyItem[] = [];
    if (mode === 'all') {
      queue = [...vocabulary];
    } else if (mode === 'category' && catId) {
      queue = vocabulary.filter(v => v.categoryId === catId);
    } else if (mode === 'errors') {
      queue = vocabulary.filter(v => v.isReviewError === true);
    }

    if (queue.length === 0) {
      setErrorMsg("Nenhuma palavra disponível para este modo de revisão.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    setRevisionQueue(queue.sort(() => Math.random() - 0.5));
    setCurrentRevisionIndex(0);
    setRevisionScore(0);
    setIsRevisionCardFlipped(false);
    setIsTransitioning(false);
    setRevisionMode(mode);
    setSelectedRevisionCategory(catId);
    setView('vocabRevisionSession');
  };

  const handleRevisionAnswer = (correct: boolean) => {
    if (isTransitioning) return;

    const currentCard = revisionQueue[currentRevisionIndex];
    const updatedVocab = vocabulary.map(v =>
      v.id === currentCard.id ? { ...v, isReviewError: !correct } : v
    );
    saveVocabulary(updatedVocab);

    if (correct) {
      setRevisionScore(prev => prev + 1);
    }

    if (currentRevisionIndex < revisionQueue.length - 1) {
      setIsTransitioning(true);
      setIsRevisionCardFlipped(false);

      setTimeout(() => {
        setCurrentRevisionIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 350);
    } else {
      setView('vocabRevisionResult');
    }
  };

  const startActiveReviewSession = (items: Book[]) => {
    if (items.length === 0) return;
    setActiveReviewCards(items.sort(() => Math.random() - 0.5));
    setCurrentActiveReviewIndex(0);
    setActiveReviewScore(0);
    setIsActiveReviewCardFlipped(false);
    setIsTransitioning(false);
    setIsErrorReviewMode(false);
    setView('activeReviewSession');
  };

  const startErrorReviewSession = (items: Book[]) => {
    const errorCards = items.filter(card => flashcardErrorIds.has(card.id));
    if (errorCards.length === 0) {
      setErrorMsg("Parabéns! Você não possui erros registrados para este assunto.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setActiveReviewCards(errorCards.sort(() => Math.random() - 0.5));
    setCurrentActiveReviewIndex(0);
    setActiveReviewScore(0);
    setIsActiveReviewCardFlipped(false);
    setIsTransitioning(false);
    setIsErrorReviewMode(true);
    setView('activeReviewSession');
  };

  const startQuickAddFlashcard = (item: Book) => {
    // Preserve full context
    setReviewSubject(item.name || '');
    setVideoStudyType(item.videoStudyType as any || null);
    setVideoDiscipline(item.videoDiscipline || '');
    setVideoArea(item.videoArea || '');
    setVideoMatter(item.videoMatter || '');
    setVideoTopic(item.videoTopic || '');
    setVideoSub1(item.videoSub1 || '');
    setVideoSub2(item.videoSub2 || '');
    setVideoSub3(item.videoSub3 || '');

    // Set active review flags just in case
    setReviewMethod('Ativa');

    // Clear flashcard fields
    setFlashcardFront('');
    setFlashcardBack('');
    setFlashcardImages([]);

    setSharedFormStep('study_details');
    setView('addReviewFlashcardFront');
  };

  const handleActiveReviewAnswer = (correct: boolean) => {
    if (isTransitioning) return;
    if (correct) setActiveReviewScore(prev => prev + 1);

    const currentCard = activeReviewCards[currentActiveReviewIndex];
    if (isErrorReviewMode) {
      // In error mode: correct answer removes the card from errors permanently
      if (correct && currentCard) {
        const newSet = new Set(flashcardErrorIds);
        newSet.delete(currentCard.id);
        saveFlashcardErrorIds(newSet);
      }
    } else {
      // In normal mode: wrong answer adds the card to errors
      if (!correct && currentCard) {
        const newSet = new Set(flashcardErrorIds);
        newSet.add(currentCard.id);
        saveFlashcardErrorIds(newSet);
      } else if (correct && currentCard) {
        // If previously wrong but now correct in normal mode, keep it in errors
        // (only removed when explicitly doing error review mode)
      }
    }

    if (currentActiveReviewIndex < activeReviewCards.length - 1) {
      setIsTransitioning(true);
      setIsActiveReviewCardFlipped(false);
      setTimeout(() => {
        setCurrentActiveReviewIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 350);
    } else {
      setView('activeReviewResult');
    }
  };

  // --- Mnemonic AI Logic (Robust Implementation) ---
  const handleMnemonicFeedback = (id: string, liked: boolean) => {
    const updatedResults = mnemonicResults.map(m => {
      if (m.id === id) {
        const isCurrentlyLiked = m.liked === true;
        const isCurrentlyDisliked = m.liked === false;

        if (liked && isCurrentlyLiked) return { ...m, liked: null };
        if (!liked && isCurrentlyDisliked) return { ...m, liked: null };

        return { ...m, liked };
      }
      return m;
    });
    setMnemonicResults(updatedResults);

    const target = updatedResults.find(m => m.id === id);
    if (target && target.liked === true) {
      const newHistory = [target, ...likedMnemonicsHistory].slice(0, 10);
      setLikedMnemonicsHistory(newHistory);
      localStorage.setItem('produtivity_mnemonic_feedback_history', JSON.stringify(newHistory));
    } else {
      const newHistory = likedMnemonicsHistory.filter(h => h.text !== target?.text);
      setLikedMnemonicsHistory(newHistory);
      localStorage.setItem('produtivity_mnemonic_feedback_history', JSON.stringify(newHistory));
    }
  };

  const handleReplaceMnemonic = async (id: string) => {
    setReplacingMnemonicId(id);
    try {
      const { data, error } = await generateMnemonic('replace_mnemonic', { mnemonicInput });
      if (error) throw error;
      const parsed = JSON.parse(data.content);
      setMnemonicResults(prev => prev.map(m => m.id === id ? { ...parsed, id: Date.now().toString() } : m));
    } catch (e) {
      setErrorMsg("Erro ao trocar mnemônico.");
    } finally {
      setReplacingMnemonicId(null);
    }
  };

  const handleGenerateSimilar = async (parentMnemonic: MnemonicResult) => {
    setLoadingSimilarId(parentMnemonic.id);
    try {
      const { data, error } = await generateMnemonic('generate_similar', { mnemonicInput, parentText: parentMnemonic.text });
      if (error) throw error;

      let content = data.content;
      if (content.includes("```")) content = content.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed) ? parsed : [];
      const newItems = arr.map((item: any) => ({ ...item, id: Math.random().toString(36).substr(2, 9) }));

      setMnemonicResults(prev => prev.map(m =>
        m.id === parentMnemonic.id ? { ...m, similar: [...(m.similar || []), ...newItems] } : m
      ));
      setShowSimilarIds(prev => ({ ...prev, [parentMnemonic.id]: true }));
    } catch (e) {
      setErrorMsg("Erro ao gerar semelhantes.");
    } finally {
      setLoadingSimilarId(null);
    }
  };

  const handleGenerateMnemonic = async () => {
    const rawInput = mnemonicInput.trim();
    if (!rawInput) {
      setErrorMsg("Explique o que memorizar (ex: P.V=N.R.T ou 'família 1A use tema espacial')");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    setIsGeneratingMnemonic(true);
    setMnemonicResults([]);

    try {
      const favoritesContext = likedMnemonicsHistory.length > 0
        ? `\n\nREFERÊNCIA DE ESTILO (O usuário gosta de mnemônicos assim):\n${likedMnemonicsHistory.slice(0, 3).map(m => `- ${m.text}`).join('\n')}`
        : '';

      const { data, error } = await generateMnemonic('generate_mnemonic', { rawInput, favoritesContext });
      if (error) throw error;

      let resultText = data.content.trim();
      if (resultText.includes("```")) {
        resultText = resultText.replace(/```json|```/g, "").trim();
      }

      const parsed = JSON.parse(resultText);
      setMnemonicResults(parsed.map((item: any) => ({ ...item, id: Math.random().toString(36).substr(2, 9) })));
      setErrorMsg(null);
    } catch (error: any) {
      console.error("Mnemonic Engine Error:", error);
      setErrorMsg("O motor de memorização está temporariamente indisponível.");
    } finally {
      setIsGeneratingMnemonic(false);
    }
  };

  const renderMnemonicView = () => (
    <div className="animate-fadeIn max-w-5xl mx-auto py-10">
      <style>{`
        @keyframes loadingBar {
          0% { width: 0%; }
          100% { width: 100%; }
        }
        .loading-bar-anim {
          animation: loadingBar 2s linear infinite;
        }
      `}</style>
      <div className="flex justify-end items-center mb-12">
        <div className="flex flex-col items-end">
          <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Mestre Mnemônico</h2>
          <span className="text-[10px] font-black text-[#3B82F6] uppercase tracking-widest">Especialista em Memorização IA</span>
        </div>
      </div>

      <div className="bg-white border-[3px] border-black rounded-[3rem] p-10 shadow-2xl mb-16 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-50 rounded-full opacity-50 blur-3xl"></div>

        <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Explique o assunto e adicione comandos (ex: "use humor"):</label>
        <textarea
          value={mnemonicInput}
          onChange={(e) => setMnemonicInput(e.target.value)}
          placeholder="Ex: Fórmula P.V=N.R.T use tema de zumbis..."
          className="w-full p-8 border-[3px] border-slate-100 rounded-[2.5rem] font-bold text-2xl outline-none shadow-inner min-h-[220px] bg-slate-50 placeholder:text-slate-200 focus:border-black transition-all resize-none"
        />

        <button
          onClick={handleGenerateMnemonic}
          disabled={isGeneratingMnemonic}
          className={`w-full max-w-md mx-auto py-5 mt-8 rounded-2xl bg-black text-white font-black text-lg shadow-xl flex items-center justify-center gap-6 transition-all active:scale-95 ${isGeneratingMnemonic ? 'opacity-50 cursor-not-allowed' : 'hover:translate-y-[-4px] hover:shadow-2xl'}`}
        >
          {isGeneratingMnemonic ? (
            <>
              <div className="w-6 h-6 border-black border-white/20 border-t-white rounded-full animate-spin"></div>
              Sintonizando sua Memória...
            </>
          ) : (
            <>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Criar mnemônicos
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12 mb-16 items-start">
        {mnemonicResults.map((m, i) => (
          <div key={m.id} className="flex flex-col gap-4">
            <div className="animate-fadeIn p-8 rounded-[3rem] bg-white border-[3px] border-black shadow-[8px_8px_0_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[10px_10px_0_0_#000] transition-all flex flex-col relative overflow-hidden">
              {replacingMnemonicId === m.id && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
                  <div className="w-10 h-10 border-black border-black/10 border-t-black rounded-full animate-spin"></div>
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shrink-0 ${(m.type || '').includes('Frase') ? 'bg-orange-500' :
                  (m.type || '').includes('Acrônimo') ? 'bg-indigo-600' :
                    (m.type || '').includes('Visual') ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}>
                  {m.type || 'Mnemônico'}
                </span>

                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => handleMnemonicFeedback(m.id, true)}
                    title="Gostei"
                    className={`w-11 h-11 rounded-xl border-black flex items-center justify-center transition-all shrink-0 ${m.liked === true ? 'bg-green-500 border-green-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-green-500 hover:text-green-500'}`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 2 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01z" /></svg>
                  </button>
                  <button
                    onClick={() => handleMnemonicFeedback(m.id, false)}
                    title="Não gostei"
                    className={`w-11 h-11 rounded-xl border-black flex items-center justify-center transition-all shrink-0 ${m.liked === false ? 'bg-red-500 border-red-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-red-500 hover:text-red-500'}`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L10.83 22l5.59-5.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2H6c-.83 0-1.54.5-1.84 1.22L1.14 10.27c-.09.23-.14.47-.14.73v1.91l.01.01z" /></svg>
                  </button>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-2xl sm:text-3xl font-black text-slate-800 leading-tight mb-6 break-words">
                  "{m.text}"
                </h3>
                <div className="space-y-6">
                  <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-slate-500 font-bold text-sm leading-relaxed">
                      {m.explanation}
                    </p>
                  </div>
                  <div className="p-5 bg-[#FEF9C3] rounded-2xl border-black border-[#FEF08A] flex gap-3">
                    <span className="text-xl shrink-0">⚡</span>
                    <p className="text-xs font-black text-yellow-800 leading-tight uppercase tracking-tight">DICA DE FIXAÇÃO: <span className="font-medium normal-case block mt-1">{m.tip}</span></p>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t-2 border-slate-50 flex flex-col gap-3">
                <button
                  onClick={() => handleReplaceMnemonic(m.id)}
                  className="w-full py-4 bg-slate-50 border-black border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-black hover:border-black transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  Trocar
                </button>

                <div className="relative pt-2">
                  {loadingSimilarId === m.id && (
                    <div className="absolute -top-1 left-0 w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                      <div className="h-full bg-[#7EB1FF] loading-bar-anim" style={{ width: '30%' }}></div>
                    </div>
                  )}
                  <button
                    onClick={() => handleGenerateSimilar(m)}
                    disabled={!!loadingSimilarId}
                    className="w-full py-4 bg-white border-black border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:border-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>
                    Gerar Semelhantes
                  </button>
                </div>
              </div>
            </div>

            {/* Container para frases semelhantes aninhadas com animação */}
            <div
              className={`pl-8 flex flex-col gap-4 overflow-hidden transition-all duration-500 ease-in-out ${showSimilarIds[m.id] ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'}`}
            >
              {m.similar && m.similar.length > 0 && (
                <>
                  <div className="flex items-center justify-between px-4">
                    <div className="h-0.5 flex-1 bg-slate-100 rounded-full mr-4"></div>
                    <button
                      onClick={() => setShowSimilarIds(prev => ({ ...prev, [m.id]: false }))}
                      className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-black transition-colors"
                    >
                      Ocultar Semelhantes <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {m.similar.map((sim) => (
                      <div key={sim.id} className="p-6 rounded-[2rem] bg-white border-[3px] border-[#7EB1FF] shadow-sm animate-fadeIn">
                        <div className="flex justify-between items-start gap-4 mb-4">
                          <span className="text-[8px] font-black uppercase tracking-widest text-[#7EB1FF] px-3 py-1 bg-blue-50 rounded-full border border-blue-100">Semelhante</span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleMnemonicFeedback(sim.id, true)}
                              className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${sim.liked === true ? 'bg-green-500 border-green-500 text-white' : 'border-slate-100 text-slate-300'}`}
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 2 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01z" /></svg>
                            </button>
                          </div>
                        </div>
                        <h4 className="text-xl font-black text-slate-800 leading-tight mb-4">"{sim.text}"</h4>
                        <p className="text-slate-500 font-bold text-xs leading-relaxed">{sim.explanation}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Botão para mostrar semelhantes quando houver, mas estiver oculto */}
            {m.similar && m.similar.length > 0 && !showSimilarIds[m.id] && (
              <button
                onClick={() => setShowSimilarIds(prev => ({ ...prev, [m.id]: true }))}
                className="mt-2 flex items-center justify-center gap-2 text-[10px] font-black text-[#7EB1FF] uppercase tracking-widest hover:underline animate-fadeIn"
              >
                Ver Semelhantes ({m.similar.length}) <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-8 animate-fadeIn">
        {mnemonicResults.length > 0 && !isGeneratingMnemonic && (
          <button
            onClick={handleGenerateMnemonic}
            className="px-8 py-3 bg-white border-black border-black rounded-2xl font-black text-sm text-black hover:bg-black hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-4"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            Trocar tudo
          </button>
        )}
      </div>

      {mnemonicResults.length === 0 && !isGeneratingMnemonic && (
        <div className="col-span-full py-24 text-center opacity-10 flex flex-col items-center gap-8">
          <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          <p className="font-black text-2xl uppercase tracking-[0.3em]">Aguardando seu desafio mnemônico</p>
        </div>
      )}
    </div>
  );

  // --- Curiosity AI Logic ---
  const generateCuriosity = async (category: string) => {
    setCuriosityStep('loading');
    setCuriosityData(null);
    setShowCuriosityDetails(false);
    setIsImageLoaded(false);
    setIsGeneratingImage(true);

    try {
      let targetDiscipline = '';
      if (category === 'Natureza') {
        const rotStr = localStorage.getItem('produtivity_nature_rotation_idx') || '0';
        const rotationIdx = parseInt(rotStr);
        const disciplines = ['Biologia', 'Química', 'Física'];
        targetDiscipline = disciplines[rotationIdx];
        const nextIdx = (rotationIdx + 1) % disciplines.length;
        localStorage.setItem('produtivity_nature_rotation_idx', nextIdx.toString());
      } else if (category === 'Humanas') {
        const rotStr = localStorage.getItem('produtivity_human_rotation_idx') || '0';
        const rotationIdx = parseInt(rotStr);
        const disciplines = ['História', 'Geografia', 'Filosofia', 'Sociologia'];
        targetDiscipline = disciplines[rotationIdx];
        const nextIdx = (rotationIdx + 1) % disciplines.length;
        localStorage.setItem('produtivity_human_rotation_idx', nextIdx.toString());
      } else if (category === 'Matemática') {
        targetDiscipline = 'Matemática';
      } else if (category === 'Neurociência') {
        targetDiscipline = 'Neurociência';
      } else if (category === 'Medicina') {
        targetDiscipline = 'Medicina';
      } else {
        const relevantHistory = curiosityHistory.filter(h => h.category === category);
        targetDiscipline = relevantHistory.length > 0 ? relevantHistory[0].discipline || '' : '';
      }

      let promptIdea = `Gere uma ideia curiosa e visual que possa ser ilustrada em uma imagem. Responda apenas com a ideia, em até 10 palavras. A ideia deve ser visual, curiosa e estar relacionada a ciência, natureza, história ou fatos surpreendentes.`;
      
      if (targetDiscipline) {
        promptIdea += ` Foco principal: ${targetDiscipline}.`;
      } else {
        promptIdea += ` Foco principal: ${category}.`;
      }

      // 1. GERAR IDEIA VISUAL
      const { data: ideaData, error: ideaError } = await generateCuriosityText(promptIdea);
      if (ideaError || !ideaData?.content) throw ideaError || new Error("Falha ao gerar ideia");
      
      let ideaText = ideaData.content.replace(/["\n]/g, '').trim();

      // 2. GERAR IMAGEM
      const imagePromptGen = `Create a short visual prompt in english to generate a highly detailed, cinematic and realistic image based on this idea: "${ideaText}". Return only the english prompt.`;
      const { data: imgPromptData } = await generateCuriosityText(imagePromptGen);
      const imagePrompt = imgPromptData && imgPromptData.content ? imgPromptData.content.trim() : `realistic illustration of ${ideaText}, cinematic lighting`;

      let imageUrl = "";
      let attemptImage = 0;
      let successImage = false;

      while (attemptImage < 2 && !successImage) {
        try {
          const { data: imgData, error: imgError } = await generateCuriosityImage(imagePrompt);
          if (!imgError && imgData?.imageUrl) {
            imageUrl = imgData.imageUrl;
            successImage = true;
          } else {
            attemptImage++;
          }
        } catch (imgError) {
          attemptImage++;
        }
      }

      if (!successImage) {
        throw new Error("Falha ao gerar imagem após múltiplas tentativas.");
      }

      // 3. GERAR TEXTO DA CURIOSIDADE
      const promptText = `Explique de forma interessante e curta a curiosidade: "${ideaText}". O texto deve ter no máximo 3 frases.`;
      
      let curiosityTextContent = "";
      let attemptText = 0;
      let successText = false;

      while (attemptText < 2 && !successText) {
        try {
          const { data: textData, error: textError } = await generateCuriosityText(promptText);
          if (!textError && textData?.content) {
            curiosityTextContent = textData.content.trim();
            successText = true;
          } else {
            attemptText++;
          }
        } catch(e) {
          attemptText++;
        }
      }

      if (!successText) {
        throw new Error("Falha ao gerar o texto da curiosidade.");
      }

      // 4. MOSTRAR IMAGEM E TEXTO
      setCuriosityData({
        title: ideaText.charAt(0).toUpperCase() + ideaText.slice(1),
        text: curiosityTextContent,
        details: "",
        imageUrl: imageUrl,
        category: category,
        topic: "Curiosidade",
        discipline: targetDiscipline || category
      });
      setCuriosityStep('result');
      setErrorMsg(null);
    } catch (error) {
      console.error(error);
      setErrorMsg("O servidor acadêmico está congestionado. Tente novamente mais tarde.");
      setCuriosityStep('selection');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleCuriosityFeedback = (liked: boolean) => {
    if (!curiosityData) return;

    const newFeedback: CuriosityFeedback = {
      category: curiosityData.category,
      topic: curiosityData.topic,
      discipline: curiosityData.discipline,
      liked: liked
    };

    const newHistory = [newFeedback, ...curiosityHistory].slice(0, 50);
    setCuriosityHistory(newHistory);
    localStorage.setItem('produtivity_curiosity_history', JSON.stringify(newHistory));

    setCuriosityStep('selection');
  };

  const renderCuriosity = () => {
    if (curiosityStep === 'selection') {
      const categoriesIcons = [
        {
          label: 'Natureza',
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8a7 7 0 0 1-7 7c-1 0-1 0-3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 15.5V20" />
            </svg>
          )
        },
        {
          label: 'Humanas',
          icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        },
        {
          label: 'Matemática',
          icon: <div className="w-12 h-12 flex items-center justify-center font-black text-4xl italic">x²</div>
        },
        {
          label: 'Neurociência',
          icon: (
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.04z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.04z" />
            </svg>
          )
        },
        {
          label: 'Medicina',
          icon: <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24"><path d="M19 11h-6V5h-2v6H5v2h6v6h2v-6h6v-2z" /></svg>
        }
      ];

      return (
        <div className="animate-fadeIn max-4xl mx-auto py-10">
          <h2 className={`text-2xl sm:text-4xl font-black ${textColor} mb-2 uppercase tracking-tighter text-center`}>Curiosidades do Mundo</h2>
          <p className="text-slate-400 font-bold mb-12 text-center">Aprofunde seus conhecimentos em áreas acadêmicas específicas</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {categoriesIcons.map(cat => (
              <button
                key={cat.label}
                onClick={() => generateCuriosity(cat.label)}
                className="p-8 rounded-[2.5rem] bg-white border-[3px] border-black text-black hover:bg-[#7EB1FF] hover:border-[#7EB1FF] hover:text-white flex flex-col items-center justify-center gap-4 shadow-xl hover:scale-105 active:scale-95 transition-all group min-h-[180px]"
              >
                <div className="group-hover:rotate-12 transition-transform">
                  {cat.icon}
                </div>
                <span className="font-black text-sm uppercase tracking-widest">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (curiosityStep === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center py-32 animate-fadeIn">
          <div className="w-24 h-24 border-black border-slate-200 border-t-black rounded-full animate-spin mb-8"></div>
          <p className="text-xl font-black text-slate-800 animate-pulse uppercase tracking-widest text-center px-6">
            {isGeneratingImage ? "Ilustrando os conceitos científicos..." : "Consultando o dossiê acadêmico da vez..."}
          </p>
        </div>
      );
    }

    if (curiosityStep === 'result' && curiosityData) {
      return (
        <div className="animate-fadeIn max-5xl mx-auto py-8">
          <button
            onClick={() => setCuriosityStep('selection')}
            className="mb-8 flex items-center gap-2 text-slate-400 font-bold hover:text-black transition-colors"
          >
            ← Voltar para as áreas
          </button>

          <div className="bg-white border-[3px] border-black rounded-[4rem] overflow-hidden shadow-2xl">
            <div className="p-12 border-b-2 border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 mb-6">
                <span className="px-6 py-2 bg-black text-white text-[11px] font-black uppercase rounded-full tracking-[0.2em]">{curiosityData.discipline}</span>
                <span className="text-slate-400 font-black text-[11px] uppercase tracking-widest">• {curiosityData.topic}</span>
              </div>
              <h3 className="text-3xl sm:text-5xl font-black text-slate-800 leading-[1.1] uppercase tracking-tighter">{curiosityData.title}</h3>
            </div>

            <div className="p-12 flex flex-col items-center">
              {curiosityData.imageUrl && (
                <div className="w-full mb-12 group relative max-w-sm mx-auto">
                  {!isImageLoaded && (
                    <div className="w-full aspect-square bg-slate-200 animate-pulse rounded-[3.5rem] border-black border-black shadow-2xl flex items-center justify-center">
                      <div className="text-slate-400 font-bold uppercase tracking-widest text-sm flex flex-col items-center gap-3">
                        <svg className="w-8 h-8 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Carregando Mídia Visual...
                      </div>
                    </div>
                  )}
                  <img
                    src={curiosityData.imageUrl}
                    alt="Representação visual do tema"
                    onLoad={() => setIsImageLoaded(true)}
                    onError={() => {
                      console.error('Falha ao renderizar a imagem.');
                      setIsImageLoaded(true); // Força a exibição do texto mesmo sem imagem
                    }}
                    className={`w-full aspect-square object-cover rounded-[3.5rem] border-black border-black shadow-2xl ${isImageLoaded ? 'block' : 'hidden'}`}
                  />
                  {isImageLoaded && <div className="absolute inset-0 bg-black/5 rounded-[3.5rem] pointer-events-none"></div>}
                </div>
              )}
              {(!curiosityData.imageUrl || isImageLoaded) && (
                <div className="w-full space-y-10 max-w-4xl animate-fadeIn">
                  <div className="text-slate-700 text-2xl font-medium leading-[1.6] whitespace-pre-line border-l-8 border-black pl-8">
                    {curiosityData.text}
                  </div>

                {curiosityData.details && (
                  <div className="pt-6">
                    {!showCuriosityDetails ? (
                      <button
                        onClick={() => setShowCuriosityDetails(true)}
                        className="w-full flex items-center justify-center gap-4 text-[#3B82F6] font-black uppercase tracking-[0.2em] text-sm hover:scale-[1.01] bg-blue-50 px-10 py-8 rounded-[2.5rem] transition-all hover:bg-blue-100 border-black border-blue-200"
                      >
                        Aprofundar Conhecimento: Ver Dossiê Científico Extenso
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    ) : (
                      <div className="p-12 bg-blue-50/50 rounded-[4rem] border-black border-blue-100 animate-fadeIn shadow-inner">
                        <div className="flex justify-between items-center mb-10">
                          <div className="flex items-center gap-4">
                            <div className="w-3 h-10 bg-blue-500 rounded-full"></div>
                            <h4 className="text-blue-600 font-black text-sm uppercase tracking-[0.3em]">Relatório Acadêmico de Alta Complexidade</h4>
                          </div>
                          <button onClick={() => setShowCuriosityDetails(false)} className="text-slate-400 hover:text-black font-black text-xs uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">Fechar Dossiê</button>
                        </div>
                        <div className="text-slate-800 text-lg font-medium leading-[1.8] italic whitespace-pre-line text-justify px-4">
                          {curiosityData.details}
                        </div>
                        <div className="mt-12 flex justify-center">
                          <button onClick={() => setShowCuriosityDetails(false)} className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl uppercase text-xs tracking-widest hover:bg-blue-700 transition-all">Concluir Leitura Técnica</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>

            <div className="bg-slate-50 p-12 border-t-2 border-slate-100 flex flex-col items-center">
              <p className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] mb-8">O que achou deste fato científico de {curiosityData.discipline}?</p>
              <div className="flex gap-8">
                <button
                  onClick={() => handleCuriosityFeedback(false)}
                  className="w-16 h-16 rounded-2xl border-black border-slate-300 bg-white flex items-center justify-center text-slate-400 hover:border-red-500 hover:text-red-500 active:bg-red-500 active:border-red-500 active:text-white transition-all shadow-lg active:scale-95 group"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleCuriosityFeedback(true)}
                  className="w-16 h-16 rounded-2xl border-black border-slate-300 bg-white flex items-center justify-center text-slate-400 hover:border-green-500 hover:text-green-500 active:bg-green-500 active:border-green-500 active:text-white transition-all shadow-lg active:scale-95 group"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 10v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73V11c0-1.1-.9-2-2-2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  const renderVocabRevisionMenu = () => {
    if (revisionMode === 'category' && !selectedRevisionCategory) {
      return (
        <div className="animate-fadeIn max-w-2xl mx-auto flex flex-col items-center">
          <div className="flex items-center gap-2 mb-12 cursor-pointer group text-slate-400 font-bold hover:text-black transition-colors self-start" onClick={() => setRevisionMode('all')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            Voltar
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-12 uppercase tracking-tighter">Escolha uma categoria</h2>
          <div className="grid grid-cols-1 gap-4 w-full">
            {vocabCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => startRevision('category', cat.id)}
                style={{ backgroundColor: cat.color }}
                className="p-6 rounded-2xl text-white font-black text-xl shadow-lg hover:scale-105 transition-all uppercase tracking-tighter"
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="animate-fadeIn max-2xl mx-auto flex flex-col items-center">
        <div className="flex items-center gap-3 mb-12 cursor-pointer group text-slate-400 font-bold hover:text-black transition-colors self-start" onClick={() => { setVocabSubView('categories'); setView('vocabulary'); }}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
          Voltar
        </div>

        <div className="w-20 h-20 bg-[#6279A8]/10 text-[#6279A8] rounded-full flex items-center justify-center mb-8">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-16 text-center leading-tight uppercase tracking-tighter">Escolha como revisar seu vocabulário</h2>

        <div className="w-full space-y-6">
          {[
            {
              title: "Revisar todas as palavras",
              sub: "Pratique todo o seu vocabulário de uma vez",
              mode: 'all' as const,
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 v2M7 7h10" /></svg>
            },
            {
              title: "Revisar por categoria",
              sub: "Foque em um grupo específico de termos",
              mode: 'category' as const,
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
            },
            {
              title: "Revisar meus erros",
              sub: "Reforce as palavras que você ainda tem dificuldade",
              mode: 'errors' as const,
              icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            }
          ].map((opt, i) => (
            <button
              key={i}
              onClick={() => {
                if (opt.mode === 'all') startRevision('all');
                else if (opt.mode === 'category') {
                  setRevisionMode('category');
                  setSelectedRevisionCategory(null);
                }
                else startRevision('errors');
              }}
              className="w-full bg-white p-8 rounded-[2.5rem] border-[1.5px] border-slate-100 flex items-center gap-8 shadow-sm hover:bg-black hover:text-white transition-all text-left group"
            >
              <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-white/10 group-hover:text-white transition-all">
                {opt.icon}
              </div>
              <div className="flex flex-col">
                <h4 className="text-xl font-black text-slate-800 group-hover:text-white">{opt.title}</h4>
                <p className="text-slate-400 font-bold text-sm group-hover:text-white/60">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderVocabRevisionSession = () => {
    const currentCard = revisionQueue[currentRevisionIndex];
    if (!currentCard) return null;

    return (
      <div className="animate-fadeIn max-4xl mx-auto flex flex-col items-center py-10 h-full min-h-[500px]">
        <div className="flex justify-between w-full mb-12">
          <div className="flex items-center gap-2 cursor-pointer group text-slate-400 font-bold hover:text-black transition-colors" onClick={() => { setVocabSubView('categories'); setView('vocabRevisionMenu'); }}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            Sair da revisão
          </div>
          <div className="text-xl font-black text-slate-800">
            {currentRevisionIndex + 1} / {revisionQueue.length}
          </div>
        </div>

        <div className="h-96 w-full max-w-2xl perspective-1000 mb-12">
          <div
            onClick={() => !isTransitioning && setIsRevisionCardFlipped(!isRevisionCardFlipped)}
            className={`relative w-full h-full transition-all duration-700 transform-style-3d cursor-pointer ${isRevisionCardFlipped ? 'rotate-y-180' : ''}`}
          >
            <div
              className="absolute inset-0 backface-hidden rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 text-white border-black border-white/20"
              style={{
                backgroundColor: currentCard.color,
                zIndex: isRevisionCardFlipped ? 0 : 20,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-60">Qual o significado de:</span>
              <h3 className="text-3xl sm:text-5xl font-black text-center leading-tight mb-8">{currentCard.term}</h3>
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
            </div>

            <div
              className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 border-black"
              style={{
                borderColor: currentCard.color,
                zIndex: isRevisionCardFlipped ? 20 : 0,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
            >
              <p className="text-3xl sm:text-5xl font-black text-slate-800 text-center leading-relaxed max-h-[90%] overflow-y-auto custom-scrollbar uppercase tracking-tighter">
                {currentCard.meaning}
              </p>
            </div>
          </div>
        </div>

        {isRevisionCardFlipped && (
          <div className="flex gap-6 w-full max-w-xl animate-fadeIn">
            <button
              disabled={isTransitioning}
              onClick={() => handleRevisionAnswer(false)}
              className="flex-1 py-6 bg-red-500 text-white font-black text-xl rounded-3xl shadow-xl hover:bg-red-600 active:scale-95 transition-all shadow-red-500/20 uppercase tracking-tighter disabled:opacity-50"
            >
              Errei
            </button>
            <button
              disabled={isTransitioning}
              onClick={() => handleRevisionAnswer(true)}
              className="flex-1 py-6 bg-green-500 text-white font-black text-xl rounded-3xl shadow-xl hover:bg-green-600 active:scale-95 transition-all shadow-green-500/20 uppercase tracking-tighter disabled:opacity-50"
            >
              Acertei
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderVocabRevisionResult = () => {
    const total = revisionQueue.length;
    const correct = revisionScore;
    const errors = total - correct;
    const percentage = Math.round((correct / total) * 100);

    return (
      <div className="animate-fadeIn max-w-2xl mx-auto flex flex-col items-center text-center py-4">
        <div className="w-36 h-36 sm:w-44 sm:h-44 bg-slate-50 flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-black mb-6 shadow-xl overflow-hidden relative">
          <div className="absolute inset-x-0 bottom-0 bg-slate-200" style={{ height: `${percentage}%`, opacity: 0.5 }}></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5 z-10">Desempenho</span>
          <span className="text-3xl sm:text-4xl font-black text-slate-800 z-10">{percentage}%</span>
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-1 uppercase tracking-tighter">Resultado Final</h2>
        <p className="text-slate-400 font-bold text-base mb-8">Aqui está o seu desempenho nesta revisão!</p>

        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <div className="bg-slate-50 p-4 rounded-3xl border-2 border-black/5 flex flex-col items-center">
            <svg className="w-5 h-5 mb-1.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-black mb-0.5 opacity-60">Acertos</span>
            <span className="text-3xl font-black text-black">{correct}</span>
          </div>
          <div className="bg-slate-50 p-4 rounded-3xl border-2 border-black/5 flex flex-col items-center">
            <svg className="w-5 h-5 mb-1.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-black mb-0.5 opacity-60">Erros</span>
            <span className="text-3xl font-black text-black">{errors}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
          <button
            onClick={() => startRevision(revisionMode, selectedRevisionCategory)}
            className="py-4 bg-white text-black border-2 border-black/10 font-black rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-widest"
          >
            Revisar Novamente
          </button>
          <button
            onClick={() => {
              setRevisionMode('all');
              setSelectedRevisionCategory(null);
              setVocabSubView('categories');
              setView('vocabulary');
            }}
            className="py-4 bg-black text-white border-2 border-black font-black rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-widest"
          >
            Voltar ao Menu
          </button>
        </div>
      </div>
    );
  };

  const renderActiveReviewSession = () => {
    const currentCard = activeReviewCards[currentActiveReviewIndex];
    if (!currentCard) return null;

    return (
      <div className="animate-fadeIn max-4xl mx-auto flex flex-col items-center py-10 h-full min-h-[500px]">
        <div className="flex justify-between w-full mb-12">
          <div className="flex items-center gap-2 cursor-pointer group text-slate-400 font-bold hover:text-black transition-colors" onClick={() => setView('myBank')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            Sair da revisão
          </div>
          <div className="text-xl font-black text-slate-800">
            {currentActiveReviewIndex + 1} / {activeReviewCards.length}
          </div>
        </div>

        <div
          className="w-full perspective-1000 mb-12 mx-auto"
          style={{
            maxWidth: (() => {
              if (!isActiveReviewCardFlipped) return 672; // max-w-2xl
              const imgs = currentCard.flashcardImages || [];
              const contentW = imgs.length > 0 ? Math.max(...imgs.map(i => i.x + i.size)) + 96 : 672;
              return Math.max(672, contentW);
            })(),
            transition: 'max-width 700ms ease-in-out'
          }}
        >
          <div
            onClick={() => !isTransitioning && setIsActiveReviewCardFlipped(!isActiveReviewCardFlipped)}
            className={`relative w-full transition-all duration-700 transform-style-3d cursor-pointer ${isActiveReviewCardFlipped ? 'rotate-y-180' : ''}`}
            style={{
              minHeight: (() => {
                if (!isActiveReviewCardFlipped) return 384;
                const imgs = currentCard.flashcardImages || [];
                const contentH = imgs.length > 0 ? Math.max(...imgs.map(i => i.y + i.size)) + 96 : 384;
                return Math.max(384, contentH);
              })()
            }}
          >
            {/* FRENTE */}
            <div
              className="absolute inset-0 backface-hidden rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 text-white border-black border-white/20"
              style={{
                backgroundColor: '#A855F7',
                zIndex: isActiveReviewCardFlipped ? 0 : 20,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-60">Pergunta:</span>
              <h3 className="text-4xl font-black text-center leading-tight mb-8">{currentCard.flashcardFront}</h3>
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
            </div>

            {/* VERSO */}
            <div
              className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-[3rem] shadow-2xl p-12 border-[3px] overflow-hidden"
              style={{
                borderColor: '#A855F7',
                zIndex: isActiveReviewCardFlipped ? 20 : 0,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
            >
              {(() => {
                const imgs = currentCard.flashcardImages || [];
                const minH = imgs.length > 0
                  ? Math.max(...imgs.map(i => i.y + i.size)) + 20
                  : undefined;
                return (
                  <div className="relative w-full h-full" style={{ minHeight: minH }}>
                    <div
                      className="text-xl font-medium text-slate-800 text-left leading-relaxed prose prose-slate"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentCard.flashcardBack || '') }}
                    />
                    {imgs.map(img => (
                      <img
                        key={img.id}
                        src={img.src}
                        alt=""
                        style={{
                          position: 'absolute',
                          left: img.x,
                          top: img.y,
                          width: img.size,
                          borderRadius: 8,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        }}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {isActiveReviewCardFlipped && (
          <div className="flex gap-6 w-full max-w-xl animate-fadeIn">
            <button
              disabled={isTransitioning}
              onClick={() => handleActiveReviewAnswer(false)}
              className="flex-1 py-6 bg-red-500 text-white font-black text-xl rounded-3xl shadow-xl hover:bg-red-600 active:scale-95 transition-all shadow-red-500/20 uppercase tracking-tighter disabled:opacity-50"
            >
              Errei
            </button>
            <button
              disabled={isTransitioning}
              onClick={() => handleActiveReviewAnswer(true)}
              className="flex-1 py-6 bg-green-500 text-white font-black text-xl rounded-3xl shadow-xl hover:bg-green-600 active:scale-95 transition-all shadow-green-500/20 uppercase tracking-tighter disabled:opacity-50"
            >
              Acertei
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderActiveReviewResult = () => {
    const total = activeReviewCards.length;
    const correct = activeReviewScore;
    const errors = total - correct;
    const percentage = Math.round((correct / total) * 100);

    return (
      <div className="animate-fadeIn max-w-2xl mx-auto flex flex-col items-center text-center py-4">
        <div className="w-32 h-32 bg-[#A855F7]/10 flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-black mb-6 shadow-xl overflow-hidden relative">
          <div className="absolute inset-x-0 bottom-0 bg-[#A855F7]" style={{ height: `${percentage}%`, opacity: 0.15 }}></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#A855F7] mb-0.5 z-10">Desempenho</span>
          <span className="text-4xl font-black text-[#A855F7] z-10">{percentage}%</span>
        </div>

        <h2 className="text-3xl font-black text-slate-800 mb-1 uppercase tracking-tighter">Sessão Concluída</h2>
        <p className="text-slate-400 font-bold text-base mb-8">Aqui está o seu desempenho nesta revisão!</p>

        <div className="grid grid-cols-2 gap-4 w-full mb-8">
          <div className="bg-slate-50 p-4 rounded-3xl border-2 border-black/5 flex flex-col items-center">
            <svg className="w-5 h-5 mb-1.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-black mb-0.5 opacity-60">Acertos</span>
            <span className="text-3xl font-black text-black">{correct}</span>
          </div>
          <div className="bg-slate-50 p-4 rounded-3xl border-2 border-black/5 flex flex-col items-center">
            <svg className="w-5 h-5 mb-1.5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            <span className="text-[10px] font-black uppercase tracking-widest text-black mb-0.5 opacity-60">Erros</span>
            <span className="text-3xl font-black text-black">{errors}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
          <button
            onClick={() => startActiveReviewSession(activeReviewCards)}
            className="py-4 bg-white text-black border-2 border-black/10 font-black rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-widest"
          >
            Revisar Novamente
          </button>
          <button
            onClick={() => {
              setView('myBank');
              setActiveReviewCards([]);
              setActiveReviewScore(0);
              setCurrentActiveReviewIndex(0);
            }}
            className="py-4 bg-black text-white border-2 border-black font-black rounded-2xl transition-all active:scale-95 uppercase text-xs tracking-widest"
          >
            Voltar ao Menu
          </button>
        </div>
      </div>
    );
  };

  const renderVocabulary = () => {
    return (
      <div className="animate-fadeIn max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-2 cursor-pointer group text-slate-400 font-bold hover:text-black transition-colors" onClick={() => setView('menu')}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>
            Voltar
          </div>
          <button
            onClick={() => {
              setRevisionMode('all');
              setSelectedRevisionCategory(null);
              setVocabSubView('categories');
              setView('vocabRevisionMenu');
            }}
            className="py-4 px-10 rounded-full font-black text-sm bg-[#FEF9C3] text-black border-black border-[#FEF9C3] hover:scale-105 transition-all flex items-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Revisão
          </button>
        </div>

        <h2 className={`text-3xl sm:text-4xl font-black ${textColor} mb-8 sm:mb-10 tracking-tight uppercase`}>Meu Vocabulário</h2>

        {(vocabSubView === 'categories' || vocabSubView === 'create_category') && (
          <div className="flex flex-col gap-6 mb-8 sm:mb-10">
            <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-6">
              <button
                onClick={() => setVocabSubView('categories')}
                className={`w-full sm:w-auto py-4 sm:py-5 px-6 sm:px-12 rounded-2xl font-black text-sm transition-all border-black border-[#A855F7] ${vocabSubView === 'categories' ? 'bg-[#A855F7] text-white' : 'bg-white text-[#A855F7] hover:bg-[#A855F7]/5'}`}
              >
                Minhas Categorias
              </button>
              <button
                onClick={() => {
                  setEditingVocabCategory(null);
                  setNewVocabCatName('');
                  setVocabSubView('create_category');
                }}
                className={`w-full sm:w-auto py-4 sm:py-5 px-6 sm:px-12 rounded-2xl font-black text-sm transition-all border-black border-[#3B82F6] ${vocabSubView === 'create_category' ? 'bg-[#3B82F6] text-white' : 'bg-white text-[#3B82F6] hover:bg-[#3B82F6]/5'}`}
              >
                Criar Categoria
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl sm:rounded-[2.5rem] border-[1.5px] border-black p-5 sm:p-10 shadow-sm min-h-[450px] relative overflow-hidden">
          {vocabSubView === 'categories' && (
            <div className="animate-fadeIn grid grid-cols-1 gap-4">
              {vocabCategories.length === 0 ? (
                <div className="col-span-full h-44 border-black border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">nenhum arquivo salvo</div>
              ) : (
                vocabCategories.map(cat => {
                  return (
                    <div
                      key={cat.id}
                      onClick={() => {
                        setActiveVocabCategory(cat);
                        setVocabSubView('category_detail');
                      }}
                      style={{ backgroundColor: cat.color }}
                      className={`p-4 rounded-2xl text-white font-black text-xl shadow-md relative group overflow-hidden cursor-pointer hover:scale-[1.01] transition-all flex items-center justify-between border-black border-white/10`}
                    >
                      <div className="relative z-10 uppercase tracking-tighter px-2">
                        {cat.name}
                      </div>
                      <div className="absolute inset-0 bg-black/30 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-center justify-end px-4 gap-2 z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingVocabCategory(cat);
                            setNewVocabCatName(cat.name);
                            setSelectedVocabColor(cat.color);
                            setVocabSubView('create_category');
                          }}
                          className="p-2 bg-white/20 hover:bg-white/40 rounded-xl transition-all"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setVocabCategoryToDelete(cat);
                          }}
                          className="p-2 bg-white/20 hover:bg-red-500 rounded-xl transition-all"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {vocabSubView === 'create_category' && (
            <div className="animate-fadeIn max-xl mx-auto flex flex-col gap-8 pt-6">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">BOTAO NOVO</label>
                <input
                  type="text"
                  value={newVocabCatName}
                  onChange={(e) => setNewVocabCatName(e.target.value)}
                  placeholder="Ex: Filosofia"
                  className="w-full p-4 border-black border-black rounded-2xl font-bold outline-none shadow-sm placeholder:text-slate-200 bg-white text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">ESCOLHA UMA COR</label>
                <div className="flex flex-wrap gap-3">
                  {colorPalette.map(color => (
                    <button
                      key={color}
                      onClick={() => setSelectedVocabColor(color)}
                      style={{ backgroundColor: color }}
                      className={`w-10 h-10 rounded-xl border-black transition-all ${selectedVocabColor === color ? 'border-black scale-110 shadow-lg' : 'border-transparent'}`}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  if (!newVocabCatName.trim()) {
                    setErrorMsg("Por favor, preencha o nome da categoria primeiro.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if (editingVocabCategory) {
                    saveVocabCategories(vocabCategories.map(c => c.id === editingVocabCategory.id ? { ...c, name: newVocabCatName, color: selectedVocabColor } : c));
                    setEditingVocabCategory(null);
                  } else {
                    saveVocabCategories([...vocabCategories, { id: Date.now().toString(), name: newVocabCatName, color: selectedColor }]);
                  }
                  setNewVocabCatName('');
                  setVocabSubView('categories');
                }}
                className="w-full py-5 bg-black text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase"
              >
                {editingVocabCategory ? 'Salvar Alterações' : 'Criar Categoria'}
              </button>
            </div>
          )}

          {vocabSubView === 'category_detail' && activeVocabCategory && (
            <div className="animate-fadeIn flex flex-col h-full">
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-0 justify-between items-start sm:items-center mb-8 sm:mb-10 w-full overflow-hidden">
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => setVocabSubView('categories')} className="text-slate-400 hover:text-black transition-colors font-black text-sm shrink-0">‹ Voltar</button>
                  <h3 className="text-lg sm:text-xl font-black text-slate-800 uppercase tracking-tighter ml-2 truncate max-w-[200px] sm:max-w-none">{activeVocabCategory.name}</h3>
                </div>
                <button
                  onClick={() => setVocabSubView('add_word')}
                  className="w-full sm:w-auto py-3.5 px-6 sm:px-8 bg-black text-white rounded-xl font-black text-sm hover:scale-105 transition-all uppercase tracking-widest shrink-0"
                >
                  + Adicionar palavra
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                {vocabulary.filter(v => v.categoryId === activeVocabCategory.id).length === 0 ? (
                  <div className="col-span-full h-44 border-black border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold text-sm uppercase tracking-widest">nenhum arquivo salvo</div>
                ) : (
                  vocabulary.filter(v => v.categoryId === activeVocabCategory.id).map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleFlip(item.id)}
                      className="h-32 perspective-1000 cursor-pointer"
                    >
                      <div className={`relative w-full h-full transition-all duration-700 transform-style-3d ${flippedCards[item.id] ? 'rotate-y-180' : ''}`}>
                        <div
                          style={{
                            backgroundColor: activeVocabCategory.color,
                            zIndex: flippedCards[item.id] ? 0 : 10,
                            WebkitBackfaceVisibility: 'hidden',
                            backfaceVisibility: 'hidden'
                          }}
                          className="absolute inset-0 backface-hidden flex items-center justify-center p-4 rounded-3xl text-white font-black text-lg text-center shadow-md border-black border-white/10"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <span className="uppercase tracking-tighter">{item.term}</span>
                            <svg className="w-5 h-5 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </div>
                        </div>
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            borderColor: activeVocabCategory.color,
                            zIndex: flippedCards[item.id] ? 10 : 0,
                            WebkitBackfaceVisibility: 'hidden',
                            backfaceVisibility: 'hidden'
                          }}
                          className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center p-4 rounded-3xl text-slate-800 border-black text-center shadow-md overflow-y-auto"
                        >
                          <p className="text-lg font-black uppercase tracking-tighter px-2 leading-tight">
                            {item.meaning || '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {vocabSubView === 'add_word' && (
            <div className="animate-fadeIn max-xl mx-auto flex flex-col gap-8 pt-6">
              <header className="flex flex-col gap-2 sm:flex-row justify-between items-start sm:items-center mb-2">
                <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tighter uppercase line-clamp-2">Nova Palavra para {activeVocabCategory?.name}</h3>
                <button onClick={() => setVocabSubView('category_detail')} className="text-slate-400 font-bold text-xs uppercase hover:text-black self-end sm:self-auto">Cancelar</button>
              </header>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">PALAVRA</label>
                <input
                  type="text"
                  value={newTerm.term}
                  onChange={(e) => setnewTerm({ ...newTerm, term: e.target.value })}
                  placeholder="Ex: Ubíquo"
                  className="w-full p-4 border-black border-black rounded-2xl font-bold outline-none shadow-sm placeholder:text-slate-300 bg-white text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">SIGNIFICADO</label>
                <textarea
                  value={newTerm.meaning}
                  onChange={(e) => setnewTerm({ ...newTerm, meaning: e.target.value })}
                  placeholder="Que está ao mesmo tempo em toda parte..."
                  className="w-full p-4 border-black border-black rounded-2xl font-bold outline-none shadow-sm placeholder:text-slate-300 min-h-[120px] resize-none bg-white text-slate-800"
                />
              </div>
              <button onClick={handleAddTerm} className="w-full py-5 bg-black text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase">Salvar Palavra</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleStandardBankBack = () => {
    if (standardBankPath.length === 0) {
      setView('categoryDetail');
      return;
    }
    const backPath = [...standardBankPath];
    backPath.pop();
    setStandardBankPath(backPath);

    // Re-determina o step baseado no novo path
    if (standardBankMode === 'faculdade') {
      const flow: ("topics" | "sub1" | "sub2" | "sub3" | "content")[] = ['topics', 'sub1', 'sub2', 'sub3', 'content'];
      setStandardBankStep(flow[backPath.length] || 'topics');
    } else if (standardBankMode === 'simulados') {
      // If we're going back to the origin selection screen (before any selection)
      if (backPath.length === 0) {
        // Going back to the 3 big buttons screen
        setStandardBankPath([]);
        setStandardBankStep('sim_origins');
        return;
      }
      const origin = backPath.find(p => p.type === 'simuladoOrigin')?.value || '';
      // Determine correct step for backPath length
      if (backPath.length === 1) {
        setStandardBankStep('sim_years'); // has origin, so next is years
      } else if (backPath.length === 2) {
        if (origin === 'ENEM') setStandardBankStep('sim_types');
        else if (origin === 'Vestibulares') setStandardBankStep('sim_areas');
        else setStandardBankStep('content');
      } else if (backPath.length === 3) {
        if (origin === 'ENEM') setStandardBankStep('sim_areas');
        else setStandardBankStep('content');
      } else {
        setStandardBankStep('content');
      }
      return;
    } else {
      if (backPath.length === 0) {
        setStandardBankStep('disciplines');
      } else {
        const disc = backPath.find(p => p.type === 'discipline')?.value || '';
        const hasArea = ['Geografia', 'História', 'Português'].includes(disc);
        const hasAreaInPath = backPath.some(p => p.type === 'area');

        if (backPath.length === 1) {
          // Após escolher a disciplina
          setStandardBankStep(hasArea ? 'areas' : 'matters');
        } else if (backPath.length === 2) {
          // Após escolher Área (se tiver) OU Matéria (se não tiver área)
          setStandardBankStep(hasArea && !hasAreaInPath ? 'areas' : (hasArea && hasAreaInPath ? 'matters' : 'topics'));
        } else {
          // Lógica genérica para os passos seguintes
          const offset = hasArea ? 1 : 0;
          const flow: any[] = ['disciplines', hasArea ? 'areas' : '', 'matters', 'topics', 'sub1', 'sub2', 'sub3', 'content'].filter(Boolean);
          setStandardBankStep(flow[backPath.length] || 'topics');
        }
      }
    }
  };

  // Filtro Universal para o Banco (Vídeo, Revisão, Questão) baseado na categoria selecionada
  const filteredItemsByPath = useMemo(() => {
    let list = books.filter(b => b.categoryId === selectedCategory?.label);

    if (standardBankMode === 'simulados') {
      standardBankPath.forEach(p => {
        if (p.type === 'simuladoOrigin') list = list.filter(b => b.simuladoOrigin === p.value);
        if (p.type === 'simuladoYear') list = list.filter(b => String(b.simuladoYear) === String(p.value));
        if (p.type === 'simuladoTestType') list = list.filter(b => b.simuladoTestType === p.value);
        if (p.type === 'simuladoArea') list = list.filter(b => b.simuladoArea === p.value);
      });
    } else {
      list = list.filter(b => b.videoStudyType === standardBankMode);
      standardBankPath.forEach(p => {
        if (p.type === 'discipline') list = list.filter(b => b.videoDiscipline === p.value);
        if (p.type === 'area') list = list.filter(b => b.videoArea === p.value);
        if (p.type === 'matter') list = list.filter(b => b.videoMatter === p.value);
        if (p.type === 'topic') list = list.filter(b => b.videoTopic === p.value);
        if (p.type === 'sub1') list = list.filter(b => b.videoSub1 === p.value);
        if (p.type === 'sub2') list = list.filter(b => b.videoSub2 === p.value);
        if (p.type === 'sub3') list = list.filter(b => b.videoSub3 === p.value);
      });
    }

    return list;
  }, [books, standardBankPath, standardBankMode, selectedCategory]);

  const renderStandardizedBank = () => {
    const breadcrumbs = [];
    if (standardBankMode === 'ensino_medio') {
      breadcrumbs.push({ label: 'Disciplinas', step: 'disciplines' });
      const disc = standardBankPath.find(p => p.type === 'discipline')?.value || '';
      const hasArea = ['Geografia', 'História', 'Português'].includes(disc);

      if (standardBankPath.length > 0) {
        if (hasArea) {
          breadcrumbs.push({ label: 'Áreas', step: 'areas' });
          if (standardBankPath.length > 1) breadcrumbs.push({ label: 'Matérias', step: 'matters' });
          if (standardBankPath.length > 2) breadcrumbs.push({ label: 'Tópicos', step: 'topics' });
          if (standardBankPath.length > 3) breadcrumbs.push({ label: 'Subtópico 1', step: 'sub1' });
          if (standardBankPath.length > 4) breadcrumbs.push({ label: 'Subtópico 2', step: 'sub2' });
          if (standardBankPath.length > 5) breadcrumbs.push({ label: 'Subtópico 3', step: 'sub3' });
        } else {
          breadcrumbs.push({ label: 'Matérias', step: 'matters' });
          if (standardBankPath.length > 1) breadcrumbs.push({ label: 'Tópicos', step: 'topics' });
          if (standardBankPath.length > 2) breadcrumbs.push({ label: 'Subtópico 1', step: 'sub1' });
          if (standardBankPath.length > 3) breadcrumbs.push({ label: 'Subtópico 2', step: 'sub2' });
          if (standardBankPath.length > 4) breadcrumbs.push({ label: 'Subtópico 3', step: 'sub3' });
        }
      }
    } else if (standardBankMode === 'simulados') {
      const origin = standardBankPath.find(p => p.type === 'simuladoOrigin')?.value || '';
      // Years come after origin is chosen (path.length >= 1)
      if (standardBankPath.length >= 1) breadcrumbs.push({ label: 'Ano', step: 'sim_years' });
      if (origin === 'ENEM') {
        if (standardBankPath.length >= 2) breadcrumbs.push({ label: 'Tipo', step: 'sim_types' });
        if (standardBankPath.length >= 3) breadcrumbs.push({ label: 'Área', step: 'sim_areas' });
      } else if (origin === 'Vestibulares') {
        if (standardBankPath.length >= 2) breadcrumbs.push({ label: 'Área', step: 'sim_areas' });
      }
    } else {
      breadcrumbs.push({ label: 'Tópicos', step: 'topics' });
      if (standardBankPath.length > 0) breadcrumbs.push({ label: 'Subtópico 1', step: 'sub1' });
      if (standardBankPath.length > 1) breadcrumbs.push({ label: 'Subtópico 2', step: 'sub2' });
      if (standardBankPath.length > 2) breadcrumbs.push({ label: 'Subtópico 3', step: 'sub3' });
    }

    let contentItems: string[] = [];
    if (standardBankStep === 'disciplines') {
      contentItems = disciplinesList;
    } else if (standardBankStep === 'areas') {
      const disc = standardBankPath.find(p => p.type === 'discipline')?.value || '';
      if (disc === 'Geografia') contentItems = ['Geografia física', 'Geografia humana'];
      else if (disc === 'História') contentItems = ['História geral', 'História do Brasil'];
      else if (disc === 'Português') contentItems = ['Gramática', 'Interpretação de texto'];
    } else if (standardBankStep === 'matters') {
      const disc = standardBankPath.find(p => p.type === 'discipline')?.value || '';
      const area = standardBankPath.find(p => p.type === 'area')?.value || '';

      if (['Geografia', 'História', 'Português'].includes(disc) && area) {
        contentItems = areaMatters[area] || [];
      } else {
        contentItems = disciplineMatters[disc] || [];
      }
    } else if (standardBankStep === 'topics') {
      contentItems = Array.from(new Set(filteredItemsByPath.map(v => v.videoTopic).filter(Boolean))) as string[];
    } else if (standardBankStep === 'sub1') {
      contentItems = Array.from(new Set(filteredItemsByPath.map(v => v.videoSub1).filter(Boolean))) as string[];
    } else if (standardBankStep === 'sub2') {
      contentItems = Array.from(new Set(filteredItemsByPath.map(v => v.videoSub2).filter(Boolean))) as string[];
    } else if (standardBankStep === 'sub3') {
      contentItems = Array.from(new Set(filteredItemsByPath.map(v => v.videoSub3).filter(Boolean))) as string[];
    } else if (standardBankStep === 'sim_origins') {
      contentItems = ['ENEM', 'Vestibulares', 'Faculdade'];
    } else if (standardBankStep === 'sim_years') {
      contentItems = Array.from({ length: 2026 - 2009 + 1 }, (_, i) => String(2026 - i));
    } else if (standardBankStep === 'sim_types') {
      contentItems = ['Aplicação regular', 'PPL', 'Libras'];
    } else if (standardBankStep === 'sim_areas') {
      const origin = standardBankPath.find(p => p.type === 'simuladoOrigin')?.value || '';
      if (origin === 'ENEM') {
        contentItems = ['Natureza', 'Linguagem', 'Humanas', 'Exatas', 'Todo o primeiro dia', 'Todo o segundo dia'];
      } else if (origin === 'Vestibulares') {
        contentItems = ['Natureza', 'Linguagem', 'Humanas', 'Exatas'];
      }
    }

    if (standardBankStep !== 'disciplines' && standardBankStep !== 'sim_origins' && standardBankStep !== 'sim_years' && standardBankStep !== 'sim_types' && standardBankStep !== 'sim_areas' && standardBankStep !== 'content' && contentItems.length === 0 && filteredItemsByPath.length > 0) {
      setStandardBankStep('content');
      return null;
    }

    return (
      <div className="w-full max-w-5xl mx-auto pt-6 animate-fadeIn">
        {/* Breadcrumbs row with inline internal back chevron */}
        <div className="flex items-center gap-3 mb-16">
          {/* Back chevron for navigating between bank levels — placeholder keeps layout stable */}
          {((standardBankMode === 'ensino_medio' && standardBankStep !== 'disciplines') || (standardBankMode === 'simulados' && standardBankStep !== 'sim_origins') || (standardBankMode === 'faculdade' && standardBankPath.length > 0)) ? (
            <button
              onClick={handleStandardBankBack}
              className="w-10 h-10 rounded-xl border-black border-black flex items-center justify-center font-black bg-black text-white hover:bg-slate-900 transition-all shadow-sm active:scale-95 shrink-0"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          ) : <div className="w-10 h-10 shrink-0" />}

          <div className="flex flex-wrap gap-2 md:gap-3">
            {breadcrumbs.map((b, i) => (
              <div key={i} className="px-3 py-1.5 text-[10px] bg-slate-200 text-slate-600 rounded-xl border-black border-slate-200 shadow-sm font-black uppercase tracking-widest whitespace-nowrap transition-all">
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {standardBankStep !== 'content' ? (
          <div key={standardBankStep} className="animate-fadeIn">
            {contentItems.length === 0 && standardBankStep !== 'disciplines' && standardBankStep !== 'sim_origins' ? (
              <div className="w-full h-44 border-black border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">nenhum arquivo salvo</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {contentItems.map((item, idx) => (
                  <button
                    key={item}
                    onClick={() => {
                      const typeMap: Record<string, string> = {
                        'disciplines': 'discipline', 'areas': 'area', 'matters': 'matter', 'topics': 'topic', 'sub1': 'sub1', 'sub2': 'sub2', 'sub3': 'sub3',
                        'sim_origins': 'simuladoOrigin', 'sim_years': 'simuladoYear', 'sim_types': 'simuladoTestType', 'sim_areas': 'simuladoArea'
                      };

                      let nextStep: any = 'content';
                      if (standardBankMode === 'faculdade') {
                        const flow: any[] = ['topics', 'sub1', 'sub2', 'sub3', 'content'];
                        nextStep = flow[flow.indexOf(standardBankStep) + 1] || 'content';
                      } else if (standardBankMode === 'simulados') {
                        if (standardBankStep === 'sim_origins') {
                          nextStep = 'sim_years';
                        } else if (standardBankStep === 'sim_years') {
                          const origin = standardBankPath.find(p => p.type === 'simuladoOrigin')?.value || '';
                          if (origin === 'ENEM') nextStep = 'sim_types';
                          else if (origin === 'Vestibulares') nextStep = 'sim_areas';
                          else nextStep = 'content';
                        } else if (standardBankStep === 'sim_types') {
                          nextStep = 'sim_areas';
                        } else if (standardBankStep === 'sim_areas') {
                          nextStep = 'content';
                        }
                      } else {
                        if (standardBankStep === 'disciplines') {
                          nextStep = ['Geografia', 'História', 'Português'].includes(item) ? 'areas' : 'matters';
                        } else if (standardBankStep === 'areas') {
                          nextStep = 'matters';
                        } else if (standardBankStep === 'matters') {
                          nextStep = 'topics';
                        } else if (standardBankStep === 'topics') {
                          nextStep = 'sub1';
                        } else if (standardBankStep === 'sub1') {
                          nextStep = 'sub2';
                        } else if (standardBankStep === 'sub2') {
                          nextStep = 'sub3';
                        }
                      }

                      setStandardBankPath([...standardBankPath, { label: item, type: typeMap[standardBankStep], value: item }]);
                      setStandardBankStep(nextStep);
                    }}
                    className={`bg-white border-black border-black rounded-2xl h-20 flex items-center justify-center px-3 font-black ${item.length > 20 ? 'text-xs' : item.length > 12 ? 'text-sm' : 'text-base'} text-slate-800 hover:bg-[#7EB1FF] hover:text-white hover:border-transparent transition-all shadow-md active:scale-95 text-center leading-tight`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (() => {
          // Quando acessado por "Revisão ativa", só exibe itens que têm flashcard.
          // Itens salvos em "Minhas revisões" pelo Banco de Conhecimento (sem flashcard) não aparecem aqui.
          const effectiveItems = isFromActiveReview
            ? filteredItemsByPath.filter(item => item.flashcardFront)
            : filteredItemsByPath;

          // Lógica de agrupamento para Revisão Ativa — só agrupa quando o acesso é pelo botão
          // "Revisão ativa" da tela inicial. Quando é pelo Banco de Conhecimento (Minhas revisões),
          // todos os itens aparecem como cartões individuais de progresso, igual a Vídeo aulas e Questões.
          const groupedBySubject: Record<string, Book[]> = {};
          if (isFromActiveReview) {
            effectiveItems.forEach(item => {
              if (item.reviewMethod === 'Ativa') {
                const key = `${item.name}-${item.videoDiscipline}-${item.videoMatter}-${item.videoTopic}`;
                if (!groupedBySubject[key]) groupedBySubject[key] = [];
                groupedBySubject[key].push(item);
              }
            });
          }

          // Itens que aparecem como cartões individuais
          const nonActiveItems = isFromActiveReview
            ? effectiveItems.filter(item => item.reviewMethod !== 'Ativa')
            : effectiveItems; // No Banco de Conhecimento, todos os itens são individuais
          const activeSubjectKeys = Object.keys(groupedBySubject);

          return (
            <div className={`grid ${isFromActiveReview ? 'gap-4' : 'gap-6'} animate-fadeIn`}>
              {effectiveItems.length === 0 ? (
                <div className="w-full h-44 border-black border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">nenhum arquivo salvo</div>
              ) : (
                <>
                  {/* Renderizar Agrupamentos de Revisão Ativa (Cartões Roxos) */}
                  {activeSubjectKeys.map(key => {
                    const cards = groupedBySubject[key];
                    const first = cards[0];
                    return (
                      <div
                        key={key}
                        onClick={() => startActiveReviewSession(cards)}
                        className={`group ${isFromActiveReview ? 'p-4 gap-3 rounded-[2rem]' : 'p-8 gap-6 rounded-[2.5rem]'} flex items-center text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-all relative border-[3px] border-white/20 bg-[#A855F7]`}
                      >
                        <div className={`${isFromActiveReview ? 'w-12 h-12' : 'w-16 h-16'} bg-white/20 rounded-xl flex items-center justify-center shrink-0 border border-white/10`}>
                          <svg className={`${isFromActiveReview ? 'w-6 h-6' : 'w-8 h-8'} text-white`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                        <div className="flex-1 flex flex-col">
                          <h3 className={`${isFromActiveReview ? 'text-xl' : 'text-3xl'} font-black tracking-tight text-white`}>{first.name}</h3>
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">{cards.length} flashcards salvos</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-2">
                          {/* Error Review Button — shown in Active Review flow */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startErrorReviewSession(cards);
                            }}
                            className="bg-white/20 hover:bg-white/40 p-2 rounded-xl border border-white/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all active:scale-95 relative"
                            title={`Revisar erros (${cards.filter(c => flashcardErrorIds.has(c.id)).length})`}
                          >
                            {/* Semicircle with arrow — retry icon */}
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 4v6h6" />
                              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                            </svg>
                            {/* Error count badge — only shown if > 0 */}
                            {cards.filter(c => flashcardErrorIds.has(c.id)).length > 0 && (
                              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-400 text-white text-[9px] font-black rounded-full flex items-center justify-center leading-none">
                                {cards.filter(c => flashcardErrorIds.has(c.id)).length}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startQuickAddFlashcard(first);
                            }}
                            className="bg-white/20 hover:bg-white/40 p-2 rounded-xl border border-white/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all active:scale-95"
                            title="Adicionar mais flashcards"
                          >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setManageSelectedCards(cards);
                              setShowActiveReviewManageModal(true);
                            }}
                            className="bg-white/20 hover:bg-white/40 p-2 rounded-xl border border-white/10 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all active:scale-95"
                            title="Gerenciar flashcards"
                          >
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                          <div className="text-white/80 group-hover:translate-x-1 transition-transform">
                            <svg className={`${isFromActiveReview ? 'w-6 h-6' : 'w-8 h-8'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Renderizar Itens Individuais (Não Ativos) */}
                  {nonActiveItems.map(item => {
                    const isMinhasRevisoes = item.categoryId === 'Minhas revisões';
                    const targetTotal = isMinhasRevisoes && item.reviewRepetitions
                      ? item.reviewRepetitions
                      : ((item.categoryId === 'Minhas questões' || item.categoryId === 'Meus simulados')
                        ? item.questionQuantity || item.totalPages || 1
                        : item.totalPages || 1);
                    const percent = Math.min(100, Math.round((item.readPages / targetTotal) * 100));
                    const cardBgColor = item.color || (item.relevance ? relevanceColorMap[item.relevance] : '#f59e0b');
                    const isSelected = selectedStudyItemIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          if (isFromStudyMaterialSelect) {
                            setSelectedStudyItemIds(prev => prev.includes(item.id) ? [] : [item.id]);
                          } else {
                            onOpenDetail?.(item);
                          }
                        }}
                        className={`group ${isFromActiveReview ? 'p-3 gap-3 rounded-[2rem]' : 'p-4 gap-4 rounded-[1.5rem]'} flex items-center text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative border-[3px] ${isFromStudyMaterialSelect && isSelected ? 'border-green-400 ring-2 ring-green-400/50' : 'border-transparent'}`}
                        style={{ backgroundColor: cardBgColor }}
                      >
                        {/* Checkbox - only in study flow */}
                        {isFromStudyMaterialSelect && (
                          <div className={`absolute top-4 left-4 w-6 h-6 rounded-md flex items-center justify-center border-black transition-all duration-200 z-10 shadow-sm ${isSelected ? 'bg-green-500 border-green-500' : 'bg-white/20 border-white/60'}`}>
                            {isSelected && (
                              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        )}
                        {/* Delete and Error Retry buttons - hidden in study flow */}
                        {!isFromStudyMaterialSelect && (
                          <div className="absolute -top-3 -right-3 flex items-center gap-1.5 z-20">
                            {/* Error Retry button for individual flashcards */}
                            {isFromActiveReview && item.flashcardFront && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startErrorReviewSession([item]);
                                }}
                                className="w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-white/40 hover:scale-110 active:scale-95 border border-white/10 relative"
                                title="Revisar erros"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 4v6h6" />
                                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                                </svg>
                                {flashcardErrorIds.has(item.id) && (
                                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-white text-orange-600 text-[8px] font-black rounded-full flex items-center justify-center leading-none">1</span>
                                )}
                              </button>
                            )}
                            {isFromActiveReview && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startQuickAddFlashcard(item);
                                }}
                                className="w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-white/40 hover:scale-110 active:scale-95 border border-white/10"
                                title="Adicionar flashcard"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBookToDelete(item);
                              }}
                              className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 border-black border-white"
                              title="Excluir"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}

                        <div className={`w-11 h-11 bg-white/30 rounded-xl flex items-center justify-center shrink-0 border border-white/20 ${isFromStudyMaterialSelect ? 'ml-10' : ''}`}>
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {item.categoryId === 'Minhas vídeo aulas' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />}
                            {item.categoryId === 'Minhas revisões' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />}
                            {item.categoryId === 'Minhas questões' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                            {item.categoryId === 'Meus simulados' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.875c0 .621.504 1.125 1.125 1.125H18M9 12.75l1.5 1.5 3-3" />}
                          </svg>
                        </div>
                        <div className="flex-1 flex flex-col">
                          {['Minhas vídeo aulas', 'Minhas revisões', 'Minhas questões'].includes(item.categoryId) && item.videoStudyType === 'faculdade' ? (
                            <>
                              <h3 className={`text-base font-black text-left tracking-tight leading-snug mb-0`}>{item.videoMatter || item.name}</h3>
                              <span className={`text-[10px] sm:text-xs font-bold text-white/80 uppercase tracking-wider mb-2`}>{item.name}</span>
                            </>
                          ) : (
                            <h3 className={`text-base font-black text-left tracking-tight leading-snug ${isFromStudyMaterialSelect ? 'mb-0' : 'mb-2'}`}>{item.name}</h3>
                          )}
                          {!isFromStudyMaterialSelect && (() => {
                            const isSimulado = item.categoryId === 'Meus simulados';

                            // Parse total duration from "Xh Ymin" string
                            const totalDurMatch = (item.questionDuration || '').match(/(\d+)h\s*(\d+)min/);
                            const totalDurMins = totalDurMatch
                              ? parseInt(totalDurMatch[1]) * 60 + parseInt(totalDurMatch[2])
                              : 0;
                            const doneMinutes = item.simuladoDurationMins || 0;
                            const hourPercent = totalDurMins > 0 ? Math.min(100, Math.round((doneMinutes / totalDurMins) * 100)) : 0;
                            const doneH = Math.floor(doneMinutes / 60);
                            const doneM = doneMinutes % 60;
                            const totalH = Math.floor(totalDurMins / 60);
                            const totalM = totalDurMins % 60;

                            return (
                              <div className="w-full bg-black/30 rounded-xl p-2.5 flex flex-col gap-2">
                                {/* Bar 1 — Questions */}
                                <div className="flex flex-col gap-1">
                                  <div className="flex justify-between items-center px-1">
                                    <span className="text-xs font-black text-white">
                                      {item.categoryId === 'Minhas vídeo aulas'
                                        ? `${Math.floor(item.readPages / 60)}h ${item.readPages % 60}min assistidas`
                                        : item.categoryId === 'Minhas questões'
                                          ? `${item.readPages} questões feitas`
                                          : isSimulado
                                            ? `${item.readPages} questões feitas`
                                            : item.categoryId === 'Minhas revisões'
                                              ? `${item.readPages} revisões feitas`
                                              : 'Progresso'
                                      }
                                    </span>
                                    <span className="text-xs font-black text-white">{percent}%</span>
                                  </div>
                                  <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${percent}%` }}></div>
                                  </div>
                                </div>

                                {/* Bar 2 — Hours (simulados only) */}
                                {isSimulado && (
                                  <div className="flex flex-col gap-1">
                                    <div className="flex justify-between items-center px-1">
                                      <span className="text-xs font-black text-white">
                                        {doneH}h {doneM}min feitas
                                      </span>
                                      <span className="text-xs font-black text-white">{hourPercent}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                      <div className="h-full bg-white/70 rounded-full transition-all duration-700" style={{ width: `${hourPercent}%` }}></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="shrink-0 text-white/80 group-hover:translate-x-1 transition-transform">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  const renderOtherSubjectsMenu = () => (
    <div className="flex flex-col items-center justify-center pt-20 animate-fadeIn text-center">
      <h2 className="text-3xl font-black text-slate-800 mb-12 uppercase tracking-tighter">Outros Assuntos</h2>
      <div className="flex flex-col gap-4 w-full max-w-[280px]">
        <button
          onClick={() => {
            setStandardBankMode('faculdade');
            setStandardBankPath([]);
            setStandardBankStep('topics');
            setView('myBank');
          }}
          className="w-full flex items-center justify-center gap-3 bg-[#5A78AF] p-4 rounded-xl text-white font-black text-base shadow-lg hover:scale-105 active:scale-95 transition-all"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147L12 15l7.74-4.853a.75.75 0 000-1.294L12 4l-7.74 4.853a.75.75 0 000 1.294z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.067V16.5a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-4.433" />
          </svg>
          Matéria da Faculdade
        </button>

        {isRevisoes && (
          <button
            onClick={() => {
              setIsFromOtherSubjectsMenu(true);
              setActiveReviewSubView('pendencies');
              setView('activeReview');
            }}
            className="w-full flex items-center justify-center gap-3 bg-[#5A78AF] p-4 rounded-xl text-white font-black text-base shadow-lg hover:scale-105 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Pendências de revisão
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className={`animate-fadeIn min-h-[80vh] flex flex-col relative ${isDarkMode ? 'bg-black' : ''}`}>
      <style>{`
        @keyframes enterScreen {
          from { opacity: 0; transform: scale(0.99) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
        .perspective-1000 { perspective: 1000px; transform-style: preserve-3d; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        .view-container { animation: enterScreen 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .active-flashcard-editor[contenteditable]:empty:before { 
          content: attr(data-placeholder); 
          color: #cbd5e1; 
          cursor: text; 
          font-weight: 500;
          pointer-events: none;
        }
      `}</style>

      {/* errorMsg is shown inline below each form's save/next button */}

      {/* Vocabulary Category Delete Confirmation Modal */}
      {vocabCategoryToDelete && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-sm shadow-2xl text-center flex flex-col items-center border-black border-black">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-6">Excluir categoria?</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => setVocabCategoryToDelete(null)} className="flex-1 py-3 rounded-2xl font-black text-slate-400 hover:bg-slate-100 transition-all border-black border-slate-100">Não</button>
              <button
                onClick={() => {
                  saveVocabCategories(vocabCategories.filter(c => c.id !== vocabCategoryToDelete.id));
                  setVocabCategoryToDelete(null);
                }}
                className="flex-1 py-3 rounded-2xl font-black text-white bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all"
              >Sim</button>
            </div>
          </div>
        </div>
      )}

      {/* Book Delete Confirmation Modal */}
      {(isLivros || isPdfs || isVideoAulas || isRevisoes || isQuestoes || isSimulados) && bookToDelete && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl text-center flex flex-col items-center border-black border-black">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-6">Tem certeza que deseja apagar?</h3>
            <div className="flex gap-3 w-full">
              <button onClick={() => setBookToDelete(null)} className="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-slate-100 transition-all border-black border-slate-100">Não</button>
              <button onClick={confirmDelete} className="flex-1 py-3 rounded-xl font-black text-white bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all">Sim</button>
            </div>
          </div>
        </div>
      )}

      {/* Pendency Delete Confirmation Modal */}
      {pendencyToDelete && (
        <div className="fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-8 rounded-[2rem] w-full max-w-sm shadow-2xl text-center flex flex-col items-center border-black border-black">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-6">Apagar esta pendência?</h3>
            <div className="flex gap-3 w-full">
              <button onClick={() => setPendencyToDelete(null)} className="flex-1 py-3 rounded-xl font-black text-slate-400 hover:bg-slate-100 transition-all border-black border-slate-100">Não</button>
              <button
                onClick={() => {
                  const upd = reviewPendencies.filter(x => x.id !== pendencyToDelete.id);
                  setReviewPendencies(upd);
                  localStorage.setItem('produtivity_review_pendencies', JSON.stringify(upd));
                  setPendencyToDelete(null);
                }}
                className="flex-1 py-3 rounded-xl font-black text-white bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== POST SESSION PROGRESS MODAL ===== */}
      {showActiveReviewManageModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[5000] flex items-center justify-center p-4" onClick={() => setShowActiveReviewManageModal(false)}>
          <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden scale-100 animate-in fade-in zoom-in duration-300" onClick={e => e.stopPropagation()}>
            <div className="p-10 border-b-2 border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Gerenciar Flashcards</h3>
                <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">{manageSelectedCards[0]?.name}</p>
              </div>
              <button
                onClick={() => {
                  setShowDeletionConfirm('all');
                }}
                className="bg-black text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm border-2 border-black"
              >
                Excluir todos
              </button>
            </div>

            <div className="p-8 max-h-[50vh] overflow-y-auto custom-scrollbar bg-white flex flex-col gap-4">
              {manageSelectedCards.map((card, idx) => (
                <div key={card.id} className="group/item flex items-center justify-between p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-[#A855F7]/20 transition-all">
                  <div className="flex-1">
                    <span className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-1 block">Flashcard {idx + 1}</span>
                    <p className="text-slate-800 font-bold line-clamp-2">{card.flashcardFront}</p>
                  </div>
                  {cardUnderDeletionId === card.id ? (
                    <div className="flex items-center gap-2 animate-fadeIn">
                      <button
                        onClick={() => {
                          const updated = books.filter(b => b.id !== card.id);
                          saveBooks(updated);
                          const newManageItems = manageSelectedCards.filter(b => b.id !== card.id);
                          if (newManageItems.length === 0) setShowActiveReviewManageModal(false);
                          setManageSelectedCards(newManageItems);
                          setCardUnderDeletionId(null);
                        }}
                        className="w-10 h-10 bg-slate-50 text-slate-400 border-2 border-slate-100 rounded-xl flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-all active:scale-95 shadow-sm"
                        title="Confirmar exclusão"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCardUnderDeletionId(null)}
                        className="w-10 h-10 bg-slate-50 text-slate-400 border-2 border-slate-100 rounded-xl flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-all active:scale-95 shadow-sm"
                        title="Cancelar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setCardUnderDeletionId(card.id)}
                      className="w-10 h-10 bg-slate-50 text-slate-400 border-2 border-slate-100 rounded-xl flex items-center justify-center hover:bg-black hover:text-white hover:border-black transition-all active:scale-95 shadow-sm group/trash"
                    >
                      <svg className="w-5 h-5 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-8 bg-slate-50 border-t-2 border-slate-100 flex justify-end">
              <button
                onClick={() => setShowActiveReviewManageModal(false)}
                className="bg-[#4A69A2] text-white px-10 py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-[#3a5490] hover:scale-105 active:scale-95 transition-all"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DELETION CONFIRM MESSAGE ===== */}
      {showDeletionConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[6000] flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl relative overflow-hidden border border-slate-100">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Você tem certeza?</h3>
            <p className="text-slate-500 font-bold mb-8 leading-relaxed text-sm px-4">
              {showDeletionConfirm === 'all'
                ? "Todos os flashcards deste assunto serão excluídos permanentemente."
                : "Este flashcard será excluído permanentemente."}
            </p>
            <div className="flex flex-col gap-4">
              <button
                onClick={() => {
                  if (showDeletionConfirm === 'all') {
                    const idsToRemove = manageSelectedCards.map(c => c.id);
                    const updated = books.filter(b => !idsToRemove.includes(b.id));
                    saveBooks(updated);
                    setShowActiveReviewManageModal(false);
                  } else {
                    const updated = books.filter(b => b.id !== cardToDeleteId);
                    saveBooks(updated);
                    const newManageItems = manageSelectedCards.filter(b => b.id !== cardToDeleteId);
                    if (newManageItems.length === 0) setShowActiveReviewManageModal(false);
                    setManageSelectedCards(newManageItems);
                  }
                  setShowDeletionConfirm(null);
                  setCardToDeleteId(null);
                }}
                className="w-full py-5 bg-red-600 text-white font-black text-lg rounded-2xl shadow-xl shadow-red-200 hover:bg-red-700 active:scale-95 transition-all uppercase tracking-widest"
              >
                Sim, excluir agora
              </button>
              <button
                onClick={() => {
                  setShowDeletionConfirm(null);
                  setCardToDeleteId(null);
                }}
                className="w-full py-5 bg-slate-100 text-slate-800 font-black text-lg rounded-2xl hover:bg-slate-200 active:scale-95 transition-all uppercase tracking-widest"
              >
                Não, manter salvo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== POST SESSION PROGRESS MODAL ===== */}
      {showPostSessionModal && (() => {
        const postType = getPostSessionType();
        const isReview = postType === 'review';
        const isVideo = postType === 'video';
        const isPages = postType === 'pages';
        const isQuestions = postType === 'questions';
        const isSimulado = postType === 'simulado';

        const targetTotal = selectedStudyItem
          ? (selectedStudyItem.categoryId === 'Minhas revisões' && selectedStudyItem.reviewRepetitions
            ? selectedStudyItem.reviewRepetitions
            : ((selectedStudyItem.categoryId === 'Minhas questões' || selectedStudyItem.categoryId === 'Meus simulados')
              ? selectedStudyItem.questionQuantity || selectedStudyItem.totalPages || 1
              : selectedStudyItem.totalPages || 1))
          : 0;

        const remainingPages = selectedStudyItem
          ? Math.max(0, targetTotal - selectedStudyItem.readPages)
          : 0;

        const handleConfirmClick = () => {
          if (isPages || isQuestions || isSimulado) {
            const amount = parseInt(postSessionPagesInput) || 0;
            if (amount === 0) {
              setPostSessionPagesWarning(`Por favor, insira a quantidade de ${(isQuestions || isSimulado) ? 'questões resolvidas' : 'páginas lidas'}.`);
              return;
            }
            if ((isPages || isQuestions || isSimulado) && amount > remainingPages) {
              setPostSessionPagesWarning('O número inserido é maior do que o total restante. Verifique o valor.');
              return;
            }
          }
          if (isVideo || isSimulado) {
            const h = parseInt(postSessionVideoH.toString()) || 0;
            const m = parseInt(postSessionVideoM.toString()) || 0;
            if (h === 0 && m === 0) {
              setPostSessionPagesWarning(`Por favor, insira o tempo do ${isVideo ? 'vídeo assistido' : 'simulado'}.`);
              return;
            }
          }
          if (isReview) {
            if (postSessionReviewDone === null) {
              setPostSessionPagesWarning('Por favor, responda se concluiu a revisão.');
              return;
            }
            if (postSessionReviewDone === false && postSessionReviewNote.trim().length === 0) {
              setPostSessionPagesWarning('Por favor, descreva o que faltou revisar.');
              return;
            }
          }
          setPostSessionPagesWarning('');
          handlePostSessionConfirm();
        };

        return (
          <div className="fixed inset-0 z-[80] flex items-center justify-center backdrop-blur-md bg-black/30 animate-fadeIn p-4">
            <div className="bg-white rounded-[28px] p-8 max-w-[360px] w-full shadow-2xl border border-slate-100 animate-scaleIn flex flex-col gap-6">
              <div className="text-center">
                <div className="w-14 h-14 bg-[#EEF4FF] text-[#4A69A2] rounded-2xl flex items-center justify-center mx-auto mb-4">
                  {(isPages || isQuestions || isSimulado) && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
                  {isVideo && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>}
                  {isReview && <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>}
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-1 leading-tight">
                  {isPages && 'Quantas páginas você leu?'}
                  {(isQuestions || isSimulado) && 'Quantidade de questões resolvidas?'}
                  {isVideo && 'Quanto tempo de vídeo aula conseguiu assistir?'}
                  {isReview && 'Conseguiu revisar tudo que foi planejado?'}
                </h3>
                {selectedStudyItem?.name && (
                  <p className="text-slate-300 text-sm font-bold">({selectedStudyItem.name})</p>
                )}
              </div>

              {((isPages || isQuestions || isSimulado)) && (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ex: 15"
                    value={postSessionPagesInput}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setPostSessionPagesInput(val);
                      setPostSessionPagesWarning('');
                    }}
                    className="w-full text-center text-xl font-black text-slate-800 border-black border-slate-200 focus:border-black rounded-xl py-2.5 outline-none transition-colors placeholder:text-slate-200"
                  />
                  {postSessionPagesWarning && (
                    <p className="text-red-500 text-xs font-bold text-center animate-fadeIn">{postSessionPagesWarning}</p>
                  )}
                </div>
              )}

              {(isVideo || isSimulado) && (
                <div className="flex flex-col gap-4">
                  {isSimulado && <div className="text-center font-black mt-2 text-slate-800 text-sm opacity-80 uppercase tracking-widest">Por quantas horas você fez o simulado?</div>}
                  <div className="flex items-center justify-center gap-6">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Horas</span>
                      <div className="flex flex-col items-center border border-slate-200 rounded-xl overflow-hidden">
                        <button onClick={() => {
                          setPostSessionVideoH(h => Math.min(8, (typeof h === 'number' ? h : parseInt(h as string) || 0) + 1));
                          setPostSessionPagesWarning('');
                        }} className="w-12 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors"><svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg></button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={postSessionVideoH}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            if (val === '') {
                              setPostSessionVideoH('');
                            } else {
                              const num = parseInt(val);
                              setPostSessionVideoH(Math.min(8, num));
                            }
                            setPostSessionPagesWarning('');
                          }}
                          onFocus={() => {
                            setPreFocusValueH(postSessionVideoH);
                            setPostSessionVideoH('');
                          }}
                          onBlur={e => {
                            if (e.target.value === '') setPostSessionVideoH(preFocusValueH);
                          }}
                          className="w-12 text-center text-xl font-black text-slate-800 py-1 outline-none"
                        />
                        <button onClick={() => {
                          setPostSessionVideoH(h => Math.max(0, (typeof h === 'number' ? h : parseInt(h as string) || 0) - 1));
                          setPostSessionPagesWarning('');
                        }} className="w-12 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors"><svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></button>
                      </div>
                      <span className="text-xs font-black text-[#4A69A2]">h</span>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Minutos</span>
                      <div className="flex flex-col items-center border border-slate-200 rounded-xl overflow-hidden">
                        <button onClick={() => {
                          setPostSessionVideoM(m => Math.min(59, (typeof m === 'number' ? m : parseInt(m as string) || 0) + 1));
                          setPostSessionPagesWarning('');
                        }} className="w-12 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors"><svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg></button>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={postSessionVideoM}
                          onChange={e => {
                            const val = e.target.value.replace(/[^0-9]/g, '');
                            if (val === '') {
                              setPostSessionVideoM('');
                            } else {
                              const num = parseInt(val);
                              setPostSessionVideoM(Math.min(59, num));
                            }
                            setPostSessionPagesWarning('');
                          }}
                          onFocus={() => {
                            setPreFocusValueM(postSessionVideoM);
                            setPostSessionVideoM('');
                          }}
                          onBlur={e => {
                            if (e.target.value === '') setPostSessionVideoM(preFocusValueM);
                          }}
                          className="w-12 text-center text-xl font-black text-slate-800 py-1 outline-none"
                        />
                        <button onClick={() => {
                          setPostSessionVideoM(m => Math.max(0, (typeof m === 'number' ? m : parseInt(m as string) || 0) - 1));
                          setPostSessionPagesWarning('');
                        }} className="w-12 h-8 flex items-center justify-center hover:bg-slate-100 transition-colors"><svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg></button>
                      </div>
                      <span className="text-xs font-black text-[#4A69A2]">min</span>
                    </div>
                  </div>
                  {postSessionPagesWarning && !isPages && !isQuestions && !isReview && !isSimulado && (
                    <p className="text-red-500 text-xs font-bold text-center animate-fadeIn">{postSessionPagesWarning}</p>
                  )}
                </div>
              )}

              {isReview && (
                <div className="flex flex-col gap-4">
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setPostSessionReviewDone(true); setPostSessionPagesWarning(''); }}
                      className={`flex-1 py-2.5 rounded-xl border-black font-black text-sm transition-all active:scale-95 ${postSessionReviewDone === true
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'bg-slate-100 border-slate-200 text-black hover:border-black'
                        }`}
                    >
                      Sim
                    </button>
                    <button
                      onClick={() => { setPostSessionReviewDone(false); setPostSessionPagesWarning(''); }}
                      className={`flex-1 py-2.5 rounded-xl border-black font-black text-sm transition-all active:scale-95 ${postSessionReviewDone === false
                        ? 'bg-red-500 border-red-500 text-white'
                        : 'bg-slate-100 border-slate-200 text-black hover:border-black'
                        }`}
                    >
                      Não
                    </button>
                  </div>

                  {postSessionReviewDone === false && (
                    <div className="flex flex-col gap-3 animate-fadeIn">
                      <span className="text-sm font-black text-slate-600">O que faltou revisar?</span>
                      <textarea
                        value={postSessionReviewNote}
                        onChange={e => {
                          setPostSessionReviewNote(e.target.value);
                          setPostSessionPagesWarning('');
                        }}
                        placeholder="Ex: Não consegui revisar equações de 2º grau..."
                        rows={3}
                        className="w-full p-3 border-black border-slate-200 focus:border-black rounded-xl font-bold text-sm text-slate-700 outline-none resize-none transition-colors placeholder:text-slate-300"
                      />
                    </div>
                  )}
                  {postSessionPagesWarning && isReview && (
                    <p className="text-red-500 text-xs font-bold text-center animate-fadeIn">{postSessionPagesWarning}</p>
                  )}
                </div>
              )}

              {(!isReview || postSessionReviewDone !== null) && (
                <button
                  onClick={handleConfirmClick}
                  className="w-full py-3 rounded-xl font-black text-sm transition-all active:scale-[0.98] bg-black border-black border-black text-white shadow-md"
                >
                  Confirmar e Finalizar
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Active Review Add More Confirmation Modal */}
      {showAddMoreFlashcardsModal && (

        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-black border-black max-w-md w-full text-center">
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-4">Flash card salvo!</h3>
            {pendingFlashcardContext && pendingFlashcardContext.flashcardCountForSubject >= 30 ? (
              <>
                <p className="text-slate-500 font-bold mb-2 leading-relaxed">Você atingiu o limite de <span className="text-purple-600 font-black">30 flash cards</span> para este assunto.</p>
                <p className="text-xs text-slate-400 font-bold mb-10">({pendingFlashcardContext.flashcardCountForSubject}/30 salvos)</p>
                <button
                  onClick={() => {
                    setShowAddMoreFlashcardsModal(false);
                    setPendingFlashcardContext(null);
                    setFlashcardFront('');
                    setFlashcardBack('');
                    setFlashcardImages([]);
                    setView('activeReview');
                  }}
                  className="w-full py-4 bg-black text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase text-sm"
                >
                  Ok, voltar
                </button>
              </>
            ) : (
              <>
                <p className="text-slate-500 font-bold mb-2 leading-relaxed">Deseja adicionar mais flash cards para esse assunto?</p>
                {pendingFlashcardContext && (
                  <p className="text-xs text-slate-400 font-bold mb-8">{pendingFlashcardContext.flashcardCountForSubject}/30 flash cards para este assunto</p>
                )}
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setShowAddMoreFlashcardsModal(false);
                      setPendingFlashcardContext(null);
                      setFlashcardFront('');
                      setFlashcardBack('');
                      setFlashcardImages([]);
                      setView('activeReview');
                    }}
                    className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-sm"
                  >
                    Não
                  </button>
                  <button
                    onClick={() => {
                      // Restaura o contexto do assunto antes de resetar
                      if (pendingFlashcardContext) {
                        setReviewSubject(pendingFlashcardContext.reviewSubject);
                        setVideoStudyType(pendingFlashcardContext.videoStudyType as any);
                        setVideoDiscipline(pendingFlashcardContext.videoDiscipline);
                        setVideoArea(pendingFlashcardContext.videoArea);
                        setVideoMatter(pendingFlashcardContext.videoMatter);
                        setVideoTopic(pendingFlashcardContext.videoTopic);
                        setVideoSub1(pendingFlashcardContext.videoSub1);
                        setVideoSub2(pendingFlashcardContext.videoSub2);
                        setVideoSub3(pendingFlashcardContext.videoSub3);
                        setSharedFormStep('study_details');
                      }
                      setFlashcardFront('');
                      setFlashcardBack('');
                      setFlashcardImages([]);
                      setShowAddMoreFlashcardsModal(false);
                      setView('addReviewFlashcardFront');
                    }}
                    className="flex-1 py-4 bg-black text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase text-sm"
                  >
                    Sim
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {errorMsg && view !== 'addVideoForm' && view !== 'addReviewForm' && view !== 'addQuestionForm' && view !== 'addSimuladoForm' && view !== 'addBookForm' && view !== 'addPdfForm' && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4 pointer-events-none transition-all">
          <p className="w-full text-center text-white font-black text-sm py-3 px-4 bg-red-600 rounded-2xl shadow-2xl animate-bounce border-2 border-white">
            {errorMsg}
          </p>
        </div>
      )}

      {view !== 'menu' && view !== 'vocabulary' && view !== 'vocabRevisionMenu' && view !== 'vocabRevisionSession' && view !== 'vocabRevisionResult' && view !== 'activeReviewSession' && view !== 'activeReviewResult' && (
        <div className={`mb-6 transition-all duration-500 ease-in-out ${(view === 'myBank' && (isFromStudyMaterialSelect || isVideoAulas || isRevisoes || isQuestoes)) ? 'flex items-center justify-between' : ''} ${((view === 'pomodoroTimerActive' && pomodoroIsRunning) || (view === 'sessionTimerActive' && (isTimerRunning || showEndPomodoroConfirm))) ? 'opacity-0 pointer-events-none -translate-y-4' : 'opacity-100 translate-y-0'}`}>
          <div className="flex items-center gap-2">
            <BackButton onClick={() => {
              if (view === 'knowledgeBank' || view === 'curiosity' || view === 'mnemonic') setView('menu');
              else if (view === 'activeReview') {
                if (activeReviewSubView === 'pendencies') {
                  if (isFromOtherSubjectsMenu) {
                    setView('otherSubjectsMenu');
                  } else if (selectedCategory) {
                    setView('categoryDetail');
                  } else {
                    setActiveReviewSubView('main');
                  }
                } else {
                  setView('menu');
                }
              }
              else if (view === 'sessionType') setView('menu');
              else if (view === 'studyMaterialSelect') setView('sessionType');
              else if (view === 'categoryDetail') setView('knowledgeBank');
              else if (view === 'otherSubjectsMenu') {
                setIsFromOtherSubjectsMenu(false);
                setView('myBank');
              }
              else if (view === 'sessionTypeChoice') { setSelectedStudyItemIds([]); setStudySessionHasStarted(false); if (selectedStudyItem === null) { setView('sessionType'); } else { setView('myBank'); } }
              else if (view === 'sessionUnique') setView('sessionTypeChoice');
              else if (view === 'sessionPomodoro') setView('sessionTypeChoice');
              else if (view === 'pomodoroTimerActive') {
                if (studySessionHasStarted) {
                  setShowEndPomodoroConfirm(true);
                } else {
                  setPomodoroIsRunning(false);
                  setView('sessionPomodoro');
                }
              }
              else if (view === 'sessionPreDefined') setView('sessionUnique');
              else if (view === 'sessionCustomDuration') setView('sessionUnique');
              else if (view === 'sessionTimerActive') {
                if (studySessionHasStarted) {
                  setShowEndPomodoroConfirm(true);
                } else {
                  setIsTimerRunning(false);
                  setView('sessionPreDefined');
                }
              }
              else if (view === 'myBank') {
                if (selectedCategory?.label === 'Meus simulados' && simuladosOriginFilter) {
                  setSimuladosOriginFilter(null);
                } else {
                  if (isFromActiveReview) setView('activeReview');
                  else if (isFromStudyMaterialSelect) { setSelectedStudyItemIds([]); setView('studyMaterialSelect'); }
                  else setView('categoryDetail');
                }
              }
              else if (view === 'addBookForm' || view === 'addPdfForm' || view === 'addVideoForm' || view === 'addReviewForm' || view === 'addQuestionForm' || view === 'addSimuladoForm') {
                if (isFromActiveReview) {
                  resetAllFormFields();
                  setView('activeReview');
                } else if (sharedFormStep === 'study_details') {
                  setSharedFormStep('metadata');
                } else {
                  resetAllFormFields();
                  setView('categoryDetail');
                }
              }
              else if (view === 'addReviewFlashcardFront') {
                setSharedFormStep('study_details');
                setView('addReviewForm');
              }
              else if (view === 'addReviewFlashcardBack') {
                setView('addReviewFlashcardFront');
              }
              else setView('myBank');
            }} />

            <button
              onClick={() => {
                if (studySessionHasStarted && (view === 'pomodoroTimerActive' || view === 'sessionTimerActive')) {
                  setPendingHomeNavigation(true);
                  setShowEndPomodoroConfirm(true);
                } else {
                  setView('menu');
                  setSelectedCategory(null);
                  setIsFromActiveReview(false);
                  setIsFromStudyMaterialSelect(false);
                  setSelectedStudyItemIds([]);
                }
              }}
              className={`flex items-center justify-center p-2 rounded-xl border-black font-black transition-all shadow-sm active:scale-95 ${isDarkMode ? 'bg-black text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 hover:border-black'}`}
              title="Ir para tela inicial"
            >
              <svg className="w-5 h-5 font-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
          </div>

          {/* Outros Assuntos + Próximo - study flow */}
          {view === 'myBank' && isFromStudyMaterialSelect && (
            <div className="flex items-center gap-3 ml-auto">
              {(isVideoAulas || isRevisoes || isQuestoes) && !isFromActiveReview && (
                <button
                  onClick={() => setView('otherSubjectsMenu')}
                  className="bg-[#4A69A2] text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-md flex items-center gap-2 border-black border-black hover:brightness-110 active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Outros Assuntos
                </button>
              )}
              <button
                disabled={selectedStudyItemIds.length === 0}
                onClick={() => {
                  if (selectedStudyItemIds.length > 0) {
                    const item = filteredBooks.find(b => b.id === selectedStudyItemIds[0])
                      ?? filteredItemsByPath.find(b => b.id === selectedStudyItemIds[0])
                      ?? null;
                    setSelectedStudyItem(item);
                    setView('sessionTypeChoice');
                  }
                }}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm transition-all duration-200 ${selectedStudyItemIds.length > 0
                  ? 'bg-green-500 text-white hover:bg-green-600 active:scale-95 shadow-md cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
              >
                Próximo
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          )}

          {/* Outros Assuntos - normal bank flow (not study) */}
          {view === 'myBank' && !isFromStudyMaterialSelect && (isVideoAulas || isRevisoes || isQuestoes) && !isFromActiveReview && (
            <button
              onClick={() => setView('otherSubjectsMenu')}
              className="bg-[#4A69A2] text-white px-5 py-2.5 rounded-xl font-black text-sm shadow-md flex items-center gap-2 border-black border-black hover:brightness-110 active:scale-95 transition-all ml-auto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Outros Assuntos
            </button>
          )}
        </div>
      )}

      <div className="flex-1 view-container" key={view}>
        {view === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 sm:gap-16">
            <button
              onClick={() => setView('sessionType')}
              className="group w-44 sm:w-64 aspect-square bg-[#4A69A2] rounded-[2rem] sm:rounded-[3rem] shadow-xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-black"
            >
              <svg className="w-10 h-10 sm:w-14 sm:h-14 text-white mb-3 sm:mb-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                {/* Cabeça */}
                <circle cx="12" cy="4.5" r="3.2" />
                {/* Página esquerda do livro aberto */}
                <path d="M11.5 10 L2 12.5 L2 21.5 L11.5 19.5 Z" />
                {/* Página direita do livro aberto */}
                <path d="M12.5 10 L22 12.5 L22 21.5 L12.5 19.5 Z" />
                {/* Mão esquerda */}
                <circle cx="2" cy="17" r="1.6" />
                {/* Mão direita */}
                <circle cx="22" cy="17" r="1.6" />
              </svg>
              <span className="text-lg sm:text-2xl font-black text-white uppercase tracking-tighter">Estudar</span>
            </button>
            <div className="flex flex-wrap items-center justify-center gap-4 max-w-5xl">
              {[
                { label: 'Banco de Conhecimento', view: 'knowledgeBank' as StudyView, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /> },
                { label: 'Vocabulário', view: 'vocabulary' as StudyView, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /> },
                { label: 'Curiosidade', view: 'curiosity' as StudyView, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
                { label: 'IA mnemônico', view: 'mnemonic' as StudyView, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
                { label: 'Revisão ativa', view: 'activeReview' as StudyView, icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /> }
              ].map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => {
                    if (btn.view === 'vocabulary') {
                      setVocabSubView('categories');
                      setView('vocabulary');
                      setRevisionMode('all');
                      setSelectedRevisionCategory(null);
                      setIsFromActiveReview(false);
                    } else if (btn.view === 'curiosity') {
                      setCuriosityStep('selection');
                      setCuriosityData(null);
                      setView('curiosity');
                      setIsFromActiveReview(false);
                    } else if (btn.view === 'activeReview') {
                      setIsFromActiveReview(true);
                      setActiveReviewSubView('main');
                      setView('activeReview');
                    } else if (btn.view === 'knowledgeBank') {
                      setIsFromActiveReview(false);
                      setIsFromStudyMaterialSelect(false);
                      setSelectedStudyItemIds([]);
                      setView('knowledgeBank');
                    } else {
                      setIsFromActiveReview(false);
                      setView(btn.view);
                    }
                  }}
                  className="px-6 sm:px-12 py-4 sm:py-5 rounded-[1.5rem] sm:rounded-[2rem] font-black text-white shadow-xl flex items-center gap-3 sm:gap-4 transition-all hover:scale-105 active:scale-95 bg-[#4A69A2] hover:bg-black text-sm sm:text-base"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">{btn.icon}</svg>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {view === 'vocabulary' && renderVocabulary()}
        {view === 'vocabRevisionMenu' && renderVocabRevisionMenu()}
        {view === 'vocabRevisionSession' && renderVocabRevisionSession()}
        {view === 'vocabRevisionResult' && renderVocabRevisionResult()}
        {view === 'otherSubjectsMenu' && renderOtherSubjectsMenu()}
        {view === 'curiosity' && renderCuriosity()}
        {view === 'mnemonic' && renderMnemonicView()}
        {view === 'activeReviewSession' && renderActiveReviewSession()}
        {view === 'activeReviewResult' && renderActiveReviewResult()}

        {view === 'activeReview' && (
          <div className="flex flex-col items-center max-w-4xl mx-auto pt-10 w-full">
            <div className="flex flex-col items-center mb-10">
              <h2 className={`text-3xl font-black ${textColor} relative inline-block text-center uppercase tracking-tighter`}>
                {activeReviewSubView === 'pendencies' ? 'Pendências' : 'Revisão Ativa'}
                <div className="h-1 bg-[#4A69A2] w-full mt-2 rounded-full"></div>
              </h2>
            </div>

            {activeReviewSubView === 'main' && (
              <div className="flex flex-col gap-6 w-full max-w-md px-4 items-center">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full justify-items-center">
                  <button
                    onClick={() => {
                      const reviewCat = categories.find(c => c.label === 'Minhas revisões');
                      if (reviewCat) {
                        setIsFromActiveReview(true);
                        setSelectedCategory(reviewCat);
                        setStandardBankMode('ensino_medio');
                        setStandardBankStep('disciplines');
                        setStandardBankPath([]);
                        setView('myBank');
                      }
                    }}
                    className="bg-black rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-all text-white group w-full min-h-[140px]"
                  >
                    <div className="p-3 rounded-2xl bg-white/10 group-hover:bg-white/20 transition-colors">
                      <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 6v12M11 6v12M15 6v12M19 8l-2 10" /></svg>
                    </div>
                    <span className="text-lg font-black">Meu banco</span>
                  </button>
                  <button
                    onClick={() => {
                      const reviewCat = categories.find(c => c.label === 'Minhas revisões');
                      if (reviewCat) {
                        setIsFromActiveReview(true);
                        setSelectedCategory(reviewCat);
                        setSharedFormStep('study_details');
                        setReviewSubject('');
                        setReviewMethod('Ativa'); setReviewRepetitions(0); setRevDurationH(0); setRevDurationM(0);
                        setView('addReviewForm');
                      }
                    }}
                    className="bg-white border-2 border-black/10 rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-all text-black group w-full min-h-[140px]"
                  >
                    <div className="p-3 rounded-2xl bg-[#4A69A2]/5 group-hover:bg-[#4A69A2]/10 transition-colors text-[#4A69A2]">
                      <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                    </div>
                    <span className="text-lg font-black text-center leading-tight">Adicionar revisão ativa</span>
                  </button>
                </div>

                {/* Pendências de revisão button */}
                <button
                  onClick={() => setActiveReviewSubView('pendencies')}
                  className="w-full flex items-center justify-between px-6 py-4 bg-amber-50 border-black border-amber-200 rounded-2xl hover:bg-amber-100 hover:border-amber-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-100 group-hover:bg-amber-200 rounded-xl flex items-center justify-center transition-colors">
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="font-black text-amber-700 text-sm block">Pendências de revisão</span>
                      <span className="text-amber-500 text-xs font-bold">{reviewPendencies.length} {reviewPendencies.length === 1 ? 'item' : 'itens'} pendente{reviewPendencies.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}

            {activeReviewSubView === 'pendencies' && (
              <div className="w-full max-w-2xl px-4">


                {reviewPendencies.length === 0 ? (
                  <div className="text-center py-20 text-slate-300">
                    <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <p className="font-black uppercase tracking-widest text-sm">Nenhuma pendência!</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {reviewPendencies.map(p => (
                      <div
                        key={p.id}
                        className={`w-full bg-slate-100 border-black border-slate-200 rounded-2xl p-4 transition-all group relative ${p.completed ? '' : 'hover:border-black'}`}
                      >
                        <div className="flex items-center gap-4">
                          {/* Checklist Square */}
                          <button
                            onClick={() => {
                              const upd = reviewPendencies.map(x => x.id === p.id ? { ...x, completed: !x.completed } : x);
                              setReviewPendencies(upd);
                              localStorage.setItem('produtivity_review_pendencies', JSON.stringify(upd));
                            }}
                            className={`w-6 h-6 border-black rounded-md transition-all flex items-center justify-center shrink-0 group/check ${p.completed ? 'bg-white border-black' : 'border-slate-300 bg-white hover:border-black'}`}
                          >
                            <svg className={`w-4 h-4 transition-opacity ${p.completed ? 'text-black opacity-100' : 'text-black opacity-100 md:opacity-0 md:group-hover/check:opacity-100'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>

                          {/* Content - Click to see detail */}
                          <div
                            className={`flex-1 min-w-0 cursor-pointer transition-all ${p.completed ? 'line-through opacity-50' : 'opacity-100'}`}
                            onClick={() => setShowPendencyDetail(p)}
                          >
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-0.5">{p.date} · {p.itemName}</span>
                            <p className="text-sm font-black text-black truncate">{p.path}</p>
                          </div>

                          {/* Delete Button (Trash) - Show on hover */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendencyToDelete(p);
                            }}
                            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 p-2 text-slate-400 hover:text-red-500 transition-all shrink-0"
                            title="Remover pendência"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pendency Detail Modal */}
                {showPendencyDetail && (
                  <div className="fixed inset-0 z-[70] flex items-center justify-center backdrop-blur-md bg-transparent animate-fadeIn p-4">
                    <div className="bg-white rounded-[24px] p-8 max-w-[380px] w-full shadow-2xl border border-slate-100 animate-scaleIn relative">
                      <button
                        onClick={() => setShowPendencyDetail(null)}
                        className="absolute top-4 right-4 w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>

                      <div className="mt-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">O que faltou revisar:</span>
                        <p className="text-black font-black text-lg leading-relaxed whitespace-pre-wrap">{showPendencyDetail.note}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'myBank' && selectedCategory && (
          <div className="w-full max-w-4xl mx-auto space-y-6 pt-10">
            {(isVideoAulas || isRevisoes || isQuestoes || (isSimulados && standardBankPath.length > 0)) ? (
              renderStandardizedBank()
            ) : isSimulados && standardBankPath.length === 0 ? (
              <div className="flex flex-col gap-3 w-full max-w-sm mx-auto mt-4 px-4">
                {[
                  {
                    id: 'ENEM',
                    label: 'ENEM',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  },
                  {
                    id: 'Vestibulares',
                    label: 'Vestibulares',
                    icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></>
                  },
                  {
                    id: 'Faculdade',
                    label: 'Faculdade',
                    icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setStandardBankPath([{ label: opt.label, type: 'simuladoOrigin', value: opt.id }]);
                      setStandardBankStep('sim_years');
                    }}
                    className="group bg-white border-black border-slate-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:border-[#7EB1FF] hover:bg-[#7EB1FF] hover:shadow-md transition-all duration-300 hover:scale-[1.02] active:scale-95 text-left w-full"
                  >
                    <div className="w-12 h-12 rounded-xl bg-[#EEF4FF] group-hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors">
                      <svg className="w-6 h-6 text-[#4A69A2] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {opt.icon}
                      </svg>
                    </div>
                    <span className="text-lg font-black text-slate-800 group-hover:text-white transition-colors">{opt.label}</span>
                  </button>
                ))}
              </div>
            ) : filteredBooks.length > 0 ? (
              <div className="grid gap-6">
                {filteredBooks.map(book => {
                  const percent = book.totalPages > 0 ? Math.round((book.readPages / book.totalPages) * 100) : 0;
                  const isPdfCard = book.categoryId === "Meus PDF's";
                  const isSimCard = book.categoryId === 'Meus simulados';

                  const cardBgColor = book.color || (book.relevance ? relevanceColorMap[book.relevance] : '#f59e0b');

                  const isSelected = selectedStudyItemIds.includes(book.id);
                  return (
                    <div
                      key={book.id}
                      onClick={() => {
                        if (isFromStudyMaterialSelect) {
                          setSelectedStudyItemIds(prev => prev.includes(book.id) ? [] : [book.id]);
                        } else {
                          onOpenDetail?.(book);
                        }
                      }}
                      className={`group p-4 rounded-[1.5rem] flex items-center gap-4 text-white shadow-lg cursor-pointer hover:scale-[1.02] transition-all relative border-[3px] ${isFromStudyMaterialSelect && isSelected ? 'border-green-400 ring-2 ring-green-400/50' : 'border-transparent'
                        }`}
                      style={{ backgroundColor: cardBgColor }}
                    >
                      {/* Checkbox overlay - only in study flow */}
                      {isFromStudyMaterialSelect && (
                        <div className={`absolute top-4 left-4 w-6 h-6 rounded-md flex items-center justify-center border-black transition-all duration-200 z-10 shadow-sm ${isSelected ? 'bg-green-500 border-green-500' : 'bg-white/20 border-white/60'
                          }`}>
                          {isSelected && (
                            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      )}
                      {/* Delete button - hidden in study flow */}
                      {!isFromStudyMaterialSelect && (
                        <button onClick={(e) => { e.stopPropagation(); setBookToDelete(book); }} className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 z-20 border-black border-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      )}
                      <div className={`w-11 h-11 bg-white/30 rounded-xl flex items-center justify-center shrink-0 border border-white/20 ${isFromStudyMaterialSelect ? 'ml-10' : ''}`}>
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isPdfCard ? (
                            <>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4h11l5 5v13H4V4z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 4v5h5" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 14h10M7 18.5h10" />
                            </>
                          ) : isSimCard ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.875c0 .621.504 1.125 1.125 1.125H18M9 12.75l1.5 1.5 3-3" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          )}
                        </svg>
                      </div>
                      <div className="flex-1 flex flex-col">
                        <h3 className={`text-base font-black text-left tracking-tight leading-snug ${isFromStudyMaterialSelect ? 'mb-0' : 'mb-2'}`}>{book.name}</h3>
                        {!isFromStudyMaterialSelect && (
                          <div className="w-full bg-black/30 rounded-xl p-2.5 flex flex-col gap-1.5">
                            <div className="flex justify-between items-center px-1">
                              <span className="text-sm font-black text-white">
                                {book.categoryId === 'Minhas vídeo aulas'
                                  ? `${Math.floor(book.readPages / 60)}h ${book.readPages % 60}min assistidas`
                                  : book.categoryId === 'Minhas questões'
                                    ? `${book.readPages} questões feitas`
                                    : isSimCard ? 'Progresso' : book.readPages + ' páginas lidas'
                                }
                              </span>
                              <span className="text-sm font-black text-white">{percent}%</span>
                            </div>
                            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${percent}%` }}></div></div>
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-white/80 group-hover:translate-x-1 transition-transform"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></div>
                    </div>
                  );
                })}
              </div>
            ) : <div className={`text-center py-24 ${isDarkMode ? 'bg-black border-slate-800' : 'bg-white border-slate-200'} rounded-[3rem] border-black border-dashed text-slate-300 font-bold uppercase tracking-widest`}>nenhum arquivo salvo</div>}
          </div>
        )}

        {view === 'knowledgeBank' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-5xl mx-auto pt-10">
            {categories.map((item, idx) => (
              <button key={idx} onClick={() => { setIsFromActiveReview(false); setSelectedCategory(item); setView('categoryDetail'); }} className="group flex flex-col items-center justify-center gap-6 p-10 border-2 border-black/10 rounded-[2rem] hover:scale-105 transition-all shadow-xl text-center hover:bg-[#7EB1FF] hover:border-transparent bg-white text-slate-800">
                <span className="text-lg font-black text-slate-800 group-hover:text-white">{item.label}</span>
                <div className="group-hover:text-white text-slate-800">{item.icon}</div>
              </button>
            ))}
          </div>
        )}

        {view === 'categoryDetail' && selectedCategory && (
          <div className="flex flex-col items-center max-w-4xl mx-auto pt-10">
            <div className="flex flex-col items-center mb-16"><h2 className={`text-3xl font-black ${textColor} relative inline-block text-center uppercase tracking-tighter`}>{selectedCategory.label}<div className="h-1 bg-[#4A69A2] w-full mt-2 rounded-full"></div></h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-md px-4 justify-items-center">
              <button onClick={() => { setIsFromStudyMaterialSelect(false); setSelectedStudyItemIds([]); if (isSimulados) { setStandardBankMode('simulados'); setStandardBankStep('sim_origins'); setStandardBankPath([]); } else if (isVideoAulas || isRevisoes || isQuestoes) { setStandardBankMode('ensino_medio'); setStandardBankStep('disciplines'); setStandardBankPath([]); } setView('myBank'); }} className="bg-black rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-all text-white group w-full min-h-[140px]">
                <div className="p-3 rounded-2xl bg-white/10 group-hover:bg-white/20 transition-colors"><svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 6v12M11 6v12M15 6v12M19 8l-2 10" /></svg></div>
                <span className="text-lg font-black">Meu banco</span>
              </button>
              <button
                onClick={() => {
                  setSharedFormStep('metadata');
                  setVideoSubject(''); setReviewSubject(''); setQuestionSubject('');
                  setVideoStudyType(null); setVideoDiscipline(''); setVideoArea(''); setVideoMatter(''); setVideoTopic(''); setVideoSub1(''); setVideoSub2(''); setVideoSub3('');
                  setTopicMode(''); setSub1Mode(''); setSub2Mode(''); setSub3Mode('');
                  setReviewMethod(null); setReviewRepetitions(0); setRevDurationH(0); setRevDurationM(0);
                  if (isLivros) setView('addBookForm');
                  else if (isPdfs) setView('addPdfForm');
                  else if (isVideoAulas) setView('addVideoForm');
                  else if (isRevisoes) setView('addReviewForm');
                  else if (isQuestoes) setView('addQuestionForm');
                  else if (isSimulados) setView('addSimuladoForm');
                }}
                className="bg-white border-2 border-black/10 rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-all text-black group w-full min-h-[140px]"
              >
                <div className="p-3 rounded-2xl bg-[#4A69A2]/5 group-hover:bg-[#4A69A2]/10 transition-colors text-[#4A69A2]"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg></div>
                <span className="text-lg font-black text-center leading-tight">Adicionar {selectedCategory.singular}</span>
              </button>
            </div>

            {isRevisoes && (
              <div className="mt-8 w-full max-w-md px-4">
                <button
                  onClick={() => {
                    setIsFromOtherSubjectsMenu(false);
                    setActiveReviewSubView('pendencies');
                    setView('activeReview');
                  }}
                  className="w-full flex items-center justify-between px-6 py-4 bg-amber-50 border-black border-amber-200 rounded-2xl hover:bg-amber-100 hover:border-amber-300 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-amber-100 group-hover:bg-amber-200 rounded-xl flex items-center justify-center transition-colors">
                      <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <span className="font-black text-amber-700 text-sm block">Pendências de revisão</span>
                      <span className="text-amber-500 text-xs font-bold">{reviewPendencies.length} {reviewPendencies.length === 1 ? 'item' : 'itens'} pendente{reviewPendencies.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <svg className="w-5 h-5 text-amber-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Formulários Padronizados (Passo 1) */}
        {view === 'addVideoForm' && sharedFormStep === 'metadata' && (
          <div className="flex flex-col items-center gap-12 w-full max-w-2xl mx-auto pt-4 pb-12">
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg><label className="text-lg font-black text-black">Assunto da videoaula:</label></div>
              <input type="text" value={videoSubject} onChange={(e) => setVideoSubject(e.target.value)} placeholder="Digite o assunto..." className="w-full p-4 rounded-[1.5rem] border-black border-black bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300" />
            </div>
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg><label className="text-lg font-black text-black">Finalidade:</label></div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setVideoFinality('Para estudo')} className={`py-4 px-2 border-2 rounded-2xl font-black text-sm transition-all hover:border-black/50 ${videoFinality === 'Para estudo' ? 'bg-black text-white border-black' : 'bg-white text-slate-800 border-black/20'}`}>Para estudo</button>
                <button onClick={() => setVideoFinality('Entretenimento')} className={`py-4 px-2 border-2 rounded-2xl font-black text-sm transition-all hover:border-black/50 ${videoFinality === 'Entretenimento' ? 'bg-black text-white border-black' : 'bg-white text-slate-800 border-black/20'}`}>Entretenimento</button>
              </div>
            </div>
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                <label className="text-lg font-black text-black">De onde é? (Fonte)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['YouTube', 'Faculdade', 'Curso preparatório', 'Outro'].map((src) => (
                  <button
                    key={src}
                    onClick={() => setVideoSource(src as any)}
                    className={`py-4 px-2 border-2 rounded-2xl font-black text-sm transition-all hover:border-black/50 ${videoSource === src ? 'bg-black text-white border-black' : 'bg-white text-slate-800 border-black/20'}`}
                  >
                    {src}
                  </button>
                ))}
              </div>
              {videoSource === 'Outro' && (
                <div className="mt-3 animate-fadeIn">
                  <input
                    type="text"
                    value={videoOtherSource}
                    onChange={(e) => setVideoOtherSource(e.target.value)}
                    placeholder="Especifique a fonte..."
                    className="w-full p-4 rounded-xl border-black border-black font-bold outline-none bg-white text-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg><label className="text-lg font-black text-black">Duração da aula:</label></div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setVDurationH(Math.max(0, (vDurationH || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-black/20 min-w-[60px]">
                    <input type="number" value={vDurationH === undefined ? '' : vDurationH} onFocus={() => setVDurationH(undefined)} onBlur={() => { if (vDurationH === undefined) setVDurationH(0); }} onChange={(e) => setVDurationH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black text-[#4A69A2]">horas</span>
                  </div>
                  <button onClick={() => setVDurationH((vDurationH || 0) + 1)} className={numericBtnClass}>+</button>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setVDurationM(Math.max(0, (vDurationM || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-black/20 min-w-[60px]">
                    <input type="number" value={vDurationM === undefined ? '' : vDurationM} onFocus={() => setVDurationM(undefined)} onBlur={() => { if (vDurationM === undefined) setVDurationM(0); }} onChange={(e) => setVDurationM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black text-[#4A69A2]">min</span>
                  </div>
                  <button onClick={() => setVDurationM(Math.min(59, (vDurationM || 0) + 1))} className={numericBtnClass}>+</button>
                </div>
              </div>
            </div>

            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 mb-3 px-4 text-center"><svg className="w-6 h-6 shrink-0 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></svg><label className="text-lg font-black text-black leading-tight">Em quanto tempo você acha que termina essa vídeo aula?</label></div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setVCompletionH(Math.max(0, (vCompletionH || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-black/20 min-w-[60px]">
                    <input type="number" value={vCompletionH === undefined ? '' : vCompletionH} onFocus={() => setVCompletionH(undefined)} onBlur={() => { if (vCompletionH === undefined) setVCompletionH(0); }} onChange={(e) => setVCompletionH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black text-[#4A69A2]">horas</span>
                  </div>
                  <button onClick={() => setVCompletionH((vCompletionH || 0) + 1)} className={numericBtnClass}>+</button>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setVCompletionM(Math.max(0, (vCompletionM || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-black/20 min-w-[60px]">
                    <input type="number" value={vCompletionM === undefined ? '' : vCompletionM} onFocus={() => setVCompletionM(undefined)} onBlur={() => { if (vCompletionM === undefined) setVCompletionM(0); }} onChange={(e) => setVCompletionM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black text-[#4A69A2]">min</span>
                  </div>
                  <button onClick={() => setVCompletionM(Math.min(59, (vCompletionM || 0) + 1))} className={numericBtnClass}>+</button>
                </div>
              </div>
            </div>

            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg><label className="text-lg font-black text-black">Grau de relevância:</label></div><div className="flex flex-wrap justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setVideoRelevance(rel)} className={getRelevanceBtnClass(rel, videoRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg><label className="text-lg font-black text-black">Escolha uma cor:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setVideoColor(color)} className={`w-7 h-7 rounded-full border-black transition-all shadow-sm ${videoColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <div className="relative w-full">
              <button
                onClick={() => {
                  if (!videoSubject.trim()) {
                    setErrorMsg("Por favor, preencha o assunto da videoaula.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if ((vDurationH || 0) === 0 && (vDurationM || 0) === 0) {
                    setErrorMsg("Por favor, preencha a duração da aula.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if ((vCompletionH || 0) === 0 && (vCompletionM || 0) === 0) {
                    setErrorMsg("Por favor, preencha o tempo estimado de término.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  setSharedFormStep('study_details');
                }}
                className="w-full py-5 rounded-3xl bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95"
              >
                Próximo
              </button>
              {view === 'addVideoForm' && sharedFormStep === 'metadata' && errorMsg && (
                <p className="absolute bottom-[calc(100%+8px)] left-0 w-full text-center text-white font-black text-base py-3 px-4 bg-red-600 rounded-2xl animate-bounce shadow-2xl pointer-events-none">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {view === 'addReviewForm' && sharedFormStep === 'metadata' && (
          <div className="flex flex-col items-center gap-12 w-full max-w-2xl mx-auto pt-4 pb-12">
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg><label className="text-lg font-black text-black">Assunto da revisão:</label></div><input type="text" value={reviewSubject} onChange={(e) => setReviewSubject(e.target.value)} placeholder="Digite o assunto da revisão..." className="w-full p-4 rounded-[1.5rem] border-2 border-black/10 bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300" /></div>
            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
                <label className="text-lg font-black text-black">Qual o tipo de revisão?</label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <button onClick={() => setReviewMethod('Ativa')} className={`py-4 rounded-[1.5rem] font-black border-2 border-black/10 transition-all shadow-sm ${reviewMethod === 'Ativa' ? 'bg-black text-white border-black' : 'bg-white text-black'}`}>Revisão Ativa</button>
                  {reviewMethod === 'Ativa' && <p className="text-[10px] font-black italic text-slate-400 ladies-tight animate-fadeIn">vou forçar meu cérebro a lembrar, sem olhar para o que escrevi</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setReviewMethod('Passiva')} className={`py-4 rounded-[1.5rem] font-black border-2 border-black/10 transition-all shadow-sm ${reviewMethod === 'Passiva' ? 'bg-black text-white border-black' : 'bg-white text-black'}`}>Revisão Passiva</button>
                  {reviewMethod === 'Passiva' && <p className="text-[10px] font-black italic text-slate-400 ladies-tight animate-fadeIn">vou ler o que foi estudado</p>}
                </div>
              </div>
            </div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg><label className="text-lg font-black text-black">Quantas vezes é preciso revisar este conteúdo?</label></div><div className="flex items-center justify-center gap-6"><button onClick={() => setReviewRepetitions(Math.max(0, (reviewRepetitions || 0) - 1))} className={numericBtnClass}>-</button><div className="flex items-baseline gap-2 border-b-2 border-black/10 pb-1 min-w-[120px] justify-center"><input type="number" value={reviewRepetitions === undefined ? '' : reviewRepetitions} onFocus={() => setReviewRepetitions(undefined)} onBlur={() => { if (reviewRepetitions === undefined) setReviewRepetitions(0); }} onChange={(e) => setReviewRepetitions(parseInt(e.target.value) || 0)} className="w-20 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-xl font-black text-[#4A69A2]">vezes</span></div><button onClick={() => setReviewRepetitions((reviewRepetitions || 0) + 1)} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg><label className="text-lg font-black text-black">Qual a duração da sua revisão?</label></div><div className="flex items-center justify-center gap-4"><div className="flex items-center gap-3"><button onClick={() => setRevDurationH(Math.max(0, (revDurationH || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-black/10 min-w-[70px]"><input type="number" value={revDurationH === undefined ? '' : revDurationH} onFocus={() => setRevDurationH(undefined)} onBlur={() => { if (revDurationH === undefined) setRevDurationH(0); }} onChange={(e) => setRevDurationH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black opacity-30">horas</span></div><button onClick={() => setRevDurationH((revDurationH || 0) + 1)} className={numericBtnClass}>+</button></div><div className="flex items-center gap-3"><button onClick={() => setRevDurationM(Math.max(0, (revDurationM || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-black/10 min-w-[70px]"><input type="number" value={revDurationM === undefined ? '' : revDurationM} onFocus={() => setRevDurationM(undefined)} onBlur={() => { if (revDurationM === undefined) setRevDurationM(0); }} onChange={(e) => setRevDurationM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black text-[#4A69A2]">minutos</span></div><button onClick={() => setRevDurationM(Math.min(59, (revDurationM || 0) + 1))} className={numericBtnClass}>+</button></div></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg><label className="text-lg font-black text-black">Qual o grau de relevância?</label></div><div className="flex justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setReviewRelevance(rel)} className={getRelevanceBtnClass(rel, reviewRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg><label className="text-lg font-black text-black">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setReviewColor(color)} className={`w-7 h-7 rounded-full border-black transition-all shadow-sm ${reviewColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <div className="relative w-full">
              <button
                onClick={() => {
                  if (!reviewSubject.trim()) {
                    setErrorMsg("Assunto da revisão: Por favor, preencha o assunto da revisão.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if (reviewMethod === null) {
                    setErrorMsg("Qual o tipo de revisão: Por favor, selecione o tipo de revisão.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if ((reviewRepetitions || 0) === 0) {
                    setErrorMsg("Quantas vezes é preciso revisar: Por favor, preencha a quantidade de repetições.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if ((revDurationH || 0) === 0 && (revDurationM || 0) === 0) {
                    setErrorMsg("Duração da revisão: Por favor, preencha a duração da sua revisão.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  setSharedFormStep('study_details');
                }}
                className="w-full py-5 rounded-3xl bg-[#6279A8] hover:bg-[#4A69A2] text-white font-black text-2xl shadow-xl transition-all active:scale-95"
              >
                Próximo
              </button>
              {view === 'addReviewForm' && sharedFormStep === 'metadata' && errorMsg && (
                <p className="absolute bottom-[calc(100%+8px)] left-0 w-full text-center text-white font-black text-base py-3 px-4 bg-red-600 rounded-2xl animate-bounce shadow-2xl pointer-events-none">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {view === 'addQuestionForm' && sharedFormStep === 'metadata' && (
          <div className="flex flex-col items-center gap-12 w-full max-w-2xl mx-auto pt-4 pb-12">
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg><label className="text-lg font-black text-black">Assunto das questões:</label></div><input type="text" value={questionSubject} onChange={(e) => setQuestionSubject(e.target.value)} placeholder="Digite o assunto das questões..." className="w-full p-4 rounded-[1.5rem] border-2 border-black/10 bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300 text-center" /></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg><label className="text-xl font-black text-black">Fonte:</label></div><div className="flex flex-wrap justify-center gap-3">{['YouTube', 'Plataforma de questão', 'PDF no tablet ou celular', 'Livro didático', 'Folha física', 'Cursinho online ou presencial', 'Outra fonte'].map((source) => (<button key={source} onClick={() => setQuestionSource(source)} className={`px-6 py-2.5 rounded-full font-black text-sm border-2 transition-all shadow-sm ${questionSource === source ? 'bg-black text-white border-black' : 'bg-white text-black border-black/10 hover:bg-slate-50'}`}>{source}</button>))}</div>{questionSource === 'Outra fonte' && (<input type="text" value={questionOtherSource} onChange={(e) => setQuestionOtherSource(e.target.value)} placeholder="Especifique a fonte..." className="mt-4 w-full p-3 rounded-2xl border-2 border-black/10 font-bold text-slate-800 outline-none text-center" />)}</div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-3 mb-6"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" /></svg><label className="text-lg font-black text-black">Quantas questões vai fazer desse assunto?</label></div><div className="flex items-center justify-center gap-6"><button onClick={() => setQuestionQuantity(Math.max(0, (questionQuantity || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-black/10 min-w-[120px] justify-center"><input type="number" value={questionQuantity === undefined ? '' : questionQuantity} onFocus={() => setQuestionQuantity(undefined)} onBlur={() => { if (questionQuantity === undefined) setQuestionQuantity(0); }} onChange={(e) => setQuestionQuantity(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black text-[#4A69A2]">questões</span></div><button onClick={() => setQuestionQuantity((questionQuantity || 0) + 1)} className={numericBtnClass}>+</button></div></div>


            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg><label className="text-lg font-black text-black leading-tight">Quanto tempo vai demorar para fazer essa quantidade de questões?</label></div><div className="flex items-center justify-center gap-4"><div className="flex items-center gap-3"><button onClick={() => setQDurationH(Math.max(0, (qDurationH || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-black/10 min-w-[70px]"><input type="number" value={qDurationH === undefined ? '' : qDurationH} onFocus={() => setQDurationH(undefined)} onBlur={() => { if (qDurationH === undefined) setQDurationH(0); }} onChange={(e) => setQDurationH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black text-[#4A69A2]">horas</span></div><button onClick={() => setQDurationH((qDurationH || 0) + 1)} className={numericBtnClass}>+</button></div><div className="flex items-center gap-3"><button onClick={() => setQDurationM(Math.max(0, (qDurationM || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-black/10 min-w-[70px]"><input type="number" value={qDurationM === undefined ? '' : qDurationM} onFocus={() => setQDurationM(undefined)} onBlur={() => { if (qDurationM === undefined) setQDurationM(0); }} onChange={(e) => setQDurationM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black text-[#4A69A2]">minutos</span></div><button onClick={() => setQDurationM(Math.min(59, (qDurationM || 0) + 1))} className={numericBtnClass}>+</button></div></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg><label className="text-lg font-black text-black">Qual o grau de relevância?</label></div><div className="flex justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setQuestionRelevance(rel)} className={getRelevanceBtnClass(rel, questionRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg><label className="text-lg font-black text-black">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setQuestionColor(color)} className={`w-7 h-7 rounded-full border-black transition-all shadow-sm ${questionColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <div className="relative w-full">
              <button
                onClick={() => {
                  if (!questionSubject.trim()) {
                    setErrorMsg("Assunto das questões: Por favor, preencha o assunto das questões.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if ((questionQuantity || 0) === 0) {
                    setErrorMsg("Quantas questões vai fazer: Por favor, preencha a quantidade de questões.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  if ((qDurationH || 0) === 0 && (qDurationM || 0) === 0) {
                    setErrorMsg("Tempo para fazer as questões: Por favor, preencha a duração estimada.");
                    setTimeout(() => setErrorMsg(null), 3000);
                    return;
                  }
                  setSharedFormStep('study_details');
                }}
                className="w-full py-5 rounded-3xl bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95"
              >
                Próximo
              </button>
              {view === 'addQuestionForm' && sharedFormStep === 'metadata' && errorMsg && (
                <p className="absolute bottom-[calc(100%+8px)] left-0 w-full text-center text-white font-black text-base py-3 px-4 bg-red-600 rounded-2xl animate-bounce shadow-2xl pointer-events-none">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {/* Formulário Compartilhado (Passo 2) */}
        {(view === 'addVideoForm' || view === 'addReviewForm' || view === 'addQuestionForm') && sharedFormStep === 'study_details' && (() => {
          // Lista de itens salvos filtrada pelo caminho atual (disciplina + matéria + área)
          const currentSavedTopics = getSavedListForPath('topic');
          const currentSavedSub1 = getSavedListForPath('sub1');
          const currentSavedSub2 = getSavedListForPath('sub2');
          const currentSavedSub3 = getSavedListForPath('sub3');

          return (
            <div className="flex flex-col items-center gap-12 w-full max-w-2xl mx-auto pt-4 pb-12">
              {/* Campo especial para Revisão Ativa no Passo 2 */}
              {isFromActiveReview && (
                <div className="w-full text-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg><label className="text-lg font-black text-black">Assunto da revisão:</label></div>
                  <input
                    type="text"
                    value={reviewSubject}
                    onChange={(e) => setReviewSubject(e.target.value)}
                    placeholder="Digite o assunto da revisão..."
                    className="w-full p-4 rounded-[1.5rem] border-2 border-black/10 bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300"
                  />
                </div>
              )}

              <div className="w-full text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-4"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg><h3 className="text-xl font-black text-black">Vou estudar para</h3></div>
                <div className="flex gap-4">
                  <button onClick={() => { setVideoStudyType('ensino_medio'); setVideoDiscipline(''); setVideoArea(''); setVideoMatter(''); setVideoTopic(''); setVideoSub1(''); setVideoSub2(''); setVideoSub3(''); setTopicMode(''); setSub1Mode(''); setSub2Mode(''); setSub3Mode(''); }} className={`flex-1 py-4 px-3 rounded-2xl font-bold transition-all border-2 border-black/10 text-sm leading-tight h-24 flex items-center justify-center ${videoStudyType === 'ensino_medio' ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white text-black'}`}>Disciplina do ensino médio (ENEM ou vestibulares)</button>
                  <button onClick={() => { setVideoStudyType('faculdade'); setVideoDiscipline(''); setVideoArea(''); setVideoMatter(''); setVideoTopic(''); setVideoSub1(''); setVideoSub2(''); setVideoSub3(''); setTopicMode(''); setSub1Mode(''); setSub2Mode(''); setSub3Mode(''); }} className={`flex-1 py-4 px-3 rounded-2xl font-bold transition-all border-2 border-black/10 text-sm leading-tight h-24 flex items-center justify-center ${videoStudyType === 'faculdade' ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white text-black'}`}>Matéria da Faculdade</button>
                </div>
                {!videoStudyType && <p className="text-red-400 font-bold text-xs mt-4 animate-pulse">Selecione uma option acima para liberar os tópicos</p>}
              </div>

              {videoStudyType === 'ensino_medio' && (
                <div className="w-full flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row gap-4 w-full items-end">
                    <div className="flex-1 flex flex-col gap-2 text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Disciplina</label><select value={videoDiscipline} onChange={(e) => { setVideoDiscipline(e.target.value); setVideoArea(''); setVideoMatter(''); }} className="w-full p-4 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{disciplinesList.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                    {(videoDiscipline === 'Geografia' || videoDiscipline === 'História' || videoDiscipline === 'Português') && (
                      <div className="flex-1 flex flex-col gap-2 text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Área</label><select value={videoArea} onChange={(e) => { setVideoArea(e.target.value); setVideoMatter(''); }} className="w-full p-4 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{videoDiscipline === 'Geografia' && (<><option value="Geografia física">Geografia física</option><option value="Geografia humana">Geografia humana</option></>)}{videoDiscipline === 'História' && (<><option value="História geral">História geral</option><option value="História do Brasil">História do Brasil</option></>)}{videoDiscipline === 'Português' && (<><option value="Gramática">Gramática</option><option value="Interpretação de texto">Interpretação de texto</option></>)}</select></div>
                    )}
                    {((videoDiscipline && !['Geografia', 'História', 'Português'].includes(videoDiscipline)) || (videoDiscipline && ['Geografia', 'História', 'Português'].includes(videoDiscipline) && videoArea)) && (
                      <div className="flex-1 flex flex-col gap-2 text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Matéria</label><select value={videoMatter} onChange={(e) => setVideoMatter(e.target.value)} className="w-full p-4 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{(videoDiscipline === 'Geografia' || videoDiscipline === 'História' || videoDiscipline === 'Português') ? videoArea && areaMatters[videoArea]?.map(m => <option key={m} value={m}>{m}</option>) : videoDiscipline && disciplineMatters[videoDiscipline]?.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    )}
                  </div>
                </div>
              )}

              {videoStudyType === 'faculdade' && (
                <div className="w-full text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 block">Matéria</label><input type="text" value={videoMatter} onChange={(e) => setVideoMatter(e.target.value)} placeholder="Digite o nome da matéria..." className="w-full p-4 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white placeholder:text-slate-200" /></div>
              )}

              {videoStudyType && (
                <div className="w-full space-y-6 text-left mt-2">
                  {[
                    { label: 'Tópico:', mode: topicMode, setMode: setTopicMode, val: videoTopic, setVal: setVideoTopic, temp: tempTopic, setTemp: setTempTopic, list: currentSavedTopics, type: 'topic', dep: videoMatter },
                    { label: 'Subtópico 1:', mode: sub1Mode, setMode: setSub1Mode, val: videoSub1, setVal: setVideoSub1, temp: tempSub1, setTemp: setTempSub1, list: currentSavedSub1, type: 'sub1', dep: videoTopic },
                    { label: 'Subtópico 2 (Opcional):', mode: sub2Mode, setMode: setSub2Mode, val: videoSub2, setVal: setVideoSub2, temp: tempSub2, setTemp: setTempSub2, list: currentSavedSub2, type: 'sub2', dep: videoSub1 },
                    { label: 'Subtópico 3 (Opcional):', mode: sub3Mode, setMode: setSub3Mode, val: videoSub3, setVal: setVideoSub3, temp: tempSub3, setTemp: setTempSub3, list: currentSavedSub3, type: 'sub3', dep: videoSub2 }
                  ].map((field, idx) => {
                    const isStudyContext = selectedCategory?.label === 'Minhas vídeo aulas' || selectedCategory?.label === 'Minhas revisões' || selectedCategory?.label === 'Minhas questões';
                    const isBlocked = isStudyContext && (!field.dep || !field.dep.trim());

                    return (
                      <div key={field.label} className={`flex flex-col gap-2 ${isBlocked ? 'opacity-40 pointer-events-none' : ''}`}>
                        <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">{field.label}</label>
                        <div className="flex flex-col sm:flex-row items-start gap-3 w-full">
                          <select
                            value={field.mode}
                            onChange={(e) => field.setMode(e.target.value as any)}
                            className="flex-1 w-full sm:w-auto p-4 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white"
                          >
                            <option value="" disabled hidden>Selecione uma opção...</option>
                            <option value="add">+ Adicionar novo</option>
                            <option value="select">📁 Meus salvos</option>
                          </select>
                          {field.mode !== '' && (
                            <div className="flex-1 flex gap-2 items-center w-full">
                              {field.mode === 'add' ? (
                                <><input type="text" value={field.temp} onChange={(e) => field.setTemp(e.target.value)} placeholder="Novo..." className="flex-1 w-full p-4 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white placeholder:text-slate-200" /><button onClick={() => addNewSavedItem(field.type as any, field.temp)} className="px-6 py-4 bg-[#6279A8] text-white rounded-xl font-black text-sm shadow-sm hover:brightness-110 active:scale-95 transition-all shrink-0">OK</button></>
                              ) : (
                                <select value={field.val} onChange={(e) => field.setVal(e.target.value)} className="w-full p-4 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{field.list.map(t => <option key={t} value={t}>{t}</option>)}</select>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div className="relative w-full mt-8">
                    <button onClick={isFromActiveReview ? () => {
                      if (!reviewSubject.trim()) {
                        setErrorMsg("Por favor, preencha o assunto da revisão.");
                        setTimeout(() => setErrorMsg(null), 3000);
                        return;
                      }
                      if (!videoStudyType) {
                        setErrorMsg("Por favor, selecione para que você vai estudar.");
                        setTimeout(() => setErrorMsg(null), 3000);
                        return;
                      }
                      if (videoStudyType === 'ensino_medio') {
                        if (!videoDiscipline) {
                          setErrorMsg("Por favor, selecione a disciplina.");
                          setTimeout(() => setErrorMsg(null), 3000);
                          return;
                        }
                        const hasArea = ['Geografia', 'História', 'Português'].includes(videoDiscipline);
                        if (hasArea && !videoArea) {
                          setErrorMsg("Por favor, selecione a área.");
                          setTimeout(() => setErrorMsg(null), 3000);
                          return;
                        }
                        if (!videoMatter) {
                          setErrorMsg("Por favor, selecione a matéria.");
                          setTimeout(() => setErrorMsg(null), 3000);
                          return;
                        }
                      } else if (videoStudyType === 'faculdade') {
                        if (!videoMatter.trim()) {
                          setErrorMsg("Por favor, preencha o nome da matéria.");
                          setTimeout(() => setErrorMsg(null), 3000);
                          return;
                        }
                      }

                      if (!videoTopic) {
                        setErrorMsg("Por favor, preencha o assunto (tópico).");
                        setTimeout(() => setErrorMsg(null), 3000);
                        return;
                      }
                      if (!videoSub1) {
                        setErrorMsg("Por favor, preencha o subtópico 1.");
                        setTimeout(() => setErrorMsg(null), 3000);
                        return;
                      }

                      setView('addReviewFlashcardFront');
                    } : () => handleFinalizeStudyItem(true)} className="w-full py-5 rounded-[1.5rem] bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95">
                      {isFromActiveReview ? 'Próximo(1/2)' : 'Salvar'}
                    </button>
                    {(view === 'addVideoForm' || view === 'addReviewForm' || view === 'addQuestionForm') && sharedFormStep === 'study_details' && errorMsg && (
                      <p className="absolute bottom-[calc(100%+8px)] left-0 w-full text-center text-white font-black text-base py-3 px-4 bg-red-600 rounded-2xl animate-bounce shadow-2xl pointer-events-none">{errorMsg}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Adicionar Revisão Ativa - Fluxo de Flashcard */}
        {view === 'addReviewFlashcardFront' && (
          <div className="flex flex-col items-center gap-10 max-w-2xl mx-auto pt-10 animate-fadeIn">
            <div className="w-full text-center">
              <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-8 leading-loose">Defina a frente do seu flash card</h3>
              <textarea
                value={flashcardFront}
                onChange={(e) => setFlashcardFront(e.target.value)}
                placeholder="Digite a pergunta ou termo..."
                className="w-full p-6 border-[3px] border-black rounded-[2.5rem] font-bold text-lg outline-none shadow-xl bg-white text-slate-800 min-h-[150px] resize-none placeholder:text-slate-200"
              />
            </div>
            <button
              onClick={() => {
                if (!flashcardFront.trim()) {
                  setErrorMsg("Por favor, preencha a frente do flashcard.");
                  setTimeout(() => setErrorMsg(null), 3000);
                  return;
                }
                setView('addReviewFlashcardBack');
              }}
              className="w-full max-w-xs py-4 rounded-[2rem] bg-black text-white font-black text-lg shadow-2xl hover:scale-105 active:scale-95 transition-all"
            >
              Próximo(2/2)
            </button>
          </div>
        )}

        {view === 'addReviewFlashcardBack' && (
          <div className="animate-fadeIn max-w-5xl mx-auto pt-10">
            <h3 className="text-2xl font-black text-slate-800 uppercase tracking-widest mb-8 leading-loose text-center">Defina o verso do seu flash card (resposta)</h3>
            <div className="bg-white border-black border-black rounded-[3rem] shadow-2xl relative overflow-hidden">
              {/* Toolbar Estilo Notas */}
              <div className="bg-slate-50 border-b-2 border-black p-6 flex flex-wrap gap-4 gap-y-4 items-center rounded-t-[3rem] sticky top-0 z-[1100]">
                <div className="relative" ref={fontMenuRef}>
                  <button onMouseDown={(e) => { e.preventDefault(); setIsFontMenuOpen(!isFontMenuOpen); setIsFontSizeMenuOpen(false); setIsMarkersMenuOpen(false); }} className="bg-white border-black border-black rounded-xl px-4 py-2 min-w-[150px] flex justify-between items-center font-bold text-xs text-black shadow-sm">
                    {activeFont} <span className="ml-2 text-[10px]">▼</span>
                  </button>
                  {isFontMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white border-black border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">
                      {fonts.map(f => (
                        <button key={f.name} onMouseDown={(e) => { e.preventDefault(); execCommand('fontName', f.value); setIsFontMenuOpen(false); }} className={`w-full text-left px-5 py-3 text-sm hover:bg-slate-50 text-black border-b last:border-0 border-slate-100 ${activeFont.toLowerCase().includes(f.name.toLowerCase()) ? 'bg-slate-100' : ''}`} style={{ fontFamily: f.value }}>{f.name}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className={`w-10 h-10 border-black border-black rounded-xl flex items-center justify-center font-black text-lg transition-all shadow-sm ${activeBold ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}>B</button>
                <div className="flex bg-white border-black border-black rounded-xl overflow-hidden p-0.5 shadow-sm">
                  {[{ cmd: 'justifyLeft', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h10M4 18h16" /> }, { cmd: 'justifyCenter', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M7 12h10M4 18h16" /> }, { cmd: 'justifyRight', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M10 12h10M4 18h16" /> }].map(align => (
                    <button key={align.cmd} onMouseDown={(e) => { e.preventDefault(); execCommand(align.cmd); }} className={`p-2.5 rounded-lg transition-colors ${activeAlign === align.cmd ? 'bg-black text-white' : 'hover:bg-slate-100 text-black'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{align.icon}</svg></button>
                  ))}
                </div>
                <div className="relative" ref={markersMenuRef}>
                  <button onMouseDown={(e) => { e.preventDefault(); setIsMarkersMenuOpen(!isMarkersMenuOpen); setIsFontMenuOpen(false); setIsFontSizeMenuOpen(false); }} className={`px-5 py-2 border-black border-black rounded-xl flex items-center gap-3 font-black text-xs transition-all shadow-sm ${isMarkersMenuOpen ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>Simbolos</button>
                  {isMarkersMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-40 bg-white border-black border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">{markers.map(m => (<button key={m.name} onMouseDown={(e) => { e.preventDefault(); insertMarker(m.char); }} className="w-full text-left px-5 py-3 text-xl hover:bg-slate-50 transition-colors text-black flex items-center justify-between border-b last:border-0 border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase">{m.name}</span><span className="font-bold">{m.char}</span></button>))}</div>
                  )}
                </div>
                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                <div className="flex gap-2.5">{['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (<button key={c} onMouseDown={(e) => { e.preventDefault(); execCommand('foreColor', c); }} className={`w-7 h-7 rounded-full border-black transition-all hover:scale-125 shadow-sm ${activeColor === c ? 'border-black scale-125 ring-2 ring-slate-100' : 'border-white ring-1 ring-black/10'}`} style={{ backgroundColor: c }} />))}</div>
                <div className="relative" ref={fontSizeMenuRef}>
                  <button onMouseDown={(e) => { e.preventDefault(); setIsFontSizeMenuOpen(!isFontSizeMenuOpen); setIsFontMenuOpen(false); setIsMarkersMenuOpen(false); }} className="bg-white border-black border-black rounded-xl px-4 py-2 min-w-[140px] flex justify-between items-center font-bold text-xs text-black shadow-sm">
                    {fontSizes.find(s => s.value === activeSize)?.name || 'Tamanho'} <span className="ml-2 text-[10px]">▼</span>
                  </button>
                  {isFontSizeMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-44 bg-white border-black border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">{fontSizes.map(s => (<button key={s.value} onMouseDown={(e) => { e.preventDefault(); execCommand('fontSize', s.value); setIsFontSizeMenuOpen(false); }} className={`w-full text-left px-5 py-3 text-xs transition-all hover:bg-slate-50 text-black border-b last:border-0 border-slate-100 ${activeSize === s.value ? 'bg-slate-100' : ''}`}>{s.name}</button>))}</div>
                  )}
                </div>
                {/* Gallery / Image button */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); imageInputRef.current?.click(); }}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 flex items-center gap-1.5 font-bold text-xs text-black shadow-sm hover:bg-slate-100 transition-all"
                  title="Inserir imagem"
                >
                  <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Imagem
                </button>
              </div>
              {/* Hidden file input */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const src = ev.target?.result as string;
                    const id = `img-${Date.now()}`;
                    setFlashcardImages(prev => [...prev, { id, src, x: 40, y: 40, size: 180 }]);
                  };
                  reader.readAsDataURL(file);
                  e.target.value = '';
                }}
              />
              <div
                className="bg-white p-12 min-h-[500px] flex flex-col rounded-b-[3rem] relative"
                onClick={(e) => {
                  // Deselect image when clicking on the editor area (not on an image)
                  if ((e.target as HTMLElement).closest('[data-img-id]') === null) {
                    setSelectedImageId(null);
                  }
                }}
              >
                <div
                  ref={flashcardEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Digite a resposta ou explicação..."
                  onKeyUp={updateToolbarState}
                  onMouseUp={updateToolbarState}
                  onInput={(e) => setFlashcardBack(sanitizeHtml(e.currentTarget.innerHTML))}
                  className="flex-1 w-full outline-none text-2xl leading-relaxed prose prose-slate max-w-none focus:ring-0 text-slate-800 min-h-[300px] active-flashcard-editor"
                />
                {/* Draggable images - Word style */}
                {flashcardImages.map((img) => {
                  const isSelected = selectedImageId === img.id;
                  const handleSize = 9;
                  const corners = [
                    { id: 'nw', style: { top: -handleSize / 2, left: -handleSize / 2, cursor: 'nw-resize' } },
                    { id: 'ne', style: { top: -handleSize / 2, right: -handleSize / 2, cursor: 'ne-resize' } },
                    { id: 'sw', style: { bottom: -handleSize / 2, left: -handleSize / 2, cursor: 'sw-resize' } },
                    { id: 'se', style: { bottom: -handleSize / 2, right: -handleSize / 2, cursor: 'se-resize' } },
                  ];
                  return (
                    <div
                      key={img.id}
                      data-img-id={img.id}
                      style={{
                        position: 'absolute',
                        left: img.x,
                        top: img.y,
                        width: img.size,
                        userSelect: 'none',
                        zIndex: isSelected ? 60 : 50,
                        outline: isSelected ? '2px solid #4A69A2' : 'none',
                        borderRadius: 8,
                        pointerEvents: 'auto',
                        touchAction: 'none',
                      }}
                      onMouseDown={(e) => {
                        // Only drag by image body (not handles)
                        if ((e.target as HTMLElement).dataset.handle) return;
                        e.preventDefault();
                        e.stopPropagation();
                        setSelectedImageId(img.id);
                        setDraggingImageId(img.id);
                        setDragOffset({ x: e.clientX - img.x, y: e.clientY - img.y });
                      }}
                      onTouchStart={(e) => {
                        if ((e.target as HTMLElement).dataset.handle) return;
                        e.stopPropagation();
                        setSelectedImageId(img.id);
                        setDraggingImageId(img.id);
                        setDragOffset({ x: e.touches[0].clientX - img.x, y: e.touches[0].clientY - img.y });
                      }}
                      onClick={(e) => { e.stopPropagation(); setSelectedImageId(img.id); }}
                    >
                      <img
                        src={img.src}
                        alt=""
                        draggable={false}
                        style={{
                          width: '100%',
                          display: 'block',
                          borderRadius: 8,
                          cursor: 'move',
                          imageRendering: 'auto',
                          WebkitBackfaceVisibility: 'hidden',
                          backfaceVisibility: 'hidden',
                          transform: 'translateZ(0)', // Triggers hardware acceleration for smoother scaling
                        }}
                      />
                      {/* Delete button always visible on hover */}
                      <button
                        data-handle="delete"
                        onMouseDown={(e) => { e.stopPropagation(); setFlashcardImages(prev => prev.filter(i => i.id !== img.id)); setSelectedImageId(null); }}
                        style={{ position: 'absolute', top: 10, right: 10, width: 28, height: 28, borderRadius: '50%', background: '#ef4444', color: 'white', border: '2px solid white', cursor: 'pointer', display: isSelected ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', zIndex: 70, boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
                        title="Remover imagem"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                      </button>
                      {/* Resize handles - 4 corners */}
                      {isSelected && corners.map(c => (
                        <div
                          key={c.id}
                          data-handle={c.id}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setResizingImage({ id: img.id, startMouseX: e.clientX, startMouseY: e.clientY, startSize: img.size, startX: img.x, startY: img.y, corner: c.id });
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                            setResizingImage({ id: img.id, startMouseX: e.touches[0].clientX, startMouseY: e.touches[0].clientY, startSize: img.size, startX: img.x, startY: img.y, corner: c.id });
                          }}
                          style={{
                            position: 'absolute',
                            width: handleSize,
                            height: handleSize,
                            background: 'white',
                            border: '2px solid #4A69A2',
                            borderRadius: 2,
                            zIndex: 70,
                            touchAction: 'none',
                            ...c.style,
                          }}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
              <div className="bg-slate-50 border-t-2 border-black p-4 sm:p-8 flex flex-col sm:flex-row justify-center gap-4 sm:gap-6 rounded-b-[3rem]">
                <button
                  onClick={() => handleFinalizeStudyItem(false)}
                  className="w-full sm:w-auto bg-white text-black border-2 border-black px-6 py-3 sm:px-8 sm:py-4 rounded-[2rem] font-black text-base sm:text-xl shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  Salvar flash card
                </button>
                <button
                  onClick={() => handleFinalizeStudyItem(true)}
                  className="w-full sm:w-auto bg-black text-white px-8 py-3 sm:px-12 sm:py-4 rounded-[2rem] font-black text-base sm:text-xl shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-black/20"
                >
                  Finalizar
                </button>
              </div>
            </div>
            {/* Drag & Resize overlay */}
            {(draggingImageId || resizingImage) && (
              <div
                className="fixed inset-0 z-[9999]"
                style={{ cursor: draggingImageId ? 'move' : resizingImage ? `${resizingImage.corner}-resize` : 'default', touchAction: 'none' }}
                onMouseMove={(e) => {
                  if (draggingImageId) {
                    setFlashcardImages(prev => prev.map(i =>
                      i.id === draggingImageId ? { ...i, x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y } : i
                    ));
                  } else if (resizingImage) {
                    const dx = e.clientX - resizingImage.startMouseX;
                    const dy = e.clientY - resizingImage.startMouseY;
                    const delta = resizingImage.corner === 'se' ? (dx + dy) / 2
                      : resizingImage.corner === 'sw' ? (-dx + dy) / 2
                        : resizingImage.corner === 'ne' ? (dx - dy) / 2
                          : (-dx - dy) / 2; // nw
                    const newSize = Math.max(40, Math.min(800, resizingImage.startSize + delta));
                    const sizeDiff = newSize - resizingImage.startSize;
                    const newX = (resizingImage.corner === 'nw' || resizingImage.corner === 'sw') ? resizingImage.startX - sizeDiff : resizingImage.startX;
                    const newY = (resizingImage.corner === 'nw' || resizingImage.corner === 'ne') ? resizingImage.startY - sizeDiff : resizingImage.startY;
                    setFlashcardImages(prev => prev.map(i =>
                      i.id === resizingImage.id ? { ...i, size: Math.round(newSize), x: Math.round(newX), y: Math.round(newY) } : i
                    ));
                  }
                }}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  if (draggingImageId) {
                    setFlashcardImages(prev => prev.map(i =>
                      i.id === draggingImageId ? { ...i, x: touch.clientX - dragOffset.x, y: touch.clientY - dragOffset.y } : i
                    ));
                  } else if (resizingImage) {
                    const dx = touch.clientX - resizingImage.startMouseX;
                    const dy = touch.clientY - resizingImage.startMouseY;
                    const delta = resizingImage.corner === 'se' ? (dx + dy) / 2
                      : resizingImage.corner === 'sw' ? (-dx + dy) / 2
                        : resizingImage.corner === 'ne' ? (dx - dy) / 2
                          : (-dx - dy) / 2; // nw
                    const newSize = Math.max(40, Math.min(800, resizingImage.startSize + delta));
                    const sizeDiff = newSize - resizingImage.startSize;
                    const newX = (resizingImage.corner === 'nw' || resizingImage.corner === 'sw') ? resizingImage.startX - sizeDiff : resizingImage.startX;
                    const newY = (resizingImage.corner === 'nw' || resizingImage.corner === 'ne') ? resizingImage.startY - sizeDiff : resizingImage.startY;
                    setFlashcardImages(prev => prev.map(i =>
                      i.id === resizingImage.id ? { ...i, size: Math.round(newSize), x: Math.round(newX), y: Math.round(newY) } : i
                    ));
                  }
                }}
                onMouseUp={() => { setDraggingImageId(null); setResizingImage(null); }}
                onTouchEnd={() => { setDraggingImageId(null); setResizingImage(null); }}
                onTouchCancel={() => { setDraggingImageId(null); setResizingImage(null); }}
              />
            )}
          </div>
        )}

        {/* Simulados e Livros (Mantidos como estavam) */}
        {view === 'addSimuladoForm' && (() => {
          const isFixedQty = ['Natureza', 'Linguagem', 'Humanas', 'Exatas', 'Todo o primeiro dia', 'Todo o segundo dia'].includes(simArea || '');
          const isFixedDur = ['Todo o primeiro dia', 'Todo o segundo dia'].includes(simArea || '');

          return (
            <div className="flex flex-col items-center gap-12 w-full max-w-4xl mx-auto pt-4 pb-12">
              <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-xl">🏷️</span><label className="text-lg font-black text-black">Esse simulado é do:</label></div><div className="flex justify-center gap-3">{['ENEM', 'Vestibulares', 'Faculdade'].map((origin) => (<button key={origin} onClick={() => {
                setSimOrigin(origin as any);
                setSimYear('');
                setSimType('');
                setSimArea('');
                setSimTestColorName('');
                setSimVestName('');
                setSimSubject('');
                setSimQty(0);
                setSimDurH(0);
                setSimDurM(0);
              }} className={`px-8 py-3 rounded-2xl font-black text-sm border-2 transition-all shadow-sm ${simOrigin === origin ? 'bg-black text-white border-black' : 'bg-white text-black border-black/10 hover:bg-slate-50'}`}>{origin}</button>))}</div></div>
              {simOrigin && (
                <div className="w-full flex flex-wrap justify-center gap-6 transition-all duration-500 ease-in-out">
                  <div className="flex flex-col min-w-[140px] animate-fadeIn">
                    <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Ano</label>
                    <select
                      value={simYear || ''}
                      onChange={(e) => setSimYear(e.target.value)}
                      className="p-4 rounded-2xl border-2 border-black/10 font-black text-slate-800 outline-none bg-white shadow-sm appearance-none text-center cursor-pointer hover:border-black/20 transition-all w-full"
                    >
                      <option value="" disabled hidden>Selecione...</option>
                      {Array.from({ length: 2026 - 2009 + 1 }, (_, i) => 2026 - i).map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>

                  {simOrigin === 'ENEM' && simYear && (
                    <div className="flex flex-col min-w-[160px] animate-fadeIn">
                      <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Tipo</label>
                      <select
                        value={simType || ''}
                        onChange={(e) => setSimType(e.target.value)}
                        className="p-4 rounded-2xl border-2 border-black/10 font-black text-slate-800 outline-none bg-white shadow-sm appearance-none text-center cursor-pointer hover:border-black/20 transition-all w-full"
                      >
                        <option value="" disabled hidden>Selecione...</option>
                        {['Aplicação regular', 'PPL', 'Libras'].map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  )}

                  {((simOrigin === 'ENEM' && simType) || (simOrigin === 'Vestibulares' && simYear)) && (
                    <div className="flex flex-col min-w-[180px] animate-fadeIn">
                      <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Área</label>
                      <select
                        value={simArea || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSimArea(val);
                          if (['Natureza', 'Linguagem', 'Humanas', 'Exatas'].includes(val)) {
                            setSimQty(45);
                          } else if (val === 'Todo o primeiro dia') {
                            setSimQty(90);
                            setSimDurH(5);
                            setSimDurM(30);
                          } else if (val === 'Todo o segundo dia') {
                            setSimQty(90);
                            setSimDurH(5);
                            setSimDurM(0);
                          }
                        }}
                        className="p-4 rounded-2xl border-2 border-black/10 font-black text-slate-800 outline-none bg-white shadow-sm appearance-none text-center cursor-pointer hover:border-black/20 transition-all w-full"
                      >
                        <option value="" disabled hidden>Selecione...</option>
                        {['Natureza', 'Linguagem', 'Humanas', 'Exatas', 'Todo o primeiro dia', 'Todo o segundo dia'].map(a => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                  )}

                  {simOrigin === 'ENEM' && simArea && (
                    <div className="flex flex-col min-w-[160px] animate-fadeIn">
                      <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Cor da prova</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={simTestColorName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSimTestColorName(val);
                            const detected = resolveColorFromText(val);
                            if (detected) {
                              setDetectedColorName(detected.name);
                              setDynamicPalette(prev => prev.includes(detected.hex) ? prev : [...prev, detected.hex]);
                              setSimColor(detected.hex);
                            } else {
                              setDetectedColorName(null);
                            }
                          }}
                          placeholder="Ex: Azul.."
                          className="p-4 rounded-2xl border-2 border-black/10 font-black text-slate-800 outline-none bg-white shadow-sm placeholder:text-slate-300 text-center w-full transition-all hover:border-black/20"
                        />
                      </div>
                    </div>
                  )}

                  {simOrigin === 'Vestibulares' && simArea && (
                    <div className="flex flex-col min-w-[200px] animate-fadeIn">
                      <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Nome do vestibular</label>
                      <input
                        type="text"
                        value={simVestName}
                        onChange={(e) => setSimVestName(e.target.value)}
                        placeholder="Ex: USP, UNESP..."
                        className="p-4 rounded-2xl border-2 border-black/10 font-black text-slate-800 outline-none bg-white shadow-sm placeholder:text-slate-300 text-center hover:border-black/20 transition-all w-full"
                      />
                    </div>
                  )}

                  {simOrigin === 'Faculdade' && simYear && (
                    <div className="flex flex-col min-w-[220px] animate-fadeIn">
                      <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center uppercase">Assunto da prova</label>
                      <input
                        type="text"
                        value={simSubject}
                        onChange={(e) => setSimSubject(e.target.value)}
                        placeholder="Ex: Anatomia, Cálculo I..."
                        className="p-4 rounded-2xl border-2 border-black/10 font-black text-slate-800 outline-none bg-white shadow-sm placeholder:text-slate-300 text-center w-full hover:border-black/20 transition-all"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="w-full flex flex-col gap-12 animate-fadeIn">
                <div className="w-full text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <label className="text-lg font-black text-black">Quantas questões tem esse simulado?</label>
                  </div>
                  <div className="flex items-center justify-center gap-8">
                    <button disabled={isFixedQty} onClick={() => setSimQty(Math.max(0, (simQty || 0) - 1))} className={`${numericBtnClass} ${isFixedQty ? 'opacity-50 cursor-not-allowed' : ''}`}>-</button>
                    <div className="flex flex-col items-center border-b-2 border-black/10 pb-1 min-w-[120px] justify-center">
                      <input disabled={isFixedQty} type="number" value={simQty === undefined ? '' : simQty} onFocus={() => !isFixedQty && setSimQty(undefined)} onBlur={() => { if (!isFixedQty && simQty === undefined) setSimQty(0); }} onChange={(e) => !isFixedQty && setSimQty(parseInt(e.target.value) || 0)} className={`w-20 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none`} />
                      <span className="text-xs font-black text-[#4A69A2] uppercase">questões</span>
                    </div>
                    <button disabled={isFixedQty} onClick={() => setSimQty((simQty || 0) + 1)} className={`${numericBtnClass} ${isFixedQty ? 'opacity-50 cursor-not-allowed' : ''}`}>+</button>
                  </div>
                </div>

                <div className="w-full text-center">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <label className="text-lg font-black text-black">Qual a duração do seu simulado?</label>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-3">
                      <button disabled={isFixedDur} onClick={() => setSimDurH(Math.max(0, (simDurH || 0) - 1))} className={`${numericBtnClass} ${isFixedDur ? 'opacity-50 cursor-not-allowed' : ''}`}>-</button>
                      <div className="flex flex-col border-b-2 border-black/10 min-w-[70px]">
                        <input disabled={isFixedDur} type="number" value={simDurH === undefined ? '' : simDurH} onFocus={() => !isFixedDur && setSimDurH(undefined)} onBlur={() => { if (!isFixedDur && simDurH === undefined) setSimDurH(0); }} onChange={(e) => !isFixedDur && setSimDurH(parseInt(e.target.value) || 0)} className={`w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none`} />
                        <span className="text-[10px] uppercase font-black text-[#4A69A2]">horas</span>
                      </div>
                      <button disabled={isFixedDur} onClick={() => setSimDurH((simDurH || 0) + 1)} className={`${numericBtnClass} ${isFixedDur ? 'opacity-50 cursor-not-allowed' : ''}`}>+</button>
                    </div>
                    <div className="flex items-center gap-3">
                      <button disabled={isFixedDur} onClick={() => setSimDurM(Math.max(0, (simDurM || 0) - 1))} className={`${numericBtnClass} ${isFixedDur ? 'opacity-50 cursor-not-allowed' : ''}`}>-</button>
                      <div className="flex flex-col border-b-2 border-black/10 min-w-[70px]">
                        <input disabled={isFixedDur} type="number" value={simDurM === undefined ? '' : simDurM} onFocus={() => !isFixedDur && setSimDurM(undefined)} onBlur={() => { if (!isFixedDur && simDurM === undefined) setSimDurM(0); }} onChange={(e) => !isFixedDur && setSimDurM(parseInt(e.target.value) || 0)} className={`w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none`} />
                        <span className="text-[10px] uppercase font-black text-[#4A69A2]">minutos</span>
                      </div>
                      <button disabled={isFixedDur} onClick={() => setSimDurM(Math.min(59, (simDurM || 0) + 1))} className={`${numericBtnClass} ${isFixedDur ? 'opacity-50 cursor-not-allowed' : ''}`}>+</button>
                    </div>
                  </div>
                </div>

                <div className="w-full text-center">
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                    </svg>
                    <label className="text-lg font-black text-black">Escolha uma cor para ele:</label>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {dynamicPalette.map(color => {
                      const isSelected = simColor === color;
                      const isDimmed = !!detectedColorName && !isSelected;
                      return (
                        <button key={color} onClick={() => { setSimColor(color); setDetectedColorName(null); }} className={`w-7 h-7 rounded-full border-black transition-all shadow-sm ${isSelected ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color, opacity: isDimmed ? 0.25 : 1, filter: isDimmed ? 'grayscale(100%)' : 'none' }} />
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="relative w-full">
                <button onClick={handleAddSimulado} className="w-full py-5 rounded-3xl bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95">Salvar</button>
                {view === 'addSimuladoForm' && errorMsg && (
                  <p className="absolute bottom-[calc(100%+8px)] left-0 w-full text-center text-white font-black text-base py-3 px-4 bg-red-600 rounded-2xl animate-bounce shadow-2xl pointer-events-none">{errorMsg}</p>
                )}
              </div>
            </div>
          );
        })()}

        {view === 'addBookForm' && (
          <div className="flex flex-col items-center gap-12 w-full max-w-2xl mx-auto pt-6" id="addBookForm">
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg><label className="text-lg font-black text-black">Nome do livro:</label></div><input type="text" value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="Digite o nome do livro..." className="w-full p-4 rounded-2xl border-2 border-black/10 bg-white text-slate-800 font-bold placeholder:text-slate-300 outline-none shadow-sm" /></div>
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></svg><label className="text-lg font-black text-black">Este livro é:</label></div><div className="flex border-2 border-black/10 rounded-2xl overflow-hidden bg-white shadow-sm"><button onClick={() => setBookType('didatico')} className={`flex-1 py-4 font-black transition-all ${bookType === 'didatico' ? 'bg-black text-white border-black' : 'text-slate-800'}`}>Livro didático</button><button onClick={() => setBookType('outro')} className={`flex-1 py-4 font-black transition-all ${bookType === 'outro' ? 'bg-black text-white border-black' : 'text-slate-800'}`}>Outro tipo</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg><label className="text-lg font-black text-black">Tempo de término do livro (estimativa)</label></div><div className="flex items-center justify-center gap-8"><button onClick={() => setEstimateDays(prev => Math.max(0, (prev || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col items-center"><input type="number" value={estimateDays === undefined ? '' : estimateDays} onFocus={() => setEstimateDays(undefined)} onBlur={() => { if (estimateDays === undefined) setEstimateDays(0); }} onChange={(e) => setEstimateDays(parseInt(e.target.value) || 0)} className="w-20 text-center text-3xl font-black text-black bg-transparent border-none outline-none appearance-none" /><div className="h-0.5 w-16 bg-[#4A69A2] mb-1"></div><span className="text-lg font-black text-[#4A69A2]">dias</span></div><button onClick={() => setEstimateDays(prev => Math.min(730, (prev || 0) + 1))} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg><label className="text-lg font-black text-black">Quantas páginas esse livro tem?</label></div><div className="flex items-center justify-center gap-8"><button onClick={() => setTotalPages(prev => Math.max(0, (prev || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col items-center"><input type="number" value={totalPages === undefined ? '' : totalPages} onFocus={() => setTotalPages(undefined)} onBlur={() => { if (totalPages === undefined) setTotalPages(0); }} onChange={(e) => setTotalPages(parseInt(e.target.value) || 0)} className="w-24 text-center text-3xl font-black text-black bg-transparent border-none outline-none appearance-none" /><div className="h-0.5 w-20 bg-[#4A69A2] mb-1"></div><span className="text-xs font-black text-[#4A69A2]">páginas</span></div><button onClick={() => setTotalPages(prev => Math.min(1000, (prev || 0) + 1))} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg><label className="text-lg font-black text-black">Grau de relevância:</label></div><div className="flex flex-wrap justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setBookRelevance(rel)} className={getRelevanceBtnClass(rel, bookRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><svg className="w-6 h-6 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg><label className="text-lg font-black text-black">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-3">{colorPalette.map(color => (<button key={color} onClick={() => setSelectedColor(color)} className={`w-8 h-8 rounded-full border-black transition-all shadow-sm ${selectedColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <div className="relative w-full mt-4">
              <button onClick={handleAddBook} className="w-full py-5 rounded-3xl bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95">Salvar</button>
              {view === 'addBookForm' && errorMsg && (
                <p className="absolute bottom-[calc(100%+8px)] left-0 w-full text-center text-white font-black text-base py-3 px-4 bg-red-600 rounded-2xl animate-bounce shadow-2xl pointer-events-none">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {view === 'addPdfForm' && (
          <div className="flex flex-col items-center gap-10 w-full max-w-2xl mx-auto pt-4" id="addPdfForm">
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-2"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg><label className="text-lg font-black text-black">Assunto do PDF:</label></div><input type="text" value={pdfSubject} onChange={(e) => setPdfSubject(e.target.value)} placeholder="Digite o assunto do PDF..." className="w-full p-4 rounded-2xl border-2 border-black/20 bg-white text-slate-800 font-bold outline-none shadow-sm" /></div>
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-2"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg><label className="text-lg font-black text-black">Tipo de material:</label></div><div className="flex border-2 border-black/20 rounded-2xl overflow-hidden bg-white"><button onClick={() => setPdfType('didatico')} className={`flex-1 py-3 font-black transition-all ${pdfType === 'didatico' ? 'bg-black text-white border-black' : 'text-slate-800'}`}>Didático</button><button onClick={() => setPdfType('outro')} className={`flex-1 py-3 font-black transition-all ${pdfType === 'outro' ? 'bg-black text-white border-black' : 'text-slate-800'}`}>Outro tipo</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-2"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" /></svg><label className="text-lg font-black text-black">Quantas páginas esse PDF tem?</label></div><div className="flex items-center justify-center gap-6"><button onClick={() => setPdfPages(prev => Math.max(0, (prev || 0) - 1))} className="w-10 h-10 rounded-xl bg-[#7EB1FF] border-black border-[#7EB1FF] flex items-center justify-center text-white font-black text-xl hover:brightness-110 transition-all active:scale-95 shadow-sm">-</button><div className="flex flex-col items-center"><input type="text" inputMode="numeric" value={pdfPages === undefined ? '' : pdfPages} onFocus={() => setPdfPages(undefined)} onBlur={() => { if (pdfPages === undefined) setPdfPages(0); }} onChange={(e) => { const value = e.target.value.replace(/\D/g, ''); setPdfPages(value === '' ? undefined : parseInt(value)); }} className="w-20 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none" /><div className="h-0.5 w-16 bg-[#4A69A2] -mt-1"></div><span className="text-[10px] font-black text-[#4A69A2] mt-1 uppercase">páginas</span></div><button onClick={() => setPdfPages(prev => Math.min(2000, (prev || 0) + 1))} className="w-10 h-10 rounded-xl bg-[#7EB1FF] border-black border-[#7EB1FF] flex items-center justify-center text-white font-black text-xl hover:brightness-110 transition-all active:scale-95 shadow-sm">+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg><label className="text-lg font-black text-black">Qual o grau de relevância?</label></div><div className="flex flex-wrap justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setPdfRelevance(rel)} className={getRelevanceBtnClass(rel, pdfRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg><label className="text-lg font-black text-black">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setPdfColor(color)} className={`w-7 h-7 rounded-full border-black transition-all shadow-sm ${pdfColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <div className="relative w-full mt-2">
              <button onClick={handleAddPdf} className="w-full py-5 rounded-[2rem] bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2]">Salvar</button>
              {view === 'addPdfForm' && errorMsg && (
                <p className="absolute bottom-[calc(100%+8px)] left-0 w-full text-center text-white font-black text-base py-3 px-4 bg-red-600 rounded-2xl animate-bounce shadow-2xl pointer-events-none">{errorMsg}</p>
              )}
            </div>
          </div>
        )}

        {view === 'sessionType' && (
          <div className="flex flex-col items-center justify-center gap-8 pt-10 animate-fadeIn">
            <h2 className={`text-3xl font-black ${textColor} mb-6 text-center`}>Escolha o tipo de sessão</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
              {/* Com contabilização de dados */}
              <button
                onClick={() => setView('studyMaterialSelect')}
                className="group bg-white border-2 border-[#7EB1FF]/30 rounded-[2rem] p-10 flex flex-col items-center gap-5 shadow-[0_20px_40px_rgba(0,0,0,0.15)] hover:bg-[#7EB1FF] hover:border-transparent hover:shadow-[0_30px_60px_rgba(0,0,0,0.25)] transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="relative">
                  <svg className="w-12 h-12 text-slate-800 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                  </svg>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-slate-800 group-hover:bg-white rounded-full flex items-center justify-center shadow transition-all duration-300">
                    <svg className="w-3.5 h-3.5 text-white group-hover:text-[#7EB1FF] transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
                <span className="text-lg font-black text-slate-800 group-hover:text-white transition-colors text-center leading-tight">Com contabilização de dados</span>
              </button>

              {/* Sem contabilização de dados */}
              <button
                onClick={() => {
                  setSelectedStudyItem(null);
                  setView('sessionTypeChoice');
                }}
                className="group bg-white border-2 border-[#7EB1FF]/30 rounded-[2rem] p-10 flex flex-col items-center gap-5 shadow-[0_20px_40px_rgba(0,0,0,0.15)] hover:bg-[#7EB1FF] hover:border-transparent hover:shadow-[0_30px_60px_rgba(0,0,0,0.25)] transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <svg className="w-12 h-12 text-slate-800 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 2.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                </svg>
                <span className="text-lg font-black text-slate-800 group-hover:text-white transition-colors text-center leading-tight">Sem contabilização de dados</span>
              </button>
            </div>
          </div>
        )}

        {view === 'studyMaterialSelect' && (
          <div className="flex flex-col items-center justify-center gap-8 pt-10 animate-fadeIn">
            <div className="text-center mb-2">
              <h2 className={`text-3xl font-black ${textColor}`}>O que você vai estudar?</h2>
              <p className="text-slate-500 font-bold mt-2">Selecione o tipo de material para contabilizar o progresso.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 w-full max-w-2xl">
              {[
                {
                  label: 'Livro',
                  cat: categories.find(c => c.label === 'Meus livros')!,
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                },
                {
                  label: 'PDF',
                  cat: categories.find(c => c.label === "Meus PDF's")!,
                  icon: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4h11l5 5v13H4V4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 4v5h5" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 14h10M7 18.5h10" /></>
                },
                {
                  label: 'Video Aula',
                  cat: categories.find(c => c.label === 'Minhas vídeo aulas')!,
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                },
                {
                  label: 'Revisão',
                  cat: categories.find(c => c.label === 'Minhas revisões')!,
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                },
                {
                  label: 'Questões',
                  cat: categories.find(c => c.label === 'Minhas questões')!,
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                },
                {
                  label: 'Simulado',
                  cat: categories.find(c => c.label === 'Meus simulados')!,
                  icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.125 2.25h-4.5c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125v-9M10.125 2.25h.375a9 9 0 0 1 9 9v.375M10.125 2.25A3.375 3.375 0 0 1 13.5 5.625v1.875c0 .621.504 1.125 1.125 1.125H18M9 12.75l1.5 1.5 3-3" />
                },
              ].map(({ label, cat, icon }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (!cat) return;
                    setIsFromActiveReview(false);
                    setIsFromStudyMaterialSelect(true);
                    setSelectedCategory(cat);
                    if (cat.label === 'Minhas vídeo aulas' || cat.label === 'Minhas revisões' || cat.label === 'Minhas questões' || cat.label === 'Meus simulados') {
                      setStandardBankMode(cat.label === 'Meus simulados' ? 'simulados' : 'ensino_medio');
                      setStandardBankStep(cat.label === 'Meus simulados' ? 'sim_origins' : 'disciplines');
                      setStandardBankPath([]);
                    }
                    setView('myBank');
                  }}
                  className="group bg-white border-2 border-[#7EB1FF]/30 rounded-[1.75rem] p-7 flex flex-col items-center gap-4 shadow-[0_15px_30px_rgba(0,0,0,0.12)] hover:border-transparent hover:bg-[#7EB1FF] hover:shadow-[0_25px_50px_rgba(0,0,0,0.2)] transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#EEF4FF] group-hover:bg-white/20 flex items-center justify-center transition-colors">
                    <svg className="w-8 h-8 text-[#4A69A2] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {icon}
                    </svg>
                  </div>
                  <span className="text-base font-black text-slate-800 group-hover:text-white transition-colors">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ===== TIPO DE SESSÃO ===== */}
        {view === 'sessionTypeChoice' && (
          <div className="flex flex-col items-center justify-center gap-10 pt-10 animate-fadeIn">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-2">Tipo de Sessão</h2>
              <p className="text-slate-500 font-bold">Como você quer estudar {selectedStudyItem?.name ?? ''}?</p>
            </div>
            <div className="grid grid-cols-2 gap-6 w-full max-w-lg">
              <button
                onClick={() => setView('sessionUnique')}
                className="group bg-white border-black border-slate-100 rounded-[2rem] p-8 flex flex-col items-center gap-4 shadow-md hover:border-[#7EB1FF] hover:bg-[#7EB1FF] hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="w-16 h-16 flex items-center justify-center">
                  <svg className="w-11 h-11 text-[#4A69A2] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                </div>
                <span className="text-xl font-black text-slate-800 group-hover:text-white transition-colors">Sessão Única</span>
              </button>
              <button
                onClick={() => setView('sessionPomodoro')}
                className="group bg-white border-black border-slate-100 rounded-[2rem] p-8 flex flex-col items-center gap-4 shadow-md hover:border-[#7EB1FF] hover:bg-[#7EB1FF] hover:shadow-xl transition-all duration-300 hover:scale-105 active:scale-95"
              >
                <div className="w-16 h-16 relative flex items-center justify-center">
                  <svg className="w-11 h-11 text-[#4A69A2] group-hover:text-white transition-colors" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Stem */}
                    <path d="M12 2C12 2 12 5 12 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    {/* Leaf */}
                    <path d="M12 5C14.5 3 17 3.5 17 3.5C17 3.5 16.5 6 14 7C12 7.5 12 6 12 6" fill="currentColor" opacity="0.9" />
                    <path d="M12 5C9.5 3 7 3.5 7 3.5C7 3.5 7.5 6 10 7C12 7.5 12 6 12 6" fill="currentColor" opacity="0.9" />
                    {/* Tomato body */}
                    <path d="M12 7C7.5 7 3 10.5 3 14.5C3 18.5 7 22 12 22C17 22 21 18.5 21 14.5C21 10.5 16.5 7 12 7Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
                    {/* Tomato sections */}
                    <path d="M12 7V22" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
                    <path d="M7.5 8C6 11 6 18 8.5 21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
                    <path d="M16.5 8C18 11 18 18 15.5 21" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
                  </svg>
                </div>
                <span className="text-xl font-black text-slate-800 group-hover:text-white transition-colors">Pomodoro</span>
              </button>
            </div>
          </div>
        )}

        {/* ===== SESSÃO ÚNICA ===== */}
        {view === 'sessionUnique' && (
          <div className="flex flex-col items-center justify-center gap-8 pt-10 animate-fadeIn">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-2">Sessão Única</h2>
              <p className="text-slate-500 font-bold">Escolha o tipo de duração para sua sessão</p>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-lg">
              <button onClick={() => setView('sessionPreDefined')} className="group bg-white border-black border-[#7EB1FF] rounded-[1.75rem] p-6 flex flex-col items-center gap-2 shadow-md hover:bg-[#7EB1FF] hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-95">
                <svg className="w-10 h-10 text-[#4A69A2] group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
                </svg>
                <span className="text-lg font-black text-slate-800 group-hover:text-white transition-colors">Duração Pré-definida</span>
                <span className="text-sm font-bold text-slate-500 group-hover:text-white/80 transition-colors">Escolha entre tempos recomendados</span>
              </button>
              <button onClick={() => setView('sessionCustomDuration')} className="group bg-white border-black border-[#7EB1FF] rounded-[1.75rem] p-6 flex flex-col items-center gap-2 shadow-md hover:bg-[#7EB1FF] hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-95">
                <div className="w-16 h-10 flex items-center justify-center gap-0 text-[#4A69A2] group-hover:text-white transition-colors">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                  </svg>
                  <svg className="w-6 h-6 -ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <span className="text-lg font-black text-slate-800 group-hover:text-white transition-colors">Duração Personalizada</span>
                <span className="text-sm font-bold text-slate-500 group-hover:text-white/80 transition-colors">Defina o tempo exato que deseja</span>
              </button>
            </div>
          </div>
        )}

        {/* ===== DURAÇÃO PRÉ-DEFINIDA ===== */}
        {view === 'sessionPreDefined' && (
          <div className="flex flex-col items-center justify-center gap-8 pt-10 animate-fadeIn w-full max-w-lg mx-auto">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-2">Duração Pré-definida</h2>
              <p className="text-slate-400 font-bold">Selecione uma das opções pré-definidas</p>
            </div>
            <div className="flex flex-col gap-4 w-full">
              {[
                { label: 'Sessão Leve', duration: '25 min', minutes: 25 },
                { label: 'Sessão Moderada', duration: '40 min', minutes: 40 },
                { label: 'Sessão Pesada', duration: '1 hora', minutes: 60 },
                { label: 'Sessão Intensa', duration: '1h 30min', minutes: 90 },
                { label: 'Sessão Maratona', duration: '2 horas', minutes: 120 },
                { label: 'Sessão Muito Intensa', duration: '2h 30min', minutes: 150 },
                { label: 'Sessão Hard', duration: '3 horas', minutes: 180 },
              ].map((option) => (
                <button
                  key={option.label}
                  onClick={() => {
                    const totalSecs = option.minutes * 60;
                    setTotalSessionSeconds(totalSecs);
                    setTimerSeconds(totalSecs);
                    setIsTimerRunning(false);
                    setView('sessionTimerActive');
                  }}
                  className="bg-white border border-slate-200 rounded-2xl px-8 py-5 flex flex-col items-center gap-1 shadow-sm hover:border-[#7EB1FF] hover:shadow-md transition-all duration-200 hover:scale-[1.01] active:scale-95"
                >
                  <span className="text-xl font-black text-slate-800">{option.label}</span>
                  <span className="text-sm font-bold text-slate-400">{option.duration}</span>
                </button>
              ))}
            </div>
          </div>
        )}



        {/* ===== DURAÇÃO PERSONALIZADA ===== */}
        {view === 'sessionCustomDuration' && (
          <div className="flex flex-col items-center justify-center gap-8 pt-8 animate-fadeIn w-full max-w-lg mx-auto">
            <div className="text-center">
              <h2 className="text-4xl font-black text-black mb-2">Duração Personalizada</h2>
              <p className="text-slate-400 font-bold">Defina o tempo exato da sua sessão</p>
            </div>

            <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-black text-black">Tempo de Estudo</span>
                <div className="flex items-center gap-1.5">
                  {/* H */}
                  <div className="flex flex-col items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setCustomDurationH(h => Math.min(8, h + 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-800 py-0.5">{customDurationH}</span>
                    <button onClick={() => setCustomDurationH(h => Math.max(0, h - 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-400">h</span>
                  {/* M */}
                  <div className="flex flex-col items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setCustomDurationM(m => Math.min(59, m + 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-800 py-0.5">{customDurationM}</span>
                    <button onClick={() => setCustomDurationM(m => Math.max(0, m - 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-400">m</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><span>Horas</span><span>{customDurationH}H</span></div>
                  <input type="range" min={0} max={8} value={customDurationH} onChange={e => setCustomDurationH(+e.target.value)} className="w-full h-2 accent-[#4A69A2] rounded-full cursor-pointer" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><span>Minutos</span><span>{customDurationM}M</span></div>
                  <input type="range" min={0} max={59} value={customDurationM} onChange={e => setCustomDurationM(+e.target.value)} className="w-full h-2 accent-[#4A69A2] rounded-full cursor-pointer" />
                </div>
              </div>
            </div>

            <button
              disabled={customDurationH === 0 && customDurationM === 0}
              onClick={() => {
                const totalSecs = customDurationH * 3600 + customDurationM * 60;
                setTotalSessionSeconds(totalSecs);
                setTimerSeconds(totalSecs);
                setIsTimerRunning(false);
                setView('sessionTimerActive');
              }}
              className={`w-full py-4 font-black text-lg rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95 ${customDurationH === 0 && customDurationM === 0
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                : 'bg-[#4A69A2] hover:bg-[#3a5490] text-white'
                }`}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              Iniciar Sessão
            </button>
          </div>
        )}

        {/* ===== TELA DO TIMER ATIVO ===== */}
        {view === 'sessionTimerActive' && (
          <div className="flex flex-col items-center justify-center gap-6 pt-2 animate-fadeIn">
            <div className="text-center">
              <h2 className="text-3xl font-black text-black mb-1">Hora de Estudar</h2>
              <p className="text-slate-500 font-bold text-sm">Mantenha o foco e elimine distrações</p>
            </div>

            <div className="relative transition-all duration-500 flex items-center justify-center w-[200px] h-[200px] sm:w-[300px] sm:h-[300px]">
              {/* Círculo de progresso */}
              <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 300 300">
                <circle
                  cx={150}
                  cy={150}
                  r={132}
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  className="text-slate-100"
                />
                <circle
                  cx={150}
                  cy={150}
                  r={132}
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={2 * Math.PI * 132}
                  strokeDashoffset={2 * Math.PI * 132 * (1 - timerSeconds / (totalSessionSeconds || 1))}
                  strokeLinecap="round"
                  className="text-[#4A69A2] transition-all duration-500"
                />
              </svg>

              <div className="flex flex-col items-center z-10 px-2 text-center">
                <span className="text-slate-400 font-black text-[9px] sm:text-xs tracking-wider uppercase mb-1 sm:mb-2">Tempo Restante</span>
                <span className="font-bold text-slate-900 leading-none tabular-nums text-4xl sm:text-5xl">
                  {formatTime(timerSeconds)}
                </span>
                <span className="mt-2 sm:mt-3 px-3 sm:px-4 py-1 bg-slate-100 text-slate-500 text-[10px] sm:text-sm font-black rounded-full">
                  {isTimerRunning ? 'Focado' : 'Pausado'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
              <button
                onClick={() => {
                  if (isTimerRunning) {
                    // Pausando: salvar tempo acumulado imediatamente
                    flushAccumulatedStudyTime();
                  } else {
                    setStudySessionHasStarted(true);
                  }
                  setIsTimerRunning(!isTimerRunning);
                }}
                className="bg-[#4A69A2] hover:bg-black text-white px-4 py-2.5 sm:px-7 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl flex items-center gap-2 font-black text-sm sm:text-base transition-all active:scale-95 min-w-[100px] sm:min-w-[130px] justify-center"
              >
                {isTimerRunning ? (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    Pausar
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    Iniciar
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  flushAccumulatedStudyTime();
                  setIsTimerRunning(false);
                  setTimerSeconds(totalSessionSeconds);
                }}
                className="bg-[#EF4444] hover:bg-black text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-xl transition-all active:scale-95"
                title="Reiniciar"
              >
                <svg className="w-5 h-5 sm:w-7 sm:h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <button
                onClick={() => {
                  setIsTimerRunning(false);
                  setShowEndPomodoroConfirm(true);
                }}
                className="hover:bg-slate-200 active:scale-95 shadow-md bg-slate-100 text-zinc-600 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-2 font-black text-sm sm:text-base transition-all"
                title="Finalizar Sessão"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" strokeWidth="2" />
                </svg>
                Finalizar
              </button>
            </div>

            {/* Alarm Notification Overlay */}
            {timerAlarmActive && (
              <div
                className="fixed inset-0 z-[70] flex items-center justify-center backdrop-blur-md animate-fadeIn cursor-pointer"
                onClick={stopAlarm}
              >
                <div className="bg-white rounded-[28px] p-8 max-w-[320px] w-full shadow-2xl border border-slate-100 flex flex-col items-center gap-4 animate-scaleIn">
                  <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-2xl flex items-center justify-center animate-bounce">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-black text-slate-900 mb-1">Tempo Esgotado!</h3>
                    <p className="text-slate-500 font-bold text-sm">Sua sessão de estudo terminou.</p>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400 text-xs font-black animate-pulse">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                    CLIQUE PARA SILENCIAR
                  </div>
                </div>
              </div>
            )}

            {/* Confirm Finalize Modal - Single Session */}
            {showEndPomodoroConfirm && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-md animate-fadeIn p-4">
                <div className="bg-white rounded-[24px] p-6 max-w-[300px] w-full shadow-2xl animate-scaleIn border border-slate-100">
                  <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" strokeWidth="2" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 text-center mb-1">Finalizar Sessão?</h3>
                  <p className="text-slate-500 text-center font-bold text-[13px] leading-relaxed mb-6">
                    Deseja concluir sua sessão atual e contabilizar o progresso?
                  </p>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleFinalizeSession}
                      className="w-full bg-[#EF4444] hover:bg-black text-white py-3 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                    >
                      Sim, Finalizar
                    </button>
                    <button
                      onClick={() => setShowEndPomodoroConfirm(false)}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.98]"
                    >
                      Não, Continuar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== POMODORO ===== */}
        {view === 'sessionPomodoro' && (
          <div className="flex flex-col items-center gap-8 pt-8 pb-16 w-full max-w-xl mx-auto animate-fadeIn">
            <div className="text-center">
              <h2 className="text-3xl font-black text-[#4A69A2] mb-1">Personalize seus Ciclos de Study</h2>
              <p className="text-slate-500 font-bold text-sm">Ajuste os tempos de produtividade e descanso</p>
            </div>

            {/* Concentração */}
            <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-black text-black">Tempo de Concentração</span>
                <div className="flex items-center gap-1.5">
                  {/* H */}
                  <div className="flex flex-col items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setPomodoroFocusH(h => Math.min(8, h + 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-800 py-0.5">{pomodoroFocusH}</span>
                    <button onClick={() => setPomodoroFocusH(h => Math.max(0, h - 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-400">h</span>
                  {/* M */}
                  <div className="flex flex-col items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setPomodoroFocusM(m => Math.min(59, m + 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-800 py-0.5">{pomodoroFocusM}</span>
                    <button onClick={() => setPomodoroFocusM(m => Math.max(0, m - 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-400">m</span>
                  {/* S */}
                  <div className="flex flex-col items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setPomodoroFocusS(s => Math.min(59, s + 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-800 py-0.5">{pomodoroFocusS}</span>
                    <button onClick={() => setPomodoroFocusS(s => Math.max(0, s - 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-400">s</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><span>Horas</span><span>{pomodoroFocusH}H</span></div>
                  <input type="range" min={0} max={8} value={pomodoroFocusH} onChange={e => setPomodoroFocusH(+e.target.value)} className="w-full h-2 accent-[#4A69A2] rounded-full cursor-pointer" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><span>Minutos</span><span>{pomodoroFocusM}M</span></div>
                  <input type="range" min={0} max={59} value={pomodoroFocusM} onChange={e => setPomodoroFocusM(+e.target.value)} className="w-full h-2 accent-[#4A69A2] rounded-full cursor-pointer" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><span>Segundos</span><span>{pomodoroFocusS}S</span></div>
                  <input type="range" min={0} max={59} value={pomodoroFocusS} onChange={e => setPomodoroFocusS(+e.target.value)} className="w-full h-2 accent-[#4A69A2] rounded-full cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Pausa */}
            <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-100 p-6 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <span className="font-black text-black">Tempo de Pausa</span>
                <div className="flex items-center gap-1.5">
                  {/* M */}
                  <div className="flex flex-col items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setPomodoroBreakM(m => Math.min(59, m + 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-800 py-0.5">{pomodoroBreakM}</span>
                    <button onClick={() => setPomodoroBreakM(m => Math.max(0, m - 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-400">m</span>
                  {/* S */}
                  <div className="flex flex-col items-center border border-slate-200 rounded-lg overflow-hidden">
                    <button onClick={() => setPomodoroBreakS(s => Math.min(59, s + 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                    </button>
                    <span className="w-9 text-center text-sm font-black text-slate-800 py-0.5">{pomodoroBreakS}</span>
                    <button onClick={() => setPomodoroBreakS(s => Math.max(0, s - 1))} className="w-9 h-5 flex items-center justify-center hover:bg-slate-100 transition-colors">
                      <svg className="w-3 h-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  </div>
                  <span className="text-xs font-black text-slate-400">s</span>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><span>Minutos</span><span>{pomodoroBreakM}M</span></div>
                  <input type="range" min={0} max={59} value={pomodoroBreakM} onChange={e => setPomodoroBreakM(+e.target.value)} className="w-full h-2 accent-[#4A69A2] rounded-full cursor-pointer" />
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1"><span>Segundos</span><span>{pomodoroBreakS}S</span></div>
                  <input type="range" min={0} max={59} value={pomodoroBreakS} onChange={e => setPomodoroBreakS(+e.target.value)} className="w-full h-2 accent-[#4A69A2] rounded-full cursor-pointer" />
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                const focusSecs = pomodoroFocusH * 3600 + pomodoroFocusM * 60 + pomodoroFocusS;
                if (focusSecs === 0) return;
                setPomodoroPhase('focus');
                setPomodoroTimerSecs(focusSecs);
                setPomodoroTotalSecs(focusSecs);
                setPomodoroIsRunning(false);
                setPomodoroCompletedFocus(0);
                setPomodoroCompletedBreak(0);
                setView('pomodoroTimerActive');
              }}
              className="w-full py-4 bg-[#4A69A2] hover:bg-[#3a5490] text-white font-black text-lg rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              Iniciar Pomodoro
            </button>
          </div>
        )}

        {/* ===== POMODORO TIMER ATIVO ===== */}
        {view === 'pomodoroTimerActive' && (() => {
          const focusTotal = pomodoroFocusH * 3600 + pomodoroFocusM * 60 + pomodoroFocusS;
          const breakTotal = pomodoroBreakM * 60 + pomodoroBreakS;
          const isFocus = pomodoroPhase === 'focus';
          const accentColor = isFocus ? '#4A69A2' : '#10b981';

          return (
            <div className="flex flex-col items-center justify-center gap-4 pt-0 animate-fadeIn">
              {/* Phase label */}
              <div className="flex flex-col items-center text-center">
                <h2 className="text-3xl font-black text-black mb-1">Pomodoro</h2>
                {isFocus ? (
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4.5a2.5 2.5 0 0 0-4.96-.46 2.5 2.5 0 0 0-1.98 3.5 3 3 0 0 0-1.32 4.24 3 3 0 0 0 .34 4.58 2.5 2.5 0 0 0 2.92 3.88 2.5 2.5 0 0 0 4.96 .46" />
                    <path d="M12 4.5a2.5 2.5 0 0 1 4.96-.46 2.5 2.5 0 0 1 1.98 3.5 3 3 0 0 1 1.32 4.24 3 3 0 0 1-.34 4.58 2.5 2.5 0 0 1-2.92 3.88 2.5 2.5 0 0 1-4.96 .46" />
                    <path d="M12 4.5V21" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                    <line x1="12" y1="2" x2="12" y2="12" />
                  </svg>
                )}
              </div>

              {/* Circle Timer */}
              <div className="relative flex items-center justify-center w-[200px] h-[200px] sm:w-[260px] sm:h-[260px]">
                <svg className="absolute w-full h-full -rotate-90" viewBox="0 0 260 260">
                  <circle cx={130} cy={130} r={115} stroke="currentColor" strokeWidth="10" fill="transparent" className="text-slate-100" />
                  <circle
                    cx={130} cy={130} r={115}
                    stroke={accentColor}
                    strokeWidth="10"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 115}
                    strokeDashoffset={2 * Math.PI * 115 * (1 - pomodoroTimerSecs / (pomodoroTotalSecs || 1))}
                    strokeLinecap="round"
                    className="transition-all duration-800 ease-out"
                  />
                </svg>

                {showPomodoroResetMessage && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center backdrop-blur-md rounded-full animate-fadeIn">
                    <div className="text-center px-6">
                      <h3 className="text-xl font-black text-slate-800 mb-2">Reiniciando contagem...</h3>
                      <div className="text-5xl font-black text-[#4A69A2] animate-bounce">
                        {pomodoroResetCountdown}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex flex-col items-center z-10 px-2 text-center">
                  <span className="text-slate-400 font-black text-[9px] sm:text-xs tracking-wider uppercase mb-1 sm:mb-2">Tempo Restante</span>
                  <span className="font-bold text-slate-900 leading-none tabular-nums text-4xl sm:text-5xl">
                    {formatTime(pomodoroTimerSecs)}
                  </span>
                  <span className="mt-2 sm:mt-3 px-3 sm:px-4 py-1 text-white text-[10px] sm:text-sm font-black rounded-full" style={{ backgroundColor: accentColor }}>
                    {pomodoroIsRunning ? (isFocus ? 'Focado' : 'Descansando') : 'Pausado'}
                  </span>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
                <button
                  onClick={() => {
                    if (pomodoroIsRunning && pomodoroPhase === 'focus') {
                      // Pausando foco do pomodoro: salvar tempo acumulado imediatamente
                      flushAccumulatedStudyTime();
                    } else if (!pomodoroIsRunning) {
                      setStudySessionHasStarted(true);
                    }
                    setPomodoroIsRunning(r => !r);
                  }}
                  className="text-white px-4 py-2.5 sm:px-7 sm:py-3 rounded-xl sm:rounded-2xl shadow-xl flex items-center gap-2 font-black text-sm sm:text-base transition-all active:scale-95 min-w-[100px] sm:min-w-[130px] justify-center"
                  style={{ backgroundColor: accentColor }}
                >
                  {pomodoroIsRunning ? (
                    <><svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>Pausar</>
                  ) : (
                    <><svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>Iniciar</>
                  )}
                </button>

                <button
                  onClick={() => {
                    flushAccumulatedStudyTime();
                    setPomodoroIsRunning(false);
                    setPomodoroPhase('focus');
                    setPomodoroTimerSecs(focusTotal);
                    setPomodoroTotalSecs(focusTotal);
                    setPomodoroCompletedFocus(0);
                    setPomodoroCompletedBreak(0);
                  }}
                  className="bg-[#EF4444] hover:bg-black text-white p-2.5 sm:p-3 rounded-xl sm:rounded-2xl shadow-xl transition-all active:scale-95"
                  title="Reiniciar"
                >
                  <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>

                <button
                  disabled={pomodoroIsRunning}
                  onClick={() => {
                    setShowEndPomodoroConfirm(true);
                  }}
                  className={`${pomodoroIsRunning
                    ? 'opacity-40 cursor-not-allowed grayscale'
                    : 'hover:bg-slate-200 active:scale-95 shadow-md'
                    } bg-slate-100 text-slate-700 px-4 py-2.5 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center gap-2 font-black text-sm sm:text-base transition-all`}
                  title={pomodoroIsRunning ? "Pause o cronômetro para finalizar" : "Finalizar Pomodoro"}
                >
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" strokeWidth="2" />
                  </svg>
                  Finalizar
                </button>
              </div>

              {/* 8 Cycle Icons */}
              <div className="flex gap-8">
                {/* FOCO */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Foco</span>
                  <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <svg key={i} className="w-7 h-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M9.5 3H14.5L15.5 8H8.5L9.5 3Z"
                          fill="white"
                          stroke={i < pomodoroCompletedFocus ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                        />
                        <path
                          d="M8.5 16H15.5L14.5 21H9.5L8.5 16Z"
                          fill="white"
                          stroke={i < pomodoroCompletedFocus ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="6.5"
                          fill="white"
                          stroke={i < pomodoroCompletedFocus ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                        />
                        <path
                          d="M18.5 9.5L19.5 8.5"
                          stroke={i < pomodoroCompletedFocus ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 9V12.5H14.5"
                          stroke={i < pomodoroCompletedFocus ? 'black' : '#cbd5e1'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ))}
                  </div>
                </div>
                {/* PAUSA */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pausa</span>
                  <div className="flex gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <svg key={i} className="w-7 h-7" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path
                          d="M9.5 3H14.5L15.5 8H8.5L9.5 3Z"
                          fill="white"
                          stroke={i < pomodoroCompletedBreak ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                        />
                        <path
                          d="M8.5 16H15.5L14.5 21H9.5L8.5 16Z"
                          fill="white"
                          stroke={i < pomodoroCompletedBreak ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="6.5"
                          fill="white"
                          stroke={i < pomodoroCompletedBreak ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                        />
                        <path
                          d="M18.5 9.5L19.5 8.5"
                          stroke={i < pomodoroCompletedBreak ? 'black' : '#aeb4be'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12 9V12.5H14.5"
                          stroke={i < pomodoroCompletedBreak ? 'black' : '#cbd5e1'}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pomodoro Alarm Overlay */}
              {pomodoroAlarmActive && (
                <div
                  className="fixed inset-0 z-[70] flex items-center justify-center backdrop-blur-md animate-fadeIn cursor-pointer"
                  onClick={stopPomodoroAlarm}
                >
                  <div className="bg-white rounded-[28px] p-8 max-w-[320px] w-full shadow-2xl border border-slate-100 flex flex-col items-center gap-4 animate-scaleIn">
                    <svg className="w-12 h-12 animate-bounce text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <div className="text-center">
                      <h3 className="text-2xl font-black text-slate-900 mb-1">
                        {pomodoroPhase === 'focus' ? 'Foco Concluído!' : 'Pausa Concluída!'}
                      </h3>
                      <p className="text-slate-500 font-bold text-sm">
                        {pomodoroPhase === 'focus' ? 'Hora de descansar. Clique para iniciar a pausa.' : 'De volta ao trabalho! Clique para iniciar o foco.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-black animate-pulse">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                      </svg>
                      CLIQUE PARA CONTINUAR
                    </div>
                  </div>
                </div>
              )}

              {showEndPomodoroConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-md animate-fadeIn p-4">
                  <div className="bg-white rounded-[24px] p-6 max-w-[300px] w-full shadow-2xl animate-scaleIn border border-slate-100">
                    <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                        <line x1="4" y1="22" x2="4" y2="15" strokeLinecap="round" strokeWidth="2" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-black text-slate-900 text-center mb-1">Finalizar Sessão?</h3>
                    <p className="text-slate-500 text-center font-bold text-[13px] leading-relaxed mb-6">
                      Deseja concluir sua sessão atual e contabilizar o progresso?
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={handleFinalizeSession}
                        className="w-full bg-[#EF4444] hover:bg-black text-white py-3 rounded-xl font-black text-sm shadow-md transition-all active:scale-[0.98]"
                      >
                        Sim, Finalizar
                      </button>
                      <button
                        onClick={() => {
                          setShowEndPomodoroConfirm(false);
                          setPendingHomeNavigation(false);
                        }}
                        className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-xl font-black text-sm transition-all active:scale-[0.98]"
                      >
                        Não, Continuar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default Study;

