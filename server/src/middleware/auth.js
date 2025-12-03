import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { writeLog } from '../utils/logger.js';

export async function requireAuth(req, res, next) {
	const hdr = req.headers.authorization || '';
	const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
	if (!token) {
		return res.status(401).json({ error: 'Missing token' });
	}
	try {
		const payload = jwt.verify(token, config.auth.jwtSecret);
		const user = await User.findById(payload.sub).lean();
		if (!user) {
			return res.status(401).json({ error: 'Invalid token subject' });
		}
		req.user = { id: user._id.toString(), username: user.username };
		return next();
	} catch (e) {
		await writeLog('auth_attempt', null, { ok: false, error: e?.message });
		return res.status(401).json({ error: 'Invalid token' });
	}
}


