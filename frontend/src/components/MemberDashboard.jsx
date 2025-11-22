import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Calendar, CreditCard } from 'lucide-react';
import PaymentModal from './PaymentModal';
import '../styles.css'

export default function MemberDashboard() {
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [member, setMember] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const API_URL = 'http://localhost:8000';
    const memberId = localStorage.getItem('member_id');
    const authToken = localStorage.getItem('auth_token');

    useEffect(() => {
        const fetchMember = async () => {
            if (!memberId) {
                setError('No member id in session');
                setLoading(false);
                return;
            }
            try {
                const resp = await fetch(`${API_URL}/api/members/${memberId}`);
                if (!resp.ok) throw new Error('Failed to load member');
                const data = await resp.json();
                setMember(data);
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchMember();
    }, [memberId]);

    const logout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_role');
        localStorage.removeItem('member_name');
        localStorage.removeItem('member_id');
        window.location.href = '/';
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }
    if (error) {
        return <div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>;
    }

    const name = member.name;
    const member_class = member.member_class || '—';
    const due_date = member.due_date ? new Date(member.due_date).toLocaleDateString() : '—';
    const amount_due = (member.dues_amount - member.amount_paid);

    return (
        <div className="min-h-screen w-full bg-gradient-to-r from-blue-200 to-cyan-200 p-15 absolute top-0 left-0">
            {/* Payment Modal */}
            <PaymentModal 
                isOpen={showPaymentModal}
                onClose={() => setShowPaymentModal(false)}
                memberId={memberId}
                memberName={name}
                amountDue={amount_due}
            />

            <div className="mx-auto rounded-xl bg-white drop-shadow-lg p-6 mb-5">
                <div className="flex justify-between items-start">
                    <h1 className='font-bold text-2xl mb-2'>Welcome back, {name}!</h1>
                    <button onClick={logout} className="text-sm px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600">Logout</button>
                </div>
                <p className="text-gray-500 dark:text-gray-400">Here's your membership overview</p>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-5">

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <CheckCircle size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>MEMBERSHIP CLASS</p>
                    </div>
                    <p className="font-bold text-2xl">{member_class}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <Calendar size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>NEXT DUE DATE</p>
                    </div>
                    <p className="font-bold text-2xl">{due_date}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <div className="flex gap-2">
                        <DollarSign size={24} color="#17406d" />
                        <p className='text-gray-500 text-base mb-2'>AMOUNT DUE</p>
                    </div>
                    <p className="font-bold text-2xl text-green-500">${amount_due.toFixed(2)}</p>
                </div>

            </div>

            <div className="rounded-xl bg-white drop-shadow-lg p-6 mb-5">

                <h1 className='font-bold text-2xl mb-2'>Make a Payment</h1>
                <p className="text-gray-500 text-base">
                    Keep your membership active by making secure payments through Square. All transactions are encrypted and protected.
                </p>

                <div className="flex mt-4 mb-1">
                    <button 
                        className="flex gap-2 mt-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-none rounded-lg cursor-pointer font-semibold text-base hover:from-blue-600 hover:to-cyan-600 hover:shadow-lg hover:scale-105 active:scale-95 transition-all duration-300"
                        onClick={() => setShowPaymentModal(true)}
                    >
                        <CreditCard size={24} color="#ffffffff" />
                        Pay with Square
                    </button>
                </div>

            </div>

            <div className='mx-auto bg-white/20 rounded-xl p-6 text-center'>
                <p className='text-gray-500 text-base'>Questions? Contact Amaey Pandit via Slack!</p>
            </div>
        </div>
    );
}