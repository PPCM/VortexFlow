const express = require('express');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

const logger = require('./src/utils/logger');
const { sequelize } = require('./src/models');
const authRoutes = require('./src/routes/auth');
const publicRoutes = require('./src/routes/public');
const graphRoutes = require('./src/routes/graphs');
const userRoutes = require('./src/routes/users');
const dashboardRoutes = require('./src/routes/dashboard');
const adminRoutes = require('./src/routes/admin');
const systemRoutes = require('./src/routes/system');
const importExportRoutes = require('./src/routes/import-export');
const { setupAdminUser } = require('./src/utils/setup');
const { errorHandler, notFoundHandler } = require('./src/middleware/errorHandler');
const { validateSession } = require('./src/middleware/auth');

const app = express();
const server = http.createServer(app);

// Initialize Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('ready', () => {
  logger.info('Redis client ready');
});

// Connect to Redis
redisClient.connect().catch(console.error);

// WebSocket server setup
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  }
});

logger.info('WebSocket server initialized');

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session configuration
app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  name: process.env.SESSION_NAME || 'vortexflow-session',
  resave: false,
  saveUninitialized: false,
  rolling: true, // Renouveler la session à chaque requête
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    // Durée minimale de 1 heure, ou la valeur configurée si elle est plus élevée
    maxAge: Math.max(
      parseInt(process.env.SESSION_MAX_AGE) || 60 * 60 * 1000, // 1 heure par défaut
      60 * 60 * 1000 // Minimum 1 heure
    )
  }
}));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: require('./package.json').version
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/graphs', validateSession, graphRoutes);
app.use('/api/users', validateSession, userRoutes);
app.use('/api/dashboard', validateSession, dashboardRoutes);
app.use('/api/admin', adminRoutes);
// Health check endpoint (public) - must be before protected routes
app.get('/api/system/health', (req, res, next) => {
  // Forward to the health endpoint without auth
  systemRoutes(req, res, next);
});
// Other system endpoints (protected)
app.use('/api/system', validateSession, systemRoutes);
app.use('/api/import-export', validateSession, importExportRoutes);

// Static file serving for uploads
app.use('/uploads', express.static('uploads'));

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Database connection and server startup
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0'; // Bind to all IPv4 interfaces

async function startServer() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connection established successfully');

    // Sync database models
    await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
    logger.info('Database models synchronized');

    // Setup admin user
    await setupAdminUser();

    // Start server
    server.listen(PORT, HOST, () => {
      logger.info(`🚀 VortexFlow Backend Server running on http://${HOST}:${PORT}`);
      logger.info(`📊 Health check available at http://${HOST}:${PORT}/api/health`);
      logger.info(`🔌 WebSocket server running on ws://${HOST}:${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connection
    if (sequelize) {
      sequelize.close().then(() => {
        logger.info('Database connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');

  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connection
    if (sequelize) {
      sequelize.close().then(() => {
        logger.info('Database connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
});

startServer();

module.exports = { app, server };
