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
  const [studyTimePeriods, setStudyTimePeriods] = useState<Record<string, Record<string, number>>>({});

  // Minhas Matérias Pie Chart states
  const [studyBooks, setStudyBooks] = useState<any[]>([]);
  const [materiasPieMode, setMateriasPieMode] = useState<'discipline' | 'discipline_matter'>('discipline');
  const [materiasPieSelectedDiscipline, setMateriasPieSelectedDiscipline] = useState<string>('');
  const [materiasPieSelectedArea, setMateriasPieSelectedArea] = useState<string>('');
  const [materiasPieHiddenCats, setMateriasPieHiddenCats] = useState<Record<string, boolean>>({});
  const [materiasPieHoveredCat, setMateriasPieHoveredCat] = useState<string | null>(null);
  const [materiasPieAnimKey, setMateriasPieAnimKey] = useState(0);

  // Chart states - Bar
  const [studyBarPeriodMode, setStudyBarPeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [studyBarYear, setStudyBarYear] = useState(new Date().getFullYear());
  const [studyBarMonth, setStudyBarMonth] = useState(new Date().getMonth() + 1);
  const [studyBarWeekIdx, setStudyBarWeekIdx] = useState(0);
  const [studyBarPeriodIdx, setStudyBarPeriodIdx] = useState(1);
  const [studyBarAnimKey, setStudyBarAnimKey] = useState(0);
  const [studyHoveredBar, setStudyHoveredBar] = useState<number | null>(null);
  // Chart states - Line
  const [studyLinePeriodMode, setStudyLinePeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [studyLineYear, setStudyLineYear] = useState(new Date().getFullYear());
  const [studyLineMonth, setStudyLineMonth] = useState(new Date().getMonth() + 1);
  const [studyLineWeekIdx, setStudyLineWeekIdx] = useState(0);
  const [studyLinePeriodIdx, setStudyLinePeriodIdx] = useState(1);
  const [studyLineAnimKey, setStudyLineAnimKey] = useState(0);
  const [studyHoveredLine, setStudyHoveredLine] = useState<number | null>(null);

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
  const [studyItemTimes, setStudyItemTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      let finalData: Record<string, number> = {};
      const savedV2 = localStorage.getItem('produtivity_study_session_dates_v2');
      if (savedV2) {
        finalData = JSON.parse(savedV2);
      } else {
        const savedDates = localStorage.getItem('produtivity_study_session_dates');
        if (savedDates) {
          const parsed = JSON.parse(savedDates);
          parsed.forEach((d: string) => { finalData[d] = 1; });
        }
      }

      // Remover dados de testes gerados antes do app estar sendo usado de verdade
      const cleanData: Record<string, number> = {};
      Object.keys(finalData).forEach(dateStr => {
        // Ignorar 21/02/2026 e qualquer data muito antiga de testes
        if (!dateStr.startsWith('21/02/202') && !dateStr.startsWith('20/02/202') && !dateStr.startsWith('22/02/202')) {
          cleanData[dateStr] = finalData[dateStr];
        }
      });
      setStudySessionData(cleanData);
    } catch {
      // ignore
    }
    try {
      const savedPeriods = localStorage.getItem('produtivity_study_time_periods');
      if (savedPeriods) setStudyTimePeriods(JSON.parse(savedPeriods));
    } catch { /* ignore */ }
    try {
      const savedBooks = localStorage.getItem('produtivity_books');
      if (savedBooks) setStudyBooks(JSON.parse(savedBooks));
    } catch { /* ignore */ }
    try {
      const savedItemTimes = localStorage.getItem('produtivity_study_item_times');
      if (savedItemTimes) setStudyItemTimes(JSON.parse(savedItemTimes));
    } catch { /* ignore */ }
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
                <div className="flex flex-col gap-4">


                  {/* === GRÁFICOS DE ESTUDO (Barra + Linha) === */}
                  {(() => {
                    const fullMonthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
                    const periodLabelMap: Record<string, string[]> = { bimestral: ['Jan–Fev', 'Mar–Abr', 'Mai–Jun', 'Jul–Ago', 'Set–Out', 'Nov–Dez'], trimestral: ['Jan–Mar', 'Abr–Jun', 'Jul–Set', 'Out–Dez'], semestral: ['Jan–Jun', 'Jul–Dez'] };
                    const periodMaxMap: Record<string, number> = { bimestral: 6, trimestral: 4, semestral: 2 };
                    const chartPeriodModes: { key: typeof studyBarPeriodMode; label: string }[] = [{ key: 'semanal', label: 'Semana' }, { key: 'mensal', label: 'Mês' }, { key: 'bimestral', label: 'Bimestre' }, { key: 'trimestral', label: 'Trimestre' }, { key: 'semestral', label: 'Semestre' }, { key: 'anual', label: 'Ano' }];

                    const getWeeksLocal = (year: number, month: number) => {
                      const wks: { start: Date; end: Date; label: string }[] = [];
                      let d = new Date(year, month - 1, 1); let n = 1;
                      while (d.getMonth() === month - 1) {
                        const s = new Date(d); const e = new Date(d);
                        e.setDate(e.getDate() + (6 - e.getDay()));
                        const eom = new Date(year, month, 0);
                        if (e > eom) e.setTime(eom.getTime());
                        wks.push({ start: new Date(s), end: new Date(e), label: `Semana ${n}` });
                        d = new Date(e); d.setDate(d.getDate() + 1); n++;
                      }
                      return wks;
                    };

                    // Helper: get study minutes for a given date string dd/mm/yyyy
                    const getMinsForDate = (dateStr: string) => studySessionData[dateStr] || 0;

                    // Helper: iterate all dates in a range and sum minutes
                    const sumMinsInRange = (startDate: Date, endDate: Date) => {
                      let total = 0;
                      const cur = new Date(startDate); cur.setHours(0, 0, 0, 0);
                      const end = new Date(endDate); end.setHours(23, 59, 59, 999);
                      while (cur <= end) {
                        const ds = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}/${cur.getFullYear()}`;
                        total += getMinsForDate(ds);
                        cur.setDate(cur.getDate() + 1);
                      }
                      return total;
                    };

                    const fmtMins = (mins: number) => {
                      if (mins === 0) return '0min';
                      const h = Math.floor(mins / 60);
                      const m = Math.round(mins % 60);
                      if (h === 0) return `${m}min`;
                      if (m === 0) return `${h}h`;
                      return `${h}h${m}m`;
                    };
                    const fmtCompact = (v: number) => {
                      if (v === 0) return '0';
                      if (v >= 60) return `${(v / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
                      return `${Math.round(v)}m`;
                    };

                    const navBtn = (onClick: () => void, ch: string, dis?: boolean) => (<button onClick={dis ? undefined : onClick} className={`flex items-center justify-center transition-all font-black text-sm w-5 ${dis ? 'text-slate-300 cursor-not-allowed' : 'text-black hover:opacity-60 cursor-pointer'}`}>{ch}</button>);

                    // === BAR CHART ===
                    const setBarMode = (mode: typeof studyBarPeriodMode) => { setStudyBarPeriodMode(mode); setStudyBarWeekIdx(0); setStudyBarPeriodIdx(1); setStudyBarAnimKey(k => k + 1); };
                    const navBY = (dir: -1 | 1) => { const ny = studyBarYear + dir; if (ny < 2020 || ny > 2030) return; setStudyBarYear(ny); setStudyBarAnimKey(k => k + 1); };
                    const navBM = (dir: -1 | 1) => { const nm = studyBarMonth + dir; if (nm < 1 || nm > 12) return; setStudyBarMonth(nm); setStudyBarWeekIdx(0); setStudyBarAnimKey(k => k + 1); };
                    const barWks = getWeeksLocal(studyBarYear, studyBarMonth);
                    const safeBarWIdx = Math.min(studyBarWeekIdx, barWks.length - 1);
                    const barCurWk = barWks[safeBarWIdx] || barWks[0];
                    const navBW = (dir: -1 | 1) => { const ni = safeBarWIdx + dir; if (ni >= 0 && ni < barWks.length) { setStudyBarWeekIdx(ni); setStudyBarAnimKey(k => k + 1); } };
                    const navBPI = (dir: -1 | 1) => { const max = periodMaxMap[studyBarPeriodMode] || 1; const ni = studyBarPeriodIdx + dir; if (ni < 1 || ni > max) return; setStudyBarPeriodIdx(ni); setStudyBarAnimKey(k => k + 1); };

                    const getBarData = () => {
                      let bars: { label: string; value: number }[] = [];
                      if (studyBarPeriodMode === 'semanal') {
                        bars = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 }));
                        if (barCurWk) {
                          const st = new Date(barCurWk.start); st.setHours(0, 0, 0, 0);
                          const en = new Date(barCurWk.end); en.setHours(23, 59, 59, 999);
                          const cur = new Date(st);
                          while (cur <= en) { const ds = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}/${cur.getFullYear()}`; const idx = cur.getDay() === 0 ? 6 : cur.getDay() - 1; bars[idx].value += getMinsForDate(ds); cur.setDate(cur.getDate() + 1); }
                        }
                      } else if (studyBarPeriodMode === 'mensal') {
                        const ws = getWeeksLocal(studyBarYear, studyBarMonth);
                        bars = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 }));
                        ws.forEach((w, wi) => { bars[wi].value = sumMinsInRange(w.start, w.end); });
                      } else if (studyBarPeriodMode === 'bimestral') {
                        const m1 = (studyBarPeriodIdx - 1) * 2 + 1;
                        bars = [0, 1].map(i => ({ label: fullMonthNames[m1 + i - 1].slice(0, 3), value: 0 }));
                        bars[0].value = sumMinsInRange(new Date(studyBarYear, m1 - 1, 1), new Date(studyBarYear, m1, 0));
                        bars[1].value = sumMinsInRange(new Date(studyBarYear, m1, 1), new Date(studyBarYear, m1 + 1, 0));
                      } else if (studyBarPeriodMode === 'trimestral') {
                        const m1 = (studyBarPeriodIdx - 1) * 3 + 1;
                        bars = [0, 1, 2].map(i => ({ label: fullMonthNames[m1 + i - 1].slice(0, 3), value: 0 }));
                        [0, 1, 2].forEach(i => { bars[i].value = sumMinsInRange(new Date(studyBarYear, m1 + i - 1, 1), new Date(studyBarYear, m1 + i, 0)); });
                      } else if (studyBarPeriodMode === 'semestral') {
                        const m1 = (studyBarPeriodIdx - 1) * 6 + 1;
                        bars = [0, 1, 2, 3, 4, 5].map(i => ({ label: fullMonthNames[m1 + i - 1].slice(0, 3), value: 0 }));
                        [0, 1, 2, 3, 4, 5].forEach(i => { bars[i].value = sumMinsInRange(new Date(studyBarYear, m1 + i - 1, 1), new Date(studyBarYear, m1 + i, 0)); });
                      } else {
                        bars = fullMonthNames.map(m => ({ label: m.slice(0, 3), value: 0 }));
                        for (let i = 0; i < 12; i++) { bars[i].value = sumMinsInRange(new Date(studyBarYear, i, 1), new Date(studyBarYear, i + 1, 0)); }
                      }
                      return bars;
                    };
                    const barData = getBarData();
                    const maxBarVal = Math.max(...barData.map(b => b.value), 1);
                    const barTotal = barData.reduce((s, b) => s + b.value, 0);
                    const barYMin = studyBarYear <= 2020, barYMax = studyBarYear >= 2030;
                    const barMMin = studyBarMonth === 1, barMMax = studyBarMonth === 12;
                    const barPMax = periodMaxMap[studyBarPeriodMode] || 1;
                    const barPMin = studyBarPeriodIdx <= 1, barPMaxb = studyBarPeriodIdx >= barPMax;
                    const barWMin = safeBarWIdx === 0 && barMMin, barWMax = safeBarWIdx === barWks.length - 1 && barMMax;

                    // === LINE CHART ===
                    const setLineMode = (mode: typeof studyLinePeriodMode) => { setStudyLinePeriodMode(mode); setStudyLineWeekIdx(0); setStudyLinePeriodIdx(1); setStudyLineAnimKey(k => k + 1); };
                    const navLY = (dir: -1 | 1) => { const ny = studyLineYear + dir; if (ny < 2020 || ny > 2030) return; setStudyLineYear(ny); setStudyLineAnimKey(k => k + 1); };
                    const navLM = (dir: -1 | 1) => { const nm = studyLineMonth + dir; if (nm < 1 || nm > 12) return; setStudyLineMonth(nm); setStudyLineWeekIdx(0); setStudyLineAnimKey(k => k + 1); };
                    const lineWks = getWeeksLocal(studyLineYear, studyLineMonth);
                    const safeLineWIdx = Math.min(studyLineWeekIdx, lineWks.length - 1);
                    const lineCurWk = lineWks[safeLineWIdx] || lineWks[0];
                    const navLW = (dir: -1 | 1) => { const ni = safeLineWIdx + dir; if (ni >= 0 && ni < lineWks.length) { setStudyLineWeekIdx(ni); setStudyLineAnimKey(k => k + 1); } };
                    const navLPI = (dir: -1 | 1) => { const max = periodMaxMap[studyLinePeriodMode] || 1; const ni = studyLinePeriodIdx + dir; if (ni < 1 || ni > max) return; setStudyLinePeriodIdx(ni); setStudyLineAnimKey(k => k + 1); };

                    const getLineData = () => {
                      let pts: { label: string; value: number }[] = [];
                      if (studyLinePeriodMode === 'semanal') {
                        pts = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 }));
                        if (lineCurWk) {
                          const cur = new Date(lineCurWk.start); cur.setHours(0, 0, 0, 0);
                          const en = new Date(lineCurWk.end); en.setHours(23, 59, 59, 999);
                          while (cur <= en) { const ds = `${String(cur.getDate()).padStart(2, '0')}/${String(cur.getMonth() + 1).padStart(2, '0')}/${cur.getFullYear()}`; const idx = cur.getDay() === 0 ? 6 : cur.getDay() - 1; pts[idx].value += getMinsForDate(ds); cur.setDate(cur.getDate() + 1); }
                        }
                      } else if (studyLinePeriodMode === 'mensal') {
                        const ws = getWeeksLocal(studyLineYear, studyLineMonth);
                        pts = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 }));
                        ws.forEach((w, wi) => { pts[wi].value = sumMinsInRange(w.start, w.end); });
                      } else if (studyLinePeriodMode === 'bimestral') {
                        const m1 = (studyLinePeriodIdx - 1) * 2 + 1;
                        pts = [0, 1].map(i => ({ label: fullMonthNames[m1 + i - 1].slice(0, 3), value: 0 }));
                        pts[0].value = sumMinsInRange(new Date(studyLineYear, m1 - 1, 1), new Date(studyLineYear, m1, 0));
                        pts[1].value = sumMinsInRange(new Date(studyLineYear, m1, 1), new Date(studyLineYear, m1 + 1, 0));
                      } else if (studyLinePeriodMode === 'trimestral') {
                        const m1 = (studyLinePeriodIdx - 1) * 3 + 1;
                        pts = [0, 1, 2].map(i => ({ label: fullMonthNames[m1 + i - 1].slice(0, 3), value: 0 }));
                        [0, 1, 2].forEach(i => { pts[i].value = sumMinsInRange(new Date(studyLineYear, m1 + i - 1, 1), new Date(studyLineYear, m1 + i, 0)); });
                      } else if (studyLinePeriodMode === 'semestral') {
                        const m1 = (studyLinePeriodIdx - 1) * 6 + 1;
                        pts = [0, 1, 2, 3, 4, 5].map(i => ({ label: fullMonthNames[m1 + i - 1].slice(0, 3), value: 0 }));
                        [0, 1, 2, 3, 4, 5].forEach(i => { pts[i].value = sumMinsInRange(new Date(studyLineYear, m1 + i - 1, 1), new Date(studyLineYear, m1 + i, 0)); });
                      } else {
                        pts = fullMonthNames.map(m => ({ label: m.slice(0, 3), value: 0 }));
                        for (let i = 0; i < 12; i++) { pts[i].value = sumMinsInRange(new Date(studyLineYear, i, 1), new Date(studyLineYear, i + 1, 0)); }
                      }
                      return pts;
                    };
                    const lineData = getLineData();
                    const maxLineVal = Math.max(...lineData.map(p => p.value), 1);
                    const lineTotal = lineData.reduce((s, p) => s + p.value, 0);
                    const lineYMin = studyLineYear <= 2020, lineYMax = studyLineYear >= 2030;
                    const lineMMin = studyLineMonth === 1, lineMMax = studyLineMonth === 12;
                    const linePMax = periodMaxMap[studyLinePeriodMode] || 1;
                    const linePMin = studyLinePeriodIdx <= 1, linePMaxb = studyLinePeriodIdx >= linePMax;
                    const lineWMin = safeLineWIdx === 0 && lineMMin, lineWMax = safeLineWIdx === lineWks.length - 1 && lineMMax;

                    return (
                      <div className="flex flex-col w-full mt-10 max-w-4xl">
                        <div className="flex flex-col xl:flex-row items-start gap-8 w-full">
                          {/* Bar Chart */}
                          <div className="flex flex-col items-center gap-6 w-full xl:flex-1">
                            <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-5">
                              <div className="flex w-full overflow-x-auto no-scrollbar justify-start sm:justify-center gap-1.5 pb-1 px-1">
                                {chartPeriodModes.map(pm => (
                                  <button key={`sb-${pm.key}`} onClick={() => setBarMode(pm.key)} className={`whitespace-nowrap px-2.5 sm:px-3 py-1 rounded-full font-black text-[8.5px] sm:text-[9px] uppercase tracking-widest transition-all ${studyBarPeriodMode === pm.key ? 'bg-[#4A69A2] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-[#4A69A2]/30'}`}>
                                    {pm.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2 items-center justify-center">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navBY(-1), '<', barYMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[2.5rem] text-center">{studyBarYear}</span>{navBtn(() => navBY(1), '>', barYMax)}</div>
                                {(studyBarPeriodMode === 'semanal' || studyBarPeriodMode === 'mensal') && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navBM(-1), '<', barMMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[3rem] text-center">{monthNames[studyBarMonth - 1]}</span>{navBtn(() => navBM(1), '>', barMMax)}</div>)}
                                {studyBarPeriodMode === 'semanal' && barCurWk && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navBW(-1), '<', barWMin)}<div className="flex flex-col items-center min-w-[5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{barCurWk.label}</span><span className="text-[8px] font-black text-slate-400">({String(barCurWk.start.getDate()).padStart(2, '0')}/{String(barCurWk.start.getMonth() + 1).padStart(2, '0')} – {String(barCurWk.end.getDate()).padStart(2, '0')}/{String(barCurWk.end.getMonth() + 1).padStart(2, '0')})</span></div>{navBtn(() => navBW(1), '>', barWMax)}</div>)}
                                {['bimestral', 'trimestral', 'semestral'].includes(studyBarPeriodMode) && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navBPI(-1), '<', barPMin)}<div className="flex flex-col items-center min-w-[4.5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{studyBarPeriodIdx}º {studyBarPeriodMode === 'bimestral' ? 'Bim' : studyBarPeriodMode === 'trimestral' ? 'Tri' : 'Sem'}</span><span className="text-[8px] font-black text-slate-400">({periodLabelMap[studyBarPeriodMode]?.[studyBarPeriodIdx - 1]})</span></div>{navBtn(() => navBPI(1), '>', barPMaxb)}</div>)}
                              </div>
                            </div>
                            {barTotal === 0 ? (
                              <div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64">
                                <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-3"><svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados de estudo no período.</p>
                              </div>
                            ) : (
                              <div className="relative w-full animate-fadeIn" style={{ paddingBottom: '60%' }} key={`sb-anim-${studyBarAnimKey}`}>
                                <style>{`@keyframes growBarAnim { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
                                <div className="absolute inset-0 pt-[8.88%] pb-[15.55%] flex flex-col">
                                  <div className={`w-full flex-1 flex items-end justify-between px-1 sm:px-2 border-b-2 border-slate-50 relative group ${barData.length > 7 ? 'gap-0.5 sm:gap-1' : 'gap-1.5'}`}>
                                    {barData.map((b, i) => {
                                      const hPercent = maxBarVal > 0 ? (b.value / maxBarVal) * 100 : 0;
                                      const isHov = studyHoveredBar === i;
                                      const isZero = b.value === 0;
                                      return (
                                        <div key={i} className="group relative flex flex-col items-center flex-1 h-full justify-end cursor-pointer"
                                          onMouseEnter={() => setStudyHoveredBar(i)} onMouseLeave={() => setStudyHoveredBar(null)}>
                                          <div className={`absolute bottom-full mb-3 transition-all duration-300 pointer-events-none z-10 flex flex-col items-center ${isHov ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                            <div className="bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700">
                                              <span className="text-slate-400 block mb-0.5 uppercase tracking-widest text-[8px]">{b.label}</span>
                                              {fmtMins(b.value)}
                                            </div>
                                            <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700" />
                                          </div>
                                          <div className={`w-full ${barData.length > 7 ? 'max-w-[2rem]' : 'max-w-[3rem]'} rounded-t-sm sm:rounded-t-md transition-all duration-500 ${isZero ? 'bg-slate-100' : ''}`}
                                            style={{ backgroundColor: isZero ? undefined : isHov ? '#3b5998' : studyHoveredBar !== null ? '#5a7dbf' : '#4A69A2', height: isZero ? '4px' : `${Math.max(hPercent, 3)}%`, transformOrigin: 'bottom', animation: 'growBarAnim 0.8s cubic-bezier(0.4, 0, 0.2, 1) backwards' }}>
                                            {!isZero && isHov && <div className="w-full h-1 bg-white/30 rounded-t-md" />}
                                          </div>
                                          <span className={`absolute -bottom-6 text-[7px] sm:text-[9px] font-black w-full text-center transition-colors duration-300 ${isHov ? 'text-[#4A69A2]' : 'text-slate-400'}`}>{b.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Vertical divider on xl */}
                          <div className="hidden xl:block w-px self-stretch bg-dotted border-l border-dotted border-black opacity-30 mx-2" />

                          {/* Line Chart */}
                          <div className="flex flex-col items-center gap-6 w-full xl:flex-1">
                            <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-5">
                              <div className="flex w-full overflow-x-auto no-scrollbar justify-start sm:justify-center gap-1.5 pb-1 px-1">
                                {chartPeriodModes.map(pm => (
                                  <button key={`sl-${pm.key}`} onClick={() => setLineMode(pm.key)} className={`whitespace-nowrap px-2.5 sm:px-3 py-1 rounded-full font-black text-[8.5px] sm:text-[9px] uppercase tracking-widest transition-all ${studyLinePeriodMode === pm.key ? 'bg-[#4A69A2] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-[#4A69A2]/30'}`}>
                                    {pm.label}
                                  </button>
                                ))}
                              </div>
                              <div className="flex flex-wrap gap-2 items-center justify-center">
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navLY(-1), '<', lineYMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[2.5rem] text-center">{studyLineYear}</span>{navBtn(() => navLY(1), '>', lineYMax)}</div>
                                {(studyLinePeriodMode === 'semanal' || studyLinePeriodMode === 'mensal') && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navLM(-1), '<', lineMMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[3rem] text-center">{monthNames[studyLineMonth - 1]}</span>{navBtn(() => navLM(1), '>', lineMMax)}</div>)}
                                {studyLinePeriodMode === 'semanal' && lineCurWk && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navLW(-1), '<', lineWMin)}<div className="flex flex-col items-center min-w-[5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{lineCurWk.label}</span><span className="text-[8px] font-black text-slate-400">({String(lineCurWk.start.getDate()).padStart(2, '0')}/{String(lineCurWk.start.getMonth() + 1).padStart(2, '0')} – {String(lineCurWk.end.getDate()).padStart(2, '0')}/{String(lineCurWk.end.getMonth() + 1).padStart(2, '0')})</span></div>{navBtn(() => navLW(1), '>', lineWMax)}</div>)}
                                {['bimestral', 'trimestral', 'semestral'].includes(studyLinePeriodMode) && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{navBtn(() => navLPI(-1), '<', linePMin)}<div className="flex flex-col items-center min-w-[4.5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{studyLinePeriodIdx}º {studyLinePeriodMode === 'bimestral' ? 'Bim' : studyLinePeriodMode === 'trimestral' ? 'Tri' : 'Sem'}</span><span className="text-[8px] font-black text-slate-400">({periodLabelMap[studyLinePeriodMode]?.[studyLinePeriodIdx - 1]})</span></div>{navBtn(() => navLPI(1), '>', linePMaxb)}</div>)}
                              </div>
                            </div>
                            {(() => {
                              const W = 300; const H = 180; const PAD_L = 40; const PAD_R = 12; const PAD_T = 16; const PAD_B = 28;
                              const chartW = W - PAD_L - PAD_R; const chartH = H - PAD_T - PAD_B;
                              if (lineTotal === 0) return (
                                <div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64">
                                  <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-3"><svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg></div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados de estudo no período.</p>
                                </div>
                              );
                              const pts = lineData.map((p, i) => ({ x: PAD_L + (lineData.length > 1 ? (i / (lineData.length - 1)) * chartW : chartW / 2), y: PAD_T + chartH - (p.value / maxLineVal) * chartH, ...p }));
                              const pathD = pts.length > 1 ? pts.map((p, i) => { if (i === 0) return `M ${p.x} ${p.y}`; const prev = pts[i - 1]; const cx = (prev.x + p.x) / 2; return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`; }).join(' ') : `M ${pts[0]?.x} ${pts[0]?.y}`;
                              const areaD = pts.length > 1 ? `${pathD} L ${pts[pts.length - 1].x} ${PAD_T + chartH} L ${pts[0].x} ${PAD_T + chartH} Z` : '';
                              const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD_T + chartH - f * chartH, label: fmtCompact(f * maxLineVal) }));
                              return (
                                <div className="flex flex-col w-full animate-fadeIn" key={`sl-anim-${studyLineAnimKey}`}>
                                  <div className="relative w-full" style={{ paddingBottom: `${(H / W) * 100}%` }}>
                                    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full overflow-visible">
                                      <defs>
                                        <linearGradient id={`studyLineAreaGrad-${studyLineAnimKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4A69A2" stopOpacity="0.25" /><stop offset="100%" stopColor="#4A69A2" stopOpacity="0" /></linearGradient>
                                        <clipPath id={`studySweepClip-${studyLineAnimKey}`}><rect x={0} y={0} width={W} height={H}><animate attributeName="width" from="0" to={W} dur={`${Math.max(1.5, pts.length * 0.25).toFixed(1)}s`} fill="freeze" calcMode="linear" /></rect></clipPath>
                                      </defs>
                                      {yTicks.map((t, i) => (<g key={i}><line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#f1f5f9" strokeWidth="1" /><text x={PAD_L - 4} y={t.y + 4} textAnchor="end" fontSize="7" fill="#94a3b8" fontWeight="700">{t.label}</text></g>))}
                                      <g clipPath={`url(#studySweepClip-${studyLineAnimKey})`}>
                                        {areaD && <path d={areaD} fill={`url(#studyLineAreaGrad-${studyLineAnimKey})`} />}
                                        <path d={pathD} fill="none" stroke="#4A69A2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(74,105,162,0.3))' }} />
                                        {pts.map((p, i) => {
                                          const isHov = studyHoveredLine === i;
                                          return (<g key={i}>
                                            <text x={p.x} y={H - 4} textAnchor="middle" fontSize="7" fill={isHov ? '#4A69A2' : '#94a3b8'} fontWeight="700">{p.label}</text>
                                            <rect x={p.x - 14} y={PAD_T} width={28} height={chartH + 4} fill="transparent" onMouseEnter={() => setStudyHoveredLine(i)} onMouseLeave={() => setStudyHoveredLine(null)} style={{ cursor: 'pointer' }} />
                                            {isHov && <line x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + chartH} stroke="#4A69A2" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />}
                                            <circle cx={p.x} cy={p.y} r={isHov ? 4 : 2} fill={isHov ? '#4A69A2' : '#fff'} stroke="#4A69A2" strokeWidth="1.5" style={{ transition: 'r 0.2s', filter: isHov ? 'drop-shadow(0 2px 6px rgba(74,105,162,0.5))' : 'none' }} />
                                            {isHov && (() => { const tx = p.x + (p.x > W * 0.7 ? -65 : 8); const ty = Math.max(PAD_T + 2, p.y - 28); return (<g><rect x={tx} y={ty} width={60} height={22} rx={4} fill="#1e293b" opacity="0.95" /><text x={tx + 30} y={ty + 9} textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="700">{p.label}</text><text x={tx + 30} y={ty + 18} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="900">{fmtMins(p.value)}</text></g>); })()}
                                          </g>);
                                        })}
                                      </g>
                                    </svg>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* === ANÁLISE DETALHADA DO PERÍODO === */}
                  {(() => {
                    const fullMN = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

                    // --- Determinar range de datas do período selecionado pelo bar chart ---
                    const getWeeksL = (year: number, month: number) => {
                      const wks: { start: Date; end: Date }[] = [];
                      let d = new Date(year, month - 1, 1);
                      while (d.getMonth() === month - 1) {
                        const s = new Date(d); const e = new Date(d);
                        e.setDate(e.getDate() + (6 - e.getDay()));
                        const eom = new Date(year, month, 0);
                        if (e > eom) e.setTime(eom.getTime());
                        wks.push({ start: new Date(s), end: new Date(e) });
                        d = new Date(e); d.setDate(d.getDate() + 1);
                      }
                      return wks;
                    };

                    const getRangeForPeriod = (mode: string, year: number, month: number, weekIdx: number, periodIdx: number): { start: Date; end: Date } => {
                      if (mode === 'semanal') {
                        const wks = getWeeksL(year, month);
                        const w = wks[Math.min(weekIdx, wks.length - 1)] || wks[0];
                        return { start: new Date(w.start), end: new Date(w.end) };
                      } else if (mode === 'mensal') {
                        return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };
                      } else if (mode === 'bimestral') {
                        const m1 = (periodIdx - 1) * 2;
                        return { start: new Date(year, m1, 1), end: new Date(year, m1 + 2, 0) };
                      } else if (mode === 'trimestral') {
                        const m1 = (periodIdx - 1) * 3;
                        return { start: new Date(year, m1, 1), end: new Date(year, m1 + 3, 0) };
                      } else if (mode === 'semestral') {
                        const m1 = (periodIdx - 1) * 6;
                        return { start: new Date(year, m1, 1), end: new Date(year, m1 + 6, 0) };
                      } else { // anual
                        return { start: new Date(year, 0, 1), end: new Date(year, 11, 31) };
                      }
                    };

                    const getPrevRange = (mode: string, year: number, month: number, weekIdx: number, periodIdx: number): { start: Date; end: Date } => {
                      if (mode === 'semanal') {
                        const wks = getWeeksL(year, month);
                        if (weekIdx > 0) {
                          const w = wks[weekIdx - 1];
                          return { start: new Date(w.start), end: new Date(w.end) };
                        }
                        const pm = month === 1 ? 12 : month - 1;
                        const py = month === 1 ? year - 1 : year;
                        const pwks = getWeeksL(py, pm);
                        const w = pwks[pwks.length - 1];
                        return { start: new Date(w.start), end: new Date(w.end) };
                      } else if (mode === 'mensal') {
                        const pm = month === 1 ? 12 : month - 1;
                        const py = month === 1 ? year - 1 : year;
                        return { start: new Date(py, pm - 1, 1), end: new Date(py, pm, 0) };
                      } else if (mode === 'bimestral') {
                        if (periodIdx > 1) { const m1=(periodIdx-2)*2; return { start: new Date(year,m1,1), end: new Date(year,m1+2,0) }; }
                        return { start: new Date(year-1,10,1), end: new Date(year-1,12,0) };
                      } else if (mode === 'trimestral') {
                        if (periodIdx > 1) { const m1=(periodIdx-2)*3; return { start: new Date(year,m1,1), end: new Date(year,m1+3,0) }; }
                        return { start: new Date(year-1,9,1), end: new Date(year-1,12,0) };
                      } else if (mode === 'semestral') {
                        if (periodIdx > 1) { const m1=(periodIdx-2)*6; return { start: new Date(year,m1,1), end: new Date(year,m1+6,0) }; }
                        return { start: new Date(year-1,6,1), end: new Date(year-1,12,0) };
                      } else {
                        return { start: new Date(year-1,0,1), end: new Date(year-1,11,31) };
                      }
                    };

                    const curRange = getRangeForPeriod(studyBarPeriodMode, studyBarYear, studyBarMonth, studyBarWeekIdx, studyBarPeriodIdx);
                    const prevRange = getPrevRange(studyBarPeriodMode, studyBarYear, studyBarMonth, studyBarWeekIdx, studyBarPeriodIdx);

                    // Days count
                    const daysBetween = (s: Date, e: Date) => Math.max(1, Math.round((e.getTime() - s.getTime()) / 86400000) + 1);
                    const totalDays = daysBetween(curRange.start, curRange.end);

                    // Period label
                    const getPeriodLabel = () => {
                      const m = studyBarPeriodMode;
                      if (m === 'semanal') {
                        const wks = getWeeksL(studyBarYear, studyBarMonth);
                        const w = wks[Math.min(studyBarWeekIdx, wks.length - 1)];
                        return `essa Semana (${String(w?.start.getDate()||1).padStart(2,'0')}/${String((w?.start.getMonth()||0)+1).padStart(2,'0')} – ${String(w?.end.getDate()||1).padStart(2,'0')}/${String((w?.end.getMonth()||0)+1).padStart(2,'0')})`;
                      }
                      if (m === 'mensal') return `esse Mês (${fullMN[studyBarMonth-1]} ${studyBarYear})`;
                      if (m === 'bimestral') return `esse Bimestre (${studyBarPeriodIdx}º Bim. ${studyBarYear})`;
                      if (m === 'trimestral') return `esse Trimestre (${studyBarPeriodIdx}º Tri. ${studyBarYear})`;
                      if (m === 'semestral') return `esse Semestre (${studyBarPeriodIdx}º Sem. ${studyBarYear})`;
                      return `esse Ano (${studyBarYear})`;
                    };

                    // collect daily data in range
                    const collectDailyData = (range: {start:Date;end:Date}) => {
                      const items: { dateStr: string; mins: number }[] = [];
                      const cur = new Date(range.start); cur.setHours(0,0,0,0);
                      const end = new Date(range.end); end.setHours(23,59,59,999);
                      while (cur <= end) {
                        const ds = `${String(cur.getDate()).padStart(2,'0')}/${String(cur.getMonth()+1).padStart(2,'0')}/${cur.getFullYear()}`;
                        const mins = studySessionData[ds] || 0;
                        items.push({ dateStr: ds, mins });
                        cur.setDate(cur.getDate() + 1);
                      }
                      return items;
                    };

                    const curDays = collectDailyData(curRange);
                    const prevDays = collectDailyData(prevRange);

                    const curTotal = curDays.reduce((s, d) => s + d.mins, 0);
                    const prevTotal = prevDays.reduce((s, d) => s + d.mins, 0);

                    // top 3 / bottom 3 (only days with > 0)
                    const withStudy = curDays.filter(d => d.mins > 0).sort((a, b) => b.mins - a.mins);
                    const top3 = withStudy.slice(0, 3);
                    const bottom3 = [...withStudy].reverse().slice(0, 3);
                    const bestDay = top3[0] || null;
                    const worstDay = bottom3[0] || null;

                    // average
                    const daysWithStudy = withStudy.length;
                    const avgMins = daysWithStudy > 0 ? curTotal / daysWithStudy : 0;

                    // percentage comparison helpers
                    const pctChange = (cur: number, prev: number) => {
                      if (prev === 0 && cur === 0) return { val: 0, str: '0%' };
                      if (prev === 0) return { val: 100, str: '+100%' };
                      const p = ((cur - prev) / prev) * 100;
                      return { val: p, str: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%` };
                    };

                    // prev metrics for comparison
                    const isFirstPeriod = ['bimestral', 'trimestral', 'semestral'].includes(studyBarPeriodMode) && studyBarPeriodIdx === 1;
                    const hideComparison = isFirstPeriod && studyBarYear <= new Date().getFullYear();

                    const prevWithStudy = prevDays.filter(d => d.mins > 0).sort((a, b) => b.mins - a.mins);
                    const prevAvgMins = prevWithStudy.length > 0 ? prevTotal / prevWithStudy.length : 0;
                    const prevBestDay = prevWithStudy[0] || null;
                    const prevWorstDay = prevWithStudy.length > 0 ? prevWithStudy[prevWithStudy.length - 1] : null;

                    const totalPct = hideComparison ? undefined : pctChange(curTotal, prevTotal);
                    const avgPct = hideComparison ? undefined : pctChange(avgMins, prevAvgMins);
                    const bestPct = hideComparison ? undefined : pctChange(bestDay?.mins || 0, prevBestDay?.mins || 0);
                    const worstPct = hideComparison ? undefined : pctChange(worstDay?.mins || 0, prevWorstDay?.mins || 0);

                    // period of day
                    const periodTotals = { matutino: 0, vespertino: 0, noturno: 0, madrugada: 0 };
                    curDays.forEach(d => {
                      const tp = studyTimePeriods[d.dateStr];
                      if (tp) {
                        periodTotals.matutino += tp.matutino || 0;
                        periodTotals.vespertino += tp.vespertino || 0;
                        periodTotals.noturno += tp.noturno || 0;
                        periodTotals.madrugada += tp.madrugada || 0;
                      }
                    });
                    const periodEntries = Object.entries(periodTotals) as [string, number][];
                    const bestPeriod = periodEntries.reduce((a, b) => b[1] > a[1] ? b : a, ['matutino', 0]);
                    const periodLabels: Record<string, string> = { matutino: 'Matutino (6h–12h)', vespertino: 'Vespertino (12h–18h)', noturno: 'Noturno (18h–00h)', madrugada: 'Madrugada (00h–6h)' };
                    const periodTotalMins = periodEntries.reduce((s, [, v]) => s + v, 0);

                    // prev period of day
                    const prevPeriodTotals = { matutino: 0, vespertino: 0, noturno: 0, madrugada: 0 };
                    prevDays.forEach(d => {
                      const tp = studyTimePeriods[d.dateStr];
                      if (tp) {
                        prevPeriodTotals.matutino += tp.matutino || 0;
                        prevPeriodTotals.vespertino += tp.vespertino || 0;
                        prevPeriodTotals.noturno += tp.noturno || 0;
                        prevPeriodTotals.madrugada += tp.madrugada || 0;
                      }
                    });
                    const prevBestPeriodVal = (prevPeriodTotals as any)[bestPeriod[0]] || 0;
                    const periodPct = hideComparison ? undefined : pctChange(bestPeriod[1], prevBestPeriodVal);

                    const fmtM = (mins: number) => {
                      if (mins === 0) return '0min';
                      const h = Math.floor(mins / 60);
                      const m = Math.round(mins % 60);
                      if (h === 0) return `${m}min`;
                      if (m === 0) return `${h}h`;
                      return `${h}h${m}m`;
                    };

                    const periodCompLabelMap: Record<string, string> = { semanal: 'à sem. anterior', mensal: 'ao mês anterior', bimestral: 'ao bim. anterior', trimestral: 'ao tri. anterior', semestral: 'ao sem. anterior', anual: 'ao ano anterior' };
                    const periodCompLabel = periodCompLabelMap[studyBarPeriodMode] || 'ao período anterior';

                    const InfoRow = ({ icon, label, value, sub, pct, compLabel }: { icon: React.ReactNode; label: string; value: string; sub?: string; pct?: { val: number; str: string }; compLabel?: string }) => (
                      <div className={`relative flex items-start gap-3 p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'} shadow-sm`}>
                        {pct && (
                          <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                            {compLabel && <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none">em rel. {compLabel}</span>}
                            <span className={`text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full ${pct.val > 0 ? 'bg-green-50 text-green-600' : pct.val < 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                              {pct.str}
                            </span>
                          </div>
                        )}
                        <div className="w-9 h-9 rounded-xl bg-[#4A69A2]/10 flex items-center justify-center shrink-0 mt-0.5">{icon}</div>
                        <div className="flex-1 min-w-0 pr-16 text-left">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
                          </div>
                          <div className={`text-lg sm:text-xl font-black mt-1 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{value}</div>
                          {sub && <div className="text-[10px] font-bold text-slate-400 mt-0.5">{sub}</div>}
                        </div>
                      </div>
                    );

                    return (
                      <div className="mt-10 w-full max-w-4xl">
                        <h3 className={`text-sm sm:text-base font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          {getPeriodLabel()} ({totalDays} dias):
                        </h3>
                        <p className={`text-[10px] sm:text-xs font-bold mb-6 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          Análise detalhada do período selecionado
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                          {/* Top 3 dias */}
                          <InfoRow
                            icon={<svg className="w-4 h-4 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>}
                            label="Dias que mais estudei"
                            value={top3.length > 0 ? top3.map(d => `${d.dateStr.slice(0,5)} (${fmtM(d.mins)})`).join(' · ') : 'Sem dados'}
                            sub="Top 3 dias com maior tempo de estudo"
                          />

                          {/* Dia record */}
                          <InfoRow
                            icon={<svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>}
                            label="Dia que MAIS estudei"
                            value={bestDay ? `${bestDay.dateStr} — ${fmtM(bestDay.mins)}` : 'Sem dados'}
                            sub="Recorde no período"
                            pct={bestPct}
                            compLabel={periodCompLabel}
                          />

                          {/* Média */}
                          <InfoRow
                            icon={<svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                            label="Média de horas de estudo"
                            value={fmtM(avgMins)}
                            sub={`Soma total: ${fmtM(curTotal)} em ${daysWithStudy} dia(s) com estudo`}
                            pct={avgPct}
                            compLabel={periodCompLabel}
                          />

                          {/* Bottom 3 dias */}
                          <InfoRow
                            icon={<svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
                            label="Dias que menos estudei"
                            value={bottom3.length > 0 ? bottom3.map(d => `${d.dateStr.slice(0,5)} (${fmtM(d.mins)})`).join(' · ') : 'Sem dados'}
                            sub="3 dias com menor tempo de estudo"
                          />

                          {/* Dia mínimo */}
                          <InfoRow
                            icon={<svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>}
                            label="Dia que MENOS estudei"
                            value={worstDay ? `${worstDay.dateStr} — ${fmtM(worstDay.mins)}` : 'Sem dados'}
                            sub="Mínimo no período"
                            pct={worstPct}
                            compLabel={periodCompLabel}
                          />

                          {/* Período do dia */}
                          <InfoRow
                            icon={<svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>}
                            label="Período do dia que mais estudo"
                            value={periodTotalMins > 0 ? periodLabels[bestPeriod[0]] : 'Sem dados'}
                            sub={periodTotalMins > 0 ? `${fmtM(bestPeriod[1])} nesse turno (${((bestPeriod[1] / periodTotalMins) * 100).toFixed(0)}% do total)` : 'Estude mais para ver essa estatística'}
                            pct={periodTotalMins > 0 ? periodPct : undefined}
                            compLabel={periodCompLabel}
                          />
                        </div>
                      </div>
                    );
                  })()}


                  {(() => {
                    const computeStudyStatsText = () => {
                      const dates = Object.keys(studySessionData).sort((a, b) => {
                         const [da, ma, ya] = a.split('/');
                         const [db, mb, yb] = b.split('/');
                         return new Date(+ya, +ma - 1, +da).getTime() - new Date(+yb, +mb - 1, +db).getTime();
                      });

                      if (dates.length === 0) {
                         return { currentStreak: 0, maxStreak: 0, consistency: '0.0', dailyAvg: '0.0' };
                      }
                      
                      const dateObjs = dates.map(d => {
                         const [dd, mm, yyyy] = d.split('/');
                         return new Date(+yyyy, +mm - 1, +dd);
                      });

                      let maxS = 0;
                      let tempS = 1;
                      for (let i = 1; i < dateObjs.length; i++) {
                         const diff = Math.round((dateObjs[i].getTime() - dateObjs[i-1].getTime()) / 86400000);
                         if (diff === 1) tempS++;
                         else if (diff > 1) {
                            if (tempS > maxS) maxS = tempS;
                            tempS = 1;
                         }
                      }
                      if (tempS > maxS) maxS = tempS;

                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const lastDate = dateObjs[dateObjs.length - 1];
                      const lastDiff = Math.round((today.getTime() - lastDate.getTime()) / 86400000);
                      
                      let curS = 0;
                      if (lastDiff === 0 || lastDiff === 1) {
                         curS = 1;
                         for (let i = dateObjs.length - 1; i > 0; i--) {
                            const diff = Math.round((dateObjs[i].getTime() - dateObjs[i-1].getTime()) / 86400000);
                            if (diff === 1) curS++;
                            else break;
                         }
                      }

                      const firstDate = dateObjs[0];
                      const totalDaysSpan = Math.max(1, Math.round((today.getTime() - firstDate.getTime()) / 86400000) + 1);
                      const constRate = ((dateObjs.length / totalDaysSpan) * 100).toFixed(1);

                      const totalMinutes = Object.values(studySessionData).reduce((sum, mins) => sum + mins, 0);
                      const dAvg = (totalMinutes / dateObjs.length / 60).toFixed(1);

                      return { currentStreak: curS, maxStreak: maxS, consistency: constRate, dailyAvg: dAvg };
                    };

                    const statsValues = computeStudyStatsText();

                    return (
                      <div className="mt-8 w-full max-w-4xl">
                        <h3 className={`text-sm sm:text-base font-black uppercase tracking-widest mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                          Meu Progresso:
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 w-full">
                          {/* Sequência Atual */}
                          <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Sequência Atual</span>
                          </div>
                          <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{statsValues.currentStreak} <span className="text-xl sm:text-2xl font-bold">dias</span></div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Estudo Consecutivo</div>
                        </div>

                        {/* Melhor Sequência */}
                        <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-[#fafbdf]'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Melhor Sequência</span>
                          </div>
                          <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{statsValues.maxStreak} <span className="text-xl sm:text-2xl font-bold">dias</span></div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Recorde Pessoal</div>
                        </div>

                        {/* Taxa de Consistência */}
                        <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-[#f4f7fc]'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Taxa de Consistência</span>
                          </div>
                          <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{statsValues.consistency}<span className="text-xl sm:text-2xl font-bold">%</span></div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Presença Total</div>
                        </div>

                        {/* Média Diária */}
                        <div className={`p-5 rounded-2xl border-[3px] border-[#4A69A2] shadow-[4px_4px_0_0_#4A69A2] flex flex-col gap-1 ${isDarkMode ? 'bg-slate-900' : 'bg-[#f1fbf7]'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            <span className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Média Diária</span>
                          </div>
                          <div className={`text-3xl sm:text-4xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{statsValues.dailyAvg}<span className="text-xl sm:text-2xl font-bold">h</span></div>
                          <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Tempo Médio</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                   {/* === MINHAS MATÉRIAS – PIE CHART === */}
                   {(() => {
                     // Filter books to only categories with discipline: vídeo aulas, revisões, questões
                     const validCategories = ['Minhas vídeo aulas', 'Minhas revisões', 'Minhas questões'];
                     const filteredBooks = studyBooks.filter((b: any) =>
                       validCategories.includes(b.categoryId) && b.videoDiscipline
                     );

                     // Aggregate data by mode
                     const aggregate = () => {
                       const catMap: Record<string, { name: string; total: number }> = {};
                       
                       if (materiasPieMode === 'discipline_matter' && materiasPieSelectedDiscipline) {
                         const selDisc = materiasPieSelectedDiscipline;
                         const isSpecialDisc = ['Geografia', 'História', 'Português'].includes(selDisc);
                         let allMatters: string[] = [];
                         
                         if (isSpecialDisc) {
                           if (!materiasPieSelectedArea) return []; // Wait for area
                           allMatters = areaMatters[materiasPieSelectedArea] || [];
                         } else {
                           allMatters = disciplineMatters[selDisc] || [];
                         }

                         for (const matter of allMatters) {
                           const key = `${selDisc}__${matter}`;
                           catMap[key] = { name: matter, total: 0 };
                         }

                         const discBooks = filteredBooks.filter((b: any) => b.videoDiscipline === selDisc && (!isSpecialDisc || b.videoArea === materiasPieSelectedArea));
                         for (const b of discBooks) {
                           const matter = b.videoMatter || 'Sem matéria';
                           const key = `${selDisc}__${matter}`;
                           if (!catMap[key] && allMatters.includes(matter)) {
                             catMap[key] = { name: matter, total: 0 };
                           }
                           if (catMap[key]) {
                             catMap[key].total += (studyItemTimes[b.id] || 0);
                           }
                         }
                       } else {
                         // Só disciplina: Inicia todas as disciplinas com 0 para sempre exibi-las
                         for (const disc of disciplinesList) {
                           catMap[disc] = { name: disc, total: 0 };
                         }
                         for (const b of filteredBooks) {
                           const key = b.videoDiscipline || 'Sem disciplina';
                           if (!catMap[key] && disciplinesList.includes(key)) {
                             catMap[key] = { name: key, total: 0 };
                           } else if (!catMap[key]) {
                             // Fallback if there's some unexpected discipline
                             catMap[key] = { name: key, total: 0 };
                           }
                           catMap[key].total += (studyItemTimes[b.id] || 0);
                         }
                       }
                       
                       return Object.entries(catMap)
                         .filter(([, s]) => true) // Mostra sempre (mesmo com total 0) tanto em disciplina quanto em matéria
                         .sort(([, a], [, b]) => b.total - a.total)
                         .map(([key, s]) => ({ key, ...s }));
                     };

                     const PIE_COLORS = [
                       '#4A69A2', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6',
                       '#ec4899', '#06b6d4', '#f97316', '#4d7c0f', '#78350f',
                       '#0ea5e9', '#6366f1', '#14b8a6', '#e11d48', '#a855f7',
                       '#84cc16', '#d946ef', '#0891b2', '#dc2626', '#059669'
                     ];

                     let rawSlices = aggregate();
                     // Auto-group small categories into "Outros" if >8
                     let slices = rawSlices;
                     if (rawSlices.length > 8) {
                       const top7 = rawSlices.slice(0, 7);
                       const rest = rawSlices.slice(7);
                       const outrosTotal = rest.reduce((s, c) => s + c.total, 0);
                       slices = [...top7, { key: '__outros__', name: 'Outros', total: outrosTotal }];
                     }

                     // Assign colors
                     const coloredSlices = slices.map((s, i) => ({
                       ...s,
                       color: PIE_COLORS[i % PIE_COLORS.length]
                     }));

                     const grandTotal = coloredSlices.reduce((s, c) => s + c.total, 0);

                     const visibleSlices = coloredSlices.filter(s => !materiasPieHiddenCats[s.key]);
                     const visibleTotal = visibleSlices.reduce((s, c) => s + c.total, 0);

                     // SVG donut chart math
                     const R = 90;
                     const cx = 120;
                     const cy = 120;
                     const circumference = 2 * Math.PI * R;
                     let cumulative = 0;
                     const pieSlices = visibleSlices.map(s => {
                       const frac = visibleTotal > 0 ? s.total / visibleTotal : 0;
                       const offset = circumference * (1 - cumulative);
                       const dash = circumference * frac;
                       cumulative += frac;
                       const isHighlighted = frac > 0.4;
                       const isHovered = materiasPieHoveredCat === s.key;
                       return { ...s, dash, offset, frac, isHighlighted, isHovered };
                     });

                     return (
                       <div className="mt-10 w-full max-w-4xl">
                         <h3 className={`text-sm sm:text-base font-black uppercase tracking-widest mb-6 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                           Minhas matérias:
                         </h3>

                        <div className="flex flex-col items-center gap-6 w-full">
                          {/* Mode toggle: Só disciplina / Disciplina e Matéria */}
                          <div className="flex flex-col items-center gap-3 w-full">
                            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner gap-1">
                              <button
                                onClick={() => { setMateriasPieMode('discipline'); setMateriasPieHiddenCats({}); setMateriasPieHoveredCat(null); setMateriasPieAnimKey(k => k + 1); }}
                                className={`px-4 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${materiasPieMode === 'discipline' ? 'bg-[#4A69A2] text-white shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                              >
                                Só disciplina
                              </button>
                              <button
                                onClick={() => { setMateriasPieMode('discipline_matter'); setMateriasPieHiddenCats({}); setMateriasPieHoveredCat(null); setMateriasPieAnimKey(k => k + 1); }}
                                className={`px-4 py-1.5 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${materiasPieMode === 'discipline_matter' ? 'bg-[#4A69A2] text-white shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                              >
                                Disciplina e Matéria
                              </button>
                            </div>

                            {materiasPieMode === 'discipline_matter' && (
                              <div className="flex flex-row w-full max-w-2xl justify-center gap-4 px-4 animate-fadeIn">
                                <div className="flex-1 flex flex-col gap-1.5">
                                  <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest pl-2">Disciplina</label>
                                  <select 
                                    value={materiasPieSelectedDiscipline} 
                                    onChange={(e) => { setMateriasPieSelectedDiscipline(e.target.value); setMateriasPieSelectedArea(''); setMateriasPieHiddenCats({}); setMateriasPieHoveredCat(null); setMateriasPieAnimKey(k => k + 1); }} 
                                    className="w-full p-3 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white cursor-pointer hover:border-black/20 focus:border-[#4A69A2] transition-colors"
                                  >
                                    <option value="" disabled hidden>Selecione...</option>
                                    {disciplinesList.map(d => <option key={d} value={d}>{d}</option>)}
                                  </select>
                                </div>

                                {['Geografia', 'História', 'Português'].includes(materiasPieSelectedDiscipline) && (
                                  <div className="flex-1 flex flex-col gap-1.5 animate-fadeIn">
                                    <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest pl-2">Área</label>
                                    <select 
                                      value={materiasPieSelectedArea} 
                                      onChange={(e) => { setMateriasPieSelectedArea(e.target.value); setMateriasPieHiddenCats({}); setMateriasPieHoveredCat(null); setMateriasPieAnimKey(k => k + 1); }} 
                                      className="w-full p-3 border-2 border-black/10 rounded-xl font-bold text-slate-800 outline-none bg-white cursor-pointer hover:border-black/20 focus:border-[#4A69A2] transition-colors"
                                    >
                                      <option value="" disabled hidden>Selecione...</option>
                                      {materiasPieSelectedDiscipline === 'Geografia' && (
                                        <>
                                          <option value="Geografia física">Geografia física</option>
                                          <option value="Geografia humana">Geografia humana</option>
                                        </>
                                      )}
                                      {materiasPieSelectedDiscipline === 'História' && (
                                        <>
                                          <option value="História geral">História geral</option>
                                          <option value="História do Brasil">História do Brasil</option>
                                        </>
                                      )}
                                      {materiasPieSelectedDiscipline === 'Português' && (
                                        <>
                                          <option value="Gramática">Gramática</option>
                                          <option value="Interpretação de texto">Interpretação de texto</option>
                                        </>
                                      )}
                                    </select>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {materiasPieMode === 'discipline_matter' && (!materiasPieSelectedDiscipline || (['Geografia', 'História', 'Português'].includes(materiasPieSelectedDiscipline) && !materiasPieSelectedArea)) ? (
                            <div className="flex flex-col items-center gap-4 py-8 animate-fadeIn w-full opacity-60">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                                {!materiasPieSelectedDiscipline ? 'Selecione uma disciplina acima.' : 'Selecione uma área acima.'}
                              </p>
                            </div>
                          ) : grandTotal === 0 && materiasPieMode === 'discipline' ? (
                            <div className="flex flex-col items-center gap-4 py-12 animate-fadeIn w-full opacity-60">
                              <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-2">
                                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                              </div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados de matérias para listar.<br />Adicione vídeo aulas, revisões ou questões com disciplinas.</p>
                            </div>
                          ) : (
                            <>
                              {/* Donut Chart */}
                              <div className="relative flex items-center justify-center animate-fadeIn" style={{ width: 240, height: 240 }} key={`mat-pie-${materiasPieAnimKey}`}>
                                <svg width="240" height="240" viewBox="0 0 240 240" style={{ transform: 'rotate(-90deg)' }}>
                                  {/* Background track */}
                                  <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f1f5f9" strokeWidth="38" />
                                  {pieSlices.map((slice) => (
                                    <circle
                                      key={slice.key}
                                      cx={cx}
                                      cy={cy}
                                      r={R}
                                      fill="none"
                                      stroke={slice.color}
                                      strokeWidth={slice.isHovered ? 44 : slice.isHighlighted ? 42 : 36}
                                      strokeDasharray={`${slice.dash} ${circumference - slice.dash}`}
                                      strokeDashoffset={slice.offset}
                                      strokeLinecap="butt"
                                      onMouseEnter={() => setMateriasPieHoveredCat(slice.key)}
                                      onMouseLeave={() => setMateriasPieHoveredCat(null)}
                                      onClick={() => setMateriasPieHoveredCat(materiasPieHoveredCat === slice.key ? null : slice.key)}
                                      style={{
                                        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                        opacity: materiasPieHoveredCat && !slice.isHovered ? 0.4 : 0.92,
                                        cursor: 'pointer',
                                        filter: slice.isHighlighted ? 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))' : 'none'
                                      }}
                                    >
                                      <animate attributeName="stroke-dasharray" from={`0 ${circumference}`} to={`${slice.dash} ${circumference - slice.dash}`} dur="1s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                                    </circle>
                                  ))}
                                </svg>
                                {/* Center label */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                  {materiasPieHoveredCat ? (() => {
                                    const h = pieSlices.find(s => s.key === materiasPieHoveredCat);
                                    if (!h) return null;
                                    return (
                                      <div className="animate-fadeIn flex flex-col items-center">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center px-2 max-w-[140px] truncate">{h.name}</span>
                                        <span className="text-base font-black text-slate-800">
                                          {Math.floor(h.total / 60) > 0 ? `${Math.floor(h.total / 60)}h ` : ''}{Math.round(h.total % 60)}m
                                        </span>
                                        <span className="text-[10px] font-black text-slate-500">{(h.frac * 100).toFixed(1)}%</span>
                                      </div>
                                    );
                                  })() : (
                                    <>
                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                                      <span className="text-base font-black text-slate-800 leading-tight">
                                        {Math.floor(visibleTotal / 60) > 0 ? `${Math.floor(visibleTotal / 60)}h ` : ''}{Math.round(visibleTotal % 60)}m
                                      </span>
                                      <span className="text-[10px] font-black text-slate-400">{visibleSlices.length} {materiasPieMode === 'discipline' ? 'disciplinas' : 'matérias'}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Legend */}
                              <div className="flex flex-col gap-2.5 w-full">
                                {coloredSlices.map((slice) => {
                                  const isHidden = !!materiasPieHiddenCats[slice.key];
                                  const frac = grandTotal > 0 ? slice.total / grandTotal : 0;
                                  const isHighlighted = frac > 0.4;

                                  return (
                                    <div
                                      key={slice.key}
                                      onClick={() => {
                                        setMateriasPieHiddenCats(prev => ({ ...prev, [slice.key]: !prev[slice.key] }));
                                        setMateriasPieAnimKey(k => k + 1);
                                      }}
                                      onMouseEnter={() => setMateriasPieHoveredCat(slice.key)}
                                      onMouseLeave={() => setMateriasPieHoveredCat(null)}
                                      className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                        isHidden
                                          ? 'bg-slate-50 border-slate-100 opacity-40'
                                          : isHighlighted
                                            ? 'bg-white border-2 border-black/20 shadow-md'
                                            : materiasPieHoveredCat === slice.key
                                              ? 'bg-white border-slate-200 shadow-md scale-[1.02]'
                                              : 'bg-white border-slate-100 shadow-sm hover:border-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={`w-3 h-3 rounded-full flex-shrink-0 transition-all ${isHidden ? 'opacity-30' : ''}`}
                                          style={{ backgroundColor: slice.color }}
                                        />
                                        <span className={`text-xs font-black uppercase tracking-wide ${isHidden ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{slice.name}</span>
                                        {isHighlighted && !isHidden && (
                                          <span className="text-[8px] font-black text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-wider">Destaque</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="text-[10px] font-black text-slate-400">{(frac * 100).toFixed(1)}%</span>
                                        <span className={`text-xs font-black ${isHidden ? 'text-slate-400' : 'text-slate-800'}`}>
                                          {Math.floor(slice.total / 60) > 0 ? `${Math.floor(slice.total / 60)}h ` : ''}{Math.round(slice.total % 60)}m
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}

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
