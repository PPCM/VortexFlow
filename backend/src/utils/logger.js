const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for logs
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += '\n' + JSON.stringify(meta, null, 2);
    }
    
    return msg;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { 
    service: 'vortexflow-backend',
    version: require('../../package.json').version
  },
  transports: [
    // File transport for errors
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 10
    })
  ],
  
  // Handle exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Create child loggers for different modules
const createChildLogger = (module) => {
  return logger.child({ module });
};

// Performance logging utility
const logPerformance = (operation, startTime, metadata = {}) => {
  const duration = Date.now() - startTime;
  logger.info('Performance metric', {
    operation,
    duration,
    ...metadata
  });
  return duration;
};

// User activity logging
const logUserActivity = (userId, activity, metadata = {}) => {
  logger.info('User activity', {
    userId,
    activity,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// Database query logging
const logDatabaseQuery = (query, duration, metadata = {}) => {
  if (process.env.LOG_DATABASE_QUERIES === 'true') {
    logger.debug('Database query', {
      query,
      duration,
      ...metadata
    });
  }
};

// Security event logging
const logSecurityEvent = (event, severity = 'info', metadata = {}) => {
  logger.log(severity, 'Security event', {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...metadata
  });
};

// API request logging middleware
const logApiRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id
    };
    
    if (res.statusCode >= 400) {
      logger.warn('API request failed', logData);
    } else {
      logger.info('API request', logData);
    }
  });
  
  next();
};

// Error logging with context
const logError = (error, context = {}) => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

// Structured logging helpers
const loggers = {
  auth: createChildLogger('auth'),
  graph: createChildLogger('graph'),
  simulation: createChildLogger('simulation'),
  websocket: createChildLogger('websocket'),
  database: createChildLogger('database'),
  api: createChildLogger('api')
};

module.exports = {
  logger,
  createChildLogger,
  logPerformance,
  logUserActivity,
  logDatabaseQuery,
  logSecurityEvent,
  logApiRequest,
  logError,
  loggers,
  info: (message, meta) => logger.info(message, meta),
  error: (message, meta) => logger.error(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  debug: (message, meta) => logger.debug(message, meta)
};
