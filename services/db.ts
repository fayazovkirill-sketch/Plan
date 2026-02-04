import { Task } from '../types';

const DB_NAME = 'AsceticPlannerDB';
const STORE_NAME = 'tasks';
const DB_VERSION = 1;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject(event);

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

export const saveTasks = async (tasks: Task[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Clear existing (simple strategy for this app size)
    const clearRequest = store.clear();
    
    clearRequest.onsuccess = () => {
        let completed = 0;
        if (tasks.length === 0) {
            resolve();
            return;
        }
        
        tasks.forEach(task => {
            const addRequest = store.add(task);
            addRequest.onsuccess = () => {
                completed++;
                if (completed === tasks.length) resolve();
            };
            addRequest.onerror = () => reject(addRequest.error);
        });
    };
    
    clearRequest.onerror = () => reject(clearRequest.error);
  });
};

export const loadTasks = async (): Promise<Task[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result as Task[]);
    request.onerror = () => reject(request.error);
  });
};