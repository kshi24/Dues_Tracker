import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg'
import '../styles.css'

const API_URL = 'http://localhost:8000';

export default function SignIn() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSignIn = async () => {
        setError(null);
        setLoading(true);
        try {
            const resp = await fetch(`${API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: password || null })
            });
            const data = await resp.json();
            if (!resp.ok) {
                throw new Error(data.detail || 'Login failed');
            }
            // Store token & role
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('auth_role', data.role);
            localStorage.setItem('member_name', data.name);
            localStorage.setItem('member_id', data.member_id);
            if (data.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/member');
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-gradient-to-r from-blue-200 to-cyan-200 flex h-screen w-full">
            <div className="flex-1 flex flex-col justify-center items-center p-8">

                <div className="bg-white rounded-2xl shadow-2xl p-10 items-center w-full max-w-md">


                    <div className="flex justify-center mb-6">
                        <img src={logo} className="w-32 h-32" alt="logo" />
                    </div>

                    <div className="mb-8">
                        <h1 className="text-3xl text-center font-bold text-gray-800 mb-2">
                            TAMID DUES TRACKER
                        </h1>
                    </div>

                    <div className="flex flex-col gap-4">
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                        />
                        <input
                            type="password"
                            placeholder="Admin password (optional for members)"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                        />
                        {error && (
                            <div className="text-red-600 text-sm font-semibold bg-red-50 p-2 rounded">
                                {error}
                            </div>
                        )}
                        <button
                            onClick={handleSignIn}
                            disabled={loading}
                            className="mt-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-none rounded-lg cursor-pointer font-semibold text-base hover:from-blue-600 hover:to-cyan-600 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300">
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>

                    </div>
                </div>
            </div>
        </div>
    );
}