
export type Page = 'Study' | 'Tarefas' | 'Rotina' | 'Hábitos' | 'Metas' | 'Minhas estatísticas' | 'Nutrição' | 'Outros' | 'Configurações';

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  category: string;
  priority?: 'Alta' | 'Média' | 'Baixa';
  time?: string;
  categoryColor?: string;
  timeframe?: 'today' | 'other';
  date?: string;
}

export interface Habit {
  id: string;
  name: string;
  streak: number;
  history: boolean[]; // Last 7 days
}

export interface RoutineItem {
  id: string;
  time: string;
  activity: string;
  type: 'work' | 'rest' | 'personal';
}

export interface SavePoint {
  id: string;
  date: string;
  note: string;
  tasksCompleted: number;
}
