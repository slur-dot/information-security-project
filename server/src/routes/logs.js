import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { writeLog } from '../utils/logger.js';

export const logsRouter = express.Router();

// Client can submit security event logs (no plaintext)
logsRouter.post('/client', requireAuth, async (req, res) => {
	try {
		const { type, details } = req.body || {};
		if (!type) {
			return res.status(400).json({ error: 'missing_type' });
		}
		await writeLog(type, req.user.id, details || {});
		return res.json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});


