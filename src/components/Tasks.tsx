
import React, { useState, useEffect } from 'react';
import { Task } from '../types';

// Extendendo o tipo Task localmente para suportar as novas propriedades
interface ExtendedTask extends Task {
  priority?: 'Alta' | 'Média' | 'Baixa';
  time?: string;
  categoryColor?: string;
  timeframe?: 'today' | 'other';
  date?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
}

interface TasksProps {
  isDarkMode?: boolean;
}

const customColors = [
  '#ef4444', '#60a5fa', '#4ade80', '#facc15', '#c084fc',
  '#f472b6', '#fb923c', '#5eead4', '#93c5fd', '#94a3b8'
];

const recommendedCategories = [
  { name: 'Trabalho' },
  { name: 'Pessoal' },
  { name: 'Saúde' },
  { name: 'Estudos' },
  { name: 'Lazer' },
  { name: 'Finanças' },
];

const Tasks: React.FC<TasksProps> = ({ isDarkMode }) => {
  const [view, setView] = useState<'tasks' | 'categories_list' | 'create_category' | 'edit_category' | 'add_task_form'>('tasks');
  const [timeframe, setTimeframe] = useState<'today' | 'other'>('today');
  const [creationTab, setCreationTab] = useState<'recommended' | 'custom'>('recommended');
  const [sortBy, setSortBy] = useState<string>('Prioridade');

  const [tasks, setTasks] = useState<ExtendedTask[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [newTaskText, setNewTaskText] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [customName, setCustomName] = useState('');
  const [selectedRecommended, setSelectedRecommended] = useState<string | null>('Trabalho');
  const [selectedColor, setSelectedColor] = useState(customColors[0]);

  // States para o formulário de tarefa
  const [taskPriority, setTaskPriority] = useState<'Alta' | 'Média' | 'Baixa'>('Alta');
  const [useSpecificTime, setUseSpecificTime] = useState(false);
  const [taskHours, setTaskHours] = useState(12);
  const [taskMinutes, setTaskMinutes] = useState(0);

  // States para o Dia da Tarefa (Outro Dia)
  const initialDate = new Date();
  const [taskDay, setTaskDay] = useState(initialDate.getDate());
  const [taskMonth, setTaskMonth] = useState(initialDate.getMonth() + 1);
  const [taskYear, setTaskYear] = useState(initialDate.getFullYear());

  // Modal de categoria logic
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryStep, setCategoryStep] = useState<'initial' | 'none_selected' | 'picking' | 'item_selected'>('initial');
  const [tempSelectedCategory, setTempSelectedCategory] = useState<Category | null>(null);

  // States for Edit and Delete
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // States para CRUD de tarefas
  const [taskToDelete, setTaskToDelete] = useState<ExtendedTask | null>(null);
  const [editingTask, setEditingTask] = useState<ExtendedTask | null>(null);

  useEffect(() => {
    const savedTasks = localStorage.getItem('produtivity_tasks_v3');
    if (savedTasks) setTasks(JSON.parse(savedTasks));

    const savedCats = localStorage.getItem('produtivity_categories');
    if (savedCats) setCategories(JSON.parse(savedCats));
  }, []);

  const saveTasks = (newTasks: ExtendedTask[]) => {
    setTasks(newTasks);
    localStorage.setItem('produtivity_tasks_v3', JSON.stringify(newTasks));
  };

  const saveCategories = (newCats: Category[]) => {
    setCategories(newCats);
    localStorage.setItem('produtivity_categories', JSON.stringify(newCats));
  };

  const handleCreateTask = () => {
    if (!newTaskText.trim()) {
      showError("Por favor, preencha o que você precisa fazer primeiro.");
      return;
    }

    const taskData: ExtendedTask = {
      id: editingTask ? editingTask.id : Date.now().toString(),
      text: newTaskText,
      completed: editingTask ? editingTask.completed : false,
      category: tempSelectedCategory ? tempSelectedCategory.name : '',
      priority: taskPriority,
      time: useSpecificTime ? `${String(taskHours).padStart(2, '0')}:${String(taskMinutes).padStart(2, '0')}` : undefined,
      categoryColor: tempSelectedCategory?.color,
      timeframe: timeframe,
      date: timeframe === 'other' ? `${String(taskDay).padStart(2, '0')}/${String(taskMonth).padStart(2, '0')}/${taskYear}` : undefined
    };

    if (editingTask) {
      saveTasks(tasks.map(t => t.id === editingTask.id ? taskData : t));
    } else {
      saveTasks([...tasks, taskData]);
    }

    resetTaskForm();
    setView('tasks');
  };

  const showError = (msg: string) => {
    setFormError(msg);
    setTimeout(() => setFormError(null), 3000);
  };

  const resetTaskForm = () => {
    setNewTaskText('');
    setFormError(null);
    setShowCategoryModal(false);
    setCategoryStep('initial');
    setTempSelectedCategory(null);
    setEditingTask(null);
    setTaskPriority('Alta');
    setUseSpecificTime(false);
    setTaskHours(12);
    setTaskMinutes(0);
    const d = new Date();
    setTaskDay(d.getDate());
    setTaskMonth(d.getMonth() + 1);
    setTaskYear(d.getFullYear());
  };

  const handleEditTask = (task: ExtendedTask) => {
    // Bloqueia edição de tarefas concluídas
    if (task.completed) return;

    setEditingTask(task);
    setNewTaskText(task.text);
    setTaskPriority(task.priority || 'Alta');
    if (task.time) {
      const [h, m] = task.time.split(':').map(Number);
      setTaskHours(h);
      setTaskMinutes(m);
      setUseSpecificTime(true);
    } else {
      setUseSpecificTime(false);
    }

    if (task.date) {
      const [d, m, y] = task.date.split('/').map(Number);
      setTaskDay(d);
      setTaskMonth(m);
      setTaskYear(y);
    }

    // Mantém a categoria atual ao editar
    const existingCat = categories.find(c => c.name === task.category);
    if (existingCat) {
      setTempSelectedCategory(existingCat);
    } else {
      setTempSelectedCategory(null);
    }
    setView('add_task_form');
  };

  const confirmDeleteTask = () => {
    if (!taskToDelete) return;
    saveTasks(tasks.filter(t => t.id !== taskToDelete.id));
    setTaskToDelete(null);
  };

  const toggleTask = (id: string) => {
    const task = tasks.find(t => t.id === id);
    // Se a tarefa já está concluída, não permite desmarcar nem alterar nada além de deletar
    if (task?.completed) return;

    saveTasks(tasks.map(t => t.id === id ? { ...t, completed: true } : t));
  };

  const handleEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCustomName(cat.name);
    setSelectedColor(cat.color);
    setView('edit_category');
  };

  const saveEditedCategory = () => {
    if (!editingCategory || !customName.trim()) return;
    const updatedCats = categories.map(c =>
      c.id === editingCategory.id ? { ...c, name: customName, color: selectedColor } : c
    );
    saveCategories(updatedCats);
    setEditingCategory(null);
    setCustomName('');
    setView('categories_list');
  };

  const confirmDeleteCategory = () => {
    if (!categoryToDelete) return;
    saveCategories(categories.filter(c => c.id !== categoryToDelete.id));
    setCategoryToDelete(null);
  };

  const daysInMonth = (month: number, year: number) => new Date(year, month, 0).getDate();

  const handleDayChange = (inc: number) => {
    const maxDays = daysInMonth(taskMonth, taskYear);
    setTaskDay(prev => {
      let next = prev + inc;
      if (next > maxDays) return 1;
      if (next < 1) return maxDays;
      return next;
    });
  };

  const handleMonthChange = (inc: number) => {
    setTaskMonth(prev => {
      let next = prev + inc;
      if (next > 12) return 1;
      if (next < 1) return 12;
      return next;
    });
  };

  const handleYearChange = (inc: number) => {
    setTaskYear(prev => prev + inc);
  };

  const priorityColors = {
    'Alta': 'bg-red-500',
    'Média': 'bg-green-500',
    'Baixa': 'bg-yellow-400'
  };

  // Cores de fundo para tarefas concluídas (tons pastéis ligeiramente mais saturados que antes)
  const completedPriorityColors = {
    'Alta': 'bg-red-200',
    'Média': 'bg-green-200',
    'Baixa': 'bg-yellow-200'
  };

  // Lógica de filtragem e ordenação refinada
  const getSortedTasks = () => {
    const filtered = tasks.filter(t => (t.timeframe || 'today') === timeframe);

    return [...filtered].sort((a, b) => {
      if (sortBy === 'Prioridade') {
        const weight = { 'Alta': 3, 'Média': 2, 'Baixa': 1 };
        return (weight[b.priority || 'Baixa'] || 0) - (weight[a.priority || 'Baixa'] || 0);
      }
      if (sortBy === 'Horário') {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1; // Sem horário vai por último
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      }
      if (sortBy === 'Nome') {
        return (a.text || '').localeCompare(b.text || '');
      }
      if (sortBy === 'Categoria') {
        const catA = a.category || '';
        const catB = b.category || '';

        // Com categoria vem primeiro
        if (catA && !catB) return -1;
        if (!catA && catB) return 1;
        if (!catA && !catB) return 0;

        // Se ambos tem, ordem alfabética da categoria
        return catA.localeCompare(catB);
      }
      if (sortBy === 'Data' && timeframe === 'other') {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;

        const parseDate = (d: string) => {
          const [day, month, year] = d.split('/').map(Number);
          return new Date(year, month - 1, day).getTime();
        };
        return parseDate(a.date) - parseDate(b.date);
      }
      return 0;
    });
  };

  const filteredTasks = getSortedTasks();

  return (
    <div className="animate-fadeIn">
      {/* Estilos locais para animação de troca de posição otimizada */}
      <style>{`
        @keyframes cardReorder {
          0% { 
            opacity: 0; 
            transform: translateY(20px) scale(0.95); 
          }
          100% { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        .task-card-anim {
          animation: cardReorder 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
      `}</style>

      {/* Aviso de erro flutuante */}
      {formError && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[600] bg-red-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl animate-bounce text-center border-2 border-white">
          {formError}
        </div>
      )}

      {/* Modal Escolha a Categoria */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-[500] bg-black/30 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-2 border-black">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Escolha a Categoria</h3>
            <p className="text-slate-500 font-medium mb-8 text-sm">Selecione uma categoria para sua tarefa ou deixe sem categoria.</p>

            <div className="flex gap-4 mb-6">
              <button
                onClick={() => { setCategoryStep('none_selected'); setTempSelectedCategory(null); }}
                className={`flex-1 py-4 font-black rounded-2xl transition-all border-2 ${categoryStep === 'none_selected' ? 'bg-[#1E293B] border-[#1E293B] text-white' : 'bg-slate-100 border-transparent text-slate-400 hover:bg-slate-200'}`}
              >
                Nenhuma
              </button>
              <button
                onClick={() => { setCategoryStep('picking'); setTempSelectedCategory(null); }}
                className={`flex-1 py-4 font-black rounded-2xl transition-all border-2 ${categoryStep === 'picking' || categoryStep === 'item_selected' ? 'bg-[#1E293B] border-[#1E293B] text-white' : 'bg-slate-100 border-transparent text-slate-400 hover:bg-slate-200'}`}
              >
                Escolher
              </button>
            </div>

            {/* Area de listagem quando "Escolher" é clicado */}
            {(categoryStep === 'picking' || categoryStep === 'item_selected') && (
              <div className="space-y-4 mb-8 animate-fadeIn">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-left">Selecione uma categoria:</p>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {categories.length === 0 ? (
                    <div className="p-6 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-xs">
                      Você não criou nenhuma categoria
                    </div>
                  ) : (
                    categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => { setTempSelectedCategory(cat); setCategoryStep('item_selected'); }}
                        style={{ backgroundColor: cat.color }}
                        className={`w-full py-4 rounded-xl text-white font-black text-lg shadow-sm transition-all hover:brightness-95 active:scale-95 border-4 ${tempSelectedCategory?.id === cat.id ? 'border-black' : 'border-transparent'}`}
                      >
                        {cat.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Botões de Ação na base */}
            {(categoryStep === 'none_selected' || categoryStep === 'item_selected' || (categoryStep === 'picking' && categories.length === 0)) && (
              <div className="flex flex-col gap-3 pt-4 border-t border-slate-100 animate-fadeIn">
                <button
                  onClick={handleCreateTask}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 active:scale-95"
                >
                  Salvar
                </button>
                <button
                  onClick={() => { setShowCategoryModal(false); setCategoryStep('initial'); setTempSelectedCategory(null); }}
                  className="w-full py-4 text-slate-400 font-black rounded-2xl border-2 border-transparent hover:border-blue-600 hover:text-blue-600 transition-all text-sm"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Tarefa */}
      {taskToDelete && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center border-2 border-black">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Tarefa?</h3>
            <p className="text-slate-500 font-medium mb-8 text-sm">Tem certeza que deseja apagar a tarefa "<span className="font-bold">{taskToDelete.text}</span>"?</p>
            <div className="flex gap-4">
              <button onClick={() => setTaskToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={confirmDeleteTask} className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Categoria */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-[300] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center border-2 border-black">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Tem certeza?</h3>
            <p className="text-slate-500 font-medium mb-8 text-sm">A categoria "<span className="font-bold">{categoryToDelete.name}</span>" será excluída permanentemente.</p>
            <div className="flex gap-4">
              <button
                onClick={() => setCategoryToDelete(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteCategory}
                className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {view !== 'add_task_form' && (
        <>
          {/* Top Header Row */}
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="text-4xl font-black text-slate-800 tracking-tight">Tarefas</h2>
              <p className="text-slate-400 font-medium text-sm">Gerencie sua rotina diária com facilidade.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-between items-center mt-6 mb-10 gap-6">
            <div className="bg-white border-2 border-black p-0.5 rounded-2xl flex shadow-sm">
              <button
                onClick={() => { setTimeframe('today'); setView('tasks'); if (sortBy === 'Data') setSortBy('Prioridade'); }}
                className={`py-2 px-8 rounded-xl font-bold text-sm transition-all active:scale-95 ${timeframe === 'today' && view === 'tasks' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}
              >
                Para hoje
              </button>
              <button
                onClick={() => { setTimeframe('other'); setView('tasks'); }}
                className={`py-2 px-8 rounded-xl font-bold text-sm transition-all active:scale-95 ${timeframe === 'other' && view === 'tasks' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}
              >
                Para outro dia
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setView('categories_list')}
                className={`px-8 py-2.5 rounded-xl border-2 border-[#A855F7] font-bold text-sm transition-all shadow-sm active:scale-95 ${view === 'categories_list' ? 'bg-[#A855F7] text-white' : 'text-[#A855F7] bg-white'}`}
              >
                Minhas Categorias
              </button>
              <button
                onClick={() => {
                  setView('create_category');
                  setCreationTab('recommended');
                  setSelectedRecommended('Trabalho');
                  setSelectedColor(customColors[0]);
                }}
                className={`px-8 py-2.5 rounded-xl border-2 border-[#3B82F6] font-bold text-sm transition-all shadow-sm active:scale-95 ${view === 'create_category' ? 'bg-[#3B82F6] text-white' : 'text-[#3B82F6] bg-white'}`}
              >
                Criar Categoria
              </button>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-[2rem] border-[1.5px] border-[#4A69A2] p-8 shadow-sm min-h-[400px] flex flex-col overflow-hidden">
        {view === 'tasks' && (
          <div key={`${timeframe}-${sortBy}`} className="animate-fadeIn flex-1 flex flex-col">
            <div className="flex justify-between items-center mb-10">
              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
                {timeframe === 'today' ? 'Tarefas para Hoje' : 'Tarefas para Outro Dia'}
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Ordenar por</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border-2 border-black rounded-xl px-3 py-1 text-xs font-bold outline-none cursor-pointer"
                >
                  <option value="Prioridade">Prioridade</option>
                  <option value="Horário">Horário</option>
                  <option value="Nome">Ordem Alfabética</option>
                  <option value="Categoria">Categoria</option>
                  {timeframe === 'other' && <option value="Data">Data</option>}
                </select>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center border-b border-slate-100 pb-10">
              {filteredTasks.length === 0 ? (
                <div className="w-full h-44 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center">
                  <p className="text-slate-400 font-bold text-center px-10 text-sm">
                    Nenhuma tarefa cadastrada nesta seção.
                  </p>
                </div>
              ) : (
                <div className="w-full space-y-8">
                  {filteredTasks.map((task, index) => {
                    const currentPriority = task.priority || 'Baixa';
                    const activeBg = priorityColors[currentPriority];
                    const completedBg = completedPriorityColors[currentPriority];
                    const finalBg = task.completed ? completedBg : (activeBg || 'bg-white');

                    return (
                      <div
                        key={task.id}
                        className="group relative task-card-anim"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {/* Label da Categoria ACIMA do cartão */}
                        <div className="mb-2 px-2 flex justify-between items-center">
                          <span
                            className="text-xs font-black uppercase tracking-widest"
                            style={{ color: task.categoryColor || '#94a3b8' }}
                          >
                            {task.category || 'sem categoria'}
                          </span>
                          {task.date && (
                            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">
                                {task.date}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Cartão da Tarefa */}
                        <div
                          onClick={() => toggleTask(task.id)}
                          className={`p-6 rounded-[1.5rem] border-2 transition-all duration-300 flex flex-col relative ${task.completed ? 'grayscale-[0.2] shadow-none border-slate-300 cursor-default' : 'shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer border-black'} ${finalBg}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-black border-black text-white' : 'bg-white/10 border-white/30'}`}>
                                {task.completed && <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                              </div>
                              <div>
                                <span className={`font-black text-xl ${task.completed ? 'line-through text-slate-500/70' : 'text-white'}`}>{task.text}</span>
                                {task.time && (
                                  <div className={`flex items-center gap-1 text-[10px] font-black uppercase mt-0.5 ${task.completed ? 'text-slate-500/50' : 'text-white/70'}`}>
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {task.time}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                              {!task.completed && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                  className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-all"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              )}
                              <button
                                onClick={(e) => { e.stopPropagation(); setTaskToDelete(task); }}
                                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${task.completed ? 'bg-red-500 text-white shadow-lg' : 'bg-white/20 text-white hover:bg-white/30'}`}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={() => { resetTaskForm(); setView('add_task_form'); }}
                className="w-full py-5 border-2 border-black rounded-2xl flex items-center justify-center gap-3 font-black text-slate-800 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
              >
                <div className="w-6 h-6 border-2 border-black rounded-full flex items-center justify-center">
                  <span className="text-sm">+</span>
                </div>
                Adicionar Tarefa
              </button>
            </div>
          </div>
        )}

        {view === 'add_task_form' && (
          <div className="animate-fadeIn">
            <header className="flex justify-between items-center mb-10">
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">{editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
              <button onClick={() => setView('tasks')} className="text-slate-400 font-bold flex items-center gap-1 hover:text-slate-600">
                <span className="text-xs">‹</span> Voltar
              </button>
            </header>

            <div className="space-y-10">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">O QUE VOCÊ PRECISA FAZER?</label>
                <input
                  type="text"
                  autoFocus
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Ex: Estudar matemática"
                  className="w-full p-6 text-xl font-bold border-2 border-black rounded-[1.5rem] outline-none shadow-sm placeholder:text-slate-300 bg-white text-black"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">HORÁRIO DA TAREFA</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setUseSpecificTime(false)}
                    className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${!useSpecificTime ? 'bg-[#1E293B] border-[#1E293B] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
                  >
                    Qualquer horário do dia
                  </button>
                  <button
                    onClick={() => setUseSpecificTime(true)}
                    className={`flex-1 py-4 rounded-2xl font-black transition-all border-2 ${useSpecificTime ? 'bg-[#1E293B] border-[#1E293B] text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
                  >
                    Escolher horário
                  </button>
                </div>

                {useSpecificTime && (
                  <div className="mt-8 flex justify-center animate-fadeIn">
                    <div className="bg-slate-50 border-2 border-slate-100 p-8 rounded-[2rem] flex flex-col items-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-6 text-xs tracking-widest">SELECIONE O HORÁRIO:</p>
                      <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center gap-2">
                          <button onClick={() => setTaskHours(h => (h + 1) % 24)} className="w-10 h-10 border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-400 hover:bg-white transition-all active:scale-90 shadow-sm">+</button>
                          <div className="text-4xl font-black text-slate-800 p-2 bg-white border border-slate-200 rounded-xl w-20 text-center">{String(taskHours).padStart(2, '0')}</div>
                          <button onClick={() => setTaskHours(h => (h - 1 + 24) % 24)} className="w-10 h-10 border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-400 hover:bg-white transition-all active:scale-90 shadow-sm">-</button>
                          <span className="text-[8px] font-black text-slate-400 uppercase">HORAS</span>
                        </div>
                        <div className="text-4xl font-black text-slate-400">:</div>
                        <div className="flex flex-col items-center gap-2">
                          <button onClick={() => setTaskMinutes(m => (m + 1) % 60)} className="w-10 h-10 border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-400 hover:bg-white transition-all active:scale-90 shadow-sm">+</button>
                          <div className="text-4xl font-black text-slate-800 p-2 bg-white border border-slate-200 rounded-xl w-20 text-center">{String(taskMinutes).padStart(2, '0')}</div>
                          <button onClick={() => setTaskMinutes(m => (m - 1 + 60) % 60)} className="w-10 h-10 border border-slate-200 rounded-full flex items-center justify-center font-bold text-slate-400 hover:bg-white transition-all active:scale-90 shadow-sm">-</button>
                          <span className="text-[8px] font-black text-slate-400 uppercase">MINUTOS</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Seletor de DIA DA TAREFA para 'Para outro dia' */}
              {timeframe === 'other' && (
                <div className="animate-fadeIn">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">DIA DA TAREFA</label>
                  <div className="bg-white border-2 border-slate-100 p-8 rounded-[2rem] flex flex-col items-center shadow-sm">
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase">DIA</span>
                        <div className="border-2 border-black rounded-3xl p-2 flex flex-col items-center gap-1 w-20">
                          <button onClick={() => handleDayChange(1)} className="text-slate-400 hover:text-black font-black text-2xl active:scale-90 transition-all">+</button>
                          <div className="text-3xl font-black text-slate-800">{String(taskDay).padStart(2, '0')}</div>
                          <button onClick={() => handleDayChange(-1)} className="text-slate-400 hover:text-black font-black text-2xl active:scale-90 transition-all">-</button>
                        </div>
                      </div>

                      <div className="text-3xl font-black text-slate-400 mt-6">/</div>

                      <div className="flex flex-col items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase">MÊS</span>
                        <div className="border-2 border-black rounded-3xl p-2 flex flex-col items-center gap-1 w-20">
                          <button onClick={() => handleMonthChange(1)} className="text-slate-400 hover:text-black font-black text-2xl active:scale-90 transition-all">+</button>
                          <div className="text-3xl font-black text-slate-800">{String(taskMonth).padStart(2, '0')}</div>
                          <button onClick={() => handleMonthChange(-1)} className="text-slate-400 hover:text-black font-black text-2xl active:scale-90 transition-all">-</button>
                        </div>
                      </div>

                      <div className="text-3xl font-black text-slate-400 mt-6">/</div>

                      <div className="flex flex-col items-center gap-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase">ANO</span>
                        <div className="border-2 border-black rounded-3xl p-2 flex flex-col items-center gap-1 w-28">
                          <button onClick={() => handleYearChange(1)} className="text-slate-400 hover:text-black font-black text-2xl active:scale-90 transition-all">+</button>
                          <div className="text-3xl font-black text-slate-800">{taskYear}</div>
                          <button onClick={() => handleYearChange(-1)} className="text-slate-400 hover:text-black font-black text-2xl active:scale-90 transition-all">-</button>
                        </div>
                      </div>
                    </div>
                    <p className="mt-6 text-[10px] font-medium text-slate-300 italic">Clique em + e - para ajustar a data</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">GRAU DE PRIORIDADE</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setTaskPriority('Alta')}
                    className={`flex-1 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border-2 ${taskPriority === 'Alta' ? 'bg-red-500 border-red-500 text-white shadow-xl shadow-red-500/20' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${taskPriority === 'Alta' ? 'bg-white' : 'bg-slate-300'}`}></div> Alta
                  </button>
                  <button
                    onClick={() => setTaskPriority('Média')}
                    className={`flex-1 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border-2 ${taskPriority === 'Média' ? 'bg-green-500 border-green-500 text-white shadow-xl shadow-green-500/20' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${taskPriority === 'Média' ? 'bg-white' : 'bg-slate-300'}`}></div> Média
                  </button>
                  <button
                    onClick={() => setTaskPriority('Baixa')}
                    className={`flex-1 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border-2 ${taskPriority === 'Baixa' ? 'bg-yellow-400 border-yellow-400 text-white shadow-xl shadow-yellow-400/20' : 'bg-slate-50 border-slate-100 text-slate-300'}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${taskPriority === 'Baixa' ? 'bg-white' : 'bg-slate-300'}`}></div> Baixa
                  </button>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!newTaskText.trim()) {
                    showError("Por favor, preencha a descrição da tarefa primeiro.");
                    return;
                  }
                  if (editingTask) {
                    handleCreateTask();
                  } else {
                    setShowCategoryModal(true);
                    setCategoryStep('initial');
                  }
                }}
                className={`w-full py-6 mt-6 ${priorityColors[taskPriority]} text-white font-black text-xl rounded-[1.5rem] shadow-xl active:scale-[0.98] transition-all`}
              >
                + {editingTask ? 'Atualizar Tarefa' : (timeframe === 'today' ? 'Salvar Tarefa para Hoje' : 'Salvar Tarefa para Outro Dia')}
              </button>
            </div>
          </div>
        )}

        {view === 'categories_list' && (
          <div className="animate-fadeIn flex flex-col h-full">
            <div className="flex items-center gap-3 mb-10">
              <h3 className="text-xl font-black text-slate-800 tracking-tighter">Minhas Categorias</h3>
            </div>

            {categories.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="w-full h-44 border-2 border-dashed border-slate-200 rounded-[2rem] flex items-center justify-center">
                  <p className="text-slate-400 font-bold text-center px-10 text-sm">
                    Nenhuma categoria criada. Clique em "Criar Categoria" para começar!
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {categories.map(cat => (
                  <div key={cat.id} className="relative group">
                    <div
                      className="h-28 rounded-2xl flex items-center justify-center shadow-md transition-all group-hover:scale-[1.02] cursor-pointer"
                      style={{ backgroundColor: cat.color }}
                    >
                      <span className="text-white font-black text-xl tracking-tight">{cat.name}</span>
                    </div>
                    <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                      <button
                        onClick={() => handleEditCategory(cat)}
                        className="bg-white/90 text-blue-600 w-8 h-8 rounded-lg shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                      <button
                        onClick={() => setCategoryToDelete(cat)}
                        className="bg-white/90 text-red-500 w-8 h-8 rounded-lg shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="h-20 border-t border-slate-50 mt-10 opacity-0"></div>
          </div>
        )}

        {view === 'create_category' && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-3 mb-8">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Criar Categoria</h3>
            </div>

            <div className="bg-white border-2 border-black p-0.5 rounded-[1.5rem] flex shadow-sm w-fit mb-10">
              <button
                onClick={() => setCreationTab('recommended')}
                className={`py-3 px-8 rounded-[1.25rem] font-bold text-sm transition-all active:scale-95 ${creationTab === 'recommended' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}
              >
                Categorias Recomendadas
              </button>
              <button
                onClick={() => setCreationTab('custom')}
                className={`py-3 px-8 rounded-[1.25rem] font-bold text-sm transition-all active:scale-95 ${creationTab === 'custom' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}
              >
                Criar Minha Própria
              </button>
            </div>

            {creationTab === 'recommended' ? (
              <div className="space-y-8">
                <div>
                  <p className="text-slate-500 font-medium mb-8 text-sm">Selecione uma categoria recomendada:</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recommendedCategories.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedRecommended(cat.name)}
                        className={`py-5 px-6 rounded-xl font-bold text-lg shadow-md transition-all active:scale-95 border-2 ${selectedRecommended === cat.name
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-black border-transparent hover:border-black'
                          }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedRecommended && (
                  <div className="animate-fadeIn space-y-8 pt-6 border-t border-slate-100">
                    <div className="bg-white border-[1.5px] border-slate-200 rounded-2xl p-6 shadow-sm">
                      <p className="font-bold text-slate-700 text-sm">Categoria selecionada: <span className="text-[#3b82f6]">{selectedRecommended}</span></p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ESCOLHA UMA COR</label>
                      <div className="flex flex-wrap gap-3">
                        {customColors.map((color, idx) => (
                          <button
                            key={idx} onClick={() => setSelectedColor(color)}
                            className={`w-12 h-12 rounded-2xl transition-all shadow-sm flex items-center justify-center border-2 ${selectedColor === color ? 'border-black scale-110 shadow-md' : 'border-transparent'}`}
                            style={{ backgroundColor: color }}
                          >
                            {selectedColor === color && <div className="w-2 h-2 rounded-full bg-white opacity-40"></div>}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const newCat = { id: Date.now().toString(), name: selectedRecommended || '', color: selectedColor };
                        saveCategories([...categories, newCat]);
                        setView('categories_list');
                      }}
                      style={{ backgroundColor: selectedColor }}
                      className="w-full py-5 rounded-2xl text-white font-black text-lg shadow-xl hover:brightness-90 transition-all active:scale-95"
                    >
                      Criar Categoria
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-10">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">NOME DA CATEGORIA</label>
                  <input
                    type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
                    placeholder="ex:produtividade"
                    className="w-full p-4 rounded-xl border-[1.5px] border-black bg-white text-slate-800 font-bold outline-none shadow-sm focus:ring-2 ring-blue-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ESCOLHA UMA COR</label>
                  <div className="flex flex-wrap gap-3">
                    {customColors.map((color, idx) => (
                      <button
                        key={idx} onClick={() => setSelectedColor(color)}
                        className={`w-12 h-12 rounded-2xl transition-all shadow-sm flex items-center justify-center border-2 ${selectedColor === color ? 'border-black scale-110 shadow-md' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                      >
                        {selectedColor === color && <div className="w-2 h-2 rounded-full bg-white opacity-40"></div>}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!customName.trim()) return;
                    const newCat = { id: Date.now().toString(), name: customName, color: selectedColor };
                    saveCategories([...categories, newCat]);
                    setCustomName('');
                    setView('categories_list');
                  }}
                  style={{ backgroundColor: selectedColor }}
                  className="w-full py-5 rounded-2xl text-white font-black text-lg shadow-xl hover:brightness-90 transition-all active:scale-95"
                >
                  Criar Categoria
                </button>
              </div>
            )}
          </div>
        )}

        {view === 'edit_category' && (
          <div className="animate-fadeIn">
            <div className="flex items-center gap-3 mb-8">
              <h3 className="text-2xl font-black text-slate-800 tracking-tight">Editar Categoria</h3>
            </div>

            <div className="space-y-10">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">NOME DA CATEGORIA</label>
                <input
                  type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
                  className="w-full p-4 rounded-xl border-[1.5px] border-black bg-white text-slate-800 font-bold outline-none shadow-sm focus:ring-2 ring-blue-500/20"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">ESCOLHA UMA COR</label>
                <div className="flex flex-wrap gap-3">
                  {customColors.map((color, idx) => (
                    <button
                      key={idx} onClick={() => setSelectedColor(color)}
                      className={`w-12 h-12 rounded-2xl transition-all shadow-sm flex items-center justify-center border-2 ${selectedColor === color ? 'border-black scale-110 shadow-md' : 'border-transparent'}`}
                      style={{ backgroundColor: color }}
                    >
                      {selectedColor === color && <div className="w-2 h-2 rounded-full bg-white opacity-40"></div>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  onClick={() => setView('categories_list')}
                  className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-500 font-black text-lg shadow-sm hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveEditedCategory}
                  style={{ backgroundColor: selectedColor }}
                  className="flex-[2] py-5 rounded-2xl text-white font-black text-lg shadow-xl hover:brightness-90 transition-all active:scale-95"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tasks;
