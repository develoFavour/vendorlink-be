import dotenv from 'dotenv';
dotenv.config();

import { createServer } from 'http';
import mongoose from 'mongoose';
import app from './app';
import connectDB from './config/db';
import { initializeSocket } from './socket';


const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = createServer(app);
  initializeSocket(server);

  const shutdown = (signal: string) => {
    console.log(`${signal} received. Closing server...`);

    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the existing backend process or set a different PORT.`);
      process.exit(1);
    }

    throw error;
  });

  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

startServer().catch((err) => {
  console.error('Failed to connect to database', err);
  process.exit(1);
});
