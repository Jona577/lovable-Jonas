import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { generateAIResponse } from '@/lib/aiClient';
import NutritionModule from './NutritionModule';
import { sanitizeHtml } from '@/lib/sanitize';

type ViewState = 'entry' | 'list' | 'categories' | 'create_category' | 'editor' | 'calculator' | 'calculator_percent' | 'gym_menu' | 'gym_choice' | 'gym_now' | 'gym_train' | 'gym_subgroups' | 'gym_exercises' | 'gym_duration' | 'gym_save_day' | 'gym_active_session' | 'gym_weights' | 'gym_history' | 'gym_manage' | 'gym_edit_library' | 'gym_add_to_library' | 'finances' | 'finances_income' | 'finances_expenses' | 'finances_categories' | 'finances_monthly_overview' | 'finances_create_category' | 'finances_income_form' | 'finances_income_form_step2' | 'finances_income_form_step3' | 'finances_expense_form' | 'finances_expense_form_step2' | 'finances_income_list' | 'finances_expense_list' | 'oratoria_setup' | 'oratoria_redirect' | 'nutrition_onboarding' | 'nutrition_onboarding_step2' | 'nutrition_onboarding_step3' | 'nutrition_dashboard' | 'finances_income_onboarding' | 'finances_expense_onboarding';
type SaveModalStep = 'initial' | 'picking_cat' | 'confirm_save';
type SortOption = 'lastModified' | 'createdAt' | 'category' | 'alphabetical';
type GymHistoryTab = 'done_workouts' | 'stats';
type ChartViewMode = 'days_of_week' | 'days_of_month' | 'weeks_of_month' | 'months_of_year' | 'years';

interface NoteCategory {
  id: string;
  name: string;
  color: string;
  financeType?: 'income' | 'expense';
}

interface Note {
  id: string;
  title: string;
  content: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  createdAt: string;
  lastModified: string;
}

interface NutritionProfile {
  age: string;
  height: string;
  weight: string;
  gender: 'male' | 'female' | null;
  // Step 2 - Goals
  objective: string;
  activityLevel: string;
  weeklyTrainings: number;
  trainingIntensity: string;
  desiredWeight: string;
  realisticDeadline: string;
  // Step 3 - Restrictions & Preferences
  hasRestriction: boolean;
  restrictions: {
    vegetarian: boolean;
    intolerant: boolean;
    intoleranceDesc: string;
    allergies: boolean;
    allergiesDesc: string;
    dislikedFoods: boolean;
    dislikedFoodsDesc: string;
  };
  monthlyBudget: string;
  culinaryPreference: string;
  mealsPerDay: string;
}

interface FinanceRecord {
  id: string;
  type: 'income' | 'expense';
  name: string;
  value: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  effort?: string;
  canGrow?: boolean | null;
  recurrence?: 'fixo' | 'pontual';
  period?: string;
  necessity?: 'necessario' | 'impulso' | 'nao_sei' | null;
  mood?: string;
  moodOther?: string;
  date: string;
}

interface OthersProps {
  isDarkMode?: boolean;
  initialView?: ViewState;
  onViewChange?: (view: ViewState) => void;
  onOpenDetail?: (item: any) => void;
}

const customColors = ['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#c084fc', '#f472b6', '#fb923c'];
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

const muscleGroups = ['Pernas', 'Peito', 'Costas', 'Ombros', 'Braços', 'Abdômen'];

const muscleSubGroups: Record<string, string[]> = {
  'Pernas': ['Quadríceps', 'Posterior de coxa', 'Glúteos', 'Panturrilhas', 'Adutores / Abdutores'],
  'Peito': ['Peito superior', 'Peito médio', 'Peito inferior'],
  'Costas': ['Costas superiores', 'Costas médias', 'Lombar', 'Largura das costas'],
  'Ombros': ['Ombro frontal', 'Ombro lateral', 'Ombro posterior', 'Trapézio'],
  'Braços': ['Bíceps curto', 'Bíceps longo', 'Braquial', 'Tríceps longo', 'Tríceps lateral', 'Tríceps medial'],
  'Abdômen': ['Abdômen superior', 'Abdômen inferior', 'Abdômen lateral / core']
};

interface ExerciseRecs {
  sets: string;
  reps: string;
  rest: string;
  isTimeBased?: boolean;
}

interface ExerciseInfo {
  name: string;
  more?: string;
  less?: string;
  recs: ExerciseRecs;
}

interface ExerciseDetails {
  sets: string;
  reps: string;
  timePerSet: string;
  rest: string;
}

interface GroupedExercises {
  isolados: ExerciseInfo[];
  multi: ExerciseInfo[];
}

interface SavedWorkout {
  id: string;
  day: string;
  muscles: string[];
  exercises: Record<string, Record<string, ExerciseDetails>>;
  createdAt: string;
}

interface WorkoutHistoryEntry {
  id: string;
  workoutId: string;
  day: string;
  muscles: string[];
  subMuscles?: string[]; // Added to store location info
  date: string; // Formato DD/MM/YYYY
  weights: Record<string, string>;
  visible?: boolean; // Controls visibility in history list vs stats
}

const DEFAULT_EXERCISES: Record<string, GroupedExercises> = {
  'Quadríceps': {
    isolados: [
      { name: 'Cadeira extensora', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Cadeira extensora unilateral', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Extensão de joelho no cabo', recs: { sets: '3', reps: '15', rest: '45s' } }
    ],
    multi: [
      { name: 'Agachamento', more: 'quadríceps, glúteos', less: 'posterior, lombar', recs: { sets: '3-5', reps: '6-12', rest: '90-120s' } },
      { name: 'Leg press', more: 'quadríceps', less: 'glúteos', recs: { sets: '3-5', reps: '6-12', rest: '90-120s' } },
      { name: 'Hack machine', more: 'quadríceps', less: 'glúteos', recs: { sets: '3-4', reps: '8-12', rest: '90-120s' } },
      { name: 'Agachamento frontal', more: 'quadríceps', less: 'glúteos, lombar', recs: { sets: '3-5', reps: '6-10', rest: '120s' } }
    ]
  },
  'Posterior de coxa': {
    isolados: [
      { name: 'Mesa flexora', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Flexora em pé', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Mesa flexora unilateral', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Flexora sentado', recs: { sets: '3', reps: '10-15', rest: '45-60s' } }
    ],
    multi: [
      { name: 'Levantamento terra romeno', more: 'posterior', less: 'glúteos, lombar', recs: { sets: '3-4', reps: '6-10', rest: '90-120s' } },
      { name: 'Good morning', more: 'posterior', less: 'lombar', recs: { sets: '3-4', reps: '6-10', rest: '90-120s' } },
      { name: 'Stiff com halteres', more: 'posterior', less: 'lombar', recs: { sets: '3-4', reps: '8-12', rest: '90-120s' } },
      { name: 'Levantamento terra tradicional', more: 'posterior, lombar', less: 'glúteos', recs: { sets: '3-5', reps: '5-8', rest: '120-180s' } }
    ]
  },
  'Glúteos': {
    isolados: [
      { name: 'Elevação pélvica', recs: { sets: '3-4', reps: '10-15', rest: '60s' } },
      { name: 'Coice no cabo', recs: { sets: '3-4', reps: '10-15', rest: '60s' } },
      { name: 'Abdução de quadril no cabo', recs: { sets: '3-4', reps: '12-20', rest: '45s' } },
      { name: 'Glute bridge', recs: { sets: '3', reps: '12-15', rest: '60s' } }
    ],
    multi: [
      { name: 'Agachamento profundo', more: 'glúteos', less: 'quadríceps', recs: { sets: '3-5', reps: '8-12', rest: '90-120s' } },
      { name: 'Afundo', more: 'glúteos', less: 'quadríceps', recs: { sets: '3-5', reps: '8-12', rest: '90-120s' } },
      { name: 'Passada andando', more: 'glúteos', less: 'quadríceps', recs: { sets: '3-4', reps: '16-20 passos', rest: '90s' } },
      { name: 'Step-up no banco', more: 'glúteos', less: 'quadríceps', recs: { sets: '3-4', reps: '10-12', rest: '90s' } }
    ]
  },
  'Panturrilhas': {
    isolados: [
      { name: 'Elevação de panturrilha em pé', recs: { sets: '4-6', reps: '12-20', rest: '30-45s' } },
      { name: 'Elevação de panturrilha sentado', recs: { sets: '4-6', reps: '12-20', rest: '30-45s' } },
      { name: 'Panturrilha no leg press', recs: { sets: '4-6', reps: '12-20', rest: '30-45s' } },
      { name: 'Panturrilha unilateral em pé', recs: { sets: '3-4', reps: '12-15', rest: '30-45s' } }
    ],
    multi: [
      { name: 'Agachamento com elevação de calcanhar', more: 'panturrilhas', less: 'quadríceps', recs: { sets: '3', reps: '12-15', rest: '60s' } },
      { name: 'Farmer walk na ponta dos pés', more: 'panturrilhas', less: 'core', recs: { sets: '3', reps: '30-40s', rest: '60s', isTimeBased: true } }
    ]
  },
  'Adutores / Abdutores': {
    isolados: [
      { name: 'Cadeira adutora', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Cadeira abdutora', recs: { sets: '3-4', reps: '15-20', rest: '45-60s' } },
      { name: 'Adutor no cabo unilateral', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ],
    multi: [
      { name: 'Agachamento sumô', more: 'adutores, glúteos', less: 'quadríceps', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Passada lateral', more: 'adutores', less: 'glúteos', recs: { sets: '3-4', reps: '10-12', rest: '90s' } },
      { name: 'Agachamento lateral', more: 'adutores', less: 'quadríceps', recs: { sets: '3-4', reps: '8-12', rest: '90s' } }
    ]
  },
  'Peito superior': {
    isolados: [
      { name: 'Crucifixo inclinado', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Crucifixo inclinado no cabo', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Crossover inclinado', recs: { sets: '3', reps: '15', rest: '45s' } }
    ],
    multi: [
      { name: 'Supino inclinado', more: 'peito superior', less: 'ombro frontal, tríceps', recs: { sets: '3-5', reps: '6-10', rest: '90-120s' } },
      { name: 'Supino inclinado com halteres', more: 'peito superior', less: 'ombro frontal', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Flexão de braço com pés elevados', more: 'peito superior', less: 'tríceps', recs: { sets: '3-4', reps: '10-15', rest: '60-90s' } }
    ]
  },
  'Peito médio': {
    isolados: [
      { name: 'Crucifixo reto', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Peck deck', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Crucifixo com halteres', recs: { sets: '3', reps: '12-15', rest: '45s' } },
      { name: 'Crucifixo no cabo em pé', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } }
    ],
    multi: [
      { name: 'Supino reto', more: 'peito médio', less: 'tríceps, ombro frontal', recs: { sets: '3-5', reps: '6-10', rest: '90-120s' } },
      { name: 'Supino com halteres', more: 'peito médio', less: 'tríceps', recs: { sets: '3-5', reps: '6-10', rest: '90-120s' } },
      { name: 'Flexão de braço tradicional', more: 'peito médio', less: 'ombro frontal', recs: { sets: '3-4', reps: '12-20', rest: '60-90s' } }
    ]
  },
  'Peito inferior': {
    isolados: [
      { name: 'Crossover baixo', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Crossover alto', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Crucifixo declinado', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ],
    multi: [
      { name: 'Supino declinado', more: 'peito inferior', less: 'tríceps', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Paralelas com inclinação à frente', more: 'peito inferior', less: 'tríceps', recs: { sets: '3-4', reps: '6-12', rest: '90s' } }
    ]
  },
  'Costas superiores': {
    isolados: [
      { name: 'Face pull', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Crucifixo no cabo (em pé)', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Remada alta com pegada aberta (leve)', recs: { sets: '3', reps: '12-15', rest: '60s' } }
    ],
    multi: [
      { name: 'Remada alta', more: 'costas superiores, trapézio', less: 'bíceps', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Remada cavalinho', more: 'costas superiores, costas médias', less: 'bíceps', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Puxada alta aberta no pulley', more: 'costas superiores', less: 'bíceps', recs: { sets: '3-4', reps: '10-12', rest: '90s' } }
    ]
  },
  'Costas médias': {
    isolados: [
      { name: 'Pullover', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Remada baixa no cabo (pegada neutra)', recs: { sets: '3-4', reps: '10-15', rest: '60s' } },
      { name: 'Pullover no cabo', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ],
    multi: [
      { name: 'Remada curvada', more: 'costas médias', less: 'bíceps, lombar', recs: { sets: '3-5', reps: '6-10', rest: '90-120s' } },
      { name: 'Remada unilateral com halter', more: 'costas médias', less: 'bíceps', recs: { sets: '3-4', reps: '8-12', rest: '60-90s' } },
      { name: 'Remada máquina articulada', more: 'costas médias', less: 'lombar', recs: { sets: '3-4', reps: '10-12', rest: '90s' } }
    ]
  },
  'Lombar': {
    isolados: [
      { name: 'Extensão lombar', recs: { sets: '3', reps: '12-15', rest: '60s' } },
      { name: 'Good morning leve', recs: { sets: '3', reps: '12-15', rest: '60s' } }
    ],
    multi: [
      { name: 'Levantamento terra', more: 'lombar', less: 'glúteos, posteriores', recs: { sets: '3-5', reps: '5-8', rest: '120-180s' } },
      { name: 'Agachamento livre', more: 'lombar (estabilização), glúteos', less: 'quadríceps', recs: { sets: '3-5', reps: '6-10', rest: '120s' } }
    ]
  },
  'Largura das costas': {
    isolados: [
      { name: 'Pulldown unilateral', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Pulldown unilateral no cabo', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Pullover com halter', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ],
    multi: [
      { name: 'Barra fixa', more: 'largura das costas', less: 'bíceps', recs: { sets: '3-5', reps: '6-12', rest: '90-120s' } },
      { name: 'Puxada na frente pegada neutra', more: 'largura das costas', less: 'bíceps', recs: { sets: '3-4', reps: '8-12', rest: '90s' } }
    ]
  },
  'Ombro frontal': {
    isolados: [
      { name: 'Elevação frontal', recs: { sets: '3', reps: '10-15', rest: '45s' } },
      { name: 'Elevação frontal no cabo', recs: { sets: '3', reps: '12-15', rest: '45s' } },
      { name: 'Elevação frontal com anilha', recs: { sets: '3', reps: '10-12', rest: '45s' } }
    ],
    multi: [
      { name: 'Desenvolvimento', more: 'ombro frontal', less: 'tríceps', recs: { sets: '3-5', reps: '6-10', rest: '90s' } },
      { name: 'Arnold press', more: 'frontal', less: 'lateral', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Supino militar em pé', more: 'frontal', less: 'tríceps', recs: { sets: '3-5', reps: '6-10', rest: '90-120s' } }
    ]
  },
  'Ombro lateral': {
    isolados: [
      { name: 'Elevação lateral', recs: { sets: '3-5', reps: '12-20', rest: '30-45s' } },
      { name: 'Elevação lateral no cabo unilateral', recs: { sets: '3-4', reps: '12-20', rest: '30-45s' } },
      { name: 'Elevação lateral inclinada', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ],
    multi: [
      { name: 'Desenvolvimento com halter', more: 'ombro lateral', less: 'frontal', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Desenvolvimento máquina', more: 'lateral', less: 'frontal', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Push press', more: 'lateral', less: 'frontal', recs: { sets: '3-4', reps: '6-8', rest: '120s' } }
    ]
  },
  'Ombro posterior': {
    isolados: [
      { name: 'Crucifixo inverso', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Crucifixo inverso no cabo', recs: { sets: '3-4', reps: '12-15', rest: '45-60s' } },
      { name: 'Remada alta reversa (leve)', recs: { sets: '3', reps: '12-15', rest: '60s' } }
    ],
    multi: [
      { name: 'Remada alta aberta', more: 'posterior', less: 'trapézio', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Remada curvada aberta', more: 'posterior', less: 'bíceps', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Face pull pesado', more: 'posterior', less: 'trapézio', recs: { sets: '3-4', reps: '10-12', rest: '60s' } }
    ]
  },
  'Trapézio': {
    isolados: [
      { name: 'Encolhimento', recs: { sets: '3-4', reps: '10-15', rest: '60s' } }
    ],
    multi: [
      { name: 'Levantamento terra', more: 'trapézio', less: 'lombar', recs: { sets: '3-5', reps: '5-8', rest: '120-180s' } }
    ]
  },
  'Bíceps curto': {
    isolados: [
      { name: 'Rosca Scott', recs: { sets: '3-4', reps: '8-12', rest: '45-60s' } },
      { name: 'Rosca concentrada', recs: { sets: '3-4', reps: '8-12', rest: '45-60s' } },
      { name: 'Rosca no banco inclinado fechado', recs: { sets: '3-4', reps: '10-12', rest: '60s' } }
    ],
    multi: [
      { name: 'Barra fixa supinada', more: 'bíceps curto', less: 'costas', recs: { sets: '3-4', reps: '6-10', rest: '90s' } },
      { name: 'Puxada supinada no pulley', more: 'bíceps curto', less: 'costas', recs: { sets: '3-4', reps: '8-12', rest: '90s' } },
      { name: 'Remada baixa supinada', more: 'bíceps curto', less: 'costas', recs: { sets: '3-4', reps: '10-12', rest: '90s' } }
    ]
  },
  'Bíceps longo': {
    isolados: [
      { name: 'Rosca inclinada', recs: { sets: '3-4', reps: '8-12', rest: '45-60s' } },
      { name: 'Rosca alternada em pé', recs: { sets: '3', reps: '10-12', rest: '45-60s' } },
      { name: 'Rosca inclinada no cabo', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ],
    multi: [
      { name: 'Remada supinada', more: 'bíceps longo', less: 'costas', recs: { sets: '3-4', reps: '6-10', rest: '90s' } },
      { name: 'Barra fixa supinada aberta', more: 'bíceps longo', less: 'costas', recs: { sets: '3-5', reps: '6-10', rest: '90-120s' } },
      { name: 'Remada curvada supinada', more: 'bíceps longo', less: 'costas', recs: { sets: '3-4', reps: '8-10', rest: '90s' } }
    ]
  },
  'Braquial': {
    isolados: [
      { name: 'Rosca martelo', recs: { sets: '3-4', reps: '8-12', rest: '45-60s' } },
      { name: 'Rosca martelo no cabo', recs: { sets: '3-4', reps: '10-12', rest: '60s' } },
      { name: 'Rosca cross-body', recs: { sets: '3', reps: '12', rest: '45s' } }
    ],
    multi: [
      { name: 'Barra fixa neutra', more: 'braquial', less: 'bíceps', recs: { sets: '3-4', reps: '6-10', rest: '90s' } },
      { name: 'Barra fixa neutra fechada', more: 'braquial', less: 'bíceps', recs: { sets: '3-4', reps: '6-10', rest: '90s' } },
      { name: 'Remada neutra', more: 'braquial', less: 'costas', recs: { sets: '3-4', reps: '10-12', rest: '90s' } }
    ]
  },
  'Tríceps longo': {
    isolados: [
      { name: 'Tríceps francês', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Tríceps testa', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } },
      { name: 'Tríceps testa com barra W', recs: { sets: '3-4', reps: '10-12', rest: '60s' } }
    ],
    multi: [
      { name: 'Paralelas', more: 'tríceps longo', less: 'peito', recs: { sets: '3-4', reps: '6-10', rest: '90-120s' } },
      { name: 'Supino fechado', more: 'tríceps', less: 'peito', recs: { sets: '3-4', reps: '6-10', rest: '90s' } }
    ]
  },
  'Tríceps lateral': {
    isolados: [
      { name: 'Tríceps pulley barra', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } }
    ],
    multi: [
      { name: 'Supino fechado', more: 'tríceps lateral', less: 'peito', recs: { sets: '3-4', reps: '6-10', rest: '90-120s' } }
    ]
  },
  'Tríceps medial': {
    isolados: [
      { name: 'Tríceps pulley inverso', recs: { sets: '3-4', reps: '10-15', rest: '45-60s' } }
    ],
    multi: [
      { name: 'Flexão fechada', more: 'tríceps medial', less: 'ombro', recs: { sets: '3-4', reps: '6-10', rest: '90-120s' } }
    ]
  },
  'Abdômen superior': {
    isolados: [
      { name: 'Abdominal reto', recs: { sets: '3-4', reps: '12-20', rest: '30-45s' } },
      { name: 'Crunch no cabo', recs: { sets: '3-4', reps: '12-20', rest: '30-45s' } },
      { name: 'Crunch declinado', recs: { sets: '3', reps: '15', rest: '30s' } }
    ],
    multi: [
      { name: 'Abdominal com carga', more: 'superior', less: 'flexores do quadril', recs: { sets: '3', reps: '10-15', rest: '45-60s' } },
      { name: 'Abdominal com bola suíça', more: 'superior', less: 'lombar', recs: { sets: '3', reps: '15-20', rest: '45s' } },
      { name: 'Sit-up', more: 'superior', less: 'flexores do quadril', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ]
  },
  'Abdômen inferior': {
    isolados: [
      { name: 'Elevação de pernas', recs: { sets: '3-4', reps: '12-20', rest: '30-45s' } },
      { name: 'Elevação de pernas no banco', recs: { sets: '3-4', reps: '12-20', rest: '30-45s' } },
      { name: 'Reverse crunch', recs: { sets: '3', reps: '15', rest: '30s' } }
    ],
    multi: [
      { name: 'Elevação suspensa', more: 'inferior', less: 'lombar', recs: { sets: '3', reps: '10-15', rest: '45-60s' } },
      { name: 'Toes to bar', more: 'inferior', less: 'lombar', recs: { sets: '3', reps: '8-12', rest: '60s' } },
      { name: 'Elevação suspensa com balanço controlado', more: 'inferior', less: 'oblíquos', recs: { sets: '3', reps: '10-12', rest: '60s' } }
    ]
  },
  'Abdômen lateral / core': {
    isolados: [
      { name: 'Abdominal oblíquo', recs: { sets: '3-4', reps: '12-20', rest: '30-45s' } },
      { name: 'Prancha lateral', recs: { sets: '3', reps: '30-45s', rest: '30s', isTimeBased: true } },
      { name: 'Flexão lateral com halter', recs: { sets: '3', reps: '12-15', rest: '45s' } }
    ],
    multi: [
      { name: 'Rotação no cabo', more: 'oblíquos', less: 'reto abdominal', recs: { sets: '3', reps: '10-15', rest: '45-60s' } },
      { name: 'Woodchopper no cabo', more: 'oblíquos', less: 'reto abdominal', recs: { sets: '3', reps: '10-15', rest: '45-60s' } },
      { name: 'Turkish get-up', more: 'core', less: 'ombros', recs: { sets: '3', reps: '4-6', rest: '90s' } }
    ]
  }
};

const weekDays = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const CoordinateChart = ({ data, color = "#000", xLabelType = 'date' }: { data: { date: string, weight: number, label?: string }[], color?: string, xLabelType?: 'date' | 'week' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDims = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight
        });
      }
    };
    window.addEventListener('resize', updateDims);
    // Slight delay to ensure layout is settled
    setTimeout(updateDims, 0);
    return () => window.removeEventListener('resize', updateDims);
  }, []);

  const { width, height } = dimensions;
  const padding = 40;

  if (width === 0 || height === 0) return <div ref={containerRef} className="w-full h-full" />;

  const maxWeight = Math.max(...data.map(d => d.weight)) * 1.2 || 10;
  const minWeight = 0;

  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const getX = (index: number) => {
    if (data.length <= 1) return padding + chartWidth / 2;
    return padding + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (weight: number) => {
    return padding + chartHeight - ((weight - minWeight) / (maxWeight - minWeight)) * chartHeight;
  };

  const points = data.map((d, i) => ({
    x: getX(i),
    y: getY(d.weight),
    ...d
  }));

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

  return (
    <div ref={containerRef} className="w-full h-full select-none relative">
      <svg width={width} height={height} className="overflow-visible">
        {/* Axes with Arrows */}
        <defs>
          <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L0,6 L9,3 z" fill="black" />
          </marker>
        </defs>

        {/* Y Axis - Fixed direction: Bottom to Top */}
        <line x1={padding} y1={height - padding} x2={padding} y2={padding} stroke="black" strokeWidth="2" markerEnd="url(#arrow)" />
        {/* X Axis */}
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="black" strokeWidth="2" markerEnd="url(#arrow)" />

        {points.map((p, i) => (
          <g key={i}>
            {/* Dashed Lines */}
            <line x1={p.x} y1={p.y} x2={p.x} y2={height - padding} stroke="black" strokeWidth="1" strokeDasharray="4 4" />
            <line x1={p.x} y1={p.y} x2={padding} y2={p.y} stroke="black" strokeWidth="1" strokeDasharray="4 4" />

            {/* Labels */}
            <text x={p.x} y={height - padding + 15} textAnchor="middle" fontSize="10" fontWeight="900" fill="#64748b">
              {p.label || p.date}
            </text>
            <text x={padding - 5} y={p.y + 3} textAnchor="end" fontSize="10" fontWeight="900" fill="#64748b">{Math.round(p.weight)}kg</text>

            {/* Point */}
            <circle cx={p.x} cy={p.y} r={5} fill={color} stroke="white" strokeWidth="2" />
          </g>
        ))}

        {/* Connecting Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="3" />
      </svg>
    </div>
  );
};

const Others: React.FC<OthersProps> = ({ isDarkMode, initialView, onViewChange, onOpenDetail }) => {
  const [view, setViewInternal] = useState<ViewState>(initialView || 'entry');
  const setView = (newView: ViewState) => {
    setViewInternal(newView);
    if (onViewChange) onViewChange(newView);
  };

  const getMetaDateRange = (savedAt: string | null, type: string, amountStr: string) => {
    if (!savedAt || !type || type === 'sem_aumento' || type === 'sem_reducao' || type === '') return null;
    try {
      const start = new Date(savedAt);
      const end = new Date(savedAt);
      const amount = parseInt(amountStr) || 1;

      if (type === 'dias') end.setDate(end.getDate() + amount);
      else if (type === 'mes' || type === 'meses') end.setMonth(end.getMonth() + amount);
      else if (type === 'ano') end.setFullYear(end.getFullYear() + amount);

      const fmt = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return `(${fmt(start)} a ${fmt(end)})`;
    } catch (e) {
      return null;
    }
  };

  const [motivation, setMotivation] = useState<string | null>(null);
  const [isLoadingMotivation, setIsLoadingMotivation] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [categories, setCategories] = useState<NoteCategory[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('lastModified');

  const [currentNote, setCurrentNote] = useState<Partial<Note>>({});
  const [newCatName, setNewCatName] = useState('');
  const [selectedColor, setSelectedColor] = useState(customColors[0]);
  const [editingCategory, setEditingCategory] = useState<NoteCategory | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveStep, setSaveStep] = useState<SaveModalStep>('initial');
  const [tempCatSelection, setTempCatSelection] = useState<NoteCategory | null>(null);

  // Gym States
  const [gymDb, setGymDb] = useState<Record<string, GroupedExercises>>(DEFAULT_EXERCISES);
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([]);
  const [selectedSubMuscles, setSelectedSubMuscles] = useState<Record<string, string[]>>({});
  const [selectedExercises, setSelectedExercises] = useState<Record<string, Record<string, ExerciseDetails>>>({});
  const [savedWorkouts, setSavedWorkouts] = useState<SavedWorkout[]>([]);
  const [workoutDaysToSave, setWorkoutDaysToSave] = useState<string[]>([]);
  const [workoutToDelete, setWorkoutToDelete] = useState<SavedWorkout | null>(null);
  const [gymHistory, setGymHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [historyTab, setHistoryTab] = useState<GymHistoryTab>('done_workouts');
  // FIXED: Changed `workoutMode` from an object to a state variable.
  const [workoutMode, setWorkoutMode] = useState<'custom' | 'recommended'>('custom');
  const [recDurationH, setRecDurationH] = useState<number | undefined>(1);
  const [recDurationM, setRecDurationM] = useState<number | undefined>(0);

  // Nutrition States
  const [nutritionBackView, setNutritionBackView] = useState<ViewState>('entry');
  const [nutriAge, setNutriAge] = useState('');

  const [nutriHeight, setNutriHeight] = useState('');
  const [nutriWeight, setNutriWeight] = useState('');
  const [nutriGender, setNutriGender] = useState<'male' | 'female' | null>(null);
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile | null>(() => {
    try {
      const stored = localStorage.getItem('produtivity_nutrition_profile');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  // Step 2
  const [nutriObjective, setNutriObjective] = useState('');
  const [nutriActivityLevel, setNutriActivityLevel] = useState('');
  const [nutriWeeklyTrainings, setNutriWeeklyTrainings] = useState(3);
  const [nutriTrainingIntensity, setNutriTrainingIntensity] = useState('');
  const [nutriDesiredWeight, setNutriDesiredWeight] = useState('');
  const [nutriDeadline, setNutriDeadline] = useState('1');
  const [nutriDeadlineType, setNutriDeadlineType] = useState<'sem_meta' | 'dias' | 'meses' | 'anos'>('meses');
  // Step 3
  const [nutriHasRestriction, setNutriHasRestriction] = useState(false);
  const [nutriVegetarian, setNutriVegetarian] = useState(false);
  const [nutriIntolerant, setNutriIntolerant] = useState(false);
  const [nutriIntoleranceDesc, setNutriIntoleranceDesc] = useState('');
  const [nutriAllergies, setNutriAllergies] = useState(false);
  const [nutriAllergiesDesc, setNutriAllergiesDesc] = useState('');
  const [nutriDislikedFoods, setNutriDislikedFoods] = useState(false);
  const [nutriDislikedFoodsDesc, setNutriDislikedFoodsDesc] = useState('');
  const [nutriMonthlyBudget, setNutriMonthlyBudget] = useState('');
  const [nutriCulinaryPref, setNutriCulinaryPref] = useState('');
  const [nutriMealsPerDay, setNutriMealsPerDay] = useState(5);

  // Stats / Calendar Navigation States
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [chartViewMode, setChartViewMode] = useState<ChartViewMode>('days_of_week');
  const [chartSelectedWeek, setChartSelectedWeek] = useState(1); // 1 to 4

  // Stats Filters
  const [statGroup, setStatGroup] = useState<string>('');
  const [statLocal, setStatLocal] = useState<string>('');
  const [statEx, setStatEx] = useState<string>('');
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  // Calculator States
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcExpression, setCalcExpression] = useState<string[]>([]);
  const [calcWaitingForOperand, setCalcWaitingForOperand] = useState(false);

  // Percentage States
  const [percInput, setPercInput] = useState('0');
  const [percOfValue, setPercOfValue] = useState('0');
  const [percFinalValue, setPercFinalValue] = useState('0');
  const [percInitialValue, setPercInitialValue] = useState('0');

  // States para Gerenciamento da Biblioteca de Exercícios
  const [mgmtGroup, setMgmtGroup] = useState<string>('');
  const [mgmtLocal, setMgmtLocal] = useState<string>('');
  const [mgmtExercise, setMgmtExercise] = useState<string>('');
  const [mgmtType, setMgmtType] = useState<'isolados' | 'multi'>('isolados');
  const [exerciseToDelete, setExerciseToDelete] = useState<{ local: string, name: string } | null>(null);

  // States para Adicionar Exercício
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState('3');
  const [newExReps, setNewExReps] = useState('12');
  const [newExRest, setNewExRest] = useState('60');

  // Active Session States
  const [activeSessionWorkout, setActiveSessionWorkout] = useState<SavedWorkout | null>(null);
  const [currentExIdx, setCurrentExIdx] = useState(0);
  const [currentSetIdx, setCurrentSetIdx] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [totalRestTime, setTotalRestTime] = useState(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [weightsInput, setWeightsInput] = useState<Record<string, string>>({});
  // Finances Categories States
  const [financesCategories, setFinancesCategories] = useState<NoteCategory[]>([]);
  const [activeFinMode, setActiveFinMode] = useState<'income' | 'expense' | null>(null);
  const [finCatCreationTab, setFinCatCreationTab] = useState<'recommended' | 'custom'>('recommended');
  const [finSelectedRecommended, setFinSelectedRecommended] = useState<string | null>(null);
  const [finCatCustomName, setFinCatCustomName] = useState('');
  const [finCatSelectedColor, setFinCatSelectedColor] = useState(customColors[2]); // Blue as default
  const [finEditingCategory, setFinEditingCategory] = useState<NoteCategory | null>(null);
  const [finCatToDelete, setFinCatToDelete] = useState<NoteCategory | null>(null);
  const [finIncomeName, setFinIncomeName] = useState('');
  const [finIncomeValue, setFinIncomeValue] = useState('0');
  const [finIncomeEffort, setFinIncomeEffort] = useState('');
  const [finIncomeCanGrow, setFinIncomeCanGrow] = useState<boolean | null>(null);
  const [finIncomeRecurrence, setFinIncomeRecurrence] = useState<'fixo' | 'pontual'>('fixo');
  const [finIncomePeriod, setFinIncomePeriod] = useState('');
  const [incomeBackup, setIncomeBackup] = useState('0');
  const [finFormErrorMsg, setFinFormErrorMsg] = useState<string | null>(null);
  const [showFinIncomeSaveModal, setShowFinIncomeSaveModal] = useState(false);
  const [finIncomeSaveStep, setFinIncomeSaveStep] = useState<'initial' | 'picking' | 'confirm'>('initial');
  const [tempFinIncomeCatSelection, setTempFinIncomeCatSelection] = useState<NoteCategory | null>(null);

  // Expense form states
  const [finExpenseName, setFinExpenseName] = useState('');
  const [finExpenseValue, setFinExpenseValue] = useState('0');
  const [expenseBackup, setExpenseBackup] = useState('0');
  const [finExpenseEffort, setFinExpenseEffort] = useState('');
  const [finExpenseNecessity, setFinExpenseNecessity] = useState<'necessario' | 'impulso' | 'nao_sei' | null>(null);
  const [finExpenseMood, setFinExpenseMood] = useState('');
  const [finExpenseMoodOther, setFinExpenseMoodOther] = useState('');
  const [finExpenseCanGrow, setFinExpenseCanGrow] = useState<boolean | null>(null);
  const [finExpenseRecurrence, setFinExpenseRecurrence] = useState<'fixo' | 'pontual'>('fixo');
  const [finExpensePeriod, setFinExpensePeriod] = useState('');
  const [finExpenseFormErrorMsg, setFinExpenseFormErrorMsg] = useState<string | null>(null);
  const [showFinExpenseSaveModal, setShowFinExpenseSaveModal] = useState(false);
  const [finExpenseSaveStep, setFinExpenseSaveStep] = useState<'initial' | 'picking' | 'confirm'>('initial');
  const [tempFinExpenseCatSelection, setTempFinExpenseCatSelection] = useState<NoteCategory | null>(null);

  // Finance Records (saved incomes and expenses)
  const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
  const [selectedFinanceRecord, setSelectedFinanceRecord] = useState<FinanceRecord | null>(null);
  const [financeRecordToDelete, setFinanceRecordToDelete] = useState<FinanceRecord | null>(null);
  const [financeSortBy, setFinanceSortBy] = useState<'date_desc' | 'date_asc' | 'value_desc' | 'value_asc' | 'alphabetical' | 'category'>('date_desc');
  const [financeFilterPeriod, setFinanceFilterPeriod] = useState<'todos' | 'diario' | 'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('todos');
  const [financeFilterDate, setFinanceFilterDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [financeFilterWeek, setFinanceFilterWeek] = useState<string>('');
  const [financeFilterMonth, setFinanceFilterMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [financeFilterYear, setFinanceFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [financeFilterPeriodIdx, setFinanceFilterPeriodIdx] = useState<string>('1');
  const [financeDiarioYear, setFinanceDiarioYear] = useState<number>(new Date().getFullYear());
  const [financeDiarioMonth, setFinanceDiarioMonth] = useState<number>(new Date().getMonth() + 1);

  // Chart state for finances_expenses pie chart
  const [finChartPeriodMode, setFinChartPeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [finChartWeekIdx, setFinChartWeekIdx] = useState<number>(0);
  const [finChartPeriodIdx, setFinChartPeriodIdx] = useState<number>(1);
  const [finChartHiddenCats, setFinChartHiddenCats] = useState<Record<string, boolean>>({});
  const [finChartHoveredCat, setFinChartHoveredCat] = useState<string | null>(null);
  const [finChartShowComparison, setFinChartShowComparison] = useState<boolean>(false);
  const [finChartPieAnimKey, setFinChartPieAnimKey] = useState(0);

  // Bar Chart state
  const [finBarPeriodMode, setFinBarPeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [finBarYear, setFinBarYear] = useState<number>(new Date().getFullYear());
  const [finBarMonth, setFinBarMonth] = useState<number>(new Date().getMonth() + 1);
  const [finBarWeekIdx, setFinBarWeekIdx] = useState<number>(0);
  const [finBarPeriodIdx, setFinBarPeriodIdx] = useState<number>(1);
  const [finChartHoveredBar, setFinChartHoveredBar] = useState<number | null>(null);
  const [finChartBarAnimKey, setFinChartBarAnimKey] = useState(0);

  // Line Chart state
  const [finLinePeriodMode, setFinLinePeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [finLineYear, setFinLineYear] = useState<number>(new Date().getFullYear());
  const [finLineMonth, setFinLineMonth] = useState<number>(new Date().getMonth() + 1);
  const [finLineWeekIdx, setFinLineWeekIdx] = useState<number>(0);
  const [finLinePeriodIdx, setFinLinePeriodIdx] = useState<number>(1);
  const [finChartHoveredLine, setFinChartHoveredLine] = useState<number | null>(null);
  const [finChartLineAnimKey, setFinChartLineAnimKey] = useState(0);
  const [finMonthlyOverviewBack, setFinMonthlyOverviewBack] = useState<'finances_income' | 'finances_expenses'>('finances_expenses');

  // Income Chart states
  // Income Bar Chart states
  const [finIncBarPeriodMode, setFinIncBarPeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [finIncBarYear, setFinIncBarYear] = useState<number>(new Date().getFullYear());
  const [finIncBarMonth, setFinIncBarMonth] = useState<number>(new Date().getMonth() + 1);
  const [finIncBarWeekIdx, setFinIncBarWeekIdx] = useState<number>(0);
  const [finIncBarPeriodIdx, setFinIncBarPeriodIdx] = useState<number>(1);
  const [finIncChartHoveredBar, setFinIncChartHoveredBar] = useState<number | null>(null);
  const [finIncChartBarAnimKey, setFinIncChartBarAnimKey] = useState(0);
  // Income Line Chart states
  const [finIncLinePeriodMode, setFinIncLinePeriodMode] = useState<'semanal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'>('mensal');
  const [finIncLineYear, setFinIncLineYear] = useState<number>(new Date().getFullYear());
  const [finIncLineMonth, setFinIncLineMonth] = useState<number>(new Date().getMonth() + 1);
  const [finIncLineWeekIdx, setFinIncLineWeekIdx] = useState<number>(0);
  const [finIncLinePeriodIdx, setFinIncLinePeriodIdx] = useState<number>(1);
  const [finIncChartHoveredLine, setFinIncChartHoveredLine] = useState<number | null>(null);
  const [finIncChartLineAnimKey, setFinIncChartLineAnimKey] = useState(0);

  // Meu Mês - Receitas states
  const [finMonthIncomeValue, setFinMonthIncomeValue] = useState('');
  const [finMonthIncomeBackup, setFinMonthIncomeBackup] = useState('0');
  const [finMonthIncomePontualMeta, setFinMonthIncomePontualMeta] = useState('');
  const [finMonthIncomePontualMetaBackup, setFinMonthIncomePontualMetaBackup] = useState('0');
  const [finMonthIncomePontualType, setFinMonthIncomePontualType] = useState<'sem_aumento' | 'dias' | 'mes' | 'meses' | 'ano' | ''>('');
  const [finMonthIncomePontualAmount, setFinMonthIncomePontualAmount] = useState('1');
  const [finMonthIncomeDefinidaMeta, setFinMonthIncomeDefinidaMeta] = useState('');
  const [finMonthIncomeDefinidaMetaBackup, setFinMonthIncomeDefinidaMetaBackup] = useState('0');
  const [finMonthIncomeDefinidaType, setFinMonthIncomeDefinidaType] = useState<'sem_aumento' | 'dias' | 'mes' | 'meses' | 'ano' | ''>('');
  const [finMonthIncomeDefinidaAmount, setFinMonthIncomeDefinidaAmount] = useState('1');
  const [finIncCompareMode, setFinIncCompareMode] = useState(false);
  const [finExpCompareMode, setFinExpCompareMode] = useState(false);
  const [finIncMeuMesCompareMode, setFinIncMeuMesCompareMode] = useState(false);
  const [finExpMeuMesCompareMode, setFinExpMeuMesCompareMode] = useState(false);

  // Meu Mês - Despesas states
  const [finMonthExpenseValue, setFinMonthExpenseValue] = useState('');
  const [finMonthExpenseBackup, setFinMonthExpenseBackup] = useState('0');
  const [finMonthExpensePontualMeta, setFinMonthExpensePontualMeta] = useState('');
  const [finMonthExpensePontualMetaBackup, setFinMonthExpensePontualMetaBackup] = useState('0');
  const [finMonthExpensePontualType, setFinMonthExpensePontualType] = useState<'sem_aumento' | 'dias' | 'mes' | 'meses' | 'ano' | ''>('');
  const [finMonthExpensePontualAmount, setFinMonthExpensePontualAmount] = useState('1');
  const [finMonthExpenseDefinidaMeta, setFinMonthExpenseDefinidaMeta] = useState('');
  const [finMonthExpenseDefinidaMetaBackup, setFinMonthExpenseDefinidaMetaBackup] = useState('0');
  const [finMonthExpenseDefinidaType, setFinMonthExpenseDefinidaType] = useState<'sem_aumento' | 'dias' | 'mes' | 'meses' | 'ano' | ''>('');
  const [finMonthExpenseDefinidaAmount, setFinMonthExpenseDefinidaAmount] = useState('1');
  const [finMonthlyOverviewWarning, setFinMonthlyOverviewWarning] = useState<string | null>(null);
  const [finIncomeOnboarded, setFinIncomeOnboarded] = useState(false);
  const [finExpenseOnboarded, setFinExpenseOnboarded] = useState(false);
  const [finMonthlyOverviewReadOnly, setFinMonthlyOverviewReadOnly] = useState(false);
  const [finOnboardingLoaded, setFinOnboardingLoaded] = useState(false);

  // SavedAt dates for ranges
  const [finMonthIncomePontualSavedAt, setFinMonthIncomePontualSavedAt] = useState<string | null>(null);
  const [finMonthIncomeDefinidaSavedAt, setFinMonthIncomeDefinidaSavedAt] = useState<string | null>(null);
  const [finMonthExpensePontualSavedAt, setFinMonthExpensePontualSavedAt] = useState<string | null>(null);
  const [finMonthExpenseDefinidaSavedAt, setFinMonthExpenseDefinidaSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const savedFinCats = localStorage.getItem('finances_categories_v1');
    if (savedFinCats) setFinancesCategories(JSON.parse(savedFinCats));
    const savedRecords = localStorage.getItem('finances_records_v1');
    if (savedRecords) setFinanceRecords(JSON.parse(savedRecords));

    // Load monthly overview data
    const savedInc = localStorage.getItem('fin_monthly_income_data');
    if (savedInc) {
      const data = JSON.parse(savedInc);
      if (data.value) { setFinMonthIncomeValue(data.value); setFinMonthIncomeBackup(data.value); }
      if (data.pontualMeta) { setFinMonthIncomePontualMeta(data.pontualMeta); setFinMonthIncomePontualMetaBackup(data.pontualMeta); }
      if (data.pontualType) setFinMonthIncomePontualType(data.pontualType);
      if (data.pontualAmount) setFinMonthIncomePontualAmount(data.pontualAmount);
      if (data.pontualSavedAt) setFinMonthIncomePontualSavedAt(data.pontualSavedAt);
      if (data.definidaMeta) { setFinMonthIncomeDefinidaMeta(data.definidaMeta); setFinMonthIncomeDefinidaMetaBackup(data.definidaMeta); }
      if (data.definidaType) setFinMonthIncomeDefinidaType(data.definidaType);
      if (data.definidaAmount) setFinMonthIncomeDefinidaAmount(data.definidaAmount);
      if (data.definidaSavedAt) setFinMonthIncomeDefinidaSavedAt(data.definidaSavedAt);
    }
    const savedExp = localStorage.getItem('fin_monthly_expense_data');
    if (savedExp) {
      const data = JSON.parse(savedExp);
      if (data.value) { setFinMonthExpenseValue(data.value); setFinMonthExpenseBackup(data.value); }
      if (data.pontualMeta) { setFinMonthExpensePontualMeta(data.pontualMeta); setFinMonthExpensePontualMetaBackup(data.pontualMeta); }
      if (data.pontualType) setFinMonthExpensePontualType(data.pontualType);
      if (data.pontualAmount) setFinMonthExpensePontualAmount(data.pontualAmount);
      if (data.pontualSavedAt) setFinMonthExpensePontualSavedAt(data.pontualSavedAt);
      if (data.definidaMeta) { setFinMonthExpenseDefinidaMeta(data.definidaMeta); setFinMonthExpenseDefinidaMetaBackup(data.definidaMeta); }
      if (data.definidaType) setFinMonthExpenseDefinidaType(data.definidaType);
      if (data.definidaAmount) setFinMonthExpenseDefinidaAmount(data.definidaAmount);
      if (data.definidaSavedAt) setFinMonthExpenseDefinidaSavedAt(data.definidaSavedAt);
    }
    if (localStorage.getItem('fin_income_onboarded') === 'true') setFinIncomeOnboarded(true);
    if (localStorage.getItem('fin_expense_onboarded') === 'true') setFinExpenseOnboarded(true);
    setFinOnboardingLoaded(true);
  }, []);

  const saveFinanceRecords = (records: FinanceRecord[]) => {
    setFinanceRecords(records);
    localStorage.setItem('finances_records_v1', JSON.stringify(records));
  };

  const saveFinCategories = (newCats: NoteCategory[]) => {
    setFinancesCategories(newCats);
    localStorage.setItem('finances_categories_v1', JSON.stringify(newCats));
  };

  const resetFinIncomeForm = () => {
    setFinIncomeName('');
    setFinIncomeValue('0');
    setFinIncomeEffort('');
    setFinIncomeCanGrow(null);
    setFinIncomeRecurrence('fixo');
    setFinIncomePeriod('');
  };

  const resetFinExpenseForm = () => {
    setFinExpenseName('');
    setFinExpenseValue('0');
    setFinExpenseEffort('');
    setFinExpenseNecessity(null);
    setFinExpenseMood('');
    setFinExpenseMoodOther('');
    setFinExpenseCanGrow(null);
    setFinExpenseRecurrence('fixo');
    setFinExpensePeriod('');
  };

  const prevViewRef = useRef<ViewState>(view);
  useEffect(() => {
    const incomeFormViews = ['finances_income_form', 'finances_income_form_step2', 'finances_income_form_step3'];
    const expenseFormViews = ['finances_expense_form', 'finances_expense_form_step2'];
    const wasInIncomeForm = incomeFormViews.includes(prevViewRef.current);
    const isOutOfIncomeForm = !incomeFormViews.includes(view);
    const wasInExpenseForm = expenseFormViews.includes(prevViewRef.current);
    const isOutOfExpenseForm = !expenseFormViews.includes(view);

    if (wasInIncomeForm && isOutOfIncomeForm) resetFinIncomeForm();
    if (wasInExpenseForm && isOutOfExpenseForm) {
      resetFinExpenseForm();
      setFinExpenseFormErrorMsg(null);
      setShowFinExpenseSaveModal(false);
      setFinExpenseSaveStep('initial');
      setTempFinExpenseCatSelection(null);
    }
    setFinFormErrorMsg(null);
    setShowFinIncomeSaveModal(false);
    setFinIncomeSaveStep('initial');
    setTempFinIncomeCatSelection(null);
    prevViewRef.current = view;
  }, [view]);

  const financeIncomeRecs = [
    { name: 'Trabalho' },
    { name: 'Com internet' },
    { name: 'Mesada' },
    { name: 'Bico' },
    { name: 'Auxílio' },
    { name: 'Investimentos' },
  ];

  const financeExpenseRecs = [
    { name: 'Aluguel' },
    { name: 'Alimentação' },
    { name: 'Lazer' },
    { name: 'Transporte' },
    { name: 'Academia' },
    { name: 'Cartão de crédito' },
  ];

  const financeRecs = activeFinMode === 'income' ? financeIncomeRecs : financeExpenseRecs;

  const handleCreateFinCategory = () => {
    const name = finCatCreationTab === 'recommended' ? finSelectedRecommended : finCatCustomName;
    if (!name) return;

    const newCat: NoteCategory = {
      id: finEditingCategory?.id || Date.now().toString(),
      name: name,
      color: finCatSelectedColor,
      financeType: activeFinMode || undefined
    };

    if (finEditingCategory) {
      saveFinCategories(financesCategories.map(c => c.id === finEditingCategory.id ? newCat : c));
    } else {
      saveFinCategories([...financesCategories, newCat]);
    }

    setFinEditingCategory(null);
    setFinCatCustomName('');
    setView('finances_categories');
  };

  const timerRef = useRef<number | null>(null);

  // Toolbar States
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState(false);
  const [isMarkersMenuOpen, setIsMarkersMenuOpen] = useState(false);
  const [activeBold, setActiveBold] = useState(false);
  const [activeAlign, setActiveAlign] = useState('justifyLeft');
  const [activeColor, setActiveColor] = useState('#000000');
  const [activeFont, setActiveFont] = useState('Arial');
  const [activeSize, setActiveSize] = useState('3');

  const [categoryToDelete, setCategoryToDelete] = useState<NoteCategory | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLDivElement>(null);

  // Oratoria States
  const fontMenuRef = useRef<HTMLDivElement>(null);
  const fontSizeMenuRef = useRef<HTMLDivElement>(null);
  const markersMenuRef = useRef<HTMLDivElement>(null);

  // FIXED: Corrected `useRef` initialization.
  const lastInitializedNoteIdRef = useRef<string | null>(null);

  // --- LIFTED HOOKS (Sempre chamados no topo para evitar erro #310) ---
  const exerciseHistory = useMemo(() => {
    if (!statEx) return [];

    // Base data: Use ALL data regardless of visibility for stats
    let rawData = [...gymHistory].filter(entry => entry.weights && entry.weights[statEx]);

    if (chartViewMode === 'years') {
      const yearlyData: Record<number, { sum: number, count: number }> = {};
      rawData.forEach(entry => {
        const [d, m, y] = entry.date.split('/').map(Number);
        if (!yearlyData[y]) yearlyData[y] = { sum: 0, count: 0 };
        const w = parseFloat(entry.weights[statEx]) || 0;
        yearlyData[y].sum += w;
        yearlyData[y].count += 1;
      });

      return Object.entries(yearlyData)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([year, data]) => ({
          date: year.toString(), // Convert to string for consistency
          label: year.toString(),
          weight: data.sum / data.count,
          fullDate: year.toString()
        }));
    }
    else if (chartViewMode === 'months_of_year') {
      const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const monthlyData: Record<number, { sum: number, count: number }> = {};

      rawData.filter(e => {
        const y = parseInt(e.date.split('/')[2]);
        return y === calendarYear;
      }).forEach(entry => {
        const [d, m, y] = entry.date.split('/').map(Number);
        const mIdx = m - 1; // 0-11
        if (!monthlyData[mIdx]) monthlyData[mIdx] = { sum: 0, count: 0 };
        const w = parseFloat(entry.weights[statEx]) || 0;
        monthlyData[mIdx].sum += w;
        monthlyData[mIdx].count += 1;
      });

      return Object.entries(monthlyData)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([mIdx, data]) => ({
          date: monthNames[Number(mIdx)],
          label: monthNames[Number(mIdx)],
          weight: data.sum / data.count,
          fullDate: `${monthNames[Number(mIdx)]} ${calendarYear}`
        }));
    }
    else {
      // Filter for current selected month/year for detail views
      rawData = rawData.filter(entry => {
        const [d, m, y] = entry.date.split('/').map(Number);
        return m === calendarMonth + 1 && y === calendarYear;
      }).sort((a, b) => {
        const [da, ma, ya] = a.date.split('/').map(Number);
        const [db, mb, yb] = b.date.split('/').map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });

      if (chartViewMode === 'days_of_month') {
        return rawData.map(entry => ({
          date: entry.date.split('/').slice(0, 2).join('/'),
          fullDate: entry.date,
          weight: parseFloat(entry.weights[statEx]) || 0
        }));
      }
      else if (chartViewMode === 'weeks_of_month') {
        const weeklyData: Record<number, { sum: number, count: number }> = {};
        rawData.forEach(entry => {
          const day = parseInt(entry.date.split('/')[0]);
          let weekNum = Math.ceil(day / 7);
          if (weekNum > 4) weekNum = 4;
          const w = parseFloat(entry.weights[statEx]) || 0;
          if (!weeklyData[weekNum]) weeklyData[weekNum] = { sum: 0, count: 0 };
          weeklyData[weekNum].sum += w;
          weeklyData[weekNum].count += 1;
        });

        return Object.entries(weeklyData)
          .sort((a, b) => Number(a[0]) - Number(b[0]))
          .map(([week, data]) => ({
            date: `Sem ${week}`,
            label: `Semana ${week}`,
            weight: data.sum / data.count,
            fullDate: `Semana ${week}`
          }));
      }
      else if (chartViewMode === 'days_of_week') {
        let startDay, endDay;
        if (chartSelectedWeek === 4) {
          startDay = 22;
          endDay = 31;
        } else {
          startDay = (chartSelectedWeek - 1) * 7 + 1;
          endDay = chartSelectedWeek * 7;
        }
        return rawData
          .filter(entry => {
            const day = parseInt(entry.date.split('/')[0]);
            return day >= startDay && day <= endDay;
          })
          .map(entry => {
            const [d, m, y] = entry.date.split('/').map(Number);
            const dateObj = new Date(y, m - 1, d);
            const dayIndex = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1;
            const dayName = weekDays[dayIndex];
            return {
              date: dayName,
              label: entry.date,
              fullDate: entry.date,
              weight: parseFloat(entry.weights[statEx]) || 0
            };
          });
      }
    }
    return [];
  }, [gymHistory, statEx, calendarMonth, calendarYear, chartViewMode, chartSelectedWeek]);

  const comparisonData = useMemo(() => {
    if (!statEx || gymHistory.length === 0) return null;
    if (chartViewMode === 'years') return null; // Não solicitado/definido

    const getAvg = (entries: WorkoutHistoryEntry[]) => {
      if (entries.length === 0) return 0;
      const sum = entries.reduce((acc, curr) => acc + (parseFloat(curr.weights[statEx] || '0') || 0), 0);
      return sum / entries.length;
    };

    const currentEntries = gymHistory.filter(h => h.weights && h.weights[statEx]);
    let currentVal = 0;
    let previousVal = 0;
    let label = '';

    if (chartViewMode === 'days_of_week') {
      label = 'Comparação com a semana anterior';
      // Definir start/end da semana atual
      let startDay = 1; let endDay = 7;
      if (chartSelectedWeek === 2) { startDay = 8; endDay = 14; }
      else if (chartSelectedWeek === 3) { startDay = 15; endDay = 21; }
      else if (chartSelectedWeek === 4) { startDay = 22; endDay = 31; }

      const currentPeriod = currentEntries.filter(e => {
        const [d, m, y] = e.date.split('/').map(Number);
        return m === calendarMonth + 1 && y === calendarYear && d >= startDay && d <= endDay;
      });
      currentVal = getAvg(currentPeriod);

      // Definir semana anterior
      let prevMonth = calendarMonth;
      let prevYear = calendarYear;
      let prevStart = 0; let prevEnd = 0;

      if (chartSelectedWeek === 1) {
        prevMonth = calendarMonth - 1;
        if (prevMonth < 0) { prevMonth = 11; prevYear--; }
        prevStart = 22; prevEnd = 31; // Assume semana 4 do mês anterior
      } else {
        if (chartSelectedWeek === 2) { prevStart = 1; prevEnd = 7; }
        else if (chartSelectedWeek === 3) { prevStart = 8; prevEnd = 14; }
        else if (chartSelectedWeek === 4) { prevStart = 15; prevEnd = 21; }
      }

      const prevPeriod = currentEntries.filter(e => {
        const [d, m, y] = e.date.split('/').map(Number);
        return m === prevMonth + 1 && y === prevYear && d >= prevStart && d <= prevEnd;
      });
      previousVal = getAvg(prevPeriod);

    } else if (chartViewMode === 'days_of_month' || chartViewMode === 'weeks_of_month') {
      label = 'Comparação com o mês anterior';
      const currentPeriod = currentEntries.filter(e => {
        const [d, m, y] = e.date.split('/').map(Number);
        return m === calendarMonth + 1 && y === calendarYear;
      });
      currentVal = getAvg(currentPeriod);

      let prevMonth = calendarMonth - 1;
      let prevYear = calendarYear;
      if (prevMonth < 0) { prevMonth = 11; prevYear--; }

      const prevPeriod = currentEntries.filter(e => {
        const [d, m, y] = e.date.split('/').map(Number);
        return m === prevMonth + 1 && y === prevYear;
      });
      previousVal = getAvg(prevPeriod);

    } else if (chartViewMode === 'months_of_year') {
      label = 'Comparação com o ano anterior';
      const currentPeriod = currentEntries.filter(e => {
        const [d, m, y] = e.date.split('/').map(Number);
        return y === calendarYear;
      });
      currentVal = getAvg(currentPeriod);

      const prevPeriod = currentEntries.filter(e => {
        const [d, m, y] = e.date.split('/').map(Number);
        return y === calendarYear - 1;
      });
      previousVal = getAvg(prevPeriod);
    }

    if (previousVal === 0) return { val: 0, label, noData: true };

    const diff = currentVal - previousVal;
    const percent = (diff / previousVal) * 100;
    return { val: percent, label, noData: false };

  }, [gymHistory, statEx, calendarMonth, calendarYear, chartViewMode, chartSelectedWeek]);

  const metrics = useMemo(() => {
    if (exerciseHistory.length <= 1) return null;
    const latest = exerciseHistory[exerciseHistory.length - 1].weight;
    const earliest = exerciseHistory[0].weight;
    const change = earliest === 0 ? 0 : ((latest - earliest) / earliest) * 100;
    return { latest, change };
  }, [exerciseHistory]);

  const workoutDaysSet = useMemo(() => {
    const set = new Set<string>();
    gymHistory.forEach(entry => {
      if (entry.date) set.add(entry.date);
    });
    return set;
  }, [gymHistory]);

  const selectedDayInfo = useMemo(() => {
    if (!selectedCalendarDate) return null;
    const entry = statEx ? gymHistory.find(h => h.date === selectedCalendarDate && h.weights && h.weights[statEx]) : null;
    const hasWorkoutAtDate = workoutDaysSet.has(selectedCalendarDate);
    return {
      date: selectedCalendarDate,
      weight: entry ? entry.weights[statEx] : '',
      hasWorkoutAtDate
    };
  }, [selectedCalendarDate, statEx, gymHistory, workoutDaysSet]);
  // --- FIM DOS LIFTED HOOKS ---

  useEffect(() => {
    const storedDb = localStorage.getItem('produtivity_others_gym_db');
    if (storedDb) setGymDb(JSON.parse(storedDb));

    const savedNotes = localStorage.getItem('produtivity_others_notes_list');
    if (savedNotes) setNotes(JSON.parse(savedNotes));
    const savedCats = localStorage.getItem('produtivity_others_notes_cats');
    if (savedCats) setCategories(JSON.parse(savedCats));
    const lastMotiv = localStorage.getItem('produtivity_others_motivation');
    if (lastMotiv) setMotivation(lastMotiv);
    const savedWorkoutsData = localStorage.getItem('produtivity_others_gym_workouts');
    if (savedWorkoutsData) setSavedWorkouts(JSON.parse(savedWorkoutsData));
    const savedHistory = localStorage.getItem('produtivity_others_gym_history');
    if (savedHistory) setGymHistory(JSON.parse(savedHistory));

    const savedNutri = localStorage.getItem('produtivity_nutrition_profile');
    if (savedNutri) {
      const profile = JSON.parse(savedNutri);
      setNutritionProfile(profile);
      setNutriAge(profile.age || '');
      setNutriHeight(profile.height || '');
      setNutriWeight(profile.weight || '');
      setNutriGender(profile.gender || null);
      setNutriObjective(profile.objective || '');
      setNutriActivityLevel(profile.activityLevel || '');
      setNutriWeeklyTrainings(profile.weeklyTrainings || 3);
      setNutriTrainingIntensity(profile.trainingIntensity || '');
      setNutriDesiredWeight(profile.desiredWeight || '');
      setNutriDeadline(profile.realisticDeadline || '');
      setNutriHasRestriction(profile.hasRestriction || false);
      if (profile.restrictions) {
        setNutriVegetarian(profile.restrictions.vegetarian || false);
        setNutriIntolerant(profile.restrictions.intolerant || false);
        setNutriIntoleranceDesc(profile.restrictions.intoleranceDesc || '');
        setNutriAllergies(profile.restrictions.allergies || false);
        setNutriAllergiesDesc(profile.restrictions.allergiesDesc || '');
        setNutriDislikedFoods(profile.restrictions.dislikedFoods || false);
        setNutriDislikedFoodsDesc(profile.restrictions.dislikedFoodsDesc || '');
      }
      setNutriMonthlyBudget(profile.monthlyBudget || '');
      setNutriCulinaryPref(profile.culinaryPreference || '');
      setNutriMealsPerDay(profile.mealsPerDay || 5);
    }
  }, []);

  const saveGymDb = (updated: Record<string, GroupedExercises>) => {
    setGymDb(updated);
    localStorage.setItem('produtivity_others_gym_db', JSON.stringify(updated));
  };

  useEffect(() => {
    if (view === 'editor') {
      const noteId = currentNote.id || 'new_note';
      if (lastInitializedNoteIdRef.current !== noteId) {
        if (editorRef.current) {
          editorRef.current.innerHTML = sanitizeHtml(currentNote.content || '');
        }
        if (titleInputRef.current) {
          titleInputRef.current.innerHTML = sanitizeHtml(currentNote.title || '');
        }
        const timer = setTimeout(() => {
          if (titleInputRef.current) titleInputRef.current.focus();
        }, 100);
        lastInitializedNoteIdRef.current = noteId;
        return () => clearTimeout(timer);
      }
    } else {
      lastInitializedNoteIdRef.current = null;
    }
  }, [view, currentNote.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (fontMenuRef.current && !fontMenuRef.current.contains(target)) setIsFontMenuOpen(false);
      if (fontSizeMenuRef.current && !fontSizeMenuRef.current.contains(target)) setIsFontSizeMenuOpen(false);
      if (markersMenuRef.current && !markersMenuRef.current.contains(target)) setIsMarkersMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Timer Logic
  useEffect(() => {
    if (isResting && timeLeft > 0 && !isTimerPaused) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            setIsResting(false);
            playAlertSound();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isResting, timeLeft, isTimerPaused]);

  const playAlertSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextClass();
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(0.5, context.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, context.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.5);
    } catch (e) { console.warn(e); }
  };

  const isSameColor = (color1: string, color2: string) => {
    if (!color1 || !color2) return false;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return color1.toLowerCase() === color2.toLowerCase();

    ctx.fillStyle = color1;
    const c1 = ctx.fillStyle;
    ctx.fillStyle = color2;
    const c2 = ctx.fillStyle;
    return c1 === c2;
  };

  const updateToolbarState = () => {
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
  };

  const callWithRetry = async (fn: () => Promise<any>, maxRetries = 3) => {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        const isOverloaded = error.message?.includes('503') || error.message?.includes('overloaded') || error.status === 'UNAVAILABLE';
        if (i === maxRetries - 1 || !isOverloaded) throw error;
        const waitTime = 1000 * Math.pow(2, i);
        setErrorMsg(`Servidor instável. Tentando novamente (${i + 1}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, waitTime));
        setErrorMsg(null);
      }
    }
  };

  const generateMotivation = async () => {
    setIsLoadingMotivation(true);
    setErrorMsg(null);
    try {
      const { data, error } = await generateAIResponse({ action: 'generate_motivation' });
      if (error) throw error;
      const text = data.content || "Sua disciplina de hoje é o sucesso de amanhã.";
      setMotivation(text);
      localStorage.setItem('produtivity_others_motivation', text);
    } catch (error) {
      console.error(error);
      setMotivation("O esforço supera o talento quando o talento não se esforça.");
    } finally {
      setIsLoadingMotivation(false);
    }
  };

  const handleAddNote = () => {
    const now = new Date().toLocaleString('pt-BR');
    setCurrentNote({ id: Date.now().toString(), title: '', content: '', createdAt: now, lastModified: now });
    setView('editor');
    setActiveBold(false);
    setActiveAlign('justifyLeft');
    setActiveColor('#000000');
    setActiveFont('Arial');
    setActiveSize('3');
  };

  const handleSaveAction = () => {
    const htmlContent = sanitizeHtml(editorRef.current?.innerHTML || '');
    const htmlTitle = sanitizeHtml(titleInputRef.current?.innerHTML || '');
    const updatedNote = { ...currentNote, content: htmlContent, title: htmlTitle };
    setCurrentNote(updatedNote);
    const isEditing = notes.some(n => n.id === currentNote.id);
    if (isEditing) finalizeSaveNote(categories.find(c => c.id === currentNote.categoryId), htmlContent, htmlTitle);
    else { setSaveStep('initial'); setTempCatSelection(null); setShowSaveModal(true); }
  };

  const finalizeSaveNote = (cat?: NoteCategory, overridenContent?: string, overridenTitle?: string) => {
    const noteToSave: Note = {
      ...(currentNote as Note),
      content: overridenContent !== undefined ? overridenContent : sanitizeHtml(editorRef.current?.innerHTML || ''),
      title: overridenTitle !== undefined ? overridenTitle : sanitizeHtml(titleInputRef.current?.innerHTML || ''),
      categoryId: cat?.id,
      categoryName: cat?.name || 'Sem categoria',
      categoryColor: cat?.color || '#f1f5f9',
      lastModified: new Date().toLocaleString('pt-BR')
    };
    const existsIndex = notes.findIndex(n => n.id === noteToSave.id);
    if (existsIndex !== -1) {
      const updatedNotes = [...notes];
      updatedNotes[existsIndex] = noteToSave;
      saveNotes(updatedNotes);
    } else saveNotes([noteToSave, ...notes]);
    setShowSaveModal(false);
    setView('list');
  };

  const saveNotes = (updated: Note[]) => {
    setNotes(updated);
    localStorage.setItem('produtivity_others_notes_list', JSON.stringify(updated));
  };

  const saveCategories = (updated: NoteCategory[]) => {
    setCategories(updated);
    localStorage.setItem('produtivity_others_notes_cats', JSON.stringify(updated));
  };

  const execCommand = (command: string, value: string | undefined = undefined) => {
    const activeEl = document.activeElement;
    const isEditingTitle = titleInputRef.current?.contains(activeEl);

    document.execCommand(command, false, value);

    if (!isEditingTitle && editorRef.current && !editorRef.current.contains(activeEl)) {
      editorRef.current.focus();
    }
    updateToolbarState();
  };

  const insertMarker = (symbol: string) => {
    const activeEl = document.activeElement;
    const isEditingTitle = titleInputRef.current?.contains(activeEl);
    const target = isEditingTitle ? titleInputRef.current : editorRef.current;

    if (target) {
      target.focus();
      document.execCommand('insertText', false, symbol + ' ');
      updateToolbarState();
      setIsMarkersMenuOpen(false);
    }
  };

  const handleTitleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.innerText.trim() === "") el.innerHTML = "";
    updateToolbarState();
  };

  const getSortedNotes = () => {
    return [...notes].sort((a, b) => {
      switch (sortBy) {
        case 'lastModified': return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        case 'createdAt': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'category': return (a.categoryName || '').localeCompare(b.categoryName || '');
        case 'alphabetical': return (a.title || 'Sem título').localeCompare(b.title || 'Sem título');
        default: return 0;
      }
    });
  };

  const toggleMuscle = (muscle: string) => {
    if (selectedMuscles.includes(muscle)) {
      setSelectedMuscles(prev => prev.filter(m => m !== muscle));
      // Limpa subgrupos se o grupo principal for removido
      setSelectedSubMuscles(prev => {
        const next = { ...prev };
        delete next[muscle];
        return next;
      });
    } else if (selectedMuscles.length < 3) {
      setSelectedMuscles(prev => [...prev, muscle]);
    }
  };

  const toggleSubMuscle = (group: string, sub: string) => {
    setSelectedSubMuscles(prev => {
      const currentList = prev[group] || [];
      if (currentList.includes(sub)) {
        return { ...prev, [group]: currentList.filter(s => s !== sub) };
      } else {
        return { ...prev, [group]: [...currentList, sub] };
      }
    });
  };

  const toggleExercise = (subGroup: string, exercise: string) => {
    setSelectedExercises(prev => {
      const subGroupData = prev[subGroup] || {};
      if (subGroupData[exercise]) {
        const nextSubGroup = { ...subGroupData };
        delete nextSubGroup[exercise];
        return { ...prev, [subGroup]: nextSubGroup };
      } else {
        return {
          ...prev,
          [subGroup]: {
            ...subGroupData,
            [exercise]: { sets: '', reps: '', timePerSet: '', rest: '' }
          }
        };
      }
    });
  };

  const updateExerciseSettings = (subGroup: string, exercise: string, field: keyof ExerciseDetails, value: string) => {
    // Force numbers only
    if (!/^\d*$/.test(value)) return;

    setSelectedExercises(prev => {
      const subGroupData = prev[subGroup] || {};
      const exerciseData = subGroupData[exercise] || { sets: '', reps: '', timePerSet: '', rest: '' };
      return {
        ...prev,
        [subGroup]: {
          ...subGroupData,
          [exercise]: { ...exerciseData, [field]: value }
        }
      };
    });
  };

  const handleSaveWorkout = () => {
    if (workoutDaysToSave.length === 0) return;

    const newWorkout: SavedWorkout = {
      id: Date.now().toString(),
      day: workoutDaysToSave.join(' / '),
      muscles: selectedMuscles,
      exercises: selectedExercises,
      createdAt: new Date().toLocaleString()
    };

    const updated = [...savedWorkouts, newWorkout];
    setSavedWorkouts(updated);
    localStorage.setItem('produtivity_others_gym_workouts', JSON.stringify(updated));

    // Reseta estados de construção
    setSelectedMuscles([]);
    setSelectedSubMuscles({});
    setSelectedExercises({});
    setWorkoutDaysToSave([]);
    setView('gym_now');
    setSuccessMsg("Treino salvo com sucesso!");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const generateRecommendedWorkout = () => {
    // 1. Calculate target duration in seconds
    const targetDurationInSeconds = ((recDurationH || 0) * 3600) + ((recDurationM || 0) * 60);

    // If no duration is set, fallback to a short workout
    if (targetDurationInSeconds <= 0) {
      setErrorMsg("Por favor, defina uma duração de treino válida.");
      setTimeout(() => setErrorMsg(null), 3000);
      setView('gym_duration');
      return;
    }

    // 2. Create a pool of all possible exercises from selected muscles
    const exercisePool: { group: string, subGroup: string, exercise: ExerciseInfo, type: 'multi' | 'isolados' }[] = [];
    selectedMuscles.forEach(muscle => {
      const subs = muscleSubGroups[muscle] || [];
      subs.forEach(sub => {
        const dbEntry = gymDb[sub];
        if (dbEntry) {
          dbEntry.multi.forEach(ex => exercisePool.push({ group: muscle, subGroup: sub, exercise: ex, type: 'multi' }));
          dbEntry.isolados.forEach(ex => exercisePool.push({ group: muscle, subGroup: sub, exercise: ex, type: 'isolados' }));
        }
      });
    });

    if (exercisePool.length === 0) {
      setErrorMsg("Não foi possível encontrar exercícios para os grupos musculares selecionados.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    // Shuffle the pool for variety
    exercisePool.sort(() => 0.5 - Math.random());

    // Prioritize multi-joint exercises for the core of the workout
    exercisePool.sort((a, b) => (a.type === 'multi' ? -1 : 1));

    // 3. Iteratively add exercises until target duration is met
    const generatedExercises: Record<string, Record<string, ExerciseDetails>> = {};
    const subMuscleSelection: Record<string, string[]> = {};
    let currentDuration = 0;
    const addedExercises = new Set<string>(); // To avoid duplicates

    let poolIndex = 0;
    while (currentDuration < targetDurationInSeconds && addedExercises.size < exercisePool.length) {
      const item = exercisePool[poolIndex % exercisePool.length];
      poolIndex++;

      if (addedExercises.has(item.exercise.name)) {
        continue; // Skip if already added
      }

      const details: ExerciseDetails = {
        sets: item.exercise.recs.sets.split('-')[0] || '3',
        reps: item.exercise.recs.reps.split('-')[0] || '10',
        timePerSet: '45', // Keep default estimate for execution time per set
        rest: item.exercise.recs.rest.replace('s', '').split('-')[0] || '60',
      };

      const exerciseTime = calculateExerciseTime(details, item.exercise.recs.isTimeBased);

      // Add the exercise if it doesn't grossly overshoot the time
      // Or if it's the very first exercise
      if (currentDuration === 0 || (currentDuration + exerciseTime < targetDurationInSeconds * 1.2)) {
        // Add to selections
        if (!subMuscleSelection[item.group]) subMuscleSelection[item.group] = [];
        if (!subMuscleSelection[item.group].includes(item.subGroup)) subMuscleSelection[item.group].push(item.subGroup);

        if (!generatedExercises[item.subGroup]) generatedExercises[item.subGroup] = {};
        generatedExercises[item.subGroup][item.exercise.name] = details;

        // Update state
        currentDuration += exerciseTime;
        addedExercises.add(item.exercise.name);
      }

      // Break if we've cycled through the whole pool and can't add more without overshooting
      if (poolIndex > exercisePool.length * 2) {
        break;
      }
    }

    // If somehow no exercises were added, show an error.
    if (Object.keys(generatedExercises).length === 0) {
      setErrorMsg("Não foi possível gerar um treino com a duração especificada. Tente uma duração maior.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    // 4. Set state and move to next view
    setSelectedSubMuscles(subMuscleSelection);
    setSelectedExercises(generatedExercises);
    setView('gym_save_day');
  };

  const deleteWorkout = (id: string) => {
    const updated = savedWorkouts.filter(w => w.id !== id);
    setSavedWorkouts(updated);
    localStorage.setItem('produtivity_others_gym_workouts', JSON.stringify(updated));
    setWorkoutToDelete(null);
  };

  const toggleWorkoutDaySelection = (day: string) => {
    // Se o dia já tem treino salvo, não permitir selecionar
    if (savedWorkouts.some(w => w.day.includes(day))) return;

    setWorkoutDaysToSave(prev => {
      if (prev.includes(day)) return prev.filter(d => d !== day);
      if (prev.length < 3) return [...prev, day];
      return prev;
    });
  };

  // Funções de Cálculo de Tempo de Academia
  const parseValue = (val: string): number => {
    const num = parseInt(val.replace(/\D/g, ''));
    return isNaN(num) ? 0 : num;
  };

  const formatSeconds = (totalSeconds: number): string => {
    if (totalSeconds <= 0) return '0 s';
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${secs} s`;
    if (secs === 0) return `${mins} min`;
    return `${mins} min e ${secs} s`;
  };

  const calculateExerciseTime = (details: ExerciseDetails, isTimeBased: boolean = false) => {
    const S = parseValue(details.sets);
    const timeInSet = parseValue(details.timePerSet);
    const D = parseValue(details.rest);

    if (S <= 0) return 0;

    // Execução: Séries x Tempo por série informado
    const executionTotal = S * timeInSet;

    // Descanso ocorre ENTRE séries (S-1)
    const restTotal = (S > 1 ? S - 1 : 0) * D;

    return executionTotal + restTotal;
  };

  const getTotalWorkoutTime = (workoutExercises?: Record<string, Record<string, ExerciseDetails>>) => {
    let total = 0;
    const targetExercises = workoutExercises || selectedExercises;
    Object.entries(targetExercises).forEach(([subName, exercises]) => {
      Object.entries(exercises).forEach(([exName, details]) => {
        const info = gymDb[subName]?.isolados.find(e => e.name === exName) ||
          gymDb[subName]?.multi.find(e => e.name === exName);
        total += calculateExerciseTime(details, info?.recs.isTimeBased);
      });
    });
    return total;
  };

  // Active Session Handlers
  const handleStartWorkout = (workout: SavedWorkout) => {
    // 1. Validar Dia da Semana
    const todayIndex = new Date().getDay();
    const todayName = weekDays[todayIndex === 0 ? 6 : todayIndex - 1]; // Ajuste para array 0-6 (Seg-Dom)

    if (!workout.day.includes(todayName)) {
      setErrorMsg(`Hoje é ${todayName}, mas o dia escolhido foi ${workout.day}. Não vou poder iniciar o treino.`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    // 2. Validar se já treinou HOJE este mesmo treino
    const todayDate = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hasTrainedToday = gymHistory.some(h => h.workoutId === workout.id && h.date === todayDate && h.visible !== false);

    if (hasTrainedToday) {
      setErrorMsg("Você só pode realizar este treino uma vez por dia nesta semana.");
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    startActiveSession(workout);
  };

  const startActiveSession = (workout: SavedWorkout) => {
    setActiveSessionWorkout(workout);
    setCurrentExIdx(0);
    setCurrentSetIdx(0);
    setIsResting(false);
    setIsTimerPaused(false);
    setWeightsInput({});
    setView('gym_active_session');
  };

  const exitImmersiveView = (toView: ViewState) => {
    setView(toView);
  };

  const getFlattenedExercises = (workout: SavedWorkout) => {
    const list: { name: string; details: ExerciseDetails; subGroup: string }[] = [];
    Object.entries(workout.exercises).forEach(([subName, exercises]) => {
      Object.entries(exercises).forEach(([exName, details]) => {
        list.push({ name: exName, details, subGroup: subName });
      });
    });
    return list;
  };

  const handleSetCompletion = () => {
    if (!activeSessionWorkout) return;
    const flatEx = getFlattenedExercises(activeSessionWorkout);
    const currentEx = flatEx[currentExIdx];
    const totalSets = parseValue(currentEx.details.sets);
    const restSecs = parseValue(currentEx.details.rest);

    if (currentSetIdx < totalSets - 1) {
      // Vai para o descanso
      setTotalRestTime(restSecs);
      setTimeLeft(restSecs);
      setIsResting(true);
      setIsTimerPaused(true); // O cronômetro NÃO deve iniciar sozinho
      setCurrentSetIdx(prev => prev + 1);
    } else {
      // Finalizou o exercício
      if (currentExIdx < flatEx.length - 1) {
        setCurrentExIdx(prev => prev + 1);
        setCurrentSetIdx(0);
        setIsResting(false);
      } else {
        // Finalizou o treino todo
        setView('gym_weights');
      }
    }
  };

  const saveHistory = () => {
    if (!activeSessionWorkout) return;
    const now = new Date();
    // Formatação robusta de data DD/MM/YYYY
    const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Extract sub-muscles (Locals) for persistent display
    const subMusclesList = Object.keys(activeSessionWorkout.exercises);

    const entry: WorkoutHistoryEntry = {
      id: Date.now().toString(),
      workoutId: activeSessionWorkout.id,
      day: activeSessionWorkout.day,
      muscles: activeSessionWorkout.muscles,
      subMuscles: subMusclesList,
      date: dateStr,
      weights: weightsInput,
      visible: true
    };
    const updated = [entry, ...gymHistory];
    setGymHistory(updated);
    localStorage.setItem('produtivity_others_gym_history', JSON.stringify(updated));
    setSuccessMsg("Treino concluído e salvo!");
    setTimeout(() => setSuccessMsg(null), 3000);
    exitImmersiveView('gym_menu');
  };

  // Funções de Gerenciamento da Biblioteca de Exercícios
  const handleAddExerciseToLibrary = () => {
    if (!mgmtGroup || !mgmtLocal || !newExName.trim()) {
      setErrorMsg("Preencha todos os campos obrigatórios.");
      return;
    }

    const updatedDb = { ...gymDb };
    if (!updatedDb[mgmtLocal]) {
      updatedDb[mgmtLocal] = { isolados: [], multi: [] };
    }

    const newEx: ExerciseInfo = {
      name: newExName,
      recs: {
        sets: newExSets,
        reps: newExReps,
        rest: newExRest + 's'
      }
    };

    updatedDb[mgmtLocal][mgmtType].push(newEx);
    saveGymDb(updatedDb);
    setSuccessMsg("Exercício adicionado à biblioteca!");
    setNewExName('');
    setView('gym_manage');
  };

  const handleDeleteExerciseFromLibrary = () => {
    if (!exerciseToDelete) return;
    const { local, name } = exerciseToDelete;

    const updatedDb = { ...gymDb };
    const localData = updatedDb[local];
    if (!localData) return;

    localData.isolados = localData.isolados.filter(ex => ex.name !== name);
    localData.multi = localData.multi.filter(ex => ex.name !== name);

    saveGymDb(updatedDb);
    setMgmtExercise('');
    setExerciseToDelete(null);
    setSuccessMsg("Exercício removido da biblioteca.");
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Calculator Logic
  const inputCalcDigit = (digit: string) => {
    if (calcWaitingForOperand) {
      setCalcDisplay(digit);
      setCalcWaitingForOperand(false);
    } else {
      setCalcDisplay(calcDisplay === '0' ? digit : calcDisplay + digit);
    }
  };

  const clearCalc = () => {
    setCalcDisplay('0');
    setCalcExpression([]);
    setCalcWaitingForOperand(false);
  };

  const performCalcOperation = (nextOperator: string) => {
    const termCount = calcExpression.filter(item => !['+', '-', '*', '/'].includes(item)).length;

    if (termCount >= 100 && !calcWaitingForOperand) {
      setErrorMsg("Limite de 100 termos atingido!");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    const val = calcDisplay;
    setCalcExpression([...calcExpression, val, nextOperator]);
    setCalcWaitingForOperand(true);
  };

  const calculateCalcResult = () => {
    if (calcExpression.length === 0) return;

    const finalExpr = [...calcExpression, calcDisplay];
    let result = parseFloat(finalExpr[0]);

    for (let i = 1; i < finalExpr.length; i += 2) {
      const op = finalExpr[i];
      const nextVal = parseFloat(finalExpr[i + 1]);
      if (op === '+') result += nextVal;
      else if (op === '-') result -= nextVal;
      else if (op === '*') result *= nextVal;
      else if (op === '/') result /= nextVal;
    }

    setCalcDisplay(String(result));
    setCalcExpression([]);
    setCalcWaitingForOperand(true);
  };

  const renderCalculator = () => {
    return (
      <div className="animate-fadeIn max-w-sm mx-auto flex flex-col items-center">
        <BackButton to="entry" />
        <div className="w-full">
          {/* Display da Calculadora */}
          <div className="bg-white p-6 mb-8 text-right overflow-hidden rounded-3xl border-2 border-slate-100 shadow-xl relative min-h-[140px] flex flex-col justify-center">
            <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest h-6 overflow-hidden whitespace-nowrap text-ellipsis px-1">
              {calcExpression.join(' ')}
            </div>
            <div className="text-5xl font-black text-slate-800 truncate py-2">{calcDisplay}</div>
          </div>

          {/* Grid de botões */}
          <div className="grid grid-cols-4 gap-4">
            <button onClick={clearCalc} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">C</button>
            <button onClick={() => setView('calculator_percent')} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">%</button>
            <button onClick={() => performCalcOperation('/')} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">÷</button>
            <button onClick={() => performCalcOperation('*')} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">×</button>

            {['7', '8', '9'].map(d => (
              <button key={d} onClick={() => inputCalcDigit(d)} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">{d}</button>
            ))}
            <button onClick={() => performCalcOperation('-')} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">−</button>

            {['4', '5', '6'].map(d => (
              <button key={d} onClick={() => inputCalcDigit(d)} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">{d}</button>
            ))}
            <button onClick={() => performCalcOperation('+')} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">+</button>

            {['1', '2', '3'].map(d => (
              <button key={d} onClick={() => inputCalcDigit(d)} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">{d}</button>
            ))}
            <button onClick={calculateCalcResult} className="row-span-2 py-6 bg-sky-400 hover:bg-sky-500 text-white font-black text-xl rounded-2xl transition-all shadow-md active:scale-95">=</button>

            <button onClick={() => inputCalcDigit('0')} className="col-span-2 py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">0</button>
            <button onClick={() => inputCalcDigit('.')} className="py-6 bg-sky-300 hover:bg-sky-400 text-white font-black text-xl rounded-2xl transition-all shadow-sm active:scale-95">.</button>
          </div>
        </div>
      </div>
    );
  };

  const renderPercentTool = () => {
    const handleCalculateOf = () => {
      const p = parseFloat(percInput) || 0;
      const v = parseFloat(percOfValue) || 0;
      const result = (p / 100) * v;
      setCalcDisplay(String(result));
      setView('calculator');
    };

    const handleCalculateVariation = () => {
      const f = parseFloat(percFinalValue) || 0;
      const i = parseFloat(percInitialValue) || 0;
      if (f === 0) {
        setErrorMsg("Valor final não pode ser zero.");
        return;
      }
      const result = Math.abs((f - i) / f);
      setCalcDisplay(String(result));
      setView('calculator');
    };

    return (
      <div className="animate-fadeIn max-md mx-auto flex flex-col items-center">
        <BackButton to="calculator" />
        <div className="w-full space-y-8 bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-2xl">
          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter text-center">Ferramentas de Porcentagem</h3>

          <div className="space-y-4">
            <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Quanto é X% de Y?</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex border-2 border-black rounded-2xl overflow-hidden bg-slate-50 transition-all">
                <div className="bg-slate-200 px-4 py-3 flex items-center justify-center font-black text-slate-500">%</div>
                <input
                  type="number"
                  value={percInput}
                  onFocus={() => { if (percInput === '0') setPercInput(''); }}
                  onBlur={() => { if (percInput === '') setPercInput('0'); }}
                  onChange={(e) => setPercInput(e.target.value)}
                  className="w-full p-3 font-black text-slate-700 bg-transparent outline-none"
                  placeholder="0"
                />
              </div>
              <span className="font-black text-slate-300">de</span>
              <div className="flex-1 flex border-2 border-black rounded-2xl overflow-hidden bg-slate-50 transition-all">
                <div className="bg-slate-200 px-4 py-3 flex items-center justify-center font-black text-slate-500">R$</div>
                <input
                  type="number"
                  value={percOfValue}
                  onFocus={() => { if (percOfValue === '0') setPercOfValue(''); }}
                  onBlur={() => { if (percOfValue === '') setPercOfValue('0'); }}
                  onChange={(e) => setPercOfValue(e.target.value)}
                  className="w-full p-3 font-black text-slate-700 bg-transparent outline-none"
                  placeholder="0"
                />
              </div>
            </div>
            <button onClick={handleCalculateOf} className="w-full py-3 bg-sky-400 text-white font-black rounded-xl hover:bg-sky-500 transition-all shadow-md">Calcular</button>
          </div>

          <div className="h-px bg-slate-100"></div>

          <div className="space-y-4">
            <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest">Variação (Aumento / Desconto)</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase">Valor Inicial</label>
                <div className="border-2 border-black rounded-2xl bg-slate-50 overflow-hidden">
                  <input
                    type="number"
                    value={percInitialValue}
                    onFocus={() => { if (percInitialValue === '0') setPercInitialValue(''); }}
                    onBlur={() => { if (percInitialValue === '') setPercInitialValue('0'); }}
                    onChange={(e) => setPercInitialValue(e.target.value)}
                    className="w-full p-4 font-black text-slate-700 outline-none bg-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-400 uppercase">Valor Final</label>
                <div className="border-2 border-black rounded-2xl bg-slate-50 overflow-hidden">
                  <input
                    type="number"
                    value={percFinalValue}
                    onFocus={() => { if (percFinalValue === '0') setPercFinalValue(''); }}
                    onBlur={() => { if (percFinalValue === '') setPercFinalValue('0'); }}
                    onChange={(e) => setPercFinalValue(e.target.value)}
                    className="w-full p-4 font-black text-slate-700 outline-none bg-transparent"
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <button onClick={handleCalculateVariation} className="w-full py-3 bg-slate-800 text-white font-black rounded-xl hover:bg-black transition-all shadow-md">Calcular Variação</button>
            <p className="text-[9px] text-slate-300 font-bold text-center">Fórmula: |(Final - Inicial) / Final|</p>
          </div>
        </div>
      </div>
    );
  };

  const textColor = isDarkMode ? 'text-white' : 'text-slate-800';
  const cardBg = isDarkMode ? 'bg-slate-900' : 'bg-white';

  const StudyStyleHeader = ({ onBack, onHome, rightContent }: { onBack: () => void, onHome?: () => void, rightContent?: React.ReactNode }) => (
    <div className="flex items-center justify-between mb-6 w-full animate-fadeIn transition-all duration-500 ease-in-out">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-xl border-black font-black transition-all shadow-sm active:scale-95 text-[13px] ${isDarkMode ? 'bg-black text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 hover:border-black'}`}
        >
          <span>←</span> Voltar
        </button>
        {onHome && (
          <button
            onClick={onHome}
            className={`flex items-center justify-center p-2 rounded-xl border-black font-black transition-all shadow-sm active:scale-95 ${isDarkMode ? 'bg-black text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 hover:border-black'}`}
            title="Ir para tela inicial"
          >
            <svg className="w-5 h-5 font-black" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </button>
        )}
      </div>
      {rightContent}
    </div>
  );

  const BackButton = ({ to, onClick }: { to?: ViewState, onClick?: () => void }) => (
    <div className="w-full text-left">
      <button
        onClick={() => {
          if (onClick) onClick();
          else if (to) setView(to);
        }}
        className="flex items-center gap-2 mb-8 text-slate-400 font-bold hover:text-[#4A69A2] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        Voltar
      </button>
    </div>
  );

  const renderComingSoon = (title: string, backTo: ViewState = 'entry', rightContent?: React.ReactNode) => (
    <div className="flex flex-col items-center justify-center pt-4 pb-20 animate-fadeIn text-center w-full">
      {StudyStyleHeader({ onBack: () => setView(backTo), onHome: () => setView('finances'), rightContent })}
      <div className="w-24 h-24 bg-[#4A69A2]/10 rounded-full flex items-center justify-center mb-8 mt-12">
        <span className="text-4xl">🚀</span>
      </div>
      <h2 className={`text-4xl font-black ${textColor} mb-4 uppercase tracking-tighter`}>{title}</h2>
      <p className="text-slate-400 font-bold max-w-md">Esta funcionalidade está sendo preparada para ajudar você a atingir o próximo nível de performance.</p>
    </div>
  );

  const renderFinancesCategories = () => (
    <div className="animate-fadeIn w-full">
      <div className="flex flex-col items-center justify-start pt-4 text-center w-full">
        {StudyStyleHeader({
          onBack: () => setView(activeFinMode === 'expense' ? 'finances_expenses' : 'finances_income'),
          onHome: () => setView('finances'),
          rightContent: (
            <button
              onClick={() => {
                setFinEditingCategory(null);
                setFinCatCustomName('');
                setFinCatCreationTab('recommended');
                setView('finances_create_category');
              }}
              className="px-8 py-2.5 rounded-xl bg-black text-white font-bold text-sm transition-all shadow-sm active:scale-95 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Criar Categoria
            </button>
          )
        })}



        <div className="bg-white rounded-[1.5rem] border-2 border-black/20 p-6 shadow-sm min-h-[300px] flex flex-col w-full max-w-4xl mt-8 overflow-hidden">
          {financesCategories.filter(c => c.financeType === activeFinMode).length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full h-44 border-2 border-slate-200 rounded-[2rem] flex items-center justify-center">
                <p className="text-slate-400 font-bold text-center px-10 text-sm">
                  Nenhuma categoria criada. Clique em "Criar Categoria" para começar!
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {financesCategories.filter(c => c.financeType === activeFinMode).map(cat => (
                <div key={cat.id} className="relative group">
                  <div
                    className="h-20 rounded-xl flex items-center justify-center shadow-md transition-all group-hover:scale-[1.02] cursor-pointer"
                    style={{ backgroundColor: cat.color }}
                  >
                    <span className="text-white font-black text-base tracking-tight">{cat.name}</span>
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 backdrop-blur-[12px] rounded-xl bg-black/10">
                    <button
                      onClick={() => {
                        setFinEditingCategory(cat);
                        setFinCatCustomName(cat.name);
                        setFinCatSelectedColor(cat.color);
                        setFinCatCreationTab('custom');
                        setView('finances_create_category');
                      }}
                      className="text-white w-7 h-7 flex items-center justify-center border border-white/20 rounded-lg hover:bg-white/10 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                    <button
                      onClick={() => setFinCatToDelete(cat)}
                      className="text-white w-7 h-7 flex items-center justify-center border border-white/20 rounded-lg hover:bg-white/10 transition-all"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {finCatToDelete && (
        <div className="fixed inset-0 z-[500] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-[2rem] shadow-2xl max-w-[280px] w-full text-center border-2 border-black">
            <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-1">Tem certeza?</h3>
            <p className="text-slate-500 font-medium mb-6 text-[11px] leading-relaxed">A categoria "<span className="font-bold">{finCatToDelete.name}</span>" será excluída permanentemente.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setFinCatToDelete(null)}
                className="flex-1 py-2 bg-slate-100 text-slate-500 font-bold rounded-xl hover:bg-slate-200 transition-all text-xs"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  saveFinCategories(financesCategories.filter(c => c.id !== finCatToDelete.id));
                  setFinCatToDelete(null);
                }}
                className="flex-1 py-2 bg-red-500 text-white font-black rounded-xl hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 text-xs"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderFinancesCreateCategory = () => (
    <div className="animate-fadeIn w-full flex flex-col items-center">
      {StudyStyleHeader({
        onBack: () => setView('finances_categories'),
        onHome: () => setView('finances')
      })}



      <div className="w-full max-w-lg bg-slate-50 border-2 border-solid border-black/20 p-6 rounded-[2rem]">
        {!finEditingCategory && (
          <div className="bg-white border-2 border-black p-0.5 rounded-2xl flex mb-12 shadow-sm w-fit mx-auto">
            <button
              onClick={() => setFinCatCreationTab('recommended')}
              className={`py-2 px-8 rounded-xl font-bold text-sm transition-all active:scale-95 ${finCatCreationTab === 'recommended' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}
            >
              Recomendadas
            </button>
            <button
              onClick={() => setFinCatCreationTab('custom')}
              className={`py-2 px-8 rounded-xl font-bold text-sm transition-all active:scale-95 ${finCatCreationTab === 'custom' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}
            >
              Criar Minha Própria
            </button>
          </div>
        )}

        {finCatCreationTab === 'recommended' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
            {financeRecs.map(rec => (
              <button
                key={rec.name}
                onClick={() => setFinSelectedRecommended(rec.name)}
                className={`p-3 rounded-xl border-2 font-black transition-all text-sm shadow-sm ${finSelectedRecommended === rec.name ? 'bg-slate-200 border-black text-black scale-105' : 'bg-white border-slate-100 text-slate-400 hover:border-black hover:text-black'}`}
              >
                {rec.name}
              </button>
            ))}
          </div>
        ) : (
          <div className="mb-10">
            <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 ml-2">NOME DA CATEGORIA</label>
            <input
              type="text"
              autoFocus
              value={finCatCustomName}
              onChange={(e) => setFinCatCustomName(e.target.value)}
              placeholder="ex: Viagens, Saúde..."
              className="w-full p-4 text-base font-bold border-[1.5px] border-black rounded-xl outline-none shadow-sm placeholder:text-slate-200 transition-all focus:shadow-xl"
            />
          </div>
        )}

        <div className="mb-10">
          <label className="block text-[10px] font-black text-slate-300 uppercase tracking-widest mb-4 ml-2">ESCOLHA UMA COR</label>
          <div className="flex flex-wrap gap-4 justify-center">
            {customColors.map(color => (
              <button
                key={color}
                onClick={() => setFinCatSelectedColor(color)}
                style={{ backgroundColor: color }}
                className={`w-9 h-9 rounded-xl transition-all shadow-md hover:scale-110 active:scale-90 flex items-center justify-center border-2 ${finCatSelectedColor === color ? 'border-black' : 'border-transparent'}`}
              >
                {finCatSelectedColor === color && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleCreateFinCategory}
          className="w-full py-4 bg-black text-white font-black text-base rounded-xl shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-black/20"
        >
          {finEditingCategory ? 'Atualizar Categoria' : '+ Salvar Categoria'}
        </button>
      </div>
    </div>
  );

  const renderFinancesMenu = () => (
    <div className="flex flex-col items-center justify-start pt-4 animate-fadeIn text-center w-full">
      {StudyStyleHeader({
        onBack: () => setView('entry'),
        rightContent: null
      })}
      <h2 className={`text-4xl font-black ${textColor} mb-2 mt-12`}>Finanças</h2>
      <p className="text-slate-500 font-medium mb-12">Gerencie suas receitas, despesas e saúde financeira.</p>
      <div className="flex flex-col md:flex-row gap-8 w-full max-w-2xl px-4">
        {/* Card Receitas */}
        <button
          onClick={() => {
            setActiveFinMode('income');
            if (!finIncomeOnboarded) {
              setView('finances_income_onboarding');
            } else {
              setView('finances_income');
            }
          }}
          className="flex-1 p-10 bg-white border-2 border-black/20 rounded-[2rem] shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center gap-4 group hover:bg-[#369E45] hover:border-transparent"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <svg className="w-8 h-8 text-slate-800 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <span className="text-xl font-bold text-slate-800 group-hover:text-white transition-colors">Finanças</span>
        </button>

        {/* Card Despesas */}
        <button
          onClick={() => {
            setActiveFinMode('expense');
            if (!finExpenseOnboarded) {
              setView('finances_expense_onboarding');
            } else {
              setView('finances_expenses');
            }
          }}
          className="flex-1 p-10 bg-white border-2 border-black/20 rounded-[2rem] shadow-xl hover:scale-105 transition-all duration-300 flex flex-col items-center gap-4 group hover:bg-[#FF2626] hover:border-transparent"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <svg className="w-8 h-8 text-slate-800 group-hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14" />
            </svg>
          </div>
          <span className="text-xl font-bold text-slate-800 group-hover:text-white transition-colors">Despesas</span>
        </button>
      </div>
    </div>
  );

  const renderFinancesIncomeForm = () => {
    return (
      <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center pt-10 px-4">
        <BackButton to="finances_income" />

        <div className="w-full bg-white border-2 border-black/30 rounded-[2.5rem] p-10 shadow-2xl flex flex-col gap-10">
          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 012 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              1. Nome
            </label>
            <div className="relative">
              <input
                type="text"
                value={finIncomeName}
                onChange={(e) => setFinIncomeName(e.target.value)}
                placeholder="Ex: Salário, Freelance..."
                className="w-full p-3.5 border-2 border-black/30 rounded-xl font-black text-base outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300/40"
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              2. Valor (R$)
            </label>
            <div className="flex items-center justify-start gap-3">
              <button
                onClick={() => setFinIncomeValue(String(Math.max(0, (parseFloat(finIncomeValue.replace(',', '.')) || 0) - 100)))}
                className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-black/30 flex items-center justify-center font-black text-xl hover:bg-slate-200 transition-all active:scale-90"
              >
                -
              </button>
              <div className="relative w-36">
                <input
                  type="text"
                  inputMode="decimal"
                  value={finIncomeValue}
                  onFocus={() => {
                    setIncomeBackup(finIncomeValue || '0');
                    setFinIncomeValue('');
                  }}
                  onBlur={() => {
                    if (finIncomeValue === '' || finIncomeValue === null) {
                      setFinIncomeValue(incomeBackup);
                    }
                  }}
                  onChange={(e) => setFinIncomeValue(e.target.value.replace(/[^0-9,]/g, ''))}
                  placeholder="0,00"
                  className="w-full p-2.5 border-2 border-black/30 rounded-xl font-black text-base text-center outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
                />
              </div>
              <button
                onClick={() => setFinIncomeValue(String((parseFloat(finIncomeValue.replace(',', '.')) || 0) + 100))}
                className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-black/30 flex items-center justify-center font-black text-xl hover:bg-slate-200 transition-all active:scale-90"
              >
                +
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 mt-4">
            <button
              onClick={() => {
                if (!finIncomeName) {
                  setFinFormErrorMsg("Por favor, informe o Nome da receita.");
                } else if (!finIncomeValue || finIncomeValue === '0') {
                  setFinFormErrorMsg("Por favor, informe o Valor da receita.");
                } else {
                  setFinFormErrorMsg(null);
                  setView('finances_income_form_step2');
                  return;
                }
                setTimeout(() => setFinFormErrorMsg(null), 3000);
              }}
              className="w-full max-w-sm py-4 bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Próximo
            </button>

            {finFormErrorMsg && (
              <div className="animate-fadeIn text-red-600 font-black text-xs uppercase tracking-widest text-center py-2 bg-red-50 w-full rounded-xl border border-red-100 px-4">
                {finFormErrorMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFinancesIncomeFormStep2 = () => {
    const efforts = [
      { id: 'baixo', label: 'Baixo', color: 'bg-gray-400' },
      { id: 'médio', label: 'Médio', color: 'bg-green-500' },
      { id: 'alto', label: 'Alto', color: 'bg-red-500' },
      { id: 'muito alto', label: 'Muito alto', color: 'bg-red-800' }
    ];
    const frequencies = ['Diário', 'Semanal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'];

    return (
      <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center pt-10 px-4 pb-20">
        <BackButton to="finances_income_form" />

        <div className="w-full bg-white border-2 border-black/30 rounded-[2.5rem] p-10 shadow-2xl flex flex-col gap-10">
          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              3. Esforço para conquista
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {efforts.map(e => (
                <button
                  key={e.id}
                  onClick={() => setFinIncomeEffort(e.id)}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 ${finIncomeEffort === e.id ? `${e.color} text-white border-black/50 scale-105 shadow-lg` : 'bg-white text-black border-black/30 hover:border-black/50'}`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              4. Essa renda pode crescer?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button
                onClick={() => setFinIncomeCanGrow(true)}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${finIncomeCanGrow === true ? 'bg-black text-white border-black/50 scale-105' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black/30'}`}
              >
                Sim
              </button>
              <button
                onClick={() => setFinIncomeCanGrow(false)}
                className={`flex-1 py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${finIncomeCanGrow === false ? 'bg-black text-white border-black/50 scale-105' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black/30'}`}
              >
                Não
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
              5. Recorrência
            </label>
            <div className="flex flex-col gap-8">
              <div className="flex gap-4 max-w-sm">
                <button
                  onClick={() => setFinIncomeRecurrence('fixo')}
                  className={`flex-1 py-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${finIncomeRecurrence === 'fixo' ? 'bg-black text-white border-black/50 scale-105 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black/30'}`}
                >
                  Renda Fixa
                </button>
                <button
                  onClick={() => {
                    setFinIncomeRecurrence('pontual');
                    setFinIncomePeriod('');
                  }}
                  className={`flex-1 py-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${finIncomeRecurrence === 'pontual' ? 'bg-black text-white border-black/50 scale-105 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black/30'}`}
                >
                  Renda Pontual
                </button>
              </div>

              {finIncomeRecurrence === 'fixo' && (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                    {frequencies.map(f => (
                      <button
                        key={f}
                        onClick={() => setFinIncomePeriod(f)}
                        className={`py-4 px-2 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${finIncomePeriod === f ? 'bg-blue-900 text-white border-black/50 scale-110' : 'bg-white text-black border-slate-200 hover:border-black/30'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 mt-4">
            <button
              onClick={() => {
                if (!finIncomeEffort) {
                  setFinFormErrorMsg("Por favor, selecione o nível de Esforço.");
                } else if (finIncomeCanGrow === null) {
                  setFinFormErrorMsg("Por favor, informe se a renda pode crescer.");
                } else if (finIncomeRecurrence === 'fixo' && !finIncomePeriod) {
                  setFinFormErrorMsg("Por favor, selecione a periodicidade da Renda Fixa.");
                } else {
                  setFinFormErrorMsg(null);
                  setFinIncomeSaveStep('initial');
                  setTempFinIncomeCatSelection(null);
                  setShowFinIncomeSaveModal(true);
                  return;
                }
                setTimeout(() => setFinFormErrorMsg(null), 3000);
              }}
              className="w-full max-w-md py-4 bg-blue-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
            >
              Salvar Receita
            </button>

            {finFormErrorMsg && (
              <div className="animate-fadeIn text-red-600 font-black text-xs uppercase tracking-widest text-center py-2 bg-red-50 w-full rounded-xl border border-red-100 px-4">
                {finFormErrorMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFinancesExpenseForm = () => {
    return (
      <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center pt-10 px-4 pb-20">
        <BackButton to="finances_expenses" />

        <div className="w-full bg-white border-2 border-black/30 rounded-[2.5rem] p-10 shadow-2xl flex flex-col gap-10">
          {/* Pergunta 1 - Nome */}
          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              1. Nome da despesa
            </label>
            <input
              type="text"
              value={finExpenseName}
              onChange={(e) => setFinExpenseName(e.target.value)}
              placeholder="Ex: Conta de luz, Netflix..."
              className="w-full max-w-sm p-3 border-2 border-black/30 rounded-xl font-bold text-slate-800 outline-none bg-slate-50 focus:bg-white transition-all placeholder:text-slate-300"
            />
          </div>

          {/* Pergunta 2 - Valor */}
          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              2. Valor
            </label>
            <div className="flex items-center gap-3 justify-start">
              <button
                onClick={() => setFinExpenseValue(String(Math.max(0, (parseFloat(finExpenseValue.replace(',', '.')) || 0) - 100)))}
                className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-black/30 flex items-center justify-center font-black text-xl hover:bg-slate-200 transition-all active:scale-90"
              >-</button>
              <div className="relative w-36">
                <input
                  type="text"
                  inputMode="decimal"
                  value={finExpenseValue}
                  onFocus={() => { setExpenseBackup(finExpenseValue || '0'); setFinExpenseValue(''); }}
                  onBlur={() => { if (finExpenseValue === '' || finExpenseValue === null) setFinExpenseValue(expenseBackup); }}
                  onChange={(e) => setFinExpenseValue(e.target.value.replace(/[^0-9,]/g, ''))}
                  placeholder="0,00"
                  className="w-full p-2.5 border-2 border-black/30 rounded-xl font-black text-base text-center outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
                />
              </div>
              <button
                onClick={() => setFinExpenseValue(String((parseFloat(finExpenseValue.replace(',', '.')) || 0) + 100))}
                className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-black/30 flex items-center justify-center font-black text-xl hover:bg-slate-200 transition-all active:scale-90"
              >+</button>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mt-6 w-full">
          <button
            onClick={() => {
              if (!finExpenseName) {
                setFinExpenseFormErrorMsg("Por favor, informe o Nome da despesa.");
              } else if (!finExpenseValue || finExpenseValue === '0') {
                setFinExpenseFormErrorMsg("Por favor, informe o Valor da despesa.");
              } else {
                setFinExpenseFormErrorMsg(null);
                setView('finances_expense_form_step2');
                return;
              }
              setTimeout(() => setFinExpenseFormErrorMsg(null), 3000);
            }}
            className="w-full max-w-sm py-4 bg-black text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            Próximo
          </button>
          {finExpenseFormErrorMsg && (
            <div className="animate-fadeIn text-red-600 font-black text-xs uppercase tracking-widest text-center py-2 bg-red-50 w-full rounded-xl border border-red-100 px-4">
              {finExpenseFormErrorMsg}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFinancesExpenseFormStep2 = () => {
    const efforts = [
      { id: 'baixo', label: 'Baixo', color: 'bg-gray-400' },
      { id: 'médio', label: 'Médio', color: 'bg-green-500' },
      { id: 'alto', label: 'Alto', color: 'bg-red-500' },
      { id: 'muito alto', label: 'Muito alto', color: 'bg-red-800' }
    ];
    const necessities = [
      { id: 'necessario', label: 'Necessário', color: 'bg-green-500' },
      { id: 'impulso', label: 'Impulso', color: 'bg-orange-400' },
      { id: 'nao_sei', label: 'Não sei', color: 'bg-gray-400' }
    ];
    const moods = [
      { id: 'Feliz', label: 'Feliz', icon: <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2.5" /><path d="M8 14s1.5 2 4 2 4-2 4-2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8.5" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="9.5" r="1" fill="currentColor" stroke="none" /></svg> },
      { id: 'Triste', label: 'Triste', icon: <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2.5" /><path d="M16 16s-1.5-2-4-2-4 2-4 2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8.5" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="9.5" r="1" fill="currentColor" stroke="none" /></svg> },
      { id: 'Estressado', label: 'Estressado', icon: <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2.5" /><path d="M8 15h8" strokeWidth="2.5" strokeLinecap="round" /><path d="M8 11l2-1m4 0l2 1" strokeWidth="2.5" strokeLinecap="round" /><circle cx="8.5" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="9.5" r="1" fill="currentColor" stroke="none" /></svg> },
      { id: 'Ansioso', label: 'Ansioso', icon: <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2.5" /><circle cx="8.5" cy="9.5" r="2.5" strokeWidth="2" /><circle cx="15.5" cy="9.5" r="2.5" strokeWidth="2" /><path d="M10 16s1-1 2-1 2 1 2 1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> },
      { id: 'Com tédio', label: 'Com tédio', icon: <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2.5" /><line x1="8" y1="15" x2="16" y2="15" strokeWidth="2.5" strokeLinecap="round" /><circle cx="8.5" cy="9.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="9.5" r="1" fill="currentColor" stroke="none" /></svg> },
      { id: 'Outro', label: 'Outro', icon: null }
    ];
    const frequencies = ['Diário', 'Semanal', 'Mensal', 'Bimestral', 'Trimestral', 'Semestral', 'Anual'];

    return (
      <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center pt-10 px-4 pb-20">
        <BackButton to="finances_expense_form" />

        <div className="w-full bg-white border-2 border-black/30 rounded-[2.5rem] p-10 shadow-2xl flex flex-col gap-10">

          {/* Pergunta 3 - Esforço */}
          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              3. Qual foi meu grau de esforço para conseguir esse dinheiro que foi gasto?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {efforts.map(e => (
                <button
                  key={e.id}
                  onClick={() => setFinExpenseEffort(e.id)}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 ${finExpenseEffort === e.id ? `${e.color} text-white border-black/50 scale-105 shadow-lg` : 'bg-white text-black border-black/30 hover:border-black/50'}`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pergunta 4 - Necessidade */}
          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              4. O gasto era necessário ou foi por impulso?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {necessities.map(n => (
                <button
                  key={n.id}
                  onClick={() => setFinExpenseNecessity(n.id as any)}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 ${finExpenseNecessity === n.id ? `bg-black text-white border-black/50 scale-105 shadow-lg` : 'bg-white text-black border-black/30 hover:border-black/50'}`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          {/* Pergunta 5 - Humor */}
          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              5. Como eu estava me sentindo antes da compra?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {moods.map(m => (
                <button
                  key={m.id}
                  onClick={() => setFinExpenseMood(m.id)}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 flex items-center justify-center gap-2 ${finExpenseMood === m.id ? 'bg-black text-white border-black/50 scale-105 shadow-lg' : 'bg-white text-black border-black/30 hover:border-black/50'}`}
                >
                  {m.icon && <span className="flex-shrink-0 w-4 h-4">{m.icon}</span>}
                  {m.label}
                </button>
              ))}
            </div>
            {finExpenseMood === 'Outro' && (
              <div className="animate-fadeIn">
                <input
                  type="text"
                  value={finExpenseMoodOther}
                  onChange={(e) => setFinExpenseMoodOther(e.target.value)}
                  placeholder="Descreva como estava se sentindo..."
                  className="w-full p-3 border-2 border-black/30 rounded-xl font-bold text-slate-800 outline-none bg-slate-50 focus:bg-white transition-all placeholder:text-slate-300"
                />
              </div>
            )}
          </div>

          {/* Pergunta 6 - Pode crescer */}
          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              6. Essa despesa pode crescer?
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <button
                onClick={() => setFinExpenseCanGrow(true)}
                className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 flex items-center justify-center gap-2 ${finExpenseCanGrow === true ? 'bg-black text-white border-black/50 scale-105 shadow-lg' : 'bg-white text-black border-black/30 hover:border-black/50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
                Sim
              </button>
              <button
                onClick={() => setFinExpenseCanGrow(false)}
                className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 flex items-center justify-center gap-2 ${finExpenseCanGrow === false ? 'bg-black text-white border-black/50 scale-105 shadow-lg' : 'bg-white text-black border-black/30 hover:border-black/50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                Não
              </button>
            </div>
          </div>

          {/* Pergunta 7 - Recorrência */}
          <div className="space-y-6">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
              7. Recorrência
            </label>
            <div className="flex flex-col gap-8">
              <div className="flex gap-4 max-w-sm">
                <button
                  onClick={() => setFinExpenseRecurrence('fixo')}
                  className={`flex-1 py-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${finExpenseRecurrence === 'fixo' ? 'bg-black text-white border-black/50 scale-105 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black/30'}`}
                >
                  Gasto Fixo
                </button>
                <button
                  onClick={() => { setFinExpenseRecurrence('pontual'); setFinExpensePeriod(''); }}
                  className={`flex-1 py-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${finExpenseRecurrence === 'pontual' ? 'bg-black text-white border-black/50 scale-105 shadow-xl' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black/30'}`}
                >
                  Gasto Pontual
                </button>
              </div>
              {finExpenseRecurrence === 'fixo' && (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                    {frequencies.map(f => (
                      <button
                        key={f}
                        onClick={() => setFinExpensePeriod(f)}
                        className={`py-4 px-2 rounded-xl border-2 font-black text-[10px] uppercase transition-all ${finExpensePeriod === f ? 'bg-blue-900 text-white border-black/50 scale-110' : 'bg-white text-black border-slate-200 hover:border-black/30'}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 mt-6 w-full">
          <button
            onClick={() => {
              if (!finExpenseEffort) {
                setFinExpenseFormErrorMsg("Por favor, selecione o nível de Esforço.");
              } else if (!finExpenseNecessity) {
                setFinExpenseFormErrorMsg("Por favor, indique se o gasto era necessário ou por impulso.");
              } else if (!finExpenseMood) {
                setFinExpenseFormErrorMsg("Por favor, informe como estava se sentindo.");
              } else if (finExpenseMood === 'Outro' && !finExpenseMoodOther.trim()) {
                setFinExpenseFormErrorMsg("Por favor, descreva como estava se sentindo.");
              } else if (finExpenseCanGrow === null) {
                setFinExpenseFormErrorMsg("Por favor, informe se a despesa pode crescer.");
              } else if (finExpenseRecurrence === 'fixo' && !finExpensePeriod) {
                setFinExpenseFormErrorMsg("Por favor, selecione a periodicidade do Gasto Fixo.");
              } else {
                setFinExpenseFormErrorMsg(null);
                setFinExpenseSaveStep('initial');
                setTempFinExpenseCatSelection(null);
                setShowFinExpenseSaveModal(true);
                return;
              }
              setTimeout(() => setFinExpenseFormErrorMsg(null), 3000);
            }}
            className="w-full max-w-md py-4 bg-blue-900 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl hover:scale-105 active:scale-95 transition-all"
          >
            Salvar Despesa
          </button>
          {finExpenseFormErrorMsg && (
            <div className="animate-fadeIn text-red-600 font-black text-xs uppercase tracking-widest text-center py-2 bg-red-50 w-full rounded-xl border border-red-100 px-4">
              {finExpenseFormErrorMsg}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderNutritionDashboard = () => {
    if (!nutritionProfile) return renderNutritionOnboarding();
    return <NutritionModule
      profile={nutritionProfile}
      isDarkMode={isDarkMode}
      onBack={() => setView('entry')}
      onEditProfile={() => {
        setNutriAge(nutritionProfile.age || '');
        setNutriHeight(nutritionProfile.height || '');
        setNutriWeight(nutritionProfile.weight || '');
        setNutriGender(nutritionProfile.gender || null);
        setNutriObjective(nutritionProfile.objective || '');
        setNutriActivityLevel(nutritionProfile.activityLevel || '');
        setNutriWeeklyTrainings(nutritionProfile.weeklyTrainings || 3);
        setNutriTrainingIntensity(nutritionProfile.trainingIntensity || '');
        setNutriDesiredWeight(nutritionProfile.desiredWeight || '');

        const deadline = nutritionProfile.realisticDeadline || '';
        if (deadline === 'Sem meta') {
          setNutriDeadlineType('sem_meta');
          setNutriDeadline('1');
        } else {
          const match = deadline.match(/(\d+)\s*(.*)/);
          if (match) {
            setNutriDeadline(match[1]);
            setNutriDeadlineType(match[2] as any);
          }
        }

        setNutriHasRestriction(nutritionProfile.hasRestriction || false);
        setNutriVegetarian(nutritionProfile.restrictions?.vegetarian || false);
        setNutriIntolerant(nutritionProfile.restrictions?.intolerant || false);
        setNutriIntoleranceDesc(nutritionProfile.restrictions?.intoleranceDesc || '');
        setNutriAllergies(nutritionProfile.restrictions?.allergies || false);
        setNutriAllergiesDesc(nutritionProfile.restrictions?.allergiesDesc || '');
        setNutriDislikedFoods(nutritionProfile.restrictions?.dislikedFoods || false);
        setNutriDislikedFoodsDesc(nutritionProfile.restrictions?.dislikedFoodsDesc || '');
        setNutriMonthlyBudget(nutritionProfile.monthlyBudget || '');
        setNutriCulinaryPref(nutritionProfile.culinaryPreference || '');
        setNutriMealsPerDay(Number(nutritionProfile.mealsPerDay) || 5);
        setNutritionBackView('nutrition_dashboard');
        setView('nutrition_onboarding');
      }}
      onProfileUpdate={(newProfile) => {
        setNutritionProfile(newProfile);
      }}
    />;
  };

  const handleNextOnboardingStep = () => {
    let msg = "";
    if (!nutriAge?.trim()) msg = "Por favor, preencha sua Idade.";
    else if (!nutriHeight?.trim()) msg = "Por favor, preencha sua Altura.";
    else if (!nutriWeight?.trim()) msg = "Por favor, preencha seu Peso Atual.";
    else if (!nutriGender) msg = "Por favor, selecione seu Sexo.";

    if (msg) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    setView('nutrition_onboarding_step2');
  };

  const getWeeksOfMonth = (year: number, month: number) => {
    const weeks = [];
    let d = new Date(year, month - 1, 1);
    let weekNum = 1;
    while (d.getMonth() === month - 1) {
      const start = new Date(d);
      const end = new Date(d);
      const toSaturday = 6 - end.getDay();
      end.setDate(end.getDate() + toSaturday);

      const endOfMonth = new Date(year, month, 0);
      if (end > endOfMonth) {
        end.setTime(endOfMonth.getTime());
      }

      weeks.push({
        start: new Date(start),
        end: new Date(end),
        label: `Semana ${weekNum}`
      });

      d = new Date(end);
      d.setDate(d.getDate() + 1);
      weekNum++;
    }
    return weeks;
  };

  const renderFinanceList = (type: 'income' | 'expense') => {
    let list = financeRecords.filter(r => r.type === type);

    // Filtragem por Período
    if (financeFilterPeriod !== 'todos') {
      list = list.filter(r => {
        if (!r.date) return false;
        const parts = r.date.split('/');
        if (parts.length !== 3) return false;
        const [dayStr, monthStr, yearStr] = parts;
        const day = parseInt(dayStr, 10);
        const month = parseInt(monthStr, 10);
        const year = parseInt(yearStr, 10);

        if (financeFilterPeriod === 'diario') {
          if (!financeFilterDate) return false;
          const [fYear, fMonth, fDay] = financeFilterDate.split('-');
          return year === parseInt(fYear, 10) && month === parseInt(fMonth, 10) && day === parseInt(fDay, 10);
        }
        if (financeFilterPeriod === 'semanal') {
          const weeks = getWeeksOfMonth(financeDiarioYear, financeDiarioMonth);
          const currentWeekIdx = Math.min(Math.max(0, parseInt(financeFilterWeek || '0', 10)), weeks.length - 1);
          const currentWeek = weeks[currentWeekIdx];
          if (!currentWeek) return false;

          const recordDate = new Date(year, month - 1, day);
          recordDate.setHours(12, 0, 0, 0); // avoid timezone boundary issues

          const start = new Date(currentWeek.start); start.setHours(0, 0, 0, 0);
          const end = new Date(currentWeek.end); end.setHours(23, 59, 59, 999);

          return recordDate >= start && recordDate <= end;
        }
        if (financeFilterPeriod === 'mensal') {
          if (!financeFilterMonth) return false;
          const [fYear, fMonth] = financeFilterMonth.split('-');
          return year === parseInt(fYear, 10) && month === parseInt(fMonth, 10);
        }
        const fYearInt = parseInt(financeFilterYear, 10);
        const fIdxInt = parseInt(financeFilterPeriodIdx, 10);
        if (financeFilterPeriod === 'bimestral') {
          if (!financeFilterYear) return false;
          const bimestre = Math.ceil(month / 2);
          return year === fYearInt && bimestre === fIdxInt;
        }
        if (financeFilterPeriod === 'trimestral') {
          if (!financeFilterYear) return false;
          const trimestre = Math.ceil(month / 3);
          return year === fYearInt && trimestre === fIdxInt;
        }
        if (financeFilterPeriod === 'semestral') {
          if (!financeFilterYear) return false;
          const semestre = Math.ceil(month / 6);
          return year === fYearInt && semestre === fIdxInt;
        }
        if (financeFilterPeriod === 'anual') {
          if (!financeFilterYear) return false;
          return year === fYearInt;
        }

        return true;
      });
    }

    list.sort((a, b) => {
      if (financeSortBy === 'alphabetical') {
        return a.name.localeCompare(b.name);
      }
      if (financeSortBy === 'category') {
        const catA = a.categoryName || '';
        const catB = b.categoryName || '';
        if (catA === catB) return a.name.localeCompare(b.name);
        return catA.localeCompare(catB);
      }
      if (financeSortBy === 'value_desc' || financeSortBy === 'value_asc') {
        const valA = parseFloat(a.value.replace(/\./g, '').replace(',', '.')) || 0;
        const valB = parseFloat(b.value.replace(/\./g, '').replace(',', '.')) || 0;
        return financeSortBy === 'value_desc' ? valB - valA : valA - valB;
      }
      // date_desc or date_asc
      const dateA = a.date ? a.date.split('/').reverse().join('') : ''; // YYYYMMDD
      const dateB = b.date ? b.date.split('/').reverse().join('') : ''; // YYYYMMDD
      if (financeSortBy === 'date_desc') return dateB.localeCompare(dateA);
      return dateA.localeCompare(dateB);
    });

    const title = type === 'income' ? 'Minhas Receitas' : 'Minhas Despesas';
    const backTo = type === 'income' ? 'finances_income' : 'finances_expenses';

    return (
      <div className="animate-fadeIn w-full flex flex-col items-center pt-4">
        {StudyStyleHeader({
          onBack: () => setView(backTo),
          onHome: () => setView('finances')
        })}

        <div className="max-w-4xl w-full flex flex-col items-center mt-6">

          <div className="w-full flex flex-wrap gap-4 justify-between items-center mb-6">
            <div className="flex flex-wrap gap-2">
              {(['todos', 'diario', 'semanal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => {
                    setFinanceFilterPeriod(p);
                    setFinanceFilterPeriodIdx('1');
                  }}
                  className={`px-5 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shadow-sm ${financeFilterPeriod === p ? 'bg-black text-white scale-105' : 'bg-slate-50 text-black border-2 border-slate-100 hover:bg-white hover:border-black/10'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {financeFilterPeriod !== 'todos' && (
            <div className="w-full mb-8 flex flex-col items-center animate-fadeIn">
              <div className="flex flex-wrap gap-4 items-center justify-center w-full">
                {financeFilterPeriod === 'diario' && (
                  <div className="flex flex-col items-center gap-4 bg-white p-6 rounded-[2rem] border-2 border-black/10 w-full max-w-sm shadow-sm">
                    {/* Navegação de Mês/Ano */}
                    <div className="flex justify-between items-center w-full border-b-2 border-slate-100 pb-4">
                      <button
                        onClick={() => {
                          let newMonth = financeDiarioMonth;
                          let newYear = financeDiarioYear;
                          if (financeDiarioMonth === 1) {
                            newMonth = 12;
                            newYear = financeDiarioYear - 1;
                          } else {
                            newMonth = financeDiarioMonth - 1;
                          }
                          setFinanceDiarioMonth(newMonth);
                          setFinanceDiarioYear(newYear);
                          setFinanceFilterDate('');
                        }}
                        className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm"
                      >
                        &lt;
                      </button>

                      <div className="flex flex-col items-center">
                        <span className="text-sm font-black uppercase tracking-widest text-slate-800">
                          {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][financeDiarioMonth - 1]}
                        </span>
                        <span className="text-[10px] font-black text-slate-400">{financeDiarioYear}</span>
                      </div>

                      <button
                        onClick={() => {
                          let newMonth = financeDiarioMonth;
                          let newYear = financeDiarioYear;
                          if (financeDiarioMonth === 12) {
                            newMonth = 1;
                            newYear = financeDiarioYear + 1;
                          } else {
                            newMonth = financeDiarioMonth + 1;
                          }
                          setFinanceDiarioMonth(newMonth);
                          setFinanceDiarioYear(newYear);
                          setFinanceFilterDate('');
                        }}
                        className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm"
                      >
                        &gt;
                      </button>
                    </div>
                    {/* Dias */}
                    <div className="grid grid-cols-7 gap-1 w-full">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, i) => (
                        <div key={i} className="text-center text-[10px] font-black text-slate-300 py-1">{wd}</div>
                      ))}
                      {(() => {
                        const daysInMonth = new Date(financeDiarioYear, financeDiarioMonth, 0).getDate();
                        const startDay = new Date(financeDiarioYear, financeDiarioMonth - 1, 1).getDay();
                        const blanks = Array.from({ length: startDay }, (_, i) => <div key={`blank-${i}`} />);
                        const daysCount = Array.from({ length: daysInMonth }, (_, i) => i + 1);

                        return (
                          <>
                            {blanks}
                            {daysCount.map(d => {
                              const dateStr = `${financeDiarioYear}-${String(financeDiarioMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                              const isSel = financeFilterDate === dateStr;
                              return (
                                <button key={d} onClick={() => setFinanceFilterDate(dateStr)} className={`aspect-square flex items-center justify-center rounded-xl text-[11px] font-black transition-all border-2 ${isSel ? 'bg-black text-white border-black shadow-md scale-110 z-10' : 'bg-slate-50 text-slate-600 border-transparent hover:border-black/20 hover:bg-slate-100'}`}>
                                  {d}
                                </button>
                              );
                            })}
                          </>
                        )
                      })()}
                    </div>
                  </div>
                )}
                {financeFilterPeriod === 'semanal' && (() => {
                  const weeks = getWeeksOfMonth(financeDiarioYear, financeDiarioMonth);
                  const currentWeekIdx = Math.min(Math.max(0, parseInt(financeFilterWeek || '0', 10)), weeks.length - 1);
                  const currentWeek = weeks[currentWeekIdx] || weeks[0];

                  return (
                    <div className="flex flex-col lg:flex-row gap-4 items-center w-full max-w-lg">
                      {/* Navegação de Ano */}
                      <div className="flex-1 flex justify-between items-center w-full px-2">
                        <button
                          onClick={() => {
                            if (financeDiarioYear > 2026) {
                              setFinanceDiarioYear(financeDiarioYear - 1);
                              setFinanceFilterWeek('0');
                            }
                          }}
                          className={`flex items-center justify-center text-black ${financeDiarioYear <= 2026 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm`}
                        >
                          &lt;
                        </button>

                        <span className="text-[11px] font-black uppercase tracking-widest text-black">
                          {financeDiarioYear}
                        </span>

                        <button
                          onClick={() => {
                            if (financeDiarioYear < 2028) {
                              setFinanceDiarioYear(financeDiarioYear + 1);
                              setFinanceFilterWeek('0');
                            }
                          }}
                          className={`flex items-center justify-center text-black ${financeDiarioYear >= 2028 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm`}
                        >
                          &gt;
                        </button>
                      </div>

                      {/* Navegação de Mês */}
                      <div className="flex-1 flex justify-between items-center w-full px-2">
                        <button
                          onClick={() => {
                            let newMonth = financeDiarioMonth === 1 ? 12 : financeDiarioMonth - 1;
                            setFinanceDiarioMonth(newMonth);
                            setFinanceFilterWeek('0');
                          }}
                          className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm"
                        >
                          &lt;
                        </button>

                        <span className="text-[11px] font-black uppercase tracking-widest text-black">
                          {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][financeDiarioMonth - 1]}
                        </span>

                        <button
                          onClick={() => {
                            let newMonth = financeDiarioMonth === 12 ? 1 : financeDiarioMonth + 1;
                            setFinanceDiarioMonth(newMonth);
                            setFinanceFilterWeek('0');
                          }}
                          className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm"
                        >
                          &gt;
                        </button>
                      </div>

                      {/* Navegação de Semanas */}
                      <div className="flex-[1.5] flex justify-between items-center w-full px-2">
                        <button
                          onClick={() => setFinanceFilterWeek(Math.max(0, currentWeekIdx - 1).toString())}
                          className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm shrink-0"
                        >
                          &lt;
                        </button>

                        <div className="flex flex-col items-center px-1 text-center">
                          <span className="text-[10px] font-black uppercase tracking-widest text-black">
                            {currentWeek.label}
                          </span>
                          <span className="text-[8px] font-black text-slate-400">
                            ({String(currentWeek.start.getDate()).padStart(2, '0')}/{String(currentWeek.start.getMonth() + 1).padStart(2, '0')} a {String(currentWeek.end.getDate()).padStart(2, '0')}/{String(currentWeek.end.getMonth() + 1).padStart(2, '0')})
                          </span>
                        </div>

                        <button
                          onClick={() => setFinanceFilterWeek(Math.min(weeks.length - 1, currentWeekIdx + 1).toString())}
                          className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm shrink-0"
                        >
                          &gt;
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {financeFilterPeriod === 'mensal' && (() => {
                  const [currYear, currMonth] = financeFilterMonth.split('-').map(Number);

                  return (
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full max-w-2xl">
                      {/* Navegação de Ano */}
                      <div className="flex-1 flex justify-between items-center w-full px-2">
                        <button
                          onClick={() => {
                            if (currYear > 2026) {
                              setFinanceFilterMonth(`${currYear - 1}-${String(currMonth).padStart(2, '0')}`);
                            }
                          }}
                          className={`flex items-center justify-center text-black ${currYear <= 2026 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm`}
                        >
                          &lt;
                        </button>

                        <span className="text-[11px] font-black uppercase tracking-widest text-black">
                          {currYear}
                        </span>

                        <button
                          onClick={() => {
                            if (currYear < 2028) {
                              setFinanceFilterMonth(`${currYear + 1}-${String(currMonth).padStart(2, '0')}`);
                            }
                          }}
                          className={`flex items-center justify-center text-black ${currYear >= 2028 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm`}
                        >
                          &gt;
                        </button>
                      </div>

                      {/* Navegação de Mês */}
                      <div className="flex-1 flex justify-between items-center w-full px-2">
                        <button
                          onClick={() => {
                            let newMonth = currMonth === 1 ? 12 : currMonth - 1;
                            let newYear = currMonth === 1 ? currYear - 1 : currYear;
                            setFinanceFilterMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
                          }}
                          className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm"
                        >
                          &lt;
                        </button>

                        <span className="text-[11px] font-black uppercase tracking-widest text-black">
                          {['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][currMonth - 1]}
                        </span>

                        <button
                          onClick={() => {
                            let newMonth = currMonth === 12 ? 1 : currMonth + 1;
                            let newYear = currMonth === 12 ? currYear + 1 : currYear;
                            setFinanceFilterMonth(`${newYear}-${String(newMonth).padStart(2, '0')}`);
                          }}
                          className="flex items-center justify-center text-black hover:opacity-70 transition-all font-black text-sm"
                        >
                          &gt;
                        </button>
                      </div>
                    </div>
                  );
                })()}
                {['bimestral', 'trimestral', 'semestral', 'anual'].includes(financeFilterPeriod) && (() => {
                  const numYear = parseInt(financeFilterYear || '2026', 10);
                  const numIdx = parseInt(financeFilterPeriodIdx || '1', 10);

                  const periodData = {
                    bimestral: { max: 6, label: 'Bimestre', months: ['Jan a Fev', 'Mar a Abr', 'Mai a Jun', 'Jul a Ago', 'Set a Out', 'Nov a Dez'] },
                    trimestral: { max: 4, label: 'Trimestre', months: ['Jan a Mar', 'Abr a Jun', 'Jul a Set', 'Out a Dez'] },
                    semestral: { max: 2, label: 'Semestre', months: ['Jan a Jun', 'Jul a Dez'] }
                  };

                  const pd = financeFilterPeriod !== 'anual' ? periodData[financeFilterPeriod as keyof typeof periodData] : null;

                  return (
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full max-w-2xl">
                      {/* Navegação de Ano */}
                      <div className="flex-1 flex justify-between items-center w-full px-2">
                        <button
                          onClick={() => {
                            if (numYear > 2026) {
                              setFinanceFilterYear((numYear - 1).toString());
                            }
                          }}
                          className={`flex items-center justify-center text-black ${numYear <= 2026 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm`}
                        >
                          &lt;
                        </button>

                        <span className="text-[11px] font-black uppercase tracking-widest text-black">
                          {numYear}
                        </span>

                        <button
                          onClick={() => {
                            if (numYear < 2028) {
                              setFinanceFilterYear((numYear + 1).toString());
                            }
                          }}
                          className={`flex items-center justify-center text-black ${numYear >= 2028 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm`}
                        >
                          &gt;
                        </button>
                      </div>

                      {/* Navegação de Período */}
                      {pd && (
                        <div className="flex-[1.5] flex justify-between items-center w-full px-2">
                          <button
                            onClick={() => {
                              if (numIdx > 1) setFinanceFilterPeriodIdx((numIdx - 1).toString());
                            }}
                            className={`flex items-center justify-center text-black ${numIdx <= 1 ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm shrink-0`}
                          >
                            &lt;
                          </button>

                          <div className="flex flex-col items-center px-1 text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black">
                              {numIdx}º {pd.label}
                            </span>
                            <span className="text-[8px] font-black text-slate-400">
                              ({pd.months[numIdx - 1]})
                            </span>
                          </div>

                          <button
                            onClick={() => {
                              if (numIdx < pd.max) setFinanceFilterPeriodIdx((numIdx + 1).toString());
                            }}
                            className={`flex items-center justify-center text-black ${numIdx >= pd.max ? 'opacity-30 cursor-not-allowed' : 'hover:opacity-70'} transition-all font-black text-sm shrink-0`}
                          >
                            &gt;
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {list.length > 0 && (
            <div className="w-full flex justify-end mt-4 mb-2 pr-2">
              <div className="flex items-center gap-3">
                <span className="text-black text-[10px] font-black uppercase tracking-widest hidden md:inline">Ordenar</span>
                <select
                  value={financeSortBy}
                  onChange={(e) => setFinanceSortBy(e.target.value as any)}
                  className="bg-transparent border-2 border-black/20 rounded-2xl px-3 py-2 text-[10px] font-black outline-none cursor-pointer hover:bg-black/5 transition-colors uppercase tracking-widest text-black"
                >
                  <option value="date_desc">Recentes</option>
                  <option value="date_asc">Mais Antigos</option>
                  <option value="value_desc">Maior Valor</option>
                  <option value="value_asc">Menor Valor</option>
                  <option value="alphabetical">Alfabética</option>
                  <option value="category">Categoria</option>
                </select>
              </div>
            </div>
          )}

          {list.length === 0 ? (
            <div className="text-center max-w-md w-full py-10 animate-fadeIn">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
              </div>
              <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Nenhum registro encontrado</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8 w-full px-4 mb-20 mt-4">
              {list.map(record => {
                const cardBgColor = record.categoryColor || '#4A69A2';
                return (
                  <div key={record.id} className="flex flex-col gap-3">
                    <span
                      className="text-[10px] font-black uppercase tracking-[0.2em] pl-2 drop-shadow-sm"
                      style={{ color: record.categoryColor || '#94a3b8' }}
                    >
                      {record.categoryName || 'Sem Categoria'}
                    </span>
                    <div
                      onClick={() => {
                        if (onOpenDetail) {
                          onOpenDetail({
                            ...record,
                            color: cardBgColor,
                            categoryId: record.type === 'income' ? 'Minhas Receitas' : 'Minhas Despesas'
                          });
                        } else {
                          setSelectedFinanceRecord(record);
                        }
                      }}
                      className="group flex items-center justify-between p-3.5 rounded-xl bg-zinc-400/20 border-2 border-black/20 shadow-md hover:scale-[1.01] transition-all cursor-pointer relative text-zinc-600"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em]">{record.date}</span>
                        <h3 className="text-base font-black text-zinc-700 leading-tight uppercase tracking-tight">{record.name}</h3>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="text-xl font-black tracking-tighter text-zinc-700">
                          R$ {record.value}
                        </span>

                        <button
                          onClick={(e) => { e.stopPropagation(); setFinanceRecordToDelete(record); }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95 border border-zinc-600/20 text-zinc-400 hover:text-zinc-700 hover:border-zinc-600/40"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFinanceDetailModal = () => {
    if (!selectedFinanceRecord) return null;
    const r = selectedFinanceRecord;
    return (
      <div className="fixed inset-0 z-[4000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn font-sans">
        <div className="bg-white rounded-[3.5rem] shadow-2xl max-w-lg w-full border-2 border-black overflow-hidden flex flex-col max-h-[90vh] text-left">
          <div className="p-8 pb-4 flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">{r.type === 'income' ? 'Detalhes da Receita' : 'Detalhes da Despesa'}</span>
              <h3 className="text-3xl font-black text-slate-800 leading-tight">{r.name}</h3>
            </div>
            <button onClick={() => setSelectedFinanceRecord(null)} className="p-3 bg-slate-100 rounded-2xl hover:bg-slate-200 transition-all text-slate-500">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="p-8 pt-0 overflow-y-auto custom-scrollbar space-y-8">
            <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100 flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">VALOR TOTAL</span>
              <p className="text-4xl font-black text-[#4A69A2]">R$ {r.value}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">DATA</span>
                <span className="text-sm font-black text-slate-700">{r.date || '-'}</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">RECORRÊNCIA</span>
                <span className="text-sm font-black text-slate-700 capitalize">{r.recurrence || '-'}</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">CATEGORIA</span>
                <span className="text-sm font-black" style={{ color: r.categoryColor || '#64748b' }}>{r.categoryName || 'Nenhuma'}</span>
              </div>
              <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm text-center">
                <span className="text-[8px] font-black text-slate-300 uppercase block mb-1">ESFORÇO</span>
                <span className="text-sm font-black text-slate-700 capitalize">{r.effort?.replace('nivel_', 'Nível ') || '-'}</span>
              </div>
            </div>

            {r.type === 'expense' && (
              <div className="space-y-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <span className="text-[10px] font-black text-slate-300 uppercase block mb-3">Necessidade e Humor</span>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-4 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-black border border-slate-100 uppercase tracking-wider">Necessidade: <span className="capitalize text-[#4A69A2]">{r.necessity?.replace('_', ' ') || '-'}</span></span>
                    <span className="px-4 py-2 bg-slate-50 text-slate-700 rounded-xl text-xs font-black border border-slate-100 uppercase tracking-wider">Humor: <span className="capitalize text-[#4A69A2]">{r.mood || '-'} {r.moodOther ? `(${r.moodOther})` : ''}</span></span>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-slate-900 p-6 rounded-[2.5rem] text-white">
              <span className="text-[10px] font-black text-slate-500 uppercase block mb-2 tracking-widest">Pode crescer?</span>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${r.canGrow ? 'bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-red-400'}`} />
                <span className="font-black text-lg">{r.canGrow ? 'Sim, é um investimento/gasto variável' : 'Não, valor fixo controlado'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const handleNextOnboardingStep2 = () => {
    let msg = "";
    if (!nutriObjective) msg = "Por favor, selecione seu Objetivo.";
    else if (!nutriActivityLevel) msg = "Por favor, selecione seu Nível de Atividade.";
    else if (!nutriTrainingIntensity) msg = "Por favor, informe a Intensidade do Treino.";
    else if (!nutriDesiredWeight?.trim()) msg = "Por favor, preencha sua Meta de Peso.";
    else if (nutriDeadlineType !== 'sem_meta' && !nutriDeadline?.trim()) msg = "Por favor, informe a quantidade de tempo para o Prazo.";

    if (msg) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    setView('nutrition_onboarding_step3');
  };

  const finalizeNutritionProfile = () => {
    let msg = "";
    if (nutriHasRestriction) {
      if (nutriIntolerant && !nutriIntoleranceDesc?.trim()) msg = "Por favor, informe quais Intolerâncias você possui.";
      else if (nutriAllergies && !nutriAllergiesDesc?.trim()) msg = "Por favor, informe quais Alergias você possui.";
      else if (nutriDislikedFoods && !nutriDislikedFoodsDesc?.trim()) msg = "Por favor, informe os Alimentos que Não Gosta.";
    }
    if (!msg && !nutriMonthlyBudget?.trim()) msg = "Por favor, preencha o Orçamento Mensal para Alimentação.";
    if (!msg && !nutriCulinaryPref?.trim()) msg = "Por favor, selecione suas Preferências Culinárias.";
    if (!msg && !nutriMealsPerDay) msg = "Por favor, preencha a Quantidade de Refeições por Dia.";

    if (msg) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }
    const profile: NutritionProfile = {
      age: nutriAge,
      height: nutriHeight,
      weight: nutriWeight,
      gender: nutriGender,
      objective: nutriObjective,
      activityLevel: nutriActivityLevel,
      weeklyTrainings: nutriWeeklyTrainings,
      trainingIntensity: nutriTrainingIntensity,
      desiredWeight: nutriDesiredWeight,
      realisticDeadline: nutriDeadlineType === 'sem_meta' ? 'Sem meta' : `${nutriDeadline} ${nutriDeadlineType}`,
      hasRestriction: nutriHasRestriction,
      restrictions: {
        vegetarian: nutriVegetarian,
        intolerant: nutriIntolerant,
        intoleranceDesc: nutriIntoleranceDesc,
        allergies: nutriAllergies,
        allergiesDesc: nutriAllergiesDesc,
        dislikedFoods: nutriDislikedFoods,
        dislikedFoodsDesc: nutriDislikedFoodsDesc,
      },
      monthlyBudget: nutriMonthlyBudget,
      culinaryPreference: nutriCulinaryPref,
      mealsPerDay: String(nutriMealsPerDay),
    };
    // Compare to check if profile changed
    const oldProfileStr = localStorage.getItem('produtivity_nutrition_profile');
    if (oldProfileStr) {
      const oldProfile = JSON.parse(oldProfileStr);

      const sortObject = (obj: any): any => {
        if (obj === null) return null;
        if (typeof obj !== "object") return obj;
        if (Array.isArray(obj)) return obj.map(sortObject);
        return Object.keys(obj).sort().reduce((result: any, key) => {
          result[key] = sortObject(obj[key]);
          return result;
        }, {});
      };

      const isChanged = JSON.stringify(sortObject(oldProfile)) !== JSON.stringify(sortObject(profile));
      if (isChanged) {
        localStorage.setItem('produtivity_nutrition_profile_changed', 'true');
      } else {
        localStorage.removeItem('produtivity_nutrition_profile_changed');
      }
    }

    setNutritionProfile(profile);
    localStorage.setItem('produtivity_nutrition_profile', JSON.stringify(profile));
    setSuccessMsg("Perfil nutricional salvo com sucesso!");
    setTimeout(() => setSuccessMsg(null), 3000);
    setView('nutrition_dashboard');
  };

  const renderNutritionOnboarding = () => {
    return (
      <div className="animate-fadeIn max-w-md mx-auto flex flex-col items-center pt-10">
        <BackButton
          onClick={() => {
            if (nutritionBackView === 'nutrition_dashboard') {
              // Ensure we return to dashboard, specifically to 'dados' tab if possible via state
              setView('nutrition_dashboard');
            } else {
              setView('entry');
            }
          }}
        />

        <div className="w-full bg-white border-2 border-black rounded-[3rem] p-10 shadow-2xl flex flex-col gap-8">
          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
              1. Idade
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={nutriAge}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9,]/g, ''); setNutriAge(v); }}
                onKeyDown={(e) => { if (!/[0-9,]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault(); }}
                placeholder="Ex: 25"
                className="w-full p-4 pr-16 border-2 border-black rounded-xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300/40"
              />
              {nutriAge && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">anos</span>}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 20h16M12 4v16m0-16l-4 4m4-4l4 4" /></svg>
              2. Altura (em cm)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={nutriHeight}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9,]/g, ''); setNutriHeight(v); }}
                onKeyDown={(e) => { if (!/[0-9,]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault(); }}
                placeholder="Ex: 175"
                className="w-full p-4 pr-16 border-2 border-black rounded-xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300/40"
              />
              {nutriHeight && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">cm</span>}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 01-6.001 0M18 7l-3 9m3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              3. Peso atual (em kg)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                value={nutriWeight}
                onChange={(e) => { const v = e.target.value.replace(/[^0-9,]/g, ''); setNutriWeight(v); }}
                onKeyDown={(e) => { if (!/[0-9,]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault(); }}
                placeholder="Ex: 70"
                className="w-full p-4 pr-16 border-2 border-black rounded-xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300/40"
              />
              {nutriWeight && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">kg</span>}
            </div>
          </div>

          {/* 4. Sexo */}
          <div className="space-y-4">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              4. Sexo
            </label>
            <div className="flex gap-4">
              <button
                onClick={() => setNutriGender('male')}
                className={`flex-1 py-4 rounded-xl border-2 font-black text-sm uppercase transition-all duration-200 ${nutriGender === 'male' ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-black border-black hover:border-red-500'}`}
              >
                Homem
              </button>
              <button
                onClick={() => setNutriGender('female')}
                className={`flex-1 py-4 rounded-xl border-2 font-black text-sm uppercase transition-all duration-200 ${nutriGender === 'female' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-black border-black hover:border-red-500'}`}
              >
                Mulher
              </button>
            </div>
          </div>

          <button
            onClick={handleNextOnboardingStep}
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all mt-4"
          >
            Próximo
          </button>
        </div>
      </div>
    );
  };

  const renderNutritionOnboardingStep2 = () => {
    const objectives = ['Perder gordura', 'Ganhar massa', 'Composição corporal', 'Manutenção'];
    const activityLevels = ['Sedentário', 'Levemente ativo', 'Moderadamente ativo', 'Muito ativo'];
    const intensities = ['Moderado', 'Intenso', 'Muito intenso'];

    const getArrowCount = (levels: string[], selected: string) => {
      const idx = levels.indexOf(selected);
      return idx; // 0 for first (no arrows), 1 for second, etc.
    };

    const renderArrows = (count: number, animated: boolean) => {
      if (count <= 0) return null;
      return (
        <span className={`inline-flex gap-0.5 mr-1 ${animated ? 'animate-fadeIn' : ''}`}>
          {Array.from({ length: count }).map((_, i) => (
            <svg key={i} className="w-3 h-3 inline" fill="currentColor" viewBox="0 0 20 20" style={{ animationDelay: `${i * 100}ms` }}>
              <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          ))}
        </span>
      );
    };

    return (
      <div className="animate-fadeIn max-w-md mx-auto flex flex-col items-center pt-10">
        <BackButton to="nutrition_onboarding" />
        <div className="w-full bg-white border-2 border-black rounded-[3rem] p-10 shadow-2xl flex flex-col gap-8">
          {/* Objetivo */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              Objetivo
            </label>
            <div className="grid grid-cols-2 gap-3">
              {objectives.map(obj => (
                <button key={obj} onClick={() => setNutriObjective(obj)}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 ${nutriObjective === obj ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:border-red-500'}`}
                >{obj}</button>
              ))}
            </div>
          </div>

          {/* Nível de atividade */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
              Nível de atividade física
            </label>
            <div className="grid grid-cols-2 gap-3">
              {activityLevels.map((lvl, idx) => (
                <button key={lvl} onClick={() => setNutriActivityLevel(lvl)}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 ${nutriActivityLevel === lvl ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:border-red-500'}`}
                >
                  {nutriActivityLevel === lvl && renderArrows(idx, true)}
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Treinos por semana */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" /></svg>
              Treinos por semana: <span className="text-black text-lg">{nutriWeeklyTrainings}</span>
            </label>
            <input type="range" min="1" max="7" value={nutriWeeklyTrainings} onChange={e => setNutriWeeklyTrainings(Number(e.target.value))}
              className="w-full accent-black" />
            <div className="flex justify-between text-[9px] font-bold text-slate-400 px-1">
              {[1, 2, 3, 4, 5, 6, 7].map(n => <span key={n}>{n}</span>)}
            </div>
          </div>

          {/* Intensidade */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>
              Intensidade dos treinos
            </label>
            <div className="flex gap-3">
              {intensities.map((int, idx) => (
                <button key={int} onClick={() => setNutriTrainingIntensity(int)}
                  className={`flex-1 py-3 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 ${nutriTrainingIntensity === int ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:border-red-500'}`}
                >
                  {nutriTrainingIntensity === int && renderArrows(idx, true)}
                  {int}
                </button>
              ))}
            </div>
          </div>

          {/* Peso desejado */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 01-6.001 0M18 7l-3 9m3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>
              Peso desejado (kg)
            </label>
            <div className="relative">
              <input type="text" inputMode="decimal" value={nutriDesiredWeight} onChange={e => { const v = e.target.value.replace(/[^0-9,]/g, ''); setNutriDesiredWeight(v); }}
                onKeyDown={(e) => { if (!/[0-9,]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault(); }}
                placeholder="Ex: 65" className="w-full p-4 pr-16 border-2 border-black rounded-xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300/40" />
              {nutriDesiredWeight && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">kg</span>}
            </div>
          </div>

          {/* Prazo */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pl-2">
              <svg className="w-5 h-5 text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest">Prazo realista</label>
            </div>
            <div className="flex gap-3">
              {(['sem_meta', 'dias', 'meses', 'anos'] as const).map(type => (
                <button key={type} onClick={() => { setNutriDeadlineType(type); if (type !== 'sem_meta') setNutriDeadline('1'); }}
                  className={`flex-1 py-3 border-2 rounded-2xl font-black text-sm transition-all ${nutriDeadlineType === type ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-black'}`}>
                  {type === 'sem_meta' ? 'Sem meta' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
            {nutriDeadlineType !== 'sem_meta' && (
              <div className="animate-fadeIn mt-2 flex items-center gap-4">
                <button onClick={() => setNutriDeadline(String(Math.max(1, parseInt(nutriDeadline || '1') - 1)))}
                  className="w-8 h-8 border border-[#1e3a5f] rounded-lg flex items-center justify-center font-black text-lg hover:bg-slate-50">-</button>
                <div className="relative border border-[#1e3a5f] rounded-lg bg-white p-1 w-16">
                  <input type="number" value={nutriDeadline}
                    onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v)) { let max = 31; if (nutriDeadlineType === 'dias') max = 31; if (nutriDeadlineType === 'meses') max = 12; if (nutriDeadlineType === 'anos') max = 10; setNutriDeadline(String(Math.min(max, Math.max(1, v)))); } else { setNutriDeadline(''); } }}
                    onBlur={() => { if (!nutriDeadline) setNutriDeadline('1'); }}
                    className="w-full text-xl font-black text-slate-800 text-center outline-none bg-transparent" />
                </div>
                <button onClick={() => { let max = 31; if (nutriDeadlineType === 'dias') max = 31; if (nutriDeadlineType === 'meses') max = 12; if (nutriDeadlineType === 'anos') max = 10; setNutriDeadline(String(Math.min(max, parseInt(nutriDeadline || '1') + 1))); }}
                  className="w-8 h-8 border border-[#1e3a5f] rounded-lg flex items-center justify-center font-black text-lg hover:bg-slate-50">+</button>
                <span className="font-black text-slate-400 uppercase tracking-widest text-[10px]">{nutriDeadlineType}</span>
              </div>
            )}
          </div>

          <button onClick={handleNextOnboardingStep2}
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all mt-4">
            Próximo
          </button>
        </div>
      </div>
    );
  };

  const renderNutritionOnboardingStep3 = () => {
    const culinaryOptions = ['Comida caseira', 'Comida fitness', 'Comida rápida', 'Não tenho preferência'];

    const step3Tabs = [
      { icon: '🍽️', label: 'Dieta' },
      { icon: '📍', label: 'Região' },
      { icon: '💬', label: 'IA' },
      { icon: '🛒', label: 'Compras' },
      { icon: '📈', label: 'Metas' },
    ];

    return (
      <div className="animate-fadeIn max-w-md mx-auto flex flex-col items-center pt-10 relative">
        <BackButton to="nutrition_onboarding_step2" />

        {/* Tabs preview - top right */}
        <div className="absolute top-10 right-0 flex gap-1">
          {step3Tabs.map(t => (
            <div key={t.label} className="flex flex-col items-center px-1.5 py-1 opacity-40">
              <span className="text-xs grayscale brightness-200">{t.icon}</span>
              <span className="text-[7px] font-bold text-white drop-shadow-sm">{t.label}</span>
            </div>
          ))}
        </div>

        <div className="w-full bg-white border-2 border-black rounded-[3rem] p-10 shadow-2xl flex flex-col gap-8">
          {/* Restrição alimentar */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              Restrição alimentar
            </label>
            <div className="flex gap-4">
              <button onClick={() => { setNutriHasRestriction(false); setNutriVegetarian(false); setNutriIntolerant(false); setNutriAllergies(false); setNutriDislikedFoods(false); }}
                className={`flex-1 py-4 rounded-xl border-2 font-black text-sm uppercase transition-all ${!nutriHasRestriction ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black'}`}>
                Não
              </button>
              <button onClick={() => setNutriHasRestriction(true)}
                className={`flex-1 py-4 rounded-xl border-2 font-black text-sm uppercase transition-all ${nutriHasRestriction ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black'}`}>
                Sim
              </button>
            </div>
          </div>

          {/* Dynamic restrictions */}
          {nutriHasRestriction && (
            <div className="space-y-4 pl-2 border-l-4 border-black/10 ml-2">
              {/* Vegetariano */}
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setNutriVegetarian(!nutriVegetarian)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${nutriVegetarian ? 'bg-black border-black' : 'border-slate-300'}`}>
                  {nutriVegetarian && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="font-black text-sm text-slate-700">Vegetariano</span>
              </label>

              {/* Intolerante */}
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setNutriIntolerant(!nutriIntolerant)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${nutriIntolerant ? 'bg-black border-black' : 'border-slate-300'}`}>
                  {nutriIntolerant && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="font-black text-sm text-slate-700">Intolerante a algo</span>
              </label>
              {nutriIntolerant && (
                <input type="text" value={nutriIntoleranceDesc} onChange={e => setNutriIntoleranceDesc(e.target.value)}
                  placeholder="Descreva a intolerância" className="w-full p-3 border-2 border-black/20 rounded-xl font-bold text-sm outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 ml-8" />
              )}

              {/* Alergias */}
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setNutriAllergies(!nutriAllergies)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${nutriAllergies ? 'bg-black border-black' : 'border-slate-300'}`}>
                  {nutriAllergies && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="font-black text-sm text-slate-700">Alergias</span>
              </label>
              {nutriAllergies && (
                <input type="text" value={nutriAllergiesDesc} onChange={e => setNutriAllergiesDesc(e.target.value)}
                  placeholder="Descreva a alergia" className="w-full p-3 border-2 border-black/20 rounded-xl font-bold text-sm outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 ml-8" />
              )}

              {/* Alimentos que não gosta */}
              <label className="flex items-center gap-3 cursor-pointer" onClick={() => setNutriDislikedFoods(!nutriDislikedFoods)}>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${nutriDislikedFoods ? 'bg-black border-black' : 'border-slate-300'}`}>
                  {nutriDislikedFoods && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="font-black text-sm text-slate-700">Alimentos que não gosta</span>
              </label>
              {nutriDislikedFoods && (
                <input type="text" value={nutriDislikedFoodsDesc} onChange={e => setNutriDislikedFoodsDesc(e.target.value)}
                  placeholder="Liste os alimentos" className="w-full p-3 border-2 border-black/20 rounded-xl font-bold text-sm outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 ml-8" />
              )}
            </div>
          )}

          {/* Orçamento mensal */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Orçamento mensal para alimentação
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400 pointer-events-none">R$</span>
              <input type="text" inputMode="decimal" value={nutriMonthlyBudget} onChange={e => { const v = e.target.value.replace(/[^0-9,]/g, ''); setNutriMonthlyBudget(v); }}
                onKeyDown={(e) => { if (!/[0-9,]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) e.preventDefault(); }}
                placeholder="Ex: 800" className="w-full p-4 pl-12 border-2 border-black rounded-xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all text-slate-800 placeholder:text-slate-300/40" />
            </div>
          </div>

          {/* Preferências culinárias */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
              Preferências culinárias
            </label>
            <div className="grid grid-cols-2 gap-3">
              {culinaryOptions.map(opt => (
                <button key={opt} onClick={() => setNutriCulinaryPref(opt)}
                  className={`py-3 px-4 rounded-xl border-2 font-black text-xs uppercase transition-all duration-200 ${nutriCulinaryPref === opt ? 'bg-black text-white border-black' : 'bg-white text-black border-black hover:border-red-500'}`}
                >{opt}</button>
              ))}
            </div>
            {nutriCulinaryPref === 'Comida rápida' && (
              <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mt-2">
                <p className="text-xs font-bold text-amber-700">⚡ A IA priorizará: refeições em 10-15 min, alimentos prontos/semi-prontos, meal prep, receitas com 3-5 ingredientes, opções frias e uso de microondas/air fryer.</p>
              </div>
            )}
          </div>

          {/* Refeições por dia */}
          <div className="space-y-3">
            <label className="text-sm font-black text-[#4A69A2] uppercase tracking-widest pl-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h18v18H3zM12 8v8m-4-4h8" /></svg>
              Quantidade de refeições por dia: <span className="text-black text-lg">{nutriMealsPerDay}</span>
            </label>
            <input type="range" min="3" max="9" value={nutriMealsPerDay} onChange={e => setNutriMealsPerDay(Number(e.target.value))}
              className="w-full accent-black" />
            <div className="flex justify-between text-[9px] font-bold text-slate-400 px-1">
              {[3, 4, 5, 6, 7, 8, 9].map(n => <span key={n}>{n}</span>)}
            </div>
          </div>

          <button onClick={finalizeNutritionProfile}
            className="w-full py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all mt-4">
            Salvar e Concluir
          </button>
        </div>
      </div>
    );
  };

  const renderStatsAba = () => {
    // Calendário logic
    const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const startDay = new Date(calendarYear, calendarMonth, 1).getDay();

    const changeMonth = (offset: number) => {
      let nextMonth = calendarMonth + offset;
      let nextYear = calendarYear;
      if (nextMonth > 11) { nextMonth = 0; nextYear++; }
      if (nextMonth < 0) { nextMonth = 11; nextYear--; }
      setCalendarMonth(nextMonth);
      setCalendarYear(nextYear);
      setSelectedCalendarDate(null);
    };

    const handleDayClick = (dayNum: number) => {
      const dateStr = `${String(dayNum).padStart(2, '0')}/${String(calendarMonth + 1).padStart(2, '0')}/${calendarYear}`;
      setSelectedCalendarDate(dateStr);
    };

    // Helper para navegação do gráfico (substituindo dropdowns)
    const handleChartNav = (direction: -1 | 1) => {
      if (chartViewMode === 'months_of_year') {
        setCalendarYear(prev => prev + direction);
      } else if (chartViewMode !== 'years') {
        let nextMonth = calendarMonth + direction;
        let nextYear = calendarYear;
        if (nextMonth > 11) { nextMonth = 0; nextYear++; }
        if (nextMonth < 0) { nextMonth = 11; nextYear--; }
        setCalendarMonth(nextMonth);
        setCalendarYear(nextYear);
      }
    };

    const getChartNavLabel = () => {
      if (chartViewMode === 'months_of_year') return calendarYear.toString();
      return new Date(calendarYear, calendarMonth).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
    };

    return (
      <div className="w-full space-y-12 animate-fadeIn">
        {/* Filtros Estilizados */}
        <div className="flex flex-wrap gap-6 justify-center items-end bg-slate-100/50 p-8 rounded-[3rem] border border-slate-200">
          <div className="flex flex-col gap-3 min-w-[200px]">
            <label className="text-[10px] font-black text-black uppercase tracking-widest pl-2">Grupamento</label>
            <div className="relative group/sel">
              <select
                value={statGroup}
                onChange={(e) => { setStatGroup(e.target.value); setStatLocal(''); setStatEx(''); setSelectedCalendarDate(null); }}
                className="w-full bg-white border-2 border-slate-200 rounded-2xl p-5 font-black text-slate-800 outline-none hover:border-black transition-all appearance-none cursor-pointer shadow-md"
              >
                <option value="">Selecione...</option>
                {muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[200px]">
            <label className="text-[10px] font-black text-black uppercase tracking-widest pl-2">Local</label>
            <div className="relative group/sel">
              <select
                value={statLocal}
                disabled={!statGroup}
                onChange={(e) => { setStatLocal(e.target.value); setStatEx(''); setSelectedCalendarDate(null); }}
                className="w-full bg-white border-2 border-slate-200 rounded-2xl p-5 font-black text-slate-800 outline-none hover:border-black transition-all appearance-none cursor-pointer shadow-md disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="">Selecione...</option>
                {statGroup && muscleSubGroups[statGroup]?.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
            </div>
          </div>

          <div className="flex flex-col gap-3 min-w-[220px]">
            <label className="text-[10px] font-black text-black uppercase tracking-widest pl-2">Exercício</label>
            <div className="relative group/sel">
              <select
                value={statEx}
                disabled={!statLocal}
                onChange={(e) => { setStatEx(e.target.value); }}
                className="w-full bg-white border-2 border-slate-200 rounded-2xl p-5 font-black text-slate-800 outline-none hover:border-black transition-all appearance-none cursor-pointer shadow-md disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <option value="">Selecione...</option>
                {statLocal && gymDb[statLocal]?.isolados.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
                {statLocal && gymDb[statLocal]?.multi.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
              </select>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">▼</div>
            </div>
          </div>
        </div>

        {/* Dash de Métricas e Gráfico */}
        {statEx ? (
          <div className="animate-fadeIn w-full space-y-8">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 bg-white border-2 border-black p-8 rounded-[3rem] shadow-xl min-h-[400px] flex flex-col">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progressão: {statEx}</p>

                  {/* View Selectors - Updated with new options */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setChartViewMode('days_of_week')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${chartViewMode === 'days_of_week' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-200 hover:border-black'}`}
                    >
                      Dias da semana
                    </button>
                    <button
                      onClick={() => setChartViewMode('days_of_month')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${chartViewMode === 'days_of_month' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-200 hover:border-black'}`}
                    >
                      Dias do mês
                    </button>
                    <button
                      onClick={() => setChartViewMode('weeks_of_month')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${chartViewMode === 'weeks_of_month' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-200 hover:border-black'}`}
                    >
                      Semanas do mês
                    </button>
                    <button
                      onClick={() => setChartViewMode('months_of_year')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${chartViewMode === 'months_of_year' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-200 hover:border-black'}`}
                    >
                      Meses
                    </button>
                    <button
                      onClick={() => setChartViewMode('years')}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${chartViewMode === 'years' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-200 hover:border-black'}`}
                    >
                      Anos
                    </button>
                  </div>
                </div>

                {/* Navigation with Arrows (Replaces Dropdowns) */}
                {chartViewMode !== 'years' && (
                  <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100 mb-6 w-fit self-start">
                    <button onClick={() => handleChartNav(-1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-black font-black">‹</button>
                    <span className="font-black text-sm uppercase tracking-widest min-w-[140px] text-center px-2">
                      {getChartNavLabel()}
                    </span>
                    <button onClick={() => handleChartNav(1)} className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-black font-black">›</button>
                  </div>
                )}

                {/* Week Selector for 'days_of_week' Mode (Shown Above Chart) */}
                {chartViewMode === 'days_of_week' && (
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2 custom-scrollbar">
                    {[1, 2, 3, 4].map(w => (
                      <button
                        key={w}
                        onClick={() => setChartSelectedWeek(w)}
                        className={`flex-shrink-0 px-4 py-2 rounded-lg font-black text-[10px] uppercase border transition-all ${chartSelectedWeek === w ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-transparent hover:bg-slate-100'}`}
                      >
                        Semana {w}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex-1 w-full min-h-[300px]">
                  {exerciseHistory.length > 0 ? (
                    <CoordinateChart data={exerciseHistory} color="#8b5cf6" />
                  ) : (
                    <div className="h-full flex items-center justify-center border-2 border-dashed border-slate-100 rounded-3xl">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Sem dados para este filtro</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full lg:w-80 flex flex-col gap-6">
                <div className="bg-white border-2 border-black p-8 rounded-[2.5rem] shadow-xl text-black">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Carga Atual</p>
                  <h4 className="text-5xl font-black">{metrics?.latest || 0} <span className="text-xl opacity-30">kg</span></h4>
                </div>
                <div className="bg-white border-2 border-black p-8 rounded-[2.5rem] shadow-xl text-black">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Evolução Total</p>
                  <h4 className={`text-5xl font-black ${metrics && metrics.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {metrics && metrics.change >= 0 ? '+' : ''}{metrics?.change.toFixed(1) || 0}%
                  </h4>
                </div>
                {comparisonData && (
                  <div className="bg-white border-2 border-black p-8 rounded-[2.5rem] shadow-xl text-black animate-fadeIn">
                    <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">{comparisonData.label}</p>
                    {comparisonData.noData ? (
                      <h4 className="text-xl font-black text-slate-300">Sem dados anteriores</h4>
                    ) : (
                      <h4 className={`text-5xl font-black ${comparisonData.val >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {comparisonData.val >= 0 ? '+' : ''}{comparisonData.val.toFixed(1)}%
                      </h4>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white border-2 border-dashed border-slate-200 p-20 rounded-[3rem] text-center shadow-sm">
            <p className="font-black text-slate-300 uppercase tracking-widest">Selecione um exercício para ver os dados</p>
          </div>
        )}

        {/* Calendário de Frequência (Sempre visível para navegação de mês) */}
        <div className="bg-white border-2 border-black p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-center mb-10 gap-6">
            <h4 className="text-2xl font-black text-black uppercase tracking-tighter flex items-center gap-3">
              <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Calendário de Treinos
            </h4>

            <div className="flex items-center gap-4 bg-slate-50 p-2 rounded-2xl border-2 border-slate-100">
              <button onClick={() => changeMonth(-1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-black font-black">‹</button>
              <span className="font-black text-sm uppercase tracking-widest min-w-[140px] text-center">
                {new Date(calendarYear, calendarMonth).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => changeMonth(1)} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white hover:shadow-sm transition-all text-black font-black">›</button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-3">
            {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
              <div key={d} className="text-center font-black text-[10px] text-slate-300 py-4 tracking-widest">{d}</div>
            ))}
            {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${String(dayNum).padStart(2, '0')}/${String(calendarMonth + 1).padStart(2, '0')}/${calendarYear}`;
              const hasTrained = workoutDaysSet.has(dateStr);
              const isToday = dateStr === `${String(new Date().getDate()).padStart(2, '0')}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${new Date().getFullYear()}`;
              const isSelected = selectedCalendarDate === dateStr;
              const hasWeightRecord = statEx && gymHistory.some(h => h.date === dateStr && h.weights && h.weights[statEx]);

              return (
                <button
                  key={dayNum}
                  onClick={() => handleDayClick(dayNum)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-2xl font-black text-base border-2 transition-all group relative
                      ${isSelected
                      ? 'border-black border-[3px] scale-110 z-20 shadow-2xl bg-white text-black'
                      : hasTrained
                        ? 'bg-purple-600 border-black text-white shadow-xl'
                        : isToday
                          ? 'bg-white border-blue-400 text-blue-500'
                          : 'bg-slate-50 border-transparent text-slate-300 hover:border-slate-400'}
                      ${hasWeightRecord && !hasTrained && !isSelected ? 'bg-blue-50 border-blue-200 text-blue-800' : ''}
                    `}
                >
                  {dayNum}
                  {hasTrained && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full opacity-50"></div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDayInfo && (
            <div className="mt-12 bg-white text-black p-6 rounded-[2rem] flex flex-col sm:flex-row items-center justify-between gap-6 animate-fadeIn border-2 border-black shadow-2xl">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white font-black text-xl">
                  {selectedDayInfo.date.split('/')[0]}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {selectedDayInfo.weight
                      ? `Carga registrada em ${selectedDayInfo.date}`
                      : selectedDayInfo.hasWorkoutAtDate
                        ? `Houve treino em ${selectedDayInfo.date}, mas sem carga para este exercício`
                        : `Sem registro de treino em ${selectedDayInfo.date}`}
                  </span>
                  <span className="text-lg font-black">{statEx || 'Selecione um exercício para ver os dados'}</span>
                </div>
              </div>
              {selectedDayInfo.weight && (
                <div className="flex items-center gap-2">
                  <span className="text-4xl font-black text-purple-600">{selectedDayInfo.weight}</span>
                  <span className="text-xl font-black text-slate-500">kg</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };



  const renderGymMenu = () => {
    return (
      <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
        <BackButton to="entry" />
        <h2 className={`text-5xl font-black ${textColor} mb-12 uppercase tracking-tighter`}>Academia</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
          <button
            onClick={() => {
              if (nutritionProfile) setView('nutrition_dashboard');
              else setView('nutrition_onboarding');
            }}
            className="bg-white border-2 border-black p-10 rounded-[2.5rem] flex flex-col items-center gap-4 hover:bg-[#7EB1FF] hover:border-[#7EB1FF] hover:text-white transition-all shadow-xl group"
          >
            <div className="p-4 rounded-2xl bg-slate-50 group-hover:bg-white/20 text-black group-hover:text-white transition-all">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" /></svg>
            </div>
            <span className="font-black text-lg uppercase tracking-widest">Nutrição</span>
          </button>
          <button
            onClick={() => setView('gym_choice')}
            className="bg-white border-2 border-black p-10 rounded-[2.5rem] flex flex-col items-center gap-4 hover:bg-[#7EB1FF] hover:border-[#7EB1FF] hover:text-white transition-all shadow-xl group"
          >
            <div className="p-4 rounded-2xl bg-slate-50 group-hover:bg-white/20 text-black group-hover:text-white transition-all">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h12" /><path d="M6 7v10" /><path d="M3 9v6" /><path d="M18 7v10" /><path d="M21 9v6" /></svg>
            </div>
            <span className="font-black text-lg uppercase tracking-widest">Treino</span>
          </button>
        </div>
      </div>
    );
  };

  const handleOratoriaRedirect = () => {
    const prompt = "Olá! Quero praticar oratória. Por favor, atue como um treinador de comunicação. Vou usar o modo de voz. Analise meu ritmo, clareza e uso de vícios de linguagem. Podemos começar?";
    const encodedPrompt = encodeURIComponent(prompt);
    // Using chat.openai.com to distinguish from the login button's chatgpt.com
    window.open(`https://chat.openai.com/?q=${encodedPrompt}`, '_blank');
  };

  const renderOratoriaSetup = () => {
    return (
      <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center pt-10">
        <BackButton to="entry" />
        <h2 className={`text-5xl font-black ${textColor} mb-12 uppercase tracking-tighter`}>Preparação</h2>
        <div className="w-full bg-white border-2 border-black rounded-[3rem] p-12 shadow-2xl flex flex-col items-center gap-8">
          <div className="text-center space-y-4">
            <p className="text-slate-500 font-bold text-lg">Antes de começar, certifique-se de que você está logado na conta correta do ChatGPT.</p>
            <p className="text-slate-400 font-medium">Você pode trocar de conta agora ou prosseguir direto para o treino.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 w-full max-w-md">
            <button
              onClick={() => window.open('https://chatgpt.com', '_blank')}
              className="flex-1 py-5 bg-white border-2 border-black text-black rounded-2xl font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-lg flex flex-col items-center gap-2"
            >
              <span className="text-xs">Login / Trocar Conta</span>
            </button>
            <button
              onClick={handleOratoriaRedirect}
              className="flex-1 py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl flex flex-col items-center gap-2"
            >
              <span className="text-xs">Iniciar Treino</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="animate-fadeIn min-h-screen">
      <style>{` 
        @keyframes noteCardIn { 0% { opacity: 0; transform: translateY(15px) scale(0.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } } 
        .note-card-anim { animation: noteCardIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; } 
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .editor-title-container [contenteditable]:empty:before { 
          content: attr(data-placeholder); 
          color: #cbd5e1; 
          cursor: text; 
          font-weight: 900;
          pointer-events: none;
        }

        /* Hiding number input spinners */
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=number] {
          -moz-appearance: textfield;
        }

        .water-fill {
          position: relative;
          overflow: hidden;
          z-index: 1;
          transition: all 0.4s ease;
          color: black;
          border: 2px solid black !important;
          background: white;
        }
        .water-fill::before {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 0;
          background: black;
          transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: -1;
        }
        .water-fill:hover::before {
          height: 100%;
        }
        .water-fill:hover {
          color: white !important;
        }
        .water-fill.selected {
          background: black !important;
          color: white !important;
        }
        .water-fill.selected::before {
          height: 100%;
        }
        .water-fill:hover .gym-sub-circle {
          border-color: white !important;
        }
        .water-fill.selected .gym-sub-circle {
          background-color: white !important;
          border-color: white !important;
        }
        .water-fill.selected .gym-sub-circle svg {
          color: black !important;
        }

        .gray-water-fill {
          position: relative;
          overflow: hidden;
          z-index: 1;
          transition: all 0.4s ease;
          color: #94a3b8; /* slate-400 */
          border: 2px solid #94a3b8 !important;
          background: white;
        }
        .gray-water-fill::before {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 0;
          background: #94a3b8;
          transition: height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          z-index: -1;
        }
        .gray-water-fill:hover::before, .gray-water-fill.selected::before {
          height: 100%;
        }
        .gray-water-fill:hover, .gray-water-fill.selected {
          color: white !important;
          border-color: #94a3b8 !important;
        }
        .gray-water-fill.selected .ex-circle {
          background-color: #94a3b8 !important;
          border-color: #94a3b8 !important;
        }
        .gray-water-fill.selected .ex-circle svg {
          color: white !important;
        }

        .tree-line {
          position: relative;
          padding-left: 2rem;
          border-left: 2px solid #e2e8f0;
          margin-left: 0.5rem;
        }
        .tree-line::before {
          content: "";
          position: absolute;
          left: 0;
          top: 1rem;
          width: 1.5rem;
          height: 2px;
          background: #e2e8f0;
        }
        .tree-line-last {
           border-left-color: transparent;
        }
        .tree-line-last::after {
           content: "";
           position: absolute;
           left: 0;
           top: 0;
           height: 1rem;
           width: 2px;
           background: #e2e8f0;
        }
      `}</style>

      {errorMsg && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[2000] bg-red-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl animate-bounce text-center">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[2000] bg-green-600 text-white px-8 py-4 rounded-2xl font-black shadow-2xl animate-fadeIn text-center border-2 border-white/20">
          {successMsg}
        </div>
      )}

      {view === 'nutrition_dashboard' && renderNutritionDashboard()}
      {view === 'nutrition_onboarding' && renderNutritionOnboarding()}
      {view === 'nutrition_onboarding_step2' && renderNutritionOnboardingStep2()}
      {view === 'nutrition_onboarding_step3' && renderNutritionOnboardingStep3()}

      {/* Full Screen Gym Session Overlay */}
      {view === 'gym_active_session' && activeSessionWorkout && createPortal(
        <div className="fixed inset-0 z-[10000] bg-white overflow-y-auto flex flex-col p-8 sm:p-12 animate-fadeIn">
          <div className="max-w-4xl mx-auto w-full flex flex-col items-center">
            {/* Header com Progresso */}
            <div className="w-full flex items-center justify-between mb-16">
              <button
                onClick={() => exitImmersiveView('gym_now')}
                className="p-4 rounded-2xl border-2 border-slate-100 text-slate-300 hover:text-black hover:border-black transition-all"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Progresso do Treino</span>
                <span className="text-xl font-black text-zinc-600">{currentExIdx + 1} de {getFlattenedExercises(activeSessionWorkout).length}</span>
              </div>
              <div className="w-14"></div>
            </div>

            {/* Nome do Exercício */}
            <div className="text-center mb-16">
              <h3 className="text-6xl font-black text-slate-800 uppercase tracking-tighter leading-none mb-4">
                {getFlattenedExercises(activeSessionWorkout)[currentExIdx].name}
              </h3>
              <span className="px-6 py-2 bg-black text-white rounded-full font-black text-xs uppercase tracking-widest">
                {getFlattenedExercises(activeSessionWorkout)[currentExIdx].subGroup}
              </span>
            </div>

            {/* Visualização de Séries com Ícones de Haltere e Descanso Intercalado */}
            <div className="flex flex-wrap justify-center items-center gap-4 mb-20">
              {Array.from({ length: parseValue(getFlattenedExercises(activeSessionWorkout)[currentExIdx].details.sets) }).map((_, i) => {
                const isCompleted = i < currentSetIdx;
                const isRestCompleted = i < currentSetIdx && (!isResting || i < currentSetIdx - 1);

                return (
                  <React.Fragment key={i}>
                    {/* Ícone de Haltere */}
                    <div className="flex flex-col items-center gap-4">
                      <div
                        className={`w-20 h-20 rounded-[1.5rem] border-2 flex items-center justify-center transition-all duration-500 
                              ${isCompleted
                            ? 'bg-black border-black text-white shadow-lg opacity-100 scale-105'
                            : 'bg-white border-zinc-600 text-zinc-600'}`}
                      >
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 12h12" />
                          <path d="M6 7v10" />
                          <path d="M3 9v6" />
                          <path d="M18 7v10" />
                          <path d="M21 9v6" />
                        </svg>
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-widest transition-colors text-zinc-600`}>Série {i + 1}</span>
                    </div>

                    {/* Ícone de Descanso entre Séries */}
                    {i < parseValue(getFlattenedExercises(activeSessionWorkout)[currentExIdx].details.sets) - 1 && (
                      <div className={`flex flex-col items-center justify-center py-4 px-2 transition-all duration-500 ${isRestCompleted ? 'text-sky-400 opacity-100' : 'text-zinc-400 opacity-100'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Cronômetro Circular de Descanso com Controles Robustos */}
            {isResting ? (
              <div className="animate-fadeIn flex flex-col items-center gap-10">
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="#f1f5f9" strokeWidth="4" fill="transparent" />
                    <circle cx="50" cy="50" r="45" stroke="#3b82f6" strokeWidth="4" fill="transparent" strokeDasharray="283" strokeDashoffset={283 - (283 * timeLeft) / totalRestTime} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
                  </svg>
                  <div className="flex flex-col items-center">
                    <span className="text-6xl font-black text-slate-800 font-mono tracking-tighter">{timeLeft}s</span>
                    <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mt-2">Intervalo</span>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <button
                    onClick={() => {
                      setTimeLeft(totalRestTime);
                      setIsTimerPaused(true);
                    }}
                    title="Reiniciar tempo"
                    className="w-12 h-12 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-black hover:border-black transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>

                  <button
                    onClick={() => setIsTimerPaused(!isTimerPaused)}
                    className="w-16 h-16 rounded-3xl bg-black text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all"
                  >
                    {isTimerPaused ? (
                      <svg className="w-8 h-8 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    ) : (
                      <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
                    )}
                  </button>

                  <button
                    onClick={() => setIsResting(false)}
                    title="Pular descanso"
                    className="w-12 h-12 rounded-2xl bg-slate-50 border-2 border-slate-100 flex items-center justify-center text-slate-400 hover:text-black hover:border-black transition-all"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                  </button>
                </div>
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Controles de Descanso</span>
              </div>
            ) : (
              <button
                onClick={handleSetCompletion}
                className="w-full max-w-[280px] py-6 bg-green-600 text-white rounded-[2.5rem] font-black text-xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-2"
              >
                <span>{currentSetIdx === parseValue(getFlattenedExercises(activeSessionWorkout)[currentExIdx].details.sets) - 1 ? 'Concluir Exercício' : 'Concluir Série'}</span>
              </button>
            )}

            <div className="mt-20 pt-12 border-t-2 border-slate-50 w-full flex justify-between items-center text-slate-300">
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Exercício Atual</span>
                <span className="text-2xl font-black text-zinc-600">{currentSetIdx + 1} de {getFlattenedExercises(activeSessionWorkout).length > 0 ? getFlattenedExercises(activeSessionWorkout)[currentExIdx].details.sets : 0}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Alvo de Repetições</span>
                <span className="text-2xl font-black text-zinc-600">{getFlattenedExercises(activeSessionWorkout).length > 0 ? getFlattenedExercises(activeSessionWorkout)[currentExIdx].details.reps : 0}</span>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Post Workout Weights Input */}
      {view === 'gym_weights' && activeSessionWorkout && createPortal(
        <div className="fixed inset-0 z-[10000] bg-white overflow-y-auto flex flex-col p-8 sm:p-12 animate-fadeIn">
          <div className="max-w-xl mx-auto w-full flex flex-col items-center">
            <div className="w-24 h-24 bg-green-50 text-green-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter text-center mb-4">Treino Finalizado!</h2>
            <p className="text-slate-400 font-bold text-center mb-12">Quanto de carga você usou em cada exercício hoje?</p>

            <div className="w-full space-y-6 mb-16">
              {getFlattenedExercises(activeSessionWorkout).map((ex, i) => (
                <div key={i} className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 flex items-center justify-between gap-6 group focus-within:border-black transition-all">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{ex.subGroup}</span>
                    <span className="text-lg font-black text-slate-800">{ex.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="0"
                      value={weightsInput[ex.name] || ''}
                      onFocus={(e) => {
                        if (weightsInput[ex.name] === '0') setWeightsInput({ ...weightsInput, [ex.name]: '' });
                        e.currentTarget.placeholder = '';
                      }}
                      onBlur={(e) => { e.currentTarget.placeholder = '0'; }}
                      onChange={(e) => setWeightsInput({ ...weightsInput, [ex.name]: e.target.value })}
                      className="w-24 p-3 bg-white border-2 border-zinc-600 rounded-xl font-black text-center text-xl text-zinc-600 outline-none focus:border-black transition-all"
                    />
                    <span className="font-black text-slate-300">KG</span>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={saveHistory}
              className="w-full py-6 bg-black text-white rounded-[1.5rem] font-black text-xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
            >
              Finalizar e Salvar
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Gym History & Stats View */}
      {view === 'gym_history' && (
        <div className="animate-fadeIn max-w-5xl mx-auto flex flex-col items-center">
          <BackButton to="gym_choice" />
          <h2 className={`text-4xl font-black ${textColor} mb-8 uppercase tracking-tighter`}>Histórico estatística</h2>

          {/* Tabs Control */}
          <div className="flex gap-4 mb-12 bg-white p-1.5 border-2 border-black rounded-3xl shadow-lg">
            <button
              onClick={() => setHistoryTab('done_workouts')}
              className={`px-12 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${historyTab === 'done_workouts' ? 'bg-black text-white' : 'bg-transparent text-slate-400 hover:bg-slate-50'}`}
            >
              Treinos feitos
            </button>
            <button
              onClick={() => setHistoryTab('stats')}
              className={`px-12 py-3 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${historyTab === 'stats' ? 'bg-black text-white' : 'bg-transparent text-slate-400 hover:bg-slate-50'}`}
            >
              Estatísticas
            </button>
          </div>

          <div className="w-full">
            {historyTab === 'done_workouts' ? (
              gymHistory.filter(h => h.visible !== false).length === 0 ? (
                <div className="text-center py-20 flex flex-col items-center opacity-30">
                  <svg className="w-24 h-24 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <h3 className="text-xl font-black uppercase">Nenhum treino no histórico</h3>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full pb-10">
                  {gymHistory.filter(h => h.visible !== false).map(entry => (
                    <div key={entry.id} className="bg-white border-2 border-black rounded-[2rem] p-5 shadow-sm relative group hover:scale-[1.01] transition-transform">
                      <div className="flex justify-between items-start mb-4">
                        <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg font-black text-[9px] text-slate-500 uppercase tracking-widest">
                          {entry.date}
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex flex-wrap gap-1 justify-end">
                            {entry.muscles.map(m => (
                              <span key={m} className="px-2 py-0.5 bg-black text-white rounded-md font-black text-[8px] uppercase tracking-widest">
                                {m}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {entry.subMuscles && entry.subMuscles.length > 0 && (
                        <div className="mb-4 flex flex-wrap gap-1">
                          {entry.subMuscles.map(sub => (
                            <span key={sub} className="px-2 py-0.5 border border-slate-200 text-slate-500 rounded-md font-bold text-[8px] uppercase">
                              {sub}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto custom-scrollbar pr-1">
                        {entry.weights && Object.entries(entry.weights).map(([exName, weight]) => (
                          <div key={exName} className="flex justify-between items-center p-2 border border-slate-100 rounded-xl bg-slate-50/50">
                            <span className="font-bold text-slate-700 text-[10px] truncate pr-2">{exName}</span>
                            <span className="font-black text-blue-600 text-[10px] whitespace-nowrap">{weight || 0} kg</span>
                          </div>
                        ))}
                      </div>

                      <button
                        onClick={() => {
                          // Soft delete: hide from list but keep for stats
                          const updated = gymHistory.map(h => h.id === entry.id ? { ...h, visible: false } : h);
                          setGymHistory(updated);
                          localStorage.setItem('produtivity_others_gym_history', JSON.stringify(updated));
                        }}
                        className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 w-8 h-8 flex items-center justify-center bg-white text-red-500 hover:bg-red-500 hover:text-white rounded-full border-2 border-slate-100 hover:border-red-500 transition-all shadow-md z-10"
                        title="Remover do histórico (mantém estatísticas)"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
              )
            ) : (
              renderStatsAba()
            )}
          </div>
        </div>
      )}

      {/* Gym Manage View (Entry point for library management) */}
      {view === 'gym_manage' && (
        <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
          <BackButton to="gym_choice" />
          <h2 className={`text-4xl font-black ${textColor} mb-12 uppercase tracking-tighter`}>Gerenciar Biblioteca</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl px-4">
            <button
              onClick={() => {
                setMgmtGroup(''); setMgmtLocal(''); setMgmtExercise('');
                setView('gym_edit_library');
              }}
              className="bg-white border-2 border-black p-4 rounded-[1.5rem] flex flex-col items-center gap-2 hover:bg-black hover:text-white transition-all shadow-lg group"
            >
              <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-white/20 text-black group-hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              </div>
              <span className="font-black text-xs uppercase tracking-widest">Editar Exercícios</span>
            </button>
            <button
              onClick={() => {
                setMgmtGroup(''); setMgmtLocal(''); setNewExName('');
                setMgmtType('isolados');
                setView('gym_add_to_library');
              }}
              className="bg-white border-2 border-black p-4 rounded-[1.5rem] flex flex-col items-center gap-2 hover:bg-black hover:text-white transition-all shadow-lg group"
            >
              <div className="p-2 rounded-xl bg-slate-50 group-hover:bg-white/20 text-black group-hover:text-white transition-all">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </div>
              <span className="font-black text-xs uppercase tracking-widest">Adicionar Exercícios</span>
            </button>
          </div>
        </div>
      )}

      {/* Gym Edit Library (Cascading selects to delete) */}
      {view === 'gym_edit_library' && (
        <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
          <BackButton to="gym_manage" />
          <h2 className={`text-3xl font-black ${textColor} mb-12 uppercase tracking-tighter`}>Editar Exercícios da Biblioteca</h2>

          <div className="w-full space-y-10 bg-white border-2 border-black rounded-[3rem] p-10 shadow-2xl">
            {/* Box 1: Grupamento */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">1. Grupamento Muscular</label>
              <select
                value={mgmtGroup}
                onChange={(e) => { setMgmtGroup(e.target.value); setMgmtLocal(''); setMgmtExercise(''); }}
                className="w-full p-6 border-2 border-black rounded-2xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all cursor-pointer appearance-none text-slate-800"
              >
                <option value="">Selecione um grupamento...</option>
                {muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Box 2: Local */}
            {mgmtGroup && (
              <div className="space-y-4 animate-fadeIn">
                <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">2. Local Específico</label>
                <select
                  value={mgmtLocal}
                  onChange={(e) => { setMgmtLocal(e.target.value); setMgmtExercise(''); }}
                  className="w-full p-6 border-2 border-black rounded-2xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all cursor-pointer appearance-none text-slate-800"
                >
                  <option value="">Selecione o local...</option>
                  {muscleSubGroups[mgmtGroup]?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Box 3: Exercício */}
            {mgmtLocal && (
              <div className="space-y-4 animate-fadeIn">
                <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">3. Exercício</label>
                <div className="flex flex-col sm:flex-row gap-4">
                  <select
                    value={mgmtExercise}
                    onChange={(e) => setMgmtExercise(e.target.value)}
                    className="flex-1 p-6 border-2 border-black rounded-2xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all cursor-pointer appearance-none text-slate-800"
                  >
                    <option value="">Selecione o exercício...</option>
                    {gymDb[mgmtLocal]?.isolados.map(ex => <option key={ex.name} value={ex.name}>{ex.name} (Isolado)</option>)}
                    {gymDb[mgmtLocal]?.multi.map(ex => <option key={ex.name} value={ex.name}>{ex.name} (Multi)</option>)}
                  </select>

                  {mgmtExercise && (
                    <button
                      onClick={() => setExerciseToDelete({ local: mgmtLocal, name: mgmtExercise })}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      Excluir
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gym Add To Library View */}
      {view === 'gym_add_to_library' && (
        <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
          <BackButton to="gym_manage" />
          <h2 className={`text-3xl font-black ${textColor} mb-12 uppercase tracking-tighter`}>Adicionar Novo Exercício</h2>

          <div className="w-full space-y-10 bg-white border-2 border-black rounded-[3rem] p-10 shadow-2xl">
            {/* 1. Escolha o Grupamento (Caminho Exclusivo) */}
            <div className="space-y-4">
              <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">1. Escolha o Grupamento</label>
              <select
                value={mgmtGroup}
                onChange={(e) => {
                  setMgmtGroup(e.target.value);
                  setMgmtLocal(''); // Limpa local ao trocar grupamento
                }}
                className="w-full p-5 border-2 border-black rounded-2xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
              >
                <option value="">Selecione...</option>
                {muscleGroups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* 2. Escolha o Local (Filtrado pelo Grupamento) */}
            {mgmtGroup && (
              <div className="space-y-4 animate-fadeIn">
                <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">2. Escolha o Local</label>
                <select
                  value={mgmtLocal}
                  onChange={(e) => setMgmtLocal(e.target.value)}
                  className="w-full p-5 border-2 border-black rounded-2xl font-black text-lg outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
                >
                  <option value="">Selecione...</option>
                  {muscleSubGroups[mgmtGroup]?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* 3. Tipo e Nome do Exercício */}
            {mgmtLocal && (
              <div className="space-y-8 animate-fadeIn">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">3. Tipo de Exercício</label>
                  <div className="flex gap-4">
                    <button onClick={() => setMgmtType('isolados')} className={`flex-1 py-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${mgmtType === 'isolados' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100 hover:border-black'}`}>Isolado</button>
                    <button onClick={() => setMgmtType('multi')} className={`flex-1 py-4 rounded-xl border-2 font-black text-xs uppercase transition-all ${mgmtType === 'multi' ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100 hover:border-black'}`}>Multiarticulado</button>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest">4. Nome do Exercício</label>
                  <input
                    type="text"
                    value={newExName}
                    onChange={(e) => setNewExName(e.target.value)}
                    placeholder="Ex: Leg Press 45º"
                    className="w-full p-5 border-2 border-black rounded-2xl font-black text-xl outline-none placeholder:text-slate-200 bg-white text-black"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest leading-none">Quantidade de Série Recomendada</label>
                    <input
                      type="text"
                      value={newExSets}
                      onChange={(e) => setNewExSets(e.target.value)}
                      className="w-full p-4 border-2 border-black rounded-xl font-black text-center text-lg bg-white text-black"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest leading-none">Quantidade de Repetição Recomendada</label>
                    <input
                      type="text"
                      value={newExReps}
                      onChange={(e) => setNewExReps(e.target.value)}
                      className="w-full p-4 border-2 border-black rounded-xl font-black text-center text-lg bg-white text-black"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-[#4A69A2] uppercase tracking-widest leading-none">Descanso/Série Recomendada (s)</label>
                    <input
                      type="text"
                      value={newExRest}
                      onChange={(e) => setNewExRest(e.target.value)}
                      className="w-full p-4 border-2 border-black rounded-xl font-black text-center text-lg bg-white text-black"
                    />
                  </div>
                </div>

                <button
                  onClick={handleAddExerciseToLibrary}
                  className="w-full py-6 bg-blue-600 text-white rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-xl hover:scale-105 active:scale-95 transition-all"
                >
                  Adicionar à Biblioteca
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Confirmação de Exclusão de Exercício da Biblioteca */}
      {exerciseToDelete && (
        <div className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center border-2 border-black">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Excluir Exercício?</h3>
            <p className="text-slate-500 font-bold mb-8 text-xs">Tem certeza que deseja apagar o exercício "{exerciseToDelete.name}" da sua biblioteca?</p>
            <div className="flex gap-4">
              <button onClick={() => setExerciseToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-black uppercase text-xs">Não</button>
              <button onClick={handleDeleteExerciseFromLibrary} className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl uppercase text-xs shadow-lg">Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}

      {noteToDelete && (
        <div className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center border-2 border-black">
            <h3 className="text-xl font-black text-slate-800 mb-4">Excluir Nota?</h3>
            <div className="flex gap-4">
              <button onClick={() => setNoteToDelete(null)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-black">Não</button>
              <button onClick={() => { saveNotes(notes.filter(n => n.id !== noteToDelete.id)); setNoteToDelete(null); }} className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl">Sim</button>
            </div>
          </div>
        </div>
      )}

      {categoryToDelete && (
        <div className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center border-2 border-black">
            <h3 className="text-xl font-black text-slate-800 mb-4">Excluir categoria?</h3>
            <div className="flex gap-4">
              <button onClick={() => setCategoryToDelete(null)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl text-black">Não</button>
              <button onClick={() => { saveCategories(categories.filter(c => c.id !== categoryToDelete.id)); setCategoryToDelete(null); }} className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl">Sim</button>
            </div>
          </div>
        </div>
      )}

      {workoutToDelete && (
        <div className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-sm w-full text-center border-2 border-black">
            <h3 className="text-xl font-black text-slate-800 mb-2 uppercase tracking-tighter">Excluir Treino?</h3>
            <p className="text-slate-500 font-bold mb-8 text-xs">Tem certeza que deseja apagar o treino de {workoutToDelete.day}?</p>
            <div className="flex gap-4">
              <button onClick={() => setWorkoutToDelete(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl text-black uppercase text-xs">Não</button>
              <button onClick={() => deleteWorkout(workoutToDelete.id)} className="flex-1 py-3 bg-red-500 text-white font-black rounded-xl uppercase text-xs">Sim</button>
            </div>
          </div>
        </div>
      )}

      {showFinExpenseSaveModal && (
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full border-2 border-black text-center">
            <h3 className="text-lg font-black text-slate-800 mb-1">Organizar</h3>
            <p className="text-slate-400 font-bold mb-6 text-[8px] uppercase tracking-widest">Escolha a categoria:</p>
            {finExpenseSaveStep === 'initial' && (
              <div className="flex gap-3">
                <button onClick={() => { setTempFinExpenseCatSelection(null); setFinExpenseSaveStep('confirm'); }} className="flex-1 py-3 px-2 rounded-xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase hover:bg-slate-200 transition-all">Nenhuma</button>
                <button onClick={() => setFinExpenseSaveStep('picking')} className="flex-1 py-3 px-2 rounded-xl bg-[#1e293b] text-white font-black text-[10px] uppercase hover:bg-black transition-all">Escolher</button>
              </div>
            )}
            {finExpenseSaveStep === 'picking' && (
              <div className="animate-fadeIn">
                {financesCategories.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-slate-400 font-bold mb-4 text-[10px]">Sem categorias salvas.</p>
                    <div className="flex gap-3">
                      <button onClick={() => { setTempFinExpenseCatSelection(null); setFinExpenseSaveStep('confirm'); }} className="flex-1 py-3 bg-black text-white rounded-xl font-black text-[10px] uppercase">Salvar</button>
                      <button onClick={() => setShowFinExpenseSaveModal(false)} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-4 pr-1 custom-scrollbar">
                      {financesCategories.filter(cat => cat.financeType === 'expense').map(cat => (
                        <button key={cat.id} onClick={() => { setTempFinExpenseCatSelection(cat); setFinExpenseSaveStep('confirm'); }} style={{ backgroundColor: cat.color }} className="w-full p-3 rounded-xl text-white font-black text-left text-xs shadow-sm hover:brightness-90 transition-all border border-transparent active:border-black">{cat.name}</button>
                      ))}
                    </div>
                    <button onClick={() => setFinExpenseSaveStep('initial')} className="w-full py-2 text-slate-400 font-bold text-[9px] uppercase tracking-widest">Voltar</button>
                  </>
                )}
              </div>
            )}
            {finExpenseSaveStep === 'confirm' && (
              <div className="animate-fadeIn">
                <div className="p-4 rounded-xl border border-solid border-slate-200 mb-4 text-center">
                  <span className="text-[9px] font-black text-slate-300 uppercase block mb-1">CATEGORIA:</span>
                  <span className="font-black text-base" style={{ color: tempFinExpenseCatSelection?.color || '#94a3b8' }}>{tempFinExpenseCatSelection?.name || 'Nenhuma'}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const newRecord: FinanceRecord = {
                        id: Math.random().toString(36).substr(2, 9),
                        type: 'expense',
                        name: finExpenseName,
                        value: finExpenseValue,
                        effort: finExpenseEffort,
                        necessity: finExpenseNecessity,
                        mood: finExpenseMood,
                        moodOther: finExpenseMoodOther,
                        canGrow: finExpenseCanGrow,
                        recurrence: finExpenseRecurrence,
                        period: finExpensePeriod,
                        categoryId: tempFinExpenseCatSelection?.id,
                        categoryName: tempFinExpenseCatSelection?.name,
                        categoryColor: tempFinExpenseCatSelection?.color,
                        date: new Date().toLocaleDateString('pt-BR')
                      };
                      saveFinanceRecords([...financeRecords, newRecord]);
                      resetFinExpenseForm();
                      setShowFinExpenseSaveModal(false);
                      setView('finances_expenses');
                    }}
                    className="flex-1 py-3 bg-black text-white font-black rounded-xl text-[10px] uppercase"
                  >
                    Salvar
                  </button>
                  <button onClick={() => setFinExpenseSaveStep('initial')} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase">Voltar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showFinIncomeSaveModal && (
        <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl max-w-sm w-full border-2 border-black text-center">
            <h3 className="text-lg font-black text-slate-800 mb-1">Organizar</h3>
            <p className="text-slate-400 font-bold mb-6 text-[8px] uppercase tracking-widest">Escolha a categoria:</p>
            {finIncomeSaveStep === 'initial' && (
              <div className="flex gap-3">
                <button
                  onClick={() => { setTempFinIncomeCatSelection(null); setFinIncomeSaveStep('confirm'); }}
                  className="flex-1 py-3 px-2 rounded-xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase hover:bg-slate-200 transition-all font-sans"
                >
                  Nenhuma
                </button>
                <button
                  onClick={() => setFinIncomeSaveStep('picking')}
                  className="flex-1 py-3 px-2 rounded-xl bg-[#1e293b] text-white font-black text-[10px] uppercase hover:bg-black transition-all font-sans"
                >
                  Escolher
                </button>
              </div>
            )}
            {finIncomeSaveStep === 'picking' && (
              <div className="animate-fadeIn">
                {financesCategories.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-slate-400 font-bold mb-4 text-[10px]">Sem categorias salvas.</p>
                    <div className="flex gap-3 font-sans">
                      <button
                        onClick={() => { setTempFinIncomeCatSelection(null); setFinIncomeSaveStep('confirm'); }}
                        className="flex-1 py-3 bg-black text-white rounded-xl font-black text-[10px] uppercase"
                      >
                        Salvar
                      </button>
                      <button
                        onClick={() => setShowFinIncomeSaveModal(false)}
                        className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-40 overflow-y-auto mb-4 pr-1 custom-scrollbar">
                      {financesCategories.filter(cat => cat.financeType === 'income').map(cat => (
                        <button
                          key={cat.id}
                          onClick={() => { setTempFinIncomeCatSelection(cat); setFinIncomeSaveStep('confirm'); }}
                          style={{ backgroundColor: cat.color }}
                          className="w-full p-3 rounded-xl text-white font-black text-left text-xs shadow-sm hover:brightness-90 transition-all border border-transparent active:border-black"
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setFinIncomeSaveStep('initial')} className="w-full py-2 text-slate-400 font-bold text-[9px] uppercase tracking-widest font-sans">Voltar</button>
                  </>
                )}
              </div>
            )}
            {finIncomeSaveStep === 'confirm' && (
              <div className="animate-fadeIn">
                <div className="p-4 rounded-xl border border-solid border-slate-200 mb-4 text-center">
                  <span className="text-[9px] font-black text-slate-300 uppercase block mb-1">CATEGORIA:</span>
                  <span className="font-black text-base" style={{ color: tempFinIncomeCatSelection?.color || '#94a3b8' }}>
                    {tempFinIncomeCatSelection?.name || 'Nenhuma'}
                  </span>
                </div>
                <div className="flex gap-3 font-sans">
                  <button
                    onClick={() => {
                      const newRecord: FinanceRecord = {
                        id: Math.random().toString(36).substr(2, 9),
                        type: 'income',
                        name: finIncomeName,
                        value: finIncomeValue,
                        effort: finIncomeEffort,
                        canGrow: finIncomeCanGrow,
                        recurrence: finIncomeRecurrence,
                        period: finIncomePeriod,
                        categoryId: tempFinIncomeCatSelection?.id,
                        categoryName: tempFinIncomeCatSelection?.name,
                        categoryColor: tempFinIncomeCatSelection?.color,
                        date: new Date().toLocaleDateString('pt-BR')
                      };
                      saveFinanceRecords([...financeRecords, newRecord]);
                      resetFinIncomeForm();
                      setShowFinIncomeSaveModal(false);
                      setView('finances_income');
                    }}
                    className="flex-1 py-3 bg-black text-white font-black rounded-xl text-[10px] uppercase"
                  >
                    Salvar
                  </button>
                  <button onClick={() => setFinIncomeSaveStep('initial')} className="flex-1 py-3 bg-slate-100 text-slate-500 font-black rounded-xl text-[10px] uppercase">Voltar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!onOpenDetail && renderFinanceDetailModal()}

      {financeRecordToDelete && (
        <div className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-8 rounded-[3.5rem] shadow-2xl max-w-xs w-full border-2 border-black text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Excluir registro?</h3>
            <p className="text-slate-400 text-[10px] font-bold mb-8 uppercase tracking-widest leading-relaxed">Esta ação não pode ser desfeita e o registro será removido permanentemente.</p>
            <div className="flex gap-4">
              <button onClick={() => setFinanceRecordToDelete(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-400 font-black text-[10px] uppercase">Manter</button>
              <button
                onClick={() => {
                  saveFinanceRecords(financeRecords.filter(r => r.id !== financeRecordToDelete.id));
                  setFinanceRecordToDelete(null);
                }}
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase shadow-lg shadow-red-200"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showSaveModal && (
        <div className="fixed inset-0 z-[1500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 animate-fadeIn">
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-md w-full border-2 border-black">
            <h3 className="text-2xl font-black text-slate-800 mb-2">Salvar Nota</h3>
            {saveStep === 'initial' && (
              <div className="flex gap-4 mb-4">
                <button onClick={() => { setTempCatSelection(null); setSaveStep('confirm_save'); }} className="flex-1 py-6 px-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-sm">Nenhuma Categoria</button>
                <button onClick={() => setSaveStep('picking_cat')} className="flex-1 py-6 px-4 rounded-2xl bg-[#4A69A2] text-white font-black text-sm">Minhas Categorias</button>
              </div>
            )}
            {saveStep === 'picking_cat' && (
              <div className="space-y-3 mb-8 max-h-64 overflow-y-auto pr-2 custom-scrollbar animate-fadeIn">
                {categories.map(cat => (
                  <button key={cat.id} onClick={() => { setTempCatSelection(cat); setSaveStep('confirm_save'); }} style={{ backgroundColor: cat.color }} className="w-full py-4 px-6 rounded-2xl text-white font-black text-lg shadow-sm text-left">{cat.name}</button>
                ))}
                <button onClick={() => setSaveStep('initial')} className="w-full py-3 text-[#4A69A2] font-black text-xs uppercase tracking-widest mt-4">← Voltar</button>
              </div>
            )}
            {saveStep === 'confirm_save' && (
              <div className="animate-fadeIn">
                <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 mb-8 text-center">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">CATEGORIA SELECIONADA</p>
                  <span className="font-black text-xl" style={{ color: tempCatSelection?.color || '#94a3b8' }}>{tempCatSelection?.name || 'Nenhuma'}</span>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setShowSaveModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 font-black rounded-xl">Cancelar</button>
                  <button onClick={() => finalizeSaveNote(tempCatSelection || undefined)} className="flex-1 py-4 bg-black text-white font-black rounded-xl">Salvar</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'entry' && (
        <header className="mb-12">
          <h2 className={`text-5xl font-black ${textColor} tracking-tight`}>Outros</h2>
          <p className="text-slate-500 mt-3 font-medium text-lg">Ferramentas extras para impulsionar seu dia.</p>
        </header>
      )}

      {view === 'entry' && (
        <div className="flex flex-col items-center justify-center gap-12 py-12">
          <div className="flex flex-wrap justify-center gap-8 md:gap-10">
            <button onClick={generateMotivation} disabled={isLoadingMotivation} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
              <div className={`p-5 bg-[#4A69A2] rounded-3xl mb-3 transition-all duration-300 group-hover:bg-white ${isLoadingMotivation ? 'animate-spin' : ''}`}>
                <svg className="w-10 h-10 text-white group-hover:text-[#4A69A2]" fill="currentColor" viewBox="0 0 24 24"><path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white">{isLoadingMotivation ? 'Conectando...' : 'Motivar'}</span>
            </button>
            <button onClick={() => nutritionProfile ? setView('nutrition_dashboard') : setView('nutrition_onboarding')} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
              <div className="p-5 bg-[#4A69A2] rounded-3xl mb-3 transition-all duration-300 group-hover:bg-white">
                <svg className="w-10 h-10 text-white group-hover:text-[#4A69A2]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M11 9H9V2H7v7H5V2H3v7c0 2.12 1.66 3.84 3.75 3.97V22h2.5v-9.03C11.34 12.84 13 11.12 13 9V2h-2v7zm5-3v8h2.5v8H21V2c-2.76 0-5 2.24-5 4z" />
                </svg>
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white">Nutrição</span>
            </button>
            <button onClick={() => setView('list')} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
              <div className="p-5 bg-[#4A69A2] rounded-3xl mb-3 transition-all duration-300 group-hover:bg-white">
                <svg className="w-10 h-10 text-white group-hover:text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 012 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white">Notas</span>
            </button>
            <button onClick={() => setView('calculator')} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
              <div className="p-5 bg-[#4A69A2] rounded-3xl mb-3 transition-all duration-300 group-hover:bg-white">
                <svg className="w-10 h-10 text-white group-hover:text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white">Calculadora</span>
            </button>
            <button onClick={() => setView('gym_choice')} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
              <div className="p-5 bg-[#4A69A2] rounded-3xl mb-3 transition-all duration-300 group-hover:bg-white">
                <svg className="w-10 h-10 text-white group-hover:text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12h12" /><path d="M6 7v10" /><path d="M3 9v6" /><path d="M18 7v10" /><path d="M21 9v6" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white">Academia</span>
            </button>
            <button onClick={() => setView('finances')} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
              <div className="p-5 bg-[#4A69A2] rounded-3xl mb-3 transition-all duration-300 group-hover:bg-white">
                <svg className="w-10 h-10 text-white group-hover:text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white">Finanças</span>
            </button>
            <button onClick={() => setView('oratoria_setup')} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
              <div className="p-5 bg-[#4A69A2] rounded-3xl mb-3 transition-all duration-300 group-hover:bg-white">
                <svg className="w-10 h-10 text-white group-hover:text-[#4A69A2]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
              </div>
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest group-hover:text-white">Oratória</span>
            </button>

          </div>

          {motivation && (
            <div className={`max-w-2xl w-full text-center px-12 py-10 rounded-[3.5rem] border-4 relative animate-fadeIn shadow-lg ${cardBg} border-slate-100 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full border-2 bg-white border-slate-100 shadow-sm"><span className="text-2xl">✨</span></div>
              <p className="font-black italic text-2xl leading-relaxed tracking-tight">"{motivation}"</p>
            </div>
          )}
        </div>
      )}

      {view === 'calculator' && renderCalculator()}
      {view === 'calculator_percent' && renderPercentTool()}
      {view === 'finances' && renderFinancesMenu()}
      {view === 'finances_income' && (
        <div className="flex flex-col items-center justify-center pt-4 pb-20 animate-fadeIn text-center w-full">
          {StudyStyleHeader({
            onBack: () => setView('finances'),
            onHome: () => setView('finances'),
            rightContent: (
              <div className="flex flex-col gap-4 items-end">
                <div className="flex gap-3">
                  <button
                    onClick={() => setView('finances_income_form')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-2xl font-black transition-all shadow-lg hover:scale-105 active:scale-95 uppercase text-[10px] tracking-[0.2em]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar receita
                  </button>
                  <button
                    onClick={() => setView('finances_income_list')}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#4A69A2] text-white rounded-2xl font-black transition-all shadow-lg hover:scale-105 active:scale-95 uppercase text-[10px] tracking-[0.2em]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Minhas receitas
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setFinMonthlyOverviewBack('finances_income');
                      const savedInc = localStorage.getItem('fin_monthly_income_data');
                      setFinMonthlyOverviewReadOnly(!!savedInc);
                      setView('finances_monthly_overview');
                    }}
                    className="flex items-center justify-center px-4 py-1.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider bg-slate-200 text-slate-600 hover:bg-slate-300"
                  >
                    Meu mês
                  </button>
                  <button
                    onClick={() => { setActiveFinMode('income'); setView('finances_categories'); }}
                    className="flex items-center justify-center px-4 py-1.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider bg-slate-200 text-slate-600 hover:bg-slate-300"
                  >
                    Categorias
                  </button>
                </div>
              </div>
            )
          })}
          {/* Income Charts */}
          {(() => {
            const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
            const parseRecordDate = (s: string) => { const p = s.split('/'); if (p.length !== 3) return null; return { day: parseInt(p[0], 10), month: parseInt(p[1], 10), year: parseInt(p[2], 10) }; };
            const getWeeksLocal = (year: number, month: number) => { const wks: { start: Date; end: Date; label: string }[] = []; let d = new Date(year, month - 1, 1); let n = 1; while (d.getMonth() === month - 1) { const s = new Date(d); const e = new Date(d); e.setDate(e.getDate() + (6 - e.getDay())); const eom = new Date(year, month, 0); if (e > eom) e.setTime(eom.getTime()); wks.push({ start: new Date(s), end: new Date(e), label: `Semana ${n}` }); d = new Date(e); d.setDate(d.getDate() + 1); n++; } return wks; };
            const periodLabelMap: Record<string, string[]> = { bimestral: ['Jan–Fev', 'Mar–Abr', 'Mai–Jun', 'Jul–Ago', 'Set–Out', 'Nov–Dez'], trimestral: ['Jan–Mar', 'Abr–Jun', 'Jul–Set', 'Out–Dez'], semestral: ['Jan–Jun', 'Jul–Dez'] };
            const periodMaxMap: Record<string, number> = { bimestral: 6, trimestral: 4, semestral: 2 };
            const pv = (r: typeof financeRecords[0]) => parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
            const incRecs = financeRecords.filter(r => r.type === 'income');
            // Bar chart setup
            const setBarMode = (mode: typeof finIncBarPeriodMode) => { setFinIncBarPeriodMode(mode); setFinIncBarWeekIdx(0); setFinIncBarPeriodIdx(1); setFinIncChartBarAnimKey(k => k + 1); };
            const navBY = (dir: -1 | 1) => { const ny = finIncBarYear + dir; if (ny < 2026 || ny > 2028) return; setFinIncBarYear(ny); setFinIncChartBarAnimKey(k => k + 1); };
            const navBM = (dir: -1 | 1) => { const nm = finIncBarMonth + dir; if (nm < 1 || nm > 12) return; setFinIncBarMonth(nm); setFinIncBarWeekIdx(0); setFinIncChartBarAnimKey(k => k + 1); };
            const barWks = getWeeksLocal(finIncBarYear, finIncBarMonth); const safeBarWIdx = Math.min(finIncBarWeekIdx, barWks.length - 1); const barCurWk = barWks[safeBarWIdx] || barWks[0];
            const navBW = (dir: -1 | 1) => { const ni = safeBarWIdx + dir; if (ni >= 0 && ni < barWks.length) { setFinIncBarWeekIdx(ni); setFinIncChartBarAnimKey(k => k + 1); } };
            const navBPI = (dir: -1 | 1) => { const max = periodMaxMap[finIncBarPeriodMode] || 1; const ni = finIncBarPeriodIdx + dir; if (ni < 1 || ni > max) return; setFinIncBarPeriodIdx(ni); setFinIncChartBarAnimKey(k => k + 1); };
            const getBarData = () => {
              let bars: { label: string; value: number }[] = [];
              if (finIncBarPeriodMode === 'semanal') {
                bars = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 })); const ws = barCurWk; if (ws) { const st = new Date(ws.start); st.setHours(0, 0, 0, 0); const en = new Date(ws.end); en.setHours(23, 59, 59, 999); incRecs.forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); if (dt >= st && dt <= en) { const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1; bars[idx].value += pv(r); } }); }
              } else if (finIncBarPeriodMode === 'mensal') {
                const ws = getWeeksLocal(finIncBarYear, finIncBarMonth); bars = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && d.month === finIncBarMonth; }).forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); const wi = ws.findIndex(w => { const s = new Date(w.start); s.setHours(0, 0, 0, 0); const e = new Date(w.end); e.setHours(23, 59, 59, 999); return dt >= s && dt <= e; }); if (wi !== -1) bars[wi].value += pv(r); });
              } else if (finIncBarPeriodMode === 'bimestral') {
                const m1 = (finIncBarPeriodIdx - 1) * 2 + 1; bars = [{ label: monthNames[m1 - 1].slice(0, 3), value: 0 }, { label: monthNames[m1].slice(0, 3), value: 0 }]; incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && (d.month === m1 || d.month === m1 + 1); }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv(r); });
              } else if (finIncBarPeriodMode === 'trimestral') {
                const m1 = (finIncBarPeriodIdx - 1) * 3 + 1; bars = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && d.month >= m1 && d.month <= m1 + 2; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv(r); });
              } else if (finIncBarPeriodMode === 'semestral') {
                const m1 = (finIncBarPeriodIdx - 1) * 6 + 1; bars = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && d.month >= m1 && d.month <= m1 + 5; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv(r); });
              } else { bars = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - 1].value += pv(r); }); }
              return bars;
            };
            const barData = getBarData(); const maxBarVal = Math.max(...barData.map(b => b.value), 1); const barTotal = barData.reduce((s, b) => s + b.value, 0);
            const barYMin = finIncBarYear <= 2026, barYMax = finIncBarYear >= 2028, barPMax = periodMaxMap[finIncBarPeriodMode] || 1, barPMin = finIncBarPeriodIdx <= 1, barPMaxb = finIncBarPeriodIdx >= barPMax, barMMin = finIncBarMonth === 1, barMMax = finIncBarMonth === 12, barWMin = safeBarWIdx === 0 && barMMin, barWMax = safeBarWIdx === barWks.length - 1 && barMMax;
            // Line chart setup
            const setLineMode = (mode: typeof finIncLinePeriodMode) => { setFinIncLinePeriodMode(mode); setFinIncLineWeekIdx(0); setFinIncLinePeriodIdx(1); setFinIncChartLineAnimKey(k => k + 1); };
            const navLY = (dir: -1 | 1) => { const ny = finIncLineYear + dir; if (ny < 2026 || ny > 2028) return; setFinIncLineYear(ny); setFinIncChartLineAnimKey(k => k + 1); };
            const navLM = (dir: -1 | 1) => { const nm = finIncLineMonth + dir; if (nm < 1 || nm > 12) return; setFinIncLineMonth(nm); setFinIncLineWeekIdx(0); setFinIncChartLineAnimKey(k => k + 1); };
            const lineWks = getWeeksLocal(finIncLineYear, finIncLineMonth); const safeLineWIdx = Math.min(finIncLineWeekIdx, lineWks.length - 1); const lineCurWk = lineWks[safeLineWIdx] || lineWks[0];
            const navLW = (dir: -1 | 1) => { const ni = safeLineWIdx + dir; if (ni >= 0 && ni < lineWks.length) { setFinIncLineWeekIdx(ni); setFinIncChartLineAnimKey(k => k + 1); } };
            const navLPI = (dir: -1 | 1) => { const max = periodMaxMap[finIncLinePeriodMode] || 1; const ni = finIncLinePeriodIdx + dir; if (ni < 1 || ni > max) return; setFinIncLinePeriodIdx(ni); setFinIncChartLineAnimKey(k => k + 1); };
            const getLineData = () => {
              let pts: { label: string; value: number }[] = [];
              if (finIncLinePeriodMode === 'semanal') {
                pts = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 })); const ws = lineCurWk; if (ws) { const st = new Date(ws.start); st.setHours(0, 0, 0, 0); const en = new Date(ws.end); en.setHours(23, 59, 59, 999); incRecs.forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); if (dt >= st && dt <= en) { const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1; pts[idx].value += pv(r); } }); }
              } else if (finIncLinePeriodMode === 'mensal') {
                const ws = getWeeksLocal(finIncLineYear, finIncLineMonth); pts = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month === finIncLineMonth; }).forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); const wi = ws.findIndex(w => { const s = new Date(w.start); s.setHours(0, 0, 0, 0); const e = new Date(w.end); e.setHours(23, 59, 59, 999); return dt >= s && dt <= e; }); if (wi !== -1) pts[wi].value += pv(r); });
              } else if (finIncLinePeriodMode === 'bimestral') {
                const m1 = (finIncLinePeriodIdx - 1) * 2 + 1; pts = [0, 1].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month >= m1 && d.month <= m1 + 1; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts[d.month - m1].value += pv(r); });
              } else if (finIncLinePeriodMode === 'trimestral') {
                const m1 = (finIncLinePeriodIdx - 1) * 3 + 1; pts = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month >= m1 && d.month <= m1 + 2; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts[d.month - m1].value += pv(r); });
              } else if (finIncLinePeriodMode === 'semestral') {
                const m1 = (finIncLinePeriodIdx - 1) * 6 + 1; pts = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month >= m1 && d.month <= m1 + 5; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts[d.month - m1].value += pv(r); });
              } else { pts = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts[d.month - 1].value += pv(r); }); }
              return pts;
            };
            const lineData = getLineData(); const maxLineVal = Math.max(...lineData.map(p => p.value), 1); const lineTotal = lineData.reduce((s, p) => s + p.value, 0);
            const lineYMin = finIncLineYear <= 2026, lineYMax = finIncLineYear >= 2028, linePMax = periodMaxMap[finIncLinePeriodMode] || 1, linePMin = finIncLinePeriodIdx <= 1, linePMaxb = finIncLinePeriodIdx >= linePMax, lineMMin = finIncLineMonth === 1, lineMMax = finIncLineMonth === 12, lineWMin = safeLineWIdx === 0 && lineMMin, lineWMax = safeLineWIdx === lineWks.length - 1 && lineMMax;
            const periodModes: { key: typeof finIncBarPeriodMode; label: string }[] = [{ key: 'semanal', label: 'Semana' }, { key: 'mensal', label: 'Mês' }, { key: 'bimestral', label: 'Bimestre' }, { key: 'trimestral', label: 'Trimestre' }, { key: 'semestral', label: 'Semestre' }, { key: 'anual', label: 'Ano' }];
            const btn = (onClick: () => void, ch: string, dis?: boolean) => (<button onClick={dis ? undefined : onClick} className={`flex items-center justify-center transition-all font-black text-sm w-5 ${dis ? 'text-slate-300 cursor-not-allowed' : 'text-black hover:opacity-60 cursor-pointer'}`}>{ch}</button>);
            return (
              <div className="flex flex-col items-center gap-5 mt-6 w-full max-w-5xl px-4 pb-10">
                <div className="flex flex-col items-center justify-center gap-10 w-full mt-4">
                  {/* Meu Mês Circle Progress */}
                  {(() => {
                    const today = new Date();
                    const curM = today.getMonth() + 1;
                    const curY = today.getFullYear();
                    const monthTotal = financeRecords.filter(r => {
                      const d = parseRecordDate(r.date);
                      return r.type === 'income' && d && d.month === curM && d.year === curY;
                    }).reduce((s, r) => s + (parseFloat((r.value || '0').replace(/\./g, '').replace(',', '.')) || 0), 0);

                    const monthTotalExp = financeRecords.filter(r => {
                      const d = parseRecordDate(r.date);
                      return r.type === 'expense' && d && d.month === curM && d.year === curY;
                    }).reduce((s, r) => s + (parseFloat((r.value || '0').replace(/\./g, '').replace(',', '.')) || 0), 0);

                    const goal = parseFloat((finMonthIncomeValue || '0').replace(',', '.')) || 0;
                    const goalExp = parseFloat((finMonthExpenseValue || '0').replace(',', '.')) || 0;

                    const pontualVal = parseFloat((finMonthIncomePontualMeta || '0').replace(',', '.')) || 0;
                    const definidaVal = parseFloat((finMonthIncomeDefinidaMeta || '0').replace(',', '.')) || 0;

                    const pontualIncrease = pontualVal > goal ? pontualVal - goal : 0;
                    const definidaIncrease = definidaVal > goal ? definidaVal - goal : 0;

                    const pct = goal > 0 ? Math.min((monthTotal / goal) * 100, 100) : 0;
                    const pctExp = goalExp > 0 ? Math.min((monthTotalExp / goalExp) * 100, 100) : 0;

                    const pontualPct = goal > 0 ? (pontualIncrease / goal) * 100 : 0;
                    const definidaPct = goal > 0 ? (definidaIncrease / goal) * 100 : 0;

                    const radius = 70;
                    const circ = 2 * Math.PI * radius;
                    const offset = circ - (pct / 100) * circ;
                    const offsetExp = circ - (pctExp / 100) * circ;
                    const isOverBudget = goalExp > 0 && monthTotalExp > goalExp;

                    return (
                      <div className={`flex flex-col items-center gap-6 w-full max-w-3xl mb-12 transition-all duration-300`}>
                        <div className="flex flex-col items-center justify-center w-full border-b-2 border-slate-100 pb-4 mb-2 text-center relative min-h-[40px]">
                          <h3 className="text-xl font-black text-[#4A69A2] uppercase tracking-[0.2em] bg-blue-50/80 px-8 py-3 rounded-2xl border border-blue-100 shadow-sm text-center">Meu mês</h3>

                          <div className="absolute right-0 top-0 flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner gap-1">
                            <button
                              onClick={() => setFinIncMeuMesCompareMode(false)}
                              className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${!finIncMeuMesCompareMode ? 'bg-white text-slate-900 shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                            >
                              OFF
                            </button>
                            <button
                              onClick={() => setFinIncMeuMesCompareMode(true)}
                              className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${finIncMeuMesCompareMode ? 'bg-[#074221] text-white shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                            >
                              ON
                            </button>
                          </div>

                          {!finIncMeuMesCompareMode && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Recebido:</span>
                              <span className="text-xl font-black text-black">R$ {monthTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}
                        </div>

                        <div className={`flex ${finIncMeuMesCompareMode ? 'flex-col md:flex-row items-center justify-center gap-12 w-full' : 'flex-col items-center w-full'}`}>

                          {/* Main Chart (Income) */}
                          <div className="flex flex-col items-center w-full max-w-[200px]">
                            {finIncMeuMesCompareMode && (
                              <div className="flex items-center gap-2 mb-4 bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-100 w-full justify-center h-14">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Recebido:</span>
                                <span className="text-lg font-black text-black whitespace-nowrap">R$ {monthTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}

                            <div className="relative flex items-center justify-center w-48 h-48" key={`meu-mes-inc-${pct}-${goal}`}>
                              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                                <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
                                <circle
                                  cx="80" cy="80" r={radius} fill="none" stroke="#074221" strokeWidth="14"
                                  strokeDasharray={circ}
                                  strokeDashoffset={offset}
                                  strokeLinecap="round"
                                  style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                >
                                  <animate attributeName="stroke-dashoffset" from={circ} to={offset} dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                                </circle>
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-black text-[#074221] transition-all duration-500 scale-110">{pct.toFixed(0)}%</span>
                                <span className="text-[9px] font-bold text-slate-400 mt-2">Receita por mês:<br />R$ {goal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>

                            {!finIncMeuMesCompareMode && (
                              <div className="flex flex-col items-center gap-4 w-full mt-2 animate-fadeIn">
                                {pontualIncrease > 0 && (
                                  <div className="flex flex-col items-center gap-1 group">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Meta Pontual de Aumento</span>
                                    <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 transition-all hover:scale-105">
                                      <span className="text-sm font-black text-[#074221]">R$ {pontualIncrease.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                      <span className="text-[10px] font-black text-[#074221] opacity-70">({pontualPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span>
                                      {getMetaDateRange(finMonthIncomePontualSavedAt, finMonthIncomePontualType, finMonthIncomePontualAmount) && (
                                        <span className="text-[9px] font-bold text-[#074221] opacity-50 mt-0.5">
                                          {getMetaDateRange(finMonthIncomePontualSavedAt, finMonthIncomePontualType, finMonthIncomePontualAmount)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {definidaIncrease > 0 && (
                                  <div className="flex flex-col items-center gap-1 group">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Meta Definitiva de Aumento</span>
                                    <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100 transition-all hover:scale-105">
                                      <span className="text-sm font-black text-[#074221]">R$ {definidaIncrease.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                      <span className="text-[10px] font-black text-[#074221] opacity-70">({definidaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span>
                                      {getMetaDateRange(finMonthIncomeDefinidaSavedAt, finMonthIncomeDefinidaType, finMonthIncomeDefinidaAmount) && (
                                        <span className="text-[9px] font-bold text-[#074221] opacity-50 mt-0.5">
                                          {getMetaDateRange(finMonthIncomeDefinidaSavedAt, finMonthIncomeDefinidaType, finMonthIncomeDefinidaAmount)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Secondary Chart (Expense) - only if ON */}
                          {finIncMeuMesCompareMode && (
                            <div className="flex flex-col items-center w-full max-w-[200px] animate-fadeIn">
                              <div className="flex items-center gap-2 mb-4 bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-100 w-full justify-center h-14">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Gasto:</span>
                                <span className="text-lg font-black text-black whitespace-nowrap">R$ {monthTotalExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                              <div className="relative flex items-center justify-center w-48 h-48" key={`meu-mes-exp-comp-${pctExp}-${goalExp}`}>
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                                  <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
                                  <circle
                                    cx="80" cy="80" r={radius} fill="none"
                                    stroke="#610800" strokeWidth="14"
                                    strokeDasharray={circ}
                                    strokeDashoffset={offsetExp}
                                    strokeLinecap="round"
                                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                  >
                                    <animate attributeName="stroke-dashoffset" from={circ} to={offsetExp} dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                                  </circle>
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                  <span className="text-3xl font-black transition-all duration-500 scale-110 text-[#610800]">{pctExp.toFixed(0)}%</span>
                                  <span className="text-[9px] font-bold text-slate-400 mt-2">Despesa por mês:<br />R$ {goalExp.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Balance Information - Centered below charts */}
                        {finIncMeuMesCompareMode && (
                          <div className="flex flex-col items-center mt-6 p-4 bg-slate-50 border-2 border-slate-100 rounded-3xl w-full max-w-[240px] shadow-sm animate-fadeIn">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Saldo do Mês</span>
                            <span className="text-xl font-black" style={{ color: (monthTotal - monthTotalExp) >= 0 ? '#074221' : '#610800' }}>
                              R$ {(monthTotal - monthTotalExp).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Bar + Line Charts */}
                  <div className="flex flex-col w-full">
                    <div className="flex items-center justify-center gap-3 border-b-2 border-slate-100 pb-4 mb-6">
                      <h3 className="text-xl font-black text-[#4A69A2] uppercase tracking-[0.2em] bg-blue-50/80 px-8 py-3 rounded-2xl border border-blue-100 shadow-sm text-center">
                        {finIncCompareMode ? 'Receitas vs Despesas' : 'Evolução das receitas'}
                      </h3>
                      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner gap-1">
                        <button
                          onClick={() => setFinIncCompareMode(false)}
                          className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${!finIncCompareMode ? 'bg-white text-slate-900 shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                        >
                          OFF
                        </button>
                        <button
                          onClick={() => setFinIncCompareMode(true)}
                          className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${finIncCompareMode ? 'bg-[#074221] text-white shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                        >
                          ON
                        </button>
                      </div>
                    </div>
                    {finIncCompareMode && (
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#074221' }} /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Receitas</span></div>
                        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#610800' }} /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Despesas</span></div>
                      </div>
                    )}
                    <div className="flex flex-col xl:flex-row items-start gap-8 w-full">
                      {/* Bar Chart */}
                      <div className="flex flex-col items-center gap-6 w-full xl:flex-1">
                        <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-5">
                          <div className="flex flex-wrap gap-1.5 justify-center">{periodModes.map(pm => (<button key={`icb-${pm.key}`} onClick={() => setBarMode(pm.key)} className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest transition-all ${finIncBarPeriodMode === pm.key ? 'bg-[#074221] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-[#074221]/30'}`}>{pm.label}</button>))}</div>
                          <div className="flex flex-wrap gap-2 items-center justify-center">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navBY(-1), '<', barYMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[2.5rem] text-center">{finIncBarYear}</span>{btn(() => navBY(1), '>', barYMax)}</div>
                            {(finIncBarPeriodMode === 'semanal' || finIncBarPeriodMode === 'mensal') && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navBM(-1), '<', barMMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[3rem] text-center">{monthNames[finIncBarMonth - 1].slice(0, 3)}</span>{btn(() => navBM(1), '>', barMMax)}</div>)}
                            {finIncBarPeriodMode === 'semanal' && barCurWk && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navBW(-1), '<', barWMin)}<div className="flex flex-col items-center min-w-[5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{barCurWk.label}</span><span className="text-[8px] font-black text-slate-400">({String(barCurWk.start.getDate()).padStart(2, '0')}/{String(barCurWk.start.getMonth() + 1).padStart(2, '0')} – {String(barCurWk.end.getDate()).padStart(2, '0')}/{String(barCurWk.end.getMonth() + 1).padStart(2, '0')})</span></div>{btn(() => navBW(1), '>', barWMax)}</div>)}
                            {['bimestral', 'trimestral', 'semestral'].includes(finIncBarPeriodMode) && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navBPI(-1), '<', barPMin)}<div className="flex flex-col items-center min-w-[4.5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{finIncBarPeriodIdx}º {finIncBarPeriodMode === 'bimestral' ? 'Bim' : finIncBarPeriodMode === 'trimestral' ? 'Tri' : 'Sem'}</span><span className="text-[8px] font-black text-slate-400">({periodLabelMap[finIncBarPeriodMode]?.[finIncBarPeriodIdx - 1]})</span></div>{btn(() => navBPI(1), '>', barPMaxb)}</div>)}
                          </div>
                        </div>
                        {(() => {
                          if (!finIncCompareMode) {
                            // Original single-series bar chart
                            return barTotal === 0 ? (<div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64"><div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-3"><svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados no período.</p></div>) : (
                              <div className="relative w-full animate-fadeIn" style={{ paddingBottom: '60%' }} key={`icb-anim-${finIncChartBarAnimKey}`}>
                                <style>{`@keyframes growBarAnim { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
                                <div className="absolute inset-0 pt-[8.88%] pb-[15.55%] flex flex-col">
                                  <div className="w-full flex-1 flex items-end justify-between gap-1.5 px-2 border-b-2 border-slate-50 relative group">
                                    {barData.map((b, i) => {
                                      const hPercent = maxBarVal > 0 ? (b.value / maxBarVal) * 100 : 0;
                                      const isHov = finIncChartHoveredBar === i;
                                      const isZero = b.value === 0;
                                      return (
                                        <div key={i} className="group relative flex flex-col items-center flex-1 h-full justify-end cursor-pointer"
                                          onMouseEnter={() => setFinIncChartHoveredBar(i)} onMouseLeave={() => setFinIncChartHoveredBar(null)}>
                                          <div className={`absolute bottom-full mb-3 transition-all duration-300 pointer-events-none z-10 flex flex-col items-center ${isHov ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                            <div className="bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700">
                                              <span className="text-slate-400 block mb-0.5 uppercase tracking-widest text-[8px]">{b.label}</span>
                                              R$ {b.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                            <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700" />
                                          </div>
                                          <div className={`w-full max-w-[3rem] rounded-t-md transition-all duration-500 ${isZero ? 'bg-slate-100' : ''}`}
                                            style={{ backgroundColor: isZero ? undefined : isHov ? '#0a5c2e' : finIncChartHoveredBar !== null ? '#0d7a3e' : '#074221', height: isZero ? '4px' : `${Math.max(hPercent, 3)}%`, transformOrigin: 'bottom', animation: 'growBarAnim 0.8s cubic-bezier(0.4, 0, 0.2, 1) backwards' }}>
                                            {!isZero && isHov && <div className="w-full h-1 bg-white/30 rounded-t-md" />}
                                          </div>
                                          <span className={`absolute -bottom-6 text-[9px] font-black truncate w-full text-center transition-colors duration-300 ${isHov ? 'text-[#074221]' : 'text-slate-400'}`}>{b.label}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          // Compare mode: grouped bars
                          const expRecs = financeRecords.filter(r => r.type === 'expense');
                          const getExpBarData = () => {
                            let bars: { label: string; value: number }[] = [];
                            if (finIncBarPeriodMode === 'semanal') {
                              bars = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 }));
                              const ws = barCurWk; if (ws) { const st = new Date(ws.start); st.setHours(0, 0, 0, 0); const en = new Date(ws.end); en.setHours(23, 59, 59, 999); expRecs.forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); if (dt >= st && dt <= en) { const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1; bars[idx].value += pv(r); } }); }
                            } else if (finIncBarPeriodMode === 'mensal') {
                              const ws = getWeeksLocal(finIncBarYear, finIncBarMonth); bars = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 })); expRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && d.month === finIncBarMonth; }).forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); const wi = ws.findIndex(w => { const s = new Date(w.start); s.setHours(0, 0, 0, 0); const e = new Date(w.end); e.setHours(23, 59, 59, 999); return dt >= s && dt <= e; }); if (wi !== -1) bars[wi].value += pv(r); });
                            } else if (finIncBarPeriodMode === 'bimestral') {
                              const m1 = (finIncBarPeriodIdx - 1) * 2 + 1; bars = [{ label: monthNames[m1 - 1].slice(0, 3), value: 0 }, { label: monthNames[m1].slice(0, 3), value: 0 }]; expRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && (d.month === m1 || d.month === m1 + 1); }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv(r); });
                            } else if (finIncBarPeriodMode === 'trimestral') {
                              const m1 = (finIncBarPeriodIdx - 1) * 3 + 1; bars = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); expRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && d.month >= m1 && d.month <= m1 + 2; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv(r); });
                            } else if (finIncBarPeriodMode === 'semestral') {
                              const m1 = (finIncBarPeriodIdx - 1) * 6 + 1; bars = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); expRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear && d.month >= m1 && d.month <= m1 + 5; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv(r); });
                            } else { bars = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 })); expRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncBarYear; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - 1].value += pv(r); }); }
                            return bars;
                          };
                          const expBarData = getExpBarData();
                          const maxCmpVal = Math.max(...barData.map(b => b.value), ...expBarData.map(b => b.value), 1);
                          const hasCmpData = barData.some(b => b.value > 0) || expBarData.some(b => b.value > 0);
                          return !hasCmpData ? (<div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados no período.</p></div>) : (
                            <div className="relative w-full animate-fadeIn" style={{ paddingBottom: '60%' }} key={`icb-cmp-${finIncChartBarAnimKey}`}>
                              <style>{`@keyframes growBarAnim { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
                              <div className="absolute inset-0 pt-[8.88%] pb-[15.55%] flex flex-col">
                                <div className="w-full flex-1 flex items-end justify-between gap-1 px-1 border-b-2 border-slate-50 relative">
                                  {barData.map((inc, i) => {
                                    const exp = expBarData[i] || { value: 0 };
                                    const incH = maxCmpVal > 0 ? (inc.value / maxCmpVal) * 100 : 0;
                                    const expH = maxCmpVal > 0 ? (exp.value / maxCmpVal) * 100 : 0;
                                    const isHov = finIncChartHoveredBar === i;
                                    return (
                                      <div key={i} className="flex flex-col items-center flex-1 h-full justify-end gap-0.5 relative group/cmp"
                                        onMouseEnter={() => setFinIncChartHoveredBar(i)} onMouseLeave={() => setFinIncChartHoveredBar(null)}>
                                        <div className={`absolute bottom-full mb-3 transition-all duration-300 pointer-events-none z-20 flex flex-col items-center ${isHov ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                          {(() => {
                                            const diff = inc.value - exp.value;
                                            const isProfit = diff >= 0;
                                            const lbl = isProfit ? 'Lucro' : 'Despesa';
                                            const color = isProfit ? 'text-emerald-400' : 'text-[#610800]';
                                            return (
                                              <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-2 flex flex-col gap-1.5 min-w-[7rem]">
                                                <span className="text-slate-400 font-black uppercase tracking-widest text-[8px] border-b border-slate-700 pb-1 text-center">{inc.label}</span>
                                                <div className="flex justify-between items-center gap-3 text-[9px] font-black"><span style={{ color: '#074221' }}>Receita</span> <span className="text-white">R$ {inc.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                                <div className="flex justify-between items-center gap-3 text-[9px] font-black"><span style={{ color: '#610800' }}>Despesa</span> <span className="text-white">R$ {exp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                                <div className={`flex justify-between items-center gap-3 text-[10px] font-black pt-1 border-t border-slate-700 mt-0.5 ${color}`}><span className="uppercase">{lbl}</span> <span>R$ {Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                              </div>
                                            );
                                          })()}
                                          <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700" />
                                        </div>
                                        <div className="flex items-end gap-0.5 h-full w-full justify-center">
                                          <div className="flex flex-col items-center justify-end h-full flex-1 relative">
                                            <div className="w-full rounded-t-sm transition-all duration-300" style={{ backgroundColor: '#074221', height: inc.value === 0 ? '3px' : `${Math.max(incH, 3)}%`, transformOrigin: 'bottom', animation: 'growBarAnim 0.8s ease backwards', filter: isHov ? 'brightness(1.1)' : 'none' }} />
                                          </div>
                                          <div className="flex flex-col items-center justify-end h-full flex-1 relative">
                                            <div className="w-full rounded-t-sm transition-all duration-300" style={{ backgroundColor: '#610800', height: exp.value === 0 ? '3px' : `${Math.max(expH, 3)}%`, transformOrigin: 'bottom', animation: 'growBarAnim 0.8s ease backwards', filter: isHov ? 'brightness(1.1)' : 'none' }} />
                                          </div>
                                        </div>
                                        <span className={`absolute -bottom-6 text-[9px] font-black truncate w-full text-center transition-colors ${isHov ? 'text-[#074221]' : 'text-slate-400'}`}>{inc.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                      {/* Line Chart */}
                      <div className="flex flex-col items-center gap-6 w-full xl:flex-1">
                        <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-5">
                          <div className="flex flex-wrap gap-1.5 justify-center">{periodModes.map(pm => (<button key={`icl-${pm.key}`} onClick={() => setLineMode(pm.key)} className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest transition-all ${finIncLinePeriodMode === pm.key ? 'bg-[#074221] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-[#074221]/30'}`}>{pm.label}</button>))}</div>
                          <div className="flex flex-wrap gap-2 items-center justify-center">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navLY(-1), '<', lineYMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[2.5rem] text-center">{finIncLineYear}</span>{btn(() => navLY(1), '>', lineYMax)}</div>
                            {(finIncLinePeriodMode === 'semanal' || finIncLinePeriodMode === 'mensal') && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navLM(-1), '<', lineMMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[3rem] text-center">{monthNames[finIncLineMonth - 1].slice(0, 3)}</span>{btn(() => navLM(1), '>', lineMMax)}</div>)}
                            {finIncLinePeriodMode === 'semanal' && lineCurWk && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navLW(-1), '<', lineWMin)}<div className="flex flex-col items-center min-w-[5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{lineCurWk.label}</span><span className="text-[8px] font-black text-slate-400">({String(lineCurWk.start.getDate()).padStart(2, '0')}/{String(lineCurWk.start.getMonth() + 1).padStart(2, '0')} – {String(lineCurWk.end.getDate()).padStart(2, '0')}/{String(lineCurWk.end.getMonth() + 1).padStart(2, '0')})</span></div>{btn(() => navLW(1), '>', lineWMax)}</div>)}
                            {['bimestral', 'trimestral', 'semestral'].includes(finIncLinePeriodMode) && (<div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">{btn(() => navLPI(-1), '<', linePMin)}<div className="flex flex-col items-center min-w-[4.5rem]"><span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{finIncLinePeriodIdx}º {finIncLinePeriodMode === 'bimestral' ? 'Bim' : finIncLinePeriodMode === 'trimestral' ? 'Tri' : 'Sem'}</span><span className="text-[8px] font-black text-slate-400">({periodLabelMap[finIncLinePeriodMode]?.[finIncLinePeriodIdx - 1]})</span></div>{btn(() => navLPI(1), '>', linePMaxb)}</div>)}
                          </div>
                        </div>
                        {(() => {
                          const W = 300; const H = 180; const PAD_L = 40; const PAD_R = 12; const PAD_T = 16; const PAD_B = 28;
                          const chartW = W - PAD_L - PAD_R; const chartH = H - PAD_T - PAD_B;
                          const fmtCompact = (v: number) => { if (v === 0) return '0'; if (v >= 1000) return (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K'; return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }); };

                          if (!finIncCompareMode) {
                            // Original single line
                            if (lineTotal === 0) return (<div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64"><div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-3"><svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Não há receitas registradas neste período.</p></div>);
                            const pts = lineData.map((p, i) => ({ x: PAD_L + (lineData.length > 1 ? (i / (lineData.length - 1)) * chartW : chartW / 2), y: PAD_T + chartH - (p.value / maxLineVal) * chartH, ...p }));
                            const pathD = pts.length > 1 ? pts.map((p, i) => { if (i === 0) return `M ${p.x} ${p.y}`; const prev = pts[i - 1]; const cx = (prev.x + p.x) / 2; return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`; }).join(' ') : `M ${pts[0]?.x} ${pts[0]?.y}`;
                            const areaD = pts.length > 1 ? `${pathD} L ${pts[pts.length - 1].x} ${PAD_T + chartH} L ${pts[0].x} ${PAD_T + chartH} Z` : '';
                            const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD_T + chartH - f * chartH, label: fmtCompact(f * maxLineVal) }));
                            return (
                              <div className="flex flex-col w-full animate-fadeIn" key={`icl-anim-${finIncChartLineAnimKey}`}>
                                <div className="relative w-full" style={{ paddingBottom: `${(H / W) * 100}%` }}>
                                  <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full overflow-visible">
                                    <defs>
                                      <linearGradient id="incLineAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#074221" stopOpacity="0.25" /><stop offset="100%" stopColor="#074221" stopOpacity="0" /></linearGradient>
                                      <clipPath id={`incSweepClip-${finIncChartLineAnimKey}`}><rect x={0} y={0} width={W} height={H}><animate attributeName="width" from="0" to={W} dur={`${Math.max(1.5, pts.length * 0.25).toFixed(1)}s`} fill="freeze" calcMode="linear" /></rect></clipPath>
                                    </defs>
                                    {yTicks.map((t, i) => (<g key={i}><line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#f1f5f9" strokeWidth="1" /><text x={PAD_L - 4} y={t.y + 4} textAnchor="end" fontSize="7" fill="#94a3b8" fontWeight="700">{t.label}</text></g>))}
                                    <g clipPath={`url(#incSweepClip-${finIncChartLineAnimKey})`}>
                                      {areaD && <path d={areaD} fill="url(#incLineAreaGrad)" />}
                                      <path d={pathD} fill="none" stroke="#074221" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(7,66,33,0.3))' }} />
                                      {pts.map((p, i) => {
                                        const isHov = finIncChartHoveredLine === i;
                                        const fmt = p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                        return (<g key={i}><text x={p.x} y={H - 4} textAnchor="middle" fontSize="7" fill={isHov ? '#074221' : '#94a3b8'} fontWeight="700">{p.label}</text><rect x={p.x - 14} y={PAD_T} width={28} height={chartH + 4} fill="transparent" onMouseEnter={() => setFinIncChartHoveredLine(i)} onMouseLeave={() => setFinIncChartHoveredLine(null)} style={{ cursor: 'pointer' }} />{isHov && <line x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + chartH} stroke="#074221" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />}<circle cx={p.x} cy={p.y} r={isHov ? 4 : 2} fill={isHov ? '#074221' : '#fff'} stroke="#074221" strokeWidth="1.5" style={{ transition: 'r 0.2s', filter: isHov ? 'drop-shadow(0 2px 6px rgba(7,66,33,0.5))' : 'none' }} />{isHov && (() => { const tx = p.x + (p.x > W * 0.7 ? -65 : 8); const ty = Math.max(PAD_T + 2, p.y - 28); return (<g><rect x={tx} y={ty} width={60} height={22} rx={4} fill="#1e293b" opacity="0.95" /><text x={tx + 30} y={ty + 9} textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="700">{p.label}</text><text x={tx + 30} y={ty + 18} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="900">R$ {fmt}</text></g>); })()}</g>);
                                      })}
                                    </g>
                                  </svg>
                                </div>
                              </div>
                            );
                          }

                          // Compare mode: two lines (income=indigo, expense=rose)
                          const expRecs2 = financeRecords.filter(r => r.type === 'expense');
                          const getExpLineData = () => {
                            let pts2: { label: string; value: number }[] = [];
                            if (finIncLinePeriodMode === 'semanal') {
                              pts2 = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 })); const ws = lineCurWk; if (ws) { const st = new Date(ws.start); st.setHours(0, 0, 0, 0); const en = new Date(ws.end); en.setHours(23, 59, 59, 999); expRecs2.forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); if (dt >= st && dt <= en) { const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1; pts2[idx].value += pv(r); } }); }
                            } else if (finIncLinePeriodMode === 'mensal') {
                              const ws = getWeeksLocal(finIncLineYear, finIncLineMonth); pts2 = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 })); expRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month === finIncLineMonth; }).forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); const wi = ws.findIndex(w => { const s = new Date(w.start); s.setHours(0, 0, 0, 0); const e = new Date(w.end); e.setHours(23, 59, 59, 999); return dt >= s && dt <= e; }); if (wi !== -1) pts2[wi].value += pv(r); });
                            } else if (finIncLinePeriodMode === 'bimestral') {
                              const m1 = (finIncLinePeriodIdx - 1) * 2 + 1; pts2 = [0, 1].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); expRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month >= m1 && d.month <= m1 + 1; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - m1].value += pv(r); });
                            } else if (finIncLinePeriodMode === 'trimestral') {
                              const m1 = (finIncLinePeriodIdx - 1) * 3 + 1; pts2 = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); expRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month >= m1 && d.month <= m1 + 2; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - m1].value += pv(r); });
                            } else if (finIncLinePeriodMode === 'semestral') {
                              const m1 = (finIncLinePeriodIdx - 1) * 6 + 1; pts2 = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); expRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear && d.month >= m1 && d.month <= m1 + 5; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - m1].value += pv(r); });
                            } else { pts2 = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 })); expRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finIncLineYear; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - 1].value += pv(r); }); }
                            return pts2;
                          };
                          const expLineData = getExpLineData();
                          const maxCmpLineVal = Math.max(...lineData.map(p => p.value), ...expLineData.map(p => p.value), 1);
                          const hasCmpLineData = lineData.some(p => p.value > 0) || expLineData.some(p => p.value > 0);
                          if (!hasCmpLineData) return (<div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados no período.</p></div>);
                          const incPts = lineData.map((p, i) => ({ x: PAD_L + (lineData.length > 1 ? (i / (lineData.length - 1)) * chartW : chartW / 2), y: PAD_T + chartH - (p.value / maxCmpLineVal) * chartH, ...p }));
                          const expPts = expLineData.map((p, i) => ({ x: PAD_L + (expLineData.length > 1 ? (i / (expLineData.length - 1)) * chartW : chartW / 2), y: PAD_T + chartH - (p.value / maxCmpLineVal) * chartH, ...p }));
                          const makePath = (ps: typeof incPts) => ps.length > 1 ? ps.map((p, i) => { if (i === 0) return `M ${p.x} ${p.y}`; const prev = ps[i - 1]; const cx = (prev.x + p.x) / 2; return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`; }).join(' ') : `M ${ps[0]?.x} ${ps[0]?.y}`;
                          const incPath = makePath(incPts); const expPath = makePath(expPts);
                          const yTicks2 = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD_T + chartH - f * chartH, label: fmtCompact(f * maxCmpLineVal) }));
                          return (
                            <div className="flex flex-col w-full animate-fadeIn" key={`icl-cmp-${finIncChartLineAnimKey}`}>
                              <div className="relative w-full" style={{ paddingBottom: `${(H / W) * 100}%` }}>
                                <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full overflow-visible">
                                  <defs>
                                    <clipPath id={`incCmpSweepClip-${finIncChartLineAnimKey}`}><rect x={0} y={0} width={W} height={H}><animate attributeName="width" from="0" to={W} dur="1.5s" fill="freeze" calcMode="linear" /></rect></clipPath>
                                  </defs>
                                  {yTicks2.map((t, i) => (<g key={i}><line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#f1f5f9" strokeWidth="1" /><text x={PAD_L - 4} y={t.y + 4} textAnchor="end" fontSize="7" fill="#94a3b8" fontWeight="700">{t.label}</text></g>))}
                                  <g clipPath={`url(#incCmpSweepClip-${finIncChartLineAnimKey})`}>
                                    <path d={expPath} fill="none" stroke="#610800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,3" style={{ filter: 'drop-shadow(0 1px 3px rgba(97,8,0,0.3))' }} />
                                    <path d={incPath} fill="none" stroke="#074221" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(7,66,33,0.3))' }} />
                                    {incPts.map((p, i) => {
                                      const isHov = finIncChartHoveredLine === i;
                                      const expP = expPts[i] || { x: p.x, y: PAD_T + chartH, value: 0 };
                                      const diff = p.value - expP.value;
                                      const isProfit = diff >= 0;
                                      const lbl = isProfit ? 'Lucro' : 'Desp.';
                                      return (
                                        <g key={`cmp-hov-${i}`}>
                                          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="7" fill={isHov ? '#074221' : '#94a3b8'} fontWeight="700">{p.label}</text>
                                          <rect x={p.x - 14} y={PAD_T} width={28} height={chartH + 4} fill="transparent"
                                            onMouseEnter={() => setFinIncChartHoveredLine(i)} onMouseLeave={() => setFinIncChartHoveredLine(null)} style={{ cursor: 'pointer' }} />
                                          {isHov && <line x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + chartH} stroke="#074221" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" />}
                                          <circle cx={p.x} cy={p.y} r={isHov ? 4 : 2} fill={isHov ? '#074221' : '#fff'} stroke="#074221" strokeWidth="1.5" style={{ transition: 'r 0.2s', filter: isHov ? 'drop-shadow(0 2px 6px rgba(7,66,33,0.5))' : 'none' }} />
                                          <circle cx={expP.x} cy={expP.y} r={isHov ? 4 : 2} fill={isHov ? '#610800' : '#fff'} stroke="#610800" strokeWidth="1.5" style={{ transition: 'r 0.2s', filter: isHov ? 'drop-shadow(0 2px 6px rgba(97,8,0,0.5))' : 'none' }} />
                                          {isHov && (() => {
                                            const tx = p.x + (p.x > W * 0.7 ? -75 : 8);
                                            const ty = Math.max(PAD_T + 2, Math.min(p.y, expP.y) - 45);
                                            return (
                                              <g>
                                                <rect x={tx} y={ty} width={70} height={42} rx={4} fill="#1e293b" opacity="0.95" />
                                                <text x={tx + 35} y={ty + 10} textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="700">{p.label}</text>

                                                <circle cx={tx + 6} cy={ty + 18} r={2} fill="#074221" />
                                                <text x={tx + 12} y={ty + 20} fontSize="6" fill="#cbd5e1">R$ {p.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>

                                                <circle cx={tx + 6} cy={ty + 26} r={2} fill="#610800" />
                                                <text x={tx + 12} y={ty + 28} fontSize="6" fill="#cbd5e1">R$ {expP.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>

                                                <line x1={tx + 4} y1={ty + 31} x2={tx + 66} y2={ty + 31} stroke="#334155" strokeWidth="0.5" />
                                                <text x={tx + 35} y={ty + 38} textAnchor="middle" fontSize="6.5" fill={isProfit ? '#34d399' : '#610800'} fontWeight="900">{lbl}: R$ {Math.abs(diff).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>
                                              </g>
                                            );
                                          })()}
                                        </g>
                                      );
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
                </div>
              </div>
            );
          })()}
        </div>
      )
      }
      {view === 'finances_expenses' && (() => {
        const chartMonth = financeDiarioMonth;
        const chartYear = financeDiarioYear;
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

        // Parse date helper
        const parseRecordDate = (dateStr: string) => {
          const parts = dateStr.split('/');
          if (parts.length !== 3) return null;
          return { day: parseInt(parts[0], 10), month: parseInt(parts[1], 10), year: parseInt(parts[2], 10) };
        };

        const chartPeriodMode = finChartPeriodMode;
        const chartWeekIdx = finChartWeekIdx;
        const chartPeriodIdx = finChartPeriodIdx;

        const setPeriodMode = (mode: typeof chartPeriodMode) => {
          setFinChartPeriodMode(mode);
          setFinChartWeekIdx(0);
          setFinChartPeriodIdx(1);
          setFinChartHiddenCats({});
          setFinChartHoveredCat(null);
          setFinChartPieAnimKey(k => k + 1);
        };

        const getWeeksOfMonthLocal = (year: number, month: number) => {
          const weeks: { start: Date; end: Date; label: string }[] = [];
          let d = new Date(year, month - 1, 1);
          let weekNum = 1;
          while (d.getMonth() === month - 1) {
            const start = new Date(d);
            const end = new Date(d);
            const toSaturday = 6 - end.getDay();
            end.setDate(end.getDate() + toSaturday);
            const endOfMonth = new Date(year, month, 0);
            if (end > endOfMonth) end.setTime(endOfMonth.getTime());
            weeks.push({ start: new Date(start), end: new Date(end), label: `Semana ${weekNum}` });
            d = new Date(end); d.setDate(d.getDate() + 1); weekNum++;
          }
          return weeks;
        };

        const filterForPeriod = (records: typeof financeRecords, year: number, month: number, weekIdx: number, periodIdx: number) => {
          return records.filter(r => {
            if (r.type !== 'expense') return false;
            const d = parseRecordDate(r.date);
            if (!d) return false;
            if (chartPeriodMode === 'semanal') {
              if (d.year !== year || d.month !== month) return false;
              const ws = getWeeksOfMonthLocal(year, month);
              const wIdx = Math.min(weekIdx, ws.length - 1);
              const week = ws[wIdx];
              if (!week) return false;
              const rec = new Date(d.year, d.month - 1, d.day); rec.setHours(12, 0, 0, 0);
              const st = new Date(week.start); st.setHours(0, 0, 0, 0);
              const en = new Date(week.end); en.setHours(23, 59, 59, 999);
              return rec >= st && rec <= en;
            }
            if (chartPeriodMode === 'mensal') return d.year === year && d.month === month;
            if (chartPeriodMode === 'bimestral') return d.year === year && Math.ceil(d.month / 2) === periodIdx;
            if (chartPeriodMode === 'trimestral') return d.year === year && Math.ceil(d.month / 3) === periodIdx;
            if (chartPeriodMode === 'semestral') return d.year === year && Math.ceil(d.month / 6) === periodIdx;
            if (chartPeriodMode === 'anual') return d.year === year;
            return false;
          });
        };

        const getPrevPeriod = () => {
          if (chartPeriodMode === 'semanal') {
            if (chartWeekIdx > 0) return { year: chartYear, month: chartMonth, weekIdx: chartWeekIdx - 1, periodIdx: 1 };
            const pm = chartMonth === 1 ? 12 : chartMonth - 1;
            const py = chartMonth === 1 ? chartYear - 1 : chartYear;
            return { year: py, month: pm, weekIdx: getWeeksOfMonthLocal(py, pm).length - 1, periodIdx: 1 };
          }
          if (chartPeriodMode === 'mensal') {
            const pm = chartMonth === 1 ? 12 : chartMonth - 1;
            const py = chartMonth === 1 ? chartYear - 1 : chartYear;
            return { year: py, month: pm, weekIdx: 0, periodIdx: 1 };
          }
          const periodMaxMap: Record<string, number> = { bimestral: 6, trimestral: 4, semestral: 2 };
          if (chartPeriodMode === 'anual') return { year: chartYear - 1, month: 1, weekIdx: 0, periodIdx: 1 };
          const max = periodMaxMap[chartPeriodMode] || 1;
          if (chartPeriodIdx > 1) return { year: chartYear, month: chartMonth, weekIdx: 0, periodIdx: chartPeriodIdx - 1 };
          return { year: chartYear - 1, month: chartMonth, weekIdx: 0, periodIdx: max };
        };

        // Filter expenses for current and previous period
        const expenseRecords = filterForPeriod(financeRecords, chartYear, chartMonth, chartWeekIdx, chartPeriodIdx);
        const prev = getPrevPeriod();
        const prevExpenseRecords = filterForPeriod(financeRecords, prev.year, prev.month, prev.weekIdx, prev.periodIdx);

        // Aggregate by category
        const aggregate = (records: typeof financeRecords) => {
          const catMap: Record<string, { name: string; color: string; total: number }> = {};
          for (const r of records) {
            const key = r.categoryId || 'sem_categoria';
            const name = r.categoryName || 'Sem Categoria';
            const color = r.categoryColor || '#94a3b8';
            const val = parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
            if (!catMap[key]) catMap[key] = { name, color, total: 0 };
            catMap[key].total += val;
          }
          return Object.entries(catMap)
            .filter(([, s]) => s.total > 0)
            .sort(([, a], [, b]) => b.total - a.total)
            .map(([key, s]) => ({ key, ...s }));
        };

        const rawSlices = aggregate(expenseRecords);
        const prevSlices = aggregate(prevExpenseRecords);

        // Auto-group small categories into "Outros" if >6
        let slices = rawSlices;
        if (rawSlices.length > 6) {
          const top5 = rawSlices.slice(0, 5);
          const rest = rawSlices.slice(5);
          const outrosTotal = rest.reduce((s, c) => s + c.total, 0);
          slices = [...top5, { key: '__outros__', name: 'Outros', color: '#cbd5e1', total: outrosTotal }];
        }

        const grandTotal = slices.reduce((s, c) => s + c.total, 0);
        const prevGrandTotal = prevSlices.reduce((s, c) => s + c.total, 0);

        const periodLabelMap: Record<string, string[]> = {
          bimestral: ['Jan–Fev', 'Mar–Abr', 'Mai–Jun', 'Jul–Ago', 'Set–Out', 'Nov–Dez'],
          trimestral: ['Jan–Mar', 'Abr–Jun', 'Jul–Set', 'Out–Dez'],
          semestral: ['Jan–Jun', 'Jul–Dez'],
        };
        const periodMaxMap: Record<string, number> = { bimestral: 6, trimestral: 4, semestral: 2 };

        // --- BAR CHART DATA & LOGIC ---
        const setBarMode = (mode: typeof finBarPeriodMode) => {
          setFinBarPeriodMode(mode);
          setFinBarWeekIdx(0);
          setFinBarPeriodIdx(1);
          setFinChartBarAnimKey(k => k + 1);
        };

        const navBarYear = (dir: -1 | 1) => {
          const ny = finBarYear + dir;
          if (ny < 2026 || ny > 2028) return;
          setFinBarYear(ny);
          setFinChartBarAnimKey(k => k + 1);
        };
        const navBarMonth = (dir: -1 | 1) => {
          const nm = finBarMonth + dir;
          if (nm < 1 || nm > 12) return; // clamp — never changes year
          setFinBarMonth(nm);
          setFinBarWeekIdx(0);
          setFinChartBarAnimKey(k => k + 1);
        };
        const barWeeksOfMonth = getWeeksOfMonthLocal(finBarYear, finBarMonth);
        const safeBarWeekIdx = Math.min(finBarWeekIdx, barWeeksOfMonth.length - 1);
        const barCurrentWeek = barWeeksOfMonth[safeBarWeekIdx] || barWeeksOfMonth[0];

        const navBarWeek = (dir: -1 | 1) => {
          const newIdx = safeBarWeekIdx + dir;
          if (newIdx >= 0 && newIdx < barWeeksOfMonth.length) {
            setFinBarWeekIdx(newIdx);
            setFinChartBarAnimKey(k => k + 1);
          }
          // clamp — do nothing if at first/last week of month
        };
        const navBarPeriodIdx = (dir: -1 | 1) => {
          const max = periodMaxMap[finBarPeriodMode] || 1;
          const ni = finBarPeriodIdx + dir;
          if (ni < 1 || ni > max) return; // clamp — never changes year
          setFinBarPeriodIdx(ni);
          setFinChartBarAnimKey(k => k + 1);
        };

        const barExpenseRecords = filterForPeriod(financeRecords, finBarYear, finBarMonth, finBarWeekIdx, finBarPeriodIdx);

        // Bar Chart Data Calculation
        const getBarData = () => {
          let bars: { label: string; value: number }[] = [];
          if (finBarPeriodMode === 'semanal') {
            const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            bars = labels.map(label => ({ label, value: 0 }));
            // Filter globally by the selected week exactly
            const weekRecs = filterForPeriod(financeRecords, finBarYear, finBarMonth, finBarWeekIdx, finBarPeriodIdx)
              .filter(r => {
                const d = parseRecordDate(r.date);
                if (!d) return false;
                const recDate = new Date(d.year, d.month - 1, d.day); recDate.setHours(12, 0, 0, 0);
                const st = new Date(barCurrentWeek.start); st.setHours(0, 0, 0, 0);
                const en = new Date(barCurrentWeek.end); en.setHours(23, 59, 59, 999);
                return recDate >= st && recDate <= en;
              });

            for (const r of weekRecs) {
              const d = parseRecordDate(r.date);
              if (d) {
                const date = new Date(d.year, d.month - 1, d.day);
                const dayOfWeek = date.getDay();
                const index = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                bars[index].value += parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
              }
            }
          } else if (finBarPeriodMode === 'mensal') {
            const ws = getWeeksOfMonthLocal(finBarYear, finBarMonth);
            bars = ws.map((w, i) => ({ label: `Sem. ${i + 1}`, value: 0 }));
            const monthRecs = financeRecords.filter(r => {
              const d = parseRecordDate(r.date);
              return d && d.year === finBarYear && d.month === finBarMonth && r.type === 'expense';
            });
            for (const r of monthRecs) {
              const d = parseRecordDate(r.date);
              if (d) {
                const date = new Date(d.year, d.month - 1, d.day); date.setHours(12, 0, 0, 0);
                const wIdx = ws.findIndex(w => {
                  const st = new Date(w.start); st.setHours(0, 0, 0, 0);
                  const en = new Date(w.end); en.setHours(23, 59, 59, 999);
                  return date >= st && date <= en;
                });
                if (wIdx !== -1) bars[wIdx].value += parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
              }
            }
          } else if (finBarPeriodMode === 'bimestral') {
            const m1 = (finBarPeriodIdx - 1) * 2 + 1;
            const m2 = m1 + 1;
            bars = [
              { label: monthNames[m1 - 1].slice(0, 3), value: 0 },
              { label: monthNames[m2 - 1].slice(0, 3), value: 0 }
            ];
            const recs = financeRecords.filter(r => {
              const d = parseRecordDate(r.date);
              return d && d.year === finBarYear && (d.month === m1 || d.month === m2) && r.type === 'expense';
            });
            for (const r of recs) {
              const d = parseRecordDate(r.date);
              if (d && d.month >= m1 && d.month <= m2) {
                bars[d.month - m1].value += parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
              }
            }
          } else if (finBarPeriodMode === 'trimestral') {
            const m1 = (finBarPeriodIdx - 1) * 3 + 1;
            bars = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 }));
            const recs = financeRecords.filter(r => {
              const d = parseRecordDate(r.date);
              return d && d.year === finBarYear && d.month >= m1 && d.month <= m1 + 2 && r.type === 'expense';
            });
            for (const r of recs) {
              const d = parseRecordDate(r.date);
              if (d && d.month >= m1 && d.month <= m1 + 2) {
                bars[d.month - m1].value += parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
              }
            }
          } else if (finBarPeriodMode === 'semestral') {
            const m1 = (finBarPeriodIdx - 1) * 6 + 1;
            bars = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 }));
            const recs = financeRecords.filter(r => {
              const d = parseRecordDate(r.date);
              return d && d.year === finBarYear && d.month >= m1 && d.month <= m1 + 5 && r.type === 'expense';
            });
            for (const r of recs) {
              const d = parseRecordDate(r.date);
              if (d && d.month >= m1 && d.month <= m1 + 5) {
                bars[d.month - m1].value += parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
              }
            }
          } else if (finBarPeriodMode === 'anual') {
            bars = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 }));
            const recs = financeRecords.filter(r => {
              const d = parseRecordDate(r.date);
              return d && d.year === finBarYear && r.type === 'expense';
            });
            for (const r of recs) {
              const d = parseRecordDate(r.date);
              if (d && d.month >= 1 && d.month <= 12) {
                bars[d.month - 1].value += parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
              }
            }
          }
          return bars;
        };
        const barData = getBarData();
        const maxBarValue = Math.max(...barData.map(b => b.value), 1);
        const barGrandTotal = barData.reduce((s, b) => s + b.value, 0);

        // --- LINE CHART DATA & LOGIC ---
        const setLineMode = (mode: typeof finLinePeriodMode) => {
          setFinLinePeriodMode(mode); setFinLineWeekIdx(0); setFinLinePeriodIdx(1); setFinChartLineAnimKey(k => k + 1);
        };
        const navLineYear = (dir: -1 | 1) => { const ny = finLineYear + dir; if (ny < 2026 || ny > 2028) return; setFinLineYear(ny); setFinChartLineAnimKey(k => k + 1); };
        const navLineMonth = (dir: -1 | 1) => { const nm = finLineMonth + dir; if (nm < 1 || nm > 12) return; setFinLineMonth(nm); setFinLineWeekIdx(0); setFinChartLineAnimKey(k => k + 1); };
        const lineWeeksOfMonth = getWeeksOfMonthLocal(finLineYear, finLineMonth);
        const safeLineWeekIdx = Math.min(finLineWeekIdx, lineWeeksOfMonth.length - 1);
        const lineCurrentWeek = lineWeeksOfMonth[safeLineWeekIdx] || lineWeeksOfMonth[0];
        const navLineWeek = (dir: -1 | 1) => { const ni = safeLineWeekIdx + dir; if (ni >= 0 && ni < lineWeeksOfMonth.length) { setFinLineWeekIdx(ni); setFinChartLineAnimKey(k => k + 1); } };
        const navLinePeriodIdx = (dir: -1 | 1) => { const max = periodMaxMap[finLinePeriodMode] || 1; const ni = finLinePeriodIdx + dir; if (ni < 1 || ni > max) return; setFinLinePeriodIdx(ni); setFinChartLineAnimKey(k => k + 1); };

        // Line chart boundary helpers
        const lineYearAtMin = finLineYear <= 2026; const lineYearAtMax = finLineYear >= 2028;
        const linePeriodMax = periodMaxMap[finLinePeriodMode] || 1;
        const linePeriodAtMin = finLinePeriodIdx <= 1; const linePeriodAtMax = finLinePeriodIdx >= linePeriodMax;
        const lineMonthAtMin = finLineMonth === 1; const lineMonthAtMax = finLineMonth === 12;
        const lineWeekAtMin = safeLineWeekIdx === 0 && lineMonthAtMin;
        const lineWeekAtMax = safeLineWeekIdx === lineWeeksOfMonth.length - 1 && lineMonthAtMax;

        const getLineData = (): { label: string; value: number }[] => {
          const parseVal = (r: typeof financeRecords[0]) => parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
          const expenseOnly = (r: typeof financeRecords[0]) => r.type === 'expense';
          let points: { label: string; value: number }[] = [];
          if (finLinePeriodMode === 'semanal') {
            const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            points = labels.map(l => ({ label: l, value: 0 }));
            const ws = lineWeeksOfMonth[safeLineWeekIdx];
            if (ws) {
              const st = new Date(ws.start); st.setHours(0, 0, 0, 0);
              const en = new Date(ws.end); en.setHours(23, 59, 59, 999);
              financeRecords.filter(expenseOnly).forEach(r => {
                const d = parseRecordDate(r.date); if (!d) return;
                const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0);
                if (dt >= st && dt <= en) { const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1; points[idx].value += parseVal(r); }
              });
            }
          } else if (finLinePeriodMode === 'mensal') {
            const ws2 = getWeeksOfMonthLocal(finLineYear, finLineMonth);
            points = ws2.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 }));
            financeRecords.filter(expenseOnly).forEach(r => {
              const d = parseRecordDate(r.date); if (!d || d.year !== finLineYear || d.month !== finLineMonth) return;
              const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0);
              const wi = ws2.findIndex(w => { const s = new Date(w.start); s.setHours(0, 0, 0, 0); const e = new Date(w.end); e.setHours(23, 59, 59, 999); return dt >= s && dt <= e; });
              if (wi !== -1) points[wi].value += parseVal(r);
            });
          } else if (finLinePeriodMode === 'bimestral') {
            const m1 = (finLinePeriodIdx - 1) * 2 + 1;
            points = [0, 1].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 }));
            financeRecords.filter(expenseOnly).forEach(r => { const d = parseRecordDate(r.date); if (d && d.year === finLineYear && d.month >= m1 && d.month <= m1 + 1) points[d.month - m1].value += parseVal(r); });
          } else if (finLinePeriodMode === 'trimestral') {
            const m1 = (finLinePeriodIdx - 1) * 3 + 1;
            points = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 }));
            financeRecords.filter(expenseOnly).forEach(r => { const d = parseRecordDate(r.date); if (d && d.year === finLineYear && d.month >= m1 && d.month <= m1 + 2) points[d.month - m1].value += parseVal(r); });
          } else if (finLinePeriodMode === 'semestral') {
            const m1 = (finLinePeriodIdx - 1) * 6 + 1;
            points = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 }));
            financeRecords.filter(expenseOnly).forEach(r => { const d = parseRecordDate(r.date); if (d && d.year === finLineYear && d.month >= m1 && d.month <= m1 + 5) points[d.month - m1].value += parseVal(r); });
          } else {
            points = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 }));
            financeRecords.filter(expenseOnly).forEach(r => { const d = parseRecordDate(r.date); if (d && d.year === finLineYear) points[d.month - 1].value += parseVal(r); });
          }
          return points;
        };
        const lineData = getLineData();
        const lineGrandTotal = lineData.reduce((s, p) => s + p.value, 0);
        const maxLineValue = Math.max(...lineData.map(p => p.value), 1);


        const hiddenCats = finChartHiddenCats;
        const hoveredCat = finChartHoveredCat;
        const hoveredBar = finChartHoveredBar;
        const showComparison = finChartShowComparison;

        const visibleSlices = slices.filter(s => !hiddenCats[s.key]);
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
          const isHovered = hoveredCat === s.key;
          return { ...s, dash, offset, frac, isHighlighted, isHovered };
        });

        // Prev month map for comparison
        const prevMap: Record<string, number> = {};
        for (const p of prevSlices) prevMap[p.key] = p.total;

        const setHidden = (key: string) => {
          setFinChartHiddenCats(prev => ({ ...prev, [key]: !prev[key] }));
        };
        const setHovered = (key: string | null) => {
          setFinChartHoveredCat(key);
        };
        const toggleCompare = () => {
          setFinChartShowComparison(v => !v);
        };



        const weeksOfChartMonth = getWeeksOfMonthLocal(chartYear, chartMonth);
        const safeWeekIdx = Math.min(chartWeekIdx, weeksOfChartMonth.length - 1);
        const currentWeek = weeksOfChartMonth[safeWeekIdx] || weeksOfChartMonth[0];

        const navigateYear = (dir: -1 | 1) => {
          const ny = chartYear + dir;
          if (ny < 2026 || ny > 2028) return;
          setFinanceDiarioYear(ny);
          setFinChartHiddenCats({}); setFinChartHoveredCat(null);
          setFinChartPieAnimKey(k => k + 1);
        };
        const navigateMonth = (dir: -1 | 1) => {
          const nm = chartMonth === 1 ? 12 : chartMonth - 1;
          const ny = chartMonth === 1 ? chartYear - 1 : chartYear;
          if (nm < 1 || nm > 12) return; // clamp — never changes year
          setFinanceDiarioMonth(nm);
          setFinChartWeekIdx(0);
          setFinChartHiddenCats({}); setFinChartHoveredCat(null);
          setFinChartPieAnimKey(k => k + 1);
        };
        const navigateWeek = (dir: -1 | 1) => {
          const newIdx = safeWeekIdx + dir;
          if (newIdx >= 0 && newIdx < weeksOfChartMonth.length) {
            setFinChartWeekIdx(newIdx);
            setFinChartPieAnimKey(k => k + 1);
          }
          // clamp — do nothing if at first/last week of month
          setFinChartHiddenCats({}); setFinChartHoveredCat(null);
        };
        const navigatePeriodIdx = (dir: -1 | 1) => {
          const max = periodMaxMap[chartPeriodMode] || 1;
          const ni = chartPeriodIdx + dir;
          if (ni < 1 || ni > max) return; // clamp — never changes year
          setFinChartPeriodIdx(ni);
          setFinChartHiddenCats({}); setFinChartHoveredCat(null);
          setFinChartPieAnimKey(k => k + 1);
        };

        const prevPeriodLabel = (() => {
          if (chartPeriodMode === 'semanal') return `${monthNames[prev.month - 1].slice(0, 3)} S${prev.weekIdx + 1}`;
          if (chartPeriodMode === 'mensal') return monthNames[prev.month - 1];
          if (chartPeriodMode === 'anual') return String(prev.year);
          return periodLabelMap[chartPeriodMode]?.[prev.periodIdx - 1] || '';
        })();

        const periodModes: { key: typeof chartPeriodMode; label: string }[] = [
          { key: 'semanal', label: 'Semana' },
          { key: 'mensal', label: 'Mês' },
          { key: 'bimestral', label: 'Bimestre' },
          { key: 'trimestral', label: 'Trimestre' },
          { key: 'semestral', label: 'Semestre' },
          { key: 'anual', label: 'Ano' },
        ];
        const navBtn = (onClick: () => void, ch: string, disabled?: boolean) => (
          <button
            onClick={disabled ? undefined : onClick}
            className={`flex items-center justify-center transition-all font-black text-sm w-5 ${disabled ? 'text-slate-300 cursor-not-allowed' : 'text-black hover:opacity-60 cursor-pointer'
              }`}
          >{ch}</button>
        );

        // --- Pie chart boundary helpers ---
        const pieYearAtMin = chartYear <= 2026;
        const pieYearAtMax = chartYear >= 2028;
        const piePeriodMax = periodMaxMap[chartPeriodMode] || 1;
        const piePeriodAtMin = chartPeriodIdx <= 1;
        const piePeriodAtMax = chartPeriodIdx >= piePeriodMax;
        const pieMonthAtMin = chartMonth === 1;
        const pieMonthAtMax = chartMonth === 12;
        const pieWeekAtMin = safeWeekIdx === 0 && pieMonthAtMin;
        const pieWeekAtMax = safeWeekIdx === weeksOfChartMonth.length - 1 && pieMonthAtMax;

        return (
          <div className="flex flex-col items-center justify-center pt-4 pb-20 animate-fadeIn text-center w-full">
            {StudyStyleHeader({
              onBack: () => setView('finances'),
              onHome: () => setView('finances'),
              rightContent: (
                <div className="flex flex-col gap-4 items-end">
                  <div className="flex gap-3">
                    <button
                      onClick={() => setView('finances_expense_form')}
                      className="flex items-center gap-2 px-6 py-2.5 bg-black text-white rounded-2xl font-black transition-all shadow-lg hover:scale-105 active:scale-95 uppercase text-[10px] tracking-[0.2em]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Adicionar despesa
                    </button>
                    <button
                      onClick={() => setView('finances_expense_list')}
                      className="flex items-center gap-2 px-6 py-2.5 bg-[#4A69A2] text-white rounded-2xl font-black transition-all shadow-lg hover:scale-105 active:scale-95 uppercase text-[10px] tracking-[0.2em]"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Minhas despesas
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setFinMonthlyOverviewBack('finances_expenses');
                        const savedExp = localStorage.getItem('fin_monthly_expense_data');
                        setFinMonthlyOverviewReadOnly(!!savedExp);
                        setView('finances_monthly_overview');
                      }}
                      className="flex items-center justify-center px-4 py-1.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider bg-slate-200 text-slate-600 hover:bg-slate-300"
                    >
                      Meu mês
                    </button>
                    <button
                      onClick={() => { setActiveFinMode('expense'); setView('finances_categories'); }}
                      className="flex items-center justify-center px-4 py-1.5 rounded-xl font-bold transition-all shadow-sm active:scale-95 text-[10px] uppercase tracking-wider bg-slate-200 text-slate-600 hover:bg-slate-300"
                    >
                      Categorias
                    </button>
                  </div>
                </div>
              )
            })}

            <div className="flex flex-col items-center gap-5 mt-6 w-full max-w-5xl px-4">
              <div className="flex flex-col items-center justify-center gap-10 w-full mt-4">

                {/* Meu Mês Circle - Despesas */}
                {(() => {
                  const today = new Date();
                  const curM = today.getMonth() + 1;
                  const curY = today.getFullYear();

                  const monthTotal = financeRecords.filter(r => {
                    const d = parseRecordDate(r.date);
                    return r.type === 'expense' && d && d.month === curM && d.year === curY;
                  }).reduce((s, r) => s + (parseFloat((r.value || '0').replace(/\./g, '').replace(',', '.')) || 0), 0);

                  const monthTotalInc = financeRecords.filter(r => {
                    const d = parseRecordDate(r.date);
                    return r.type === 'income' && d && d.month === curM && d.year === curY;
                  }).reduce((s, r) => s + (parseFloat((r.value || '0').replace(/\./g, '').replace(',', '.')) || 0), 0);

                  const goal = parseFloat((finMonthExpenseValue || '0').replace(',', '.')) || 0;
                  const goalInc = parseFloat((finMonthIncomeValue || '0').replace(',', '.')) || 0;

                  const pontualVal = parseFloat((finMonthExpensePontualMeta || '0').replace(',', '.')) || 0;
                  const definidaVal = parseFloat((finMonthExpenseDefinidaMeta || '0').replace(',', '.')) || 0;

                  // For expenses: target is the new (lower) total. Reduction = goal - target
                  const pontualReduction = pontualVal > 0 && pontualVal < goal ? goal - pontualVal : 0;
                  const definidaReduction = definidaVal > 0 && definidaVal < goal ? goal - definidaVal : 0;
                  const pontualPct = goal > 0 ? (pontualReduction / goal) * 100 : 0;
                  const definidaPct = goal > 0 ? (definidaReduction / goal) * 100 : 0;

                  // Progress
                  const pct = goal > 0 ? Math.min((monthTotal / goal) * 100, 100) : 0;
                  const pctInc = goalInc > 0 ? Math.min((monthTotalInc / goalInc) * 100, 100) : 0;

                  const radius = 70;
                  const circ = 2 * Math.PI * radius;
                  const offset = circ - (pct / 100) * circ;
                  const offsetInc = circ - (pctInc / 100) * circ;
                  const isOverBudget = goal > 0 && monthTotal > goal;

                  return (
                    <div className={`flex flex-col items-center gap-6 w-full max-w-3xl mb-12 transition-all duration-300`}>
                      <div className="flex flex-col items-center justify-center w-full border-b-2 border-slate-100 pb-4 mb-2 text-center relative min-h-[40px]">
                        <h3 className="text-xl font-black text-[#4A69A2] uppercase tracking-[0.2em] bg-blue-50/80 px-8 py-3 rounded-2xl border border-blue-100 shadow-sm text-center">Meu mês</h3>

                        <div className="absolute right-0 top-0 flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner gap-1">
                          <button
                            onClick={() => setFinExpMeuMesCompareMode(false)}
                            className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${!finExpMeuMesCompareMode ? 'bg-white text-slate-900 shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                          >
                            OFF
                          </button>
                          <button
                            onClick={() => setFinExpMeuMesCompareMode(true)}
                            className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${finExpMeuMesCompareMode ? 'bg-[#610800] text-white shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                          >
                            ON
                          </button>
                        </div>

                        {!finExpMeuMesCompareMode && (
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Gasto:</span>
                            <span className="text-xl font-black text-black">R$ {monthTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                      </div>

                      <div className={`flex ${finExpMeuMesCompareMode ? 'flex-col md:flex-row items-center justify-center gap-12 w-full' : 'flex-col items-center w-full'}`}>

                        {/* Main Chart (Expense) */}
                        <div className="flex flex-col items-center w-full max-w-[200px]">
                          {finExpMeuMesCompareMode && (
                            <div className="flex items-center gap-2 mb-4 bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-100 w-full justify-center h-14">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Gasto:</span>
                              <span className="text-lg font-black text-black whitespace-nowrap">R$ {monthTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          )}

                          <div className="relative flex items-center justify-center w-48 h-48" key={`meu-mes-exp-${pct}-${goal}`}>
                            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                              <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
                              <circle
                                cx="80" cy="80" r={radius} fill="none"
                                stroke="#610800"
                                strokeWidth="14"
                                strokeDasharray={circ}
                                strokeDashoffset={offset}
                                strokeLinecap="round"
                                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                              >
                                <animate attributeName="stroke-dashoffset" from={circ} to={offset} dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                              </circle>
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                              <span className="text-3xl font-black transition-all duration-500 scale-110 text-[#610800]">{pct.toFixed(0)}%</span>
                              <span className="text-[9px] font-bold text-slate-400 mt-2">Despesa por mês:<br />R$ {goal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>

                          {!finExpMeuMesCompareMode && (
                            <div className="flex flex-col items-center gap-4 w-full mt-2 animate-fadeIn">
                              {pontualReduction > 0 && (
                                <div className="flex flex-col items-center gap-1 group">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Meta Pontual de Redução</span>
                                  <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl bg-red-50 border border-red-100 transition-all hover:scale-105">
                                    <span className="text-sm font-black text-[#610800]">R$ {pontualReduction.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[10px] font-black text-[#610800] opacity-70">(-{pontualPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span>
                                    {getMetaDateRange(finMonthExpensePontualSavedAt, finMonthExpensePontualType, finMonthExpensePontualAmount) && (
                                      <span className="text-[9px] font-bold text-[#610800] opacity-50 mt-0.5">
                                        {getMetaDateRange(finMonthExpensePontualSavedAt, finMonthExpensePontualType, finMonthExpensePontualAmount)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {definidaReduction > 0 && (
                                <div className="flex flex-col items-center gap-1 group">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Meta Definitiva de Redução</span>
                                  <div className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl bg-red-50 border border-red-100 transition-all hover:scale-105">
                                    <span className="text-sm font-black text-[#610800]">R$ {definidaReduction.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    <span className="text-[10px] font-black text-[#610800] opacity-70">(-{definidaPct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span>
                                    {getMetaDateRange(finMonthExpenseDefinidaSavedAt, finMonthExpenseDefinidaType, finMonthExpenseDefinidaAmount) && (
                                      <span className="text-[9px] font-bold text-[#610800] opacity-50 mt-0.5">
                                        {getMetaDateRange(finMonthExpenseDefinidaSavedAt, finMonthExpenseDefinidaType, finMonthExpenseDefinidaAmount)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Secondary Chart (Income) - only if ON */}
                        {finExpMeuMesCompareMode && (
                          <div className="flex flex-col items-center w-full max-w-[200px] animate-fadeIn">
                            <div className="flex items-center gap-2 mb-4 bg-slate-50 px-4 py-2 rounded-2xl border-2 border-slate-100 w-full justify-center h-14">
                              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Recebido:</span>
                              <span className="text-lg font-black text-black whitespace-nowrap">R$ {monthTotalInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="relative flex items-center justify-center w-48 h-48" key={`meu-mes-inc-comp-${pctInc}-${goalInc}`}>
                              <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
                                <circle cx="80" cy="80" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="14" />
                                <circle
                                  cx="80" cy="80" r={radius} fill="none" stroke="#074221" strokeWidth="14"
                                  strokeDasharray={circ}
                                  strokeDashoffset={offsetInc}
                                  strokeLinecap="round"
                                  style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
                                >
                                  <animate attributeName="stroke-dashoffset" from={circ} to={offsetInc} dur="1.2s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.4 0 0.2 1" />
                                </circle>
                              </svg>
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-black transition-all duration-500 scale-110 text-[#074221]">{pctInc.toFixed(0)}%</span>
                                <span className="text-[9px] font-bold text-slate-400 mt-2">Receita por mês:<br />R$ {goalInc.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Balance Information - Centered below charts */}
                      {finExpMeuMesCompareMode && (
                        <div className="flex flex-col items-center mt-6 p-4 bg-slate-50 border-2 border-slate-100 rounded-3xl w-full max-w-[240px] shadow-sm animate-fadeIn">
                          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Saldo do Mês</span>
                          <span className="text-xl font-black" style={{ color: (monthTotalInc - monthTotal) >= 0 ? '#074221' : '#610800' }}>
                            R$ {(monthTotalInc - monthTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Left Column: Donut Chart & Legend */}
                <div className="flex flex-col items-center gap-6 w-full max-w-[400px] xl:max-w-md order-last mt-12 xl:mt-0">
                  <h3 className="text-xl font-black text-[#4A69A2] uppercase tracking-[0.2em] bg-blue-50/80 px-8 py-3 rounded-2xl border border-blue-100 shadow-sm text-center mb-6 self-start xl:self-center">Evolução por categoria</h3>
                  {/* Pie Chart Navigation */}
                  <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-5">
                    <div className="flex flex-wrap gap-1.5 justify-center">
                      {periodModes.map(pm => (
                        <button key={`pie-${pm.key}`} onClick={() => setPeriodMode(pm.key)}
                          className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest transition-all ${chartPeriodMode === pm.key ? 'bg-black text-white shadow-md scale-105' : 'bg-slate-50 text-black border border-slate-200 hover:border-black/20'}`}>
                          {pm.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex flex-wrap gap-2 items-center justify-center">
                      {/* Year */}
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                        {navBtn(() => navigateYear(-1), '<', pieYearAtMin)}
                        <span className="text-[10px] font-black uppercase tracking-widest text-black min-w-[2.5rem] text-center">{chartYear}</span>
                        {navBtn(() => navigateYear(1), '>', pieYearAtMax)}
                      </div>
                      {/* Month */}
                      {(chartPeriodMode === 'semanal' || chartPeriodMode === 'mensal') && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                          {navBtn(() => navigateMonth(-1), '<', pieMonthAtMin)}
                          <span className="text-[10px] font-black uppercase tracking-widest text-black min-w-[3rem] text-center">{monthNames[chartMonth - 1].slice(0, 3)}</span>
                          {navBtn(() => navigateMonth(1), '>', pieMonthAtMax)}
                        </div>
                      )}
                      {/* Week */}
                      {chartPeriodMode === 'semanal' && currentWeek && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                          {navBtn(() => navigateWeek(-1), '<', pieWeekAtMin)}
                          <div className="flex flex-col items-center min-w-[5rem]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black">{currentWeek.label}</span>
                            <span className="text-[8px] font-black text-slate-400">({String(currentWeek.start.getDate()).padStart(2, '0')}/{String(currentWeek.start.getMonth() + 1).padStart(2, '0')} – {String(currentWeek.end.getDate()).padStart(2, '0')}/{String(currentWeek.end.getMonth() + 1).padStart(2, '0')})</span>
                          </div>
                          {navBtn(() => navigateWeek(1), '>', pieWeekAtMax)}
                        </div>
                      )}
                      {/* Period Index */}
                      {['bimestral', 'trimestral', 'semestral'].includes(chartPeriodMode) && (
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                          {navBtn(() => navigatePeriodIdx(-1), '<', piePeriodAtMin)}
                          <div className="flex flex-col items-center min-w-[4.5rem]">
                            <span className="text-[10px] font-black uppercase tracking-widest text-black">
                              {chartPeriodIdx}º {chartPeriodMode === 'bimestral' ? 'Bim' : chartPeriodMode === 'trimestral' ? 'Tri' : 'Sem'}
                            </span>
                            <span className="text-[8px] font-black text-slate-400">({periodLabelMap[chartPeriodMode]?.[chartPeriodIdx - 1]})</span>
                          </div>
                          {navBtn(() => navigatePeriodIdx(1), '>', piePeriodAtMax)}
                        </div>
                      )}
                    </div>
                  </div>

                  {grandTotal === 0 ? (
                    <div className="flex flex-col items-center gap-4 py-12 animate-fadeIn w-full opacity-60">
                      <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-2">
                        <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados no período.</p>
                    </div>
                  ) : (
                    <>
                      {/* Donut Chart */}
                      <div className="relative flex items-center justify-center animate-fadeIn" style={{ width: 240, height: 240 }} key={`pie-${finChartPieAnimKey}`}>
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
                              onMouseEnter={() => setHovered(slice.key)}
                              onMouseLeave={() => setHovered(null)}
                              onClick={() => setHovered(hoveredCat === slice.key ? null : slice.key)}
                              style={{
                                transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                opacity: hoveredCat && !slice.isHovered ? 0.4 : 0.92,
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
                          {hoveredCat ? (() => {
                            const h = pieSlices.find(s => s.key === hoveredCat);
                            if (!h) return null;
                            return (
                              <div className="animate-fadeIn flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{h.name}</span>
                                <span className="text-base font-black text-slate-800">
                                  R$ {h.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-[10px] font-black text-slate-500">{(h.frac * 100).toFixed(1)}%</span>
                              </div>
                            );
                          })() : (
                            <>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</span>
                              <span className="text-base font-black text-slate-800 leading-tight">
                                R$ {visibleTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span className="text-[10px] font-black text-slate-400">{visibleSlices.length} categorias</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="flex flex-col gap-2.5 w-full">
                        {slices.map((slice) => {
                          const isHidden = !!hiddenCats[slice.key];
                          const frac = grandTotal > 0 ? slice.total / grandTotal : 0;
                          const isHighlighted = frac > 0.4;
                          const prevTotal = prevMap[slice.key] || 0;
                          const variation = prevTotal > 0 ? ((slice.total - prevTotal) / prevTotal) * 100 : (slice.total > 0 ? 100 : 0);

                          return (
                            <div
                              key={slice.key}
                              onClick={() => setHidden(slice.key)}
                              onMouseEnter={() => setHovered(slice.key)}
                              onMouseLeave={() => setHovered(null)}
                              className={`flex items-center justify-between px-4 py-3 rounded-2xl border transition-all duration-300 cursor-pointer ${isHidden
                                ? 'bg-slate-50 border-slate-100 opacity-40'
                                : isHighlighted
                                  ? 'bg-white border-2 border-black/20 shadow-md'
                                  : hoveredCat === slice.key
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
                                  R$ {slice.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {showComparison && !isHidden && (
                                  <div className={`flex items-center gap-1 text-[10px] font-black ${variation > 0 ? 'text-red-500' : variation < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                    {variation > 0 ? (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                                    ) : variation < 0 ? (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg>
                                    ) : (
                                      <span>–</span>
                                    )}
                                    <span>{Math.abs(variation).toFixed(0)}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                {/* Right Column: Bar Chart + Line Chart side by side */}
                <div className="flex flex-col w-full order-first xl:order-none xl:col-span-2">
                  <div className="flex items-center justify-center gap-3 border-b-2 border-slate-100 pb-4 mb-6">
                    <h3 className="text-xl font-black text-[#4A69A2] uppercase tracking-[0.2em] bg-blue-50/80 px-8 py-3 rounded-2xl border border-blue-100 shadow-sm text-center">
                      {finExpCompareMode ? 'Receitas vs Despesas' : 'Evolução das despesas'}
                    </h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner gap-1">
                      <button
                        onClick={() => setFinExpCompareMode(false)}
                        className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${!finExpCompareMode ? 'bg-white text-slate-900 shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                      >
                        OFF
                      </button>
                      <button
                        onClick={() => setFinExpCompareMode(true)}
                        className={`px-3 py-1 rounded-lg font-black text-[9px] uppercase tracking-widest transition-all duration-300 ${finExpCompareMode ? 'bg-[#610800] text-white shadow-md transform scale-100' : 'text-slate-400 opacity-60 hover:opacity-100 transform scale-95'}`}
                      >
                        ON
                      </button>
                    </div>
                  </div>
                  {finExpCompareMode && (
                    <div className="flex items-center justify-center gap-4 mb-4">
                      <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#074221' }} /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Receitas</span></div>
                      <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: '#610800' }} /><span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Despesas</span></div>
                    </div>
                  )}
                  <div className="flex flex-col xl:flex-row items-start gap-8 w-full">

                    {/* Bar Chart */}
                    <div className="flex flex-col items-center gap-6 w-full xl:flex-1">
                      {/* Bar Chart Navigation */}
                      <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-5">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {periodModes.map(pm => (
                            <button key={`bar-${pm.key}`} onClick={() => setBarMode(pm.key)}
                              className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest transition-all ${finBarPeriodMode === pm.key ? 'bg-[#610800] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-[#610800]/30'}`}>
                              {pm.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center justify-center">
                          {(() => {
                            const barYearAtMin = finBarYear <= 2026; const barYearAtMax = finBarYear >= 2028;
                            const barPeriodMax = periodMaxMap[finBarPeriodMode] || 1;
                            const barPeriodAtMin = finBarPeriodIdx <= 1; const barPeriodAtMax = finBarPeriodIdx >= barPeriodMax;
                            const barMonthAtMin = finBarMonth === 1; const barMonthAtMax = finBarMonth === 12;
                            const barWeekAtMin = safeBarWeekIdx === 0 && barMonthAtMin;
                            const barWeekAtMax = safeBarWeekIdx === barWeeksOfMonth.length - 1 && barMonthAtMax;
                            return (
                              <>
                                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                  {navBtn(() => navBarYear(-1), '<', barYearAtMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[2.5rem] text-center">{finBarYear}</span>{navBtn(() => navBarYear(1), '>', barYearAtMax)}
                                </div>
                                {(finBarPeriodMode === 'semanal' || finBarPeriodMode === 'mensal') && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                    {navBtn(() => navBarMonth(-1), '<', barMonthAtMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[3rem] text-center">{monthNames[finBarMonth - 1].slice(0, 3)}</span>{navBtn(() => navBarMonth(1), '>', barMonthAtMax)}
                                  </div>
                                )}
                                {finBarPeriodMode === 'semanal' && barCurrentWeek && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                    {navBtn(() => navBarWeek(-1), '<', barWeekAtMin)}
                                    <div className="flex flex-col items-center min-w-[5rem]">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{barCurrentWeek.label}</span>
                                      <span className="text-[8px] font-black text-slate-400">({String(barCurrentWeek.start.getDate()).padStart(2, '0')}/{String(barCurrentWeek.start.getMonth() + 1).padStart(2, '0')} – {String(barCurrentWeek.end.getDate()).padStart(2, '0')}/{String(barCurrentWeek.end.getMonth() + 1).padStart(2, '0')})</span>
                                    </div>
                                    {navBtn(() => navBarWeek(1), '>', barWeekAtMax)}
                                  </div>
                                )}
                                {['bimestral', 'trimestral', 'semestral'].includes(finBarPeriodMode) && (
                                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                    {navBtn(() => navBarPeriodIdx(-1), '<', barPeriodAtMin)}
                                    <div className="flex flex-col items-center min-w-[4.5rem]">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{finBarPeriodIdx}º {finBarPeriodMode === 'bimestral' ? 'Bim' : finBarPeriodMode === 'trimestral' ? 'Tri' : 'Sem'}</span>
                                      <span className="text-[8px] font-black text-slate-400">({periodLabelMap[finBarPeriodMode]?.[finBarPeriodIdx - 1]})</span>
                                    </div>
                                    {navBtn(() => navBarPeriodIdx(1), '>', barPeriodAtMax)}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {(() => {
                        if (!finExpCompareMode) {
                          return barGrandTotal === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64">
                              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                              </div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados no período.</p>
                            </div>
                          ) : (
                            <div className="relative w-full animate-fadeIn" style={{ paddingBottom: '60%' }} key={`bar-${finChartBarAnimKey}`}>
                              <style>{`@keyframes growBarAnim { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
                              <div className="absolute inset-0 pt-[8.88%] pb-[15.55%] flex flex-col">
                                <div className="w-full flex-1 flex items-end justify-between gap-1.5 px-2 border-b-2 border-slate-50 relative group">
                                  {barData.map((bar, i) => {
                                    const hPercent = maxBarValue > 0 ? (bar.value / maxBarValue) * 100 : 0;
                                    const isHov = finChartHoveredBar === i;
                                    const isZero = bar.value === 0;
                                    return (
                                      <div key={i} className="group relative flex flex-col items-center flex-1 h-full justify-end cursor-pointer"
                                        onMouseEnter={() => setFinChartHoveredBar(i)} onMouseLeave={() => setFinChartHoveredBar(null)}>
                                        <div className={`absolute bottom-full mb-3 transition-all duration-300 pointer-events-none z-10 flex flex-col items-center ${isHov ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                          <div className="bg-slate-800 text-white text-[10px] font-black px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap border border-slate-700">
                                            <span className="text-slate-400 block mb-0.5 uppercase tracking-widest text-[8px]">{bar.label}</span>
                                            R$ {bar.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                          </div>
                                          <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700" />
                                        </div>
                                        <div className={`w-full max-w-[3rem] rounded-t-md transition-all duration-500 ${isZero ? 'bg-slate-100' : ''}`}
                                          style={{ backgroundColor: isZero ? undefined : isHov ? '#4a0600' : finChartHoveredBar !== null ? '#780a00' : '#610800', height: isZero ? '4px' : `${Math.max(hPercent, 3)}%`, transformOrigin: 'bottom', animation: 'growBarAnim 0.8s cubic-bezier(0.4, 0, 0.2, 1) backwards' }}>
                                          {!isZero && isHov && <div className="w-full h-1 bg-white/30 rounded-t-md" />}
                                        </div>
                                        <span className={`absolute -bottom-6 text-[9px] font-black truncate w-full text-center transition-colors duration-300 ${isHov ? 'text-[#610800]' : 'text-slate-400'}`}>{bar.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        }
                        // Compare mode: grouped bars income=indigo, expense=rose
                        const incRecs = financeRecords.filter(r => r.type === 'income');
                        const pv2 = (r: typeof financeRecords[0]) => parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
                        const getIncBarData = () => {
                          let bars: { label: string; value: number }[] = [];
                          if (finBarPeriodMode === 'semanal') {
                            bars = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 }));
                            if (barCurrentWeek) { const st = new Date(barCurrentWeek.start); st.setHours(0, 0, 0, 0); const en = new Date(barCurrentWeek.end); en.setHours(23, 59, 59, 999); incRecs.forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); if (dt >= st && dt <= en) { const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1; bars[idx].value += pv2(r); } }); }
                          } else if (finBarPeriodMode === 'mensal') {
                            const ws = getWeeksOfMonthLocal(finBarYear, finBarMonth); bars = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finBarYear && d.month === finBarMonth; }).forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); const wi = ws.findIndex(w => { const s = new Date(w.start); s.setHours(0, 0, 0, 0); const e = new Date(w.end); e.setHours(23, 59, 59, 999); return dt >= s && dt <= e; }); if (wi !== -1) bars[wi].value += pv2(r); });
                          } else if (finBarPeriodMode === 'bimestral') {
                            const m1 = (finBarPeriodIdx - 1) * 2 + 1; bars = [0, 1].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finBarYear && d.month >= m1 && d.month <= m1 + 1; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv2(r); });
                          } else if (finBarPeriodMode === 'trimestral') {
                            const m1 = (finBarPeriodIdx - 1) * 3 + 1; bars = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finBarYear && d.month >= m1 && d.month <= m1 + 2; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv2(r); });
                          } else if (finBarPeriodMode === 'semestral') {
                            const m1 = (finBarPeriodIdx - 1) * 6 + 1; bars = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finBarYear && d.month >= m1 && d.month <= m1 + 5; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - m1].value += pv2(r); });
                          } else { bars = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 })); incRecs.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finBarYear; }).forEach(r => { const d = parseRecordDate(r.date); if (d) bars[d.month - 1].value += pv2(r); }); }
                          return bars;
                        };
                        const incBarData = getIncBarData();
                        const maxCmpExpBarVal = Math.max(...barData.map(b => b.value), ...incBarData.map(b => b.value), 1);
                        const hasCmpExpBarData = barData.some(b => b.value > 0) || incBarData.some(b => b.value > 0);
                        return !hasCmpExpBarData ? (<div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados no período.</p></div>) : (
                          <div className="relative w-full animate-fadeIn" style={{ paddingBottom: '60%' }} key={`bar-cmp-${finChartBarAnimKey}`}>
                            <style>{`@keyframes growBarAnim { from { transform: scaleY(0); } to { transform: scaleY(1); } }`}</style>
                            <div className="absolute inset-0 pt-[8.88%] pb-[15.55%] flex flex-col">
                              <div className="w-full flex-1 flex items-end justify-between gap-1 px-1 border-b-2 border-slate-50 relative">
                                {barData.map((exp, i) => {
                                  const inc = incBarData[i] || { value: 0 };
                                  const expH = maxCmpExpBarVal > 0 ? (exp.value / maxCmpExpBarVal) * 100 : 0;
                                  const incH = maxCmpExpBarVal > 0 ? (inc.value / maxCmpExpBarVal) * 100 : 0;
                                  const isHov = finChartHoveredBar === i;
                                  return (
                                    <div key={i} className="flex flex-col items-center flex-1 h-full justify-end gap-0.5 relative group/cmp"
                                      onMouseEnter={() => setFinChartHoveredBar(i)} onMouseLeave={() => setFinChartHoveredBar(null)}>
                                      <div className={`absolute bottom-full mb-3 transition-all duration-300 pointer-events-none z-20 flex flex-col items-center ${isHov ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                                        {(() => {
                                          const diff = inc.value - exp.value;
                                          const isProfit = diff >= 0;
                                          const lbl = isProfit ? 'Lucro' : 'Despesa';
                                          const color = isProfit ? 'text-emerald-400' : 'text-[#610800]';
                                          return (
                                            <div className="bg-slate-800 rounded-lg shadow-xl border border-slate-700 p-2 flex flex-col gap-1.5 min-w-[7rem]">
                                              <span className="text-slate-400 font-black uppercase tracking-widest text-[8px] border-b border-slate-700 pb-1 text-center">{exp.label}</span>
                                              <div className="flex justify-between items-center gap-3 text-[9px] font-black"><span style={{ color: '#074221' }}>Receita</span> <span className="text-white">R$ {inc.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                              <div className="flex justify-between items-center gap-3 text-[9px] font-black"><span style={{ color: '#610800' }}>Despesa</span> <span className="text-white">R$ {exp.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                              <div className={`flex justify-between items-center gap-3 text-[10px] font-black pt-1 border-t border-slate-700 mt-0.5 ${color}`}><span className="uppercase">{lbl}</span> <span>R$ {Math.abs(diff).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                            </div>
                                          );
                                        })()}
                                        <div className="w-2 h-2 bg-slate-800 rotate-45 -mt-1 border-r border-b border-slate-700" />
                                      </div>
                                      <div className="flex items-end gap-0.5 h-full w-full justify-center">
                                        <div className="flex flex-col items-center justify-end h-full flex-1 relative">
                                          <div className="w-full rounded-t-sm transition-all duration-300" style={{ backgroundColor: '#074221', height: inc.value === 0 ? '3px' : `${Math.max(incH, 3)}%`, transformOrigin: 'bottom', animation: 'growBarAnim 0.8s ease backwards', filter: isHov ? 'brightness(1.1)' : 'none' }} />
                                        </div>
                                        <div className="flex flex-col items-center justify-end h-full flex-1 relative">
                                          <div className="w-full rounded-t-sm transition-all duration-300" style={{ backgroundColor: '#610800', height: exp.value === 0 ? '3px' : `${Math.max(expH, 3)}%`, transformOrigin: 'bottom', animation: 'growBarAnim 0.8s ease backwards', filter: isHov ? 'brightness(1.1)' : 'none' }} />
                                        </div>
                                      </div>
                                      <span className={`absolute -bottom-6 text-[9px] font-black truncate w-full text-center transition-colors ${isHov ? 'text-[#610800]' : 'text-slate-400'}`}>{exp.label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Vertical divider on xl */}
                    <div className="hidden xl:block w-px self-stretch bg-dotted border-l border-dotted border-black opacity-30 mx-2" />

                    {/* Line Chart */}
                    <div className="flex flex-col items-center gap-6 w-full xl:flex-1">
                      {/* Line Chart Navigation */}
                      <div className="flex flex-col items-center gap-3 w-full border-b border-slate-100 pb-5">
                        <div className="flex flex-wrap gap-1.5 justify-center">
                          {periodModes.map(pm => (
                            <button key={`line-${pm.key}`} onClick={() => setLineMode(pm.key)}
                              className={`px-3 py-1 rounded-full font-black text-[9px] uppercase tracking-widest transition-all ${finLinePeriodMode === pm.key ? 'bg-[#610800] text-white shadow-md' : 'bg-slate-50 text-slate-500 border border-slate-200 hover:border-[#610800]/30'}`}>
                              {pm.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-2 items-center justify-center">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                            {navBtn(() => navLineYear(-1), '<', lineYearAtMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[2.5rem] text-center">{finLineYear}</span>{navBtn(() => navLineYear(1), '>', lineYearAtMax)}
                          </div>
                          {(finLinePeriodMode === 'semanal' || finLinePeriodMode === 'mensal') && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                              {navBtn(() => navLineMonth(-1), '<', lineMonthAtMin)}<span className="text-[10px] font-black uppercase tracking-widest text-slate-700 min-w-[3rem] text-center">{monthNames[finLineMonth - 1].slice(0, 3)}</span>{navBtn(() => navLineMonth(1), '>', lineMonthAtMax)}
                            </div>
                          )}
                          {finLinePeriodMode === 'semanal' && lineCurrentWeek && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                              {navBtn(() => navLineWeek(-1), '<', lineWeekAtMin)}
                              <div className="flex flex-col items-center min-w-[5rem]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{lineCurrentWeek.label}</span>
                                <span className="text-[8px] font-black text-slate-400">({String(lineCurrentWeek.start.getDate()).padStart(2, '0')}/{String(lineCurrentWeek.start.getMonth() + 1).padStart(2, '0')} – {String(lineCurrentWeek.end.getDate()).padStart(2, '0')}/{String(lineCurrentWeek.end.getMonth() + 1).padStart(2, '0')})</span>
                              </div>
                              {navBtn(() => navLineWeek(1), '>', lineWeekAtMax)}
                            </div>
                          )}
                          {['bimestral', 'trimestral', 'semestral'].includes(finLinePeriodMode) && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                              {navBtn(() => navLinePeriodIdx(-1), '<', linePeriodAtMin)}
                              <div className="flex flex-col items-center min-w-[4.5rem]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{finLinePeriodIdx}º {finLinePeriodMode === 'bimestral' ? 'Bim' : finLinePeriodMode === 'trimestral' ? 'Tri' : 'Sem'}</span>
                                <span className="text-[8px] font-black text-slate-400">({periodLabelMap[finLinePeriodMode]?.[finLinePeriodIdx - 1]})</span>
                              </div>
                              {navBtn(() => navLinePeriodIdx(1), '>', linePeriodAtMax)}
                            </div>
                          )}
                        </div>
                      </div>

                      {(() => {
                        const W = 300; const H = 180; const PAD_L = 40; const PAD_R = 12; const PAD_T = 16; const PAD_B = 28;
                        const chartW = W - PAD_L - PAD_R; const chartH = H - PAD_T - PAD_B;
                        const fmtCompact2 = (v: number) => { if (v === 0) return '0'; if (v >= 1000) return (v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + 'K'; return v.toLocaleString('pt-BR', { maximumFractionDigits: 0 }); };

                        if (!finExpCompareMode) {
                          // Original single line (expense)
                          if (lineGrandTotal === 0) return (
                            <div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64">
                              <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mb-3">
                                <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>
                              </div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Não há despesas registradas neste período.</p>
                            </div>
                          );
                          const pts = lineData.map((p, i) => ({ x: PAD_L + (lineData.length > 1 ? (i / (lineData.length - 1)) * chartW : chartW / 2), y: PAD_T + chartH - (p.value / maxLineValue) * chartH, ...p }));
                          const pathD = pts.length > 1 ? pts.map((p, i) => { if (i === 0) return `M ${p.x} ${p.y}`; const prev = pts[i - 1]; const cx = (prev.x + p.x) / 2; return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`; }).join(' ') : `M ${pts[0]?.x} ${pts[0]?.y}`;
                          const areaD = pts.length > 1 ? `${pathD} L ${pts[pts.length - 1].x} ${PAD_T + chartH} L ${pts[0].x} ${PAD_T + chartH} Z` : '';
                          const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD_T + chartH - f * chartH, label: fmtCompact2(f * maxLineValue) }));
                          return (
                            <div className="flex flex-col w-full animate-fadeIn" key={`line-${finChartLineAnimKey}`}>
                              <div className="relative w-full" style={{ paddingBottom: `${(H / W) * 100}%` }}>
                                <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full overflow-visible">
                                  <defs>
                                    <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#610800" stopOpacity="0.25" /><stop offset="100%" stopColor="#610800" stopOpacity="0" /></linearGradient>
                                    <clipPath id={`sweepClip-${finChartLineAnimKey}`}><rect x={0} y={0} width={W} height={H}><animate attributeName="width" from="0" to={W} dur={`${Math.max(1.5, pts.length * 0.25).toFixed(1)}s`} fill="freeze" calcMode="linear" /></rect></clipPath>
                                  </defs>
                                  {yTicks.map((t, i) => (<g key={i}><line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#f1f5f9" strokeWidth="1" /><text x={PAD_L - 4} y={t.y + 4} textAnchor="end" fontSize="7" fill="#94a3b8" fontWeight="700">{t.label}</text></g>))}
                                  <g clipPath={`url(#sweepClip-${finChartLineAnimKey})`}>
                                    {areaD && <path d={areaD} fill="url(#lineAreaGrad)" />}
                                    <path d={pathD} fill="none" stroke="#610800" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(97,8,0,0.3))' }} />
                                    {pts.map((p, i) => {
                                      const isHov = finChartHoveredLine === i;
                                      const fmt = p.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                                      return (<g key={i}>
                                        <text x={p.x} y={H - 4} textAnchor="middle" fontSize="7" fill={isHov ? '#610800' : '#94a3b8'} fontWeight="700">{p.label}</text>
                                        <rect x={p.x - 14} y={PAD_T} width={28} height={chartH + 4} fill="transparent" onMouseEnter={() => setFinChartHoveredLine(i)} onMouseLeave={() => setFinChartHoveredLine(null)} style={{ cursor: 'pointer' }} />
                                        {isHov && <line x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + chartH} stroke="#610800" strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />}
                                        <circle cx={p.x} cy={p.y} r={isHov ? 4 : 2} fill={isHov ? '#610800' : '#fff'} stroke="#610800" strokeWidth="1.5" style={{ transition: 'r 0.2s', filter: isHov ? 'drop-shadow(0 2px 6px rgba(97,8,0,0.5))' : 'none' }} />
                                        {isHov && (() => { const tx = p.x + (p.x > W * 0.7 ? -65 : 8); const ty = Math.max(PAD_T + 2, p.y - 28); return (<g><rect x={tx} y={ty} width={60} height={22} rx={4} fill="#1e293b" opacity="0.95" /><text x={tx + 30} y={ty + 9} textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="700">{p.label}</text><text x={tx + 30} y={ty + 18} textAnchor="middle" fontSize="8" fill="#fff" fontWeight="900">R$ {fmt}</text></g>); })()}
                                      </g>);
                                    })}
                                  </g>
                                </svg>
                              </div>
                            </div>
                          );
                        }

                        // Compare mode: income=indigo, expense=rose dashed
                        const incRecs2 = financeRecords.filter(r => r.type === 'income');
                        const pv3 = (r: typeof financeRecords[0]) => parseFloat(r.value.replace(/\./g, '').replace(',', '.')) || 0;
                        const getIncLineData2 = () => {
                          let pts2: { label: string; value: number }[] = [];
                          if (finLinePeriodMode === 'semanal') {
                            pts2 = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(l => ({ label: l, value: 0 }));
                            if (lineCurrentWeek) { const st = new Date(lineCurrentWeek.start); st.setHours(0, 0, 0, 0); const en = new Date(lineCurrentWeek.end); en.setHours(23, 59, 59, 999); incRecs2.forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); if (dt >= st && dt <= en) { const idx = dt.getDay() === 0 ? 6 : dt.getDay() - 1; pts2[idx].value += pv3(r); } }); }
                          } else if (finLinePeriodMode === 'mensal') {
                            const ws = getWeeksOfMonthLocal(finLineYear, finLineMonth); pts2 = ws.map((_, i) => ({ label: `Sem. ${i + 1}`, value: 0 })); incRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finLineYear && d.month === finLineMonth; }).forEach(r => { const d = parseRecordDate(r.date); if (!d) return; const dt = new Date(d.year, d.month - 1, d.day); dt.setHours(12, 0, 0, 0); const wi = ws.findIndex(w => { const s = new Date(w.start); s.setHours(0, 0, 0, 0); const e = new Date(w.end); e.setHours(23, 59, 59, 999); return dt >= s && dt <= e; }); if (wi !== -1) pts2[wi].value += pv3(r); });
                          } else if (finLinePeriodMode === 'bimestral') {
                            const m1 = (finLinePeriodIdx - 1) * 2 + 1; pts2 = [0, 1].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finLineYear && d.month >= m1 && d.month <= m1 + 1; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - m1].value += pv3(r); });
                          } else if (finLinePeriodMode === 'trimestral') {
                            const m1 = (finLinePeriodIdx - 1) * 3 + 1; pts2 = [0, 1, 2].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finLineYear && d.month >= m1 && d.month <= m1 + 2; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - m1].value += pv3(r); });
                          } else if (finLinePeriodMode === 'semestral') {
                            const m1 = (finLinePeriodIdx - 1) * 6 + 1; pts2 = [0, 1, 2, 3, 4, 5].map(i => ({ label: monthNames[m1 + i - 1].slice(0, 3), value: 0 })); incRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finLineYear && d.month >= m1 && d.month <= m1 + 5; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - m1].value += pv3(r); });
                          } else { pts2 = monthNames.map(m => ({ label: m.slice(0, 3), value: 0 })); incRecs2.filter(r => { const d = parseRecordDate(r.date); return d && d.year === finLineYear; }).forEach(r => { const d = parseRecordDate(r.date); if (d) pts2[d.month - 1].value += pv3(r); }); }
                          return pts2;
                        };
                        const incLineData2 = getIncLineData2();
                        const maxCmpExpLineVal = Math.max(...lineData.map(p => p.value), ...incLineData2.map(p => p.value), 1);
                        const hasCmpExpLineData = lineData.some(p => p.value > 0) || incLineData2.some(p => p.value > 0);
                        if (!hasCmpExpLineData) return (<div className="flex flex-col items-center justify-center py-10 w-full animate-fadeIn opacity-60 h-64"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Sem dados no período.</p></div>);
                        const expPts2 = lineData.map((p, i) => ({ x: PAD_L + (lineData.length > 1 ? (i / (lineData.length - 1)) * chartW : chartW / 2), y: PAD_T + chartH - (p.value / maxCmpExpLineVal) * chartH, ...p }));
                        const incPts2 = incLineData2.map((p, i) => ({ x: PAD_L + (incLineData2.length > 1 ? (i / (incLineData2.length - 1)) * chartW : chartW / 2), y: PAD_T + chartH - (p.value / maxCmpExpLineVal) * chartH, ...p }));
                        const mkPath2 = (ps: typeof expPts2) => ps.length > 1 ? ps.map((p, i) => { if (i === 0) return `M ${p.x} ${p.y}`; const prev = ps[i - 1]; const cx = (prev.x + p.x) / 2; return `C ${cx} ${prev.y}, ${cx} ${p.y}, ${p.x} ${p.y}`; }).join(' ') : `M ${ps[0]?.x} ${ps[0]?.y}`;
                        const expPath2 = mkPath2(expPts2); const incPath2 = mkPath2(incPts2);
                        const yTicks3 = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD_T + chartH - f * chartH, label: fmtCompact2(f * maxCmpExpLineVal) }));
                        return (
                          <div className="flex flex-col w-full animate-fadeIn" key={`line-cmp-${finChartLineAnimKey}`}>
                            <div className="relative w-full" style={{ paddingBottom: `${(H / W) * 100}%` }}>
                              <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full overflow-visible">
                                <defs><clipPath id={`expCmpSweepClip-${finChartLineAnimKey}`}><rect x={0} y={0} width={W} height={H}><animate attributeName="width" from="0" to={W} dur="1.5s" fill="freeze" calcMode="linear" /></rect></clipPath></defs>
                                {yTicks3.map((t, i) => (<g key={i}><line x1={PAD_L} y1={t.y} x2={W - PAD_R} y2={t.y} stroke="#f1f5f9" strokeWidth="1" /><text x={PAD_L - 4} y={t.y + 4} textAnchor="end" fontSize="7" fill="#94a3b8" fontWeight="700">{t.label}</text></g>))}
                                <g clipPath={`url(#expCmpSweepClip-${finChartLineAnimKey})`}>
                                  <path d={expPath2} fill="none" stroke="#610800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,3" style={{ filter: 'drop-shadow(0 1px 3px rgba(97,8,0,0.3))' }} />
                                  <path d={incPath2} fill="none" stroke="#074221" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 4px rgba(7,66,33,0.3))' }} />
                                  {incPts2.map((p, i) => {
                                    const isHov = finChartHoveredLine === i;
                                    const expP = expPts2[i] || { x: p.x, y: PAD_T + chartH, value: 0 };
                                    const diff = p.value - expP.value;
                                    const isProfit = diff >= 0;
                                    const lbl = isProfit ? 'Lucro' : 'Desp.';
                                    return (
                                      <g key={`cmp-hov-${i}`}>
                                        <text x={p.x} y={H - 4} textAnchor="middle" fontSize="7" fill={isHov ? '#074221' : '#94a3b8'} fontWeight="700">{p.label}</text>
                                        <rect x={p.x - 14} y={PAD_T} width={28} height={chartH + 4} fill="transparent"
                                          onMouseEnter={() => setFinChartHoveredLine(i)} onMouseLeave={() => setFinChartHoveredLine(null)} style={{ cursor: 'pointer' }} />
                                        {isHov && <line x1={p.x} y1={PAD_T} x2={p.x} y2={PAD_T + chartH} stroke="#074221" strokeWidth="1" strokeDasharray="3,3" opacity="0.3" />}
                                        <circle cx={p.x} cy={p.y} r={isHov ? 4 : 2} fill={isHov ? '#074221' : '#fff'} stroke="#074221" strokeWidth="1.5" style={{ transition: 'r 0.2s', filter: isHov ? 'drop-shadow(0 2px 6px rgba(7,66,33,0.5))' : 'none' }} />
                                        <circle cx={expP.x} cy={expP.y} r={isHov ? 4 : 2} fill={isHov ? '#610800' : '#fff'} stroke="#610800" strokeWidth="1.5" style={{ transition: 'r 0.2s', filter: isHov ? 'drop-shadow(0 2px 6px rgba(97,8,0,0.5))' : 'none' }} />
                                        {isHov && (() => {
                                          const tx = p.x + (p.x > W * 0.7 ? -75 : 8);
                                          const ty = Math.max(PAD_T + 2, Math.min(p.y, expP.y) - 45);
                                          return (
                                            <g>
                                              <rect x={tx} y={ty} width={70} height={42} rx={4} fill="#1e293b" opacity="0.95" />
                                              <text x={tx + 35} y={ty + 10} textAnchor="middle" fontSize="7" fill="#94a3b8" fontWeight="700">{p.label}</text>

                                              <circle cx={tx + 6} cy={ty + 18} r={2} fill="#074221" />
                                              <text x={tx + 12} y={ty + 20} fontSize="6" fill="#cbd5e1">R$ {p.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>

                                              <circle cx={tx + 6} cy={ty + 26} r={2} fill="#610800" />
                                              <text x={tx + 12} y={ty + 28} fontSize="6" fill="#cbd5e1">R$ {expP.value.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>

                                              <line x1={tx + 4} y1={ty + 31} x2={tx + 66} y2={ty + 31} stroke="#334155" strokeWidth="0.5" />
                                              <text x={tx + 35} y={ty + 38} textAnchor="middle" fontSize="6.5" fill={isProfit ? '#34d399' : '#610800'} fontWeight="900">{lbl}: R$ {Math.abs(diff).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</text>
                                            </g>
                                          );
                                        })()}
                                      </g>
                                    );
                                  })}
                                </g>
                              </svg>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Compare Block */}
                  <div className="w-full flex flex-col border border-slate-100 bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all mt-0 relative xl:hidden">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Comparação (Pizza)</span>
                        <div className="flex items-center gap-2">
                          <button onClick={toggleCompare} className="flex items-center justify-center p-1 hover:bg-slate-100 rounded-full transition-colors cursor-pointer">
                            <div className={`w-8 h-4 rounded-full flex items-center p-0.5 transition-colors ${showComparison ? 'bg-slate-800' : 'bg-slate-200'}`}>
                              <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-300 ${showComparison ? 'translate-x-4' : 'translate-x-0'}`} />
                            </div>
                          </button>
                          <span className="text-[10px] font-black text-slate-600">vs {prevPeriodLabel}</span>
                        </div>
                      </div>
                      {showComparison && (
                        <div className="flex flex-col items-end gap-1 animate-fadeIn">
                          {(() => {
                            const totalVar = prevGrandTotal > 0 ? ((grandTotal - prevGrandTotal) / prevGrandTotal) * 100 : (grandTotal > 0 ? 100 : 0);
                            return (
                              <div className={`flex items-center gap-1 font-black text-xs ${prevGrandTotal === 0 ? 'text-slate-400' : totalVar > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {prevGrandTotal > 0 && totalVar > 0 ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 15l7-7 7 7" /></svg>
                                  : prevGrandTotal > 0 ? <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" /></svg> : null}
                                <span>{prevGrandTotal > 0 && totalVar > 0 ? '+' : ''}{prevGrandTotal > 0 ? totalVar.toFixed(1) + '%' : 'Sem base'}</span>
                              </div>
                            );
                          })()}
                          {prevGrandTotal > 0 ? (
                            <span className="text-[9px] font-black text-slate-400">R$ {prevGrandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ant.</span>
                          ) : (
                            <span className="text-[9px] font-black text-slate-400">R$ 0,00</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        );
      })()
      }
      {view === 'finances_categories' && renderFinancesCategories()}
      {view === 'finances_income_onboarding' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn px-4">
          <div className="w-full max-w-md bg-white border-2 border-black/10 rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center gap-8">
            {/* Icon */}
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ backgroundColor: '#074221' }}>
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            {/* Title */}
            <div className="text-center flex flex-col gap-2">
              <h2 className="text-2xl font-black text-slate-900 leading-tight">Informe sua receita mensal</h2>
              <p className="text-sm text-slate-500 font-medium">Configure seus dados financeiros para acompanhar sua evolução mês a mês.</p>
            </div>
            {/* Buttons */}
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setView('finances')}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-sm border-2 border-black/20 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  setFinMonthlyOverviewBack('finances_income');
                  setFinMonthlyOverviewReadOnly(false);
                  setView('finances_monthly_overview');
                }}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                style={{ backgroundColor: '#074221' }}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}
      {view === 'finances_expense_onboarding' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fadeIn px-4">
          <div className="w-full max-w-md bg-white border-2 border-black/10 rounded-[2.5rem] p-10 shadow-2xl flex flex-col items-center gap-8">
            {/* Icon */}
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ backgroundColor: '#610800' }}>
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14" />
              </svg>
            </div>
            {/* Title */}
            <div className="text-center flex flex-col gap-2">
              <h2 className="text-2xl font-black text-slate-900 leading-tight">Informe sua despesa mensal</h2>
              <p className="text-sm text-slate-500 font-medium">Configure o seu teto de gastos mensal para ter um melhor controle financeiro.</p>
            </div>
            {/* Buttons */}
            <div className="flex gap-4 w-full">
              <button
                onClick={() => setView('finances')}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-sm border-2 border-black/20 text-slate-600 hover:bg-slate-50 active:scale-95 transition-all"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  setFinMonthlyOverviewBack('finances_expenses');
                  setFinMonthlyOverviewReadOnly(false);
                  setView('finances_monthly_overview');
                }}
                className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                style={{ backgroundColor: '#610800' }}
              >
                Próximo
              </button>
            </div>
          </div>
        </div>
      )}
      {view === 'finances_income_form' && renderFinancesIncomeForm()}
      {view === 'finances_income_form_step2' && renderFinancesIncomeFormStep2()}
      {view === 'finances_expense_form' && renderFinancesExpenseForm()}
      {view === 'finances_expense_form_step2' && renderFinancesExpenseFormStep2()}
      {view === 'finances_income_list' && renderFinanceList('income')}
      {view === 'finances_expense_list' && renderFinanceList('expense')}
      {view === 'finances_create_category' && renderFinancesCreateCategory()}
      {
        view === 'finances_monthly_overview' && (() => {
          const isIncome = finMonthlyOverviewBack === 'finances_income';
          const accentColor = isIncome ? '#074221' : '#610800';
          const accentBg = isIncome ? 'bg-[#074221]' : 'bg-[#610800]';
          const accentBorder = isIncome ? 'border-[#074221]' : 'border-[#610800]';
          const accentText = isIncome ? 'text-[#074221]' : 'text-[#610800]';

          const value = isIncome ? finMonthIncomeValue : finMonthExpenseValue;
          const setValue = isIncome ? setFinMonthIncomeValue : setFinMonthExpenseValue;
          const backup = isIncome ? finMonthIncomeBackup : finMonthExpenseBackup;
          const setBackup = isIncome ? setFinMonthIncomeBackup : setFinMonthExpenseBackup;

          const pontualMeta = isIncome ? finMonthIncomePontualMeta : finMonthExpensePontualMeta;
          const setPontualMeta = isIncome ? setFinMonthIncomePontualMeta : setFinMonthExpensePontualMeta;
          const pontualMetaBackup = isIncome ? finMonthIncomePontualMetaBackup : finMonthExpensePontualMetaBackup;
          const setPontualMetaBackup = isIncome ? setFinMonthIncomePontualMetaBackup : setFinMonthExpensePontualMetaBackup;
          const pontualType = isIncome ? finMonthIncomePontualType : finMonthExpensePontualType;
          const setPontualType = isIncome ? setFinMonthIncomePontualType : setFinMonthExpensePontualType;
          const pontualAmount = isIncome ? finMonthIncomePontualAmount : finMonthExpensePontualAmount;
          const setPontualAmount = isIncome ? setFinMonthIncomePontualAmount : setFinMonthExpensePontualAmount;

          const definidaMeta = isIncome ? finMonthIncomeDefinidaMeta : finMonthExpenseDefinidaMeta;
          const setDefinidaMeta = isIncome ? setFinMonthIncomeDefinidaMeta : setFinMonthExpenseDefinidaMeta;
          const definidaMetaBackup = isIncome ? finMonthIncomeDefinidaMetaBackup : finMonthExpenseDefinidaMetaBackup;
          const setDefinidaMetaBackup = isIncome ? setFinMonthIncomeDefinidaMetaBackup : setFinMonthExpenseDefinidaMetaBackup;
          const definidaType = isIncome ? finMonthIncomeDefinidaType : finMonthExpenseDefinidaType;
          const setDefinidaType = isIncome ? setFinMonthIncomeDefinidaType : setFinMonthExpenseDefinidaType;
          const definidaAmount = isIncome ? finMonthIncomeDefinidaAmount : finMonthExpenseDefinidaAmount;
          const setDefinidaAmount = isIncome ? setFinMonthIncomeDefinidaAmount : setFinMonthExpenseDefinidaAmount;

          const pontualSavedAt = isIncome ? finMonthIncomePontualSavedAt : finMonthExpensePontualSavedAt;
          const setPontualSavedAt = isIncome ? setFinMonthIncomePontualSavedAt : setFinMonthExpensePontualSavedAt;
          const definidaSavedAt = isIncome ? finMonthIncomeDefinidaSavedAt : finMonthExpenseDefinidaSavedAt;
          const setDefinidaSavedAt = isIncome ? setFinMonthIncomeDefinidaSavedAt : setFinMonthExpenseDefinidaSavedAt;

          const getPluralLabel = (val: string, type: string) => {
            const num = parseInt(val || '1');
            if (type === 'dias') return num === 1 ? 'dia' : 'dias';
            if (type === 'mes' || type === 'meses') return num === 1 ? 'mês' : 'meses';
            if (type === 'ano') return num === 1 ? 'ano' : 'anos';
            return '';
          };

          const getMaxValue = (type: string) => {
            if (type === 'dias') return 31;
            if (type === 'meses') return 12;
            if (type === 'ano') return 10;
            return 999;
          };

          const periodBtns: { key: typeof pontualType; label: string }[] = [
            { key: 'sem_aumento', label: 'Sem aumento' },
            { key: 'dias', label: 'Dias' },
            { key: 'meses', label: 'Meses' },
            { key: 'ano', label: 'Ano' },
          ];

          const renderValueInput = (
            val: string, setVal: (v: string) => void, bkp: string, setBkp: (v: string) => void
          ) => (
            <div className="flex items-center justify-start gap-3">
              <button
                onClick={() => {
                  const current = parseFloat((val || '0').replace(',', '.')) || 0;
                  const prev = Math.ceil(current / 100) * 100 - 100;
                  setVal(String(Math.max(0, prev)));
                }}
                className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-black/30 flex items-center justify-center font-black text-xl hover:bg-slate-200 transition-all active:scale-90"
              >-</button>
              <div className="relative w-36">
                <input
                  type="text"
                  inputMode="decimal"
                  value={val}
                  onFocus={() => { setBkp(val || '0'); setVal(''); }}
                  onBlur={() => { if (!val) setVal(bkp); }}
                  onChange={(e) => setVal(e.target.value.replace(/[^0-9,]/g, ''))}
                  placeholder="0,00"
                  className="w-full p-2.5 border-2 border-black/30 rounded-xl font-black text-base text-center outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
                />
              </div>
              <button
                onClick={() => {
                  const current = parseFloat((val || '0').replace(',', '.')) || 0;
                  const next = Math.floor(current / 100) * 100 + 100;
                  setVal(String(next));
                }}
                className="w-10 h-10 rounded-xl bg-slate-100 border-2 border-black/30 flex items-center justify-center font-black text-xl hover:bg-slate-200 transition-all active:scale-90"
              >+</button>
            </div>
          );

          return (
            <div className="flex flex-col items-center pt-4 pb-24 animate-fadeIn w-full">
              {StudyStyleHeader({
                onBack: () => { setFinMonthlyOverviewWarning(null); setView(finMonthlyOverviewBack); },
                onHome: () => { setFinMonthlyOverviewWarning(null); setView('finances'); },
              })}

              <div className="animate-fadeIn max-w-2xl w-full flex flex-col items-center pt-2 px-4">
                {finMonthlyOverviewReadOnly ? (
                  /* ── READ-ONLY VIEW ── */
                  <div className="w-full bg-white border-2 border-black/20 rounded-[2.5rem] p-8 shadow-2xl flex flex-col gap-6">
                    <div className="flex items-center justify-between">
                      <h2 className={`text-lg font-black uppercase tracking-widest ${accentText}`}>
                        {isIncome ? 'Receita Mensal' : 'Despesa Mensal'}
                      </h2>
                      <button
                        onClick={() => setFinMonthlyOverviewReadOnly(false)}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest text-white shadow-md hover:scale-105 active:scale-95 transition-all"
                        style={{ backgroundColor: accentColor }}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between py-4 border-b border-slate-100">
                        <span className="text-sm font-black text-slate-500 uppercase tracking-widest">{isIncome ? 'Receita por mês' : 'Despesa por mês'}</span>
                        <span className="text-2xl font-black" style={{ color: accentColor }}>R$ {parseFloat((value || '0').replace(',', '.') || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {parseFloat((pontualMeta || '0').replace(',', '.') || '0') > 0 && (
                        <div className="flex items-center justify-between py-3 border-b border-slate-100">
                          <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Meta pontual</span>
                          <span className="text-lg font-black text-slate-800">R$ {parseFloat((pontualMeta || '0').replace(',', '.') || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {parseFloat((definidaMeta || '0').replace(',', '.') || '0') > 0 && (
                        <div className="flex items-center justify-between py-3">
                          <span className="text-sm font-black text-slate-500 uppercase tracking-widest">Meta definitiva</span>
                          <span className="text-lg font-black text-slate-800">R$ {parseFloat((definidaMeta || '0').replace(',', '.') || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full bg-white border-2 border-black/20 rounded-[2.5rem] p-8 shadow-2xl flex flex-col gap-10">

                    {/* Pergunta 1 */}
                    <div className="space-y-4">
                      <label className={`text-sm font-black uppercase tracking-widest pl-2 flex items-center gap-2 ${accentText}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        1. {isIncome ? 'Minha receita por mês' : 'Minha despesa por mês'}
                      </label>
                      {renderValueInput(value, setValue, backup, setBackup)}
                    </div>

                    {/* Pergunta 2 */}
                    <div className="space-y-4">
                      <label className={`text-sm font-black uppercase tracking-widest pl-2 flex items-center gap-2 ${accentText}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        2. Meta pontual de {isIncome ? 'aumento' : 'redução'}
                      </label>
                      {renderValueInput(pontualMeta, setPontualMeta, pontualMetaBackup, setPontualMetaBackup)}
                      {(() => {
                        const curVal = parseFloat((value || '0').replace(',', '.')) || 0;
                        const pMeta = parseFloat((pontualMeta || '0').replace(',', '.')) || 0;
                        if (!pMeta || pMeta <= 0) return null;

                        const diff = isIncome ? (pMeta > curVal ? pMeta - curVal : 0) : (pMeta > 0 && pMeta < curVal ? curVal - pMeta : 0);
                        const pct = curVal > 0 ? (diff / curVal) * 100 : 0;
                        const typeLabel = isIncome ? 'aumento' : 'redução';

                        if (diff <= 0) return null;

                        return (
                          <div className="flex items-center gap-2 pl-2 animate-fadeIn">
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">
                              Representa {typeLabel} de: R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className={!isIncome ? "text-red-500" : ""}>({!isIncome ? '-' : ''}{pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span>
                            </span>
                          </div>
                        );
                      })()}
                      {!!parseFloat((pontualMeta || '0').replace(',', '.')) && parseFloat((pontualMeta || '0').replace(',', '.')) > 0 && (
                        <div className="flex flex-col gap-4 pt-1 animate-fadeIn">
                          <div className="flex flex-wrap gap-2">
                            {periodBtns.map(({ key, label }) => (
                              <div key={key} className="flex flex-col gap-3">
                                <button
                                  onClick={() => setPontualType(pontualType === key ? '' : key)}
                                  className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase transition-all ${pontualType === key ? `bg-black text-white border-black` : 'bg-white text-black border-black/30 hover:border-black'}`}
                                >
                                  {label}
                                </button>
                                {pontualType === key && key !== 'sem_aumento' && (
                                  <div className="flex flex-col gap-2 animate-fadeIn pl-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none text-center w-full">Em:</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setPontualAmount(String(Math.max(1, parseInt(pontualAmount || '0') - 1)))}
                                        className="w-8 h-8 rounded-lg bg-black border-2 border-black flex items-center justify-center font-black text-lg text-white transition-all active:scale-90"
                                      >-</button>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={pontualAmount}
                                          onFocus={() => setPontualAmount('')}
                                          onBlur={() => {
                                            const max = getMaxValue(key);
                                            const val = parseInt(pontualAmount || '0');
                                            if (!pontualAmount || val < 1) setPontualAmount('1');
                                            else if (val > max) setPontualAmount(String(max));
                                          }}
                                          onChange={(e) => {
                                            const clean = e.target.value.replace(/[^0-9]/g, '');
                                            const max = getMaxValue(key);
                                            if (clean && parseInt(clean) > max) setPontualAmount(String(max));
                                            else setPontualAmount(clean);
                                          }}
                                          className="w-14 p-1.5 border-2 border-black/30 rounded-lg font-black text-sm text-center outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
                                        />
                                        <span className="text-xs font-black text-slate-600 lowercase">{getPluralLabel(pontualAmount, key)}</span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          const max = getMaxValue(key);
                                          const next = parseInt(pontualAmount || '0') + 1;
                                          if (next <= max) setPontualAmount(String(next));
                                        }}
                                        className="w-8 h-8 rounded-lg bg-black border-2 border-black flex items-center justify-center font-black text-lg text-white transition-all active:scale-90"
                                      >+</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Pergunta 3 */}
                    <div className="space-y-4">
                      <label className={`text-sm font-black uppercase tracking-widest pl-2 flex items-center gap-2 ${accentText}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
                        3. Meta definida de {isIncome ? 'aumento' : 'redução'}
                      </label>
                      {renderValueInput(definidaMeta, setDefinidaMeta, definidaMetaBackup, setDefinidaMetaBackup)}
                      {(() => {
                        const curVal = parseFloat((value || '0').replace(',', '.')) || 0;
                        const dMeta = parseFloat((definidaMeta || '0').replace(',', '.')) || 0;
                        if (!dMeta || dMeta <= 0) return null;

                        const diff = isIncome ? (dMeta > curVal ? dMeta - curVal : 0) : (dMeta > 0 && dMeta < curVal ? curVal - dMeta : 0);
                        const pct = curVal > 0 ? (diff / curVal) * 100 : 0;
                        const typeLabel = isIncome ? 'aumento' : 'redução';

                        if (diff <= 0) return null;

                        return (
                          <div className="flex items-center gap-2 pl-2 animate-fadeIn">
                            <span className="text-[10px] font-black text-black uppercase tracking-widest">
                              Representa {typeLabel} de: R$ {diff.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} <span className={!isIncome ? "text-red-500" : ""}>({!isIncome ? '-' : ''}{pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%)</span>
                            </span>
                          </div>
                        );
                      })()}
                      {!!parseFloat((definidaMeta || '0').replace(',', '.')) && parseFloat((definidaMeta || '0').replace(',', '.')) > 0 && (
                        <div className="flex flex-col gap-4 pt-1 animate-fadeIn">
                          <div className="flex flex-wrap gap-2">
                            {periodBtns.map(({ key, label }) => (
                              <div key={key} className="flex flex-col gap-3">
                                <button
                                  key={key}
                                  onClick={() => setDefinidaType(definidaType === key ? '' : key)}
                                  className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase transition-all ${definidaType === key ? `bg-black text-white border-black` : 'bg-white text-black border-black/30 hover:border-black'}`}
                                >
                                  {label}
                                </button>
                                {definidaType === key && key !== 'sem_aumento' && (
                                  <div className="flex flex-col gap-2 animate-fadeIn pl-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none text-center w-full">Em:</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => setDefinidaAmount(String(Math.max(1, parseInt(definidaAmount || '0') - 1)))}
                                        className="w-8 h-8 rounded-lg bg-black border-2 border-black flex items-center justify-center font-black text-lg text-white transition-all active:scale-90"
                                      >-</button>
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={definidaAmount}
                                          onFocus={() => setDefinidaAmount('')}
                                          onBlur={() => {
                                            const max = getMaxValue(key);
                                            const val = parseInt(definidaAmount || '0');
                                            if (!definidaAmount || val < 1) setDefinidaAmount('1');
                                            else if (val > max) setDefinidaAmount(String(max));
                                          }}
                                          onChange={(e) => {
                                            const clean = e.target.value.replace(/[^0-9]/g, '');
                                            const max = getMaxValue(key);
                                            if (clean && parseInt(clean) > max) setDefinidaAmount(String(max));
                                            else setDefinidaAmount(clean);
                                          }}
                                          className="w-14 p-1.5 border-2 border-black/30 rounded-lg font-black text-sm text-center outline-none bg-slate-50 focus:bg-white transition-all text-slate-800"
                                        />
                                        <span className="text-xs font-black text-slate-600 lowercase">{getPluralLabel(definidaAmount, key)}</span>
                                      </div>
                                      <button
                                        onClick={() => {
                                          const max = getMaxValue(key);
                                          const next = parseInt(definidaAmount || '0') + 1;
                                          if (next <= max) setDefinidaAmount(String(next));
                                        }}
                                        className="w-8 h-8 rounded-lg bg-black border-2 border-black flex items-center justify-center font-black text-lg text-white transition-all active:scale-90"
                                      >+</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Botão Salvar */}
                    <div className="flex flex-col gap-3 w-full">
                      <button
                        onClick={() => {
                          const cur = parseFloat((value || '0').replace(',', '.')) || 0;
                          const pont = parseFloat((pontualMeta || '0').replace(',', '.')) || 0;
                          const def = parseFloat((definidaMeta || '0').replace(',', '.')) || 0;

                          if (isIncome) {
                            if (pont > 0 && pont < cur) {
                              setFinMonthlyOverviewWarning("A meta pontual de aumento não pode ser menor que a sua receita atual.");
                              return;
                            }
                            if (def > 0 && def < pont) {
                              setFinMonthlyOverviewWarning("A meta definitiva de aumento não pode ser menor que a sua meta pontual.");
                              return;
                            }
                          } else {
                            if (pont > 0 && pont > cur) {
                              setFinMonthlyOverviewWarning("A meta pontual de redução não pode ser maior que a sua despesa atual.");
                              return;
                            }
                            if (def > 0 && def > pont) {
                              setFinMonthlyOverviewWarning("A meta definitiva de redução não pode ser maior que a sua meta pontual.");
                              return;
                            }
                          }

                          // Validation for Meta Type
                          if (parseFloat((pontualMeta || '0').replace(',', '.').replace(/\./g, '')) > 0 && !pontualType) {
                            setFinMonthlyOverviewWarning("Por favor, selecione o período da Meta Pontual (em dias, meses, etc).");
                            return;
                          }
                          if (parseFloat((definidaMeta || '0').replace(',', '.').replace(/\./g, '')) > 0 && !definidaType) {
                            setFinMonthlyOverviewWarning("Por favor, selecione o período da Meta Definitiva (em dias, meses, etc).");
                            return;
                          }

                          const now = new Date().toISOString();
                          setPontualSavedAt(now);
                          setDefinidaSavedAt(now);

                          setFinMonthlyOverviewWarning(null);
                          // persist to localStorage
                          const key = isIncome ? 'fin_monthly_income_data' : 'fin_monthly_expense_data';
                          localStorage.setItem(key, JSON.stringify({
                            value,
                            pontualMeta,
                            pontualType,
                            pontualAmount,
                            pontualSavedAt: now,
                            definidaMeta,
                            definidaType,
                            definidaAmount,
                            definidaSavedAt: now
                          }));

                          // mark onboarding done
                          if (isIncome) {
                            localStorage.setItem('fin_income_onboarded', 'true');
                            setFinIncomeOnboarded(true);
                          } else {
                            localStorage.setItem('fin_expense_onboarded', 'true');
                            setFinExpenseOnboarded(true);
                          }

                          setFinMonthlyOverviewReadOnly(false);
                          setView(finMonthlyOverviewBack);
                        }}
                        className="w-full py-4 rounded-2xl font-black uppercase tracking-widest text-sm text-white shadow-xl hover:scale-105 active:scale-95 transition-all"
                        style={{ backgroundColor: accentColor }}
                      >
                        Salvar
                      </button>
                      {finMonthlyOverviewWarning && (
                        <div className="bg-red-50 border-2 border-red-200 p-4 rounded-2xl animate-fadeIn">
                          <p className="text-[11px] font-black text-red-600 uppercase tracking-widest text-center leading-relaxed">
                            {finMonthlyOverviewWarning}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )} {/* end read-only / edit conditional */}
              </div>
            </div>
          );
        })()
      }
      {view === 'oratoria_setup' && renderOratoriaSetup()}


      {view === 'gym_menu' && renderGymMenu()}

      {
        view === 'gym_choice' && (
          <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
            <BackButton to="entry" />
            <h2 className={`text-5xl font-black ${textColor} mb-12 uppercase tracking-tighter`}>Treino</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full max-w-2xl px-4">
              <button
                onClick={() => {
                  setHistoryTab('done_workouts');
                  setView('gym_history');
                }}
                className="bg-white border-2 border-black p-10 rounded-[2.5rem] flex flex-col items-center gap-4 hover:scale-105 transition-all shadow-xl group"
              >
                <div className="p-4 rounded-2xl bg-slate-50 text-black transition-all">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="font-black text-lg uppercase tracking-widest text-center leading-tight">Histórico</span>
              </button>

              <button
                onClick={() => setView('gym_now')}
                className="bg-white border-2 border-black p-10 rounded-[2.5rem] flex flex-col items-center gap-4 hover:scale-105 transition-all shadow-xl group"
              >
                <div className="p-4 rounded-2xl bg-slate-50 text-black transition-all">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <span className="font-black text-lg uppercase tracking-widest text-center leading-tight">Treinar agora</span>
              </button>

              <button
                onClick={() => setView('gym_manage')}
                className="bg-white border-2 border-black p-10 rounded-[2.5rem] flex flex-col items-center gap-4 hover:scale-105 transition-all shadow-xl group"
              >
                <div className="p-4 rounded-2xl bg-slate-50 text-black transition-all">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                </div>
                <span className="font-black text-lg uppercase tracking-widest text-center leading-tight">Gerenciar meus treinos</span>
              </button>

              <button
                onClick={() => {
                  setSelectedMuscles([]);
                  setSelectedSubMuscles({});
                  setSelectedExercises({});
                  setWorkoutMode('custom');
                  setView('gym_train');
                }}
                className="bg-black border-2 border-black text-white p-10 rounded-[2.5rem] flex flex-col items-center gap-4 hover:scale-105 transition-all shadow-xl group"
              >
                <div className="p-4 rounded-2xl bg-white/20 transition-all">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v16m8-8H4" /></svg>
                </div>
                <span className="font-black text-lg uppercase tracking-widest text-center leading-tight">Adicionar treino</span>
              </button>
            </div>
          </div>
        )
      }

      {
        view === 'gym_now' && (
          <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
            <BackButton to="gym_choice" />
            <h2 className="text-4xl font-black text-slate-800 uppercase tracking-tighter mb-8">Meus Treinos</h2>

            {savedWorkouts.length === 0 ? (
              <div className="text-center py-10 flex flex-col items-center">
                <div className="w-24 h-24 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-8">
                  <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase mb-4">Sem treinos salvos</h3>
                <p className="text-slate-400 font-bold max-w-md mb-10">Monte sua rotina personalizada para começar!</p>
                <button
                  onClick={() => setView('gym_train')}
                  className="px-12 py-5 bg-black text-white rounded-2xl font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl"
                >
                  Montar Treino
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-12 w-full pb-10">
                {savedWorkouts.sort((a, b) => weekDays.indexOf(a.day.split(' / ')[0]) - weekDays.indexOf(b.day.split(' / ')[0])).map(workout => (
                  <div key={workout.id} className="w-full animate-fadeIn">
                    <div className="flex flex-wrap gap-3 mb-4 px-6">
                      {workout.day.split(' / ').map(day => (
                        <div key={day} className="bg-zinc-800 border-2 border-zinc-800 text-white px-5 py-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-lg rounded-none">
                          {day}
                        </div>
                      ))}
                      <div className="ml-auto">
                        <button
                          onClick={() => setWorkoutToDelete(workout)}
                          className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors border-2 border-transparent hover:border-red-100"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>

                    <div className="bg-white border-2 border-black rounded-[3rem] p-10 shadow-xl overflow-hidden relative">
                      <div className="space-y-12">
                        {workout.muscles.map((mainGroup, groupIdx) => {
                          const relevantSubs = Object.keys(workout.exercises).filter(sub => muscleSubGroups[mainGroup].includes(sub));
                          if (relevantSubs.length === 0) return null;

                          return (
                            <div key={mainGroup} className="flex flex-col">
                              <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg">
                                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M6 12h12M6 7v10M3 9v6M18 7v10M21 9v6" /></svg>
                                </div>
                                <h3 className="text-3xl font-black text-slate-800 uppercase tracking-tighter">Grupamento: {mainGroup}</h3>
                              </div>

                              <div className="space-y-10">
                                {relevantSubs.map((subName, subIdx) => {
                                  const isLastSub = subIdx === relevantSubs.length - 1;
                                  return (
                                    <div key={subName} className={`tree-line ${isLastSub ? 'tree-line-last' : ''}`}>
                                      <div className="flex items-center gap-3 mb-6">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                        <span className="text-xl font-black text-slate-600 uppercase tracking-tighter">Local: {subName}</span>
                                      </div>

                                      <div className="space-y-8 pr-4">
                                        {Object.entries(workout.exercises[subName]).map(([exName, d], exIdx) => {
                                          const details = d as ExerciseDetails;
                                          const isLastEx = exIdx === Object.keys(workout.exercises[subName]).length - 1;

                                          const dbEntry = gymDb[subName];
                                          const isMulti = dbEntry?.multi.some(e => e.name === exName);
                                          const exerciseInfo = isMulti
                                            ? dbEntry.multi.find(e => e.name === exName)
                                            : dbEntry?.isolados.find(e => e.name === exName);

                                          return (
                                            <div key={exName} className={`tree-line ${isLastEx ? 'tree-line-last' : ''}`}>
                                              <div className="bg-slate-50/80 p-6 rounded-[2rem] border-2 border-[#7EB1FF] shadow-sm group transition-none pr-10">
                                                <h4 className="font-black text-slate-800 text-lg uppercase tracking-tight mb-2 flex items-center gap-2">
                                                  <div className="w-1.5 h-6 bg-slate-300 rounded-full"></div>
                                                  Exercício: {exName} <span className="ml-2 text-sm text-[#7EB1FF]">({isMulti ? 'Multiarticulado' : 'Isolado'})</span>
                                                </h4>

                                                {isMulti && exerciseInfo && (
                                                  <div className="px-3 py-2 mb-4 bg-blue-50/50 rounded-xl border border-blue-100 flex flex-wrap gap-x-4 gap-y-1">
                                                    {exerciseInfo.more && (
                                                      <div className="flex gap-1.5 items-center">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pega mais:</span>
                                                        <span className="text-[9px] font-bold text-slate-600">{exerciseInfo.more}</span>
                                                      </div>
                                                    )}
                                                    {exerciseInfo.less && (
                                                      <div className="flex gap-1.5 items-center">
                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pega menos:</span>
                                                        <span className="text-[9px] font-bold text-slate-600">{exerciseInfo.less}</span>
                                                      </div>
                                                    )}
                                                  </div>
                                                )}

                                                <div className="tree-line tree-line-last mt-4 pr-4">
                                                  <div className="grid grid-cols-4 gap-x-12 pl-3">
                                                    <div className="flex flex-col">
                                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">Séries</span>
                                                      <span className="text-xl font-black text-slate-700">{details.sets || '-'}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">Repetições</span>
                                                      <span className="text-xl font-black text-slate-700">{details.reps || '-'}</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">Tempo/<br />Série</span>
                                                      <span className="text-xl font-black text-slate-700">{details.timePerSet || '-'}s</span>
                                                    </div>
                                                    <div className="flex flex-col">
                                                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-tight mb-1">Descanso</span>
                                                      <span className="text-xl font-black text-slate-700">{details.rest || '-'}s</span>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-12 pt-8 border-t-2 border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-6">
                        <div className="flex flex-col items-center sm:items-start">
                          <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Carga total de tempo estimada</span>
                          <span className="text-4xl font-black text-blue-600 tracking-tighter">{formatSeconds(getTotalWorkoutTime(workout.exercises))}</span>
                        </div>
                        <button
                          onClick={() => handleStartWorkout(workout)}
                          className="w-full sm:w-auto px-16 py-5 bg-black text-white rounded-[1.5rem] font-black uppercase tracking-[0.2em] text-xs hover:scale-105 transition-all shadow-xl active:scale-95"
                        >
                          Iniciar Treino
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      }

      {
        view === 'gym_train' && (
          <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
            <BackButton to="gym_choice" />

            <div className="flex gap-4 mb-12">
              <button
                onClick={() => { setWorkoutMode('custom'); setSelectedMuscles([]); }}
                className={`px-6 py-3 border-2 border-black rounded-xl font-black text-xs uppercase tracking-widest transition-all ${workoutMode === 'custom' ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'}`}
              >
                Treino personalizado
              </button>
              <button
                onClick={() => { setWorkoutMode('recommended'); setSelectedMuscles([]); }}
                className={`px-6 py-3 border-2 border-black rounded-xl font-black text-xs uppercase tracking-widest transition-all ${workoutMode === 'recommended' ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-50'}`}
              >
                Treino recomendado
              </button>
            </div>

            <div className="w-full bg-white border-2 border-black rounded-[3rem] p-12 shadow-2xl">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-8 h-8 bg-black rounded-2xl flex items-center justify-center text-white font-black text-sm">1</div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">escolha o grupamento muscular</h3>
              </div>

              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-6">Você pode selecionar no máximo 3 opções:</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
                {muscleGroups.map(muscle => {
                  const isSelected = selectedMuscles.includes(muscle);
                  const isMax = selectedMuscles.length >= 3 && !isSelected;

                  return (
                    <button
                      key={muscle}
                      disabled={isMax}
                      onClick={() => toggleMuscle(muscle)}
                      className={`py-8 rounded-[2rem] border-2 font-black text-xl transition-all shadow-md active:scale-95 ${isSelected ? 'bg-black text-white border-black scale-105' : 'bg-slate-50 text-slate-400 border-transparent hover:border-black'} ${isMax ? 'opacity-30 cursor-not-allowed grayscale' : ''}`}
                    >
                      {muscle}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={selectedMuscles.length === 0}
                onClick={() => {
                  if (workoutMode === 'custom') {
                    setView('gym_subgroups');
                  } else {
                    setView('gym_duration');
                  }
                }}
                className={`w-full py-6 rounded-2xl font-black text-xl uppercase tracking-widest transition-all ${selectedMuscles.length > 0 ? 'bg-blue-600 text-white shadow-xl hover:bg-blue-700' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
              >
                Confirmar Grupamentos ({selectedMuscles.length}/3)
              </button>
            </div>
          </div>
        )
      }

      {
        view === 'gym_duration' && (
          <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
            <BackButton to="gym_train" />

            <h2 className={`text-4xl font-black ${textColor} mb-12 uppercase tracking-tighter text-center`}>Duração do treino</h2>

            <div className="w-full bg-white border-2 border-black rounded-[3rem] p-12 shadow-2xl flex flex-col items-center">

              <div className="flex items-center justify-center gap-2 mb-8">
                <span className="text-xl">⏱️</span>
                <label className="text-lg font-black text-slate-800">Tempo estimado:</label>
              </div>

              <div className="flex items-center justify-center gap-4 mb-12">
                <div className="flex items-center gap-3">
                  <button onClick={() => setRecDurationH(Math.max(0, (recDurationH || 0) - 1))} className="w-12 h-12 rounded-xl bg-[#7EB1FF] border-2 border-[#7EB1FF] flex items-center justify-center text-white font-black text-2xl hover:brightness-110 transition-all active:scale-95 shadow-sm">-</button>
                  <div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[60px]">
                    <input
                      type="number"
                      value={recDurationH === undefined ? '' : recDurationH}
                      onFocus={() => { if (recDurationH === 0) setRecDurationH(undefined); }}
                      onBlur={() => { if (recDurationH === undefined) setRecDurationH(0); }}
                      onChange={(e) => {
                        if (e.target.value === '') setRecDurationH(undefined);
                        else setRecDurationH(parseInt(e.target.value));
                      }}
                      className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none"
                    />
                    <span className="text-[10px] uppercase font-black opacity-30 text-center">horas</span>
                  </div>
                  <button onClick={() => setRecDurationH((recDurationH || 0) + 1)} className="w-12 h-12 rounded-xl bg-[#7EB1FF] border-2 border-[#7EB1FF] flex items-center justify-center text-white font-black text-2xl hover:brightness-110 transition-all active:scale-95 shadow-sm">+</button>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => setRecDurationM(Math.max(0, (recDurationM || 0) - 1))} className="w-12 h-12 rounded-xl bg-[#7EB1FF] border-2 border-[#7EB1FF] flex items-center justify-center text-white font-black text-2xl hover:brightness-110 transition-all active:scale-95 shadow-sm">-</button>
                  <div className="flex flex-col border-b-2 border-[#4A69A2] min-w-[60px]">
                    <input
                      type="number"
                      value={recDurationM === undefined ? '' : recDurationM}
                      onFocus={() => { if (recDurationM === 0) setRecDurationM(undefined); }}
                      onBlur={() => { if (recDurationM === undefined) setRecDurationM(0); }}
                      onChange={(e) => {
                        if (e.target.value === '') setRecDurationM(undefined);
                        else setRecDurationM(parseInt(e.target.value));
                      }}
                      className="w-full text-center text-2xl font-black text-slate-800 bg-transparent border-none outline-none appearance-none"
                    />
                    <span className="text-[10px] uppercase font-black opacity-30 text-center">min</span>
                  </div>
                  <button onClick={() => setRecDurationM(Math.min(59, (recDurationM || 0) + 1))} className="w-12 h-12 rounded-xl bg-[#7EB1FF] border-2 border-[#7EB1FF] flex items-center justify-center text-white font-black text-2xl hover:brightness-110 transition-all active:scale-95 shadow-sm">+</button>
                </div>
              </div>

              <button
                onClick={generateRecommendedWorkout}
                className="w-full max-w-xs py-5 bg-blue-600 text-white rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                Gerar Treino
              </button>
            </div>
          </div>
        )
      }

      {
        view === 'gym_subgroups' && (
          <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
            <BackButton to="gym_train" />

            <h2 className={`text-4xl font-black ${textColor} mb-12 uppercase tracking-tighter`}>escolha o local do músculo</h2>

            <div className="w-full space-y-10">
              {selectedMuscles.map((group) => (
                <div key={group} className="bg-white border-2 border-black rounded-[3rem] p-10 shadow-xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="px-4 py-1 bg-black rounded-full text-white font-black text-xs uppercase tracking-widest">{group}</div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {muscleSubGroups[group]?.map((sub) => {
                      const isSelected = (selectedSubMuscles[group] as string[])?.includes(sub);
                      return (
                        <button
                          key={sub}
                          onClick={() => toggleSubMuscle(group, sub)}
                          className={`p-6 rounded-2xl font-black text-sm text-left transition-all flex items-center justify-between group/sub water-fill ${isSelected ? 'selected' : ''}`}
                        >
                          {sub}
                          <div className={`w-5 h-5 rounded-full border-2 transition-all gym-sub-circle ${isSelected ? 'bg-white border-white' : 'border-black'}`}>
                            {isSelected && <svg className="w-full h-full text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <button
                disabled={(Object.values(selectedSubMuscles) as string[][]).every(list => list.length === 0)}
                onClick={() => setView('gym_exercises')}
                className="w-full max-w-xs py-4 bg-black text-white rounded-[2rem] font-black text-xl uppercase tracking-tighter shadow-2xl hover:scale-105 active:scale-95 transition-all"
              >
                Escolher Exercícios
              </button>
            </div>
          </div>
        )
      }

      {
        view === 'gym_exercises' && (
          <div className="animate-fadeIn max-w-4xl mx-auto flex flex-col items-center">
            <BackButton to="gym_subgroups" />

            <h2 className={`text-4xl font-black ${textColor} mb-12 uppercase tracking-tighter text-center`}>Escolha os exercícios</h2>

            <div className="w-full space-y-12 pb-10">
              {(Object.entries(selectedSubMuscles) as [string, string[]][]).map(([mainGroup, subGroups]) => (
                subGroups.map(sub => {
                  const exercises = gymDb[sub];
                  if (!exercises) return null;

                  return (
                    <div key={sub} className="bg-white border-2 border-black rounded-[3rem] p-10 shadow-xl overflow-hidden relative text-left">
                      <div className="absolute top-0 left-0 px-6 py-2 bg-black text-white border-2 border-black font-black text-[10px] uppercase tracking-widest rounded-br-2xl shadow-md">
                        {mainGroup} › {sub}
                      </div>

                      <div className="mt-12 grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="flex flex-col gap-4">
                          <h4 className="font-black text-slate-800 uppercase tracking-widest text-base flex items-center gap-2">
                            <svg className="w-6 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></svg>
                            <b>Exercícios Isolados</b>
                          </h4>
                          {exercises.isolados.length > 0 ? (
                            exercises.isolados.map(ex => {
                              const isSelected = selectedExercises[sub]?.[ex.name];
                              const exerciseTime = isSelected ? calculateExerciseTime(selectedExercises[sub][ex.name], ex.recs.isTimeBased) : 0;

                              return (
                                <div key={ex.name} className="flex flex-col gap-3">
                                  <button
                                    onClick={() => toggleExercise(sub, ex.name)}
                                    className={`p-5 rounded-2xl border-2 font-black text-sm text-left transition-all flex items-center justify-between group/ex gray-water-fill ${isSelected ? 'selected' : ''}`}
                                  >
                                    {ex.name}
                                    <div className={`w-5 h-5 rounded-full border-2 transition-all ex-circle ${isSelected ? 'bg-slate-400 border-slate-400' : 'border-slate-400 group-hover/ex:border-white'}`}>
                                      {isSelected && <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                  </button>
                                  {isSelected && (
                                    <>
                                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1 animate-fadeIn">
                                        {ex.more && (
                                          <div className="flex gap-1.5 items-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pega mais:</span>
                                            <span className="text-[9px] font-bold text-slate-600">{ex.more}</span>
                                          </div>
                                        )}
                                        {ex.less && (
                                          <div className="flex gap-1.5 items-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pega menos:</span>
                                            <span className="text-[9px] font-bold text-slate-600">{ex.less}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-6 bg-slate-50 rounded-[1.5rem] border-2 border-black animate-fadeIn flex flex-col gap-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest">Séries (recom. {ex.recs.sets})</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].sets}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'sets', e.target.value)}
                                                placeholder="Ex: 3"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest">Reps (recom. {ex.recs.reps})</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].reps}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'reps', e.target.value)}
                                                placeholder="Ex: 12"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest">Tempo/Série (seg)</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].timePerSet}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'timePerSet', e.target.value)}
                                                placeholder="Ex: 50"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">Descanso/Série (seg) (recom. {ex.recs.rest})</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].rest}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'rest', e.target.value)}
                                                placeholder="Ex: 60"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                                          <span className="text-[10px] font-black text-slate-600 uppercase">Tempo estimado:</span>
                                          <span className="font-black text-slate-600 text-sm">{formatSeconds(exerciseTime)}</span>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })
                          ) : <p className="text-xs font-bold text-slate-300 italic px-2">Não aplicável</p>}
                        </div>

                        <div className="flex flex-col gap-4">
                          <h4 className="font-black text-slate-800 uppercase tracking-widest text-base flex items-center gap-2">
                            <svg className="w-6 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="4"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></svg>
                            <b>Exercícios Multiarticulados</b>
                          </h4>
                          {exercises.multi.length > 0 ? (
                            exercises.multi.map(ex => {
                              const isSelected = selectedExercises[sub]?.[ex.name];
                              const exerciseTime = isSelected ? calculateExerciseTime(selectedExercises[sub][ex.name], ex.recs.isTimeBased) : 0;

                              return (
                                <div key={ex.name} className="flex flex-col gap-3">
                                  <button
                                    onClick={() => toggleExercise(sub, ex.name)}
                                    className={`p-5 rounded-2xl border-2 font-black text-sm text-left transition-all flex items-center justify-between group/ex gray-water-fill ${isSelected ? 'selected' : ''}`}
                                  >
                                    {ex.name}
                                    <div className={`w-5 h-5 rounded-full border-2 transition-all ex-circle ${isSelected ? 'bg-slate-400 border-slate-400' : 'border-slate-400 group-hover/ex:border-white'}`}>
                                      {isSelected && <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                  </button>
                                  {isSelected && (
                                    <>
                                      <div className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-1 animate-fadeIn">
                                        {ex.more && (
                                          <div className="flex gap-1.5 items-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pega mais:</span>
                                            <span className="text-[9px] font-bold text-slate-600">{ex.more}</span>
                                          </div>
                                        )}
                                        {ex.less && (
                                          <div className="flex gap-1.5 items-center">
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Pega menos:</span>
                                            <span className="text-[9px] font-bold text-slate-600">{ex.less}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="p-6 bg-slate-50 rounded-[1.5rem] border-2 border-black animate-fadeIn flex flex-col gap-4">
                                        <div className="grid grid-cols-2 gap-4">
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest">Séries (recom. {ex.recs.sets})</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].sets}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'sets', e.target.value)}
                                                placeholder="Ex: 4"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest">Reps (recom. {ex.recs.reps})</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].reps}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'reps', e.target.value)}
                                                placeholder="Ex: 8"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest">Tempo/Série (seg)</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].timePerSet}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'timePerSet', e.target.value)}
                                                placeholder="Ex: 50"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                          <div className="flex flex-col gap-1.5">
                                            <label className="min-h-[2.5rem] flex items-end text-[9px] font-black text-slate-600 uppercase tracking-widest leading-none">Descanso/Série (seg) (recom. {ex.recs.rest})</label>
                                            <div className="bg-white border-2 border-slate-400 rounded-xl p-2.5 shadow-sm">
                                              <input
                                                type="text"
                                                value={selectedExercises[sub][ex.name].rest}
                                                onChange={(e) => updateExerciseSettings(sub, ex.name, 'rest', e.target.value)}
                                                placeholder="Ex: 90"
                                                className="w-full font-black text-center text-black outline-none bg-white focus:placeholder-transparent"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                                          <span className="text-[10px] font-black text-slate-600 uppercase">Tempo estimado:</span>
                                          <span className="font-black text-slate-600 text-sm">{formatSeconds(exerciseTime)}</span>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })
                          ) : <p className="text-xs font-bold text-slate-300 italic px-2">Não aplicável</p>}
                        </div>
                      </div>
                    </div>
                  );
                })
              ))}

              <div className="flex justify-center pb-20">
                <button
                  onClick={() => {
                    const totalExercises = (Object.values(selectedExercises) as Record<string, ExerciseDetails>[]).reduce((acc, sub) => acc + Object.keys(sub).length, 0);

                    if (totalExercises === 0) {
                      setErrorMsg("Selecione ao menos um exercício primeiro.");
                      setTimeout(() => setErrorMsg(null), 4000);
                      return;
                    }

                    const allFieldsFilled = Object.values(selectedExercises).every(subGroup =>
                      Object.values(subGroup).every(details =>
                        details.sets.trim() !== '' &&
                        details.reps.trim() !== '' &&
                        details.timePerSet.trim() !== '' &&
                        details.rest.trim() !== ''
                      )
                    );

                    if (!allFieldsFilled) {
                      setErrorMsg("Preencha todos os campos (séries, reps, tempo, descanso) de todos os exercícios escolhidos.");
                      setTimeout(() => setErrorMsg(null), 4000);
                      return;
                    }

                    setView('gym_save_day');
                  }}
                  className="w-48 py-4 bg-black text-white rounded-[2.5rem] border-2 border-black font-black text-lg uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
                >
                  <span>Salvar treino</span>
                  <span className="text-[10px] font-bold opacity-60 normal-case">{formatSeconds(getTotalWorkoutTime())}</span>
                </button>
              </div>
            </div>
          </div>
        )
      }

      {
        view === 'gym_save_day' && (
          <div className="animate-fadeIn max-w-2xl mx-auto flex flex-col items-center text-center">
            <BackButton to={workoutMode === 'recommended' ? 'gym_duration' : 'gym_exercises'} />
            <div className="w-20 h-20 bg-black rounded-3xl flex items-center justify-center text-white font-black text-3xl mb-8">?</div>
            <h2 className="text-3xl font-black text-slate-800 uppercase tracking-tighter mb-10">Para qual dia é esse treino?</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-6">(Selecione até 3 dias)</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8 w-full mb-12">
              {weekDays.map(day => {
                const isSelected = workoutDaysToSave.includes(day);
                const isTaken = savedWorkouts.some(w => w.day.includes(day));

                return (
                  <div key={day} className="flex flex-col gap-2">
                    <button
                      disabled={isTaken}
                      onClick={() => toggleWorkoutDaySelection(day)}
                      className={`p-5 rounded-none border-2 font-black text-sm uppercase transition-all shadow-md active:scale-95 relative 
                        ${isTaken ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed grayscale' :
                          isSelected ? 'bg-black text-white border-black' : 'bg-white text-slate-800 border-black hover:bg-slate-50'}`}
                    >
                      {day}
                      {isSelected && !isTaken && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                    {isTaken && (
                      <span className="text-[10px] font-black text-red-400 uppercase tracking-widest animate-pulse">Dia já ocupado</span>
                    )}
                  </div>
                );
              })}
            </div>

            {workoutDaysToSave.length > 0 && (
              <div className="w-full animate-fadeIn flex flex-col items-center">
                <button
                  onClick={handleSaveWorkout}
                  className="w-48 py-4 bg-black text-white rounded-none font-black text-lg uppercase tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
                >
                  Salvar
                  <span className="text-[10px] font-bold opacity-60 normal-case">{formatSeconds(getTotalWorkoutTime())}</span>
                </button>
              </div>
            )}
          </div>
        )
      }

      {
        (view === 'list' || view === 'categories' || view === 'create_category') && (
          <div className="animate-fadeIn">
            <BackButton to="entry" />
            <h2 className={`text-4xl font-black ${textColor} mb-8`}>Meu Bloco de Notas</h2>
            <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
              <div className="bg-white border-2 border-black p-0.5 rounded-2xl flex shadow-sm"><button onClick={() => setView('list')} className={`py-2 px-8 rounded-xl font-bold text-sm transition-all ${view === 'list' ? 'bg-black text-white' : 'text-black hover:bg-slate-50'}`}>Minhas notas</button></div>
              <div className="flex items-center gap-4"><button onClick={() => setView('categories')} className={`px-8 py-2.5 rounded-xl border-2 border-[#A855F7] font-bold text-sm transition-all shadow-sm ${view === 'categories' ? 'bg-[#A855F7] text-white' : 'text-[#A855F7] bg-white'}`}>Minhas Categorias</button><button onClick={() => setView('create_category')} className={`px-8 py-2.5 rounded-xl border-2 border-[#3B82F6] font-bold text-sm transition-all shadow-sm ${view === 'create_category' ? 'bg-[#3B82F6] text-white' : 'text-[#3B82F6] bg-white'}`}>Criar Categoria</button></div>
            </div>
            <div className="bg-white rounded-[2.5rem] border-[1.5px] border-[#4A69A2] p-8 shadow-sm min-h-[400px]">
              {view === 'list' && (
                <div className="animate-fadeIn">
                  <div className="grid grid-cols-1 gap-6 mb-8">
                    {getSortedNotes().length === 0 ? (
                      <div className="col-span-full h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-300 font-bold uppercase tracking-widest">Nenhuma nota salva</div>
                    ) : (
                      getSortedNotes().map((note, idx) => (
                        <div key={note.id} onClick={() => { setCurrentNote(note); setView('editor'); }} className="p-6 rounded-[1.5rem] border-2 border-black shadow-md hover:scale-[1.01] cursor-pointer transition-all relative group flex flex-row items-center justify-between note-card-anim" style={{ backgroundColor: note.categoryColor, animationDelay: `${idx * 50}ms` }}>
                          <div className="flex flex-col flex-1 gap-1">
                            <h4 className="text-xl font-black text-slate-800 line-clamp-1" dangerouslySetInnerHTML={{ __html: sanitizeHtml(note.title || 'Sem título') }}></h4>
                            <span className="text-[9px] font-black uppercase tracking-tighter text-black/50">Modificada: {note.lastModified}</span>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); setNoteToDelete(note); }} className="opacity-0 group-hover:opacity-100 text-red-600 p-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      ))
                    )}
                  </div>
                  <button onClick={handleAddNote} className="w-full py-5 border-2 border-black rounded-2xl flex items-center justify-center gap-3 font-black text-slate-800 hover:bg-slate-50 transition-all shadow-xl bg-white active:scale-95"><span className="text-2xl">+</span> Adicionar Nota</button>
                </div>
              )}
              {view === 'categories' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-fadeIn">
                  {categories.length === 0 ? (
                    <div className="col-span-full h-44 border-2 border-dashed border-slate-200 rounded-[2.5rem] flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest">Nenhuma categoria criada</div>
                  ) : (
                    categories.map(cat => (
                      <div key={cat.id} className="h-32 rounded-3xl flex items-center justify-center shadow-md relative group transition-all cursor-pointer" style={{ backgroundColor: cat.color }}>
                        <span className="text-white font-black text-xl uppercase tracking-tighter">{cat.name}</span>
                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingCategory(cat); setNewCatName(cat.name); setSelectedColor(cat.color); setView('create_category'); }} className="w-8 h-8 bg-white/20 hover:bg-white/40 rounded-lg flex items-center justify-center text-white transition-all shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button><button onClick={() => setCategoryToDelete(cat)} className="w-8 h-8 bg-white/20 hover:bg-red-500 rounded-lg flex items-center justify-center text-white transition-all shadow-sm"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button></div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {view === 'create_category' && (
                <div className="animate-fadeIn max-xl mx-auto space-y-10 py-6">
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Nome da Categoria</label><input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="ex: Estudos" className="w-full p-4 rounded-xl border-2 border-black font-bold outline-none focus:ring-2 ring-[#4A69A2]/20" /></div>
                  <div><label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Escolha uma Cor</label><div className="flex flex-wrap gap-3">{customColors.map(c => (<button key={c} onClick={() => setSelectedColor(c)} className={`w-12 h-12 rounded-2xl border-2 transition-all ${selectedColor === c ? 'border-black scale-110 shadow-lg' : 'border-transparent'}`} style={{ backgroundColor: c }} />))}</div></div>
                  <button onClick={() => { if (!newCatName.trim()) return; if (editingCategory) saveCategories(categories.map(c => c.id === editingCategory.id ? { ...c, name: newCatName, color: selectedColor } : c)); else saveCategories([...categories, { id: Date.now().toString(), name: newCatName, color: selectedColor }]); setView('categories'); setEditingCategory(null); setNewCatName(''); }} className="w-full py-5 rounded-2xl bg-black text-white font-black text-lg shadow-xl hover:scale-[1.02] active:scale-95 transition-all">{editingCategory ? 'Salvar Alterações' : 'Criar Categoria'}</button>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        view === 'editor' && (
          <div className="animate-fadeIn max-w-5xl mx-auto">
            <button onClick={() => setView('list')} className="font-black text-slate-400 hover:text-black flex items-center gap-2 mb-8 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" /></svg>Cancelar</button>

            <div className="bg-white border-2 border-black rounded-[3rem] shadow-2xl relative overflow-hidden">
              <div className="bg-slate-50 border-b-2 border-black p-6 flex flex-wrap gap-4 gap-y-4 items-center rounded-t-[3rem] sticky top-0 z-[1100]">

                <div className="relative" ref={fontMenuRef}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setIsFontMenuOpen(!isFontMenuOpen); setIsFontSizeMenuOpen(false); setIsMarkersMenuOpen(false); }}
                    className="bg-white border-2 border-black rounded-xl px-4 py-2 min-w-[150px] flex justify-between items-center font-bold text-xs text-black shadow-sm"
                  >
                    {activeFont} <span className="ml-2 text-[10px]">▼</span>
                  </button>
                  {isFontMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white border-2 border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">
                      {fonts.map(f => (
                        <button
                          key={f.name}
                          onMouseDown={(e) => { e.preventDefault(); execCommand('fontName', f.value); setIsFontMenuOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-sm hover:bg-slate-50 text-black border-b last:border-0 border-slate-100 ${activeFont.toLowerCase().includes(f.name.toLowerCase()) ? 'bg-slate-100' : ''}`}
                          style={{ fontFamily: f.value }}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }}
                  className={`w-10 h-10 border-2 border-black rounded-xl flex items-center justify-center font-black text-lg transition-all shadow-sm ${activeBold ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}
                >
                  B
                </button>

                <div className="flex bg-white border-2 border-black rounded-xl overflow-hidden p-0.5 shadow-sm">
                  {[
                    { cmd: 'justifyLeft', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h10M4 18h16" /> },
                    { cmd: 'justifyCenter', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M7 12h10M4 18h16" /> },
                    { cmd: 'justifyRight', icon: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M10 12h10M4 18h16" /> }
                  ].map(align => (
                    <button
                      key={align.cmd}
                      onMouseDown={(e) => { e.preventDefault(); execCommand(align.cmd); }}
                      className={`p-2.5 rounded-lg transition-colors ${activeAlign === align.cmd ? 'bg-black text-white' : 'hover:bg-slate-100 text-black'}`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">{align.icon}</svg>
                    </button>
                  ))}
                </div>

                <div className="relative" ref={markersMenuRef}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setIsMarkersMenuOpen(!isMarkersMenuOpen); setIsFontMenuOpen(false); setIsFontSizeMenuOpen(false); }}
                    className={`px-5 py-2 border-2 border-black rounded-xl flex items-center gap-3 font-black text-xs transition-all shadow-sm ${isMarkersMenuOpen ? 'bg-black text-white' : 'bg-white text-black hover:bg-slate-100'}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    Simbolos
                  </button>
                  {isMarkersMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-40 bg-white border-2 border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">
                      {markers.map(m => (
                        <button
                          key={m.name}
                          onMouseDown={(e) => { e.preventDefault(); insertMarker(m.char); }}
                          className="w-full text-left px-5 py-3 text-xl hover:bg-slate-50 transition-colors text-black flex items-center justify-between border-b last:border-0 border-slate-100"
                        >
                          <span className="text-[10px] font-black text-slate-400 uppercase">{m.name}</span>
                          <span className="font-bold">{m.char}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                <div className="flex gap-2.5">
                  {['#000000', '#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map(c => (
                    <button
                      key={c}
                      onMouseDown={(e) => { e.preventDefault(); execCommand('foreColor', c); }}
                      className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-125 shadow-sm ${isSameColor(activeColor, c) ? 'border-black scale-125 ring-2 ring-slate-100' : 'border-white ring-1 ring-black/10'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>

                <div className="relative" ref={fontSizeMenuRef}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); setIsFontSizeMenuOpen(!isFontSizeMenuOpen); setIsFontMenuOpen(false); setIsMarkersMenuOpen(false); }}
                    className="bg-white border-2 border-black rounded-xl px-4 py-2 min-w-[150px] flex justify-between items-center font-bold text-xs text-black shadow-sm"
                  >
                    {fontSizes.find(s => s.value === activeSize)?.name || 'Tamanho'} <span className="ml-2 text-[10px]">▼</span>
                  </button>
                  {isFontSizeMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-44 bg-white border-2 border-black rounded-2xl shadow-2xl z-[1200] overflow-y-auto max-h-60 animate-fadeIn">
                      {fontSizes.map(s => (
                        <button
                          key={s.value}
                          onMouseDown={(e) => { e.preventDefault(); execCommand('fontSize', s.value); setIsFontSizeMenuOpen(false); }}
                          className={`w-full text-left px-5 py-3 text-sm hover:bg-slate-50 text-black border-b last:border-0 border-slate-100 ${activeSize === s.value ? 'bg-slate-100' : ''}`}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white p-12 min-h-[600px] flex flex-col rounded-b-[3rem]">
                <div className="editor-title-container flex items-center gap-3 border-b-2 border-slate-50 pb-6 focus-within:border-black transition-colors mb-10">
                  <span className="text-[10px] font-black text-slate-800 shrink-0 uppercase tracking-widest opacity-40">Título:</span>
                  <div
                    ref={titleInputRef}
                    contentEditable
                    suppressContentEditableWarning
                    data-placeholder="digite o título da nota"
                    onInput={handleTitleInput}
                    onKeyUp={updateToolbarState}
                    onMouseUp={updateToolbarState}
                    className="flex-1 text-4xl font-black outline-none bg-transparent text-slate-800"
                  />
                </div>
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onKeyUp={updateToolbarState}
                  onMouseUp={updateToolbarState}
                  className="flex-1 w-full outline-none text-2xl leading-relaxed prose prose-slate max-w-none focus:ring-0 text-slate-800"
                />
              </div>

              <div className="bg-slate-50 border-t-2 border-black p-10 flex justify-center rounded-b-[3rem]">
                <button
                  onClick={handleSaveAction}
                  className="bg-black text-white px-20 py-5 rounded-[2.5rem] font-black text-2xl shadow-xl hover:scale-105 active:scale-95 transition-all shadow-black/20"
                >
                  Salvar Nota
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default Others;
