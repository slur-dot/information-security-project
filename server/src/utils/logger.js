import { Log } from '../models/Log.js';

export async function writeLog(type, userId, details = {}) {
	try {
		await Log.create({ type, userId, details });
	} catch (e) {
		console.error('Failed to write log', type, e?.message);
	}
}


