const DATABASE_NAME = 'leitor-log-horustech';
const DATABASE_VERSION = 1;
const STORE_NAME = 'app-data';
let writeQueue: Promise<void> = Promise.resolve();

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (!('indexedDB' in window)) {
    reject(new Error('IndexedDB não está disponível neste navegador.'));
    return;
  }

  const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(STORE_NAME)) {
      database.createObjectStore(STORE_NAME);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Não foi possível abrir o banco local.'));
  request.onblocked = () => reject(new Error('A atualização do banco local foi bloqueada por outra aba.'));
});

const runRequest = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Falha na operação do banco local.'));
});

const readFromIndexedDb = async <T>(key: string): Promise<T | null> => {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const value = await runRequest(transaction.objectStore(STORE_NAME).get(key));
    return value === undefined ? null : value as T;
  } finally {
    database.close();
  }
};

const writeToIndexedDb = async <T>(key: string, value: T): Promise<void> => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Não foi possível salvar no banco local.'));
      transaction.onabort = () => reject(transaction.error || new Error('A gravação no banco local foi cancelada.'));
    });
  } finally {
    database.close();
  }
};

const readLegacyValue = <T>(legacyKey: string): T | null => {
  const rawValue = localStorage.getItem(legacyKey);
  if (!rawValue) return null;
  return JSON.parse(rawValue) as T;
};

export const loadPersistedValue = async <T>(key: string, legacyKey: string): Promise<T | null> => {
  try {
    const indexedValue = await readFromIndexedDb<T>(key);
    if (indexedValue !== null) return indexedValue;
  } catch (error) {
    console.warn('IndexedDB indisponível durante a leitura; usando armazenamento legado.', error);
    return readLegacyValue<T>(legacyKey);
  }

  const legacyValue = readLegacyValue<T>(legacyKey);
  if (legacyValue === null) return null;

  await writeToIndexedDb(key, legacyValue);
  localStorage.removeItem(legacyKey);
  return legacyValue;
};

export const persistValue = async <T>(key: string, legacyKey: string, value: T): Promise<void> => {
  writeQueue = writeQueue
    .catch(() => undefined)
    .then(async () => {
      try {
        await writeToIndexedDb(key, value);
      } catch (indexedDbError) {
        console.warn('IndexedDB indisponível durante a gravação; usando armazenamento legado.', indexedDbError);
        localStorage.setItem(legacyKey, JSON.stringify(value));
      }
    });
  return writeQueue;
};
