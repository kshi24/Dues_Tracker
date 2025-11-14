import React, { useState } from 'react'
import { data, useNavigate } from 'react-router-dom';
import { CheckCircle, DollarSign, Calendar, CreditCard, ArchiveIcon, Bell } from 'lucide-react';
import './Dashboard.css'

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

    const sendReminder = (memberName) => {
        // API call to the backend
    }

    const sendBulkReminders = () => {
        const overdueMembers = members.filter(member => member.status === 'overdue')
        overdueMembers.forEach(member => {
            sendReminder(member.name);
        });
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

    return (
        <div className="min-h-screen w-full bg-gradient-to-r from-slate-100 to-slate-200 p-10 absolute top-0 left-0">
            <h1 className='font-bold text-3xl mb-2'>Admin Dashboard</h1>
            <p className='text-gray-500 text-lg mb-5'>Manage member dues and track payments</p>

            <div className='flex flex-col md:flex-row gap-4 mb-5'>
                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="font-bold text-lg">{stats.totalMembers}</h1>
                    <p className='text-gray-500'>Active Members</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="font-bold text-lg">{stats.paidMembers}</h1>
                    <p className='text-gray-500'>Paid Members</p>
                </div>

                <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6">
                    <h1 className="font-bold text-lg">{stats.unpaidMembers}</h1>
                    <p className='text-gray-500'>Unpaid Members</p>
                </div>

            </div>

            <h1 className='font-bold text-3xl mb-2'>Members</h1>
            <div className='flex-1'>
                <input type="text" placeholder="Search members..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-lg mb-4 mr-4" />
                <button className='p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition cursor-pointer' onClick={sendBulkReminders}>Send Bulk Reminders</button>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">MEMBER</th>
                            <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">CLASS</th>
                            <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">AMOUNT</th>
                            <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500">STATUS</th>
                            <th className="px-6 py-4 text-left text-xs font-semi-bold text-gray-500 w-48"></th>
                        </tr>
                    </thead>
                    <tbody className='bg-white'>
                        {filteredMembers.map((member) => (
                            <tr className='border-b border-gray-200 hover:bg-gray-50' key={member.id}>
                                <td className="px-6 py-4 font-semibold">{member.name}</td>
                                <td className="px-6 py-4 text-gray-400">{member.class}</td>
                                <td className="px-6 py-4 font-semibold">${member.amount}</td>
                                <td className="px-6 py-4">
                                    <span className={`px-3 py-1 rounded-full text-base font-semibold capitalize inline-block ${getStatusColor(member.status)}`}>
                                        {member.status}
                                    </span>

                                </td>
                                <td className="px-6 py-4 flex items-center gap-3">

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
                                        className="p-2 cursor-pointer bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                                    >
                                        <Bell size={24} color="#ffffffff" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

        </div>

    );
}
