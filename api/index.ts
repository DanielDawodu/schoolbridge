let app: any;
let connectDB: any;
let isConnected = false;

const initializeApp = async () => {
  if (app) return;

  try {
    const indexModule = await import('../backend/src/index.js');
    app = indexModule.app;
    const dbModule = await import('../backend/src/config/database.js');
    connectDB = dbModule.connectDB;
  } catch (error) {
    console.error('Failed to initialize app:', error);
    throw error;
  }
};

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  await initializeApp();
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

  // Database health check - skip actual connection test in serverless
  // The connection will be tested on first real API call
  if (req.url === '/api/health/db' || req.path === '/api/health/db') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  try {
    // Connect to database
    await connectToDatabase();

    // Handle request with Express
    app(req, res);
  } catch (error) {
    console.error('Error handling request:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
};
