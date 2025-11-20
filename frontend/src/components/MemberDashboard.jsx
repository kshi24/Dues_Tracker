import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Calendar, CreditCard } from 'lucide-react';
import '../styles.css'

export default function MemberDashboard() {
    const navigate = useNavigate();
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Get current user from localStorage
        const currentUser = localStorage.getItem('currentUser');
        
        if (!currentUser) {
            navigate('/');
            return;
        }

        try {
            const userData = JSON.parse(currentUser);
            
            // Fetch latest member data from backend
            fetch(`http://localhost:8000/api/members/${userData.id}`)
                .then(res => res.json())
                .then(data => {
                    setMember(data);
                    setLoading(false);
                })
                .catch(err => {
                    console.error('Error fetching member data:', err);
                    setError('Unable to load your data');
                    setLoading(false);
                });
        } catch (err) {
            console.error('Error parsing user data:', err);
            navigate('/');
        }
    }, [navigate]);

    const handleSquare = () => {
        window.open('https://squareup.com/us/en', '_blank');
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-r from-blue-200 to-cyan-200 flex items-center justify-center">
                <div className="text-2xl font-bold text-gray-700">Loading...</div>
            </div>
        );
    }

    if (error || !member) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-r from-blue-200 to-cyan-200 flex items-center justify-center">
                <div className="bg-white rounded-xl p-8 shadow-lg">
                    <div className="text-xl font-bold text-red-600 mb-4">{error || 'Error loading data'}</div>
                    <button 
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                        Back to Sign In
                    </button>
                </div>
            </div>
        );
    }

    const amountDue = member.dues_amount - member.amount_paid;
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="min-h-screen w-full bg-gradient-to-r from-blue-200 to-cyan-200 p-15 absolute top-0 left-0">
            <div className="mx-auto rounded-xl bg-white drop-shadow-lg p-6 mb-5">
                <h1 className='font-bold text-2xl mb-2'>Welcome back, {member.name}!</h1>
                <p className="text-gray-500">Here's your membership overview</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-5">
                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <CheckCircle size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>MEMBERSHIP CLASS</p>
                    </div>
                    <p className="font-bold text-2xl">{member.role}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <Calendar size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>PAYMENT STATUS</p>
                    </div>
                    <p className={`font-bold text-2xl ${
                        member.payment_status === 'Paid' ? 'text-green-500' :
                        member.payment_status === 'Overdue' ? 'text-red-500' :
                        'text-yellow-500'
                    }`}>
                        {member.payment_status}
                    </p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <DollarSign size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>AMOUNT DUE</p>
                    </div>
                    <p className="font-bold text-2xl text-green-500">
                        ${amountDue.toFixed(2)}
                    </p>
                </div>
            </div>

            <div className="rounded-xl bg-white drop-shadow-lg p-6 mb-5">
                <h1 className='font-bold text-2xl mb-2'>Payment Details</h1>
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <p className="text-gray-500 text-sm">Total Dues</p>
                        <p className="font-bold text-lg">${member.dues_amount.toFixed(2)}</p>
                    </div>
                    <div>
                        <p className="text-gray-500 text-sm">Amount Paid</p>
                        <p className="font-bold text-lg text-green-600">${member.amount_paid.toFixed(2)}</p>
                    </div>
                </div>

                <p className="text-gray-500 text-base mb-4">
                    Keep your membership active by making secure payments through Square. All transactions are encrypted and protected.
                </p>

                <div className="flex mt-4 mb-1">
                    <button 
                        className="flex gap-2 mt-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-none rounded-lg cursor-pointer font-semibold text-base hover:from-blue-600 hover:to-cyan-600 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300" 
                        onClick={handleSquare}
                    >
                        <CreditCard size={24} color="#ffffffff" />
                        Pay with Square
                    </button>
                </div>
            </div>

            <div className='mx-auto bg-white/20 rounded-xl p-6 text-center'>
                <p className='text-gray-500 text-base'>Questions? Contact the Treasurer via Slack!</p>
            </div>
        </div>
    );
}