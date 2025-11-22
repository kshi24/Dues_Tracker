import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:8000';

export default function TransactionsList() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const authToken = () => localStorage.getItem('auth_token');
  const headers = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken()}` });

  const fetchTransactions = async () => {
    setLoading(true); setError(null);
    try {
      const resp = await fetch(`${API_URL}/api/transactions`);
      if (!resp.ok) throw new Error('Failed to load transactions');
      const data = await resp.json();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchTransactions(); }, []);

  const filtered = transactions.filter(tx => {
    const label = tx.display_label || `${tx.payer_name || 'Unknown'} dues ${tx.dues_due_date ? new Date(tx.dues_due_date).toLocaleDateString() : ''}`.trim();
    return label.toLowerCase().includes(search.toLowerCase()) || (tx.payer_name || '').toLowerCase().includes(search.toLowerCase());
  });

  const formatDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mt-8">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-xl">Transactions</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e)=>setSearch(e.target.value)}
            placeholder="Search by name or label..."
            className="px-3 py-2 border rounded text-sm"
          />
          <button
            onClick={() => { setRefreshing(true); fetchTransactions().finally(()=>setRefreshing(false)); }}
            className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            disabled={refreshing}
          >{refreshing ? 'Refreshing...' : 'Refresh'}</button>
        </div>
      </div>
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {!loading && !error && filtered.length === 0 && <p className="text-gray-500 text-sm">No transactions found.</p>}
      {!loading && !error && filtered.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">LABEL</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">PAYER</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">AMOUNT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">METHOD</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">DUE DATE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">TX DATE</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">STATUS</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map(tx => {
                const label = tx.display_label || `${tx.payer_name || 'Unknown'} dues ${tx.dues_due_date ? new Date(tx.dues_due_date).toLocaleDateString() : ''}`.trim();
                return (
                  <tr key={tx.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm font-medium">{label || '—'}</td>
                    <td className="px-4 py-2 text-sm">{tx.payer_name || '—'}</td>
                    <td className="px-4 py-2 text-sm font-semibold">${typeof tx.amount === 'number' ? tx.amount.toFixed(2) : tx.amount}</td>
                    <td className="px-4 py-2 text-xs uppercase tracking-wide">{tx.payment_method || '—'}</td>
                    <td className="px-4 py-2 text-sm">{formatDate(tx.dues_due_date)}</td>
                    <td className="px-4 py-2 text-sm">{formatDate(tx.transaction_date || tx.created_at)}</td>
                    <td className="px-4 py-2">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${tx.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>{tx.status || '—'}</span>
                    </td>
                    <td className="px-4 py-2">
                      {['Admin','Treasurer'].includes(localStorage.getItem('role')) && (
                        <button
                          onClick={async () => {
                            if(!window.confirm('Delete this transaction?')) return;
                            try {
                              const resp = await fetch(`${API_URL}/api/transactions/${tx.id}`, { method: 'DELETE', headers: headers() });
                              if(resp.ok){
                                setTransactions(prev => prev.filter(t=>t.id!==tx.id));
                              } else {
                                const body = await resp.json().catch(()=>({}));
                                alert(body.detail || 'Delete failed');
                              }
                            } catch(e){
                              alert(e.message);
                            }
                          }}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >Delete</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500 mt-3">Transactions persist even after member deletion (member_id detached).</p>
    </div>
  );
}
