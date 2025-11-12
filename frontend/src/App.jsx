import React, { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SignIn from './components/SignIn'
import MemberDashboard from './components/MemberDashboard'
import AdminDashboard from './components/AdminDashboard'

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(j => setStatus(`${j.status} — ${j.message}`))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SignIn />} />
        <Route path="/dashboard" element={<MemberDashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

{/* Commented out for later:
<div className="container">
  <h1>TAMID Dues Tracker (React + FastAPI)</h1>
  <p>Backend status: <strong>{status}</strong></p>
  <p>Start building your components under <code>frontend/src/</code>.</p>
</div>
*/}