/**
 * Express Server Entry Point
 * 
 * This is the main application entry point for the PRD Generator backend.
 * It initializes the Express application, connects to databases,
 * sets up middleware, mounts routes, and starts the server.
 * 
 * @module index
 */

// =============================================================================
// 1. Environment Variables Validation
// =============================================================================
require('dotenv').config();
const Joi = require('joi');

/**
 * Validate required environment variables
 */
const envSchema = Joi.object({
  // Application
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  
  // Database
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().default(5432),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_POOL_MIN: Joi.number().default(2),
  DB_POOL_MAX: Joi.number().default(10),
  DB_POOL_IDLE: Joi.number().default(10000),
  
  // Redis
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  REDIS_DB: Joi.number().default(0),
  
  // Security
  JWT_SECRET: Joi.string().required(),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'http', 'debug').default('info'),
  LOG_FORMAT: Joi.string().valid('combined', 'common', 'dev', 'short', 'tiny').default('combined'),
  
  // AI Service
  OPENAI_API_KEY: Joi.string().required(),
  AI_REQUEST_TIMEOUT: Joi.number().default(30000)
}).unknown();

const { error, value: env } = envSchema.validate(process.env);

if (error) {
  console.error(`Environment validation error: ${error.message}`);
  process.exit(1);
}

// Make validated env variables available throughout the application
process.env = { ...process.env, ...env };

// =============================================================================
// 2. Required Dependencies
// =============================================================================
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('rate-limiter-flexible');
const redis = require('redis');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const path = require('path');
const http = require('http');

// Import database models
const { sequelize } = require('./models');

// Import route handlers
const sessionRoutes = require('./routes/sessionRoutes');
const conversationRoutes = require('./routes/conversationRoutes');

// Import services
const AIService = require('./services/AIService');
const ValidationEngine = require('./services/ValidationEngine');
const ConversationManager = require('./services/ConversationManager');
const QualityScorer = require('./services/QualityScorer');

// Import WebSocket manager
const SocketManager = require('./websocket/socketManager');

// =============================================================================
// 3. Logger Configuration
// =============================================================================
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'prd-generator' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_DIR || './logs', 'error.log'), 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: path.join(process.env.LOG_DIR || './logs', 'combined.log') 
    })
  ]
});

// =============================================================================
// 4. Initialize Express Application
// =============================================================================
const app = express();

// Add request ID to each request
app.use((req, res, next) => {
  req.id = uuidv4();
  next();
});

// Set up CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: process.env.CORS_CREDENTIALS === 'true'
}));

// Security headers
app.use(helmet());

// Request logging
app.use(morgan(process.env.LOG_FORMAT, {
  stream: {
    write: (message) => logger.http(message.trim())
  }
}));

// Response compression
app.use(compression());

// Request body parsing
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb'
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: process.env.MAX_FILE_SIZE || '10mb'
}));

// =============================================================================
// 5. Redis Client Initialization
// =============================================================================
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  password: process.env.REDIS_PASSWORD,
  database: process.env.REDIS_DB
});

// Redis error handling
redisClient.on('error', (err) => {
  logger.error(`Redis error: ${err.message}`);
});

// Redis connection handling
redisClient.on('connect', () => {
  logger.info('Redis connected successfully');
});

// Redis reconnection handling
redisClient.on('reconnecting', () => {
  logger.warn('Redis reconnecting...');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (err) {
    logger.error(`Redis connection error: ${err.message}`);
  }
})();

// =============================================================================
// 6. Rate Limiting Configuration
// =============================================================================
const apiLimiter = new rateLimit.RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'rate_limit_api',
  points: process.env.RATE_LIMIT_MAX_REQUESTS,
  duration: process.env.RATE_LIMIT_WINDOW_MS / 1000,
  blockDuration: 60 * 15 // 15 minutes block if limit reached
});

// Apply rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await apiLimiter.consume(req.ip);
    next();
  } catch (err) {
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// =============================================================================
// 7. Database Connection (with retry logic)
// =============================================================================
const MAX_DB_RETRIES = 5;
const DB_RETRY_INTERVAL = 5000; // 5 seconds

/**
 * Connect to the database with retry logic
 */
const connectToDatabase = async (retryCount = 0) => {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync models if in development mode
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      logger.info('Database models synchronized');
    }
    
    return true;
  } catch (error) {
    logger.error(`Database connection error: ${error.message}`);
    
    if (retryCount < MAX_DB_RETRIES) {
      logger.info(`Retrying database connection in ${DB_RETRY_INTERVAL / 1000} seconds... (Attempt ${retryCount + 1}/${MAX_DB_RETRIES})`);
      
      await new Promise(resolve => setTimeout(resolve, DB_RETRY_INTERVAL));
      return connectToDatabase(retryCount + 1);
    } else {
      logger.error(`Failed to connect to database after ${MAX_DB_RETRIES} attempts`);
      return false;
    }
  }
};

