import dotenv from 'dotenv';
import path from 'path';

// Load .env from the current working directory first (e.g. server/.env),
// then fall back to the repository root. dotenv never overrides variables
// that are already set, so the first value found wins.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const DEFAULT_MONGODB_URI = 'mongodb://127.0.0.1:27017/fitness-tracker';

if (!process.env.MONGODB_URI) {
  // Never log the URI itself — it may contain credentials.
  console.warn(
    `MONGODB_URI is not set. Falling back to the local default (${DEFAULT_MONGODB_URI}).`
  );
}

export const config = {
  mongoUri: process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI,
  port: Number.parseInt(process.env.PORT ?? '3001', 10),
  isProduction: process.env.NODE_ENV === 'production',
};
