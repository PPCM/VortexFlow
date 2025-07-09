const { User } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware to validate user session
 */
const validateSession = async (req, res, next) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const user = await User.findByPk(req.session.userId);
    if (!user || !user.is_active) {
      req.session.destroy();
      return res.status(401).json({
        error: 'User not found or inactive',
        code: 'USER_INACTIVE'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Session validation error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
};

/**
 * Middleware to require specific role
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
};

/**
 * Middleware to require admin role
 */
const requireAdmin = requireRole(['admin']);

/**
 * Middleware to require editor or admin role
 */
const requireEditor = requireRole(['editor', 'admin']);

/**
 * Middleware for optional authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    if (req.session && req.session.userId) {
      const user = await User.findByPk(req.session.userId);
      if (user && user.is_active) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    logger.error('Optional auth error:', error);
    next(); // Continue without user
  }
};

/**
 * Middleware to check graph ownership or admin
 */
const requireGraphAccess = (accessType = 'view') => {
  return async (req, res, next) => {
    try {
      const { Graph, GraphShare } = require('../models');
      const graphId = req.params.id || req.params.graphId;
      
      if (!graphId) {
        return res.status(400).json({
          error: 'Graph ID required',
          code: 'GRAPH_ID_REQUIRED'
        });
      }

      const graph = await Graph.findByPk(graphId, {
        include: [{
          model: GraphShare,
          as: 'shares',
          where: { is_active: true },
          required: false
        }]
      });

      if (!graph) {
        return res.status(404).json({
          error: 'Graph not found',
          code: 'GRAPH_NOT_FOUND'
        });
      }

      // Check access permissions
      let hasAccess = false;
      let permission = 'none';

      // Owner always has full access
      if (graph.user_id === req.user.id) {
        hasAccess = true;
        permission = 'admin';
      }
      // Admin has full access
      else if (req.user.role === 'admin') {
        hasAccess = true;
        permission = 'admin';
      }
      // Public graphs can be viewed
      else if (graph.is_public && accessType === 'view') {
        hasAccess = true;
        permission = 'view';
      }
      // Check shared access
      else {
        const share = graph.shares?.find(s => s.shared_with_user_id === req.user.id);
        if (share && share.isValid()) {
          hasAccess = true;
          permission = share.permission_level;
          await share.incrementAccessCount();
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied to this graph',
          code: 'GRAPH_ACCESS_DENIED'
        });
      }

      // Check if access type is allowed
      const accessLevels = {
        'view': ['view', 'edit', 'admin'],
        'edit': ['edit', 'admin'],
        'admin': ['admin']
      };

      if (!accessLevels[accessType]?.includes(permission)) {
        return res.status(403).json({
          error: `${accessType} access denied`,
          code: 'INSUFFICIENT_GRAPH_PERMISSIONS',
          required: accessType,
          current: permission
        });
      }

      req.graph = graph;
      req.graphPermission = permission;
      next();
    } catch (error) {
      logger.error('Graph access check error:', error);
      res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  };
};

/**
 * Rate limiting for authentication endpoints
 */
const authRateLimit = require('express-rate-limit')({
  windowMs: process.env.NODE_ENV === 'production' ? 15 * 60 * 1000 : 5 * 60 * 1000, // 15 min prod, 5 min dev
  max: process.env.NODE_ENV === 'production' ? 5 : 20, // 5 attempts prod, 20 dev
  message: {
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Middleware to log user activity
 */
const logActivity = (activity) => {
  return (req, res, next) => {
    if (req.user) {
      logger.info('User activity', {
        userId: req.user.id,
        email: req.user.email,
        activity: activity,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

module.exports = {
  validateSession,
  requireRole,
  requireAdmin,
  requireEditor,
  optionalAuth,
  requireGraphAccess,
  authRateLimit,
  logActivity
};
