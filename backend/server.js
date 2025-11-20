// Minimal Express server to serve the frontend and provide a tiny API
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static frontend files from frontend/views
const staticPath = path.join(__dirname, '..', 'frontend', 'views');
app.use(express.static(staticPath));

// Simple API route to show backend is running
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'TAMID Dues Tracker API (minimal)'});
});

// All other routes -> serve index.html so client-side routing (if added) works
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


