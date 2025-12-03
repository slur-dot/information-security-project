import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { KeySession } from '../models/KeySession.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLog } from '../utils/logger.js';

export const exchangeRouter = express.Router();

// Initiate a key exchange with signed ephemeral key
exchangeRouter.post('/initiate', requireAuth, async (req, res) => {
	try {
		const { receiverUsername, ephemeralPubJwk, signatureB64, nonceB64, timestampMs } = req.body || {};
		if (!receiverUsername || !ephemeralPubJwk || !signatureB64 || !nonceB64 || !timestampMs) {
			return res.status(400).json({ error: 'missing_fields' });
		}
		const receiver = await User.findOne({ username: receiverUsername });
		if (!receiver) {
			return res.status(404).json({ error: 'receiver_not_found' });
		}
		const sessionId = uuidv4();
		const doc = await KeySession.create({
			sessionId,
			initiatorId: req.user.id,
			responderId: receiver._id,
			initMsg: { ephemeralPubJwk, signatureB64, nonceB64, timestampMs },
			status: 'initiated'
		});
		await writeLog('key_exchange', req.user.id, { action: 'initiate', sessionId, to: receiver._id });
		return res.json({ ok: true, sessionId, createdAt: doc.createdAt });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// Fetch pending inbound initiations for the authenticated user (to respond)
exchangeRouter.get('/pending', requireAuth, async (req, res) => {
	try {
		const sessions = await KeySession.find({
			responderId: req.user.id,
			status: 'initiated'
		})
			.sort({ createdAt: -1 })
			.populate('initiatorId', 'username')
			.populate('responderId', 'username')
			.lean();
		const mapped = sessions.map((s) => ({
			...s,
			initiatorUsername: s.initiatorId?.username,
			responderUsername: s.responderId?.username
		}));
		return res.json({ sessions: mapped });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// Respond to a key exchange with signed ephemeral key
exchangeRouter.post('/respond', requireAuth, async (req, res) => {
	try {
		const { sessionId, ephemeralPubJwk, signatureB64, nonceB64, timestampMs } = req.body || {};
		if (!sessionId || !ephemeralPubJwk || !signatureB64 || !nonceB64 || !timestampMs) {
			return res.status(400).json({ error: 'missing_fields' });
		}
		const session = await KeySession.findOne({ sessionId });
		if (!session) {
			return res.status(404).json({ error: 'session_not_found' });
		}
		if (session.responderId.toString() !== req.user.id) {
			return res.status(403).json({ error: 'not_authorized' });
		}
		session.respMsg = { ephemeralPubJwk, signatureB64, nonceB64, timestampMs };
		session.status = 'responded';
		await session.save();
		await writeLog('key_exchange', req.user.id, { action: 'respond', sessionId });
		return res.json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// List sessions for the authenticated user
exchangeRouter.get('/sessions', requireAuth, async (req, res) => {
	try {
		const sessions = await KeySession.find({
			$or: [{ initiatorId: req.user.id }, { responderId: req.user.id }]
		})
			.sort({ updatedAt: -1 })
			.populate('initiatorId', 'username')
			.populate('responderId', 'username')
			.lean();
		const mapped = sessions.map((s) => ({
			...s,
			initiatorUsername: s.initiatorId?.username,
			responderUsername: s.responderId?.username
		}));
		return res.json({ sessions: mapped });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// Post key confirmation message (relayed only)
exchangeRouter.post('/confirm', requireAuth, async (req, res) => {
	try {
		const { sessionId, role, ivB64, ciphertextB64, timestampMs } = req.body || {};
		if (!sessionId || !role || !ivB64 || !ciphertextB64 || !timestampMs) {
			return res.status(400).json({ error: 'missing_fields' });
		}
		const session = await KeySession.findOne({ sessionId });
		if (!session) {
			return res.status(404).json({ error: 'session_not_found' });
		}
		if (![session.initiatorId.toString(), session.responderId.toString()].includes(req.user.id)) {
			return res.status(403).json({ error: 'not_authorized' });
		}
		if (role === 'initiator') {
			session.confirmations.initiator = { ivB64, ciphertextB64, timestampMs };
		} else if (role === 'responder') {
			session.confirmations.responder = { ivB64, ciphertextB64, timestampMs };
		} else {
			return res.status(400).json({ error: 'invalid_role' });
		}
		if (session.confirmations.initiator && session.confirmations.responder) {
			session.status = 'completed';
		} else {
			session.status = 'confirmed';
		}
		await session.save();
		await writeLog('key_exchange', req.user.id, { action: 'confirm', sessionId, role });
		return res.json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});


