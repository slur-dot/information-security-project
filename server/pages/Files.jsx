import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
	getOrCreateSessionState,
	aesGcmEncryptChunkB64,
	aesGcmDecryptToArrayBuffer,
	generateRandomAesKey,
	aesKeyExportRawB64
} from '../crypto/crypto';

function Files() {
	const [toUsername, setToUsername] = useState('');
	const [sessionId, setSessionId] = useState('');
	const [file, setFile] = useState(null);
	const [files, setFiles] = useState([]);
	const [busy, setBusy] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);

	useEffect(() => {
		async function load() {
			try {
				const res = await api.get('/files/list');
				setFiles(res.data.files || []);
			} catch { }
		}
		load();
	}, []);

	async function uploadEncrypted() {
		if (!file || !toUsername || !sessionId) return;
		setBusy(true);
		setUploadProgress(0);
		try {
			const state = await getOrCreateSessionState(sessionId);
			if (!state?.aesKey) throw new Error('No session key');

			const fileKey = await generateRandomAesKey();
			const fileKeyRawB64 = await aesKeyExportRawB64(fileKey);

			const chunkSize = 1024 * 1024; // 1MB
			const totalChunks = Math.ceil(file.size / chunkSize);
			const init = await api.post('/files/initiate', {
				receiverUsername: toUsername,
				sessionId,
				originalName: file.name,
				mimeType: file.type || 'application/octet-stream',
				totalSize: file.size,
				totalChunks
			});
			const fileId = init.data.fileId;

			// encrypt and upload chunks
			for (let i = 0; i < totalChunks; i++) {
				const slice = file.slice(i * chunkSize, Math.min((i + 1) * chunkSize, file.size));
				const arrayBuffer = await slice.arrayBuffer();
				const { ivB64, ciphertextB64 } = await aesGcmEncryptChunkB64(fileKey, arrayBuffer);
				const form = new FormData();
				form.set('fileId', fileId);
				form.set('index', String(i));
				form.set('ivB64', ivB64);
				form.set('size', String(slice.size));
				form.set('chunk', new Blob([Uint8Array.from(atob(ciphertextB64), (c) => c.charCodeAt(0))]), 'c.bin');
				await fetch(`${api.defaults.baseURL}/files/upload-chunk`, {
					method: 'POST',
					headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
					body: form
				});
				setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
			}
			await api.post('/files/complete', { fileId });

			alert(`File uploaded successfully! 🎉\n\nShare this info with recipient:\nFile ID: ${fileId}\nFile Key: ${fileKeyRawB64}`);

			// Reload file list
			const res = await api.get('/files/list');
			setFiles(res.data.files || []);
			setFile(null);
			setUploadProgress(0);
		} catch (e) {
			alert('Upload failed: ' + (e?.message || 'Unknown error'));
		} finally {
			setBusy(false);
		}
	}

	async function download(fileId) {
		try {
			const state = await getOrCreateSessionState(sessionId);
			if (!state?.aesKey) throw new Error('No session key');

			const fileKeyRawB64 = prompt('Enter file key (base64) from sender:');
			if (!fileKeyRawB64) return;
			const fileKeyRaw = Uint8Array.from(atob(fileKeyRawB64), (c) => c.charCodeAt(0)).buffer;
			const fileKey = await crypto.subtle.importKey('raw', fileKeyRaw, 'AES-GCM', false, ['encrypt', 'decrypt']);

			const meta = files.find((f) => f.fileId === fileId);
			if (!meta) throw new Error('File not found in list');
			const chunks = [];
			for (let i = 0; i < meta.totalChunks; i++) {
				const resp = await fetch(
					`${api.defaults.baseURL}/files/download-chunk?fileId=${encodeURIComponent(fileId)}&index=${i}`,
					{ headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` } }
				);
				const ivB64 = resp.headers.get('x-chunk-ivb64');
				const ciphertextBuf = await resp.arrayBuffer();
				const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuf)));
				const ab = await aesGcmDecryptToArrayBuffer(fileKey, ivB64, cipherB64);
				chunks.push(new Uint8Array(ab));
			}
			const blob = new Blob(chunks, { type: meta.mimeType });
			const link = document.createElement('a');
			link.href = URL.createObjectURL(blob);
			link.download = meta.originalName;
			link.click();
			URL.revokeObjectURL(link.href);
		} catch (e) {
			alert('Download failed: ' + (e?.message || 'Unknown error'));
		}
	}

	function formatFileSize(bytes) {
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	return (
		<div className="animate-fade-in">
			<div style={{ marginBottom: '1.5rem' }}>
				<h3 style={{ marginBottom: '0.5rem' }}>📁 Encrypted File Sharing</h3>
				<p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
					Share files securely with end-to-end encryption
				</p>
			</div>

			<div className="card" style={{ marginBottom: '1.5rem' }}>
				<h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>📤 Upload File</h4>

				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
					<div className="form-group" style={{ marginBottom: 0 }}>
						<label>Recipient</label>
						<input
							placeholder="Username"
							value={toUsername}
							onChange={(e) => setToUsername(e.target.value)}
						/>
					</div>
					<div className="form-group" style={{ marginBottom: 0 }}>
						<label>Session ID</label>
						<input
							placeholder="Session ID"
							value={sessionId}
							onChange={(e) => setSessionId(e.target.value)}
							className="text-mono"
						/>
					</div>
				</div>

				<div className="form-group">
					<label>Select File</label>
					<input
						type="file"
						onChange={(e) => setFile(e.target.files?.[0] || null)}
						disabled={busy}
					/>
					{file && (
						<div style={{
							marginTop: '0.5rem',
							fontSize: '0.875rem',
							color: 'var(--color-text-secondary)'
						}}>
							📄 {file.name} ({formatFileSize(file.size)})
						</div>
					)}
				</div>

				{busy && uploadProgress > 0 && (
					<div style={{ marginBottom: '1rem' }}>
						<div style={{
							display: 'flex',
							justifyContent: 'space-between',
							marginBottom: '0.5rem',
							fontSize: '0.875rem',
							color: 'var(--color-text-secondary)'
						}}>
							<span>Uploading...</span>
							<span>{uploadProgress}%</span>
						</div>
						<div style={{
							height: '8px',
							background: 'rgba(255, 255, 255, 0.1)',
							borderRadius: 'var(--radius-full)',
							overflow: 'hidden'
						}}>
							<div style={{
								height: '100%',
								width: `${uploadProgress}%`,
								background: 'var(--color-accent-gradient)',
								transition: 'width 0.3s ease'
							}} />
						</div>
					</div>
				)}

				<button
					className="btn-primary w-full"
					disabled={!file || !toUsername || !sessionId || busy}
					onClick={uploadEncrypted}
				>
					{busy ? (
						<>
							<span className="spinner"></span>
							Encrypting & Uploading...
						</>
					) : (
						<>
							🔐 Upload Encrypted File
						</>
					)}
				</button>
			</div>

			<div className="card">
				<h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>📥 Shared Files</h4>

				{files.length === 0 ? (
					<div style={{
						textAlign: 'center',
						padding: '2rem',
						color: 'var(--color-text-muted)'
					}}>
						<span style={{ fontSize: '3rem', display: 'block', marginBottom: '0.5rem' }}>📂</span>
						<p>No files shared with you yet</p>
					</div>
				) : (
					<div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
						{files.map((f) => (
							<div
								key={f.fileId}
								className="card-hover"
								style={{
									display: 'flex',
									alignItems: 'center',
									gap: '1rem',
									padding: '1rem',
									background: 'rgba(255, 255, 255, 0.03)',
									border: '1px solid var(--glass-border)',
									borderRadius: 'var(--radius-md)'
								}}
							>
								<span style={{ fontSize: '2rem' }}>📄</span>
								<div style={{ flex: 1 }}>
									<div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
										{f.originalName}
									</div>
									<div style={{
										fontSize: '0.75rem',
										color: 'var(--color-text-muted)',
										display: 'flex',
										gap: '1rem'
									}}>
										<span>{formatFileSize(f.totalSize)}</span>
										<span className="text-mono">{f.fileId.substring(0, 8)}...</span>
									</div>
								</div>
								<button
									className="btn-secondary btn-sm"
									onClick={() => download(f.fileId)}
								>
									Download 🔓
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

export default Files;
