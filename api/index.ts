import { app } from '../backend/src/index.js';
import { connectDB } from '../backend/src/config/database.js';

let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  await connectDB();
  isConnected = true;
};

export default async (req: any, res: any) => {
  // Health check endpoint (no database required)
  if (req.url === '/api/health' || req.path === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // Connect to database
  await connectToDatabase();

  // Handle request
  return app(req, res);
};
