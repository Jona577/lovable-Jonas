import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não definidos no .env!");
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

// Helper para sincronizar um item na nuvem.
// Usaremos genérico (T) e passariamos a tabela e ID.
export async function syncToSupabase<T>(table: string, userId: string, data: T) {
  const { error } = await supabase
    .from(table)
    .upsert({ user_id: userId, data: data, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  
  if (error) {
    console.error(`Erro ao sincronizar tabela ${table}:`, error);
  }
}

export async function getFromSupabase<T>(table: string, userId: string): Promise<T | null> {
  const { data, error } = await supabase
    .from(table)
    .select('data')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') { // not found
      console.error(`Erro ao puxar dados da tabela ${table}:`, error);
    }
    return null;
  }
  return data?.data as T;
}
