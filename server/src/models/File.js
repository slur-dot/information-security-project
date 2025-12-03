import mongoose from 'mongoose';

const FileChunkSchema = new mongoose.Schema(
	{
		index: { type: Number, required: true },
		size: { type: Number, required: true },
		ivB64: { type: String, required: true },
		path: { type: String, required: true }
	},
	{ _id: false }
);

const FileSchema = new mongoose.Schema(
	{
		fileId: { type: String, required: true, unique: true, index: true },
		ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
		receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
		sessionId: { type: String, index: true },
		originalName: { type: String, required: true },
		mimeType: { type: String, required: true },
		totalSize: { type: Number, required: true },
		totalChunks: { type: Number, required: true },
		chunks: [FileChunkSchema],
		createdAt: { type: Date, default: Date.now }
	},
	{ versionKey: false }
);

export const FileModel = mongoose.model('File', FileSchema);


