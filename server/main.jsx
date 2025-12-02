import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles.css';
import App from './App.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Chat from './pages/Chat.jsx';
import Files from './pages/Files.jsx';

function Root() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<App />}>
					<Route index element={<Navigate to="/chat" replace />} />
					<Route path="login" element={<Login />} />
					<Route path="register" element={<Register />} />
					<Route path="chat" element={<Chat />} />
					<Route path="files" element={<Files />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}

createRoot(document.getElementById('root')).render(<Root />);


