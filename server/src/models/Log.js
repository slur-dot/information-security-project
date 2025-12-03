import mongoose from 'mongoose';

const LogSchema = new mongoose.Schema(
	{
		type: { type: String, required: true, index: true }, // auth_attempt, key_exchange, invalid_signature, replay_detected, decrypt_failed, metadata_access
		userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
		details: { type: Object },
		createdAt: { type: Date, default: Date.now }
	},
	{ versionKey: false }
);

export const Log = mongoose.model('Log', LogSchema);


