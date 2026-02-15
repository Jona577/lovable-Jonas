import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

type RoutineView = 'menu' | 'selectDuration' | 'selectStartDate' | 'editor' | 'list' | 'viewer';

interface WeeklyTable {
  weekIndex: number;
  startDate: string; // DD/MM
  endDate: string;   // DD/MM
  fullStartDate: string; // ISO String para cálculos
  hourLabels: string[]; 
  cells: string[][];    
}

interface SavedRoutine {
  id: string;
  name: string;
  durationLabel: string;
  startDate: string;
  endDate: string;
  fullStartDate: string; // ISO String
  weeks: WeeklyTable[];
  createdAt: string;
}

interface RoutineProps {
  isDarkMode?: boolean;
}

interface Task {
  id: string;
  text: string;
  completed: boolean;
  category: string;
  priority?: 'Alta' | 'Média' | 'Baixa';
  time?: string;
  categoryColor?: string;
  timeframe?: 'today' | 'other';
  date?: string; // DD/MM/YYYY
}

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

const weekDays = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];

const durationOptions = [
  { label: 'Uma semana', weeks: 1 },
  { label: 'Duas semanas', weeks: 2 },
  { label: 'Três semanas', weeks: 3 },
  { label: 'Um mês', weeks: 4 },
  { label: 'Dois meses', weeks: 8 },
  { label: 'Três meses', weeks: 12 },
];

/**
 * Componente de Célula Editável.
 */
