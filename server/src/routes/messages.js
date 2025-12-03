import express from 'express';
import { Message } from '../models/Message.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { writeLog } from '../utils/logger.js';

export const messagesRouter = express.Router();

// Send encrypted message (ciphertext only)
messagesRouter.post('/send', requireAuth, async (req, res) => {
	try {
		const { receiverUsername, sessionId, ciphertextB64, ivB64, nonceB64, sequence, timestampMs } =
			req.body || {};
		if (
			!receiverUsername ||
			!sessionId ||
			!ciphertextB64 ||
			!ivB64 ||
			!nonceB64 ||
			typeof sequence !== 'number' ||
			!timestampMs
		) {
			return res.status(400).json({ error: 'missing_fields' });
		}
		const receiver = await User.findOne({ username: receiverUsername });
		if (!receiver) {
			return res.status(404).json({ error: 'receiver_not_found' });
		}
		const doc = await Message.create({
			senderId: req.user.id,
			receiverId: receiver._id,
			sessionId,
			ciphertextB64,
			ivB64,
			nonceB64,
			sequence,
			timestampMs
		});
		await writeLog('metadata_access', req.user.id, { action: 'store_message', messageId: doc._id });
		return res.json({ ok: true, id: doc._id.toString() });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// Fetch pending messages for authenticated user
messagesRouter.get('/pending', requireAuth, async (req, res) => {
	try {
		const { afterId } = req.query;
		const query = { receiverId: req.user.id, delivered: false };
		if (afterId) {
			query._id = { $gt: afterId };
		}
		const msgs = await Message.find(query).sort({ _id: 1 }).limit(100).lean();
		// Mark as delivered
		const ids = msgs.map((m) => m._id);
		if (ids.length > 0) {
			await Message.updateMany({ _id: { $in: ids } }, { $set: { delivered: true } });
		}
		return res.json({ messages: msgs });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});


