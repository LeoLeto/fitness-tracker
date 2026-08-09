import { config } from './config';
import { createApp } from './app';
import { connectDb, disconnectDb } from './db';

async function main() {
  try {
    await connectDb(config.mongoUri);
    console.log('MongoDB connected');
  } catch (err) {
    // Never print the connection string — it may contain credentials.
    console.error(
      'Failed to connect to MongoDB. Check MONGODB_URI and that the database is reachable.'
    );
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDb();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
