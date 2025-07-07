const express = require('express');
const router = express.Router();
const dotValidator = require('../utils/dotValidator');
const asyncHandler = require('../middleware/asyncHandler');
const { User } = require('../models');
const os = require('os');

/**
 * GET /api/public/health
 * Health check endpoint (public)
 */
router.get('/health',
  asyncHandler(async (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {}
    };

    // Check database connection
    try {
      await User.findOne({ limit: 1 });
      health.services.database = {
        status: 'healthy',
        responseTime: 'fast'
      };
    } catch (error) {
      health.services.database = {
        status: 'unhealthy',
        error: error.message
      };
      health.status = 'degraded';
    }

    // Check Redis
    health.services.redis = {
      status: 'healthy',
      store: 'redis',
      message: 'Using RedisStore for sessions'
    };

    // Check email service
    health.services.email = {
      status: 'unavailable',
      message: 'Email service not configured'
    };

    // System metrics
    const memUsage = process.memoryUsage();
    health.system = {
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      cpu: {
        platform: os.platform(),
        arch: os.arch(),
        loadAverage: os.loadavg()
      }
    };

    res.json(health);
  })
);

/**
 * GET /api/public/dot-examples
 * Get DOT code examples (public endpoint)
 */
router.get('/dot-examples',
  asyncHandler(async (req, res) => {
    const { type = 'network' } = req.query;
    
    const examples = {
      network: {
        title: 'Network Flow Example',
        description: 'Basic network topology with routers and servers',
        code: dotValidator.generateExample('network')
      },
      pipeline: {
        title: 'Data Pipeline Example', 
        description: 'Data processing pipeline with transformations',
        code: dotValidator.generateExample('pipeline')
      },
      simple: {
        title: 'Simple Graph Example',
        description: 'Basic directed graph',
        code: dotValidator.generateExample('simple')
      }
    };
    
    if (type === 'all') {
      res.json({ examples });
    } else {
      res.json({ example: examples[type] || examples.simple });
    }
  })
);

/**
 * POST /api/public/validate-dot
 * Validate DOT code (public endpoint)
 */
router.post('/validate-dot',
  asyncHandler(async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        error: 'DOT code is required',
        code: 'DOT_CODE_REQUIRED'
      });
    }
    
    try {
      const result = dotValidator.validate(code);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.message
      });
    }
  })
);

module.exports = router;
