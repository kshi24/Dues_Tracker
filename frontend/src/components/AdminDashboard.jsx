import React, { useEffect, useState } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import '../styles.css';
import TransactionsList from './TransactionsList';

const API_URL = 'http://localhost:8000';

export default function AdminDashboard() {
    // Core data state
    const [members, setMembers] = useState([]);
    const [classes, setClasses] = useState([]);
    const [dueDateRecords, setDueDateRecords] = useState([]);
    const [stats, setStats] = useState({ totalMembers: 0, paidMembers: 0, unpaidMembers: 0 });
    const [financialData, setFinancialData] = useState({ totalIncome: 0, totalExpenses: 0, netIncome: 0, budgetRemaining: 0, monthlyData: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('member'); // member | class | dueDate
    const [searchTerm, setSearchTerm] = useState('');
    const [showTransactions, setShowTransactions] = useState(true);

    // Form state
    const [newMemberName, setNewMemberName] = useState('');
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberClass, setNewMemberClass] = useState('');
    const [addError, setAddError] = useState(null);
    const [addLoading, setAddLoading] = useState(false);

    const [className, setClassName] = useState('');
    const [classDues, setClassDues] = useState('180');
    const [classError, setClassError] = useState(null);
    const [classLoading, setClassLoading] = useState(false);

    const [dueDateValue, setDueDateValue] = useState('');
    const [dueDateClassesSelected, setDueDateClassesSelected] = useState([]);
    const [dueDateError, setDueDateError] = useState(null);
    const [dueDateSaving, setDueDateSaving] = useState(false);

    // Permissions
    const role = (localStorage.getItem('auth_role') || '').toLowerCase();
    const canManage = ['admin', 'treasurer'].includes(role);

    const authToken = () => localStorage.getItem('auth_token');
    const authHeaders = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken()}` });

    useEffect(() => {
        fetchMembers();
        fetchStats();
        fetchClasses();
        fetchMonthly();
        loadDueDates();
    }, []);

    // Fetchers
    const fetchMembers = async () => {
        try {
            setLoading(true);
            const r = await fetch(`${API_URL}/api/members`);
            if (!r.ok) throw new Error('Failed members fetch');
            setMembers(await r.json());
            setError(null);
        } catch (e) {
            setError('Failed to load members – is backend running?');
        } finally { setLoading(false); }
    };

    const fetchStats = async () => {
        try {
            const r = await fetch(`${API_URL}/api/stats`);
            if (!r.ok) return;
            const d = await r.json();
            setStats({ totalMembers: d.total_members, paidMembers: d.paid_members, unpaidMembers: d.pending_members + d.overdue_members });
            setFinancialData(prev => ({
                ...prev,
                totalIncome: Number(d.total_collected).toFixed(2),
                totalExpenses: Number(d.total_expenses).toFixed(2),
                netIncome: Number(d.net_income).toFixed(2),
                budgetRemaining: Number(d.budget_remaining).toFixed(2)
            }));
        } catch {}
    };

    const fetchMonthly = async () => {
        try {
            const r = await fetch(`${API_URL}/api/stats/monthly`);
            if (!r.ok) return;
            const d = await r.json();
            const rounded = (d.months || []).map(m => ({ ...m, income: Number(m.income).toFixed(2), expenses: Number(m.expenses).toFixed(2) }));
            setFinancialData(prev => ({ ...prev, monthlyData: rounded }));
        } catch {}
    };

    const fetchClasses = async () => {
        try {
            const r = await fetch(`${API_URL}/api/classes`);
            if (r.ok) setClasses(await r.json());
        } catch {}
    };

    const loadDueDates = async () => {
        try {
            const r = await fetch(`${API_URL}/api/due-dates`);
            if (r.ok) setDueDateRecords(await r.json());
        } catch {}
    };

    // Data mutation actions
    const seedDemoData = async () => {
        try {
            const resp = await fetch(`${API_URL}/api/sample/seed`, { method: 'POST', headers: authHeaders() });
            const data = await resp.json();
            if (!resp.ok) return alert(`Seed failed: ${data.detail || resp.status}`);
            alert(`Seeded ${data.members_created} members, ${data.classes_created} classes.`);
            fetchMembers(); fetchStats(); fetchMonthly(); fetchClasses(); loadDueDates();
        } catch (e) { alert(e.message); }
    };
    const resetDemoData = async () => {
        if (!window.confirm('Undo demo data? This clears members/classes/transactions/expenses/due-dates (keeps original admin). Continue?')) return;
        try {
            const resp = await fetch(`${API_URL}/api/sample/reset`, { method: 'POST', headers: authHeaders() });
            const data = await resp.json();
            if (!resp.ok) return alert(`Reset failed: ${data.detail || resp.status}`);
            alert(`Removed ${data.members_removed} members, ${data.classes_removed} classes, ${data.transactions_removed} tx, ${data.expenses_removed} expenses, ${data.due_dates_removed} due-dates.`);
            fetchMembers(); fetchStats(); fetchMonthly(); fetchClasses(); loadDueDates();
        } catch (e) { alert(e.message); }
    };

    const handleAddMember = async () => {
        setAddError(null); setAddLoading(true);
        try {
            const resp = await fetch(`${API_URL}/api/auth/add-member`, { method:'POST', headers: authHeaders(), body: JSON.stringify({ name: newMemberName, email: newMemberEmail, member_class: newMemberClass || null })});
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Add failed');
            setNewMemberName(''); setNewMemberEmail(''); setNewMemberClass('');
            fetchMembers(); fetchStats();
        } catch (e) { setAddError(e.message); } finally { setAddLoading(false); }
    };

    const handleCreateClass = async () => {
        setClassError(null); setClassLoading(true);
        try {
            const resp = await fetch(`${API_URL}/api/classes`, { method:'POST', headers: authHeaders(), body: JSON.stringify({ name: className, dues_amount: parseFloat(classDues) })});
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Create failed');
            setClassName(''); setClassDues('180'); fetchClasses(); fetchMembers(); fetchStats();
        } catch (e) { setClassError(e.message); } finally { setClassLoading(false); }
    };

    const handleDeleteClass = async (id) => {
        try {
            const resp = await fetch(`${API_URL}/api/classes/${id}`, { method:'DELETE', headers: authHeaders() });
            const data = await resp.json();
            if (!resp.ok) return alert(data.detail || 'Delete failed');
            fetchClasses();
        } catch (e) { alert(e.message); }
    };

    const saveDueDate = async () => {
        if (!dueDateValue || dueDateClassesSelected.length === 0) { setDueDateError('Select date & at least one class'); return; }
        setDueDateSaving(true); setDueDateError(null);
        try {
            const payload = { due_date: `${dueDateValue}T00:00:00`, class_names: dueDateClassesSelected };
            const resp = await fetch(`${API_URL}/api/due-dates`, { method:'POST', headers: authHeaders(), body: JSON.stringify(payload) });
            const data = await resp.json();
            if (!resp.ok) throw new Error(data.detail || 'Failed');
            setDueDateValue(''); setDueDateClassesSelected([]);
            loadDueDates(); fetchMembers(); fetchStats();
        } catch (e) { setDueDateError(e.message); } finally { setDueDateSaving(false); }
    };

    const deleteMember = async (id, name) => {
        if (!window.confirm(`Delete member ${name}?`)) return;
        try {
            const resp = await fetch(`${API_URL}/api/members/${id}`, { method:'DELETE', headers: authHeaders() });
            const data = await resp.json();
            if (!resp.ok) return alert(data.detail || 'Delete failed');
            setMembers(prev => prev.filter(m => m.id !== id)); fetchStats();
        } catch (e) { alert(e.message); }
    };

    const sendReminder = async (member) => {
        try {
            const r = await fetch(`${API_URL}/api/reminders/individual/${member.id}`, { method:'POST', headers:{'Content-Type':'application/json'} });
            const d = await r.json();
            if (!r.ok) return alert(d.detail || 'Reminder failed');
            alert(`Reminder sent to ${member.name}`);
        } catch (e) { alert(e.message); }
    };

    const filteredMembers = members.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()));

    // Styling helper for status badge
    const getStatusBadge = (s) => {
        switch ((s||'').toLowerCase()) {
            case 'paid': return 'bg-green-100 text-green-700 border-green-300';
            case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            case 'overdue': return 'bg-red-100 text-red-700 border-red-300';
            default: return 'bg-gray-100 text-gray-600 border-gray-300';
        }
    };

    if (loading) return (<div className="min-h-screen flex items-center justify-center">Loading...</div>);
    if (error) return (<div className="min-h-screen flex items-center justify-center text-red-600">{error}</div>);

    return (
    <div className="min-h-screen w-full bg-linear-to-r from-slate-100 to-slate-200 p-6 md:p-8 lg:p-10">
            {/* Header & Actions */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className='font-bold text-3xl mb-1'>Dues Management</h1>
                    <p className='text-gray-500 text-sm'>Unified view for members, classes, due dates & finances.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={seedDemoData} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Seed Demo</button>
                    <button onClick={fetchStats} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Refresh Stats</button>
                    <button onClick={fetchMonthly} className="px-3 py-2 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">Refresh Charts</button>
                    {canManage && <button onClick={resetDemoData} className="px-3 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700">Undo Demo</button>}
                    <button onClick={() => { localStorage.clear(); window.location.href='/' }} className="px-3 py-2 bg-red-600 text-white text-xs rounded hover:bg-red-700">Logout</button>
                </div>
            </div>

            {/* Management Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
                {/* Tabs & Forms */}
                <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col">
                    <div className="flex gap-2 mb-4">
                        {['member','class','dueDate'].map(t => (
                            <button key={t} onClick={()=>setActiveTab(t)} className={`px-3 py-2 rounded text-xs font-semibold ${activeTab===t ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{t==='member'?'Add Member': t==='class'?'Add Class':'Add Due Date'}</button>
                        ))}
                    </div>
                    {!canManage && <p className="text-xs text-red-600">You need Admin or Treasurer role to manage data.</p>}
                    {canManage && activeTab==='member' && (
                        <div className="flex flex-col gap-3">
                            <input value={newMemberName} onChange={(e)=>setNewMemberName(e.target.value)} placeholder="Name" className="px-3 py-2 border rounded" />
                            <input value={newMemberEmail} onChange={(e)=>setNewMemberEmail(e.target.value)} placeholder="Email" type="email" className="px-3 py-2 border rounded" />
                            <select value={newMemberClass} onChange={(e)=>setNewMemberClass(e.target.value)} className="px-3 py-2 border rounded">
                                <option value="">Select Class (optional)</option>
                                {classes.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                            {addError && <div className="text-red-600 text-xs">{addError}</div>}
                            <button onClick={handleAddMember} disabled={addLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{addLoading?'Adding...':'Add Member'}</button>
                        </div>
                    )}
                    {canManage && activeTab==='class' && (
                        <div className="flex flex-col gap-3">
                            <input value={className} onChange={(e)=>setClassName(e.target.value)} placeholder="Class Name" className="px-3 py-2 border rounded" />
                            <input value={classDues} onChange={(e)=>setClassDues(e.target.value)} placeholder="Default Dues Amount" className="px-3 py-2 border rounded" />
                            {classError && <div className="text-red-600 text-xs">{classError}</div>}
                            <button onClick={handleCreateClass} disabled={classLoading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{classLoading?'Saving...':'Save Class'}</button>
                        </div>
                    )}
                    {canManage && activeTab==='dueDate' && (
                        <div className="flex flex-col gap-3">
                            <input type="date" value={dueDateValue} onChange={(e)=>setDueDateValue(e.target.value)} className="px-3 py-2 border rounded" />
                            <div className="flex flex-wrap gap-2">
                                {classes.map(c => (
                                    <button key={c.id} type="button" onClick={()=>setDueDateClassesSelected(prev => prev.includes(c.name)? prev.filter(n=>n!==c.name): [...prev,c.name])} className={`px-3 py-1 rounded text-xs border ${dueDateClassesSelected.includes(c.name)?'bg-blue-600 text-white':'bg-gray-100 hover:bg-gray-200'}`}>{c.name}</button>
                                ))}
                            </div>
                            {dueDateError && <div className="text-red-600 text-xs">{dueDateError}</div>}
                            <button onClick={saveDueDate} disabled={dueDateSaving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{dueDateSaving?'Saving...':'Set Due Date'}</button>
                        </div>
                    )}
                </div>
                {/* Dynamic List Pane */}
                <div className="bg-white rounded-xl shadow-lg p-6">
                    {activeTab==='member' && (
                        <div>
                            <h3 className='font-bold text-lg mb-3'>Members ({members.length})</h3>
                            <input type="text" placeholder="Search members..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="px-3 py-2 border rounded w-full mb-3" />
                            <div className="max-h-72 overflow-y-auto divide-y text-sm">
                                {filteredMembers.map(m => (
                                    <div key={m.id} className="py-2 flex items-center justify-between">
                                        <div className="flex flex-col">
                                            <span className="font-medium">{m.name} <span className="text-xs text-gray-400">({m.role}{m.member_class?` • ${m.member_class}`:''})</span></span>
                                            <span className="text-xs text-gray-500">Paid ${m.amount_paid.toFixed(2)} / ${m.dues_amount.toFixed(2)} ({Math.min(100, Math.round((m.amount_paid / (m.dues_amount || 1)) * 100))}%)</span>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getStatusBadge(m.payment_status)}`}>{m.payment_status}</span>
                                                <span className="text-[10px] text-gray-400">Outstanding: ${(m.dues_amount - m.amount_paid).toFixed(2)}</span>
                                                {m.due_date && <span className="text-[10px] text-gray-400">Due {new Date(m.due_date).toLocaleDateString()}</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={()=>sendReminder(m)} className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">Remind</button>
                                            <button onClick={()=>deleteMember(m.id,m.name)} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Del</button>
                                        </div>
                                    </div>
                                ))}
                                {filteredMembers.length===0 && <p className="text-gray-500 text-xs py-2">No matches.</p>}
                            </div>
                        </div>
                    )}
                    {activeTab==='class' && (
                        <div>
                            <h3 className='font-bold text-lg mb-3'>Classes ({classes.length})</h3>
                            <div className="max-h-72 overflow-y-auto divide-y text-sm">
                                {classes.map(c => (
                                    <div key={c.id} className="py-2 flex items-center justify-between">
                                        <span className="font-medium">{c.name}</span>
                                        <div className="flex items-center gap-3">
                                            <span className="text-xs text-gray-500">${c.dues_amount}</span>
                                            <button onClick={()=>handleDeleteClass(c.id)} className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700">Delete</button>
                                        </div>
                                    </div>
                                ))}
                                {classes.length===0 && <p className="text-gray-500 text-xs py-2">No classes.</p>}
                            </div>
                        </div>
                    )}
                    {activeTab==='dueDate' && (
                        <div>
                            <h3 className='font-bold text-lg mb-3'>Due Date Records ({dueDateRecords.length})</h3>
                            <div className="max-h-72 overflow-y-auto divide-y text-sm">
                                {dueDateRecords.map(r => (
                                    <div key={r.id} className="py-2 flex items-center justify-between">
                                        <div>
                                            <div className="font-medium">{new Date(r.due_date).toLocaleDateString()}</div>
                                            <div className="text-xs text-gray-500">{r.class_names.join(', ')}</div>
                                        </div>
                                    </div>
                                ))}
                                {dueDateRecords.length===0 && <p className="text-gray-500 text-xs py-2">No due-date records.</p>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Finances Section */}
            <div className="mb-10">
                <h2 className='font-bold text-2xl mb-4'>Finances</h2>
                <div className='flex flex-col md:flex-row gap-4 mb-5'>
                    <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6"><p className='text-gray-500 text-sm'>Total Members</p><h1 className="font-bold text-2xl">{stats.totalMembers}</h1></div>
                    <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6"><p className='text-gray-500 text-sm'>Paid Members</p><h1 className="font-bold text-2xl">{stats.paidMembers}</h1></div>
                    <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6"><p className='text-gray-500 text-sm'>Unpaid Members</p><h1 className="font-bold text-2xl">{stats.unpaidMembers}</h1></div>
                </div>
                <div className='flex flex-col md:flex-row gap-4 mb-5'>
                    <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6"><p className="text-gray-500 text-sm">Total Income</p><h1 className='font-bold text-2xl text-green-500'>${financialData.totalIncome}</h1></div>
                    <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6"><h1 className="text-gray-500 text-sm">Total Expenses</h1><p className='font-bold text-2xl text-red-500'>${financialData.totalExpenses}</p></div>
                    <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6"><h1 className="text-gray-500 text-sm">Net Income</h1><p className='font-bold text-2xl text-blue-500'>${financialData.netIncome}</p></div>
                    <div className="flex-1 rounded-xl bg-white drop-shadow-lg p-6"><h1 className="text-gray-500 text-sm">Budget Remaining</h1><p className='font-bold text-2xl text-purple-500'>${financialData.budgetRemaining}</p></div>
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
                                <Line type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} name="Income" dot={{ fill: '#10b981', r: 4 }} />
                                <Line type="monotone" dataKey="expenses" stroke="#ef4444" strokeWidth={3} name="Expenses" dot={{ fill: '#ef4444', r: 4 }} />
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
                                <Bar dataKey="income" fill="#10b981" name="Income" radius={[8,8,0,0]} />
                                <Bar dataKey="expenses" fill="#ef4444" name="Expenses" radius={[8,8,0,0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Transactions Section */}
            <div className="mb-6 bg-white rounded-xl shadow-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className='font-bold text-xl'>Transactions</h3>
                    <button onClick={()=>setShowTransactions(s=>!s)} className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700">{showTransactions? 'Hide' : 'Show'}</button>
                </div>
                {showTransactions && <TransactionsList />}
            </div>
        </div>
    );
}

