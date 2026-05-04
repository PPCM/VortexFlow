const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { User, Graph, SimulationSession } = require('../models');
const { requireAdmin, logActivity } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/users/profile
 * Get current user profile
 */
router.get('/profile',
  logActivity('user_profile'),
  asyncHandler(async (req, res) => {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password_hash'] }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.getFullName(),
        isActive: user.is_active,
        lastLogin: user.last_login,
        preferences: user.preferences,
        avatarUrl: user.avatar_url,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  })
);

/**
 * GET /api/users
 * Get all users (admin only)
 */
router.get('/',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isLength({ max: 255 }).withMessage('Search query too long'),
    query('role').optional().isIn(['viewer', 'editor', 'admin']).withMessage('Invalid role'),
    query('active').optional().isBoolean().withMessage('Active must be boolean')
  ],
  logActivity('users_list'),
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
      search,
      role,
      active
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    // Build where clause
    if (search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${search}%` } },
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (active !== undefined) {
      where.is_active = active === 'true';
    }

    const { count, rows: users } = await User.findAndCountAll({
      where,
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Graph,
          as: 'graphs',
          attributes: ['id'],
          required: false
        },
        {
          model: SimulationSession,
          as: 'simulationSessions',
          attributes: ['id'],
          required: false
        }
      ],
      limit: parseInt(limit),
      offset,
      order: [['created_at', 'DESC']],
      distinct: true
    });

    const formattedUsers = users.map(user => ({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: user.getFullName(),
      isActive: user.is_active,
      lastLogin: user.last_login,
      preferences: user.preferences,
      avatarUrl: user.avatar_url,
      graphsCount: user.graphs ? user.graphs.length : 0,
      simulationSessionsCount: user.simulationSessions ? user.simulationSessions.length : 0,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

    res.json({
      users: formattedUsers,
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
 * GET /api/users/:id
 * Get a specific user (admin only)
 */
router.get('/:id',
  requireAdmin,
  logActivity('user_detail'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        {
          model: Graph,
          as: 'graphs',
          attributes: ['id', 'title', 'is_public', 'view_count', 'created_at'],
          limit: 10,
          order: [['created_at', 'DESC']]
        },
        {
          model: SimulationSession,
          as: 'simulationSessions',
          attributes: ['id', 'session_name', 'status', 'duration', 'created_at'],
          limit: 10,
          order: [['created_at', 'DESC']]
        }
      ]
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
      fullName: user.getFullName(),
      isActive: user.is_active,
      lastLogin: user.last_login,
      preferences: user.preferences,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
      graphs: user.graphs,
      simulationSessions: user.simulationSessions
    });
  })
);

/**
 * PUT /api/users/:id/role
 * Update user role (admin only)
 */
router.put('/:id/role',
  requireAdmin,
  [
    body('role')
      .isIn(['viewer', 'editor', 'admin'])
      .withMessage('Role must be viewer, editor, or admin')
  ],
  logActivity('user_role_update'),
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
    const { role } = req.body;

    if (id === req.user.id) {
      throw new AppError('Cannot modify your own role', 400, 'CANNOT_MODIFY_OWN_ROLE');
    }

    const user = await User.findByPk(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const oldRole = user.role;
    await user.update({ role });

    logger.info('User role updated', {
      targetUserId: user.id,
      targetUserEmail: user.email,
      oldRole,
      newRole: role,
      updatedByUserId: req.user.id,
      updatedByEmail: req.user.email
    });

    res.json({
      message: 'User role updated successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        updatedAt: user.updated_at
      }
    });
  })
);

/**
 * PUT /api/users/:id/status
 * Update user active status (admin only)
 */
router.put('/:id/status',
  requireAdmin,
  [
    body('isActive')
      .isBoolean()
      .withMessage('isActive must be boolean')
  ],
  logActivity('user_status_update'),
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
    const { isActive } = req.body;

    if (id === req.user.id) {
      throw new AppError('Cannot modify your own status', 400, 'CANNOT_MODIFY_OWN_STATUS');
    }

    const user = await User.findByPk(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    const oldStatus = user.is_active;
    await user.update({ is_active: isActive });

    logger.info('User status updated', {
      targetUserId: user.id,
      targetUserEmail: user.email,
      oldStatus,
      newStatus: isActive,
      updatedByUserId: req.user.id,
      updatedByEmail: req.user.email
    });

    res.json({
      message: 'User status updated successfully',
      user: {
        id: user.id,
        email: user.email,
        isActive: user.is_active,
        updatedAt: user.updated_at
      }
    });
  })
);

/**
 * DELETE /api/users/:id
 * Delete a user (admin only)
 */
router.delete('/:id',
  requireAdmin,
  logActivity('user_delete'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (id === req.user.id) {
      throw new AppError('Cannot delete your own account', 400, 'CANNOT_DELETE_OWN_ACCOUNT');
    }

    const user = await User.findByPk(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Check if user has graphs
    const userGraphsCount = await Graph.count({ where: { user_id: id } });
    
    if (userGraphsCount > 0) {
      throw new AppError(
        'Cannot delete user with existing graphs. Transfer or delete graphs first.',
        400,
        'USER_HAS_GRAPHS'
      );
    }

    // Soft delete
    await user.destroy();

    logger.info('User deleted', {
      deletedUserId: user.id,
      deletedUserEmail: user.email,
      deletedByUserId: req.user.id,
      deletedByEmail: req.user.email
    });

    res.json({
      message: 'User deleted successfully'
    });
  })
);

/**
 * GET /api/users/stats
 * Get user statistics (admin only)
 */
router.get('/dashboard/stats',
  requireAdmin,
  logActivity('users_stats'),
  asyncHandler(async (req, res) => {
    const [
      totalUsers,
      activeUsers,
      viewerCount,
      editorCount,
      adminCount,
      recentUsers,
      totalGraphs,
      publicGraphs,
      totalSessions
    ] = await Promise.all([
      User.count(),
      User.count({ where: { is_active: true } }),
      User.countByRole('viewer'),
      User.countByRole('editor'),
      User.countByRole('admin'),
      User.findAll({
        attributes: { exclude: ['password_hash'] },
        limit: 5,
        order: [['created_at', 'DESC']]
      }),
      Graph.count(),
      Graph.count({ where: { is_public: true } }),
      SimulationSession.count()
    ]);

    res.json({
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: totalUsers - activeUsers,
        byRole: {
          viewer: viewerCount,
          editor: editorCount,
          admin: adminCount
        }
      },
      graphs: {
        total: totalGraphs,
        public: publicGraphs,
        private: totalGraphs - publicGraphs
      },
      sessions: {
        total: totalSessions
      },
      recentUsers: recentUsers.map(user => ({
        id: user.id,
        email: user.email,
        role: user.role,
        fullName: user.getFullName(),
        isActive: user.is_active,
        createdAt: user.created_at
      }))
    });
  })
);

/**
 * POST /api/users/:id/reset-password
 * Reset user password (admin only)
 */
router.post('/:id/reset-password',
  requireAdmin,
  [
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],
  logActivity('user_password_reset'),
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
    const { newPassword } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    await user.update({
      password_hash: newPassword // Will be hashed by model hook
    });

    logger.warn('User password reset by admin', {
      targetUserId: user.id,
      targetUserEmail: user.email,
      resetByUserId: req.user.id,
      resetByEmail: req.user.email,
      timestamp: new Date().toISOString()
    });

    res.json({
      message: 'User password reset successfully'
    });
  })
);

/**
 * GET /api/users/:id/activity
 * Get user activity log (admin only)
 */
router.get('/:id/activity',
  requireAdmin,
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
  ],
  logActivity('user_activity_view'),
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
    const { limit = 20 } = req.query;

    const user = await User.findByPk(id);
    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    // Get user's graphs and simulation sessions for activity
    const [graphs, sessions] = await Promise.all([
      Graph.findAll({
        where: { user_id: id },
        attributes: ['id', 'title', 'created_at', 'updated_at'],
        order: [['updated_at', 'DESC']],
        limit: 10
      }),
      SimulationSession.findAll({
        where: { user_id: id },
        attributes: ['id', 'session_name', 'status', 'duration', 'created_at'],
        order: [['created_at', 'DESC']],
        limit: 10
      })
    ]);

    // Combine and sort activities
    const activities = [
      ...graphs.map(graph => ({
        type: 'graph',
        action: 'updated',
        title: graph.title,
        timestamp: graph.updated_at,
        id: graph.id
      })),
      ...sessions.map(session => ({
        type: 'simulation',
        action: 'session',
        title: session.session_name,
        status: session.status,
        duration: session.duration,
        timestamp: session.created_at,
        id: session.id
      }))
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.getFullName()
      },
      activities: activities.slice(0, parseInt(limit)),
      summary: {
        totalGraphs: graphs.length,
        totalSessions: sessions.length,
        lastActivity: activities[0]?.timestamp || null
      }
    });
  })
);

module.exports = router;
