const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Graph, SimulationSession, User } = require('../models');
const { requireGraphAccess, requireEditor, logActivity } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/simulation/sessions
 * Get user's simulation sessions
 */
router.get('/sessions',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['pending', 'running', 'completed', 'failed', 'cancelled']).withMessage('Invalid status'),
    query('graphId').optional().isUUID().withMessage('Graph ID must be a valid UUID')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const {
      page = 1,
      limit = 20,
      status,
      graphId
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = { user_id: req.user.id };

    if (status) {
      where.status = status;
    }

    if (graphId) {
      where.graph_id = graphId;
    }

    const { count, rows: sessions } = await SimulationSession.findAndCountAll({
      where,
      include: [
        {
          model: Graph,
          as: 'graph',
          attributes: ['id', 'title', 'category']
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
      distinct: true
    });

    res.json({
      sessions: sessions.map(session => ({
        id: session.id,
        sessionName: session.session_name,
        status: session.status,
        duration: session.duration,
        startTime: session.start_time,
        endTime: session.end_time,
        config: session.config,
        results: session.results,
        metrics: session.metrics,
        errorMessage: session.error_message,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        graph: {
          id: session.graph.id,
          title: session.graph.title,
          category: session.graph.category
        }
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / parseInt(limit))
      }
    });
  })
);

/**
 * GET /api/simulation/sessions/:id
 * Get a specific simulation session
 */
router.get('/sessions/:id',
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await SimulationSession.findOne({
      where: {
        id,
        user_id: req.user.id
      },
      include: [
        {
          model: Graph,
          as: 'graph',
          attributes: ['id', 'title', 'description', 'category', 'dot_code']
        }
      ]
    });

    if (!session) {
      throw new AppError('Simulation session not found', 404, 'SESSION_NOT_FOUND');
    }

    res.json({
      id: session.id,
      sessionName: session.session_name,
      status: session.status,
      duration: session.duration,
      startTime: session.start_time,
      endTime: session.end_time,
      config: session.config,
      results: session.results,
      metrics: session.metrics,
      errorMessage: session.error_message,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      graph: {
        id: session.graph.id,
        title: session.graph.title,
        description: session.graph.description,
        category: session.graph.category,
        dotCode: session.graph.dot_code
      }
    });
  })
);

/**
 * POST /api/simulation/start
 * Start a new simulation session
 */
router.post('/start',
  requireEditor,
  [
    body('graphId')
      .isUUID()
      .withMessage('Graph ID must be a valid UUID'),
    body('sessionName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Session name must be between 1 and 255 characters'),
    body('config')
      .optional()
      .isObject()
      .withMessage('Config must be an object'),
    body('config.speed')
      .optional()
      .isFloat({ min: 0.1, max: 10 })
      .withMessage('Speed must be between 0.1 and 10'),
    body('config.particleCount')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Particle count must be between 1 and 10000'),
    body('config.duration')
      .optional()
      .isInt({ min: 1, max: 3600 })
      .withMessage('Duration must be between 1 and 3600 seconds'),
    body('config.physics')
      .optional()
      .isObject()
      .withMessage('Physics config must be an object')
  ],
  logActivity('simulation_start'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { graphId, sessionName, config } = req.body;

    // Verify graph access
    const graph = await Graph.findByPk(graphId);
    if (!graph) {
      throw new AppError('Graph not found', 404, 'GRAPH_NOT_FOUND');
    }

    // Check if user has access to this graph
    const hasAccess = await graph.hasUserAccess(req.user.id);
    if (!hasAccess) {
      throw new AppError('Access denied to this graph', 403, 'ACCESS_DENIED');
    }

    // Check for existing running sessions
    const existingSession = await SimulationSession.findOne({
      where: {
        user_id: req.user.id,
        graph_id: graphId,
        status: 'running'
      }
    });

    if (existingSession) {
      throw new AppError('A simulation is already running for this graph', 409, 'SIMULATION_ALREADY_RUNNING');
    }

    // Default simulation config
    const defaultConfig = {
      speed: 1.0,
      particleCount: 100,
      duration: 60,
      physics: {
        gravity: 0.1,
        friction: 0.98,
        attraction: 0.01,
        repulsion: 0.1
      },
      visualization: {
        nodeSize: 1.0,
        edgeWidth: 1.0,
        particleSize: 0.5,
        trailLength: 10
      }
    };

    const mergedConfig = { ...defaultConfig, ...config };

    // Create simulation session
    const session = await SimulationSession.create({
      user_id: req.user.id,
      graph_id: graphId,
      session_name: sessionName || `Simulation ${new Date().toISOString()}`,
      status: 'pending',
      config: mergedConfig,
      start_time: new Date()
    });

    // Update graph's last simulation timestamp
    await graph.update({ last_simulation: new Date() });

    logger.info('Simulation session started', {
      sessionId: session.id,
      graphId: graph.id,
      userId: req.user.id,
      config: mergedConfig
    });

    res.status(201).json({
      message: 'Simulation session started',
      session: {
        id: session.id,
        sessionName: session.session_name,
        status: session.status,
        config: session.config,
        startTime: session.start_time,
        createdAt: session.created_at
      }
    });
  })
);

