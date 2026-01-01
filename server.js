const express = require('express');
const cors = require('cors');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
 // Security headers
app.use(cors());   // Allow cross-origin requests


// Basic Test Route
app.get('/api/health', (req, res) => {
  res.json({ status: 'active', message: 'Accounting API is running' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});