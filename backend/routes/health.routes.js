import { Router } from 'express';
import { isDbConnected } from '../config/db.js';

const router = Router();

// Used by the hosting platform's health check and by the frontend setup check.
router.get('/', (_req, res) => {
  const database = isDbConnected() ? 'connected' : 'disconnected';
  res.status(database === 'connected' ? 200 : 503).json({
    success: database === 'connected',
    data: { status: database === 'connected' ? 'ok' : 'degraded', database, time: new Date().toISOString() },
  });
});

export default router;
