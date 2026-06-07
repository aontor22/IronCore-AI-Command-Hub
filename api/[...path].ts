import express from 'express';
import cors from 'cors';
import { routes } from '../src/server/routes';

const app = express();

app.use(cors({
  origin: true,
  credentials: false,
}));
app.use(express.json({ limit: '1mb' }));
app.use('/api', routes);

export default app;
