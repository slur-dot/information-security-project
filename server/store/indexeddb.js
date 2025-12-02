const DB_NAME = 'e2ee_secure_chat';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const SESSIONS_STORE = 'sessions';

function openDb() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(KV_STORE)) {
				db.createObjectStore(KV_STORE);
			}
			if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
				db.createObjectStore(SESSIONS_STORE);
			}
		};
		req.onerror = () => reject(req.error);
		req.onsuccess = () => resolve(req.result);
	});
}

async function withStore(storeName, mode, cb) {
	const db = await openDb();
	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, mode);
		const store = tx.objectStore(storeName);
		cb(store, tx);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export const kvStore = {
	async get(key) {
		const username = sessionStorage.getItem('username');
		if (!username) return null;
		const namespacedKey = `${username}:${key}`;

		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(KV_STORE, 'readonly');
			const store = tx.objectStore(KV_STORE);
			const req = store.get(namespacedKey);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	},
	async put(key, value) {
		const username = sessionStorage.getItem('username');
		if (!username) return;
		const namespacedKey = `${username}:${key}`;

		return withStore(KV_STORE, 'readwrite', (store) => {
			store.put(value, namespacedKey);
		});
	},
	async del(key) {
		const username = sessionStorage.getItem('username');
		if (!username) return;
		const namespacedKey = `${username}:${key}`;

		return withStore(KV_STORE, 'readwrite', (store) => {
			store.delete(namespacedKey);
		});
	}
};

export const sessionStore = {
	async get(sessionId) {
		const username = sessionStorage.getItem('username');
		if (!username) return null;
		const namespacedKey = `${username}:${sessionId}`;

		const db = await openDb();
		return new Promise((resolve, reject) => {
			const tx = db.transaction(SESSIONS_STORE, 'readonly');
			const store = tx.objectStore(SESSIONS_STORE);
			const req = store.get(namespacedKey);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => reject(req.error);
		});
	},
	async put(state) {
		const username = sessionStorage.getItem('username');
		if (!username) return;
		const namespacedKey = `${username}:${state.sessionId}`;

		// Clone state to avoid mutating original object with our internal key
		const storedState = { ...state, _dbKey: namespacedKey };

		return withStore(SESSIONS_STORE, 'readwrite', (store) => {
			store.put(storedState, namespacedKey);
		});
	},
	async del(sessionId) {
		const username = sessionStorage.getItem('username');
		if (!username) return;
		const namespacedKey = `${username}:${sessionId}`;

		return withStore(SESSIONS_STORE, 'readwrite', (store) => {
			store.delete(namespacedKey);
		});
	}
};

// Expose for convenience where needed
if (!window.sessionStore) window.sessionStore = sessionStore;


