import http from 'http';
import app from './app.js';
import { config, getInsecureProductionSecrets } from './config/index.js';
import { ensureDatabaseExists } from './config/database.js';
import { sequelize } from './models/index.js';
import { logger } from './utils/logger.js';
import { FileService } from './services/fileService.js';
import { EmailService } from './services/emailService.js';
import { initJobs } from './jobs/index.js';
import { seedDatabase, seedInvestmentDefaults, seedDailyProfitPlans } from './database/seeders/seed.js';
import { applySchemaPatches, applyDataPatches } from './database/migrations/schemaPatches.js';

let server: http.Server;

async function bootstrap() {
  try {
    logger.info('==============================================');
    logger.info('  CLYVUS VENTURES | INVESTMENT PLATFORM API ');
    logger.info('==============================================');

    // 0. Refuse to run in production with development secrets
    if (!config.isDev) {
      const insecure = getInsecureProductionSecrets();
      if (insecure.length > 0) {
        logger.error(`Refusing to start: set strong values (32+ characters) for ${insecure.join(', ')} in the environment.`);
        process.exit(1);
      }
    }

    // 1. Ensure private upload directory exists
    await FileService.ensureStorageDir();
    logger.info(`Storage directory verified at: ${config.uploadDir}`);

    // 2. Connect & Synchronize Database
    try {
      await ensureDatabaseExists();
      await sequelize.authenticate();
      logger.info(`Database connected successfully [${config.db.dialect.toUpperCase()}] on ${config.db.host}:${config.db.port}/${config.db.name}`);
      
      // Auto-sync schema in development safely without duplicate index accumulation
      await applySchemaPatches();
      await sequelize.sync();
      logger.info('Database tables synchronized.');

      // Check if seed needed
      const userCount = await sequelize.models.User?.count().catch(() => 0);
      if (userCount === 0) {
        logger.info('Database is empty. Running initial seed...');
        await seedDatabase();
      }

      // Databases created before the investment module still need its default plans
      await seedInvestmentDefaults();
      await seedDailyProfitPlans();
      await applyDataPatches();
    } catch (dbError: any) {
      logger.error('Database connection / synchronization failed:', dbError);
      logger.warn('Please ensure your MySQL service is running or check your .env configuration.');
      // Continue so that the server can still run or be inspected
    }

    // 2b. Warm up the mail connection in the background (sign-in codes depend on it)
    EmailService.warmUp().catch(() => {});

    // 3. Initialize background jobs
    initJobs();

    // 4. Start HTTP Server with retry capability if port is in TIME_WAIT or briefly busy
    const startListening = (retriesLeft = 5, retryDelayMs = 1500) => {
      server = app.listen(config.port, () => {
        logger.info(`Server running in [${config.env}] mode on http://localhost:${config.port}`);
        logger.info(`API Base URL: http://localhost:${config.port}/api`);
        logger.info(`Health check: http://localhost:${config.port}/api/health`);
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          if (retriesLeft > 0) {
            logger.warn(`Port ${config.port} is busy or closing (EADDRINUSE). Retrying in ${retryDelayMs / 1000}s... (${retriesLeft} retries remaining)`);
            setTimeout(() => {
              server.close();
              startListening(retriesLeft - 1, retryDelayMs);
            }, retryDelayMs);
          } else {
            logger.error(`Port ${config.port} is already in use by another process. Please free port ${config.port} or check running processes.`);
            process.exit(1);
          }
        } else {
          logger.error('HTTP server encountered an error:', err);
        }
      });
    };

    startListening();

  } catch (error: any) {
    logger.error('Fatal error during application startup:', error);
    process.exit(1);
  }
}

// Graceful Shutdown
function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        await sequelize.close();
        logger.info('Database connection closed.');
      } catch (e) {
        logger.error('Error closing database:', e);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

bootstrap();
