import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setAuth } from '../api';
import { ensureIdentityKeys } from '../crypto/crypto';

function Login() {
	const navigate = useNavigate();
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	async function onSubmit(e) {
		e.preventDefault();
		setError('');
		setBusy(true);
		try {
			// Ensure identity keys exist and get public key to sync with server
			const { publicSigningKeyJwk } = await ensureIdentityKeys(username);
			const resp = await api.post('/auth/login', { username, password, publicSigningKeyJwk });
			setAuth(resp.data.token, resp.data.username);
			navigate('/chat');
		} catch (e) {
			setError(e?.response?.data?.error || e?.message || 'Login failed');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div style={{
			display: 'flex',
			justifyContent: 'center',
			alignItems: 'center',
			minHeight: 'calc(100vh - 200px)',
			padding: '2rem 0'
		}}>
			<div className="card animate-scale-in" style={{ maxWidth: '420px', width: '100%' }}>
				<div style={{ textAlign: 'center', marginBottom: '2rem' }}>
					<div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
					<h3 style={{ marginBottom: '0.5rem' }}>Welcome Back</h3>
					<p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
						Sign in to access your encrypted conversations
					</p>
				</div>

				<form onSubmit={onSubmit}>
					<div className="form-group">
						<label>Username</label>
						<input
							type="text"
							placeholder="Enter your username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
							autoFocus
						/>
					</div>

					<div className="form-group">
						<label>Password</label>
						<input
							type="password"
							placeholder="Enter your password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							required
						/>
					</div>

					<button
						type="submit"
						className="btn-primary w-full"
						disabled={busy}
						style={{ marginBottom: '1rem' }}
					>
						{busy ? (
							<>
								<span className="spinner"></span>
								Signing in...
							</>
						) : (
							'Sign In'
						)}
					</button>
				</form>

				{error && (
					<div className="error-message">
						⚠️ {error}
					</div>
				)}

				<div style={{
					textAlign: 'center',
					marginTop: '1.5rem',
					paddingTop: '1.5rem',
					borderTop: '1px solid var(--glass-border)'
				}}>
					<p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
						Don't have an account?{' '}
						<Link to="/register" style={{ color: 'var(--color-text-accent)', textDecoration: 'none', fontWeight: 500 }}>
							Create one
						</Link>
					</p>
				</div>
			</div>
		</div>
	);
}

export default Login;
