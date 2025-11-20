import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Calendar, CreditCard, ArchiveIcon, Bell } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles.css'

export default function AdminDashboard() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        // Check if user is admin
        const currentUser = localStorage.getItem('currentUser');
        if (!currentUser) {
            navigate('/');
            return;
        }

        const userData = JSON.parse(currentUser);
        if (userData.role !== 'Treasurer' && userData.role !== 'Admin') {
            navigate('/dashboard');
            return;
        }

        fetchMembers();
    }, [navigate]);

    const fetchMembers = async () => {
        try {
            const response = await fetch('http://localhost:8000/api/members');
            const data = await response.json();
            setMembers(data);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching members:', error);
            setLoading(false);
        }
    };

    const stats = {
        totalMembers: members.length,
        paidMembers: members.filter(member => member.payment_status === 'Paid').length,
        unpaidMembers: members.length - members.filter(member => member.payment_status === 'Paid').length,
    };

    const filteredMembers = members.filter((member) => 
        member.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sendReminder = async (memberId) => {
        try {
            const response = await fetch(`http://localhost:8000/api/reminders/individual/${memberId}`, {
                method: 'POST'
            });
            const result = await response.json();
            if (result.success) {
                alert('Reminder sent successfully!');
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
            alert('Failed to send reminder');
        }
    };

    const sendBulkReminders = async () => {
        setSending(true);
        try {
            const response = await fetch('http://localhost:8000/api/reminders/bulk', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    send_to_all_unpaid: true
                })
            });
            const result = await response.json();
            alert(`Reminders sent to ${result.total_sent} members!`);
        } catch (error) {
            console.error('Error sending bulk reminders:', error);
            alert('Failed to send bulk reminders');
        } finally {
            setSending(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'paid': return 'text-green-600 bg-green-50';
            case 'overdue': return 'text-red-600 bg-red-50';
            case 'pending': return 'text-yellow-600 bg-yellow-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const updateStatus = async (memberId, newStatus) => {
        try {
            const response = await fetch(`http://localhost:8000/api/members/${memberId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    payment_status: newStatus
                })
            });
            
            if (response.ok) {
                // Refresh members list
                fetchMembers();
            }
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        }
    };

    // Calculate financial data from members
    const totalExpected = members.reduce((sum, m) => sum + m.dues_amount, 0);
    const totalCollected = members.reduce((sum, m) => sum + m.amount_paid, 0);
    const outstanding = totalExpected - totalCollected;

    const [financialData] = useState({
        totalIncome: totalCollected,
        totalExpenses: 5200,
        budget: 12000,
        monthlyData: [
            { month: 'Aug', income: 1200, expenses: 800 },
            { month: 'Sep', income: 1800, expenses: 1100 },
            { month: 'Oct', income: 2100, expenses: 1300 },
            { month: 'Nov', income: 1560, expenses: 1200 },
            { month: 'Dec', income: 1800, expenses: 800 },
        ]
    });

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-r from-slate-100 to-slate-200 flex items-center justify-center">
                <div className="text-2xl font-bold text-gray-700">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen w-full bg-gradient-to-r from-slate-100 to-slate-200 p-10 absolute top-0 left-0">
            <h1 className='font-bold text-3xl mb-2'>Admin Dashboard</h1>
            <p className='text-gray-500 text-lg mb-5'>Manage member dues and track payments</p>
            
            <div className='flex flex-col md:flex-row gap-4 mb-5'>
                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <p className='text-gray-500 text-sm'>Active Members</p>
                    <h1 className="font-bold text-2xl">{stats.totalMembers}</h1>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <p className='text-gray-500 text-sm'>Paid Members</p>
                    <h1 className="font-bold text-2xl">{stats.paidMembers}</h1>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <p className='text-gray-500 text-sm'>Unpaid Members</p>
                    <h1 className="font-bold text-2xl">{stats.unpaidMembers}</h1>
                </div>
            </div>

            <h1 className='font-bold text-2xl mb-5'>Financial Overview</h1>

            <div className='flex flex-col md:flex-row gap-4 mb-5'>
                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <p className="text-gray-500 text-sm">Total Expected</p>
                    <h1 className='font-bold text-2xl text-blue-500'>${totalExpected.toFixed(2)}</h1>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="text-gray-500 text-sm">Total Collected</h1>
                    <p className='font-bold text-2xl text-green-500'>${totalCollected.toFixed(2)}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="text-gray-500 text-sm">Outstanding</h1>
                    <p className='font-bold text-2xl text-red-500'>${outstanding.toFixed(2)}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="text-gray-500 text-sm">Budget Remaining</h1>
                    <p className='font-bold text-2xl text-purple-500'>${(financialData.budget - financialData.totalExpenses).toLocaleString()}</p>
                </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6'>
                <div className='bg-white shadow-lg rounded-xl p-6'>
                    <h3 className='font-bold text-xl mb-4 text-gray-800'>Income vs Expenses</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={financialData.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="income"
                                stroke="#10b981"
                                strokeWidth={3}
                                name="Income"
                                dot={{ fill: '#10b981', r: 4 }}
                            />
                            <Line
                                type="monotone"
                                dataKey="expenses"
                                stroke="#ef4444"
                                strokeWidth={3}
                                name="Expenses"
                                dot={{ fill: '#ef4444', r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className='font-bold text-xl mb-4 text-gray-800'>Monthly Breakdown</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={financialData.monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis dataKey="month" stroke="#6b7280" />
                            <YAxis stroke="#6b7280" />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="income" fill="#10b981" name="Income" radius={[8, 8, 0, 0]} />
                            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[8, 8, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <h1 className='font-bold text-3xl mb-2'>Members</h1>
            <div className='flex-1 mb-4'>
                <input 
                    type="text" 
                    placeholder="Search members..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="px-4 py-2 border border-gray-300 rounded-lg mb-4 mr-4" 
                />
                <button 
                    className='px-3 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition cursor-pointer disabled:opacity-50' 
                    onClick={sendBulkReminders}
                    disabled={sending}
                >
                    {sending ? 'Sending...' : 'Send Bulk Reminders'}
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">MEMBER</th>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">CLASS</th>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">AMOUNT DUE</th>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">PAID</th>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-gray-200'>
                            {filteredMembers.map((member) => (
                                <tr className='border-b border-gray-200 hover:bg-gray-50' key={member.id}>
                                    <td className="px-6 py-4 font-semibold">{member.name}</td>
                                    <td className="px-6 py-4 text-gray-400">{member.role}</td>
                                    <td className="px-6 py-4 font-semibold">${(member.dues_amount - member.amount_paid).toFixed(2)}</td>
                                    <td className="px-6 py-4 font-semibold text-green-600">${member.amount_paid.toFixed(2)}</td>
                                    <td className='px-6 py-4'>
                                        <div className="flex items-center gap-3">
                                            <select
                                                value={member.payment_status}
                                                onChange={(e) => updateStatus(member.id, e.target.value)}
                                                className={`p-2 rounded-lg text-sm font-semibold cursor-pointer capitalize w-32 ${getStatusColor(member.payment_status)}`}
                                            >
                                                <option value="Paid">Paid</option>
                                                <option value="Pending">Pending</option>
                                                <option value="Overdue">Overdue</option>
                                            </select>
                                            <button
                                                onClick={() => sendReminder(member.id)}
                                                className="p-2 cursor-pointer bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition shadow-sm"
                                            >
                                                <Bell size={20} color="#ffffffff" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}