const EditableCell = memo<{
  initialHtml: string;
  rowIndex: number;
  colIndex?: number;
  onUpdate: (html: string, r: number, c?: number) => void;
  onFocus: (el: HTMLElement) => void;
  updateToolbar: () => void;
  className?: string;
  placeholder?: string;
  tasks?: Task[];
  readOnly?: boolean;
}>(({ initialHtml, rowIndex, colIndex, onUpdate, onFocus, updateToolbar, className, placeholder, tasks = [], readOnly = false }) => {
  const elRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef(initialHtml);

  useEffect(() => {
    if (elRef.current && !readOnly) {
      elRef.current.innerHTML = sanitizeHtml(initialHtml);
      lastUpdateRef.current = initialHtml;
    }
  }, [initialHtml, readOnly]);

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (readOnly) return;
    const html = sanitizeHtml(e.currentTarget.innerHTML);
    if (html !== lastUpdateRef.current) {
      onUpdate(html, rowIndex, colIndex);
      lastUpdateRef.current = html;
    }
  };

  return (
    <div className={`${className} flex flex-col gap-2 relative group/cell`}>
      <div
        ref={elRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={`font-normal outline-none min-h-[40px] ${readOnly ? 'cursor-default' : 'cursor-text'}`}
        onFocus={(e) => {
          if (!readOnly) {
            if (placeholder && e.currentTarget.innerText.trim() === placeholder) {
              e.currentTarget.innerText = '';
            }
            onFocus(e.currentTarget);
            updateToolbar();
          }
        }}
        onBlur={handleBlur}
        onKeyUp={!readOnly ? updateToolbar : undefined}
        onMouseUp={!readOnly ? updateToolbar : undefined}
        dangerouslySetInnerHTML={readOnly ? { __html: sanitizeHtml(initialHtml) } : undefined}
      />

      {tasks.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2">
          {tasks.map(task => (
            <div 
              key={task.id}
              style={{ backgroundColor: task.categoryColor || '#94a3b8' }}
              className="px-3 py-2 rounded-xl text-white text-[10px] font-black shadow-sm flex items-center justify-between border border-black/10 transition-transform hover:scale-[1.02]"
              title={`Tarefa: ${task.text} (${task.category || 'Sem Categoria'})`}
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className={`w-3 h-3 rounded-full shrink-0 border border-white/30 ${task.completed ? 'bg-black' : 'bg-white/20'}`}>
                   {task.completed && <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className={`truncate ${task.completed ? 'line-through opacity-50' : ''}`}>{task.text}</span>
              </div>
              {task.time && <span className="text-[8px] opacity-70 ml-2 shrink-0">{task.time}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

const Routine: React.FC<RoutineProps> = ({ isDarkMode }) => {
  const [view, setView] = useState<RoutineView>('menu');
  const [routines, setRoutines] = useState<SavedRoutine[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDuration, setSelectedDuration] = useState<{ label: string; weeks: number } | null>(null);
  const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [editingWeeks, setEditingWeeks] = useState<WeeklyTable[]>([]);
  const [transitionAnim, setTransitionAnim] = useState<'slide-left' | 'slide-right' | ''>('');
  const [activeRoutineId, setActiveRoutineId] = useState<string | null>(null);

  const [hourEditIndex, setHourEditIndex] = useState<number | null>(null);
  const [tempHours, setTempHours] = useState(12);
  const [tempMinutes, setTempMinutes] = useState(0);
  const [timeError, setTimeError] = useState<string | null>(null);

  // Estados para modais extras
  const [routineToDelete, setRoutineToDelete] = useState<SavedRoutine | null>(null);
  const [dayDetailIndex, setDayDetailIndex] = useState<number | null>(null);

  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);
  const [isMarkersMenuOpen, setIsMarkersMenuOpen] = useState(false);
  const [activeBold, setActiveBold] = useState(false);
  const [activeAlign, setActiveAlign] = useState('justifyLeft');
  const [activeColor, setActiveColor] = useState('#000000');
  const [activeFont, setActiveFont] = useState('Arial');
  const [activeSize, setActiveSize] = useState('3');

  const fontMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const markersMenuRef = useRef<HTMLDivElement>(null);
  const lastActiveElementRef = useRef<HTMLElement | null>(null);

  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';

  const updateToolbarState = useCallback(() => {
    setActiveBold(document.queryCommandState('bold'));
    if (document.queryCommandState('justifyCenter')) setActiveAlign('justifyCenter');
    else if (document.queryCommandState('justifyRight')) setActiveAlign('justifyRight');
    else setActiveAlign('justifyLeft');
    const color = document.queryCommandValue('foreColor');
    if (color) setActiveColor(color);
    const font = document.queryCommandValue('fontName');
    if (font) {
      const cleanFont = font.replace(/"/g, '').split(',')[0];
      const match = fonts.find(f => f.value.includes(cleanFont));
      if (match) setActiveFont(match.name);
    }
    const size = document.queryCommandValue('fontSize');
    if (size) setActiveSize(size);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('produtivity_routines');
    if (saved) setRoutines(JSON.parse(saved));

    const savedTasks = localStorage.getItem('produtivity_tasks_v3');
    if (savedTasks) setTasks(JSON.parse(savedTasks));

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fontMenuRef.current && !fontMenuRef.current.contains(target)) setIsFontMenuOpen(false);
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(target)) setIsFontSizeMenuOpen(false);
      if (markersMenuRef.current && !markersMenuRef.current.contains(target)) setIsMarkersMenuOpen(false);
    };

    const handleSelectionChange = () => {
      if (view === 'editor') updateToolbarState();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [view, updateToolbarState]);

  const saveToLocal = (data: SavedRoutine[]) => {
    localStorage.setItem('produtivity_routines', JSON.stringify(data));
    setRoutines(data);
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    updateToolbarState();
  };

  const insertMarker = (symbol: string) => {
    document.execCommand('insertText', false, symbol + ' ');
    setIsMarkersMenuOpen(false);
    updateToolbarState();
  };

  /**
   * Gera períodos sequenciais começando em 26/01/2026 até o fim de 2027.
   */
  const generateStartWeeks = () => {
    const weeks = [];
    const baseDate = new Date(2026, 0, 26); // Alterado de 28/01 para 26/01
    const endDateLimit = new Date(2027, 11, 31); 
    const intervalWeeks = selectedDuration?.weeks || 1;
    let currentStart = new Date(baseDate);
    while (currentStart <= endDateLimit) {
      const periodStart = new Date(currentStart);
      const periodEnd = new Date(currentStart);
      periodEnd.setDate(currentStart.getDate() + (intervalWeeks * 7) - 1);
      weeks.push({ monday: periodStart, endOfPeriod: periodEnd });
      currentStart = new Date(periodEnd);
      currentStart.setDate(currentStart.getDate() + 1);
    }
    return weeks;
  };

  const startEditor = (startDate: Date) => {
    setSelectedStartDate(startDate);
    const numWeeks = selectedDuration?.weeks || 1;
    const initialWeeks: WeeklyTable[] = [];
    for (let w = 0; w < numWeeks; w++) {
      const wStart = new Date(startDate);
      wStart.setDate(startDate.getDate() + w * 7);
      const wEnd = new Date(wStart);
      wEnd.setDate(wStart.getDate() + 6);
      initialWeeks.push({
        weekIndex: w,
        startDate: wStart.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        endDate: wEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        fullStartDate: wStart.toISOString(),
        hourLabels: Array(7).fill('--:--'),
        cells: Array(7).fill(null).map(() => Array(7).fill(''))
      });
    }
    setEditingWeeks(initialWeeks);
    setCurrentWeekIndex(0);
    setActiveRoutineId(null);
    setView('editor');
  };

  const changeWeek = (newIdx: number) => {
    const direction = newIdx > currentWeekIndex ? 'slide-left' : 'slide-right';
    setTransitionAnim(direction);
    setTimeout(() => {
      setCurrentWeekIndex(newIdx);
      setTransitionAnim('');
    }, 200);
  };

  const addRow = () => {
    setEditingWeeks(prev => {
      const updated = [...prev];
      const week = { ...updated[currentWeekIndex] };
      week.hourLabels = [...week.hourLabels, '--:--'];
      week.cells = [...week.cells, Array(7).fill('')];
      updated[currentWeekIndex] = week;
      return updated;
    });
  };

  const deleteRow = (idx: number) => {
    setEditingWeeks(prev => {
      const updated = [...prev];
      const week = { ...updated[currentWeekIndex] };
      if (week.hourLabels.length <= 1) return prev;
      week.hourLabels.splice(idx, 1);
      week.cells.splice(idx, 1);
      updated[currentWeekIndex] = week;
      return updated;
    });
  };

  const handleCellUpdate = useCallback((html: string, r: number, c?: number) => {
    if (c === undefined) return;
    setEditingWeeks(prev => {
      const updated = [...prev];
      updated[currentWeekIndex].cells[r][c] = html;
      return updated;
    });
  }, [currentWeekIndex]);

  const handleFocus = useCallback((el: HTMLElement) => {
    lastActiveElementRef.current = el;
  }, []);

  const openHourPicker = (rowIndex: number) => {
    if (view === 'viewer') return;
    const currentLabel = editingWeeks[currentWeekIndex].hourLabels[rowIndex];
    if (currentLabel !== '--:--') {
      const [h, m] = currentLabel.split(':').map(Number);
      setTempHours(h);
      setTempMinutes(m);
    } else {
      setTempHours(8);
      setTempMinutes(0);
    }
    setTimeError(null);
    setHourEditIndex(rowIndex);
  };

  const saveSelectedTime = () => {
    if (hourEditIndex === null) return;
    const currentTotalMinutes = tempHours * 60 + tempMinutes;
    const currentWeek = editingWeeks[currentWeekIndex];
    if (hourEditIndex > 0) {
      const prevLabel = currentWeek.hourLabels[hourEditIndex - 1];
      if (prevLabel !== '--:--') {
        const [prevH, prevM] = prevLabel.split(':').map(Number);
        const prevTotalMinutes = prevH * 60 + prevM;
        if (currentTotalMinutes <= prevTotalMinutes) {
          setTimeError("O horário deve ser posterior ao da linha anterior.");
          return;
        }
      }
    }
    if (hourEditIndex < currentWeek.hourLabels.length - 1) {
      const nextLabel = currentWeek.hourLabels[hourEditIndex + 1];
      if (nextLabel !== '--:--') {
        const [nextH, nextM] = nextLabel.split(':').map(Number);
        const nextTotalMinutes = nextH * 60 + nextM;
        if (currentTotalMinutes >= nextTotalMinutes) {
          setTimeError("O horário deve ser anterior ao da linha posterior.");
          return;
        }
      }
    }
    const formattedTime = `${String(tempHours).padStart(2, '0')}:${String(tempMinutes).padStart(2, '0')}`;
    setEditingWeeks(prev => {
      const updated = [...prev];
      updated[currentWeekIndex].hourLabels[hourEditIndex] = formattedTime;
      return updated;
    });
    setHourEditIndex(null);
  };

  const getTasksForCell = (weekIdx: number, rowIdx: number, colIdx: number) => {
    const currentWeek = editingWeeks[weekIdx];
    if (!currentWeek) return [];
    const weekStart = new Date(currentWeek.fullStartDate);
    const cellDate = new Date(weekStart);
    cellDate.setDate(weekStart.getDate() + colIdx);
    const dateStr = cellDate.toLocaleDateString('pt-BR'); 
    const todayStr = new Date().toLocaleDateString('pt-BR');
    const timeToMinutes = (t: string) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + (m || 0);
    };
    return tasks.filter(task => {
      const taskDate = task.timeframe === 'today' ? todayStr : (task.date || '');
      if (taskDate !== dateStr) return false;
      if (!task.time) return rowIdx === 0;
      const validTableHours = currentWeek.hourLabels.map((label, idx) => ({ label, idx })).filter(x => x.label !== '--:--');
      if (validTableHours.length === 0) return rowIdx === 0;
      const taskTotalMinutes = timeToMinutes(task.time);
      let closestRowIdx = validTableHours[0].idx;
      let minDiff = Math.abs(taskTotalMinutes - timeToMinutes(validTableHours[0].label));
      for (let i = 1; i < validTableHours.length; i++) {
        const diff = Math.abs(taskTotalMinutes - timeToMinutes(validTableHours[i].label));
        if (diff < minDiff) { minDiff = diff; closestRowIdx = validTableHours[i].idx; }
      }
      return rowIdx === closestRowIdx;
    });
  };

  // --- RENDERIZADORES DE MODAIS ---

  const renderDeleteConfirmModal = () => {
    if (!routineToDelete) return null;
    return (
      <div className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-10 rounded-[3rem] shadow-2xl border-2 border-black max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </div>
          <h3 className="text-2xl font-black text-slate-800 mb-2">Excluir Rotina?</h3>
          <p className="text-slate-500 font-medium mb-8 text-sm">Tem certeza que deseja apagar a rotina "<span className="font-bold">{routineToDelete.name}</span>"? Esta ação não pode ser desfeita.</p>
          <div className="flex gap-4">
            <button onClick={() => setRoutineToDelete(null)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-2xl hover:bg-slate-200 transition-all">Não</button>
            <button 
              onClick={() => { saveToLocal(routines.filter(x => x.id !== routineToDelete.id)); setRoutineToDelete(null); }} 
              className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-xl shadow-red-600/20 active:scale-95 transition-all"
            >
              Sim, Excluir
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDayDetailModal = () => {
    if (dayDetailIndex === null) return null;
    const dayName = weekDays[dayDetailIndex];
    const currentWeek = editingWeeks[currentWeekIndex];
    
    return (
      <div className="fixed inset-0 z-[2500] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-8 rounded-[3.5rem] shadow-2xl border-2 border-black max-w-lg w-full flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white font-black text-xl">
                {dayName[0]}
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{dayName} - Detalhes</h3>
            </div>
            <button 
              onClick={() => setDayDetailIndex(null)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors"
            >
              <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
            {currentWeek.hourLabels.map((label, r) => {
              const cellTasks = getTasksForCell(currentWeekIndex, r, dayDetailIndex);
              const cellHtml = currentWeek.cells[r][dayDetailIndex];
              const hasContent = cellHtml.trim() !== '' || cellTasks.length > 0;

              return (
                <div key={r} className={`p-6 rounded-[2rem] border-2 transition-all ${hasContent ? 'border-black bg-slate-50' : 'border-slate-100 opacity-40'}`}>
                  <div className="flex items-center justify-between mb-4">
                     <span className="text-xs font-black text-black/40 uppercase tracking-widest">Horário: {label}</span>
                  </div>
                  
                  {cellHtml && (
                    <div 
                      className="text-slate-800 text-lg leading-relaxed mb-4 prose-sm"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(cellHtml) }}
                    />
                  )}

                  {cellTasks.length > 0 && (
                    <div className="flex flex-col gap-2">
                       {cellTasks.map(t => (
                         <div key={t.id} style={{ backgroundColor: t.categoryColor }} className="px-4 py-3 rounded-2xl text-white font-black text-xs shadow-sm flex items-center gap-3">
                            <div className="w-4 h-4 border-2 border-white/30 rounded flex items-center justify-center shrink-0">
                               {t.completed && <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                            </div>
                            <span className={t.completed ? 'line-through opacity-50' : ''}>{t.text}</span>
                         </div>
                       ))}
                    </div>
                  )}

                  {!hasContent && <span className="text-xs font-bold text-slate-300 italic">Vazio</span>}
                </div>
              );
            })}
          </div>
          
          <button 
            onClick={() => setDayDetailIndex(null)}
            className="mt-8 w-full py-4 bg-black text-white font-black rounded-2xl shadow-xl active:scale-95 transition-all"
          >
            Fechar Visualização
          </button>
        </div>
      </div>
    );
  };

  const renderTimePickerModal = () => {
    if (hourEditIndex === null) return null;
    return (
      <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
        <div className="bg-white p-10 rounded-[3.5rem] shadow-2xl border-2 border-black flex flex-col items-center max-w-sm w-full">
          {timeError && (
            <div className="mb-6 bg-red-50 text-red-600 p-4 rounded-2xl border-2 border-red-200 text-xs font-black text-center animate-bounce">
              {timeError}
            </div>
          )}
          <div className="flex gap-10 items-center mb-10">
            <div className="flex flex-col items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">HORAS</span>
              <div className="border-2 border-black rounded-[2rem] p-4 flex flex-col items-center w-24 bg-slate-50">
                <button onClick={() => { setTempHours(h => (h + 1) % 24); setTimeError(null); }} className="text-3xl font-black text-slate-300 hover:text-black hover:scale-125 transition-all active:scale-95">+</button>
                <div className="text-4xl font-black text-slate-800 my-2">{String(tempHours).padStart(2, '0')}</div>
                <button onClick={() => { setTempHours(h => (h - 1 + 24) % 24); setTimeError(null); }} className="text-3xl font-black text-slate-300 hover:text-black hover:scale-125 transition-all active:scale-95">-</button>
              </div>
            </div>
            <div className="text-5xl font-black text-black pt-10">:</div>
            <div className="flex flex-col items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">MINUTOS</span>
              <div className="border-2 border-black rounded-[2rem] p-4 flex flex-col items-center w-24 bg-slate-50">
                <button onClick={() => { setTempMinutes(m => (m + 1) % 60); setTimeError(null); }} className="text-3xl font-black text-slate-300 hover:text-black hover:scale-125 transition-all active:scale-95">+</button>
                <div className="text-4xl font-black text-slate-800 my-2">{String(tempMinutes).padStart(2, '0')}</div>
                <button onClick={() => { setTempMinutes(m => (m - 1 + 60) % 60); setTimeError(null); }} className="text-3xl font-black text-slate-300 hover:text-black hover:scale-125 transition-all active:scale-95">-</button>
              </div>
            </div>
          </div>
          <div className="flex gap-4 w-full">
            <button onClick={() => setHourEditIndex(null)} className="flex-1 py-4 border-2 border-slate-100 rounded-2xl font-black text-slate-400 hover:bg-slate-50 transition-all">Cancelar</button>
            <button onClick={saveSelectedTime} className="flex-1 py-4 bg-black text-white rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all">Confirmar</button>
          </div>
        </div>
      </div>
    );
  };

  const renderEditorToolbar = () => {
    if (view === 'viewer') {
      return (
        <div className="bg-slate-50 border-b-2 border-black p-3 sm:p-4 flex flex-wrap justify-between items-center sticky top-0 z-[1100] shadow-sm gap-3">
           <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-black rounded-xl flex items-center justify-center">
                 <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
              </div>
              <h2 className="font-black text-base sm:text-xl text-slate-800 tracking-tighter uppercase">Modo de Visualização</h2>
           </div>
           <div className="flex gap-2 sm:gap-4">
              <button onClick={() => setView('editor')} className="bg-black text-white px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all flex items-center gap-2 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                Editar
              </button>
              <button onClick={() => setView('list')} className="bg-white border-2 border-slate-200 text-slate-500 px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black hover:bg-slate-50 transition-all text-sm">Fechar</button>
           </div>
        </div>
      );
    }
    return (
      <div className="bg-slate-50 border-b-2 border-black p-3 sm:p-4 flex flex-wrap gap-2 sm:gap-4 items-center sticky top-0 z-[1100] shadow-sm">
        <div className="relative" ref={fontMenuRef}>
          <button onMouseDown={(e) => { e.preventDefault(); setIsFontMenuOpen(!isFontMenuOpen); setIsFontSizeMenuOpen(false); setIsMarkersMenuOpen(false); }} className="bg-white border-2 border-black rounded-xl px-4 py-2 min-w-[140px] flex justify-between items-center font-bold text-xs text-black shadow-sm">
            {activeFont} <span>▼</span>
          </button>
          {isFontMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-48 bg-white border-2 border-black rounded-xl shadow-xl z-50 overflow-hidden">
              {fonts.map(f => (
                <button key={f.name} onMouseDown={(e) => { e.preventDefault(); execCommand('fontName', f.value); setIsFontMenuOpen(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-black" style={{ fontFamily: f.value }}>{f.name}</button>
              ))}
            </div>
          )}
        </div>
        <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className={`w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg transition-all shadow-sm ${activeBold ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'}`}>B</button>
        <div className="flex bg-white border-2 border-black rounded-xl overflow-hidden p-0.5 shadow-sm">
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyLeft'); }} className={`p-2 rounded-lg transition-colors ${activeAlign === 'justifyLeft' ? 'bg-black text-white' : 'hover:bg-slate-100 text-black'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h10M4 18h16" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyCenter'); }} className={`p-2 rounded-lg transition-colors ${activeAlign === 'justifyCenter' ? 'bg-black text-white' : 'hover:bg-slate-100 text-black'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M7 12h10M4 18h16" /></svg>
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyRight'); }} className={`p-2 rounded-lg transition-colors ${activeAlign === 'justifyRight' ? 'bg-black text-white' : 'hover:bg-slate-100 text-black'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M10 12h10M4 18h16" /></svg>
          </button>
        </div>
        <div className="relative" ref={markersMenuRef}>
          <button onMouseDown={(e) => { e.preventDefault(); setIsMarkersMenuOpen(!isMarkersMenuOpen); setIsFontMenuOpen(false); setIsFontSizeMenuOpen(false); }} className={`px-4 py-2 border-2 border-black rounded-xl flex items-center gap-2 font-black text-xs transition-all shadow-sm ${isMarkersMenuOpen ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
            Marcadores
          </button>
          {isMarkersMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-32 bg-white border-2 border-black rounded-xl shadow-xl z-50 overflow-hidden">
              {markers.map(m => (
                <button key={m.name} onMouseDown={(e) => { e.preventDefault(); insertMarker(m.char); }} className="w-full text-left px-4 py-3 text-lg hover:bg-slate-50 transition-colors text-black flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">{m.name}</span>
                  <span className="font-bold">{m.char}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (
            <button key={c} onMouseDown={(e) => { e.preventDefault(); execCommand('foreColor', c); }} className={`w-6 h-6 rounded-full border 2 transition-all hover:scale-125 shadow-sm ${activeColor === c || activeColor.toLowerCase().includes(c.toLowerCase()) ? 'border-black scale-125' : 'border-black/10'}`} style={{ backgroundColor: c }} />
          ))}
        </div>
        <div className="relative" ref={fontSizeMenuRef}>
          <button onMouseDown={(e) => { e.preventDefault(); setIsFontSizeMenuOpen(!isFontSizeMenuOpen); setIsFontMenuOpen(false); setIsMarkersMenuOpen(false); }} className="bg-white border-2 border-black rounded-xl px-4 py-2 min-w-[140px] flex justify-between items-center font-bold text-xs text-black shadow-sm">
            {fontSizes.find(s => s.value === activeSize)?.name || 'Tamanho'} <span>▼</span>
          </button>
          {isFontSizeMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-40 bg-white border-2 border-black rounded-xl shadow-xl z-50 overflow-hidden">
              {fontSizes.map(s => (
                <button key={s.value} onMouseDown={(e) => { e.preventDefault(); execCommand('fontSize', s.value); setIsFontSizeMenuOpen(false); }} className={`w-full text-left px-4 py-2 text-xs transition-all border-2 border-transparent hover:border-black rounded-lg ${activeSize === s.value ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}>{s.name}</button>
              ))}
            </div>
          )}
        </div>
        <div className="ml-auto flex gap-4">
          <button onClick={() => {
            const routine: SavedRoutine = {
              id: activeRoutineId || Date.now().toString(),
              name: `Rotina ${selectedDuration?.label || 'Customizada'}`,
              durationLabel: selectedDuration?.label || '',
              startDate: editingWeeks[0].startDate,
              endDate: editingWeeks[editingWeeks.length - 1].endDate,
              fullStartDate: editingWeeks[0].fullStartDate,
              weeks: editingWeeks,
              createdAt: new Date().toLocaleString()
            };
            if (activeRoutineId) saveToLocal(routines.map(r => r.id === activeRoutineId ? routine : r));
            else saveToLocal([routine, ...routines]);
            setView('menu');
          }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition-all">{activeRoutineId ? 'Atualizar' : 'Salvar'}</button>
          <button onClick={() => setView('menu')} className="bg-white border-2 border-slate-200 text-slate-500 px-8 py-3 rounded-2xl font-black hover:bg-slate-50 transition-all shadow-sm">Cancelar</button>
        </div>
      </div>
    );
  };

  const renderEditor = (isViewer: boolean = false) => {
    const currentWeek = editingWeeks[currentWeekIndex];
    if (!currentWeek) return null;
    const totalWeeks = editingWeeks.length;
    
    return (
      <div className="fixed inset-0 z-[1000] bg-white overflow-y-auto flex flex-col animate-fadeIn">
        <style>{`
          .slide-left { animation: slideLeft 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          .slide-right { animation: slideRight 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
          @keyframes slideLeft { 0% { transform: translateX(0); opacity: 1; filter: blur(0); } 45% { transform: translateX(-15px); opacity: 0; filter: blur(1px); } 55% { transform: translateX(15px); opacity: 0; filter: blur(1px); } 100% { transform: translateX(0); opacity: 1; filter: blur(0); } }
          @keyframes slideRight { 0% { transform: translateX(0); opacity: 1; filter: blur(0); } 45% { transform: translateX(15px); opacity: 0; filter: blur(1px); } 55% { transform: translateX(-15px); opacity: 0; filter: blur(1px); } 100% { transform: translateX(0); opacity: 1; filter: blur(0); } }
        `}</style>
        {renderEditorToolbar()}
        {renderTimePickerModal()}
        {renderDayDetailModal()}
        <div className="p-4 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 max-w-full mx-auto w-full">
          <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
            <button onClick={() => changeWeek(Math.max(0, currentWeekIndex - 1))} disabled={currentWeekIndex === 0} className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black rounded-full flex items-center justify-center font-black disabled:opacity-20 hover:bg-slate-50 transition-all text-black shadow-sm shrink-0">-</button>
            <div className="bg-black text-white px-4 sm:px-8 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-black text-sm sm:text-xl shadow-lg">Semana {currentWeekIndex + 1}: {currentWeek.startDate} - {currentWeek.endDate}</div>
            <button onClick={() => changeWeek(Math.min(totalWeeks - 1, currentWeekIndex + 1))} disabled={currentWeekIndex === totalWeeks - 1} className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-black rounded-full flex items-center justify-center font-black disabled:opacity-20 hover:bg-slate-50 transition-all text-black shadow-sm shrink-0">+</button>
          </div>
          <div className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Período: {editingWeeks[0].startDate} a {editingWeeks[totalWeeks-1].endDate}</div>
        </div>
        <div className={`flex-1 px-2 sm:px-8 pb-12 overflow-x-auto ${transitionAnim}`}>
          <div className="bg-white border-2 border-black rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden min-w-[50rem] shadow-2xl">
            <div className="grid grid-cols-8 bg-slate-50 border-b-2 border-black">
              <div className="p-6 border-r-2 border-black font-black text-[10px] uppercase tracking-widest text-center text-slate-400">Hora</div>
              {weekDays.map((day, idx) => (
                <div 
                  key={day} 
                  onClick={() => setDayDetailIndex(idx)}
                  className="p-6 border-r-2 last:border-r-0 border-black font-black text-slate-800 text-sm text-center cursor-pointer hover:bg-slate-200 transition-colors group/day"
                >
                  {day}
                  <div className="text-[8px] opacity-0 group-hover/day:opacity-40 uppercase tracking-tighter">Ver detalhes</div>
                </div>
              ))}
            </div>
            <div className="divide-y-2 divide-black">
              {currentWeek.hourLabels.map((label, r) => (
                <div key={r} className="grid grid-cols-8 relative group">
                  <div onClick={() => openHourPicker(r)} className={`p-6 border-r-2 border-black bg-slate-50/50 flex flex-col items-center justify-center font-black text-slate-600 transition-all group/hour relative ${isViewer ? 'cursor-default' : 'cursor-pointer hover:bg-white'}`}>
                    <span className="text-sm tracking-tighter">{label}</span>
                    {!isViewer && (
                      <div className="absolute right-2 top-2 opacity-0 group-hover/hour:opacity-100 transition-opacity">
                        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </div>
                    )}
                  </div>
                  {currentWeek.cells[r].map((cell, c) => (
                    <EditableCell key={`cell-${currentWeekIndex}-${r}-${c}`} initialHtml={cell} rowIndex={r} colIndex={c} onUpdate={handleCellUpdate} onFocus={handleFocus} updateToolbar={updateToolbarState} className="min-h-[140px] p-6 border-r-2 last:border-r-0 border-black text-base leading-relaxed break-words whitespace-pre-wrap text-black" tasks={getTasksForCell(currentWeekIndex, r, c)} readOnly={isViewer} />
                  ))}
                  {!isViewer && (
                    <button onClick={() => deleteRow(r)} className="absolute -right-14 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-3 text-red-500 hover:scale-125 transition-all" title="Excluir Linha">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          {!isViewer && (
            <div className="mt-8 flex gap-6 w-full">
              <button onClick={addRow} className="flex-1 py-8 border-4 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center gap-4 text-slate-300 font-black text-xl hover:border-black hover:text-black transition-all group shadow-sm hover:shadow-lg"><span className="text-4xl transition-transform group-hover:rotate-90 group-hover:scale-110">+</span> Adicionar Linha</button>
              <button onClick={() => deleteRow(currentWeek.hourLabels.length - 1)} className="flex-1 py-8 border-4 border-dashed border-red-100 rounded-[2.5rem] flex items-center justify-center gap-4 text-red-200 font-black text-xl hover:border-red-500 hover:text-red-500 transition-all group shadow-sm hover:shadow-lg"><span className="text-4xl transition-transform group-hover:scale-110">−</span> Excluir Linha</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderMenu = () => (
    <div className="flex flex-col items-center justify-center pt-10 animate-fadeIn text-center">
      <h2 className={`text-4xl font-black ${textColor} mb-2`}>Rotina</h2>
      <p className="text-slate-500 font-medium mb-12">Gerencie sua rotina diária e atividades recorrentes.</p>
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-2xl px-4">
        <button onClick={() => setView('list')} className="flex-1 p-10 bg-white border-2 border-[#4A69A2]/30 rounded-[2rem] shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center gap-4 group hover:bg-[#7EB1FF] hover:border-transparent">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white/20 transition-colors"><svg className="w-8 h-8 text-slate-800 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
          <span className="text-xl font-bold text-slate-800 group-hover:text-white transition-colors">Ver minhas rotinas</span>
        </button>
        <button onClick={() => setView('selectDuration')} className="flex-1 p-10 bg-white border-2 border-[#4A69A2]/30 rounded-[2rem] shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center gap-4 group hover:bg-[#7EB1FF] hover:border-transparent">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white/20 transition-colors"><svg className="w-8 h-8 text-slate-800 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg></div>
          <span className="text-xl font-bold text-slate-800 group-hover:text-white transition-colors">Fazer uma rotina</span>
        </button>
      </div>
    </div>
  );

  const renderDurationSelection = () => (
    <div className="animate-fadeIn">
      <button onClick={() => setView('menu')} className="mb-8 flex items-center gap-2 text-slate-400 font-bold hover:text-black transition-colors">← Voltar</button>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {durationOptions.map((opt) => (
          <button key={opt.label} onClick={() => { setSelectedDuration(opt); setView('selectStartDate'); }} className="p-10 bg-white border-2 border-[#4A69A2]/30 rounded-[2rem] shadow-lg hover:scale-105 transition-all duration-300 font-black text-slate-800 text-xl hover:bg-[#7EB1FF] hover:text-white hover:border-transparent">{opt.label}</button>
        ))}
      </div>
    </div>
  );

  const renderStartDateSelection = () => (
    <div className="animate-fadeIn max-w-2xl mx-auto text-center">
      <button onClick={() => setView('selectDuration')} className="mb-8 flex items-center gap-2 text-slate-400 font-bold hover:text-black transition-colors text-left">← Voltar</button>
      <h2 className="text-3xl font-black text-slate-800 mb-6">Escolha a data de início</h2>
      <div className="bg-white border-2 border-[#4A69A2]/30 rounded-[2.5rem] p-6 max-h-[500px] overflow-y-auto space-y-3 custom-scrollbar text-black">
        {generateStartWeeks().map((w, idx) => (
          <button key={idx} onClick={() => startEditor(w.monday)} className="w-full p-5 border-2 border-[#4A69A2]/20 rounded-2xl flex items-center justify-between hover:bg-[#7EB1FF] hover:border-transparent transition-all duration-300 group">
            <span className="font-black text-slate-800 group-hover:text-white transition-colors">{w.monday.toLocaleDateString('pt-BR')} até {w.endOfPeriod.toLocaleDateString('pt-BR')}</span>
            <span className="text-slate-300 group-hover:text-white transition-colors">→</span>
          </button>
        ))}
      </div>
    </div>
  );

  const sortedRoutines = useMemo(() => {
    return [...routines].sort((a, b) => {
      const dateA = new Date(a.fullStartDate || 0).getTime();
      const dateB = new Date(b.fullStartDate || 0).getTime();
      return dateA - dateB;
    });
  }, [routines]);

  const renderList = () => (
    <div className="animate-fadeIn relative">
      {renderDeleteConfirmModal()}
      <button onClick={() => setView('menu')} className="mb-8 flex items-center gap-2 text-slate-400 font-bold hover:text-black transition-colors">← Voltar</button>
      <h2 className="text-3xl font-black text-slate-800 mb-8">Minhas Rotinas</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sortedRoutines.length === 0 ? (
          <div className="col-span-full h-44 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center text-slate-400 font-bold shadow-sm">Nenhuma rotina salva ainda.</div>
        ) : (
          sortedRoutines.map(r => (
            <div key={r.id} onClick={() => { setEditingWeeks(r.weeks); setCurrentWeekIndex(0); setActiveRoutineId(r.id); setView('viewer'); }} className="bg-white border-2 border-black rounded-[2rem] p-8 shadow-md relative group hover:scale-[1.02] transition-transform cursor-pointer">
              <button 
                onClick={(e) => { 
                  e.stopPropagation();
                  setRoutineToDelete(r); 
                }} 
                className="absolute top-4 right-4 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-white rounded-full border border-transparent hover:border-red-100 shadow-sm"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <h3 className="text-xl font-black text-slate-800 mb-2 truncate pr-10">{r.name}</h3>
              <p className="text-slate-400 text-[10px] font-black uppercase mb-4 tracking-widest">{r.startDate} a {r.endDate}</p>
              <div className="flex items-center justify-between mt-auto">
                 <span className="text-blue-500 font-black text-[10px] uppercase tracking-widest group-hover:underline">Ver Tabela</span>
                 <div className="flex items-center gap-1"><span className="text-[10px] font-bold text-slate-300">Semana inicial</span><svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg></div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {view === 'menu' && renderMenu()}
      {view === 'selectDuration' && renderDurationSelection()}
      {view === 'selectStartDate' && renderStartDateSelection()}
      {(view === 'editor' || view === 'viewer') && renderEditor(view === 'viewer')}
      {view === 'list' && renderList()}
    </div>
  );
};

export default Routine;
