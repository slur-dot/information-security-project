import express from 'express';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

export const keysRouter = express.Router();

// Directory lookup by username
keysRouter.get('/public/:username', requireAuth, async (req, res) => {
	try {
		const { username } = req.params;
		const user = await User.findOne({ username }).lean();
		if (!user) {
			return res.status(404).json({ error: 'not_found' });
		}
		return res.json({ username: user.username, publicSigningKeyJwk: user.publicSigningKeyJwk });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});


