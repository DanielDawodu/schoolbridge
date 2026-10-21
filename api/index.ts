let app: any;
let connectDB: any;

try {
  const module = await import('../backend/src/index');
  app = module.app;
} catch (error) {
  console.error('Failed to load app:', error);
}

let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  try {
    const dbModule = await import('../backend/src/config/database');
    connectDB = dbModule.connectDB;
    await connectDB();
    isConnected = true;
  } catch (error) {
    console.error('Failed to connect to database:', error);
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

  // Connect to database
  await connectToDatabase();

  // Handle request
  return app(req, res);
};
