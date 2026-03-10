import React, { useState, useEffect, useMemo } from 'react';

interface StatsProps {
  isDarkMode?: boolean;
  onBack?: () => void;
}

const Stats: React.FC<StatsProps> = ({ isDarkMode, onBack }) => {
  const cardBg = isDarkMode ? 'bg-black' : 'bg-white';
  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';
  const borderColor = isDarkMode ? 'border-slate-800' : 'border-slate-200';

  const sections = ['Study', 'Tarefas', 'Rotina', 'Hábitos', 'Metas', 'Outros'];

  const [expandedSection, setExpandedSection] = useState<string>('Study');

  // Period states
  const [periodMode, setPeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [periodYear, setPeriodYear] = useState(new Date().getFullYear());
  const [periodMonth, setPeriodMonth] = useState(new Date().getMonth() + 1);

  // Study calendar states
  const [studyCalendarMonth, setStudyCalendarMonth] = useState(new Date().getMonth());
  const [studyCalendarYear, setStudyCalendarYear] = useState(new Date().getFullYear());
  const [selectedStudyDate, setSelectedStudyDate] = useState<string | null>(null);
  const [studySessionData, setStudySessionData] = useState<Record<string, number>>({});

  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const periodModes: { key: typeof periodMode; label: string }[] = [
    { key: 'semanal', label: 'Semana' },
    { key: 'mensal', label: 'Mês' },
    { key: 'bimestral', label: 'Bimestre' },
    { key: 'trimestral', label: 'Trimestre' },
    { key: 'semestral', label: 'Semestre' },
    { key: 'anual', label: 'Ano' }
  ];

  const handleNavYear = (dir: -1 | 1) => {
    setPeriodYear(prev => prev + dir);
  };

  const handleNavMonth = (dir: -1 | 1) => {
    let newVal = periodMonth + dir;
    if (newVal < 1) newVal = 12;
    if (newVal > 12) newVal = 1;
    setPeriodMonth(newVal);
  };

  // Load study session dates from localStorage
  useEffect(() => {
    try {
      const savedV2 = localStorage.getItem('produtivity_study_session_dates_v2');
      if (savedV2) {
        setStudySessionData(JSON.parse(savedV2));
        return;
      }
      
      const temp: Record<string, number> = {};
      const savedDates = localStorage.getItem('produtivity_study_session_dates');
      if (savedDates) {
        const parsed = JSON.parse(savedDates);
        parsed.forEach((d: string) => { temp[d] = 1; });
      } else {
        const savedBooks = localStorage.getItem('produtivity_books');
        if (savedBooks) {
          const books = JSON.parse(savedBooks);
          books.forEach((book: any) => {
            if (book.dateAdded) {
              const d = new Date(book.dateAdded);
              const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
              temp[dateStr] = 1;
            }
          });
        }
      }
      setStudySessionData(temp);
    } catch {
      // ignore
    }
  }, []);

  // Study calendar navigation
  const changeStudyMonth = (offset: number) => {
    let nextMonth = studyCalendarMonth + offset;
    let nextYear = studyCalendarYear;
    if (nextMonth > 11) { nextMonth = 0; nextYear++; }
    if (nextMonth < 0) { nextMonth = 11; nextYear--; }
    setStudyCalendarMonth(nextMonth);
    setStudyCalendarYear(nextYear);
    setSelectedStudyDate(null);
  };

  const daysInStudyMonth = new Date(studyCalendarYear, studyCalendarMonth + 1, 0).getDate();
  const startStudyDay = new Date(studyCalendarYear, studyCalendarMonth, 1).getDay();

  // Count study days in current visible month
  const studyDaysInMonth = useMemo(() => {
    let count = 0;
    for (let d = 1; d <= daysInStudyMonth; d++) {
      const dateStr = `${String(d).padStart(2, '0')}/${String(studyCalendarMonth + 1).padStart(2, '0')}/${studyCalendarYear}`;
      if ((studySessionData[dateStr] || 0) > 0) count++;
    }
    return count;
  }, [studySessionData, studyCalendarMonth, studyCalendarYear, daysInStudyMonth]);

  return (
    <div className="animate-fadeIn pb-24 h-full overflow-y-auto">
      {onBack && (
        <button onClick={onBack} className={`flex items-center gap-2 mb-6 w-fit transition-colors group font-black uppercase tracking-widest text-xs ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-black'}`}>
          <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Voltar
        </button>
      )}

      <header className="mb-8 mt-2 text-left">
        <h2 className={`text-2xl sm:text-3xl font-black ${textColor} uppercase tracking-widest`}>Minhas Estatísticas</h2>
        <p className="text-slate-500 mt-2 font-medium text-sm sm:text-base">Acompanhe seu progresso e produtividade.</p>
      </header>

      <div className="flex flex-col gap-8 items-start mt-6">
        {sections.map((section) => (
          <div key={section} className="flex flex-col gap-4 w-full">
            <button
              onClick={() => setExpandedSection(expandedSection === section ? '' : section)}
              className="group hover:opacity-75 active:scale-95 transition-all text-left w-fit"
            >
              <span className="text-2xl sm:text-3xl font-black uppercase tracking-widest text-blue-900 group-hover:translate-x-2 transition-transform inline-block border-b-[4px] border-blue-900 pb-1">
                {section}
              </span>
            </button>

            {section === 'Study' && expandedSection === 'Study' && (
              <div className="flex flex-col gap-6 mt-4 w-full animate-fadeIn pl-2 sm:pl-4">
                <h3 className={`text-sm sm:text-base font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  Tempo estudado:
                </h3>

                <div className="flex flex-col gap-4">
                  {/* Pílulas de Seleção de Período */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {periodModes.map(m => (
                      <button
                        key={m.key}
                        onClick={() => setPeriodMode(m.key)}
                        className={`px-4 py-1.5 sm:px-5 sm:py-2 rounded-full border-2 text-[10px] sm:text-xs font-black uppercase tracking-widest transition-all ${periodMode === m.key ? 'bg-[#5c1c1c] text-white border-[#5c1c1c] shadow-md scale-105' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 active:scale-95'}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {/* Seletores de Ano e Mês */}
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                    {/* Seletor de Ano */}
                    <div className="flex items-center justify-between border-2 border-slate-100 rounded-2xl px-4 py-2 sm:px-6 sm:py-3 w-40 sm:w-48 bg-white shadow-sm">
                      <button onClick={() => handleNavYear(-1)} className="text-slate-400 hover:text-black transition-colors px-2 py-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                      </button>
                      <span className="text-sm sm:text-base font-black tracking-widest text-[#4A69A2]">{periodYear}</span>
                      <button onClick={() => handleNavYear(1)} className="text-slate-400 hover:text-black transition-colors px-2 py-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                      </button>
                    </div>

                    {/* Seletor de Mês (oculto se anual) */}
                    {periodMode !== 'anual' && (
                      <div className="flex items-center justify-between border-2 border-slate-100 rounded-2xl px-4 py-2 sm:px-6 sm:py-3 w-40 sm:w-48 bg-white shadow-sm">
                        <button onClick={() => handleNavMonth(-1)} className="text-slate-400 hover:text-black transition-colors px-2 py-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <span className="text-sm sm:text-base font-black uppercase tracking-widest text-[#4A69A2] px-2">{monthNames[periodMonth - 1]}</span>
                        <button onClick={() => handleNavMonth(1)} className="text-slate-400 hover:text-black transition-colors px-2 py-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Cards de Estatísticas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mt-6 w-full max-w-4xl">
                    {/* Sequência Atual */}
                    <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                        <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sequência Atual</span>
                      </div>
                      <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0 <span className="text-xl sm:text-2xl font-bold">dias</span></div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Estudo Consecutivo</div>
                    </div>

                    {/* Melhor Sequência */}
                    <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-[#fafbdf]'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                        <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Melhor Sequência</span>
                      </div>
                      <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0 <span className="text-xl sm:text-2xl font-bold">dias</span></div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Recorde Pessoal</div>
                    </div>

                    {/* Taxa de Consistência */}
                    <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-[#f4f7fc]'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Taxa de Consistência</span>
                      </div>
                      <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.0<span className="text-xl sm:text-2xl font-bold">%</span></div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Presença Total</div>
                    </div>

                    {/* Média Diária */}
                    <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-[#f1fbf7]'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Média Diária</span>
                      </div>
                      <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>0.0<span className="text-xl sm:text-2xl font-bold">h</span></div>
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Tempo Médio</div>
                    </div>
                  </div>

                  {/* === AGENDA DE ESTUDO – CALENDÁRIO === */}
                  <div className="mt-10 w-full max-w-4xl">
                    <h3 className={`text-sm sm:text-base font-black uppercase tracking-widest mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      Agenda de Estudo:
                    </h3>

                    <div className="bg-white border-2 border-black p-8 sm:p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                      {/* Header do Calendário */}
                      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                        <h4 className="text-xl sm:text-2xl font-black text-black uppercase tracking-tighter flex items-center gap-3">
                          <svg className="w-7 h-7 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Calendário de Estudos
                        </h4>

                        <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100">
                          <button
                            onClick={() => changeStudyMonth(-1)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-black font-black"
                          >
                            ‹
                          </button>
                          <span className="font-black text-sm uppercase tracking-widest min-w-[160px] text-center">
                            {new Date(studyCalendarYear, studyCalendarMonth).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            onClick={() => changeStudyMonth(1)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-black font-black"
                          >
                            ›
                          </button>
                        </div>
                      </div>

                      {/* Resumo do Mês */}
                      {studyDaysInMonth > 0 && (
                        <div className="mb-6 px-4 py-3 bg-[#f4f7fc] rounded-2xl border-2 border-[#4A69A2]/20 flex items-center gap-3">
                          <svg className="w-5 h-5 text-[#4A69A2] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-xs sm:text-sm font-black text-[#4A69A2] uppercase tracking-widest">
                            {studyDaysInMonth} {studyDaysInMonth === 1 ? 'dia' : 'dias'} de estudo neste mês
                          </span>
                        </div>
                      )}

                      {/* Grade do Calendário */}
                      <div className="grid grid-cols-7 gap-2 sm:gap-3">
                        {/* Cabeçalho dos dias */}
                        {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                          <div key={d} className="text-center flex items-center justify-center font-black text-[9px] sm:text-[10px] text-slate-400 py-2 tracking-widest border-2 border-slate-100 rounded-xl bg-slate-50/50">
                            {d}
                          </div>
                        ))}

                        {/* Células vazias antes do primeiro dia */}
                        {Array.from({ length: startStudyDay }).map((_, i) => (
                          <div key={`empty-${i}`} />
                        ))}

                        {/* Dias do mês */}
                        {Array.from({ length: daysInStudyMonth }).map((_, i) => {
                          const dayNum = i + 1;
                          const dateStr = `${String(dayNum).padStart(2, '0')}/${String(studyCalendarMonth + 1).padStart(2, '0')}/${studyCalendarYear}`;
                          const sessionMins = studySessionData[dateStr] || 0;
                          const hasStudied = sessionMins > 0;
                          const today = new Date();
                          const isToday =
                            dayNum === today.getDate() &&
                            studyCalendarMonth === today.getMonth() &&
                            studyCalendarYear === today.getFullYear();
                          const isSelected = selectedStudyDate === dateStr;

                          // Base Heatmap logic
                          let bgColorClass = 'bg-slate-50 text-slate-300 hover:bg-slate-100';
                          let borderColorClass = isToday ? 'border-blue-400' : 'border-slate-100';
                          let extraClasses = 'hover:scale-105';

                          if (hasStudied) {
                             if (sessionMins < 10) {
                                bgColorClass = 'bg-slate-100 text-slate-400';
                                borderColorClass = 'border-slate-200';
                             } else if (sessionMins < 60) {
                                bgColorClass = 'bg-[#e0f2fe] text-[#0284c7]'; borderColorClass = 'border-transparent';
                             } else if (sessionMins < 120) {
                                bgColorClass = 'bg-[#bae6fd] text-[#0369a1]'; borderColorClass = 'border-transparent';
                             } else if (sessionMins < 180) {
                                bgColorClass = 'bg-[#7dd3fc] text-[#075985]'; borderColorClass = 'border-transparent';
                             } else if (sessionMins < 240) {
                                bgColorClass = 'bg-[#38bdf8] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-md';
                             } else if (sessionMins < 300) {
                                bgColorClass = 'bg-[#0ea5e9] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-md';
                             } else if (sessionMins < 360) {
                                bgColorClass = 'bg-[#0284c7] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-md';
                             } else if (sessionMins < 420) {
                                bgColorClass = 'bg-[#0369a1] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-lg';
                             } else if (sessionMins < 480) {
                                bgColorClass = 'bg-[#075985] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-lg';
                             } else if (sessionMins < 540) {
                                bgColorClass = 'bg-[#0c4a6e] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-lg';
                             } else if (sessionMins < 600) {
                                bgColorClass = 'bg-[#1e3a8a] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-xl';
                             } else if (sessionMins < 660) {
                                bgColorClass = 'bg-[#312e81] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-xl';
                             } else {
                                bgColorClass = 'bg-[#4c1d95] text-white'; borderColorClass = 'border-transparent'; extraClasses += ' shadow-xl';
                             }
                          } else if (isToday) {
                             bgColorClass = 'bg-white text-blue-500';
                          }

                          if (isSelected) {
                             // Override just the border and scale if selected, keeping the base colors
                             borderColorClass = 'border-slate-400 border-[3px]';
                             extraClasses = 'scale-110 z-20 shadow-2xl';
                          }

                          const cellColorClass = `${bgColorClass} ${borderColorClass} ${extraClasses}`;

                          return (
                            <button
                              key={dayNum}
                              onClick={() => setSelectedStudyDate(isSelected ? null : dateStr)}
                              className={`aspect-square flex flex-col items-center justify-center rounded-2xl font-black text-sm sm:text-base border-2 transition-all relative ${cellColorClass}`}
                            >
                              {dayNum}
                              {hasStudied && sessionMins >= 30 && (
                                <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 opacity-90">
                                  <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-400 drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Legenda (Simplificada para os degraus de cor) */}
                      <div className="mt-8 flex flex-col gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">Intensidade (Heatmap de 1h a 12h)</span>
                        <div className="flex w-full h-3 sm:h-4 rounded-full overflow-hidden shadow-inner">
                           <div className="flex-1 bg-slate-100" title="Menos de 10 min"></div>
                           <div className="flex-1 bg-[#e0f2fe]" title="10min - 1h"></div>
                           <div className="flex-1 bg-[#bae6fd]" title="1h - 2h"></div>
                           <div className="flex-1 bg-[#7dd3fc]" title="2h - 3h"></div>
                           <div className="flex-1 bg-[#38bdf8]" title="3h - 4h"></div>
                           <div className="flex-1 bg-[#0ea5e9]" title="4h - 5h"></div>
                           <div className="flex-1 bg-[#0284c7]" title="5h - 6h"></div>
                           <div className="flex-1 bg-[#0369a1]" title="6h - 7h"></div>
                           <div className="flex-1 bg-[#075985]" title="7h - 8h"></div>
                           <div className="flex-1 bg-[#0c4a6e]" title="8h - 9h"></div>
                           <div className="flex-1 bg-[#1e3a8a]" title="9h - 10h"></div>
                           <div className="flex-1 bg-[#312e81]" title="10h - 11h"></div>
                           <div className="flex-1 bg-[#4c1d95]" title="11h - 12h+"></div>
                        </div>
                        <div className="flex justify-between text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                          <span>10m</span>
                          <span>6h</span>
                          <span>12h+</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-5 h-5 rounded-lg bg-slate-50 border-2 border-slate-100" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sem Estudo</span>
                        </div>
                      </div>

                      {/* Detalhe do dia selecionado */}
                      {selectedStudyDate && (
                        <div className="mt-8 bg-white text-black p-5 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fadeIn border-2 border-black shadow-xl">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-xl ${(studySessionData[selectedStudyDate] || 0) > 0 ? ((studySessionData[selectedStudyDate] || 0) >= 30 ? 'bg-green-500' : 'bg-[#4A69A2]') : 'bg-slate-300'}`}>
                              {parseInt(selectedStudyDate.split('/')[0])}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                {(studySessionData[selectedStudyDate] || 0) > 0
                                  ? `Você estudou em ${selectedStudyDate}`
                                  : `Sem registro de estudo em ${selectedStudyDate}`}
                              </span>
                              <span className="text-base font-black text-slate-800">
                                {(studySessionData[selectedStudyDate] || 0) > 0
                                  ? `✓ ${(studySessionData[selectedStudyDate] || 0)} min registrados`
                                  : 'Nenhuma sessão registrada'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* FIM DA AGENDA DE ESTUDO */}

                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Stats;
