import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
	{
		senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
		receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
		sessionId: { type: String, index: true },
		ciphertextB64: { type: String, required: true }, // AES-GCM ciphertext (Base64)
		ivB64: { type: String, required: true }, // 12-byte IV (Base64)
		nonceB64: { type: String, required: true }, // message unique nonce (Base64)
		sequence: { type: Number, required: true }, // monotonic per-session
		timestampMs: { type: Number, required: true },
		createdAt: { type: Date, default: Date.now },
		delivered: { type: Boolean, default: false } // basic delivery flag for polling
	},
	{ versionKey: false }
);

export const Message = mongoose.model('Message', MessageSchema);


