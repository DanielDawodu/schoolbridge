import { app } from '../backend/src/index';
import mongoose from 'mongoose';

let cachedDb: any = null;

const connectToDatabase = async () => {
  if (cachedDb) {
    return cachedDb;
  }

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  cachedDb = await mongoose.connect(MONGODB_URI);
  return cachedDb;
};

export default async (req: any, res: any) => {
  // Connect to database
  await connectToDatabase();

  // Handle request
  return app(req, res);
};
