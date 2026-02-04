import { SyncPayload } from '../types';

// ==========================================
// CONFIGURATION (JSONBin.io)
// ==========================================
const BIN_ID = '6983281743b1c97be9648388';
const MASTER_KEY = '$2a$10$NF7T7RBUumSI/0.SupbegOsWkX4oQ7umNzklCodID2uGXfDUAFEQu';
const API_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

export const saveRemoteState = async (data: SyncPayload): Promise<void> => {
    try {
        const res = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': MASTER_KEY
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            throw new Error(`Ошибка сохранения: ${res.status}`);
        }
    } catch (e: any) {
        console.error("Sync Save Error:", e);
        throw e;
    }
};

export const fetchRemoteState = async (): Promise<SyncPayload> => {
    try {
        const res = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'X-Master-Key': MASTER_KEY
            }
        });

        if (!res.ok) {
            throw new Error(`Ошибка загрузки: ${res.status}`);
        }

        const json = await res.json();
        // JSONBin возвращает данные внутри поля 'record'
        return json.record as SyncPayload;
    } catch (e: any) {
        console.error("Sync Load Error:", e);
        throw e;
    }
};