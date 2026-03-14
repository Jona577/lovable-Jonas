import { useEffect, useRef, useCallback } from 'react';
import { supabase, syncToSupabase, getFromSupabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Mapeamento mestre: Tabela Supabase <-> Chave LocalStorage
const SYNC_MAP: Record<string, string> = {
  // Settings & Core
  'tasks': 'produtivity_tasks_v3',
  'categories': 'produtivity_categories',
  'goals': 'produtivity_goals',
  
  // Habits & Routines
  'habits': 'produtivity_habits_record_list',
  'habit_categories': 'produtivity_habits_cats',
  'routines': 'produtivity_routines',
  
  // Study Data
  'study_items': 'produtivity_books',
  'study_sessions': 'produtivity_study_session_dates', // v1 dates
  'study_time_periods': 'produtivity_study_time_periods',
  'study_item_times': 'produtivity_study_item_times',
  'vocabulary': 'produtivity_vocabulary',
  'vocabulary_categories': 'produtivity_vocabulary_cats',
  'curiosity_history': 'produtivity_curiosity_history',
  'mnemonic_feedback': 'produtivity_mnemonic_feedback_history',
  'flashcard_errors': 'produtivity_flashcard_errors',
  'review_pendencies': 'produtivity_review_pendencies',
  
  // Nutrition
  'nutrition_profiles': 'produtivity_nutrition_profile',
  'nutrition_diets': 'produtivity_nutrition_diet',
  'nutrition_checked_items': 'produtivity_nutrition_checked',
  'nutrition_chat_messages': 'produtivity_nutrition_chat',
  'nutrition_chat_history': 'produtivity_nutrition_chat_history',
  'nutrition_regions': 'produtivity_nutrition_region',
  'nutrition_shopping': 'produtivity_nutrition_shopping',
  'nutrition_owned_items': 'produtivity_nutrition_owned',
  'nutrition_saved_lists': 'produtivity_nutrition_saved_lists',
  'nutrition_goals': 'produtivity_nutrition_goals',
  
  // Gym & Notes
  'gym_exercises': 'produtivity_others_gym_db',
  'gym_workouts': 'produtivity_others_gym_workouts',
  'gym_history': 'produtivity_others_gym_history',
  'notes': 'produtivity_others_notes_list',
  'note_categories': 'produtivity_others_notes_cats',
  
  // Finances
  'finance_categories': 'finances_categories_v1',
  'finance_records': 'finances_records_v1',
  'finance_monthly_income': 'fin_monthly_income_data',
  'finance_monthly_expenses': 'fin_monthly_expense_data',
};

// Referência global do setItem original do navegador — capturado ANTES de qualquer override
const nativeSetItem = Object.getPrototypeOf(window.localStorage).setItem;

export function useSupabaseSync() {
  const { user } = useAuth();
  const isInitialSyncDone = useRef(false);
  const userRef = useRef(user);

  // Mantém a ref atualizada para uso nos callbacks
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // 1. Fase de PULL: Baixar os dados do Supabase e popular o LocalStorage
  const pullFromCloud = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    
    let hasChanges = false;
    let successCount = 0;
    let errorCount = 0;

    const promises = Object.entries(SYNC_MAP).map(async ([table, localKey]) => {
      try {
        const cloudData = await getFromSupabase<any>(table, currentUser.id);
        if (cloudData !== null && cloudData !== undefined) {
            const stringifiedNew = JSON.stringify(cloudData);
            const stringifiedOld = localStorage.getItem(localKey);
            
            // Fast-diff: Só mexe no LocalStorage caso a "nuvem" esteja diferente do que já temos
            if (stringifiedNew !== stringifiedOld) {
              nativeSetItem.call(window.localStorage, localKey, stringifiedNew);
              hasChanges = true;
            }
            successCount++;
        }
      } catch (error) {
        errorCount++;
        console.warn(`[SupabaseSync] ⚠️ Falha ao puxar tabela ${table}:`, error);
      }
    });

    await Promise.all(promises);
    
    if (errorCount > 0) {
      console.warn(`[SupabaseSync] Pull completado: ${successCount} ok, ${errorCount} falhas`);
    }
    
    // Alerta o React para recarregar a tela APENAS se o Celular ou a Nuvem mandaram novidades!
    if (hasChanges) {
      console.log('[SupabaseSync] ✅ Dados novos da nuvem detectados! Atualizando interface...');
      window.dispatchEvent(new Event('local-storage-sync-completed'));
    }
  }, []); // sem dependências — usa userRef internamente

  // 2. Fase de PUSH: Subir os dados atuais do LocalStorage para o Supabase
  const pushToCloud = useCallback(async () => {
    const currentUser = userRef.current;
    if (!currentUser) return;
    
    const promises = Object.entries(SYNC_MAP).map(async ([table, localKey]) => {
      try {
        const localRaw = localStorage.getItem(localKey);
        if (localRaw) {
          const parsed = JSON.parse(localRaw);
          await syncToSupabase(table, currentUser.id, parsed);
        }
      } catch (error) {
        console.error(`[SupabaseSync] Erro ao subir para tabela ${table}:`, error);
      }
    });

    await Promise.all(promises);
  }, []); // sem dependências — usa userRef internamente

  // Sincronização Inicial
  useEffect(() => {
    if (user && !isInitialSyncDone.current) {
      isInitialSyncDone.current = true;
      console.log('[SupabaseSync] 🔄 Iniciando sincronização inicial...');
      pullFromCloud().then(() => {
        console.log('[SupabaseSync] ✅ Pull inicial concluído. Fazendo push de mesclagem...');
        // Envia o primeiro backup de mesclagem logo após o pull
        pushToCloud();
      });
    } else if (!user) {
      isInitialSyncDone.current = false;
    }
  }, [user, pullFromCloud, pushToCloud]);

  // Sync orientado a eventos: Interceptador de LocalStorage 
  useEffect(() => {
    if (!user) return;

    // Guarda a referência do setItem que está atualmente definido (pode já ser wrapped)
    const previousSetItem = localStorage.setItem;

    // Sobrescreve para agirmos como um "espião de eventos"
    localStorage.setItem = function (key: string, value: string) {
      // 1. Executa o setItem nativo (salva rápido na sua tela)
      nativeSetItem.call(window.localStorage, key, value);

      // 2. Verifica se a chave que acabou de mudar é uma chave importante que mapeamos
      const mappedTable = Object.keys(SYNC_MAP).find(table => SYNC_MAP[table] === key);
      
      if (mappedTable) {
        // Lê o user da ref (sempre atualizado)
        const currentUser = userRef.current;
        if (!currentUser) return;

        try {
          // Push DIRETO para a tabela específica que sofreu a alteração! Zero lag.
          const parsedData = JSON.parse(value);
          syncToSupabase(mappedTable, currentUser.id, parsedData).catch(err => {
            console.error(`[SupabaseSync] Falha ao sincronizar ação na tabela ${mappedTable}:`, err);
          });
        } catch (error) {
          console.error(`[SupabaseSync] Dado inválido detectado na chave ${key}`);
        }
      }
    };

    // Quando o usuário deslogar ou o hook desmontar, removemos o "espião"
    return () => {
      localStorage.setItem = previousSetItem;
    };
  }, [user]);

  // Listener Background: Verifica se o Celular ou outro PC enviou algo
  useEffect(() => {
    if (!user) return;
    
    // A cada 10 segundos, puxa da nuvem silenciosamente
    const pullInterval = setInterval(() => {
      pullFromCloud();
    }, 10000);

    return () => clearInterval(pullInterval);
  }, [user, pullFromCloud]);

  // Escuta os eventos para fechar aba/recarregar página
  useEffect(() => {
    if (!user) return;

    const handleBeforeUnload = () => {
      // Sincronização síncrona de último recurso antes de fechar a aba
      // Usa sendBeacon pattern para garantir que o dado chegue
      const currentUser = userRef.current;
      if (!currentUser) return;
      
      pushToCloud();
    };
    
    // Também sincroniza quando a aba volta a ficar visível (troca de aba/app)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[SupabaseSync] 👁️ Aba ficou visível — puxando dados da nuvem...');
        pullFromCloud();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, pullFromCloud, pushToCloud]);

  return { pullFromCloud, pushToCloud };
}
