import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
	ensureIdentityKeys,
	beginKeyExchange,
	pollKeyExchanges,
	deriveSessionIfPossible,
	aesGcmEncryptB64,
	aesGcmDecryptToString,
	getOrCreateSessionState,
	randomB64,
	nowMs
} from '../crypto/crypto';
import KeyStatus from '../components/KeyStatus.jsx';
import ChatWindow from '../components/ChatWindow.jsx';

function Chat() {
	const [toUsername, setToUsername] = useState('');
	const [message, setMessage] = useState('');
	const [sessionId, setSessionId] = useState('');
	const [status, setStatus] = useState('');
	const [messages, setMessages] = useState([]);
	const [polling, setPolling] = useState(false);
	const myUsername = sessionStorage.getItem('username');

	useEffect(() => {
		ensureIdentityKeys(myUsername).catch(() => { });
	}, [myUsername]);

	async function startExchange() {
		if (!toUsername) {
			setStatus('❌ Please enter a recipient username');
			return;
		}
		setStatus('🔄 Starting key exchange...');
		try {
			const s = await beginKeyExchange(myUsername, toUsername);
			setSessionId(s.sessionId);
			setStatus(`✅ Exchange initiated! Session ID: ${s.sessionId}`);
		} catch (e) {
			setStatus(`❌ Failed to start exchange: ${e.message}`);
		}
	}

	// Poll for pending exchanges and try to derive sessions
	useEffect(() => {
		let timer;
		async function tick() {
			try {
				const res = await pollKeyExchanges();
				// Try derive on any session records
				for (const sess of res.sessions || []) {
					await deriveSessionIfPossible(sess);

					// If this session involves me and I don't have a sessionId set yet, auto-populate it
					if (!sessionId && sess.sessionId) {
						const state = await getOrCreateSessionState(sess.sessionId);
						if (state?.aesKey) {
							// Key is established, use this session
							setSessionId(sess.sessionId);
							if (sess.initiatorUsername === myUsername) {
								setToUsername(sess.responderUsername);
								setStatus(`🎉 Key exchange complete with ${sess.responderUsername}! Ready to send messages.`);
							} else {
								setToUsername(sess.initiatorUsername);
								setStatus(`🎉 Key exchange complete with ${sess.initiatorUsername}! Ready to send messages.`);
							}
						} else if (sess.responderUsername === myUsername && sess.status === 'initiated') {
							// I'm the responder and exchange is pending
							setSessionId(sess.sessionId);
							setToUsername(sess.initiatorUsername);
							setStatus(`🔄 Received key exchange from ${sess.initiatorUsername}. Sending response...`);
						} else if (sess.status === 'responded' && !state?.aesKey) {
							// We have responded, but key is not derived yet
							setSessionId(sess.sessionId);
							// Determine who the other party is
							const other = sess.initiatorUsername === myUsername ? sess.responderUsername : sess.initiatorUsername;
							setToUsername(other);
							setStatus(`⚙️ Deriving secure session keys with ${other}...`);
						}
					}
				}
			} catch (e) {
				// ignore
			} finally {
				timer = setTimeout(tick, 2000);
			}
		}
		timer = setTimeout(tick, 1000);
		return () => clearTimeout(timer);
	}, [sessionId, myUsername]);

	async function sendMessage() {
		if (!toUsername || !sessionId || !message) return;
		const state = await getOrCreateSessionState(sessionId);
		if (!state?.aesKey) {
			setStatus('No session key yet. Finish key exchange first.');
			return;
		}
		const seq = (state.sequence || 0) + 1;
		const nonceB64 = await randomB64(16);
		const plaintext = JSON.stringify({
			type: 'text',
			from: myUsername,
			to: toUsername,
			nonceB64,
			sequence: seq,
			timestampMs: nowMs(),
			text: message
		});
		const { ivB64, ciphertextB64 } = await aesGcmEncryptB64(state.aesKey, plaintext);
		await api.post('/messages/send', {
			receiverUsername: toUsername,
			sessionId,
			ciphertextB64,
			ivB64,
			nonceB64,
			sequence: seq,
			timestampMs: nowMs()
		});
		state.sequence = seq;
		await window.sessionStore.put(state);
		setMessages((m) => [...m, { self: true, text: message }]);
		setMessage('');
		setStatus('');
	}

	// Poll pending messages
	useEffect(() => {
		if (polling) return;
		setPolling(true);
		let timer;
		async function tick() {
			try {
				const res = await api.get('/messages/pending');
				for (const msg of res.data.messages || []) {
					const state = await getOrCreateSessionState(msg.sessionId);
					if (!state?.aesKey) continue;
					try {
						const plaintext = await aesGcmDecryptToString(state.aesKey, msg.ivB64, msg.ciphertextB64);
						const obj = JSON.parse(plaintext);
						// Basic replay protections: timestamp window, nonce uniqueness, sequence monotonic
						const withinWindow = Math.abs(obj.timestampMs - nowMs()) < 5 * 60 * 1000;
						const seqOk = (state.lastRecvSeq || 0) < obj.sequence;
						const nonceSeen = state.seenNonces?.has?.(obj.nonceB64);
						if (!withinWindow || !seqOk || nonceSeen) {
							await api.post('/logs/client', {
								type: 'replay_detected',
								details: { sessionId: msg.sessionId, reason: { withinWindow, seqOk, nonceSeen } }
							});
							continue;
						}
						state.lastRecvSeq = obj.sequence;
						state.seenNonces = state.seenNonces || new Set();
						state.seenNonces.add(obj.nonceB64);
						await window.sessionStore.put(state);
						if (obj.type === 'text') {
							setMessages((m) => [...m, { self: false, text: obj.text }]);
						}
					} catch (e) {
						await api.post('/logs/client', {
							type: 'decrypt_failed',
							details: { messageId: msg._id, error: e?.message }
						});
					}
				}
			} catch (e) {
				// ignore
			} finally {
				timer = setTimeout(tick, 1500);
			}
		}
		timer = setTimeout(tick, 1000);
		return () => clearTimeout(timer);
	}, [polling]);

	return (
		<div className="animate-fade-in">
			<div style={{ marginBottom: '1.5rem' }}>
				<h3 style={{ marginBottom: '0.5rem' }}>💬 Secure Messaging</h3>
				<p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
					All messages are end-to-end encrypted
				</p>
			</div>

			<KeyStatus sessionId={sessionId} />

			<div className="card" style={{ marginBottom: '1.5rem' }}>
				<h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🔑 Key Exchange</h4>
				<div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
					<input
						placeholder="Recipient username"
						value={toUsername}
						onChange={(e) => setToUsername(e.target.value)}
						style={{ flex: '1 1 200px' }}
					/>
					<button
						className="btn-primary"
						onClick={startExchange}
						disabled={!toUsername}
					>
						🔐 Start Exchange
					</button>
				</div>
				{status && (
					<div style={{
						marginTop: '0.75rem',
						padding: '0.5rem 0.75rem',
						background: 'rgba(59, 130, 246, 0.1)',
						border: '1px solid rgba(59, 130, 246, 0.3)',
						borderRadius: 'var(--radius-md)',
						fontSize: '0.875rem',
						color: 'var(--color-info)'
					}}>
						ℹ️ {status}
					</div>
				)}
			</div>

			<ChatWindow messages={messages} />

			<div className="card" style={{ marginTop: '1rem' }}>
				<form
					onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
					style={{ display: 'flex', gap: '0.75rem' }}
				>
					<input
						placeholder="Type your message..."
						value={message}
						onChange={(e) => setMessage(e.target.value)}
						style={{ flex: 1 }}
						disabled={!sessionId}
					/>
					<button
						type="submit"
						className="btn-primary"
						disabled={!message || !sessionId}
					>
						Send 📤
					</button>
				</form>
			</div>
		</div>
	);
}

export default Chat;
