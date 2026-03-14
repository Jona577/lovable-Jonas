/**
 * databaseService.ts
 *
 * Serviço de persistência: apenas localStorage.
 *
 * Todos os dados ficam armazenados localmente no navegador.
 */

// ============================================================
// Helpers de autenticação
// ============================================================

const SESSION_STORAGE_KEY = 'produtivity_auth_session';

/** Retorna o ID do usuário logado ou null */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionStr) {
      const user = JSON.parse(sessionStr);
      return user?.id ?? null;
    }
  } catch {
    // sessão inválida
  }
  return null;
}

// ============================================================
// Perfil do usuário (localStorage)
// ============================================================

export interface UserProfile {
  id: string;
  display_name: string | null;
  dark_mode: boolean | null;
  sound_typing: boolean | null;
  sound_click: boolean | null;
}

/** Carrega o perfil do usuário do localStorage */
export async function loadProfile(): Promise<UserProfile | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;

  return {
    id: userId,
    display_name: localStorage.getItem('produtivity_user_name'),
    dark_mode: localStorage.getItem('produtivity_dark_mode') === 'true',
    sound_typing: localStorage.getItem('produtivity_sound_typing') === 'true',
    sound_click: localStorage.getItem('produtivity_sound_click') === 'true',
  };
}

/** Atualiza o perfil do usuário no localStorage */
export async function updateProfile(updates: Partial<Omit<UserProfile, 'id'>>): Promise<void> {
  if (updates.display_name !== undefined && updates.display_name !== null) {
    localStorage.setItem('produtivity_user_name', updates.display_name);
  }
  if (updates.dark_mode !== undefined && updates.dark_mode !== null) {
    localStorage.setItem('produtivity_dark_mode', String(updates.dark_mode));
  }
  if (updates.sound_typing !== undefined && updates.sound_typing !== null) {
    localStorage.setItem('produtivity_sound_typing', String(updates.sound_typing));
  }
  if (updates.sound_click !== undefined && updates.sound_click !== null) {
    localStorage.setItem('produtivity_sound_click', String(updates.sound_click));
  }
}

// ============================================================
// Persistência genérica (localStorage)
// ============================================================

/**
 * Salva um valor no localStorage.
 */
export async function saveData<T>(key: string, value: T): Promise<void> {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * Carrega um valor do localStorage.
 */
export async function loadData<T>(key: string): Promise<T | null> {
  const local = localStorage.getItem(key);
  if (local) {
    try {
      return JSON.parse(local) as T;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Remove um dado do localStorage.
 */
export async function removeData(key: string): Promise<void> {
  localStorage.removeItem(key);
}

// ============================================================
// Sincronização — stubs (tudo apenas localStorage agora)
// ============================================================

/**
 * Stub de sincronização — não faz nada (sem serviço externo).
 */
export async function syncLocalData(): Promise<void> {
  // Nenhum serviço externo — dados já estão no localStorage
}

// Aliases para compatibilidade com imports antigos
export const syncLocalStorageToSupabase = syncLocalData;

/**
 * Stub de sincronização — não faz nada (sem serviço externo).
 */
export async function syncRemoteData(): Promise<void> {
  // Nenhum serviço externo — dados já estão no localStorage
}

// Aliases para compatibilidade com imports antigos
export const syncSupabaseToLocalStorage = syncRemoteData;

