import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { FileModel } from '../models/File.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config.js';
import { writeLog } from '../utils/logger.js';

export const filesRouter = express.Router();

const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		const dir = path.join(process.cwd(), config.uploads.dir);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		cb(null, dir);
	},
	filename: (req, file, cb) => {
		cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.bin`);
	}
});
const upload = multer({ storage });

// Create a new encrypted file manifest
filesRouter.post('/initiate', requireAuth, async (req, res) => {
	try {
		const { receiverUsername, sessionId, originalName, mimeType, totalSize, totalChunks } = req.body || {};
		if (!receiverUsername || !sessionId || !originalName || !mimeType || !totalSize || !totalChunks) {
			return res.status(400).json({ error: 'missing_fields' });
		}
		const receiver = await User.findOne({ username: receiverUsername });
		if (!receiver) {
			return res.status(404).json({ error: 'receiver_not_found' });
		}
		const fileId = uuidv4();
		await FileModel.create({
			fileId,
			ownerId: req.user.id,
			receiverId: receiver._id,
			sessionId,
			originalName,
			mimeType,
			totalSize,
			totalChunks,
			chunks: []
		});
		await writeLog('metadata_access', req.user.id, { action: 'file_initiate', fileId });
		return res.json({ ok: true, fileId });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// Upload an encrypted chunk (AES-GCM ciphertext)
filesRouter.post('/upload-chunk', requireAuth, upload.single('chunk'), async (req, res) => {
	try {
		const { fileId, index, ivB64, size } = req.body || {};
		if (!fileId || typeof Number(index) !== 'number' || !ivB64 || !size || !req.file) {
			return res.status(400).json({ error: 'missing_fields' });
		}
		const doc = await FileModel.findOne({ fileId });
		if (!doc) {
			return res.status(404).json({ error: 'file_not_found' });
		}
		if (doc.ownerId.toString() !== req.user.id) {
			return res.status(403).json({ error: 'not_authorized' });
		}
		doc.chunks.push({
			index: Number(index),
			size: Number(size),
			ivB64,
			path: req.file.path
		});
		await doc.save();
		await writeLog('metadata_access', req.user.id, {
			action: 'file_upload_chunk',
			fileId,
			index: Number(index)
		});
		return res.json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// Complete upload
filesRouter.post('/complete', requireAuth, async (req, res) => {
	try {
		const { fileId } = req.body || {};
		if (!fileId) {
			return res.status(400).json({ error: 'missing_fields' });
		}
		const doc = await FileModel.findOne({ fileId });
		if (!doc) {
			return res.status(404).json({ error: 'file_not_found' });
		}
		if (doc.ownerId.toString() !== req.user.id) {
			return res.status(403).json({ error: 'not_authorized' });
		}
		// No plaintext operations here; just return manifest for client to share key out-of-band (encrypted)
		return res.json({ ok: true, file: { fileId: doc.fileId, totalChunks: doc.totalChunks } });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// List files shared with me
filesRouter.get('/list', requireAuth, async (req, res) => {
	try {
		const files = await FileModel.find({ receiverId: req.user.id })
			.select('fileId originalName mimeType totalSize totalChunks createdAt')
			.sort({ createdAt: -1 })
			.lean();
		return res.json({ files });
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});

// Download encrypted chunk by index
filesRouter.get('/download-chunk', requireAuth, async (req, res) => {
	try {
		const { fileId, index } = req.query;
		const doc = await FileModel.findOne({ fileId }).lean();
		if (!doc) {
			return res.status(404).json({ error: 'file_not_found' });
		}
		if (doc.receiverId.toString() !== req.user.id && doc.ownerId.toString() !== req.user.id) {
			return res.status(403).json({ error: 'not_authorized' });
		}
		const chunk = doc.chunks.find((c) => c.index === Number(index));
		if (!chunk) {
			return res.status(404).json({ error: 'chunk_not_found' });
		}
		res.setHeader('Content-Type', 'application/octet-stream');
		res.setHeader('X-Chunk-IVB64', chunk.ivB64);
		return res.sendFile(path.resolve(chunk.path));
	} catch (e) {
		return res.status(500).json({ error: 'server_error' });
	}
});


