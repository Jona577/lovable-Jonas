import React, { useState, useEffect } from 'react';
import { Page } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import Study from '@/components/Study';
import Tasks from '@/components/Tasks';
import Routine from '@/components/Routine';
import Habits from '@/components/Habits';
import Goals from '@/components/Goals';
import Stats from '@/components/Stats';
import Others from '@/components/Others';
import Settings from '@/components/Settings';

const Index: React.FC = () => {
  const [activePage, setActivePage] = useState<Page>('Study');
  const [userName, setUserName] = useState('Usuário');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fullScreenItem, setFullScreenItem] = useState<any | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [studyView, setStudyView] = useState<string>('menu');
  const [taskView, setTaskView] = useState<string>('tasks');
  const [othersView, setOthersView] = useState<string>('entry');

  // Views do Study que devem esconder a sidebar e ocupar tela cheia
  const fullPageStudyViews = [
    'knowledgeBank', 'categoryDetail', 'myBank', 'addBookForm', 'addPdfForm',
    'addVideoForm', 'addReviewForm', 'addQuestionForm', 'addSimuladoForm',
    'addReviewFlashcardFront', 'addReviewFlashcardBack', 'otherSubjectsMenu', 'activeReview', 'activeReviewSession', 'activeReviewResult',
    'vocabulary', 'vocabRevisionMenu', 'vocabRevisionSession', 'vocabRevisionResult',
    // Fluxo "Estudar" - a partir do clique no botão Estudar
    'sessionType', 'studyMaterialSelect', 'sessionTypeChoice',
    'sessionUnique', 'sessionPomodoro', 'sessionPreDefined', 'sessionCustomDuration', 'sessionTimerActive', 'pomodoroTimerActive',
  ];

  const fullPageTaskViews = [
    'categories_list', 'create_category', 'edit_category', 'add_task_form'
  ];

  // The Sidebar will be hidden automatically whenever the user enters ANY module inside "Outros" or "Nutrição"
  // (i.e. whenever the view is not the main 'entry' list).

  const isStudyFullPage = activePage === 'Study' && fullPageStudyViews.includes(studyView);
  const isTaskFullPage = activePage === 'Tarefas' && fullPageTaskViews.includes(taskView);
  const isOthersFullPage = (activePage === 'Outros' || activePage === 'Nutrição') && othersView !== 'entry';
  const isStatsFullPage = activePage === 'Minhas estatísticas';
  const isSidebarHidden = isStudyFullPage || isTaskFullPage || isOthersFullPage || isStatsFullPage;

  useEffect(() => {
    const storedName = localStorage.getItem('produtivity_user_name');
    if (storedName) setUserName(storedName);
    const storedTheme = localStorage.getItem('produtivity_dark_mode');
    if (storedTheme) setIsDarkMode(JSON.parse(storedTheme));
  }, []);

  const { user } = useAuth();
  const displayUserName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || userName;

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleUpdateName = async (name: string) => {
    setUserName(name);
    localStorage.setItem('produtivity_user_name', name);
    // Atualiza o nome na sessão local se o usuário estiver logado
    if (user?.id) {
      const sessionStr = localStorage.getItem('produtivity_auth_session');
      if (sessionStr) {
        try {
          const session = JSON.parse(sessionStr);
          session.user_metadata = { ...session.user_metadata, display_name: name };
          localStorage.setItem('produtivity_auth_session', JSON.stringify(session));
        } catch { /* ignorar */ }
      }
    }
  };

  const toggleDarkMode = () => {
    const newVal = !isDarkMode;
    setIsDarkMode(newVal);
    localStorage.setItem('produtivity_dark_mode', JSON.stringify(newVal));
  };

  const handleCloseDetail = () => {
    setIsClosing(true);
    setTimeout(() => {
      setFullScreenItem(null);
      setIsClosing(false);
    }, 400);
  };

  const renderPage = () => {
    const commonProps = { isDarkMode };
    switch (activePage) {
      case 'Study': return <Study {...commonProps} onOpenDetail={setFullScreenItem} onViewChange={setStudyView} />;
      case 'Tarefas': return <Tasks {...commonProps} onViewChange={setTaskView} />;
      case 'Rotina': return <Routine {...commonProps} />;
      case 'Hábitos': return <Habits {...commonProps} />;
      case 'Metas': return <Goals {...commonProps} />;
      case 'Minhas estatísticas': return <Stats {...commonProps} onBack={() => setActivePage('Study')} />;
      case 'Nutrição': return <Others key="nutricao" {...commonProps} initialView="nutrition_dashboard" onViewChange={setOthersView} onOpenDetail={setFullScreenItem} />;
      case 'Outros': return <Others key="outros" {...commonProps} onViewChange={setOthersView} onOpenDetail={setFullScreenItem} />;
      case 'Configurações': return (
        <Settings
          userName={displayUserName}
          onUpdateName={handleUpdateName}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
        />
      );
      default: return <Study {...commonProps} onOpenDetail={setFullScreenItem} />;
    }
  };

  const renderFullScreenDetail = () => {
    if (!fullScreenItem) return null;

    // "Grau de relevância" determina a cor do cartão salvo (lógica em Study.tsx).
    // "Escolha uma cor" determina a cor do modal de detalhe para todas as categorias.
    const detailColor = fullScreenItem.color || '#4A69A2';

    const isBlackBg = detailColor === '#000000';
    const infoTextColor = isBlackBg ? 'text-white' : 'text-black';
    const bulletColor = isBlackBg ? 'bg-white' : 'bg-black';

    const renderInfoItem = (label: string, value: string | number | undefined) => (
      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${bulletColor}`}></div>
          <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] opacity-50 ${infoTextColor}`}>{label}</span>
        </div>
        <p className={`text-xl sm:text-2xl md:text-3xl font-black ml-4 break-words leading-tight ${infoTextColor}`}>{value || '-'}</p>
      </div>
    );

    return (
      <div
        className={`fixed inset-0 z-[1000] flex flex-col transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isClosing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100 animate-detailIn'}`}
        style={{ backgroundColor: detailColor }}
      >
        <div className="w-full max-w-6xl mx-auto px-6 sm:px-10 md:px-16 py-6 sm:py-8 flex flex-col h-full">
          <header className="flex flex-col-reverse sm:flex-row justify-between items-start gap-3 mb-6 sm:mb-8 shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className={`text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-tighter leading-none break-words ${infoTextColor}`}>
                {fullScreenItem.name}
              </h2>
              <div className={`h-1 w-16 sm:w-24 mt-3 rounded-full ${bulletColor} opacity-20`}></div>
              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.3em] opacity-40 mt-3 block ${infoTextColor}`}>
                {fullScreenItem.categoryId}
              </span>
            </div>
            <button
              onClick={handleCloseDetail}
              className={`px-4 py-2 sm:p-4 rounded-xl sm:rounded-3xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] sm:text-xs tracking-widest self-end sm:self-start shrink-0 ${isBlackBg ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/10 text-black hover:bg-black/5'}`}
            >
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Voltar
            </button>
          </header>

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 auto-rows-fr gap-x-8 sm:gap-x-16 gap-y-2">
            {fullScreenItem.categoryId === 'Meus livros' && (
              <>
                {renderInfoItem('Tipo', fullScreenItem.type)}
                {renderInfoItem('Grau de Relevância', fullScreenItem.relevance)}
                {renderInfoItem('Tempo estimado de Término', `${fullScreenItem.estimateDays} dias`)}
                {renderInfoItem('Total de páginas', fullScreenItem.totalPages)}
                {renderInfoItem('Páginas Lidas', fullScreenItem.readPages)}
                {renderInfoItem('Data de Adição', fullScreenItem.dateAdded ? new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR') : '-')}
              </>
            )}
            {fullScreenItem.categoryId === "Meus PDF's" && (
              <>
                {renderInfoItem('Tipo de Material', fullScreenItem.type)}
                {renderInfoItem('Grau de relevância', fullScreenItem.relevance)}
                {renderInfoItem('Páginas Totais', fullScreenItem.totalPages)}
                {renderInfoItem('Páginas Lidas', fullScreenItem.readPages)}
                {renderInfoItem('Data de Adição', fullScreenItem.dateAdded ? new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR') : '-')}
              </>
            )}
            {fullScreenItem.categoryId === 'Minhas vídeo aulas' && (
              <>
                {renderInfoItem('Finalidade', fullScreenItem.videoFinality)}
                {renderInfoItem('De onde é (Fonte)', fullScreenItem.videoSource)}
                {renderInfoItem('Tempo estimado de término', fullScreenItem.videoCompletionTime)}
                {renderInfoItem('Duração da aula', fullScreenItem.videoDuration)}
                {renderInfoItem('Grau de relevância', fullScreenItem.relevance)}
                {renderInfoItem('Estudo para', fullScreenItem.videoStudyType === 'ensino_medio' ? 'Ensino Médio' : 'Faculdade')}
                {renderInfoItem('Data de Adição', fullScreenItem.dateAdded ? new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR') : '-')}
              </>
            )}
            {fullScreenItem.categoryId === 'Minhas revisões' && (
              <>
                {renderInfoItem('Tipo de Revisão', fullScreenItem.reviewMethod)}
                {renderInfoItem('Quantas vezes é preciso revisar esse conteúdo', fullScreenItem.reviewRepetitions)}
                {renderInfoItem('Duração da Revisão', fullScreenItem.reviewDuration)}
                {renderInfoItem('Grau de Relevância', fullScreenItem.relevance)}
                {renderInfoItem('Vou estudar para', fullScreenItem.videoStudyType === 'ensino_medio' ? 'Disciplina do ensino médio' : (fullScreenItem.videoStudyType === 'faculdade' ? 'Matéria da faculdade' : '-'))}
                {renderInfoItem('Data de Adição', fullScreenItem.dateAdded ? new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR') : '-')}
              </>
            )}
            {fullScreenItem.categoryId === 'Minhas questões' && (
              <>
                {renderInfoItem('Fonte', fullScreenItem.questionSource)}
                {renderInfoItem('Quantas questões preciso fazer', fullScreenItem.questionQuantity)}
                {renderInfoItem('Quanto tempo vai demorar para fazer', fullScreenItem.questionDuration)}
                {renderInfoItem('Grau de Relevância', fullScreenItem.relevance)}
                {renderInfoItem('Vou estudar para', fullScreenItem.videoStudyType === 'ensino_medio' ? 'Ensino médio' : (fullScreenItem.videoStudyType === 'faculdade' ? 'Faculdade' : '-'))}
                {renderInfoItem('Data de Adição', fullScreenItem.dateAdded ? new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR') : '-')}
              </>
            )}
            {fullScreenItem.categoryId === 'Meus simulados' && (
              <>
                {renderInfoItem('Esse simulado é do', fullScreenItem.simuladoOrigin)}
                {renderInfoItem('Quantidade de questões', fullScreenItem.questionQuantity)}
                {renderInfoItem('Duração do simulado', fullScreenItem.questionDuration)}
                {renderInfoItem('Data de adição', fullScreenItem.dateAdded ? new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR') : '-')}
              </>
            )}
            {((fullScreenItem.categoryId === 'Minhas receitas' || fullScreenItem.categoryId === 'Minhas Receitas') || (fullScreenItem.categoryId === 'Minhas despesas' || fullScreenItem.categoryId === 'Minhas Despesas')) && (
              <>
                {renderInfoItem('Valor', `R$ ${fullScreenItem.value}`)}
                {renderInfoItem('Data', fullScreenItem.date)}
                {renderInfoItem('Recorrência', fullScreenItem.recurrence === 'fixo' ? 'Fixo' : 'Pontual')}
                {fullScreenItem.period && renderInfoItem('Período', fullScreenItem.period)}
                {renderInfoItem('Grau de esforço', fullScreenItem.effort?.replace('nivel_', 'Nível '))}
                {renderInfoItem('Pode crescer?', fullScreenItem.canGrow ? 'Sim' : 'Não')}
                {fullScreenItem.categoryName && renderInfoItem('Categoria Financeira', fullScreenItem.categoryName)}
                {fullScreenItem.type === 'expense' && (
                  <>
                    {renderInfoItem('Necessidade', fullScreenItem.necessity?.replace('_', ' '))}
                    {renderInfoItem('Como eu estava me sentindo', (fullScreenItem.mood || '') + (fullScreenItem.moodOther ? ` (${fullScreenItem.moodOther})` : ''))}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex h-[100dvh] overflow-hidden transition-colors duration-500 ${isDarkMode ? 'bg-black text-white' : 'bg-slate-50 text-slate-900'}`}>
      <style>{`
        @keyframes detailIn {
          from { opacity: 0; transform: scale(1.05); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-detailIn {
          animation: detailIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <div className={`flex flex-1 w-full overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${(fullScreenItem && !isClosing) ? 'scale-95 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}>
        {/* Sidebar: oculta quando Study está em modo tela cheia */}
        {!isSidebarHidden && (
          <Sidebar
            activePage={activePage}
            onNavigate={(page) => {
              setActivePage(page);
              setStudyView('menu');
              setOthersView('entry');
            }}
            userName={displayUserName}
            isDarkMode={isDarkMode}
            isMobileOpen={isMobileSidebarOpen}
            onCloseMobile={() => setIsMobileSidebarOpen(false)}
            isHidden={isSidebarHidden}
          />
        )}

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile header */}
          <header className={`md:hidden flex items-center justify-between px-4 py-3 border-b shrink-0 ${isDarkMode ? 'border-slate-800 bg-black' : 'border-slate-200 bg-white'}`}>
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-800'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <span className={`font-black text-lg lowercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>produtivity</span>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold ${isDarkMode ? 'bg-red-600 text-white' : 'bg-[#4A69A2] text-white'}`}>
              {userName.substring(0, 2).toUpperCase()}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="w-full">
              {renderPage()}
            </div>
          </main>
        </div>
      </div>

      {renderFullScreenDetail()}
    </div>
  );
};

export default Index;
