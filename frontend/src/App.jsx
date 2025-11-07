import React, { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('checking...')

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(j => setStatus(`${j.status} — ${j.message}`))
      .catch(() => setStatus('unreachable'))
  }, [])

  return (
    <div className="container">
      <h1>TAMID Dues Tracker (React + FastAPI)</h1>
      <p>Backend status: <strong>{status}</strong></p>
      <p>Start building your components under <code>frontend/src/</code>.</p>
    </div>
  )
}
