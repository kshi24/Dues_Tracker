import React, { useEffect, useState } from 'react'
import { data, useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Calendar, CreditCard, ArchiveIcon, Bell } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import '../styles.css'

const API_URL = 'http://localhost:8000';


export default function AdminDashboard() {
    let status = "None"
    const [searchTerm, setSearchTerm] = useState('');


    const [members, setMembers] = useState([]);

    const [stats, setStats] = useState({
        totalMembers: 0,
        paidMembers: 0,
        unpaidMembers: 0
    });


    const [financialData, setFinancialData] = useState({
        totalIncome: 0,
        totalExpenses: 0,
        budget: 12000,
        monthlyData: []
    });


    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchMembers();
        fetchStats();
    }, []);

    const fetchMembers = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_URL}/api/members`)

            if (!response.ok) {
                throw new Error('Failed to fetch members');
            }
            const data = await response.json();
            setMembers(data);
            setError(null);
        }
        catch (err) {
            console.error('Error fetching members:', err);
            setError('Failed to load members. Make sure the backend is running.');
        }
        finally {
            setLoading(false);
        }
    }

    const fetchStats = async () => {
        try {
            const response = await fetch(`${API_URL}/api/stats`);

            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }

            const data = await response.json();

            setStats({
                totalMembers: data.total_members,
                paidMembers: data.paid_members,
                unpaidMembers: data.pending_members + data.overdue_members
            });

            setFinancialData(prev => ({
                ...prev,
                totalIncome: data.total_collected,
                totalExpenses: 0,
                budget: 12000
            }));
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const filteredMembers = members.filter((member) => member.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const sendReminder = async (memberName) => {
        try {
            const response = await fetch('http://localhost:8000/api/reminders/individual/1', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            const data = await response.json();
            
            if (response.ok) {
                alert(`✅ Reminder sent to ${memberName}`);
            } else {
                alert(`❌ Failed to send reminder: ${data.detail || data.message}`);
            }
        } catch (err) {
            console.error('Error sending reminder:', err);
            alert('❌ Connection error. Make sure backend is running on http://localhost:8000');
        }
    }

    const sendBulkReminders = async () => {
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
            const data = await response.json();
            
            if (response.ok) {
                alert(`✅ Sent reminders to ${data.successful} members!`);
            } else {
                alert(`❌ Failed to send bulk reminders: ${data.detail}`);
            }
        } catch (err) {
            console.error('Error sending bulk reminders:', err);
            alert('❌ Connection error. Make sure backend is running on http://localhost:8000');
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'paid': return 'text-green-600 bg-green-50';
            case 'overdue': return 'text-red-600 bg-red-50';
            case 'pending': return 'text-yellow-600 bg-yellow-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const updateStatus = async (memberId, newStatus) => {
        try {
            const response = await fetch(`${API_URL}/api/members/${memberId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    payment_status: newStatus
                })
            });

            if (response.ok) {
                const updatedMember = await response.json();

                setMembers(prevMembers =>
                    prevMembers.map(member =>
                        member.id === memberId ? updatedMember : member
                    )
                );

                fetchStats();
            } else {
                alert('Failed to update status');
            }
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status. Check console for details.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-r from-slate-100 to-slate-200 p-10 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
                    <p className="text-gray-600 text-lg">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen w-full bg-gradient-to-r from-slate-100 to-slate-200 p-10 flex items-center justify-center">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
                    <h2 className="text-red-800 font-bold text-xl mb-2">Connection Error</h2>
                    <p className="text-red-600 mb-4">{error}</p>
                    <button
                        onClick={fetchMembers}
                        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                    >
                        Retry
                    </button>
                </div>
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

            <h1 className='font-bold text-2xl mb-5'>Finanical Overview</h1>

            <div className='flex flex-col md:flex-row gap-4 mb-5'>
                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <p className="text-gray-500 text-sm">Total Income</p>
                    <h1 className='font-bold text-2xl text-green-500'>${financialData.totalIncome.toLocaleString()}</h1>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="text-gray-500 text-sm">Total Expenses</h1>
                    <p className='font-bold text-2xl text-red-500'>${financialData.totalExpenses.toLocaleString()}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="text-gray-500 text-sm">Net Income</h1>
                    <p className='font-bold text-2xl text-blue-500'>${(financialData.totalIncome - financialData.totalExpenses).toLocaleString()}</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="text-gray-500 text-sm">Budget Remaning</h1>
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
            <div className='flex-1'>
                <input type="text" placeholder="Search members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg mb-4 mr-4" />
                <button className='px-3 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition cursor-pointer' onClick={sendBulkReminders}>Send Bulk Reminders</button>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b-2 border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">MEMBER</th>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">CLASS</th>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">AMOUNT</th>
                                <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">ACTIONS</th>
                            </tr>
                        </thead>
                        <tbody className='divide-y divide-gray-200'>
                            {filteredMembers.map((member) => (
                                <tr className='border-b border-gray-200 hover:bg-gray-50' key={member.id}>
                                    <td className="px-6 py-4 font-semibold">{member.name}</td>
                                    <td className="px-6 py-4 text-gray-400">{member.class}</td>
                                    <td className="px-6 py-4 font-semibold">${member.amount}</td>
                                    <td className='px-6 py-4'>
                                        <div className="flex items-center gap-3">

                                            <select
                                                value={member.status}
                                                onChange={(e) => updateStatus(member.id, e.target.value)}
                                                className={`p-2 rounded-lg text-sm font-semibold cursor-pointer capitalize w-32 ${getStatusColor(member.status)}`}
                                            >
                                                <option value="paid">Paid</option>
                                                <option value="pending">Pending</option>
                                                <option value="overdue">Overdue</option>
                                            </select>
                                            <button
                                                onClick={() => sendReminder(member.name)}
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
