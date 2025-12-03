import mongoose from 'mongoose';

// Use Mixed type for JWK to ensure we store exactly what the client sends (including alg, etc.)
const PublicKeyJwkSchema = mongoose.Schema.Types.Mixed;

const UserSchema = new mongoose.Schema(
	{
		username: { type: String, required: true, unique: true, index: true },
		passwordHash: { type: String, required: true },
		publicSigningKeyJwk: { type: PublicKeyJwkSchema, required: true },
		createdAt: { type: Date, default: Date.now }
	},
	{ versionKey: false }
);

export const User = mongoose.model('User', UserSchema);


