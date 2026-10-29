import mongoose from 'mongoose';

export const sanitizeMongoUri = (uri: string): string => {
  if (!uri) return uri;
  let clean = uri.trim();
  clean = clean.replace(/[?&][a-zA-Z0-9_-]+=(?=&|$)/g, '');
  clean = clean.replace(/[?&]$/, '');
  if (!clean.includes('?') && clean.includes('&')) {
    clean = clean.replace('&', '?');
  }
  return clean;
};

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error('MONGODB_URI environment variable is required');
  }

  const mongoUri = sanitizeMongoUri(rawUri);

  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    console.log('MongoDB disconnected successfully');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
  }
};

export const getMongoURI = (): string => process.env.MONGODB_URI || '';

