import { sequelize } from '../../models/index.js';
import { ensureDatabaseExists } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { FileService } from '../../services/fileService.js';
import { applySchemaPatches } from './schemaPatches.js';

export async function runMigrations(): Promise<void> {
  try {
    logger.info('Initializing database schema and migrations...');
    
    // Ensure storage directories exist
    await FileService.ensureStorageDir();

    // Ensure database exists
    await ensureDatabaseExists();

    // Authenticate database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully.');

    // Add columns introduced after the first release, then sync models
    await applySchemaPatches();
    await sequelize.sync({ alter: true });
    logger.info('All database tables and indexes synchronized successfully.');
  } catch (error: any) {
    logger.error('Failed to run migrations / sync database:', error);
    throw error;
  }
}

// Allow direct execution via CLI (e.g., `tsx src/database/migrations/runMigrations.ts`)
if (process.argv[1]?.includes('runMigrations')) {
  runMigrations()
    .then(() => {
      logger.info('Migration process finished.');
      process.exit(0);
    })
    .catch((err) => {
      logger.error('Migration failed:', err);
      process.exit(1);
    });
}
