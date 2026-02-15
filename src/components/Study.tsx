
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { sanitizeHtml } from '@/lib/sanitize';

const colorPalette = ['#6279A8', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#f97316', '#10b981', '#ec4899', '#06b6d4', '#4d7c0f', '#78350f', '#000000'];

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

type StudyView = 'menu' | 'sessionType' | 'knowledgeBank' | 'categoryDetail' | 'addBookForm' | 'addPdfForm' | 'addVideoForm' | 'addReviewForm' | 'addQuestionForm' | 'addSimuladoForm' | 'myBank' | 'vocabulary' | 'vocabRevisionMenu' | 'vocabRevisionSession' | 'vocabRevisionResult' | 'curiosity' | 'mnemonic' | 'activeReview' | 'otherSubjectsMenu' | 'addReviewFlashcardFront' | 'addReviewFlashcardBack' | 'activeReviewSession';
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
}

const Study: React.FC<StudyProps> = ({ isDarkMode, onOpenDetail }) => {
  const [view, setView] = useState<StudyView>('menu');
  const [selectedCategory, setSelectedCategory] = useState<CategoryItem | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  const [isFromActiveReview, setIsFromActiveReview] = useState(false);
  const [showAddMoreFlashcardsModal, setShowAddMoreFlashcardsModal] = useState(false);

  // Estados para navegação do Banco Padronizado (Vídeo, Revisão, Questão)
  const [standardBankStep, setStandardBankStep] = useState<'disciplines' | 'matters' | 'topics' | 'sub1' | 'sub2' | 'sub3' | 'content'>('disciplines');
  const [standardBankPath, setStandardBankPath] = useState<{label: string, type: string, value: string}[]>([]);
  const [standardBankMode, setStandardBankMode] = useState<'ensino_medio' | 'faculdade'>('ensino_medio');

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

  // Form states
  const [bookName, setBookName] = useState('');
  const [bookType, setBookType] = useState<'didatico' | 'outro'>('didatico');
  const [estimateDays, setEstimateDays] = useState<number | undefined>(30); 
  const [totalPages, setTotalPages] = useState<number | undefined>(200);    
  const [selectedColor, setSelectedColor] = useState(colorPalette[0]);

  // PDF
  const [pdfSubject, setPdfSubject] = useState('');
  const [pdfType, setPdfType] = useState<'didatico' | 'outro'>('didatico');
  const [pdfPages, setPdfPages] = useState<number | undefined>(10); 
  const [pdfRelevance, setPdfRelevance] = useState<Relevance | null>(null);
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

  // Questions - Etapa 1
  const [questionSubject, setQuestionSubject] = useState('');
  const [questionSource, setQuestionSource] = useState<string>('YouTube');
  const [questionOtherSource, setQuestionOtherSource] = useState('');
  const [questionQuantity, setQuestionQuantity] = useState<number | undefined>(0);
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

  // Estados para gestão de Tópicos/Subtópicos isolados por tipo de estudo
  const [savedTopicsHS, setSavedTopicsHS] = useState<string[]>([]);
  const [savedSub1HS, setSavedSub1HS] = useState<string[]>([]);
  const [savedSub2HS, setSavedSub2HS] = useState<string[]>([]);
  const [savedSub3HS, setSavedSub3HS] = useState<string[]>([]);

  const [savedTopicsUniv, setSavedTopicsUniv] = useState<string[]>([]);
  const [savedSub1Univ, setSavedSub1Univ] = useState<string[]>([]);
  const [savedSub2Univ, setSavedSub2Univ] = useState<string[]>([]);
  const [savedSub3Univ, setSavedSub3Univ] = useState<string[]>([]);

  const [topicMode, setTopicMode] = useState<'select' | 'add' | ''>('');
  const [sub1Mode, setSub1Mode] = useState<'select' | 'add' | ''>('');
  const [sub2Mode, setSub2Mode] = useState<'select' | 'add' | ''>('');
  const [sub3Mode, setSub3Mode] = useState<'select' | 'add' | ''>('');

  const [tempTopic, setTempTopic] = useState('');
  const [tempSub1, setTempSub1] = useState('');
  const [tempSub2, setTempSub2] = useState('');
  const [tempSub3, setTempSub3] = useState('');

  // Simulado
  const [simOrigin, setSimOrigin] = useState<'ENEM' | 'Vestibulares' | 'Faculdade'>('ENEM');
  const [simYear, setSimYear] = useState('2026');
  const [simType, setSimType] = useState('Aplicação regular');
  const [simArea, setSimArea] = useState('Natureza');
  const [simTestColorName, setSimTestColorName] = useState('');
  const [simVestName, setSimVestName] = useState('');
  const [simSubject, setSimSubject] = useState('');
  const [simQty, setSimQty] = useState<number | undefined>(0);
  const [simDurH, setSimDurH] = useState<number | undefined>(0);
  const [simDurM, setSimDurM] = useState<number | undefined>(0);
  const [simColor, setSimColor] = useState(colorPalette[0]);

  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';

  const relevanceColorMap: Record<Relevance, string> = {
    'Alta': '#ef4444', 
    'Média': '#eab308', 
    'Baixa': '#22c55e', 
    'Baixíssima': '#6b7280'
  };

  const numericBtnClass = "w-12 h-12 rounded-xl bg-[#7EB1FF] border-2 border-[#7EB1FF] flex items-center justify-center text-white font-black text-2xl hover:brightness-110 transition-all active:scale-95 shadow-sm";

  const getRelevanceBtnClass = (rel: Relevance, currentSelected: Relevance | null) => {
    const isSelected = currentSelected === rel;
    const base = "px-6 py-2 rounded-full font-black text-sm border-2 transition-all shadow-sm";
    const idleStyles = "bg-white text-black border-black";
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
    const savedBooks = localStorage.getItem('produtivity_books');
    if (savedBooks) setBooks(JSON.parse(savedBooks));

    const savedVocab = localStorage.getItem('produtivity_vocabulary');
    if (savedVocab) setVocabulary(JSON.parse(savedVocab));

    const savedVocabCats = localStorage.getItem('produtivity_vocabulary_cats');
    if (savedVocabCats) setVocabCategories(JSON.parse(savedVocabCats));

    const savedCurHistory = localStorage.getItem('produtivity_curiosity_history');
    if (savedCurHistory) setCuriosityHistory(JSON.parse(savedCurHistory));

    const savedMnemonicFeedback = localStorage.getItem('produtivity_mnemonic_feedback_history');
    if (savedMnemonicFeedback) setLikedMnemonicsHistory(JSON.parse(savedMnemonicFeedback));

    // Carregamento isolado
    const stHS = localStorage.getItem('produtivity_saved_topics_hs');
    if (stHS) setSavedTopicsHS(JSON.parse(stHS));
    const ss1HS = localStorage.getItem('produtivity_saved_sub1_hs');
    if (ss1HS) setSavedSub1HS(JSON.parse(ss1HS));
    const ss2HS = localStorage.getItem('produtivity_saved_sub2_hs');
    if (ss2HS) setSavedSub2HS(JSON.parse(ss2HS));
    const ss3HS = localStorage.getItem('produtivity_saved_sub3_hs');
    if (ss3HS) setSavedSub3HS(JSON.parse(ss3HS));

    const stUniv = localStorage.getItem('produtivity_saved_topics_univ');
    if (stUniv) setSavedTopicsUniv(JSON.parse(stUniv));
    const ss1Univ = localStorage.getItem('produtivity_saved_sub1_univ');
    if (ss1Univ) setSavedSub1Univ(JSON.parse(ss1Univ));
    const ss2Univ = localStorage.getItem('produtivity_saved_sub2_univ');
    if (ss2Univ) setSavedSub2Univ(JSON.parse(ss2Univ));
    const ss3Univ = localStorage.getItem('produtivity_saved_sub3_univ');
    if (ss3Univ) setSavedSub3Univ(JSON.parse(ss3Univ));

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
  };

  const saveVocabulary = (newVocab: VocabularyItem[]) => {
    setVocabulary(newVocab);
    localStorage.setItem('produtivity_vocabulary', JSON.stringify(newVocab));
  };

  const saveVocabCategories = (newCats: VocabularyCategory[]) => {
    setVocabCategories(newCats);
    localStorage.setItem('produtivity_vocabulary_cats', JSON.stringify(newCats));
  };

  const addNewSavedItem = (type: 'topic' | 'sub1' | 'sub2' | 'sub3', value: string) => {
    if (!value.trim() || !videoStudyType) return;
    
    const suffix = videoStudyType === 'ensino_medio' ? '_hs' : '_univ';
    const storageKey = `produtivity_saved_${type}${suffix}`;
    
    const getterMap = {
      'topic_hs': savedTopicsHS, 'sub1_hs': savedSub1HS, 'sub2_hs': savedSub2HS, 'sub3_hs': savedSub3HS,
      'topic_univ': savedTopicsUniv, 'sub1_univ': savedSub1Univ, 'sub2_univ': savedSub2Univ, 'sub3_univ': savedSub3Univ
    };

    const setterMap = {
      'topic_hs': setSavedTopicsHS, 'sub1_hs': setSavedSub1HS, 'sub2_hs': setSavedSub2HS, 'sub3_hs': setSavedSub3HS,
      'topic_univ': setSavedTopicsUniv, 'sub1_univ': setSavedSub1Univ, 'sub2_univ': setSavedSub2Univ, 'sub3_univ': setSavedSub3Univ
    };

    const key = `${type}${suffix}` as keyof typeof getterMap;
    const currentList = getterMap[key];
    const newList = Array.from(new Set([...currentList, value]));
    
    setterMap[key](newList);
    localStorage.setItem(storageKey, JSON.stringify(newList));

    // Define valor no form e reseta temp
    if (type === 'topic') { setVideoTopic(value); setTopicMode('select'); setTempTopic(''); }
    else if (type === 'sub1') { setVideoSub1(value); setSub1Mode('select'); setTempSub1(''); }
    else if (type === 'sub2') { setVideoSub2(value); setSub2Mode('select'); setTempSub2(''); }
    else if (type === 'sub3') { setVideoSub3(value); setSub3Mode('select'); setTempSub3(''); }
  };

  const handleAddBook = () => {
    if (!bookName.trim()) {
      setErrorMsg("Por favor, preencha o nome do livro primeiro.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    const newBook: Book = {
      id: Date.now().toString(),
      name: bookName,
      categoryId: 'Meus livros',
      type: bookType,
      estimateDays: estimateDays || 0,
      totalPages: totalPages || 0,
      readPages: 0,
      color: selectedColor,
      dateAdded: new Date().toISOString()
    };
    saveBooks([newBook, ...books]);
    setView('myBank');
  };

  const handleAddPdf = () => {
    if (!pdfSubject.trim()) {
      setErrorMsg("Por favor, preencha o assunto do PDF primeiro.");
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
      if (!videoDiscipline || (needsArea && !videoArea) || !videoMatter || !videoTopic) {
        setErrorMsg("Preencha Disciplina, Área (se houver), Matéria e Tópico.");
        setTimeout(() => setErrorMsg(null), 3000);
        return;
      }
    } else {
      if (!videoMatter || !videoTopic) {
        setErrorMsg("Preencha Nome da Matéria e Tópico.");
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

    const newItem: Book = {
      ...(baseData as Book),
      id: Date.now().toString(),
      categoryId: selectedCategory?.label || '',
      totalPages: (baseData as any).questionQuantity || 100, 
      readPages: 0,
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
      flashcardBack: isFromActiveReview ? flashcardBack : undefined
    };

    saveBooks([newItem, ...books]);

    if (isFromActiveReview) {
      if (isFinishing) {
        setFlashcardFront('');
        setFlashcardBack('');
        setView('activeReview');
      } else {
        setShowAddMoreFlashcardsModal(true);
      }
    } else {
      setView('categoryDetail');
    }
  };

  const handleAddSimulado = () => {
    let finalName = '';
    if (simOrigin === 'ENEM') finalName = `ENEM ${simYear} - ${simArea}`;
    else if (simOrigin === 'Vestibulares') finalName = `${simVestName || 'Vestibular'} ${simYear} - ${simArea}`;
    else finalName = `Faculdade ${simYear} - ${simSubject || 'Assunto'}`;

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
    setView('myBank');
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
        className={`flex items-center gap-2 px-6 py-2 rounded-2xl border-2 font-bold transition-all shadow-sm active:scale-95 ${isDarkMode ? 'bg-black text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 hover:border-black'}`}
      >
        <span>←</span> {isStandardBank && !isFromActiveReview ? 'Voltar para menu' : 'Voltar'}
      </button>
    );
  };

  const categories: CategoryItem[] = [
    { label: 'Meus livros', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>, singular: 'livro' },
    { label: "Meus PDF's", icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, singular: 'PDF' },
    { label: 'Minhas vídeo aulas', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" /></svg>, singular: 'vídeo aula' },
    { label: 'Minhas revisões', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>, singular: 'revisão' },
    { label: 'Minhas questões', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>, singular: 'questão' },
    { label: 'Meus simulados', icon: <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2-2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>, singular: 'simulado' },
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
        setErrorMsg(`Servidor ocupado. Tentando novamente em ${Math.round(waitTime/1000)}s... (${i + 1}/${maxRetries})`);
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
    setView('activeReviewSession');
  };

  const handleActiveReviewAnswer = (correct: boolean) => {
    if (isTransitioning) return;
    if (correct) setActiveReviewScore(prev => prev + 1);

    if (currentActiveReviewIndex < activeReviewCards.length - 1) {
      setIsTransitioning(true);
      setIsActiveReviewCardFlipped(false);
      setTimeout(() => {
        setCurrentActiveReviewIndex(prev => prev + 1);
        setIsTransitioning(false);
      }, 350);
    } else {
      // Re-aproveita o resultado de vocabulário ou faz um novo?
      // Por simplicidade vamos voltar para o banco por enquanto
      setErrorMsg(`Revisão concluída! Você acertou ${activeReviewScore + (correct ? 1 : 0)} de ${activeReviewCards.length}`);
      setTimeout(() => setErrorMsg(null), 3000);
      setView('myBank');
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
      const { data, error } = await supabase.functions.invoke('study-ai', {
        body: { action: 'replace_mnemonic', mnemonicInput }
      });
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
      const { data, error } = await supabase.functions.invoke('study-ai', {
        body: { action: 'generate_similar', mnemonicInput, parentText: parentMnemonic.text }
      });
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

      const { data, error } = await supabase.functions.invoke('study-ai', {
        body: { action: 'generate_mnemonic', rawInput, favoritesContext }
      });
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
               <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
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
                   <div className="w-10 h-10 border-4 border-black/10 border-t-black rounded-full animate-spin"></div>
                 </div>
               )}
               
               <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                  <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.2em] text-white shrink-0 ${
                    (m.type || '').includes('Frase') ? 'bg-orange-500' : 
                    (m.type || '').includes('Acrônimo') ? 'bg-indigo-600' : 
                    (m.type || '').includes('Visual') ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}>
                    {m.type || 'Mnemônico'}
                  </span>
                  
                  <div className="flex gap-2 ml-auto">
                    <button 
                      onClick={() => handleMnemonicFeedback(m.id, true)}
                      title="Gostei"
                      className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${m.liked === true ? 'bg-green-500 border-green-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-green-500 hover:text-green-500'}`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 2 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01z"/></svg>
                    </button>
                    <button 
                      onClick={() => handleMnemonicFeedback(m.id, false)}
                      title="Não gostei"
                      className={`w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all shrink-0 ${m.liked === false ? 'bg-red-500 border-red-500 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-red-500 hover:text-red-500'}`}
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22 4h-2c-.55 0-1 .45-1 1v9c0 .55.45 1 1 1h2V4zM2.17 11.12c-.11.25-.17.52-.17.8V13c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L10.83 22l5.59-5.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2H6c-.83 0-1.54.5-1.84 1.22L1.14 10.27c-.09.23-.14.47-.14.73v1.91l.01.01z"/></svg>
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
                   <div className="p-5 bg-[#FEF9C3] rounded-2xl border-2 border-[#FEF08A] flex gap-3">
                     <span className="text-xl shrink-0">⚡</span>
                     <p className="text-xs font-black text-yellow-800 leading-tight uppercase tracking-tight">DICA DE FIXAÇÃO: <span className="font-medium normal-case block mt-1">{m.tip}</span></p>
                   </div>
                 </div>
               </div>

               <div className="mt-8 pt-8 border-t-2 border-slate-50 flex flex-col gap-3">
                  <button 
                    onClick={() => handleReplaceMnemonic(m.id)}
                    className="w-full py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:bg-slate-100 hover:text-black hover:border-black transition-all flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    Trocar
                  </button>

                  <div className="relative pt-2">
                    {loadingSimilarId === m.id && (
                      <div className="absolute -top-1 left-0 w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#7EB1FF] loading-bar-anim" style={{width: '30%'}}></div>
                      </div>
                    )}
                    <button 
                      onClick={() => handleGenerateSimilar(m)}
                      disabled={!!loadingSimilarId}
                      className="w-full py-4 bg-white border-2 border-slate-100 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:border-black transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
                               <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8V11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L13.17 2 7.58 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01z"/></svg>
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
            className="px-8 py-3 bg-white border-2 border-black rounded-2xl font-black text-sm text-black hover:bg-black hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-4"
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

      let prompt = `Você é uma autoridade científica mundial, uma IA especializada em curiosidades fascinantes, profundas e extremamente detalhadas. `;
      
      if (targetDiscipline && subjectsReference[targetDiscipline as keyof typeof subjectsReference]) {
        prompt += `
          FOCO ABSOLUTO: Disciplina de ${targetDiscipline}.
          MATÉRIAS PERMITIDAS (Nível Universitário/Avançado):
          - Disciplina Alvo: ${targetDiscipline}
          - Lista de Tópicos Sugeridos: ${subjectsReference[targetDiscipline as keyof typeof subjectsReference].join(', ')}
          
          REGRAS OBRIGATÓRIAS DE CONTEÚDO:
          1. Sua resposta DEVE orbitar em torno de ${targetDiscipline}.
          2. INTERDISCIPLINARIDADE: Você deve conectar o tema com outras áreas para criar um panorama holístico, mas a base teórica principal deve ser ${targetDiscipline}.
          3. O texto deve ser RICO EM CONTEÚDO, evitando generalidades e o "senso comum". Traga descobertas recentes ou mecanismos complexos.
        `;
      } else {
        prompt += `FOCO: Área de ${category}.`;
      }

      prompt += `
        INSTRUÇÕES DE FORMATO (RETORNE APENAS JSON):
        {
          "discipline": "${targetDiscipline || category}",
          "title": "Um título MUITO simples, curto e direto ao ponto",
          "curiosity": "Texto da curiosidade principal. Deve ser uma narrativa EXTREMAMENTE EXTENSA, detalhada e cativante (MÍNIMO DE 350 PALAVRAS).",
          "details": "Uma explicação TÉCNICA, ACADÊMICA E CIENTÍFIDA PROFUNDA (MÍNIMO DE 650 PALAVRAS).",
          "topic": "A matéria/tópico exato abordado",
          "image_prompt": "Uma descrição visual cinematográfica e ultra-detalhada da cena descrita no texto. Estilo Pixar 3D moderno, iluminação volumétrica, qualidade 8K."
        }
      `;

      const { data: textData, error: textError } = await supabase.functions.invoke('study-ai', {
        body: { action: 'generate_curiosity', prompt }
      });
      if (textError) throw textError;

      let textContent = textData.content;
      if (textContent.includes("```")) textContent = textContent.replace(/```json|```/g, "").trim();
      const data = JSON.parse(textContent);

      // Now generate image
      let imageUrl = "";
      try {
        const { data: imgData, error: imgError } = await supabase.functions.invoke('study-ai', {
          body: { action: 'generate_curiosity_image', imagePrompt: data.image_prompt }
        });
        if (!imgError && imgData?.content) {
          // The image content from the gateway - try to use it
          imageUrl = "";
        }
      } catch (imgError) {
        console.warn("Falha ao gerar imagem, prosseguindo apenas com texto.", imgError);
      }

      setCuriosityData({
        title: data.title,
        text: data.curiosity,
        details: data.details,
        imageUrl: imageUrl,
        category: category,
        topic: data.topic,
        discipline: data.discipline
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
          <h2 className={`text-4xl font-black ${textColor} mb-2 uppercase tracking-tighter text-center`}>Curiosidades do Mundo</h2>
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
          <div className="w-24 h-24 border-4 border-slate-200 border-t-black rounded-full animate-spin mb-8"></div>
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
              <h3 className="text-5xl font-black text-slate-800 leading-[1.1] uppercase tracking-tighter">{curiosityData.title}</h3>
            </div>
            
            <div className="p-12 flex flex-col items-center">
              {curiosityData.imageUrl && (
                <div className="w-full mb-12 group relative max-w-3xl">
                  <img 
                    src={curiosityData.imageUrl} 
                    alt="Representação visual do tema" 
                    className="w-full aspect-square object-cover rounded-[3.5rem] border-2 border-black shadow-2xl" 
                  />
                  <div className="absolute inset-0 bg-black/5 rounded-[3.5rem] pointer-events-none"></div>
                </div>
              )}
              <div className="w-full space-y-10 max-w-4xl">
                <div className="text-slate-700 text-2xl font-medium leading-[1.6] whitespace-pre-line border-l-8 border-black pl-8">
                  {curiosityData.text}
                </div>

                <div className="pt-6">
                  {!showCuriosityDetails ? (
                    <button 
                      onClick={() => setShowCuriosityDetails(true)}
                      className="w-full flex items-center justify-center gap-4 text-[#3B82F6] font-black uppercase tracking-[0.2em] text-sm hover:scale-[1.01] bg-blue-50 px-10 py-8 rounded-[2.5rem] transition-all hover:bg-blue-100 border-2 border-blue-200"
                    >
                      Aprofundar Conhecimento: Ver Dossiê Científico Extenso
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                  ) : (
                    <div className="p-12 bg-blue-50/50 rounded-[4rem] border-2 border-blue-100 animate-fadeIn shadow-inner">
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
              </div>
            </div>

            <div className="bg-slate-50 p-12 border-t-2 border-slate-100 flex flex-col items-center">
              <p className="text-slate-400 font-black text-xs uppercase tracking-[0.2em] mb-8">O que achou deste fato científico de {curiosityData.discipline}?</p>
              <div className="flex gap-8">
                <button 
                  onClick={() => handleCuriosityFeedback(false)}
                  className="w-16 h-16 rounded-2xl border-2 border-slate-300 bg-white flex items-center justify-center text-slate-400 hover:border-red-500 hover:text-red-500 active:bg-red-500 active:border-red-500 active:text-white transition-all shadow-lg active:scale-95 group"
                >
                  <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z" />
                  </svg>
                </button>
                <button 
                  onClick={() => handleCuriosityFeedback(true)}
                  className="w-16 h-16 rounded-2xl border-2 border-slate-300 bg-white flex items-center justify-center text-slate-400 hover:border-green-500 hover:text-green-500 active:bg-green-500 active:border-green-500 active:text-white transition-all shadow-lg active:scale-95 group"
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
              className="absolute inset-0 backface-hidden rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 text-white border-4 border-white/20"
              style={{ 
                backgroundColor: currentCard.color,
                zIndex: isRevisionCardFlipped ? 0 : 20,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
            >
              <span className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-60">Qual o significado de:</span>
              <h3 className="text-5xl font-black text-center leading-tight mb-8">{currentCard.term}</h3>
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
            </div>

            <div 
              className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 border-4"
              style={{ 
                borderColor: currentCard.color,
                zIndex: isRevisionCardFlipped ? 20 : 0,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
            >
              <p className="text-5xl font-black text-slate-800 text-center leading-relaxed max-h-[90%] overflow-y-auto custom-scrollbar uppercase tracking-tighter">
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
    const percentage = Math.round((revisionScore / revisionQueue.length) * 100);
    
    return (
      <div className="animate-fadeIn max-w-2xl mx-auto flex flex-col items-center text-center py-16">
         <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-8 border-4 border-black">
            <span className="text-4xl font-black text-slate-800">{percentage}%</span>
         </div>
         
         <h2 className="text-4xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Resultado Final</h2>
         <p className="text-slate-400 font-bold text-lg mb-12">
           Você acertou {revisionScore} de {revisionQueue.length} palavras!
         </p>

         <div className="grid grid-cols-1 gap-4 w-full max-w-sm">
            <button 
              onClick={() => startRevision(revisionMode, selectedRevisionCategory)}
              className="py-5 bg-black text-white font-black rounded-2xl shadow-xl hover:scale-105 active:scale-95 transition-all uppercase"
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
              className="py-5 bg-white text-slate-400 border-2 border-slate-100 font-black rounded-2xl hover:bg-slate-50 transition-all uppercase"
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

        <div className="h-96 w-full max-w-2xl perspective-1000 mb-12">
          <div 
            onClick={() => !isTransitioning && setIsActiveReviewCardFlipped(!isActiveReviewCardFlipped)}
            className={`relative w-full h-full transition-all duration-700 transform-style-3d cursor-pointer ${isActiveReviewCardFlipped ? 'rotate-y-180' : ''}`}
          >
            <div 
              className="absolute inset-0 backface-hidden rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 text-white border-4 border-white/20"
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

            <div 
              className="absolute inset-0 backface-hidden rotate-y-180 bg-white rounded-[3rem] shadow-2xl flex flex-col items-center justify-center p-12 border-4"
              style={{ 
                borderColor: '#A855F7',
                zIndex: isActiveReviewCardFlipped ? 20 : 0,
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden'
              }}
            >
              <div className="text-xl font-medium text-slate-800 text-left leading-relaxed max-h-[90%] w-full overflow-y-auto custom-scrollbar prose prose-slate" dangerouslySetInnerHTML={{ __html: sanitizeHtml(currentCard.flashcardBack || '') }} />
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
            className="py-4 px-10 rounded-full font-black text-sm bg-[#FEF9C3] text-black border-2 border-[#FEF9C3] hover:scale-105 transition-all flex items-center gap-2 shadow-sm"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            Revisão
          </button>
        </div>
        
        <h2 className={`text-4xl font-black ${textColor} mb-10 tracking-tight uppercase`}>Meu Vocabulário</h2>

        {(vocabSubView === 'categories' || vocabSubView === 'create_category') && (
            <div className="flex flex-col gap-6 mb-10">
                <div className="flex flex-row justify-center items-center gap-6">
                    <button 
                    onClick={() => setVocabSubView('categories')}
                    className={`py-5 px-12 rounded-2xl font-black text-sm transition-all border-2 border-[#A855F7] ${vocabSubView === 'categories' ? 'bg-[#A855F7] text-white' : 'bg-white text-[#A855F7] hover:bg-[#A855F7]/5'}`}
                    >
                    Minhas Categorias
                    </button>
                    <button 
                    onClick={() => {
                        setEditingVocabCategory(null);
                        setNewVocabCatName('');
                        setVocabSubView('create_category');
                    }}
                    className={`py-5 px-12 rounded-2xl font-black text-sm transition-all border-2 border-[#3B82F6] ${vocabSubView === 'create_category' ? 'bg-[#3B82F6] text-white' : 'bg-white text-[#3B82F6] hover:bg-[#3B82F6]/5'}`}
                    >
                    Criar Categoria
                    </button>
                </div>
            </div>
        )}

        <div className="bg-white rounded-[2.5rem] border-[1.5px] border-[#4A69A2] p-10 shadow-sm min-h-[450px] relative overflow-hidden">
          {vocabSubView === 'categories' && (
            <div className="animate-fadeIn grid grid-cols-1 gap-4">
              {vocabCategories.length === 0 ? (
                <div className="col-span-full h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">nenhum arquivo salvo</div>
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
                      className={`p-4 rounded-2xl text-white font-black text-xl shadow-md relative group overflow-hidden cursor-pointer hover:scale-[1.01] transition-all flex items-center justify-between border-2 border-white/10`}
                    >
                      <div className="relative z-10 uppercase tracking-tighter px-2">
                        {cat.name}
                      </div>
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end px-4 gap-2 z-20">
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
                    className="w-full p-4 border-2 border-black rounded-2xl font-bold outline-none shadow-sm placeholder:text-slate-200 bg-white text-slate-800"
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
                        className={`w-10 h-10 rounded-xl border-2 transition-all ${selectedVocabColor === color ? 'border-black scale-110 shadow-lg' : 'border-transparent'}`}
                      />
                    ))}
                  </div>
               </div>
               <button 
                 onClick={() => {
                   if(!newVocabCatName.trim()) {
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
                <div className="flex justify-between items-center mb-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setVocabSubView('categories')} className="text-slate-400 hover:text-black transition-colors font-black text-sm">‹ Voltar</button>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter ml-2">{activeVocabCategory.name}</h3>
                    </div>
                    <button 
                        onClick={() => setVocabSubView('add_word')}
                        className="py-3.5 px-8 bg-black text-white rounded-xl font-black text-sm hover:scale-105 transition-all uppercase tracking-widest"
                    >
                        + Adicionar palavra
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                    {vocabulary.filter(v => v.categoryId === activeVocabCategory.id).length === 0 ? (
                        <div className="col-span-full h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold text-sm uppercase tracking-widest">nenhum arquivo salvo</div>
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
                                        className="absolute inset-0 backface-hidden flex items-center justify-center p-4 rounded-3xl text-white font-black text-lg text-center shadow-md border-2 border-white/10"
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
                                        className="absolute inset-0 backface-hidden rotate-y-180 flex flex-col items-center justify-center p-4 rounded-3xl text-slate-800 border-2 text-center shadow-md overflow-y-auto"
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
                <header className="flex justify-between items-center mb-2">
                    <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">Nova Palavra para {activeVocabCategory?.name}</h3>
                    <button onClick={() => setVocabSubView('category_detail')} className="text-slate-400 font-bold text-xs uppercase hover:text-black">Cancelar</button>
                </header>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">PALAVRA</label>
                  <input 
                    type="text" 
                    value={newTerm.term} 
                    onChange={(e) => setnewTerm({...newTerm, term: e.target.value})}
                    placeholder="Ex: Ubíquo"
                    className="w-full p-4 border-2 border-black rounded-2xl font-bold outline-none shadow-sm placeholder:text-slate-300 bg-white text-slate-800"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">SIGNIFICADO</label>
                  <textarea 
                    value={newTerm.meaning} 
                    onChange={(e) => setnewTerm({...newTerm, meaning: e.target.value})}
                    placeholder="Que está ao mesmo tempo em toda parte..."
                    className="w-full p-4 border-2 border-black rounded-2xl font-bold outline-none shadow-sm placeholder:text-slate-300 min-h-[120px] resize-none bg-white text-slate-800"
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
    const newPath = [...standardBankPath];
    newPath.pop();
    setStandardBankPath(newPath);
    
    const len = newPath.length;
    if (len === 0) setStandardBankStep(standardBankMode === 'faculdade' ? 'topics' : 'disciplines');
    else if (len === 1) setStandardBankStep(standardBankMode === 'faculdade' ? 'sub1' : 'matters');
    else if (len === 2) setStandardBankStep(standardBankMode === 'faculdade' ? 'sub2' : 'topics');
    else if (len === 3) setStandardBankStep(standardBankMode === 'faculdade' ? 'sub3' : 'sub1');
    else if (len === 4) setStandardBankStep(standardBankMode === 'faculdade' ? 'content' : 'sub2');
    else if (len === 5) setStandardBankStep('sub3');
  };

  // Filtro Universal para o Banco (Vídeo, Revisão, Questão) baseado na categoria selecionada
  const filteredItemsByPath = useMemo(() => {
    let list = books.filter(b => b.categoryId === selectedCategory?.label);
    list = list.filter(b => b.videoStudyType === standardBankMode);

    standardBankPath.forEach(p => {
      if (p.type === 'discipline') list = list.filter(b => b.videoDiscipline === p.value);
      if (p.type === 'matter') list = list.filter(b => b.videoMatter === p.value);
      if (p.type === 'topic') list = list.filter(b => b.videoTopic === p.value);
      if (p.type === 'sub1') list = list.filter(b => b.videoSub1 === p.value);
      if (p.type === 'sub2') list = list.filter(b => b.videoSub2 === p.value);
      if (p.type === 'sub3') list = list.filter(b => b.videoSub3 === p.value);
    });
    return list;
  }, [books, standardBankPath, standardBankMode, selectedCategory]);

  const renderStandardizedBank = () => {
    const breadcrumbs = [];
    if (standardBankMode === 'ensino_medio') {
      breadcrumbs.push({label: 'Disciplinas', step: 'disciplines'});
      if (standardBankPath.length > 0) breadcrumbs.push({label: 'Matérias', step: 'matters'});
      if (standardBankPath.length > 1) breadcrumbs.push({label: 'Tópicos', step: 'topics'});
      if (standardBankPath.length > 2) breadcrumbs.push({label: 'Subtópico 1', step: 'sub1'});
      if (standardBankPath.length > 3) breadcrumbs.push({label: 'Subtópico 2', step: 'sub2'});
      if (standardBankPath.length > 4) breadcrumbs.push({label: 'Subtópico 3', step: 'sub3'});
    } else {
      breadcrumbs.push({label: 'Tópicos', step: 'topics'});
      if (standardBankPath.length > 0) breadcrumbs.push({label: 'Subtópico 1', step: 'sub1'});
      if (standardBankPath.length > 1) breadcrumbs.push({label: 'Subtópico 2', step: 'sub2'});
      if (standardBankPath.length > 2) breadcrumbs.push({label: 'Subtópico 3', step: 'sub3'});
    }

    let contentItems: string[] = [];
    if (standardBankStep === 'disciplines') {
      contentItems = disciplinesList;
    } else if (standardBankStep === 'matters') {
      const disc = standardBankPath.find(p => p.type === 'discipline')?.value || '';
      if (['Geografia', 'História', 'Português'].includes(disc)) {
        if (disc === 'Geografia') contentItems = [...areaMatters['Geografia física'], ...areaMatters['Geografia humana']];
        else if (disc === 'História') contentItems = [...areaMatters['História geral'], ...areaMatters['História do Brasil']];
        else if (disc === 'Português') contentItems = [...areaMatters['Gramática'], ...areaMatters['Interpretação de texto']];
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
    }

    if (standardBankStep !== 'disciplines' && standardBankStep !== 'content' && contentItems.length === 0 && filteredItemsByPath.length > 0) {
      setStandardBankStep('content');
      return null;
    }

    return (
      <div className="w-full max-w-5xl mx-auto pt-6 animate-fadeIn">
        <div className="flex justify-between items-center mb-10">
          {(standardBankMode === 'ensino_medio' && standardBankStep !== 'disciplines') || (standardBankMode === 'faculdade' && standardBankPath.length > 0) ? (
            <button 
              onClick={handleStandardBankBack}
              className="w-12 h-12 rounded-none border-2 border-black flex items-center justify-center font-black bg-white hover:bg-slate-50 transition-all shadow-sm active:scale-95 shrink-0"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          ) : <div className="w-12 h-12"></div>}
          
          <button 
            onClick={() => setView('otherSubjectsMenu')}
            className="bg-[#A855F7] text-white px-8 py-3 rounded-2xl font-black shadow-lg flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Outros Assuntos / Faculdade
          </button>
        </div>

        <div className="flex flex-wrap gap-2 md:gap-4 mb-8">
           {breadcrumbs.map((b, i) => {
             const isLongSequence = breadcrumbs.length > 4;
             return (
               <div key={i} className={`${isLongSequence ? 'px-3 py-1.5 text-[10px]' : 'px-6 py-2 text-xs'} bg-white rounded-xl border-2 border-slate-100 shadow-sm font-black text-slate-800 uppercase tracking-widest whitespace-nowrap transition-all`}>
                 {b.label}
               </div>
             );
           })}
        </div>

        {standardBankStep !== 'content' ? (
          <div key={standardBankStep} className="animate-fadeIn">
            {contentItems.length === 0 && standardBankStep !== 'disciplines' ? (
              <div className="w-full h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">nenhum arquivo salvo</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {contentItems.map((item, idx) => (
                  <button 
                    key={item}
                    onClick={() => {
                      const typeMap: Record<string, string> = {
                        'disciplines': 'discipline', 'matters': 'matter', 'topics': 'topic', 'sub1': 'sub1', 'sub2': 'sub2', 'sub3': 'sub3'
                      };
                      const nextLevelMap: Record<string, 'matters' | 'topics' | 'sub1' | 'sub2' | 'sub3' | 'content'> = {
                        'disciplines': 'matters', 'matters': 'topics', 'topics': 'sub1', 'sub1': 'sub2', 'sub2': 'sub3', 'sub3': 'content'
                      };
                      setStandardBankPath([...standardBankPath, { label: item, type: typeMap[standardBankStep], value: item }]);
                      setStandardBankStep(nextLevelMap[standardBankStep]);
                    }}
                    className={`bg-white border-2 border-black rounded-3xl h-32 flex items-center justify-center px-4 font-black ${item.length > 20 ? 'text-sm' : item.length > 12 ? 'text-base' : 'text-xl'} text-slate-800 hover:bg-[#7EB1FF] hover:text-white hover:border-transparent transition-all shadow-md active:scale-95 text-center leading-tight`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (() => {
          // Lógica de agrupamento para Revisão Ativa
          const groupedBySubject: Record<string, Book[]> = {};
          filteredItemsByPath.forEach(item => {
            if (item.reviewMethod === 'Ativa') {
              const key = `${item.name}-${item.videoDiscipline}-${item.videoMatter}-${item.videoTopic}`;
              if (!groupedBySubject[key]) groupedBySubject[key] = [];
              groupedBySubject[key].push(item);
            }
          });

          // Itens que não são revisão ativa (aparecem individualmente)
          const nonActiveItems = filteredItemsByPath.filter(item => item.reviewMethod !== 'Ativa');
          const activeSubjectKeys = Object.keys(groupedBySubject);

          return (
            <div className="grid gap-6 animate-fadeIn">
              {filteredItemsByPath.length === 0 ? (
                <div className="w-full h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">nenhum arquivo salvo</div>
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
                        className="group p-8 rounded-[2.5rem] flex items-center gap-6 text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-all relative border-[3px] border-white/20 bg-[#A855F7]" 
                      >
                        <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                           <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                        </div>
                        <div className="flex-1 flex flex-col">
                           <h3 className="text-3xl font-black tracking-tight text-white">{first.name}</h3>
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-60 mt-1">{cards.length} flashcards salvos</span>
                        </div>
                        <div className="shrink-0 text-white/80 group-hover:translate-x-1 transition-transform">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                        </div>
                      </div>
                    );
                  })}

                  {/* Renderizar Itens Individuais (Não Ativos) */}
                  {nonActiveItems.map(item => {
                    const percent = Math.round((item.readPages / item.totalPages) * 100);
                    const cardBgColor = item.relevance ? relevanceColorMap[item.relevance] : '#f59e0b';
                    return (
                      <div 
                        key={item.id} 
                        onClick={() => onOpenDetail?.(item)} 
                        className="group p-8 rounded-[2.5rem] flex items-center gap-6 text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-all relative border-[3px] border-[#EAB308]" 
                        style={{ backgroundColor: cardBgColor }}
                      >
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setBookToDelete(item);
                          }}
                          className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 z-20 border-2 border-white"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>

                        <div className="w-16 h-16 bg-white/30 rounded-2xl flex items-center justify-center shrink-0 border border-white/20">
                          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {item.categoryId === 'Minhas vídeo aulas' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />}
                            {item.categoryId === 'Minhas revisões' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />}
                            {item.categoryId === 'Minhas questões' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                          </svg>
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex flex-col text-left mb-3">
                            {item.videoStudyType !== 'ensino_medio' && (
                              <>
                                <h3 className="text-3xl font-black tracking-tight">{item.videoMatter || 'Matéria'}</h3>
                                <div className="h-0.5 w-full bg-white/40 my-2 rounded-full"></div>
                              </>
                            )}
                            <p className={`${item.videoStudyType === 'ensino_medio' ? 'text-2xl' : 'text-lg'} font-black opacity-95`}>{item.name}</p>
                          </div>
                          
                          <div className="w-full bg-black/30 rounded-2xl p-4 flex flex-col gap-2">
                            <div className="flex justify-between items-center px-1">
                              <span className="text-sm font-black text-white">Progresso</span>
                              <span className="text-sm font-black text-white">{percent}%</span>
                            </div>
                            <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden">
                              <div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${percent}%` }}></div>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 text-white/80 group-hover:translate-x-1 transition-transform">
                          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
       <button 
        onClick={() => {
          setStandardBankMode('faculdade');
          setStandardBankPath([]);
          setStandardBankStep('topics');
          setView('myBank');
        }}
        className="w-full max-sm flex items-center justify-center gap-4 bg-[#5A78AF] p-6 rounded-2xl text-white font-black text-lg shadow-xl hover:scale-105 active:scale-95 transition-all"
       >
         <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
           <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147L12 15l7.74-4.853a.75.75 0 000-1.294L12 4l-7.74 4.853a.75.75 0 000 1.294z" />
           <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.067V16.5a1.5 1.5 0 001.5 1.5h12a1.5 1.5 0 001.5-1.5v-4.433" />
         </svg>
         Matéria da Faculdade
       </button>
    </div>
  );

  return (
    <div className={`animate-fadeIn min-h-[80vh] flex flex-col relative ${isDarkMode ? 'bg-black' : ''}`}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
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
        .view-container { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .active-flashcard-editor[contenteditable]:empty:before { 
          content: attr(data-placeholder); 
          color: #cbd5e1; 
          cursor: text; 
          font-weight: 500;
          pointer-events: none;
        }
      `}</style>

      {errorMsg && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl animate-bounce text-center">
          {errorMsg}
        </div>
      )}

      {/* Vocabulary Category Delete Confirmation Modal */}
      {vocabCategoryToDelete && (
        <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white p-8 rounded-[2.5rem] w-full max-sm shadow-2xl text-center flex flex-col items-center border-2 border-black">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-6">Excluir categoria?</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => setVocabCategoryToDelete(null)} className="flex-1 py-3 rounded-2xl font-black text-slate-400 hover:bg-slate-100 transition-all border-2 border-slate-100">Não</button>
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
          <div className="bg-white p-12 rounded-[3.5rem] w-full max-lg shadow-2xl text-center flex flex-col items-center border-2 border-black">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mb-6">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-3xl font-black text-slate-800 mb-8">Tem certeza que deseja apagar?</h3>
            <div className="flex gap-4 w-full">
              <button onClick={() => setBookToDelete(null)} className="flex-1 py-5 rounded-2xl font-black text-slate-400 hover:bg-slate-100 transition-all border-2 border-slate-100">Não</button>
              <button onClick={confirmDelete} className="flex-1 py-5 rounded-2xl font-black text-white bg-red-600 hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all">Sim</button>
            </div>
          </div>
        </div>
      )}

      {/* Active Review Add More Confirmation Modal */}
      {showAddMoreFlashcardsModal && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-black max-w-md w-full text-center">
            <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
            </div>
            <h3 className="text-2xl font-black text-slate-800 mb-4">Flash card salvo!</h3>
            <p className="text-slate-500 font-bold mb-10 leading-relaxed">Deseja adicionar mais flash cards para esse assunto?</p>
            <div className="flex gap-4">
              <button 
                onClick={() => {
                  setShowAddMoreFlashcardsModal(false);
                  setView('activeReview');
                }} 
                className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-200 transition-all uppercase text-sm"
              >
                Não
              </button>
              <button 
                onClick={() => {
                  setFlashcardFront('');
                  setFlashcardBack('');
                  setShowAddMoreFlashcardsModal(false);
                  setView('addReviewFlashcardFront');
                }} 
                className="flex-1 py-4 bg-black text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all uppercase text-sm"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {view !== 'menu' && view !== 'vocabulary' && view !== 'vocabRevisionMenu' && view !== 'vocabRevisionSession' && view !== 'vocabRevisionResult' && view !== 'activeReviewSession' && (
        <div className="mb-6 animate-fadeIn">
          <BackButton onClick={() => {
            if (view === 'knowledgeBank' || view === 'curiosity' || view === 'mnemonic' || view === 'activeReview') setView('menu');
            else if (view === 'sessionType') setView('menu');
            else if (view === 'categoryDetail') setView('knowledgeBank');
            else if (view === 'otherSubjectsMenu') setView('myBank');
            else if (view === 'myBank') {
              if (isFromActiveReview) setView('activeReview');
              else setView('categoryDetail');
            }
            else if (view === 'addBookForm' || view === 'addPdfForm' || view === 'addVideoForm' || view === 'addReviewForm' || view === 'addQuestionForm' || view === 'addSimuladoForm') {
              if (isFromActiveReview) {
                setView('activeReview');
              } else if (sharedFormStep === 'study_details') {
                setSharedFormStep('metadata');
              } else {
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
        </div>
      )}

      <div className="flex-1 view-container" key={view}>
        {view === 'menu' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-16">
            <button 
              onClick={() => setView('sessionType')} 
              className="group w-64 aspect-square bg-white border-2 border-[#7EB1FF] rounded-[3rem] shadow-xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#7EB1FF]"
            >
              <div className="p-5 bg-indigo-600 rounded-3xl mb-4 transition-colors duration-300 group-hover:bg-white/20">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-2xl font-black text-slate-800 uppercase tracking-tighter transition-colors duration-300 group-hover:text-white">Estudar</span>
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
                      setView('activeReview');
                    } else if (btn.view === 'knowledgeBank') {
                      setIsFromActiveReview(false);
                      setView('knowledgeBank');
                    } else {
                      setIsFromActiveReview(false);
                      setView(btn.view);
                    }
                  }} 
                  className="px-12 py-5 rounded-[2rem] font-black text-white shadow-xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 bg-[#4A69A2] hover:bg-black"
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

        {view === 'activeReview' && (
          <div className="flex flex-col items-center max-w-4xl mx-auto pt-10">
            <div className="flex flex-col items-center mb-16">
              <h2 className={`text-3xl font-black ${textColor} relative inline-block text-center uppercase tracking-tighter`}>
                Revisão Ativa
                <div className="h-1 bg-[#4A69A2] w-full mt-2 rounded-full"></div>
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-md px-4 justify-items-center">
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
                    // Pular metadados e ir direto para detalhes do estudo (vou estudar para)
                    setSharedFormStep('study_details');
                    setReviewSubject(''); 
                    setReviewMethod('Ativa'); setReviewRepetitions(0); setRevDurationH(0); setRevDurationM(0);
                    setView('addReviewForm');
                  }
                }}
                className="bg-white border-[3px] border-[#4A69A2] rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-all text-black group w-full min-h-[140px]"
              >
                <div className="p-3 rounded-2xl bg-[#4A69A2]/5 group-hover:bg-[#4A69A2]/10 transition-colors text-[#4A69A2]">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="text-lg font-black text-center leading-tight">Adicionar revisão ativa</span>
              </button>
            </div>
          </div>
        )}

        {view === 'myBank' && selectedCategory && (
          <div className="max-w-4xl mx-auto space-y-6 w-full pt-10">
            {(isVideoAulas || isRevisoes || isQuestoes) ? (
              renderStandardizedBank()
            ) : filteredBooks.length > 0 ? (
              <div className="grid gap-6">
                {filteredBooks.map(book => {
                  const percent = book.totalPages > 0 ? Math.round((book.readPages / book.totalPages) * 100) : 0;
                  const isPdfCard = book.categoryId === "Meus PDF's";
                  const isSimCard = book.categoryId === 'Meus simulados';
                  
                  const cardBgColor = book.relevance ? relevanceColorMap[book.relevance] : book.color;

                  return (
                    <div 
                      key={book.id} 
                      onClick={() => onOpenDetail?.(book)} 
                      className="group p-8 rounded-[2.5rem] flex items-center gap-6 text-white shadow-xl cursor-pointer hover:scale-[1.02] transition-all relative border-[3px] border-[#EAB308]" 
                      style={{ backgroundColor: cardBgColor }}
                    >
                      <button onClick={(e) => { e.stopPropagation(); setBookToDelete(book); }} className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:scale-110 active:scale-95 z-20 border-2 border-white"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                      <div className="w-16 h-16 bg-white/30 rounded-2xl flex items-center justify-center shrink-0 border border-white/20">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          {isPdfCard ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />}
                        </svg>
                      </div>
                      <div className="flex-1 flex flex-col">
                        <h3 className="text-3xl font-black mb-3 text-left tracking-tight">{book.name}</h3>
                        <div className="w-full bg-black/30 rounded-2xl p-4 flex flex-col gap-2">
                          <div className="flex justify-between items-center px-1">
                            <span className="text-sm font-black text-white">{isSimCard ? 'Progresso' : book.readPages + ' páginas lidas'}</span>
                            <span className="text-sm font-black text-white">{percent}%</span>
                          </div>
                          <div className="w-full h-3 bg-white/20 rounded-full overflow-hidden"><div className="h-full bg-white/50 rounded-full transition-all duration-700" style={{ width: `${percent}%` }}></div></div>
                        </div>
                      </div>
                      <div className="shrink-0 text-white/80 group-hover:translate-x-1 transition-transform"><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg></div>
                    </div>
                  );
                })}
              </div>
            ) : <div className={`text-center py-24 ${isDarkMode ? 'bg-black border-slate-800' : 'bg-white border-slate-200'} rounded-[3rem] border-2 border-dashed text-slate-300 font-bold uppercase tracking-widest`}>nenhum arquivo salvo</div>}
          </div>
        )}

        {view === 'knowledgeBank' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 max-w-5xl mx-auto pt-10">
            {categories.map((item, idx) => (
              <button key={idx} onClick={() => { setIsFromActiveReview(false); setSelectedCategory(item); setView('categoryDetail'); }} className="group flex flex-col items-center justify-center gap-6 p-10 border-2 rounded-[2rem] hover:scale-105 transition-all shadow-xl text-center hover:bg-[#7EB1FF] hover:border-transparent bg-white border-black text-slate-800">
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
              <button onClick={() => { if (isVideoAulas || isRevisoes || isQuestoes) { setStandardBankMode('ensino_medio'); setStandardBankStep('disciplines'); setStandardBankPath([]); } setView('myBank'); }} className="bg-black rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-all text-white group w-full min-h-[140px]">
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
                className="bg-white border-[3px] border-[#4A69A2] rounded-[1.5rem] p-5 flex flex-col items-center justify-center gap-3 shadow-xl hover:scale-105 transition-all text-black group w-full min-h-[140px]"
              >
                <div className="p-3 rounded-2xl bg-[#4A69A2]/5 group-hover:bg-[#4A69A2]/10 transition-colors text-[#4A69A2]"><svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg></div>
                <span className="text-lg font-black text-center leading-tight">Adicionar {selectedCategory.singular}</span>
              </button>
            </div>
          </div>
        )}

        {/* Formulários Padronizados (Passo 1) */}
        {view === 'addVideoForm' && sharedFormStep === 'metadata' && (
          <div className="flex flex-col items-center gap-8 max-xl mx-auto pt-4 pb-12">
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">🎥</span><label className="text-lg font-black text-slate-800">Assunto da videoaula:</label></div>
              <input type="text" value={videoSubject} onChange={(e) => setVideoSubject(e.target.value)} placeholder="Digite o assunto..." className="w-full p-4 rounded-[1.5rem] border-2 border-black bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300" />
            </div>
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">🎯</span><label className="text-lg font-black text-slate-800">Finalidade:</label></div>
              <div className="flex border-2 border-black rounded-2xl overflow-hidden bg-white"><button onClick={() => setVideoFinality('Para estudo')} className={`flex-1 py-4 font-black transition-all ${videoFinality === 'Para estudo' ? 'bg-black text-white' : 'text-slate-800'}`}>Para estudo</button><button onClick={() => setVideoFinality('Entretenimento')} className={`flex-1 py-4 font-black transition-all ${videoFinality === 'Entretenimento' ? 'bg-black text-white' : 'text-slate-800'}`}>Entretenimento</button></div>
            </div>
            <div className="w-full">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-xl">📁</span>
                <label className="text-lg font-black text-slate-800">De onde é? (Fonte)</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {['YouTube', 'Faculdade', 'Curso preparatório', 'Outro'].map((src) => (
                  <button 
                    key={src} 
                    onClick={() => setVideoSource(src as any)} 
                    className={`py-4 px-2 rounded-2xl font-black text-sm border-2 transition-all hover:border-red-600 ${videoSource === src ? 'bg-black text-white border-black' : 'bg-white text-black border-black'}`}
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
                    className="w-full p-4 rounded-xl border-2 border-black font-bold outline-none bg-white text-slate-800"
                  />
                </div>
              )}
            </div>

            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⏱️</span><label className="text-lg font-black text-slate-800">Duração da aula:</label></div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setVDurationH(Math.max(0, (vDurationH || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[60px]">
                    <input type="number" value={vDurationH === undefined ? '' : vDurationH} onFocus={() => setVDurationH(undefined)} onBlur={() => { if (vDurationH === undefined) setVDurationH(0); }} onChange={(e) => setVDurationH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black opacity-30">horas</span>
                  </div>
                  <button onClick={() => setVDurationH((vDurationH || 0) + 1)} className={numericBtnClass}>+</button>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setVDurationM(Math.max(0, (vDurationM || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[60px]">
                    <input type="number" value={vDurationM === undefined ? '' : vDurationM} onFocus={() => setVDurationM(undefined)} onBlur={() => { if (vDurationM === undefined) setVDurationM(0); }} onChange={(e) => setVDurationM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black opacity-30">min</span>
                  </div>
                  <button onClick={() => setVDurationM(Math.min(59, (vDurationM || 0) + 1))} className={numericBtnClass}>+</button>
                </div>
              </div>
            </div>

            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⏱️</span><label className="text-lg font-black text-slate-800">Em quanto tempo você acha que termina essa vídeo aula: (tempo estimado de término)</label></div>
              <div className="flex items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setVCompletionH(Math.max(0, (vCompletionH || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[60px]">
                    <input type="number" value={vCompletionH === undefined ? '' : vCompletionH} onFocus={() => setVCompletionH(undefined)} onBlur={() => { if (vCompletionH === undefined) setVCompletionH(0); }} onChange={(e) => setVCompletionH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black opacity-30">horas</span>
                  </div>
                  <button onClick={() => setVCompletionH((vCompletionH || 0) + 1)} className={numericBtnClass}>+</button>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => setVCompletionM(Math.max(0, (vCompletionM || 0) - 1))} className={numericBtnClass}>-</button>
                  <div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[60px]">
                    <input type="number" value={vCompletionM === undefined ? '' : vCompletionM} onFocus={() => setVCompletionM(undefined)} onBlur={() => { if (vCompletionM === undefined) setVCompletionM(0); }} onChange={(e) => setVCompletionM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" />
                    <span className="text-[10px] uppercase font-black opacity-30">min</span>
                  </div>
                  <button onClick={() => setVCompletionM(Math.min(59, (vCompletionM || 0) + 1))} className={numericBtnClass}>+</button>
                </div>
              </div>
            </div>

            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⭐</span><label className="text-lg font-black text-slate-800">Grau de relevância:</label></div><div className="flex flex-wrap justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setVideoRelevance(rel)} className={getRelevanceBtnClass(rel, videoRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-2xl">🎨</span><label className="text-lg font-black text-slate-800">Escolha uma cor:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setVideoColor(color)} className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm ${videoColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <button 
              onClick={() => { 
                if(!videoSubject.trim()){ 
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
          </div>
        )}

        {view === 'addReviewForm' && sharedFormStep === 'metadata' && (
          <div className="flex flex-col items-center gap-8 max-xl mx-auto pt-4 pb-12">
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">📝</span><label className="text-lg font-black text-slate-800">Assunto da revisão:</label></div><input type="text" value={reviewSubject} onChange={(e) => setReviewSubject(e.target.value)} placeholder="Digite o assunto da revisão..." className="w-full p-4 rounded-[1.5rem] border-2 border-black bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300" /></div>
            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-xl">📝</span>
                <label className="text-lg font-black text-slate-800">Qual o tipo de revisão?</label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <button onClick={() => setReviewMethod('Ativa')} className={`py-4 rounded-[1.5rem] font-black border-2 transition-all shadow-sm ${reviewMethod === 'Ativa' ? 'bg-black text-white border-black' : 'bg-white text-black border-[#4A69A2]'}`}>Revisão Ativa</button>
                  {reviewMethod === 'Ativa' && <p className="text-[10px] font-black italic text-slate-400 ladies-tight animate-fadeIn">vou forçar meu cérebro a lembrar, sem olhar para o que escrevi</p>}
                </div>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setReviewMethod('Passiva')} className={`py-4 rounded-[1.5rem] font-black border-2 transition-all shadow-sm ${reviewMethod === 'Passiva' ? 'bg-black text-white border-black' : 'bg-white text-black border-[#4A69A2]'}`}>Revisão Passiva</button>
                  {reviewMethod === 'Passiva' && <p className="text-[10px] font-black italic text-slate-400 ladies-tight animate-fadeIn">vou ler o que foi estudado</p>}
                </div>
              </div>
            </div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">🔄</span><label className="text-lg font-black text-slate-800">Quantas vezes é preciso revisar este conteúdo?</label></div><div className="flex items-center justify-center gap-6"><button onClick={() => setReviewRepetitions(Math.max(0, (reviewRepetitions || 0) - 1))} className={numericBtnClass}>-</button><div className="flex items-baseline gap-2 border-b-2 border-[#4A69A2] pb-1 min-w-[120px] justify-center"><input type="number" value={reviewRepetitions === undefined ? '' : reviewRepetitions} onFocus={() => setReviewRepetitions(undefined)} onBlur={() => { if (reviewRepetitions === undefined) setReviewRepetitions(0); }} onChange={(e) => setReviewRepetitions(parseInt(e.target.value) || 0)} className="w-20 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="textxl font-black text-[#4A69A2]">vezes</span></div><button onClick={() => setReviewRepetitions((reviewRepetitions || 0) + 1)} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⏱️</span><label className="text-lg font-black text-slate-800">Qual a duração da sua revisão?</label></div><div className="flex items-center justify-center gap-4"><div className="flex items-center gap-3"><button onClick={() => setRevDurationH(Math.max(0, (revDurationH || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[70px]"><input type="number" value={revDurationH === undefined ? '' : revDurationH} onFocus={() => setRevDurationH(undefined)} onBlur={() => { if (revDurationH === undefined) setRevDurationH(0); }} onChange={(e) => setRevDurationH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black opacity-30">horas</span></div><button onClick={() => setRevDurationH((revDurationH || 0) + 1)} className={numericBtnClass}>+</button></div><div className="flex items-center gap-3"><button onClick={() => setRevDurationM(Math.max(0, (revDurationM || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[70px]"><input type="number" value={revDurationM === undefined ? '' : revDurationM} onFocus={() => setRevDurationM(undefined)} onBlur={() => { if (revDurationM === undefined) setRevDurationM(0); }} onChange={(e) => setRevDurationM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black opacity-30">minutos</span></div><button onClick={() => setRevDurationM(Math.min(59, (revDurationM || 0) + 1))} className={numericBtnClass}>+</button></div></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⭐</span><label className="text-lg font-black text-slate-800">Qual o grau de relevância?</label></div><div className="flex justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setReviewRelevance(rel)} className={getRelevanceBtnClass(rel, reviewRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-2xl">🎨</span><label className="text-lg font-black text-slate-800">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setReviewColor(color)} className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm ${reviewColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <button 
              disabled={!reviewSubject.trim() || (reviewRepetitions || 0) === 0 || ((revDurationH || 0) === 0 && (revDurationM || 0) === 0) || reviewMethod === null}
              onClick={() => { 
                if(!reviewSubject.trim()){ 
                  setErrorMsg("Preencha o assunto da revisão."); 
                  setTimeout(() => setErrorMsg(null), 3000); 
                  return; 
                }
                if ((reviewRepetitions || 0) === 0) {
                  setErrorMsg("Por favor, preencha a quantidade de repetições.");
                  setTimeout(() => setErrorMsg(null), 3000);
                  return;
                }
                if ((revDurationH || 0) === 0 && (revDurationM || 0) === 0) {
                  setErrorMsg("Por favor, preencha a duração da sua revisão.");
                  setTimeout(() => setErrorMsg(null), 3000); 
                  return;
                }
                setSharedFormStep('study_details'); 
              }} 
              className={`w-full py-5 rounded-3xl text-white font-black text-2xl shadow-xl transition-all active:scale-95 ${(!reviewSubject.trim() || (reviewRepetitions || 0) === 0 || ((revDurationH || 0) === 0 && (revDurationM || 0) === 0) || reviewMethod === null) ? 'bg-slate-300 cursor-not-allowed opacity-50' : 'bg-[#6279A8] hover:bg-[#4A69A2]'}`}
            >
              Próximo
            </button>
          </div>
        )}

        {view === 'addQuestionForm' && sharedFormStep === 'metadata' && (
          <div className="flex flex-col items-center gap-8 max-xl mx-auto pt-4 pb-12">
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">❓</span><label className="text-lg font-black text-slate-800">Assunto das questões:</label></div><input type="text" value={questionSubject} onChange={(e) => setQuestionSubject(e.target.value)} placeholder="Digite o assunto das questões..." className="w-full p-4 rounded-[1.5rem] border-2 border-black bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300 text-center" /></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-xl font-black text-slate-800">📁</span><label className="text-xl font-black text-slate-800">Fonte:</label></div><div className="flex flex-wrap justify-center gap-3">{['YouTube', 'Plataforma de questão', 'PDF no tablet ou celular', 'Livro didático', 'Folha física', 'Cursinho online ou presencial', 'Outra fonte'].map((source) => (<button key={source} onClick={() => setQuestionSource(source)} className={`px-6 py-2.5 rounded-full font-black text-xs border-2 transition-all shadow-sm ${questionSource === source ? 'bg-black text-white border-black' : 'bg-white text-[#4A69A2] border-[#4A69A2] hover:bg-slate-50'}`}>{source}</button>))}</div>{questionSource === 'Outra fonte' && (<input type="text" value={questionOtherSource} onChange={(e) => setQuestionOtherSource(e.target.value)} placeholder="Especifique a fonte..." className="mt-4 w-full p-3 rounded-2xl border-2 border-[#4A69A2] font-bold text-slate-800 outline-none text-center" />)}</div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-3 mb-6"><span className="text-xl">🔄</span><label className="text-lg font-black text-slate-800">Quantas questões vai fazer desse assunto?</label></div><div className="flex items-center justify-center gap-8"><button onClick={() => setQuestionQuantity(Math.max(0, (questionQuantity || 0) - 1))} className={numericBtnClass}>-</button><div className="flex items-baseline gap-2 border-b-2 border-[#4A69A2] pb-1 min-w-[120px] justify-center"><input type="number" value={questionQuantity === undefined ? '' : questionQuantity} onFocus={() => setQuestionQuantity(undefined)} onBlur={() => { if (questionQuantity === undefined) setQuestionQuantity(0); }} onChange={(e) => setQuestionQuantity(parseInt(e.target.value) || 0)} className="w-20 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-xl font-black text-[#4A69A2]">questões</span></div><button onClick={() => setQuestionQuantity((questionQuantity || 0) + 1)} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⏱️</span><label className="text-lg font-black text-slate-800 leading-tight">Quanto tempo vai demorar para fazer essa quantidade de questões?</label></div><div className="flex items-center justify-center gap-4"><div className="flex items-center gap-3"><button onClick={() => setQDurationH(Math.max(0, (qDurationH || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[70px]"><input type="number" value={qDurationH === undefined ? '' : qDurationH} onFocus={() => setQDurationH(undefined)} onBlur={() => { if (qDurationH === undefined) setQDurationH(0); }} onChange={(e) => setQDurationH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black opacity-30">horas</span></div><button onClick={() => setQDurationH((qDurationH || 0) + 1)} className={numericBtnClass}>+</button></div><div className="flex items-center gap-3"><button onClick={() => setQDurationM(Math.max(0, (qDurationM || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[70px]"><input type="number" value={qDurationM === undefined ? '' : qDurationM} onFocus={() => setQDurationM(undefined)} onBlur={() => { if (qDurationM === undefined) setQDurationM(0); }} onChange={(e) => setQDurationM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black opacity-30">minutos</span></div><button onClick={() => setQDurationM(Math.min(59, (qDurationM || 0) + 1))} className={numericBtnClass}>+</button></div></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⭐</span><label className="text-lg font-black text-slate-800">Qual o grau de relevância?</label></div><div className="flex justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setQuestionRelevance(rel)} className={getRelevanceBtnClass(rel, questionRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-2xl">🎨</span><label className="text-lg font-black text-slate-800">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setQuestionColor(color)} className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm ${questionColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <button onClick={() => { if(!questionSubject.trim()){ setErrorMsg("Preencha o assunto das questões."); setTimeout(() => setErrorMsg(null), 3000); return; } setSharedFormStep('study_details'); }} className="w-full py-5 rounded-3xl bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95">Próximo</button>
          </div>
        )}

        {/* Formulário Compartilhado (Passo 2) */}
        {(view === 'addVideoForm' || view === 'addReviewForm' || view === 'addQuestionForm') && sharedFormStep === 'study_details' && (() => {
          // Determina quais listas usar com base no tipo selecionado (ISOLAMENTO)
          const currentSavedTopics = videoStudyType === 'ensino_medio' ? savedTopicsHS : savedTopicsUniv;
          const currentSavedSub1 = videoStudyType === 'ensino_medio' ? savedSub1HS : savedSub1Univ;
          const currentSavedSub2 = videoStudyType === 'ensino_medio' ? savedSub2HS : savedSub2Univ;
          const currentSavedSub3 = videoStudyType === 'ensino_medio' ? savedSub3HS : savedSub3Univ;

          return (
            <div className="flex flex-col items-center gap-6 max-2xl mx-auto pt-4 pb-12">
              {/* Campo especial para Revisão Ativa no Passo 2 */}
              {isFromActiveReview && (
                <div className="w-full text-center mb-4">
                  <div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">📝</span><label className="text-lg font-black text-slate-800">Assunto da revisão:</label></div>
                  <input 
                    type="text" 
                    value={reviewSubject} 
                    onChange={(e) => setReviewSubject(e.target.value)} 
                    placeholder="Digite o assunto da revisão..." 
                    className="w-full p-4 rounded-[1.5rem] border-2 border-black bg-white text-slate-800 font-bold outline-none shadow-sm placeholder:text-slate-300" 
                  />
                </div>
              )}

              <div className="w-full text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-4"><span className="text-2xl">🎯</span><h3 className="text-xl font-black text-slate-800">Vou estudar para</h3></div>
                <div className="flex gap-4">
                  <button onClick={() => { setVideoStudyType('ensino_medio'); setVideoDiscipline(''); setVideoArea(''); setVideoMatter(''); setVideoTopic(''); setVideoSub1(''); setVideoSub2(''); setVideoSub3(''); setTopicMode(''); setSub1Mode(''); setSub2Mode(''); setSub3Mode(''); }} className={`flex-1 py-4 px-3 rounded-2xl font-bold transition-all border-2 text-sm leading-tight h-24 flex items-center justify-center ${videoStudyType === 'ensino_medio' ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white text-black border-[#4A69A2]'}`}>Disciplina do ensino médio (ENEM ou vestibulares)</button>
                  <button onClick={() => { setVideoStudyType('faculdade'); setVideoDiscipline(''); setVideoArea(''); setVideoMatter(''); setVideoTopic(''); setVideoSub1(''); setVideoSub2(''); setVideoSub3(''); setTopicMode(''); setSub1Mode(''); setSub2Mode(''); setSub3Mode(''); }} className={`flex-1 py-4 px-3 rounded-2xl font-bold transition-all border-2 text-sm leading-tight h-24 flex items-center justify-center ${videoStudyType === 'faculdade' ? 'bg-black text-white border-black shadow-lg scale-105' : 'bg-white text-black border-[#4A69A2]'}`}>Matéria da Faculdade</button>
                </div>
                {!videoStudyType && <p className="text-red-400 font-bold text-xs mt-4 animate-pulse">Selecione uma option acima para liberar os tópicos</p>}
              </div>

              {videoStudyType === 'ensino_medio' && (
                <div className="w-full flex flex-col gap-6">
                  <div className="flex flex-col md:flex-row gap-4 w-full items-end">
                    <div className="flex-1 flex flex-col gap-2 text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Disciplina</label><select value={videoDiscipline} onChange={(e) => { setVideoDiscipline(e.target.value); setVideoArea(''); setVideoMatter(''); }} className="w-full p-4 border-2 border-[#4A69A2] rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{disciplinesList.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
                    {(videoDiscipline === 'Geografia' || videoDiscipline === 'História' || videoDiscipline === 'Português') && (
                      <div className="flex-1 flex flex-col gap-2 text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Área</label><select value={videoArea} onChange={(e) => { setVideoArea(e.target.value); setVideoMatter(''); }} className="w-full p-4 border-2 border-[#4A69A2] rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{videoDiscipline === 'Geografia' && (<><option value="Geografia física">Geografia física</option><option value="Geografia humana">Geografia humana</option></>)}{videoDiscipline === 'História' && (<><option value="História geral">História geral</option><option value="História do Brasil">História do Brasil</option></>)}{videoDiscipline === 'Português' && (<><option value="Gramática">Gramática</option><option value="Interpretação de texto">Interpretação de texto</option></>)}</select></div>
                    )}
                    {((videoDiscipline && !['Geografia', 'História', 'Português'].includes(videoDiscipline)) || (videoDiscipline && ['Geografia', 'História', 'Português'].includes(videoDiscipline) && videoArea)) && (
                      <div className="flex-1 flex flex-col gap-2 text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">Matéria</label><select value={videoMatter} onChange={(e) => setVideoMatter(e.target.value)} className="w-full p-4 border-2 border-[#4A69A2] rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{(videoDiscipline === 'Geografia' || videoDiscipline === 'História' || videoDiscipline === 'Português') ? videoArea && areaMatters[videoArea]?.map(m => <option key={m} value={m}>{m}</option>) : videoDiscipline && disciplineMatters[videoDiscipline]?.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    )}
                  </div>
                </div>
              )}

              {videoStudyType === 'faculdade' && (
                <div className="w-full text-left"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 block">Matéria</label><input type="text" value={videoMatter} onChange={(e) => setVideoMatter(e.target.value)} placeholder="Digite o nome da matéria..." className="w-full p-4 border-2 border-black rounded-xl font-bold text-slate-800 outline-none bg-white placeholder:text-slate-200" /></div>
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
                        <div className="flex flex-row items-start gap-3">
                          <select 
                            value={field.mode} 
                            onChange={(e) => field.setMode(e.target.value as any)} 
                            className="flex-1 p-4 border-2 border-[#4A69A2] rounded-xl font-bold text-slate-800 outline-none bg-white"
                          >
                            <option value="" disabled hidden>Selecione uma option...</option>
                            <option value="add">+ Adicionar novo</option>
                            <option value="select">📁 Meus salvos</option>
                          </select>
                          {field.mode !== '' && (
                            <div className="flex-1 flex gap-2 items-center">
                              {field.mode === 'add' ? (
                                <><input type="text" value={field.temp} onChange={(e) => field.setTemp(e.target.value)} placeholder="Novo..." className="flex-1 p-4 border-2 border-[#4A69A2] rounded-xl font-bold text-slate-800 outline-none bg-white placeholder:text-slate-200" /><button onClick={() => addNewSavedItem(field.type as any, field.temp)} className="px-6 py-4 bg-[#6279A8] text-white rounded-xl font-black text-sm shadow-sm hover:brightness-110 active:scale-95 transition-all">OK</button></>
                              ) : (
                                <select value={field.val} onChange={(e) => field.setVal(e.target.value)} className="w-full p-4 border-2 border-[#4A69A2] rounded-xl font-bold text-slate-800 outline-none bg-white"><option value="" disabled hidden>Selecione...</option>{field.list.map(t => <option key={t} value={t}>{t}</option>)}</select>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={isFromActiveReview ? () => { if(!reviewSubject.trim()){ setErrorMsg("Por favor, preencha o assunto da revisão."); setTimeout(() => setErrorMsg(null), 3000); return; } setView('addReviewFlashcardFront'); } : () => handleFinalizeStudyItem(true)} className="w-full py-5 mt-8 rounded-[1.5rem] bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95">
                    {isFromActiveReview ? 'Próximo(1/2)' : 'Salvar'}
                  </button>
                </div>
              )}
            </div>
          );
        })()}

        {/* Adicionar Revisão Ativa - Fluxo de Flashcard */}
        {view === 'addReviewFlashcardFront' && (
          <div className="flex flex-col items-center gap-10 max-xl mx-auto pt-10 animate-fadeIn">
            <div className="w-full text-center">
                <h3 className="text-4xl font-black text-slate-800 uppercase tracking-widest mb-20 leading-loose">Defina a frente do seu flash card</h3>
                <textarea 
                    value={flashcardFront}
                    onChange={(e) => setFlashcardFront(e.target.value)}
                    placeholder="Digite a pergunta ou termo..."
                    className="w-full p-8 border-[3px] border-black rounded-[2.5rem] font-bold text-2xl outline-none shadow-xl bg-white text-slate-800 min-h-[250px] resize-none placeholder:text-slate-200"
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
                className="w-full max-w-md py-6 rounded-[2rem] bg-black text-white font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all"
            >
                Próximo(2/2)
            </button>
          </div>
        )}

        {view === 'addReviewFlashcardBack' && (
          <div className="animate-fadeIn max-w-5xl mx-auto pt-10">
            <div className="bg-white border-2 border-black rounded-[3rem] shadow-2xl relative overflow-hidden">
                {/* Toolbar Estilo Notas */}
                <div className="bg-slate-50 border-b-2 border-black p-6 flex flex-wrap gap-4 gap-y-4 items-center rounded-t-[3rem] sticky top-0 z-[1100]">
                    <div className="relative" ref={fontMenuRef}>
                        <button onMouseDown={(e) => { e.preventDefault(); setIsFontMenuOpen(!isFontMenuOpen); setIsFontSizeMenuOpen(false); setIsMarkersMenuOpen(false); }} className="bg-white border-2 border-black rounded-xl px-4 py-2 min-w-[150px] flex justify-between items-center font-bold text-xs text-black shadow-sm">
                        {activeFont} <span className="ml-2 text-[10px]">▼</span>
                        </button>
                        {isFontMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-white border-2 border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">
                            {fonts.map(f => (
                            <button key={f.name} onMouseDown={(e) => { e.preventDefault(); execCommand('fontName', f.value); setIsFontMenuOpen(false); }} className={`w-full text-left px-5 py-3 text-sm hover:bg-slate-50 text-black border-b last:border-0 border-slate-100 ${activeFont.toLowerCase().includes(f.name.toLowerCase()) ? 'bg-slate-100' : ''}`} style={{ fontFamily: f.value }}>{f.name}</button>
                            ))}
                        </div>
                        )}
                    </div>
                    <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className={`w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg transition-all shadow-sm ${activeBold ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}>B</button>
                    <div className="flex bg-white border-2 border-black rounded-xl overflow-hidden p-0.5 shadow-sm">
                        {[{ cmd: 'justifyLeft', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h10M4 18h16" /> }, { cmd: 'justifyCenter', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M7 12h10M4 18h16" /> }, { cmd: 'justifyRight', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M10 12h10M4 18h16" /> }].map(align => (
                        <button key={align.cmd} onMouseDown={(e) => { e.preventDefault(); execCommand(align.cmd); }} className={`p-2.5 rounded-lg transition-colors ${activeAlign === align.cmd ? 'bg-black text-white' : 'hover:bg-slate-100 text-black'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{align.icon}</svg></button>
                        ))}
                    </div>
                    <div className="relative" ref={markersMenuRef}>
                        <button onMouseDown={(e) => { e.preventDefault(); setIsMarkersMenuOpen(!isMarkersMenuOpen); setIsFontMenuOpen(false); setIsFontSizeMenuOpen(false); }} className={`px-5 py-2 border-2 border-black rounded-xl flex items-center gap-3 font-black text-xs transition-all shadow-sm ${isMarkersMenuOpen ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>Simbolos</button>
                        {isMarkersMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-40 bg-white border-2 border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">{markers.map(m => (<button key={m.name} onMouseDown={(e) => { e.preventDefault(); insertMarker(m.char); }} className="w-full text-left px-5 py-3 text-xl hover:bg-slate-50 transition-colors text-black flex items-center justify-between border-b last:border-0 border-slate-100"><span className="text-[10px] font-black text-slate-400 uppercase">{m.name}</span><span className="font-bold">{m.char}</span></button>))}</div>
                        )}
                    </div>
                    <div className="h-8 w-px bg-slate-200 hidden md:block"></div>
                    <div className="flex gap-2.5">{['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (<button key={c} onMouseDown={(e) => { e.preventDefault(); execCommand('foreColor', c); }} className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-125 shadow-sm ${activeColor === c ? 'border-black scale-125 ring-2 ring-slate-100' : 'border-white ring-1 ring-black/10'}`} style={{ backgroundColor: c }} />))}</div>
                    <div className="relative" ref={fontSizeMenuRef}>
                        <button onMouseDown={(e) => { e.preventDefault(); setIsFontSizeMenuOpen(!isFontSizeMenuOpen); setIsFontMenuOpen(false); setIsMarkersMenuOpen(false); }} className="bg-white border-2 border-black rounded-xl px-4 py-2 min-w-[140px] flex justify-between items-center font-bold text-xs text-black shadow-sm">
                        {fontSizes.find(s => s.value === activeSize)?.name || 'Tamanho'} <span className="ml-2 text-[10px]">▼</span>
                        </button>
                        {isFontSizeMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-44 bg-white border-2 border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">{fontSizes.map(s => (<button key={s.value} onMouseDown={(e) => { e.preventDefault(); execCommand('fontSize', s.value); setIsFontSizeMenuOpen(false); }} className={`w-full text-left px-5 py-3 text-xs transition-all hover:bg-slate-50 text-black border-b last:border-0 border-slate-100 ${activeSize === s.value ? 'bg-slate-100' : ''}`}>{s.name}</button>))}</div>
                        )}
                    </div>
                </div>
                <div className="bg-white p-12 min-h-[500px] flex flex-col rounded-b-[3rem]">
                    <div className="mb-6 flex flex-col gap-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">DEFINA O VERSO DO SEU FLASH CARD (RESPOSTA):</span>
                    </div>
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
                </div>
                <div className="bg-slate-50 border-t-2 border-black p-10 flex justify-center gap-6 rounded-b-[3rem]">
                    <button 
                        onClick={() => handleFinalizeStudyItem(false)} 
                        className="bg-white text-black border-2 border-black px-10 py-5 rounded-[2.5rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all"
                    >
                        Salvar flash card
                    </button>
                    <button 
                        onClick={() => handleFinalizeStudyItem(true)} 
                        className="bg-black text-white px-20 py-5 rounded-[2.5rem] font-black text-2xl shadow-2xl hover:scale-105 active:scale-95 transition-all shadow-black/20"
                    >
                        Finalizar
                    </button>
                </div>
            </div>
          </div>
        )}

        {/* Simulados e Livros (Mantidos como estavam) */}
        {view === 'addSimuladoForm' && (
          <div className="flex flex-col items-center gap-8 max-xl mx-auto pt-4 pb-12">
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-xl">🏷️</span><label className="text-lg font-black text-slate-800">Esse simulado é do:</label></div><div className="flex justify-center gap-3">{['ENEM', 'Vestibulares', 'Faculdade'].map((origin) => (<button key={origin} onClick={() => setSimOrigin(origin as any)} className={`px-8 py-3 rounded-2xl font-black text-sm border-2 transition-all shadow-sm ${simOrigin === origin ? 'bg-black text-white border-black' : 'bg-white text-black border-[#4A69A2] hover:bg-slate-50'}`}>{origin}</button>))}</div></div>
            <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4"><div className="flex flex-col"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Ano</label><select value={simYear} onChange={(e) => setSimYear(e.target.value)} className="p-3 rounded-2xl border-2 border-[#4A69A2] font-black text-slate-800 outline-none bg-white shadow-sm appearance-none text-center cursor-pointer">{Array.from({length: 2026 - 2009 + 1}, (_, i) => 2026 - i).map(year => (<option key={year} value={year}>{year}</option>))}</select></div>{simOrigin === 'ENEM' && (<div className="flex flex-col"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Tipo</label><select value={simType} onChange={(e) => setSimType(e.target.value)} className="p-3 rounded-2xl border-2 border-[#4A69A2] font-black text-slate-800 outline-none bg-white shadow-sm appearance-none text-center cursor-pointer">{['Aplicação regular', 'PPL', 'Libras'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>)}{(simOrigin === 'ENEM' || simOrigin === 'Vestibulares') && (<div className="flex flex-col"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Área</label><select value={simArea} onChange={(e) => setSimArea(e.target.value)} className="p-3 rounded-2xl border-2 border-black font-black text-slate-800 outline-none bg-white shadow-sm appearance-none text-center cursor-pointer">{['Natureza', 'Linguagem', 'Humanas', 'Exatas', 'Todo o primeiro dia', 'Todo o segundo dia'].map(a => <option key={a} value={a}>{a}</option>)}</select></div>)}{simOrigin === 'ENEM' && (<div className="flex flex-col"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Cor da prova</label><input type="text" value={simTestColorName} onChange={(e) => setSimTestColorName(e.target.value)} placeholder="Ex: Azul.." className="p-3 rounded-2xl border-2 border-[#4A69A2] font-black text-slate-800 outline-none bg-white shadow-sm placeholder:text-slate-300 text-center" /></div>)}{simOrigin === 'Vestibulares' && (<div className="flex flex-col col-span-2 md:col-span-2"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center">Nome do vestibular</label><input type="text" value={simVestName} onChange={(e) => setSimVestName(e.target.value)} placeholder="Ex: USP, UNESP..." className="p-3 rounded-2xl border-2 border-[#4A69A2] font-black text-slate-800 outline-none bg-white shadow-sm placeholder:text-slate-300 text-center" /></div>)}{simOrigin === 'Faculdade' && (<div className="flex flex-col col-span-2 md:col-span-3"><label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest mb-2 text-center uppercase">Essa prova é de qual assunto?</label><input type="text" value={simSubject} onChange={(e) => setSimSubject(e.target.value)} placeholder="Ex: Anatomia, Cálculo I..." className="p-3 rounded-2xl border-2 border-[#4A69A2] font-black text-slate-800 outline-none bg-white shadow-sm placeholder:text-slate-300 text-center w-full" /></div>)}</div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">📊</span><label className="text-lg font-black text-slate-800">Quantas questões tem esse simulado?</label></div><div className="flex items-center justify-center gap-8"><button onClick={() => setSimQty(Math.max(0, (simQty || 0) - 1))} className={numericBtnClass}>-</button><div className="flex items-baseline gap-2 border-b-2 border-[#4A69A2] pb-1 min-w-[120px] justify-center"><input type="number" value={simQty === undefined ? '' : simQty} onFocus={() => setSimQty(undefined)} onBlur={() => { if(simQty === undefined) setSimQty(0); }} onChange={(e) => setSimQty(parseInt(e.target.value) || 0)} className="w-20 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="textxl font-black text-[#4A69A2]">questões</span></div><button onClick={() => setSimQty((simQty || 0) + 1)} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⏱️</span><label className="text-lg font-black text-slate-800">Qual a duração do seu simulado?</label></div><div className="flex items-center justify-center gap-4"><div className="flex items-center gap-3"><button onClick={() => setSimDurH(Math.max(0, (simDurH || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[70px]"><input type="number" value={simDurH === undefined ? '' : simDurH} onFocus={() => setSimDurH(undefined)} onBlur={() => { if (simDurH === undefined) setSimDurH(0); }} onChange={(e) => setSimDurH(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black opacity-30">horas</span></div><button onClick={() => setSimDurH((simDurH || 0) + 1)} className={numericBtnClass}>+</button></div><div className="flex items-center gap-3"><button onClick={() => setSimDurM(Math.max(0, (simDurM || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[70px]"><input type="number" value={simDurM === undefined ? '' : simDurM} onFocus={() => setSimDurM(undefined)} onBlur={() => { if (simDurM === undefined) setSimDurM(0); }} onChange={(e) => setSimDurM(parseInt(e.target.value) || 0)} className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><span className="text-[10px] uppercase font-black opacity-30">minutos</span></div><button onClick={() => setSimDurM(Math.min(59, (simDurM || 0) + 1))} className={numericBtnClass}>+</button></div></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-2xl">🎨</span><label className="text-lg font-black text-slate-800">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setSimColor(color)} className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm ${simColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <button onClick={handleAddSimulado} className="w-full py-5 rounded-3xl bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95">Salvar</button>
          </div>
        )}

        {view === 'addBookForm' && (
          <div className="flex flex-col items-center gap-8 max-xl mx-auto pt-6">
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">📖</span><label className="text-lg font-black text-slate-800">Nome do livro:</label></div><input type="text" value={bookName} onChange={(e) => setBookName(e.target.value)} placeholder="Digite o nome do livro..." className="w-full p-4 rounded-2xl border-2 border-[#4A69A2] bg-white text-slate-800 font-bold placeholder:text-slate-300 outline-none shadow-sm" /></div>
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">📚</span><label className="text-lg font-black text-slate-800">Este livro é:</label></div><div className="flex border-2 border-[#4A69A2] rounded-2xl overflow-hidden bg-white shadow-sm"><button onClick={() => setBookType('didatico')} className={`flex-1 py-4 font-black transition-all ${bookType === 'didatico' ? 'bg-black text-white' : 'text-slate-800'}`}>Livro didático</button><button onClick={() => setBookType('outro')} className={`flex-1 py-4 font-black transition-all ${bookType === 'outro' ? 'bg-black text-white' : 'text-slate-800'}`}>Outro tipo</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">⌛</span><label className="text-lg font-black text-slate-800">Tempo de término do livro (estimativa)</label></div><div className="flex items-center justify-center gap-8"><button onClick={() => setEstimateDays(prev => Math.max(1, (prev || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col items-center"><input type="number" value={estimateDays === undefined ? '' : estimateDays} onFocus={() => setEstimateDays(undefined)} onBlur={() => { if (estimateDays === undefined) setEstimateDays(30); }} onChange={(e) => setEstimateDays(parseInt(e.target.value) || 0)} className="w-20 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><div className="h-0.5 w-16 bg-[#4A69A2] mb-1"></div><span className="text-lg font-black text-[#4A69A2]">dias</span></div><button onClick={() => setEstimateDays(prev => Math.min(730, (prev || 0) + 1))} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-2xl">📄</span><label className="text-lg font-black text-slate-800">Quantas páginas esse livro tem?</label></div><div className="flex items-center justify-center gap-8"><button onClick={() => setTotalPages(prev => Math.max(1, (prev || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col items-center"><input type="number" value={totalPages === undefined ? '' : totalPages} onFocus={() => setTotalPages(undefined)} onBlur={() => { if (totalPages === undefined) setTotalPages(200); }} onChange={(e) => setTotalPages(parseInt(e.target.value) || 0)} className="w-24 text-center text-3xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none" /><div className="h-0.5 w-20 bg-[#4A69A2] mb-1"></div><span className="text-xs font-black text-slate-400">páginas</span></div><button onClick={() => setTotalPages(prev => Math.min(1000, (prev || 0) + 1))} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-4"><span className="text-2xl">🎨</span><label className="text-lg font-black text-slate-800">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-3">{colorPalette.map(color => (<button key={color} onClick={() => setSelectedColor(color)} className={`w-8 h-8 rounded-full border-2 transition-all shadow-sm ${selectedColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <button onClick={handleAddBook} className="w-full py-5 mt-4 rounded-3xl bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2] transition-all active:scale-95">Salvar</button>
          </div>
        )}

        {view === 'addPdfForm' && (
          <div className="flex flex-col items-center gap-6 max-xl mx-auto pt-4">
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-2"><span className="text-xl">📄</span><label className="text-lg font-black text-slate-800">Assunto do PDF:</label></div><input type="text" value={pdfSubject} onChange={(e) => setPdfSubject(e.target.value)} placeholder="Digite o assunto do PDF..." className="w-full p-4 rounded-2xl border-2 border-[#4A69A2] bg-white text-slate-800 font-bold outline-none shadow-sm" /></div>
            <div className="w-full"><div className="flex items-center justify-center gap-2 mb-2"><span className="text-xl">📂</span><label className="text-lg font-black text-slate-800">Tipo de material:</label></div><div className="flex border-2 border-[#4A69A2] rounded-2xl overflow-hidden bg-white"><button onClick={() => setPdfType('didatico')} className={`flex-1 py-3 font-black transition-all ${pdfType === 'didatico' ? 'bg-black text-white' : 'text-slate-800'}`}>Didático</button><button onClick={() => setPdfType('outro')} className={`flex-1 py-3 font-black transition-all ${pdfType === 'outro' ? 'bg-black text-white' : 'text-slate-800'}`}>Outro tipo</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-2"><span className="text-xl">📄</span><label className="text-lg font-black text-slate-800">Quantas páginas esse PDF tem?</label></div><div className="flex items-center justify-center gap-6"><button onClick={() => setPdfPages(prev => Math.max(1, (prev || 0) - 1))} className={numericBtnClass}>-</button><div className="flex flex-col items-center"><input type="number" value={pdfPages === undefined ? '' : pdfPages} onFocus={() => setPdfPages(undefined)} onBlur={() => { if (pdfPages === undefined) setPdfPages(10); }} onChange={(e) => setPdfPages(parseInt(e.target.value) || 0)} className="w-16 text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none" /><div className="h-0.5 w-12 bg-[#4A69A2] -mt-1"></div><span className="text-[10px] font-black text-slate-400 mt-1 uppercase">páginas</span></div><button onClick={() => setPdfPages(prev => Math.min(2000, (prev || 0) + 1))} className={numericBtnClass}>+</button></div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">⭐</span><label className="text-lg font-black text-slate-800">Qual o grau de relevância?</label></div><div className="flex flex-wrap justify-center gap-2">{(['Alta', 'Média', 'Baixa', 'Baixíssima'] as Relevance[]).map((rel) => (<button key={rel} onClick={() => setPdfRelevance(rel)} className={getRelevanceBtnClass(rel, pdfRelevance)}>{rel}</button>))}</div></div>
            <div className="w-full text-center"><div className="flex items-center justify-center gap-2 mb-3"><span className="text-xl">🎨</span><label className="text-lg font-black text-slate-800">Escolha uma cor para ele:</label></div><div className="flex flex-wrap justify-center gap-2">{colorPalette.map(color => (<button key={color} onClick={() => setPdfColor(color)} className={`w-7 h-7 rounded-full border-2 transition-all shadow-sm ${pdfColor === color ? 'border-black scale-125' : 'border-transparent'}`} style={{ backgroundColor: color }} />))}</div></div>
            <button onClick={handleAddPdf} className="w-full py-5 mt-2 rounded-[2rem] bg-[#6279A8] text-white font-black text-2xl shadow-xl hover:bg-[#4A69A2]">Salvar</button>
          </div>
        )}

        {view === 'sessionType' && (
           <div className="flex flex-col items-center justify-center gap-8 pt-10">
              <h2 className={`text-4xl font-black ${textColor} mb-8`}>Sua sessão será com:</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-5xl">
                 {['Meus livros', "Meus PDF's", 'Minhas vídeo aulas', 'Meus simulados'].map((item) => (
                   <button key={item} className="bg-white border-2 border-black p-10 rounded-[2.5rem] flex flex-col items-center gap-4 hover:bg-[#7EB1FF] hover:border-transparent group transition-all duration-300 shadow-xl">
                     <span className="text-xl font-black group-hover:text-white transition-colors">{item}</span>
                   </button>
                 ))}
              </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default Study;