/**
 * POST /api/simulation/:id/stop
 * Stop a running simulation session
 */
router.post('/:id/stop',
  logActivity('simulation_stop'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await SimulationSession.findOne({
      where: {
        id,
        user_id: req.user.id,
        status: 'running'
      }
    });

    if (!session) {
      throw new AppError('Running simulation session not found', 404, 'SESSION_NOT_FOUND');
    }

    const duration = Math.floor((new Date() - new Date(session.start_time)) / 1000);

    await session.update({
      status: 'cancelled',
      end_time: new Date(),
      duration
    });

    logger.info('Simulation session stopped', {
      sessionId: session.id,
      userId: req.user.id,
      duration
    });

    res.json({
      message: 'Simulation session stopped',
      session: {
        id: session.id,
        status: session.status,
        duration: session.duration,
        endTime: session.end_time
      }
    });
  })
);

/**
 * POST /api/simulation/:id/pause
 * Pause a running simulation session
 */
router.post('/:id/pause',
  logActivity('simulation_pause'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await SimulationSession.findOne({
      where: {
        id,
        user_id: req.user.id,
        status: 'running'
      }
    });

    if (!session) {
      throw new AppError('Running simulation session not found', 404, 'SESSION_NOT_FOUND');
    }

    // Store pause state in config
    const config = { ...session.config, isPaused: true, pausedAt: new Date() };

    await session.update({ config });

    logger.info('Simulation session paused', {
      sessionId: session.id,
      userId: req.user.id
    });

    res.json({
      message: 'Simulation session paused',
      session: {
        id: session.id,
        status: session.status,
        config: session.config
      }
    });
  })
);

/**
 * POST /api/simulation/:id/resume
 * Resume a paused simulation session
 */
router.post('/:id/resume',
  logActivity('simulation_resume'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await SimulationSession.findOne({
      where: {
        id,
        user_id: req.user.id,
        status: 'running'
      }
    });

    if (!session) {
      throw new AppError('Running simulation session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (!session.config?.isPaused) {
      throw new AppError('Simulation is not paused', 400, 'NOT_PAUSED');
    }

    // Remove pause state from config
    const config = { ...session.config };
    delete config.isPaused;
    delete config.pausedAt;

    await session.update({ config });

    logger.info('Simulation session resumed', {
      sessionId: session.id,
      userId: req.user.id
    });

    res.json({
      message: 'Simulation session resumed',
      session: {
        id: session.id,
        status: session.status,
        config: session.config
      }
    });
  })
);

/**
 * PUT /api/simulation/:id/config
 * Update simulation configuration during runtime
 */
router.put('/:id/config',
  [
    body('config')
      .isObject()
      .withMessage('Config must be an object'),
    body('config.speed')
      .optional()
      .isFloat({ min: 0.1, max: 10 })
      .withMessage('Speed must be between 0.1 and 10'),
    body('config.particleCount')
      .optional()
      .isInt({ min: 1, max: 10000 })
      .withMessage('Particle count must be between 1 and 10000')
  ],
  logActivity('simulation_config_update'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { config } = req.body;

    const session = await SimulationSession.findOne({
      where: {
        id,
        user_id: req.user.id,
        status: 'running'
      }
    });

    if (!session) {
      throw new AppError('Running simulation session not found', 404, 'SESSION_NOT_FOUND');
    }

    // Merge with existing config
    const updatedConfig = { ...session.config, ...config };

    await session.update({ config: updatedConfig });

    logger.info('Simulation config updated', {
      sessionId: session.id,
      userId: req.user.id,
      updatedConfig: config
    });

    res.json({
      message: 'Simulation configuration updated',
      config: updatedConfig
    });
  })
);

/**
 * DELETE /api/simulation/sessions/:id
 * Delete a simulation session
 */
