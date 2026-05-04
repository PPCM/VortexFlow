const express = require('express');
const { requireAdmin, logActivity } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { User, Graph, SimulationSession } = require('../models');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');
const { Op } = require('sequelize');
const os = require('os');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

/**
 * GET /api/system/health
 * Health check endpoint
 */
router.get('/health', asyncHandler(async (req, res) => {
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
    health.services.database = { status: 'healthy', responseTime: 'fast' };
  } catch (error) {
    health.services.database = { 
      status: 'unhealthy', 
      error: error.message 
    };
    health.status = 'degraded';
  }

  // Check Redis connection (if available)
  try {
    if (req.session) {
      health.services.redis = { status: 'healthy' };
    } else {
      health.services.redis = { status: 'unavailable' };
    }
  } catch (error) {
    health.services.redis = { 
      status: 'unhealthy', 
      error: error.message 
    };
  }

  // Check email service
  const emailTest = await emailService.testConfiguration();
  health.services.email = {
    status: emailTest.success ? 'healthy' : 'unavailable',
    message: emailTest.message
  };

  // System resources
  health.system = {
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      external: Math.round(process.memoryUsage().external / 1024 / 1024)
    },
    cpu: {
      platform: os.platform(),
      arch: os.arch(),
      loadAverage: os.loadavg()
    }
  };

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
}));

/**
 * GET /api/system/stats
 * System statistics (admin only)
 */
router.get('/stats',
  requireAdmin,
  logActivity('system_stats'),
  asyncHandler(async (req, res) => {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersWeek,
      totalGraphs,
      publicGraphs,
      newGraphsToday,
      newGraphsWeek,
      totalSessions,
      activeSessions,
      completedSessions,
      failedSessions,
      averageSessionDuration,
      topCategories,
      topUsers
    ] = await Promise.all([
      // User stats
      User.count(),
      User.count({ where: { is_active: true } }),
      User.count({ where: { created_at: { [Op.gte]: last24h } } }),
      User.count({ where: { created_at: { [Op.gte]: last7d } } }),
      
      // Graph stats
      Graph.count(),
      Graph.count({ where: { is_public: true } }),
      Graph.count({ where: { created_at: { [Op.gte]: last24h } } }),
      Graph.count({ where: { created_at: { [Op.gte]: last7d } } }),
      
      // Simulation stats
      SimulationSession.count(),
      SimulationSession.count({ where: { status: 'running' } }),
      SimulationSession.count({ where: { status: 'completed' } }),
      SimulationSession.count({ where: { status: 'failed' } }),
      
      // Average session duration
      SimulationSession.findOne({
        attributes: [[require('sequelize').fn('AVG', require('sequelize').col('duration')), 'avg_duration']],
        where: { status: 'completed' },
        raw: true
      }),
      
      // Top categories
      Graph.findAll({
        attributes: [
          'category',
          [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
        ],
        where: { category: { [Op.ne]: null } },
        group: ['category'],
        order: [[require('sequelize').fn('COUNT', require('sequelize').col('id')), 'DESC']],
        limit: 10,
        raw: true
      }),
      
      // Top users by graph count
      User.findAll({
        attributes: [
          'id', 'email', 'first_name', 'last_name',
          [require('sequelize').fn('COUNT', require('sequelize').col('graphs.id')), 'graph_count']
        ],
        include: [{
          model: Graph,
          as: 'graphs',
          attributes: []
        }],
        group: ['User.id'],
        order: [[require('sequelize').fn('COUNT', require('sequelize').col('graphs.id')), 'DESC']],
        limit: 10
      })
    ]);

    const stats = {
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        newToday: newUsersToday,
        newThisWeek: newUsersWeek,
        growth: {
          daily: newUsersToday,
          weekly: newUsersWeek
        }
      },
      graphs: {
        total: totalGraphs,
        public: publicGraphs,
        private: totalGraphs - publicGraphs,
        newToday: newGraphsToday,
        newThisWeek: newGraphsWeek,
        growth: {
          daily: newGraphsToday,
          weekly: newGraphsWeek
        }
      },
      simulations: {
        total: totalSessions,
        active: activeSessions,
        completed: completedSessions,
        failed: failedSessions,
        successRate: Math.round((completedSessions / Math.max(totalSessions, 1)) * 100),
        averageDuration: Math.round(averageSessionDuration?.avg_duration || 0)
      },
      topCategories: topCategories.map(cat => ({
        category: cat.category,
        count: parseInt(cat.count)
      })),
      topUsers: topUsers.map(user => ({
        id: user.id,
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        graphCount: parseInt(user.get('graph_count') || 0)
      })),
      system: {
        uptime: Math.round(process.uptime()),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        platform: os.platform()
      }
    };

    res.json(stats);
  })
);

/**
 * GET /api/system/logs
 * Get recent system logs (admin only)
 */
