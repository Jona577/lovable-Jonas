import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from "@/integrations/supabase/client";
import NutritionModule from './NutritionModule';
import { sanitizeHtml } from '@/lib/sanitize';

type ViewState = 'entry' | 'list' | 'categories' | 'create_category' | 'editor' | 'calculator' | 'calculator_percent' | 'gym_menu' | 'gym_choice' | 'gym_now' | 'gym_train' | 'gym_subgroups' | 'gym_exercises' | 'gym_duration' | 'gym_save_day' | 'gym_active_session' | 'gym_weights' | 'gym_history' | 'gym_manage' | 'gym_edit_library' | 'gym_add_to_library' | 'finances' | 'oratoria_setup' | 'oratoria_redirect' | 'nutrition_onboarding' | 'nutrition_onboarding_step2' | 'nutrition_onboarding_step3' | 'nutrition_dashboard';
type SaveModalStep = 'initial' | 'picking_cat' | 'confirm_save';
type SortOption = 'lastModified' | 'createdAt' | 'category' | 'alphabetical';
type GymHistoryTab = 'done_workouts' | 'stats';
type ChartViewMode = 'days_of_week' | 'days_of_month' | 'weeks_of_month' | 'months_of_year' | 'years';

interface NoteCategory {
  id: string;
  name: string;
  color: string;
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

interface OthersProps {
  isDarkMode?: boolean;
  initialView?: ViewState;
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

const Others: React.FC<OthersProps> = ({ isDarkMode, initialView }) => {
  const [view, setView] = useState<ViewState>(initialView || 'entry');
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
  const [nutriAge, setNutriAge] = useState('');
  const [nutriHeight, setNutriHeight] = useState('');
  const [nutriWeight, setNutriWeight] = useState('');
  const [nutriGender, setNutriGender] = useState<'male' | 'female' | null>(null);
  const [nutritionProfile, setNutritionProfile] = useState<NutritionProfile | null>(null);
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
      const { data, error } = await supabase.functions.invoke('study-ai', {
        body: { action: 'generate_motivation' }
      });
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

  const BackButton = ({ to }: { to: ViewState }) => (
    <div className="w-full text-left">
      <button onClick={() => setView(to)} className="flex items-center gap-2 mb-8 text-slate-400 font-bold hover:text-[#4A69A2] transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
        Voltar
      </button>
    </div>
  );

  const renderComingSoon = (title: string, backTo: ViewState = 'entry') => (
    <div className="flex flex-col items-center justify-center py-20 animate-fadeIn text-center">
      <BackButton to={backTo} />
      <div className="w-24 h-24 bg-[#4A69A2]/10 rounded-full flex items-center justify-center mb-8">
        <span className="text-4xl">🚀</span>
      </div>
      <h2 className={`text-4xl font-black ${textColor} mb-4 uppercase tracking-tighter`}>{title}</h2>
      <p className="text-slate-400 font-bold max-w-md">Esta funcionalidade está sendo preparada para ajudar você a atingir o próximo nível de performance.</p>
    </div>
  );

  const renderNutritionDashboard = () => {
    if (!nutritionProfile) return renderNutritionOnboarding();
    return <NutritionModule profile={nutritionProfile} isDarkMode={isDarkMode} onBack={() => setView('entry')} />;
  };

  const handleNextOnboardingStep = () => {
    if (!nutriAge.trim() || !nutriHeight.trim() || !nutriWeight.trim() || !nutriGender) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setView('nutrition_onboarding_step2');
  };

  const handleNextOnboardingStep2 = () => {
    if (!nutriObjective || !nutriActivityLevel || !nutriTrainingIntensity || !nutriDesiredWeight.trim() || (nutriDeadlineType !== 'sem_meta' && !nutriDeadline.trim())) {
      setErrorMsg("Por favor, preencha todos os campos obrigatórios.");
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }
    setView('nutrition_onboarding_step3');
  };

  const finalizeNutritionProfile = () => {
    if (!nutriMealsPerDay) {
      setErrorMsg("Por favor, preencha a quantidade de refeições por dia.");
      setTimeout(() => setErrorMsg(null), 3000);
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
    setNutritionProfile(profile);
    localStorage.setItem('produtivity_nutrition_profile', JSON.stringify(profile));
    setSuccessMsg("Perfil nutricional salvo com sucesso!");
    setTimeout(() => setSuccessMsg(null), 3000);
    setView('nutrition_dashboard');
  };

  const renderNutritionOnboarding = () => {
    return (
      <div className="animate-fadeIn max-w-md mx-auto flex flex-col items-center pt-10">
        <BackButton to="gym_menu" />

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
            <button onClick={() => setView('nutrition_onboarding')} className="group w-48 h-48 bg-white border-2 border-[#4A69A2] rounded-[3.5rem] shadow-2xl flex flex-col items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 hover:bg-[#4A69A2]">
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
      {view === 'finances' && renderComingSoon('Gestão Financeira Pessoal')}
      {view === 'oratoria_setup' && renderOratoriaSetup()}


      {view === 'gym_menu' && renderGymMenu()}

      {view === 'gym_choice' && (
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
      )}

      {view === 'gym_now' && (
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
      )}

      {view === 'gym_train' && (
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
      )}

      {view === 'gym_duration' && (
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
      )}

      {view === 'gym_subgroups' && (
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
      )}

      {view === 'gym_exercises' && (
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
      )}

      {view === 'gym_save_day' && (
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
      )}

      {(view === 'list' || view === 'categories' || view === 'create_category') && (
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
      )}

      {view === 'editor' && (
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
      )}
    </div>
  );
};

export default Others;
