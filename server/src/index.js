import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { config } from './config.js';
import { connectDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { keysRouter } from './routes/keys.js';
import { exchangeRouter } from './routes/exchange.js';
import { messagesRouter } from './routes/messages.js';
import { filesRouter } from './routes/files.js';
import { logsRouter } from './routes/logs.js';

async function main() {
	await connectDb();
	const app = express();
	app.disable('x-powered-by');
	app.use(
		cors({
			origin: true,
			credentials: true
		})
	);
	app.use(helmet());
	app.use(morgan('dev'));
	app.use(express.json({ limit: '2mb' }));

	const limiter = rateLimit({
		windowMs: config.security.rateWindowMs,
		max: config.security.maxRequests
	});
	app.use(limiter);

	// Ensure uploads dir exists
	const uploadsDir = path.join(process.cwd(), config.uploads.dir);
	if (!fs.existsSync(uploadsDir)) {
		fs.mkdirSync(uploadsDir, { recursive: true });
	}

	app.get('/health', (req, res) => res.json({ ok: true }));
	app.use('/api/auth', authRouter);
	app.use('/api/keys', keysRouter);
	app.use('/api/exchange', exchangeRouter);
	app.use('/api/messages', messagesRouter);
	app.use('/api/files', filesRouter);
	app.use('/api/logs', logsRouter);

	app.use((req, res) => {
		res.status(404).json({ error: 'not_found' });
	});

	app.listen(config.app.port, () => {
		console.log(`Server listening on port ${config.app.port}`);
	});
}

main().catch((err) => {
	console.error('Fatal error starting server:', err);
	process.exit(1);
});