router.get('/logs',
  requireAdmin,
  logActivity('system_logs'),
  asyncHandler(async (req, res) => {
    const { level = 'info', limit = 100 } = req.query;
    
    try {
      // Try to read log files if they exist
      const logDir = path.join(__dirname, '../../logs');
      const logFile = path.join(logDir, `${level}.log`);
      
      const logContent = await fs.readFile(logFile, 'utf8');
      const logLines = logContent.split('\n')
        .filter(line => line.trim())
        .slice(-parseInt(limit))
        .map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return { message: line, timestamp: new Date().toISOString() };
          }
        });

      res.json({
        logs: logLines,
        level,
        count: logLines.length
      });
    } catch (error) {
      // If log files don't exist, return empty
      res.json({
        logs: [],
        level,
        count: 0,
        message: 'Log files not available'
      });
    }
  })
);

/**
 * POST /api/system/cleanup
 * Clean up old data (admin only)
 */
router.post('/cleanup',
  requireAdmin,
  logActivity('system_cleanup'),
  asyncHandler(async (req, res) => {
    const { 
      cleanupOldSessions = true,
      cleanupExpiredShares = true,
      cleanupOldVersions = false,
      daysOld = 30 
    } = req.body;

    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const results = {
      sessionsDeleted: 0,
      sharesDeleted: 0,
      versionsDeleted: 0
    };

    try {
      // Clean up old completed/failed simulation sessions
      if (cleanupOldSessions) {
        const { count } = await SimulationSession.destroy({
          where: {
            status: { [Op.in]: ['completed', 'failed', 'cancelled'] },
            created_at: { [Op.lt]: cutoffDate }
          }
        });
        results.sessionsDeleted = count;
      }

      // Clean up expired graph shares
      if (cleanupExpiredShares) {
        const { GraphShare } = require('../models');
        const { count } = await GraphShare.destroy({
          where: {
            [Op.or]: [
              { expires_at: { [Op.lt]: new Date() } },
              { is_active: false }
            ]
          }
        });
        results.sharesDeleted = count;
      }

      // Clean up old graph versions (keep latest 10 versions per graph)
      if (cleanupOldVersions) {
        const { GraphVersion } = require('../models');
        
        // Get all graphs
        const graphs = await Graph.findAll({ attributes: ['id'] });
        
        for (const graph of graphs) {
          const versions = await GraphVersion.findAll({
            where: { graph_id: graph.id },
            order: [['created_at', 'DESC']],
            offset: 10 // Keep latest 10 versions
          });
          
          if (versions.length > 0) {
            const versionIds = versions.map(v => v.id);
            const { count } = await GraphVersion.destroy({
              where: { id: { [Op.in]: versionIds } }
            });
            results.versionsDeleted += count;
          }
        }
      }

      logger.info('System cleanup completed', {
        results,
        cutoffDate,
        userId: req.user.id
      });

      res.json({
        message: 'Cleanup completed successfully',
        results
      });
    } catch (error) {
      logger.error('System cleanup failed', { error: error.message });
      throw error;
    }
  })
);

/**
 * GET /api/system/info
 * Get system information (admin only)
 */
router.get('/info',
  requireAdmin,
  logActivity('system_info'),
  asyncHandler(async (req, res) => {
    const info = {
      server: {
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: os.platform(),
        architecture: os.arch(),
        uptime: Math.round(process.uptime()),
        environment: process.env.NODE_ENV || 'development'
      },
      database: {
        type: 'PostgreSQL',
        host: process.env.DB_HOST || 'localhost',
        name: process.env.DB_NAME || 'vortexflow'
      },
      redis: {
        configured: !!process.env.REDIS_URL,
        host: process.env.REDIS_HOST || 'localhost'
      },
      email: {
        configured: !!process.env.SMTP_HOST,
        host: process.env.SMTP_HOST || 'not configured'
      },
      features: {
        authentication: true,
        websockets: true,
        fileUploads: true,
        emailNotifications: !!process.env.SMTP_HOST,
        rateLimit: true,
        logging: true
      },
      limits: {
        maxFileSize: process.env.MAX_FILE_SIZE || '10MB',
        maxGraphs: process.env.MAX_GRAPHS_PER_USER || 'unlimited',
        sessionTimeout: process.env.SESSION_MAX_AGE || '24h'
      }
    };

    res.json(info);
  })
);

/**
 * POST /api/system/test-email
 * Test email configuration (admin only)
 */
router.post('/test-email',
  requireAdmin,
  logActivity('system_test_email'),
  asyncHandler(async (req, res) => {
    const testResult = await emailService.testConfiguration();
    
    if (testResult.success) {
      // Send test email to admin
      const testSent = await emailService.sendWelcomeEmail(req.user);
      
      res.json({
        success: true,
        message: 'Email configuration is working',
        testEmailSent: testSent
      });
    } else {
      res.status(400).json({
        success: false,
        message: testResult.message
      });
    }
  })
);

/**
 * GET /api/system/metrics
 * Get system metrics for monitoring
 */
router.get('/metrics',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external,
        rss: process.memoryUsage().rss
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg()
      },
      system: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpuCount: os.cpus().length
      },
      database: {
        // These would be filled by database monitoring
        connections: 0,
        queries: 0
      },
      http: {
        // These would be filled by HTTP metrics middleware
        requests: 0,
        responses: 0,
        errors: 0
      }
    };

    res.json(metrics);
  })
);

module.exports = router;
