import { Sequelize } from 'sequelize';
import mysql from 'mysql2/promise';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

/**
 * Ensures the MySQL database exists before Sequelize attempts to connect
 */
export async function ensureDatabaseExists(): Promise<void> {
  if (config.db.dialect !== 'mysql') return;

  try {
    const connection = await mysql.createConnection({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
    });

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await connection.end();
    logger.info(`Database '${config.db.name}' verified/created in MySQL.`);
  } catch (err: any) {
    logger.error(`Failed to auto-create database '${config.db.name}':`, err.message);
    throw err;
  }
}

let sequelize: Sequelize;

if (config.db.dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './moon_tech.sqlite',
    logging: config.isDev ? false : false,
  });
} else {
  sequelize = new Sequelize(
    config.db.name,
    config.db.user,
    config.db.password,
    {
      host: config.db.host,
      port: config.db.port,
      dialect: 'mysql',
      logging: config.isDev ? false : false,
      pool: config.db.pool,
      define: {
        timestamps: true,
        underscored: true,
      },
      timezone: '+00:00',
    }
  );
}

export { sequelize };
