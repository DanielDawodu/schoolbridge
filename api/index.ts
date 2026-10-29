import mongoose from 'mongoose';
import { app } from '../backend/src/index';
import { connectDB } from '../backend/src/config/database';

const connectToDatabase = async () => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  console.log('Connecting to database...');
  try {
    await connectDB();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
};

export default async (req: any, res: any) => {
  // Normalize req.url if needed
  if (req.url && !req.url.startsWith('/api') && req.url !== '/') {
    req.url = `/api${req.url}`;
  }

  // Health check endpoint (no database required)
  if (req.url === '/api/health' || req.path === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Database health check - accurately reports Mongoose connection state
  if (req.url === '/api/health/db' || req.path === '/api/health/db') {
    const isConnected = mongoose.connection.readyState === 1;
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = isConnected ? 200 : 503;
    res.end(JSON.stringify({ ok: isConnected }));
    return;
  }

  try {
    // Connect to database
    await connectToDatabase();

    // Delegate to Express and wait for response to complete
    return new Promise<void>((resolve, reject) => {
      res.on('finish', resolve);
      res.on('close', resolve);
      res.on('error', reject);
      app(req, res);
    });
  } catch (error) {
    console.error('Error handling request:', error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }
};
