import mongoose from 'mongoose';

export const sanitizeMongoUri = (uri: string): string => {
  if (!uri) return uri;
  const clean = uri.trim();
  const qIndex = clean.indexOf('?');
  if (qIndex === -1) return clean;

  const base = clean.slice(0, qIndex);
  const query = clean.slice(qIndex + 1);

  const pairs = query.split('&');
  const validPairs: string[] = [];

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      // Key with no value (e.g. 'appName' with no '='), invalid in MongoDB options
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();

    // Strip wrapping quotes if any
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1).trim();
    }

    // If value is empty, drop this parameter to prevent "URI option cannot be specified with no value"
    if (!val) continue;

    validPairs.push(`${key}=${val}`);
  }

  return validPairs.length > 0 ? `${base}?${validPairs.join('&')}` : base;
};

export const connectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState === 1) {
    return;
  }
  if (mongoose.connection.readyState === 2) {
    await new Promise((resolve) => {
      mongoose.connection.once('open', resolve);
    });
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
