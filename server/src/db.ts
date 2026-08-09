import mongoose from 'mongoose';

/**
 * Opens a single shared mongoose connection for the whole process.
 * Mongoose maintains an internal connection pool, so this must be called
 * exactly once at startup — never per request.
 */
export async function connectDb(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
