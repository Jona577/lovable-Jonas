/**
 * studyBankService.ts
 *
 * Serviço do Banco de Conhecimento (página Study).
 *
 * Todas as categorias (livros, PDFs, vídeo aulas, revisões, questões, simulados)
 * são armazenadas no localStorage sob a chave 'produtivity_books'.
 */

// ============================================================
// Tipos (espelha a interface Book do Study.tsx)
// ============================================================

type Relevance = 'Alta' | 'Média' | 'Baixa' | 'Baixíssima';

export interface Book {
  id: string;
  name: string;
  categoryId: string;
  type: string;
  estimateDays?: number;
  totalPages: number;
  readPages: number;
  color: string;
  dateAdded: string;
  relevance?: Relevance;
  videoFinality?: 'Para estudo' | 'Entretenimento';
  videoSource?: string;
  videoDuration?: string;
  videoCompletionTime?: string;
  reviewMethod?: 'Ativa' | 'Passiva';
  reviewRepetitions?: number;
  reviewDuration?: string;
  questionSource?: string;
  questionQuantity?: number;
  questionDuration?: string;
  simuladoOrigin?: 'ENEM' | 'Vestibulares' | 'Faculdade';
  simuladoYear?: string;
  simuladoTestType?: string;
  simuladoArea?: string;
  simuladoTestColorName?: string;
  simuladoDurationMins?: number;
  videoStudyType?: 'ensino_medio' | 'faculdade';
  videoDiscipline?: string;
  videoArea?: string;
  videoMatter?: string;
  videoTopic?: string;
  videoSubject?: string;
  videoSub1?: string;
  videoSub2?: string;
  videoSub3?: string;
  flashcardFront?: string;
  flashcardBack?: string;
  flashcardImages?: { id: string; src: string; x: number; y: number; size: number }[];
}

// ============================================================
// Helpers
// ============================================================

const STORAGE_KEY = 'produtivity_books';

function readLocal(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocal(books: Book[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

// ============================================================
// API Pública — CRUD do Banco de Conhecimento
// ============================================================

/**
 * Carrega todos os itens de estudo do localStorage.
 */
export async function loadAllStudyItems(): Promise<Book[]> {
  const items = readLocal();
  items.sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
  return items;
}

/**
 * Insere um item e atualiza o localStorage.
 */
export async function insertStudyItem(book: Book, allBooks: Book[]): Promise<void> {
  writeLocal(allBooks);
  console.log(`[studyBankService] ✅ Item inserido: "${book.name}"`);
}

/**
 * Atualiza um item existente no localStorage.
 */
export async function updateStudyItem(book: Book, allBooks: Book[]): Promise<void> {
  writeLocal(allBooks);
  console.log(`[studyBankService] ✅ Item atualizado: "${book.name}"`);
}

/**
 * Remove um item do localStorage.
 */
export async function deleteStudyItem(bookId: string, categoryId: string, allBooks: Book[]): Promise<void> {
  writeLocal(allBooks);
  console.log(`[studyBankService] ✅ Item deletado: ${bookId}`);
}

/**
 * Salva TODOS os itens de uma vez no localStorage.
 */
export async function saveAllStudyItems(allBooks: Book[]): Promise<void> {
  writeLocal(allBooks);
}

/**
 * Registra uma entrada de progresso de leitura de livro (apenas log local).
 */
export async function recordBookProgress(bookId: string, pagesRead: number, totalPages: number): Promise<void> {
  console.log(`[studyBankService] Progresso registrado: livro ${bookId}, ${pagesRead}/${totalPages} páginas.`);
}

/**
 * Salva itens de path no localStorage.
 */
export async function savePathItems(pathKey: string, items: string[]): Promise<void> {
  localStorage.setItem(pathKey, JSON.stringify(items));
}

/**
 * Stub: sincronização de itens de estudo (sem serviço externo).
 */
export async function syncStudyItemsUp(): Promise<void> {
  // Sem serviço externo — dados já estão no localStorage
}

// Alias para compatibilidade
export const syncStudyItemsToSupabase = syncStudyItemsUp;

/**
 * Stub: sincronização de itens de estudo (sem serviço externo).
 */
export async function syncStudyItemsDown(): Promise<void> {
  // Sem serviço externo — dados já estão no localStorage
}

// Alias para compatibilidade
export const syncStudyItemsFromSupabase = syncStudyItemsDown;

/**
 * Stub: sincronização de paths salvos (sem serviço externo).
 */
export async function syncSavedPathsUp(): Promise<void> {
  // Sem serviço externo
}

// Alias para compatibilidade
export const syncSavedPathsToSupabase = syncSavedPathsUp;

/**
 * Stub: sincronização de paths salvos (sem serviço externo).
 */
export async function syncSavedPathsDown(): Promise<void> {
  // Sem serviço externo
}

// Alias para compatibilidade
export const syncSavedPathsFromSupabase = syncSavedPathsDown;
