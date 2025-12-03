import mongoose from 'mongoose';
import { config } from './config.js';

export async function connectDb() {
	const uri = config.db.uri;
	mongoose.set('strictQuery', true);
	await mongoose.connect(uri, {
		autoIndex: true
	});
}


