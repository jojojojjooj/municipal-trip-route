import type { OfflineQueueTask } from "@shared/offlineQueue";

const DATABASE_NAME = "municipal-trip-route-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "tasks";

function openOfflineQueueDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
) {
  const database = await openOfflineQueueDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    const request = operation(transaction.objectStore(STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function listOfflineQueueTasks() {
  const tasks = await withStore<OfflineQueueTask[]>("readonly", store =>
    store.getAll()
  );
  return tasks.sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt)
  );
}

export async function putOfflineQueueTask(task: OfflineQueueTask) {
  await withStore<IDBValidKey>("readwrite", store => store.put(task));
}

export async function removeOfflineQueueTask(taskId: string) {
  await withStore<undefined>("readwrite", store => store.delete(taskId));
}
