let app: any;
let connectDB: any;
let isConnected = false;
let isInitializing = false;

const initializeApp = async () => {
  if (app) return;
  if (isInitializing) {
    // Wait for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    return initializeApp();
  }

  isInitializing = true;

  try {
    console.log('Initializing backend modules...');
    const indexModule = await import('../backend/src/index.js');
    app = indexModule.app;
    const dbModule = await import('../backend/src/config/database.js');
    connectDB = dbModule.connectDB;
    console.log('Backend modules initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    isInitializing = false;
    throw error;
  }

  isInitializing = false;
};

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  await initializeApp();

  console.log('Connecting to database...');
  try {
    await connectDB();
    isConnected = true;
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
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

    // Handle request with Express using a promise
    return new Promise((resolve, reject) => {
      app(req, res, (err: any) => {
        if (err) {
          console.error('Express error:', err);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
          reject(err);
        } else {
          resolve(undefined);
        }
      });
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
