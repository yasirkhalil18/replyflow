import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Discord Automation Cloud SaaS API', timestamp: new Date() });
});

app.listen(PORT, () => {
  console.log(`🚀 Discord Automation SaaS Backend listening on http://localhost:${PORT}`);
});
