const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (err, req, res, _next) => {
  logger.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });

  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));
    
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors
    });
  }

  // Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      error: 'Resource already exists',
      code: 'UNIQUE_CONSTRAINT_ERROR',
      field: err.errors?.[0]?.path
    });
  }

  // Sequelize foreign key constraint errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      error: 'Invalid reference',
      code: 'FOREIGN_KEY_ERROR',
      field: err.fields?.[0]
    });
  }

  // Multer errors (file upload)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      error: 'File too large',
      code: 'FILE_TOO_LARGE',
      maxSize: process.env.MAX_FILE_SIZE || '10MB'
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file field',
      code: 'UNEXPECTED_FILE'
    });
  }

  // Custom application errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code || 'APPLICATION_ERROR'
    });
  }

  // GraphQL/DOT parsing errors
  if (err.name === 'SyntaxError' && err.message.includes('DOT')) {
    return res.status(400).json({
      error: 'Invalid DOT syntax',
      code: 'DOT_SYNTAX_ERROR',
      details: err.message
    });
  }

  // Default internal server error
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.originalUrl,
    method: req.method
  });
};

/**
 * Async error wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Custom error class
 */
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error helper
 */
const createValidationError = (field, message) => {
  return new AppError(`Validation failed for field '${field}': ${message}`, 400, 'VALIDATION_ERROR');
};

/**
 * Not found error helper
 */
const createNotFoundError = (resource) => {
  return new AppError(`${resource} not found`, 404, 'NOT_FOUND');
};

/**
 * Forbidden error helper
 */
const createForbiddenError = (message = 'Access forbidden') => {
  return new AppError(message, 403, 'FORBIDDEN');
};

/**
 * Unauthorized error helper
 */
const createUnauthorizedError = (message = 'Authentication required') => {
  return new AppError(message, 401, 'UNAUTHORIZED');
};

/**
 * Rate limit exceeded error helper
 */
const createRateLimitError = (message = 'Rate limit exceeded') => {
  return new AppError(message, 429, 'RATE_LIMIT_EXCEEDED');
};

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  AppError,
  createValidationError,
  createNotFoundError,
  createForbiddenError,
  createUnauthorizedError,
  createRateLimitError
};
