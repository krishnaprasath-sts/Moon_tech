import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';
import { config } from './config/index.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimiter.js';
import { NotFoundError } from './utils/errors.js';

const app: Application = express();

// Security HTTP headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration
const allowedOrigins = new Set(
  [
    config.frontendUrl,
    config.adminUrl,
    ...config.corsOrigins,
    ...(config.isDev
      ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000']
      : []),
  ].filter(Boolean)
);

// Behind a reverse proxy, use the forwarded client IP for rate limiting and audit logs
if (config.trustProxy) {
  app.set('trust proxy', config.trustProxy);
}

// In development, also accept the front-end / admin dev servers when opened from another
// device on the local network (e.g. http://192.168.1.20:3000). Never enabled in production.
const privateLanDevOrigin =
  /^http:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):(?:3000|5173)$/;

const isAllowedOrigin = (origin: string): boolean =>
  allowedOrigins.has(origin) || (config.isDev && privateLanDevOrigin.test(origin));

app.use(
  cors({
    origin: (origin, callback) => {
      // Requests without an Origin header (curl, mobile apps, same-origin) are allowed;
      // browsers are only allowed from the configured front-end origins.
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  })
);

// Request parsing & compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(compression());

// HTTP request logging
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Global API rate limiting
app.use('/api', apiRateLimiter);

// Mount main API routes
app.use('/api', apiRouter);

// 404 Not Found handler for undefined routes
app.use((req: Request, _res: Response, next: NextFunction) => {
  next(new NotFoundError(`Cannot find endpoint ${req.method} ${req.originalUrl} on this server`));
});

// Centralized error handler
app.use(errorHandler);

export default app;
