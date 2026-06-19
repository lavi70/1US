import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

import shopsRouter from './routes/shops.js';
import authRouter from './routes/auth.js';
import listingsRouter from './routes/listings.js';
import researchRouter from './routes/research.js';
import settingsRouter from './routes/settings.js';
import './db/database.js'; // Initialize DB

const app = express();
const PORT = process.env.PORT || 3001;

// Uploads dir
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global rate limit
app.use('/api', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use('/api/shops', shopsRouter);
app.use('/api/auth', authRouter);
app.use('/api/listings', listingsRouter);
app.use('/api/research', researchRouter);
app.use('/api/settings', settingsRouter);
app.use('/uploads', express.static(uploadsDir));

app.get('/api/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
