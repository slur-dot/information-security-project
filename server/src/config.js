import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (parent of server directory)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
	app: {
		port: process.env.PORT || 4000
	},
	db: {
		uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/e2ee_secure_chat'
	},
	auth: {
		jwtSecret: process.env.JWT_SECRET || 'CHANGE_ME_DEV_ONLY',
		jwtExpiresIn: '12h'
	},
	uploads: {
		dir: process.env.UPLOAD_DIR || 'uploads'
	},
	security: {
		// Increased for development - allows 10000 requests per 15 minutes
		rateWindowMs: 15 * 60 * 1000,
		maxRequests: 10000
	}
};


