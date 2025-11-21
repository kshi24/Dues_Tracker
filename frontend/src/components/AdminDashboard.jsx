import React, { useState } from 'react'
import { data, useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Calendar, CreditCard, ArchiveIcon, Bell } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

import '../styles.css'

export default function AdminDashboard() {
    let status = "None"
    const [searchTerm, setSearchTerm] = useState('');


    // sample data needs to be replaced
    const [members, setMembers] = useState([
        { id: 1, name: 'Alex Johnson', class: 'Tav', amount: 180, status: 'paid' },
        { id: 2, name: 'Sarah Chen', class: 'Shin', dueDate: '2025-11-20', amount: 180, status: 'paid' },
        { id: 3, name: 'Michael Brown', class: 'Tav', dueDate: '2025-10-30', amount: 180, status: 'overdue' },
        { id: 4, name: 'Emily Davis', class: 'Shin', dueDate: '2025-12-01', amount: 150, status: 'paid' },
        { id: 5, name: 'James Wilson', class: 'Kuf', dueDate: '2025-11-10', amount: 180, status: 'overdue' },
        { id: 6, name: 'Lisa Anderson', class: 'Tav', dueDate: '2025-12-20', amount: 180, status: 'pending' },
    ]);

    const stats = {
        totalMembers: members.length,
        paidMembers: members.filter(member => member.status === 'paid').length,
        unpaidMembers: members.length - members.filter(member => member.status === 'paid').length,
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
    const updateStatus = (memberId, newStatus) => {
        const updatedMembers = members.map(member => {
            if (member.id === memberId) {
                return { ...member, status: newStatus };
            }
            return member;
        });
        setMembers(updatedMembers);
    };

    const [financialData] = useState({
        totalIncome: 8460,
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
