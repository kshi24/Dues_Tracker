import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom';
import logo from '../assets/logo.svg'
import '../styles.css'

export default function SignIn() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignIn = async () => {
        setError('');
        setLoading(true);

        try {
            // For now, we'll do simple client-side role detection
            // In production, this should verify against the backend
            
            // Check if email exists in members
            const response = await fetch('http://localhost:8000/api/members');
            const members = await response.json();
            
            const member = members.find(m => m.email === email);
            
            if (!member) {
                setError('Email not found. Please contact the treasurer.');
                setLoading(false);
                return;
            }

            // Store member info in localStorage
            localStorage.setItem('currentUser', JSON.stringify(member));
            
            // Route based on role
            if (member.role === 'Treasurer' || member.role === 'Admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError('Unable to connect to server. Please try again.');
            console.error('Sign in error:', err);
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

                    {error && (
                        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <input
                            type="email"
                            placeholder="you@northeastern.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                        />
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base hover:scale-105 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                        />
                        <button
                            onClick={handleSignIn}
                            disabled={loading}
                            className="mt-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-none rounded-lg cursor-pointer font-semibold text-base hover:from-blue-600 hover:to-cyan-600 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                            {loading ? 'Signing in...' : 'Sign in'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}