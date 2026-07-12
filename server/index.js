const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeSchema } = require('./db/schema');
const { seedDatabase } = require('./db/seed');

// Initialize database
initializeSchema();
seedDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001'], credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/allocations', require('./routes/allocations'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/audits', require('./routes/audits'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/logs', require('./routes/logs'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 AssetFlow Server running on http://localhost:${PORT}`);
  console.log(`   📋 API: http://localhost:${PORT}/api/health`);
  console.log(`   🔑 Admin: admin@assetflow.com / admin123\n`);
});
