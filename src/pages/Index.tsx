import React, { useState, useEffect } from 'react';
import { Page } from '@/types';
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

  useEffect(() => {
    const storedName = localStorage.getItem('produtivity_user_name');
    if (storedName) setUserName(storedName);
    const storedTheme = localStorage.getItem('produtivity_dark_mode');
    if (storedTheme) setIsDarkMode(JSON.parse(storedTheme));
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const handleUpdateName = (name: string) => {
    setUserName(name);
    localStorage.setItem('produtivity_user_name', name);
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
      case 'Study': return <Study {...commonProps} onOpenDetail={setFullScreenItem} />;
      case 'Tarefas': return <Tasks {...commonProps} />;
      case 'Rotina': return <Routine {...commonProps} />;
      case 'Hábitos': return <Habits {...commonProps} />;
      case 'Metas': return <Goals {...commonProps} />;
      case 'Minhas estatísticas': return <Stats {...commonProps} />;
      case 'Nutrição': return <Others {...commonProps} initialView="nutrition_dashboard" />;
      case 'Outros': return <Others {...commonProps} />;
      case 'Configurações': return (
        <Settings
          userName={userName}
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

    const detailColor = fullScreenItem.categoryId === "Meus PDF's"
      ? fullScreenItem.color
      : (fullScreenItem.relevance === 'Alta' ? '#ef4444' : fullScreenItem.relevance === 'Média' ? '#eab308' : fullScreenItem.relevance === 'Baixa' ? '#22c55e' : fullScreenItem.relevance === 'Baixíssima' ? '#6b7280' : fullScreenItem.color);

    const isBlackBg = detailColor === '#000000';
    const infoTextColor = isBlackBg ? 'text-white' : 'text-black';
    const bulletColor = isBlackBg ? 'bg-white' : 'bg-black';

    const renderInfoItem = (label: string, value: string | number | undefined) => (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1.5">
          <div className={`w-2 h-2 rounded-full shrink-0 ${bulletColor}`}></div>
          <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] opacity-50 ${infoTextColor}`}>{label}</span>
        </div>
        <p className={`text-lg sm:text-xl md:text-2xl font-black ml-4 break-words ${infoTextColor}`}>{value || '-'}</p>
      </div>
    );

    return (
      <div
        className={`fixed inset-0 z-[1000] flex flex-col transition-all duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isClosing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100 animate-detailIn'}`}
        style={{ backgroundColor: detailColor }}
      >
        <div className="w-full max-w-6xl mx-auto p-4 sm:p-8 md:p-12 lg:p-20 flex-1 overflow-y-auto custom-scrollbar">
          <header className="flex flex-col-reverse sm:flex-row justify-between items-start gap-4 sm:gap-4 mb-8 sm:mb-20">
            <div className="min-w-0 flex-1">
              <h2 className={`text-xl sm:text-3xl md:text-5xl font-black uppercase tracking-tighter leading-none break-words ${infoTextColor}`}>
                {fullScreenItem.name}
              </h2>
              <div className={`h-1 sm:h-2 w-12 sm:w-24 mt-3 sm:mt-6 rounded-full ${bulletColor} opacity-20`}></div>
              <span className={`text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] sm:tracking-[0.4em] opacity-40 mt-3 sm:mt-6 block ${infoTextColor}`}>
                {fullScreenItem.categoryId}
              </span>
            </div>
            <button
              onClick={handleCloseDetail}
              className={`px-4 py-2 sm:p-4 rounded-xl sm:rounded-3xl border-2 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 font-black uppercase text-[10px] sm:text-xs tracking-widest self-end sm:self-start shrink-0 ${isBlackBg ? 'border-white/20 text-white hover:bg-white/10' : 'border-black/10 text-black hover:bg-black/5'}`}
            >
              <svg className="w-4 h-4 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Voltar
            </button>
          </header>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8 sm:gap-x-16 sm:gap-y-16">
            {fullScreenItem.categoryId === 'Meus livros' && (
              <>
                {renderInfoItem('Tipo', fullScreenItem.type)}
                {renderInfoItem('Tempo estimado de Término', `${fullScreenItem.estimateDays} dias`)}
                {renderInfoItem('Total de páginas', fullScreenItem.totalPages)}
                {renderInfoItem('Páginas Lidas', fullScreenItem.readPages)}
                {renderInfoItem('Data de Adição', new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR'))}
              </>
            )}
            {fullScreenItem.categoryId === "Meus PDF's" && (
              <>
                {renderInfoItem('Tipo de Material', fullScreenItem.type)}
                {renderInfoItem('Grau de relevância', fullScreenItem.relevance)}
                {renderInfoItem('Páginas Totais', fullScreenItem.totalPages)}
                {renderInfoItem('Páginas Lidas', fullScreenItem.readPages)}
                {renderInfoItem('Data de Adição', new Date(fullScreenItem.dateAdded).toLocaleDateString('pt-BR'))}
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
              </>
            )}
            {fullScreenItem.categoryId === 'Minhas revisões' && (
              <>
                {renderInfoItem('Tipo de Revisão', fullScreenItem.reviewMethod)}
                {renderInfoItem('Quantidade de Repetições', fullScreenItem.reviewRepetitions)}
                {renderInfoItem('Duração da Revisão', fullScreenItem.reviewDuration)}
                {renderInfoItem('Grau de Relevância', fullScreenItem.relevance)}
                {renderInfoItem('Matéria', fullScreenItem.videoMatter)}
              </>
            )}
            {fullScreenItem.categoryId === 'Minhas questões' && (
              <>
                {renderInfoItem('Fonte das Questões', fullScreenItem.questionSource)}
                {renderInfoItem('Quantidade de Questões', fullScreenItem.questionQuantity)}
                {renderInfoItem('Duração estimada', fullScreenItem.questionDuration)}
                {renderInfoItem('Grau de Relevância', fullScreenItem.relevance)}
                {renderInfoItem('Tópico', fullScreenItem.videoTopic)}
              </>
            )}
            {fullScreenItem.categoryId === 'Meus simulados' && (
              <>
                {renderInfoItem('Origem', fullScreenItem.simuladoOrigin)}
                {renderInfoItem('Ano da Prova', fullScreenItem.simuladoYear)}
                {renderInfoItem('Área de Conhecimento', fullScreenItem.simuladoArea)}
                {renderInfoItem('Tipo de Aplicação', fullScreenItem.simuladoTestType)}
                {renderInfoItem('Qtd. de Questões', fullScreenItem.questionQuantity)}
                {renderInfoItem('Tempo de Prova', fullScreenItem.questionDuration)}
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

      <div className={`flex flex-1 w-full transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${(fullScreenItem && !isClosing) ? 'scale-95 opacity-0 pointer-events-none' : 'scale-100 opacity-100'}`}>
        <Sidebar
          activePage={activePage}
          onNavigate={setActivePage}
          userName={userName}
          isDarkMode={isDarkMode}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
        />

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

          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-16">
            <div className="w-full max-w-5xl mx-auto">
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