// =============================================================================
// 8. Initialize Services
// =============================================================================
let aiService;
let validationEngine;
let conversationManager;
let qualityScorer;
let socketManager;

const initializeServices = async () => {
  try {
    // Initialize AI Service
    aiService = new AIService({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4',
      timeout: process.env.AI_REQUEST_TIMEOUT,
      maxRetries: process.env.AI_MAX_RETRIES || 3,
      logger
    });
    
    // Initialize Validation Engine
    validationEngine = new ValidationEngine({
      logger
    });
    
    // Initialize Quality Scorer
    qualityScorer = new QualityScorer({
      aiService,
      logger
    });
    
    // Initialize Conversation Manager
    conversationManager = new ConversationManager({
      aiService,
      validationEngine,
      qualityScorer,
      logger
    });
    
    logger.info('All services initialized successfully');
    return true;
  } catch (error) {
    logger.error(`Service initialization error: ${error.message}`);
    return false;
  }
};

// =============================================================================
// 9. API Routes
// =============================================================================

// API prefix
const API_PREFIX = '/api';

// Health check endpoint
app.get(`${API_PREFIX}/health`, async (req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    services: {
      database: sequelize.authenticate().then(() => true).catch(() => false) ? 'up' : 'down',
      redis: redisClient.isReady ? 'up' : 'down',
      ai: aiService ? 'up' : 'down'
    }
  };
  
  // Check if all critical services are up
  const allServicesUp = Object.values(healthStatus.services).every(status => status === 'up');
  
  res.status(allServicesUp ? 200 : 503).json(healthStatus);
});

// Mount route files
app.use(`${API_PREFIX}/sessions`, sessionRoutes);
app.use(`${API_PREFIX}/conversations`, conversationRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND'
  });
});

// =============================================================================
// 10. Global Error Handler
// =============================================================================
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, {
    stack: err.stack,
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  
  const statusCode = err.statusCode || 500;
  const errorResponse = {
    success: false,
    error: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message,
    code: err.code || 'SERVER_ERROR'
  };
  
  // Add stack trace in development mode
  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    errorResponse.stack = err.stack;
  }
  
  res.status(statusCode).json(errorResponse);
});

// =============================================================================
// 11. Server Startup
// =============================================================================
const PORT = process.env.PORT || 3001;
let server;

const startServer = async () => {
  // Connect to database
  const dbConnected = await connectToDatabase();
  if (!dbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }
  
  // Initialize services
  const servicesInitialized = await initializeServices();
  if (!servicesInitialized) {
    logger.error('Failed to initialize services. Exiting...');
    process.exit(1);
  }
  
  // Create HTTP server (needed for Socket.IO)
  server = http.createServer(app);
  
  // Initialize WebSocket server
  try {
    socketManager = new SocketManager({
      httpServer: server,
      redisClient: redisClient,
      logger
    });
    logger.info('WebSocket server initialized successfully');
  } catch (error) {
    logger.error(`Failed to initialize WebSocket server: ${error.message}`);
    // Continue even if WebSocket fails - it's not critical for the application
  }
  
  // Start the server
  server.listen(PORT, () => {
    logger.info(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    logger.info(`Health check available at http://localhost:${PORT}${API_PREFIX}/health`);
  });
  
  // Handle server errors
  server.on('error', (error) => {
    logger.error(`Server error: ${error.message}`);
    process.exit(1);
  });
};

// =============================================================================
// 12. Graceful Shutdown Handling
// =============================================================================
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Set a timeout for forceful shutdown if graceful shutdown takes too long
  const forceShutdownTimeout = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit...');
    process.exit(1);
  }, 30000); // 30 seconds
  
  try {
    // Close HTTP server (stop accepting new connections)
    if (server) {
      logger.info('Closing HTTP server...');
      await new Promise((resolve) => server.close(resolve));
      logger.info('HTTP server closed');
    }
    
    // Close WebSocket connections
    if (socketManager) {
      logger.info('Closing WebSocket connections...');
      socketManager.close();
      logger.info('WebSocket connections closed');
    }
    
    // Close Redis connection
    if (redisClient.isReady) {
      logger.info('Closing Redis connection...');
      await redisClient.quit();
      logger.info('Redis connection closed');
    }
    
    // Close database connection
    logger.info('Closing database connection...');
    await sequelize.close();
    logger.info('Database connection closed');
    
    // Clear the force shutdown timeout
    clearTimeout(forceShutdownTimeout);
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during graceful shutdown: ${error.message}`);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error.message}`, { stack: error.stack });
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  gracefulShutdown('unhandledRejection');
});

// Start the server
startServer();

// Export for testing purposes
module.exports = { app, server, redisClient, socketManager, gracefulShutdown };