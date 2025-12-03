import mongoose from 'mongoose';

// Use Mixed type for JWK to ensure we store exactly what the client sends
const JwkSchema = mongoose.Schema.Types.Mixed;

const KeySessionSchema = new mongoose.Schema(
	{
		sessionId: { type: String, required: true, unique: true, index: true },
		initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
		responderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
		initMsg: {
			ephemeralPubJwk: JwkSchema,
			signatureB64: String,
			nonceB64: String,
			timestampMs: Number
		},
		respMsg: {
			ephemeralPubJwk: JwkSchema,
			signatureB64: String,
			nonceB64: String,
			timestampMs: Number
		},
		confirmations: {
			initiator: {
				ivB64: String,
				ciphertextB64: String,
				timestampMs: Number
			},
			responder: {
				ivB64: String,
				ciphertextB64: String,
				timestampMs: Number
			}
		},
		status: {
			type: String,
			enum: ['initiated', 'responded', 'confirmed', 'completed'],
			default: 'initiated'
		},
		createdAt: { type: Date, default: Date.now },
		updatedAt: { type: Date, default: Date.now }
	},
	{ versionKey: false }
);

KeySessionSchema.pre('save', function (next) {
	this.updatedAt = new Date();
	next();
});

export const KeySession = mongoose.model('KeySession', KeySessionSchema);


