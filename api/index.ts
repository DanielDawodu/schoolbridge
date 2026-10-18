import { app } from '../backend/src/index';
import { connectDB } from '../backend/src/config/database';

let isConnected = false;

const connectToDatabase = async () => {
  if (isConnected) {
    return;
  }

  await connectDB();
  isConnected = true;
};

export default async (req: any, res: any) => {
  // Connect to database
  await connectToDatabase();

  // Handle request
  return app(req, res);
};
