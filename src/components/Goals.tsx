import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Target, Loader2
} from 'lucide-react';
import { format, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import { getGoalIcon } from '@/utils/goalIcons';

type GoalPeriod = 'Diárias' | 'Semanais' | 'Mensais' | 'Bimestrais' | 'Trimestrais' | 'Semestrais' | 'Anuais';

interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

interface GoalItem {
  id: string;
  title: string;
  objective: string;
  keyword: string;
  period: GoalPeriod;
  completed: boolean;
  createdAt: string;
  categoryId?: string;
}

interface GoalsProps {
  isDarkMode?: boolean;
}

const periods: GoalPeriod[] = ['Diárias', 'Semanais', 'Mensais', 'Bimestrais', 'Trimestrais', 'Semestrais', 'Anuais'];
const row1: GoalPeriod[] = ['Diárias', 'Semanais', 'Mensais'];
const row2: GoalPeriod[] = ['Bimestrais', 'Trimestrais', 'Semestrais', 'Anuais'];

const CATEGORY_COLORS = [
  '#000000', // Preto
  '#EF4444', // Vermelho
  '#3B82F6', // Azul
  '#10B981', // Verde
  '#F59E0B', // Laranja
  '#A855F7', // Roxo
  '#C084FC', // Roxo claro
  '#EC4899', // Rosa
  '#FB923C', // Laranja claro
];


const Goals: React.FC<GoalsProps> = ({ isDarkMode }) => {
  const [activePeriod, setActivePeriod] = useState<GoalPeriod>('Diárias');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formObjective, setFormObjective] = useState('');
  const [formKeyword, setFormKeyword] = useState('');

  // Icon generation states
  const [generatedIcon, setGeneratedIcon] = useState<React.ReactNode>(<Target className="w-full h-full text-slate-300" />);
  const [isIconLoading, setIsIconLoading] = useState(false);

  // Simula o processamento da IA para gerar o ícone
  useEffect(() => {
    if (!formKeyword.trim()) {
      setGeneratedIcon(<Target className="w-full h-full text-slate-300" />);
      return;
    }

    setIsIconLoading(true);
    const timer = setTimeout(() => {
      setGeneratedIcon(getGoalIcon(formKeyword));
      setIsIconLoading(false);
    }, 1500); // 1.5s de delay para "pensar"

    return () => clearTimeout(timer);
  }, [formKeyword]);

  const [editingGoal, setEditingGoal] = useState<GoalItem | null>(null);

  const [goalToDelete, setGoalToDelete] = useState<GoalItem | null>(null);

  // Category states
  const [categories, setCategories] = useState<Category[]>([]);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  const [showCreateCategoryForm, setShowCreateCategoryForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedColor, setSelectedColor] = useState(CATEGORY_COLORS[0]);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);

  // Save Modal States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStep, setSaveStep] = useState<'initial' | 'picking' | 'confirm'>('initial');
  const [tempCat, setTempCat] = useState<Category | null>(null);

  // Category View State
  const [viewCategory, setViewCategory] = useState<Category | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('produtivity_goals');
    if (saved) setGoals(JSON.parse(saved));

    const savedCategories = localStorage.getItem('produtivity_categories');
    if (savedCategories) setCategories(JSON.parse(savedCategories));
  }, []);

  const saveGoals = (updated: GoalItem[]) => {
    setGoals(updated);
    localStorage.setItem('produtivity_goals', JSON.stringify(updated));
  };

  const saveCategories = (updated: Category[]) => {
    setCategories(updated);
    localStorage.setItem('produtivity_categories', JSON.stringify(updated));
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;

    if (editingCategory) {
      const updatedCategories = categories.map(c =>
        c.id === editingCategory.id
          ? { ...c, name: newCategoryName, color: selectedColor }
          : c
      );
      saveCategories(updatedCategories);
      setEditingCategory(null);
    } else {
      const newCategory: Category = {
        id: Date.now().toString(),
        name: newCategoryName,
        color: selectedColor,
        createdAt: new Date().toISOString()
      };
      saveCategories([newCategory, ...categories]);
    }

    setNewCategoryName('');
    setSelectedColor(CATEGORY_COLORS[0]);
    setShowCreateCategoryForm(false);
  };

  const handleDeleteCategory = (id: string) => {
    saveCategories(categories.filter(c => c.id !== id));
    setCategoryToDelete(null);
  };

  const handleTriggerSave = () => {
    if (!formTitle.trim() || !formObjective.trim() || !formKeyword.trim()) return;

    if (editingGoal) {
      // Update existing goal directly
      const updatedGoals = goals.map(g =>
        g.id === editingGoal.id
          ? {
            ...g,
            title: formTitle,
            objective: formObjective,
            keyword: formKeyword,
            period: activePeriod,
            // Keep existing category if it exists
            categoryId: g.categoryId
          }
          : g
      );
      saveGoals(updatedGoals);
      setEditingGoal(null);
      setFormTitle('');
      setFormObjective('');
      setFormKeyword('');
      setShowForm(false);
    } else {
      // New goal - trigger save modal
      setSaveStep('initial');
      setTempCat(null);
      setShowSaveModal(true);
    }
  };

  const finalizeSaveGoal = () => {
    const newGoal: GoalItem = {
      id: Date.now().toString(),
      title: formTitle,
      objective: formObjective,
      keyword: formKeyword,
      period: activePeriod,
      completed: false,
      createdAt: new Date().toISOString(),
      categoryId: tempCat ? tempCat.id : undefined
    };
    saveGoals([newGoal, ...goals]);

    setFormTitle('');
    setFormObjective('');
    setFormKeyword('');
    setShowForm(false);
    setShowSaveModal(false);
  };

  const handleAddGoal = () => {
    // This function is kept for backward compatibility if needed but logic is moved to handleTriggerSave/finalizeSaveGoal
    handleTriggerSave();
  };

  const toggleGoalComplete = (id: string) => {
    saveGoals(goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  };

  const confirmDeleteGoal = () => {
    if (!goalToDelete) return;
    saveGoals(goals.filter(g => g.id !== goalToDelete.id));
    setGoalToDelete(null);
  };

  const filteredGoals = goals.filter(g => g.period === activePeriod);

  // Group goals by category
  const groupedGoals = filteredGoals.reduce((acc, goal) => {
    const category = goal.categoryId ? categories.find(c => c.id === goal.categoryId) : null;
    const categoryName = category ? category.name : 'Sem categoria';
    const categoryColor = category ? category.color : '#94a3b8';

    if (!acc[categoryName]) {
      acc[categoryName] = { goals: [], color: categoryColor };
    }
    acc[categoryName].goals.push(goal);
    return acc;
  }, {} as Record<string, { goals: GoalItem[], color: string }>);

  const cardBg = isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200';
  const textMain = isDarkMode ? 'text-white' : 'text-slate-900';
  const textSub = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const inputBg = isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400';

  const periodSingular: Record<GoalPeriod, string> = {
    'Diárias': 'Diária',
    'Semanais': 'Semanal',
    'Mensais': 'Mensal',
    'Bimestrais': 'Bimestral',
    'Trimestrais': 'Trimestral',
    'Semestrais': 'Semestral',
    'Anuais': 'Anual',
  };

  const renderPeriodButton = (period: GoalPeriod) => {
    const isActive = activePeriod === period;
    return (
      <button
        key={period}
        onClick={() => { setActivePeriod(period); setShowForm(false); }}
        className={`flex-1 min-w-0 px-3 py-3 rounded-xl text-sm font-black transition-all duration-300 whitespace-nowrap border-2 ${isActive
          ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
          : isDarkMode
            ? 'text-white border-transparent hover:border-blue-500'
            : 'text-black border-transparent hover:border-blue-500'
          }`}
      >
        {period}
      </button>
    );
  };

  const [view, setView] = useState<'goals' | 'categories' | 'create-category' | 'category-details'>('goals');

  return (
    <div className="space-y-6 md:space-y-10 animate-fadeIn">
      {/* Header with Navigation Buttons */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <button
            onClick={() => { setView('goals'); setViewCategory(null); }}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${view === 'goals'
              ? 'bg-black text-white border-black'
              : `bg-transparent text-slate-800 border-black hover:bg-black/5 ${isDarkMode ? 'text-white border-white hover:bg-white/10' : ''}`
              }`}
          >
            Metas
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setView('categories'); setViewCategory(null); }}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${view === 'categories' || view === 'category-details'
              ? 'bg-[#A855F7] text-white border-[#A855F7]'
              : isDarkMode
                ? 'border-[#A855F7] text-[#A855F7] bg-slate-900 hover:bg-[#A855F7]/10'
                : 'border-[#A855F7] text-[#A855F7] bg-white hover:bg-[#A855F7]/10'
              }`}
          >
            Minhas Categorias
          </button>
          <button
            onClick={() => {
              setView('create-category');
              setViewCategory(null);
              setEditingCategory(null);
              setNewCategoryName('');
              setSelectedColor(CATEGORY_COLORS[0]);
            }}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${view === 'create-category'
              ? isDarkMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-600 text-white border-blue-600'
              : isDarkMode ? 'bg-blue-600/10 text-blue-500 border-blue-500 hover:bg-blue-600/20' : 'bg-blue-50 text-blue-600 border-blue-500 hover:bg-blue-100'
              }`}
          >
            Criar Categoria
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {view === 'goals' && (
        <div className="space-y-6 md:space-y-10 animate-fadeIn">
          {/* Period toggle - 2 rows */}
          <div className={`rounded-2xl border-2 border-black p-2 ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
            <div className="flex gap-1.5 mb-1.5">
              {row1.map(renderPeriodButton)}
            </div>
            <div className="flex gap-1.5">
              {row2.map(renderPeriodButton)}
            </div>
          </div>

          {/* Goals List Content */}
          <div key={activePeriod} className="animate-fadeIn">
            {filteredGoals.length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupedGoals).map(([categoryName, { goals: categoryGoals, color }]) => (
                  <div key={categoryName} className="space-y-2">
                    {/* Category Label */}
                    <div className="flex px-3">
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.2em]"
                        style={{ color: color }}
                      >
                        {categoryName}
                      </span>
                    </div>

                    {/* Goals in this category */}
                    <div className="space-y-3">
                      {categoryGoals.map((goal) => (
                        <div
                          key={goal.id}
                          className={`group rounded-xl border-2 p-2.5 flex items-center gap-3 transition-all ${isDarkMode
                            ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                            : 'bg-[#eef2f6] border-slate-200 hover:border-slate-300'
                            } ${goal.completed ? 'opacity-60' : ''}`}
                        >
                          {/* Checkbox on the left */}
                          <button
                            onClick={() => toggleGoalComplete(goal.id)}
                            className={`w-5 h-5 rounded-md flex items-center justify-center transition-all flex-shrink-0 ${goal.completed
                              ? 'bg-black border-2 border-black text-white'
                              : isDarkMode
                                ? 'border-2 border-slate-600 hover:border-slate-500'
                                : 'border-2 border-black hover:bg-black/5'
                              }`}
                          >
                            {goal.completed && (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {/* Icon */}
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 p-2 [&_svg]:text-black ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                            }`}>
                            {getGoalIcon(goal.keyword)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <div className="flex items-center gap-2">
                              <h3 className={`font-bold text-sm ${goal.completed ? 'line-through' : ''} ${textMain}`}>
                                {goal.title}
                              </h3>
                              {/* Category badge removed as requested */}
                            </div>
                            {goal.objective && (
                              <p className={`text-[10px] mt-0.5 leading-tight line-clamp-2 ${textSub}`}>{goal.objective}</p>
                            )}

                            {/* Date Range */}
                            <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span>
                                {(() => {
                                  const start = new Date(goal.createdAt);

                                  if (goal.period === 'Diárias') {
                                    return format(start, 'dd/MM');
                                  }

                                  let end = new Date(start);
                                  switch (goal.period) {
                                    case 'Semanais': end = addWeeks(start, 1); break;
                                    case 'Mensais': end = addMonths(start, 1); break;
                                    case 'Bimestrais': end = addMonths(start, 2); break;
                                    case 'Trimestrais': end = addMonths(start, 3); break;
                                    case 'Semestrais': end = addMonths(start, 6); break;
                                    case 'Anuais': end = addYears(start, 1); break;
                                  }
                                  return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
                                })()}
                              </span>
                            </div>
                          </div>

                          {/* Actions container - visible on hover */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {/* Edit button */}
                            <button
                              onClick={() => {
                                setEditingGoal(goal); // Set the goal being edited
                                setFormTitle(goal.title);
                                setFormObjective(goal.objective || '');
                                setFormKeyword(goal.keyword);
                                setActivePeriod(goal.period);
                                setShowForm(true);
                              }}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDarkMode
                                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                                : 'text-black hover:bg-black/5'
                                }`}
                              title="Editar"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>

                            {/* Delete button */}
                            <button
                              onClick={() => setGoalToDelete(goal)}
                              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isDarkMode
                                ? 'text-slate-400 hover:text-red-400 hover:bg-slate-800'
                                : 'text-black hover:text-red-600 hover:bg-red-50'
                                }`}
                              title="Excluir"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : !showForm ? (
              <div className={`rounded-2xl border p-6 md:p-10 ${cardBg}`}>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <svg className={`w-8 h-8 ${textSub}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                  </div>
                  <h3 className={`text-lg font-bold mb-1 ${textMain}`}>Metas {activePeriod}</h3>
                  <p className={`text-sm ${textSub}`}>Nenhuma meta {activePeriod.toLowerCase()} cadastrada ainda.</p>
                </div>
              </div>
            ) : null}
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className={`w-full py-4 rounded-2xl border-2 border-dashed font-black text-sm transition-all active:scale-[0.98] ${isDarkMode
                ? 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-white'
                : 'border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-700'
                }`}
            >
              + Adicionar Meta {periodSingular[activePeriod]}
            </button>
          )}
        </div>
      )}

      {/* Categories List View */}
      {view === 'categories' && (
        <div className="animate-fadeIn">
          {categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {categories.map((category) => (
                <div
                  key={category.id}
                  onClick={() => { setViewCategory(category); setView('category-details'); }}
                  className="relative h-24 rounded-2xl flex items-center justify-center shadow-md group transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                  style={{ backgroundColor: category.color }}
                >
                  <span className={`font-black text-lg px-2 text-center drop-shadow-sm ${['#F59E0B', '#FB923C', '#C084FC', '#10B981'].includes(category.color) ? 'text-black' : 'text-white'
                    }`}>
                    {category.name}
                  </span>

                  {/* Actions overlay - visible on hover */}
                  <div className={`absolute inset-0 flex items-start justify-start gap-1 p-2 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none`}>
                    {/* Edit button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategory(category);
                        setNewCategoryName(category.name);
                        setSelectedColor(category.color);
                        setView('create-category');
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${['#F59E0B', '#FB923C', '#C084FC', '#10B981'].includes(category.color) ? 'text-black hover:bg-black/10' : 'text-white hover:bg-white/20'}`}
                      title="Editar"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryToDelete(category);
                      }}
                      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all pointer-events-auto ${['#F59E0B', '#FB923C', '#C084FC', '#10B981'].includes(category.color) ? 'text-black hover:bg-black/10' : 'text-white hover:bg-white/20'}`}
                      title="Excluir"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  <div className={`absolute bottom-2 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm ${['#F59E0B', '#FB923C', '#C084FC', '#10B981'].includes(category.color) ? 'bg-black/10 text-black' : 'bg-white/20 text-white'
                    }`}>
                    {goals.filter(g => g.categoryId === category.id).length}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`rounded-2xl border p-6 md:p-10 ${cardBg}`}>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                  <svg className={`w-8 h-8 ${textSub}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                  </svg>
                </div>
                <h3 className={`text-lg font-bold mb-1 ${textMain}`}>Nenhuma Categoria</h3>
                <p className={`text-sm ${textSub}`}>Você ainda não criou nenhuma categoria personalizada.</p>
              </div>
            </div>
          )}
        </div>
      )}



      {/* Create/Edit Category View */}
      {view === 'create-category' && (
        <div className={`rounded-2xl border-2 p-6 md:p-8 animate-fadeIn ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="space-y-6 max-w-2xl mx-auto">
            {editingCategory && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setEditingCategory(null);
                    setNewCategoryName('');
                    setSelectedColor(CATEGORY_COLORS[0]);
                    setView('categories');
                  }}
                  className={`text-sm font-bold underline ${textSub}`}
                >
                  Cancelar Edição
                </button>
              </div>
            )}

            <div className="flex flex-col gap-6">
              <div className="space-y-3">
                <label className={`block text-xs font-black tracking-wider ${textSub}`}>
                  NOME
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="ex: Saúde"
                  className={`w-full px-4 py-3.5 rounded-xl border-2 font-medium text-base transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${inputBg}`}
                />
              </div>

              <div className="space-y-3">
                <label className={`block text-xs font-black tracking-wider ${textSub}`}>
                  ESCOLHA UMA COR
                </label>
                <div className="grid grid-cols-5 md:grid-cols-9 gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`w-10 h-10 rounded-xl transition-all hover:scale-110 ${selectedColor === color ? 'ring-4 ring-offset-2 ring-blue-500' : ''
                        } ${isDarkMode && selectedColor === color ? 'ring-offset-slate-900' : 'ring-offset-white'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                handleCreateCategory();
                setView('categories');
              }}
              disabled={!newCategoryName.trim()}
              className={`w-full py-4 rounded-xl font-black text-base transition-all shadow-lg ${!newCategoryName.trim()
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-black text-white hover:bg-slate-800 active:scale-[0.98]'
                }`}
            >
              {editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}
            </button>
          </div>
        </div>
      )}

      {/* Category Details View - Full Screen Overlay */}
      {view === 'category-details' && viewCategory && createPortal(
        <div className={`fixed inset-0 z-[4000] flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-white'} animate-fadeIn`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setView('categories'); setViewCategory(null); }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h2 className={`text-xl font-black ${textMain}`}>{viewCategory.name}</h2>
            </div>

            <div
              className="w-8 h-8 rounded-lg shadow-sm"
              style={{ backgroundColor: viewCategory.color }}
            />
          </div>

          {/* Goals list for this category */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {(() => {
              const categoryGoals = goals.filter(g => g.categoryId === viewCategory.id);

              if (categoryGoals.length === 0) {
                return (
                  <div className={`mt-8 text-center py-16 rounded-2xl border-2 border-dashed ${isDarkMode ? 'border-slate-700' : 'border-slate-300'}`}>
                    <p className={`text-lg font-bold ${textSub}`}>Nenhuma meta nesta categoria</p>
                    <p className={`text-sm ${textSub} mt-2`}>Crie uma nova meta e organize-a nesta categoria</p>
                  </div>
                );
              }

              return (
                <div className="space-y-3 mt-2">
                  {categoryGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className={`group rounded-xl border-2 p-2.5 flex items-center gap-3 transition-all ${isDarkMode
                        ? 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        : 'bg-[#eef2f6] border-slate-200 hover:border-slate-300'
                        } ${goal.completed ? 'opacity-60' : ''}`}
                    >
                      {/* Icon */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 p-2 [&_svg]:text-black ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'
                        }`}>
                        {getGoalIcon(goal.keyword)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h3 className={`font-bold text-sm ${goal.completed ? 'line-through' : ''} ${textMain}`}>
                          {goal.title}
                        </h3>
                        {goal.objective && (
                          <p className={`text-[10px] mt-0.5 leading-tight line-clamp-2 ${textSub}`}>{goal.objective}</p>
                        )}

                        {/* Date Range */}
                        <div className={`flex items-center gap-1 mt-1 text-[10px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <span>
                            {(() => {
                              const start = new Date(goal.createdAt);

                              if (goal.period === 'Diárias') {
                                return format(start, 'dd/MM');
                              }

                              let end = new Date(start);
                              switch (goal.period) {
                                case 'Semanais': end = addWeeks(start, 1); break;
                                case 'Mensais': end = addMonths(start, 1); break;
                                case 'Bimestrais': end = addMonths(start, 2); break;
                                case 'Trimestrais': end = addMonths(start, 3); break;
                                case 'Semestrais': end = addMonths(start, 6); break;
                                case 'Anuais': end = addYears(start, 1); break;
                              }
                              return `${format(start, 'dd/MM')} - ${format(end, 'dd/MM')}`;
                            })()}
                          </span>
                        </div>
                      </div>

                      {/* Period label on the right */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span
                          className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-700'}`}
                        >
                          {goal.period}
                        </span>
                      </div>


                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>,
        document.body
      )}

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && createPortal(
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeInSimple">
          <div className={`p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-2 animate-fadeIn ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-black'}`}>
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className={`text-xl font-black mb-2 ${textMain}`}>Excluir Categoria?</h3>
            <p className={`font-medium mb-8 text-sm ${textSub}`}>
              Tem certeza que deseja apagar a categoria "<span className="font-bold">{categoryToDelete.name}</span>"?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setCategoryToDelete(null)}
                className={`flex-1 py-3 font-bold rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteCategory(categoryToDelete.id)}
                className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Add Goal Form - Full screen overlay */}
      {showForm && createPortal(
        <div
          className={`fixed inset-0 z-[5000] flex flex-col ${isDarkMode ? 'bg-slate-950' : 'bg-white'}`}
        >
          <div
            style={{
              animation: 'fadeInFast 0.35s ease-out'
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <h2 className={`text-xl font-black ${isDarkMode ? 'text-blue-400' : 'text-blue-900'}`}>
                {editingGoal ? 'Editar Meta' : `Nova Meta ${periodSingular[activePeriod]}`}
              </h2>
              <button
                onClick={() => {
                  setShowForm(false);
                  setEditingGoal(null);
                  setFormTitle('');
                  setFormObjective('');
                  setFormKeyword('');
                }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 flex flex-col justify-center px-6 pb-6 space-y-4">
              {/* Qual a meta */}
              <div className="space-y-2">
                <label className={`text-sm font-black flex items-center gap-3 ${textMain}`}>
                  <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" /><line x1="12" y1="1" x2="12" y2="7" /><line x1="12" y1="17" x2="12" y2="23" /><line x1="1" y1="12" x2="7" y2="12" /><line x1="17" y1="12" x2="23" y2="12" /></svg>
                  </span>
                  QUAL A META?
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ex: Ler 12 livros, Economizar R$5.000..."
                  className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 focus:border-slate-600 text-white placeholder:text-white/10' : 'bg-white border-slate-200 focus:border-slate-400 text-slate-900 placeholder:text-slate-900/10'}`}
                />
              </div>

              {/* Qual o objetivo */}
              <div className="space-y-2">
                <label className={`text-sm font-black flex items-center gap-3 ${textMain}`}>
                  <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </span>
                  QUAL O OBJETIVO DESSA META?
                </label>
                <textarea
                  value={formObjective}
                  onChange={(e) => setFormObjective(e.target.value)}
                  placeholder="Ex: Expandir meu conhecimento e desenvolver o hábito de leitura..."
                  rows={2}
                  className={`w-full px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all focus:outline-none resize-none ${isDarkMode ? 'bg-slate-900 border-slate-700 focus:border-slate-600 text-white placeholder:text-white/10' : 'bg-white border-slate-200 focus:border-slate-400 text-slate-900 placeholder:text-slate-900/10'}`}
                />
              </div>

              {/* Palavra-chave para ícone */}
              <div className="space-y-2">
                <label className={`text-sm font-black flex items-center gap-3 ${textMain}`}>
                  <span className={`${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                  </span>
                  DEFINA ESSA META EM UMA PALAVRA
                </label>
                <p className={`text-xs font-semibold ${isDarkMode ? 'text-white/30' : 'text-slate-900/30'}`}>A IA usará essa palavra para gerar um ícone representativo</p>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={formKeyword}
                    onChange={(e) => setFormKeyword(e.target.value)}
                    placeholder="Ex: Leitura, Finanças, Saúde..."
                    className={`flex-1 px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all focus:outline-none ${isDarkMode ? 'bg-slate-900 border-slate-700 focus:border-slate-600 text-white placeholder:text-white/10' : 'bg-white border-slate-200 focus:border-slate-400 text-slate-900 placeholder:text-slate-900/10'}`}
                  />
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center p-3 transition-all duration-300 ${formKeyword.trim() ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                    } ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    {isIconLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                    ) : (
                      generatedIcon
                    )}
                  </div>
                </div>
              </div>

              {/* Save button */}
              <button
                onClick={handleAddGoal}
                className={`w-full border-2 py-3 rounded-2xl font-black text-sm transition-all active:scale-[0.98] focus:outline-none focus:ring-0 ${formTitle.trim() && formObjective.trim() && formKeyword.trim()
                  ? 'bg-black border-black text-white hover:bg-black/90'
                  : isDarkMode
                    ? 'bg-neutral-700 border-neutral-700 text-white hover:bg-neutral-600 cursor-not-allowed'
                    : 'bg-neutral-600 border-neutral-600 text-white hover:bg-neutral-700 cursor-not-allowed'
                  }`}
                disabled={!formTitle.trim() || !formObjective.trim() || !formKeyword.trim()}
              >
                {editingGoal ? 'Salvar Alterações' : 'Salvar Meta'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Save Modal for Category Selection - OUTSIDE form portal */}
      {showSaveModal && createPortal(
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full border-2 border-black text-center">
            <h3 className="text-lg font-black text-slate-800 mb-1">Organizar</h3>
            <p className="text-slate-400 font-bold mb-6 text-[8px] uppercase tracking-widest">Escolha a categoria:</p>
            {saveStep === 'initial' && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setTempCat(null); setSaveStep('confirm'); }}
                  className="flex-1 py-3 px-2 rounded-xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase hover:bg-slate-200 transition-all"
                >
                  Nenhuma
                </button>
                <button
                  onClick={() => setSaveStep('picking')}
                  className="flex-1 py-3 px-2 rounded-xl bg-[#1e293b] text-white font-black text-[10px] uppercase hover:bg-black transition-all"
                >
                  Escolher
                </button>
              </div>
            )}
            {saveStep === 'picking' && (
              <div className="animate-fadeIn">
                {categories.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-slate-400 font-bold mb-4 text-[10px]">Sem categorias salvas.</p>
                    <div className="flex gap-3">
                      <button
                        onClick={finalizeSaveGoal}
                        className="flex-1 py-3 bg-black text-white rounded-xl font-black text-[10px] uppercase"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setShowSaveModal(false)}
                        className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-4 pr-1">
                      {categories.map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => { setTempCat(cat); setSaveStep('confirm'); }}
                          style={{ backgroundColor: cat.color }}
                          className="w-full p-3 rounded-xl text-white font-black text-left text-xs shadow-sm hover:brightness-90 transition-all border border-transparent active:border-black"
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => setSaveStep('initial')}
                      className="w-full py-2 text-slate-400 font-bold text-[9px] uppercase tracking-widest"
                    >
                      Voltar
                    </button>
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
                  <button
                    onClick={finalizeSaveGoal}
                    className="flex-1 py-3 bg-black text-white font-black rounded-xl text-[10px] uppercase"
                  >
                    Salvar
                  </button>
                  <button
                    onClick={() => setSaveStep('initial')}
                    className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase"
                  >
                    Voltar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Delete confirmation modal */}
      {goalToDelete && createPortal(
        <div className="fixed inset-0 z-[6000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeInSimple">
          <div className={`p-10 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border-2 animate-fadeIn ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-black'}`}>
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className={`text-xl font-black mb-2 ${textMain}`}>Excluir Meta?</h3>
            <p className={`font-medium mb-8 text-sm ${textSub}`}>
              Tem certeza que deseja apagar a meta "<span className="font-bold">{goalToDelete.title}</span>"?
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setGoalToDelete(null)}
                className={`flex-1 py-3 font-bold rounded-xl transition-all ${isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteGoal}
                className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Goals;

