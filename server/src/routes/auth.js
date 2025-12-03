import express from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { config } from '../config.js';
import { writeLog } from '../utils/logger.js';

export const authRouter = express.Router();

authRouter.post('/register', async (req, res) => {
	try {
		const { username, password, publicSigningKeyJwk } = req.body || {};
		if (!username || !password || !publicSigningKeyJwk) {
			return res.status(400).json({ error: 'username, password, publicSigningKeyJwk required' });
		}
		const existing = await User.findOne({ username }).lean();
		if (existing) {
			return res.status(409).json({ error: 'Username already exists' });
		}
		const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
		const user = await User.create({
			username,
			passwordHash,
			publicSigningKeyJwk
		});
		await writeLog('auth_attempt', user._id, { action: 'register', ok: true });
		return res.json({ ok: true });
	} catch (e) {
		await writeLog('auth_attempt', null, { action: 'register', ok: false, error: e?.message });
		return res.status(500).json({ error: 'server_error' });
	}
});

authRouter.post('/login', async (req, res) => {
	try {
		const { username, password, publicSigningKeyJwk } = req.body || {};
		if (!username || !password) {
			return res.status(400).json({ error: 'username and password required' });
		}
		const user = await User.findOne({ username });
		if (!user) {
			await writeLog('auth_attempt', null, { action: 'login', username, ok: false });
			return res.status(401).json({ error: 'Invalid credentials' });
		}
		const ok = await argon2.verify(user.passwordHash, password);
		if (!ok) {
			await writeLog('auth_attempt', user._id, { action: 'login', ok: false });
			return res.status(401).json({ error: 'Invalid credentials' });
		}

		// Update public key if provided (handles case where local storage was cleared but user exists)
		if (publicSigningKeyJwk) {
			console.log(`[Auth] Updating public key for ${username}`);
			user.publicSigningKeyJwk = publicSigningKeyJwk;
			user.markModified('publicSigningKeyJwk');
			await user.save();
		}

		const token = jwt.sign({ sub: user._id.toString(), u: user.username }, config.auth.jwtSecret, {
			expiresIn: config.auth.jwtExpiresIn
		});
		await writeLog('auth_attempt', user._id, { action: 'login', ok: true });
		return res.json({ token, username: user.username });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});