router.delete('/sessions/:id',
  logActivity('simulation_session_delete'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const session = await SimulationSession.findOne({
      where: {
        id,
        user_id: req.user.id
      }
    });

    if (!session) {
      throw new AppError('Simulation session not found', 404, 'SESSION_NOT_FOUND');
    }

    if (session.status === 'running') {
      throw new AppError('Cannot delete running simulation session', 400, 'CANNOT_DELETE_RUNNING');
    }

    await session.destroy();

    logger.info('Simulation session deleted', {
      sessionId: session.id,
      userId: req.user.id
    });

    res.json({
      message: 'Simulation session deleted successfully'
    });
  })
);

/**
 * GET /api/simulation/templates
 * Get simulation templates
 */
router.get('/templates',
  asyncHandler(async (req, res) => {
    const templates = [
      {
        id: 'network-flow',
        name: 'Network Flow',
        description: 'Basic network flow simulation with packet routing',
        config: {
          speed: 1.0,
          particleCount: 50,
          duration: 120,
          physics: {
            gravity: 0.05,
            friction: 0.95,
            attraction: 0.02,
            repulsion: 0.08
          },
          visualization: {
            nodeSize: 1.2,
            edgeWidth: 1.0,
            particleSize: 0.3,
            trailLength: 15
          }
        },
        category: 'networking'
      },
      {
        id: 'data-pipeline',
        name: 'Data Pipeline',
        description: 'Data processing pipeline with batch operations',
        config: {
          speed: 0.8,
          particleCount: 100,
          duration: 180,
          physics: {
            gravity: 0.1,
            friction: 0.98,
            attraction: 0.01,
            repulsion: 0.1
          },
          visualization: {
            nodeSize: 1.5,
            edgeWidth: 1.2,
            particleSize: 0.4,
            trailLength: 20
          }
        },
        category: 'data'
      },
      {
        id: 'distributed-system',
        name: 'Distributed System',
        description: 'Microservices communication simulation',
        config: {
          speed: 1.5,
          particleCount: 200,
          duration: 300,
          physics: {
            gravity: 0.08,
            friction: 0.92,
            attraction: 0.015,
            repulsion: 0.12
          },
          visualization: {
            nodeSize: 1.0,
            edgeWidth: 0.8,
            particleSize: 0.2,
            trailLength: 8
          }
        },
        category: 'systems'
      }
    ];

    res.json({ templates });
  })
);

/**
 * POST /api/simulation/validate-config
 * Validate simulation configuration
 */
router.post('/validate-config',
  [
    body('config')
      .isObject()
      .withMessage('Config must be an object'),
    body('dotCode')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('DOT code cannot be empty')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { config, dotCode } = req.body;

    // Basic config validation
    const validationErrors = [];
    const warnings = [];

    if (config.speed && (config.speed < 0.1 || config.speed > 10)) {
      validationErrors.push('Speed must be between 0.1 and 10');
    }

    if (config.particleCount && (config.particleCount < 1 || config.particleCount > 10000)) {
      validationErrors.push('Particle count must be between 1 and 10000');
    }

    if (config.duration && (config.duration < 1 || config.duration > 3600)) {
      validationErrors.push('Duration must be between 1 and 3600 seconds');
    }

    // Performance warnings
    if (config.particleCount > 1000) {
      warnings.push('High particle count may impact performance');
    }

    if (config.speed > 5) {
      warnings.push('High speed may make simulation difficult to follow');
    }

    // TODO: Add DOT code validation if provided
    // if (dotCode) {
    //   const dotValidator = require('../utils/dotValidator');
    //   const dotValidation = await dotValidator.validate(dotCode);
    //   if (!dotValidation.valid) {
    //     validationErrors.push(...dotValidation.errors);
    //   }
    // }

    const isValid = validationErrors.length === 0;

    res.json({
      valid: isValid,
      errors: validationErrors,
      warnings,
      estimatedComplexity: calculateComplexity(config),
      estimatedDuration: config.duration || 60
    });
  })
);

/**
 * Helper function to calculate simulation complexity
 */
function calculateComplexity(config) {
  let complexity = 'low';
  
  const particleCount = config.particleCount || 100;
  const speed = config.speed || 1.0;
  
  if (particleCount > 500 || speed > 3) {
    complexity = 'medium';
  }
  
  if (particleCount > 1000 || speed > 5) {
    complexity = 'high';
  }
  
  return complexity;
}

module.exports = router;
