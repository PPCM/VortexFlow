const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Graph, GraphVersion, GraphShare, User, SimulationSession } = require('../models');
const { requireGraphAccess, requireEditor, requireAdmin, logActivity } = require('../middleware/auth');
const dotValidator = require('../utils/dotValidator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/graphs
 * Get graphs with filtering, searching and pagination
 */
router.get('/',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('search').optional().isLength({ max: 255 }).withMessage('Search query too long'),
    query('category').optional().isLength({ max: 50 }).withMessage('Category too long'),
    query('tags').optional().isString().withMessage('Tags must be a string'),
    query('public').optional().isBoolean().withMessage('Public must be boolean'),
    query('templates').optional().isBoolean().withMessage('Templates must be boolean')
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
      search,
      category,
      tags,
      public: isPublic,
      templates = false
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};
    const include = [{
      model: User,
      as: 'user',
      attributes: ['id', 'email', 'first_name', 'last_name']
    }];

    // Build where clause
    if (templates === 'true') {
      where.is_template = true;
      if (category) {
        where.template_category = category;
      }
    } else {
      // Regular graphs
      if (isPublic === 'true') {
        where.is_public = true;
      } else if (isPublic === 'false') {
        where.is_public = false;
        where.user_id = req.user.id;
      } else {
        // Show user's graphs and public graphs
        where[Op.or] = [
          { user_id: req.user.id },
          { is_public: true }
        ];
      }

      if (category) {
        where.category = category;
      }
    }

    // Search functionality
    if (search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    // Tags filtering
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      where.tags = { [Op.overlap]: tagArray };
    }

    const { count, rows: graphs } = await Graph.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true
    });

    res.json({
      graphs: graphs.map(graph => ({
        id: graph.id,
        title: graph.title,
        description: graph.description,
        category: graph.category,
        tags: graph.tags,
        isPublic: graph.is_public,
        isTemplate: graph.is_template,
        templateCategory: graph.template_category,
        viewCount: graph.view_count,
        version: graph.version,
        lastSimulation: graph.last_simulation,
        createdAt: graph.createdAt,
        updatedAt: graph.updatedAt,
        user: {
          id: graph.user.id,
          email: graph.user.email,
          fullName: `${graph.user.first_name || ''} ${graph.user.last_name || ''}`.trim() || graph.user.email
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
 * GET /api/graphs/:id
 * Get a specific graph with full details
 */
router.get('/:id',
  requireGraphAccess('view'),
  logActivity('graph_view'),
  asyncHandler(async (req, res) => {
    const graph = req.graph;
    
    // Increment view count if not owner
    if (graph.user_id !== req.user.id) {
      await graph.incrementViewCount();
    }

    // Get recent versions
    const versions = await GraphVersion.findByGraph(graph.id, { limit: 5 });

    // Get shares if user is owner or admin
    let shares = [];
    if (graph.user_id === req.user.id || req.user.role === 'admin') {
      shares = await GraphShare.findByGraph(graph.id, {
        include: [{
          model: User,
          as: 'sharedWithUser',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }]
      });
    }

    res.json({
      id: graph.id,
      title: graph.title,
      description: graph.description,
      dotCode: graph.dot_code,
      simulationConfig: graph.simulation_config,
      visualSettings: graph.visual_settings,
      category: graph.category,
      tags: graph.tags,
      isPublic: graph.is_public,
      isTemplate: graph.is_template,
      templateCategory: graph.template_category,
      version: graph.version,
      viewCount: graph.view_count,
      lastSimulation: graph.last_simulation,
      performanceMetrics: graph.performance_metrics,
      createdAt: graph.createdAt,
      updatedAt: graph.updatedAt,
      user: {
        id: graph.user.id,
        email: graph.user.email,
        fullName: graph.user.getFullName()
      },
      versions: versions.map(v => ({
        id: v.id,
        versionNumber: v.version_number,
        notes: v.notes,
        isMajorVersion: v.is_major_version,
        changesSummary: v.changes_summary,
        createdAt: v.createdAt
      })),
      shares: shares.map(s => ({
        id: s.id,
        permissionLevel: s.permission_level,
        expiresAt: s.expires_at,
        accessCount: s.access_count,
        lastAccessed: s.last_accessed,
        notes: s.notes,
        createdAt: s.createdAt,
        user: {
          id: s.sharedWithUser.id,
          email: s.sharedWithUser.email,
          fullName: s.sharedWithUser.getFullName()
        }
      })),
      permission: req.graphPermission
    });
  })
);

/**
 * POST /api/graphs
 * Create a new graph
 */
router.post('/',
  requireEditor,
  [
    body('title')
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title must be between 1 and 255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),
    body('dotCode')
      .trim()
      .notEmpty()
      .withMessage('DOT code is required'),
    body('category')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Category cannot exceed 50 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be boolean'),
    body('simulationConfig')
      .optional()
      .isObject()
      .withMessage('Simulation config must be an object'),
    body('visualSettings')
      .optional()
      .isObject()
      .withMessage('Visual settings must be an object')
  ],
  logActivity('graph_create'),
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
      title,
      description,
      dotCode,
      category,
      tags = [],
      isPublic = false,
      simulationConfig,
      visualSettings
    } = req.body;

    // Validate DOT syntax
    const dotValidation = await dotValidator.validate(dotCode);
    if (!dotValidation.valid) {
      return res.status(400).json({
        error: 'Invalid DOT syntax',
        code: 'DOT_VALIDATION_ERROR',
        details: dotValidation.errors,
        warnings: dotValidation.warnings
      });
    }

    const graph = await Graph.create({
      user_id: req.user.id,
      title,
      description,
      dot_code: dotCode,
      category,
      tags,
      is_public: isPublic,
      simulation_config: simulationConfig,
      visual_settings: visualSettings
    });

    // Create initial version
    await GraphVersion.createFromGraph(graph, 'Initial version');

    logger.info('New graph created', {
      graphId: graph.id,
      userId: req.user.id,
      title: graph.title,
      isPublic: graph.is_public
    });

    res.status(201).json({
      message: 'Graph created successfully',
      graph: {
        id: graph.id,
        title: graph.title,
        description: graph.description,
        category: graph.category,
        tags: graph.tags,
        isPublic: graph.is_public,
        version: graph.version,
        createdAt: graph.created_at
      }
    });
  })
);

/**
 * PUT /api/graphs/:id
 * Update a graph
 */
router.put('/:id',
  requireGraphAccess('edit'),
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title must be between 1 and 255 characters'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 1000 })
      .withMessage('Description cannot exceed 1000 characters'),
    body('dotCode')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('DOT code cannot be empty'),
    body('category')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Category cannot exceed 50 characters'),
    body('tags')
      .optional()
      .isArray()
      .withMessage('Tags must be an array'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be boolean'),
    body('simulationConfig')
      .optional()
      .isObject()
      .withMessage('Simulation config must be an object'),
    body('visualSettings')
      .optional()
      .isObject()
      .withMessage('Visual settings must be an object'),
    body('createVersion')
      .optional()
      .isBoolean()
      .withMessage('createVersion must be boolean'),
    body('versionNotes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Version notes cannot exceed 500 characters')
  ],
  logActivity('graph_update'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const graph = req.graph;
    const {
      title,
      description,
      dotCode,
      category,
      tags,
      isPublic,
      simulationConfig,
      visualSettings,
      createVersion = false,
      versionNotes
    } = req.body;

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (dotCode !== undefined) updateData.dot_code = dotCode;
    if (category !== undefined) updateData.category = category;
    if (tags !== undefined) updateData.tags = tags;
    if (isPublic !== undefined) updateData.is_public = isPublic;
    if (simulationConfig !== undefined) updateData.simulation_config = simulationConfig;
    if (visualSettings !== undefined) updateData.visual_settings = visualSettings;

    // Validate DOT code if provided
    if (dotCode !== undefined) {
      const dotValidation = await dotValidator.validate(dotCode);
      if (!dotValidation.valid) {
        return res.status(400).json({
          error: 'Invalid DOT syntax',
          code: 'DOT_VALIDATION_ERROR',
          details: dotValidation.errors,
          warnings: dotValidation.warnings
        });
      }
    }

    // Check if significant changes were made
    const hasSignificantChanges = dotCode !== undefined || 
                                  simulationConfig !== undefined || 
                                  visualSettings !== undefined;

    if (hasSignificantChanges) {
      updateData.version = graph.version + 1;
    }

    await graph.update(updateData);

    // Create version if requested or if significant changes
    if ((createVersion || hasSignificantChanges) && hasSignificantChanges) {
      await GraphVersion.createFromGraph(graph, versionNotes || 'Graph updated');
    }

    logger.info('Graph updated', {
      graphId: graph.id,
      userId: req.user.id,
      updatedFields: Object.keys(updateData),
      newVersion: updateData.version
    });

    res.json({
      message: 'Graph updated successfully',
      graph: {
        id: graph.id,
        title: graph.title,
        description: graph.description,
        category: graph.category,
        tags: graph.tags,
        isPublic: graph.is_public,
        version: graph.version,
        updatedAt: graph.updatedAt
      }
    });
  })
);

/**
 * DELETE /api/graphs/:id
 * Delete a graph
 */
router.delete('/:id',
  requireGraphAccess('admin'),
  logActivity('graph_delete'),
  asyncHandler(async (req, res) => {
    const graph = req.graph;

    // Soft delete (paranoid is enabled)
    await graph.destroy();

    logger.info('Graph deleted', {
      graphId: graph.id,
      userId: req.user.id,
      title: graph.title
    });

    res.json({
      message: 'Graph deleted successfully'
    });
  })
);

/**
 * GET /api/graphs/:id/versions
 * Get graph versions
 */
router.get('/:id/versions',
  requireGraphAccess('view'),
  asyncHandler(async (req, res) => {
    const graph = req.graph;
    const versions = await GraphVersion.findByGraph(graph.id);

    res.json({
      versions: versions.map(v => ({
        id: v.id,
        versionNumber: v.version_number,
        notes: v.notes,
        isMajorVersion: v.is_major_version,
        changesSummary: v.changes_summary,
        createdAt: v.createdAt
      }))
    });
  })
);

/**
 * POST /api/graphs/:id/versions/:versionId/restore
 * Restore a specific version
 */
router.post('/:id/versions/:versionId/restore',
  requireGraphAccess('edit'),
  logActivity('graph_version_restore'),
  asyncHandler(async (req, res) => {
    const graph = req.graph;
    const { versionId } = req.params;

    const version = await GraphVersion.findOne({
      where: {
        id: versionId,
        graph_id: graph.id
      }
    });

    if (!version) {
      throw new AppError('Version not found', 404, 'VERSION_NOT_FOUND');
    }

    await version.restore();

    logger.info('Graph version restored', {
      graphId: graph.id,
      versionId: version.id,
      versionNumber: version.version_number,
      userId: req.user.id
    });

    res.json({
      message: 'Version restored successfully',
      restoredVersion: version.version_number
    });
  })
);

/**
 * POST /api/graphs/:id/share
 * Share a graph with another user
 */
router.post('/:id/share',
  requireGraphAccess('admin'),
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('permissionLevel')
      .isIn(['view', 'edit'])
      .withMessage('Permission level must be view or edit'),
    body('expiresIn')
      .optional()
      .isInt({ min: 1, max: 8760 })
      .withMessage('Expires in must be between 1 and 8760 hours'),
    body('notes')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Notes cannot exceed 500 characters')
  ],
  logActivity('graph_share'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const graph = req.graph;
    const { email, permissionLevel, expiresIn, notes } = req.body;

    // Find user to share with
    const targetUser = await User.findByEmail(email);
    if (!targetUser) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    if (targetUser.id === req.user.id) {
      throw new AppError('Cannot share with yourself', 400, 'CANNOT_SHARE_WITH_SELF');
    }

    // Check if already shared
    const existingShare = await GraphShare.findOne({
      where: {
        graph_id: graph.id,
        shared_with_user_id: targetUser.id,
        is_active: true
      }
    });

    if (existingShare) {
      throw new AppError('Graph already shared with this user', 409, 'ALREADY_SHARED');
    }

    const share = await GraphShare.createShare(
      graph.id,
      targetUser.id,
      permissionLevel,
      {
        sharedByUserId: req.user.id,
        expiresIn,
        notes
      }
    );

    logger.info('Graph shared', {
      graphId: graph.id,
      sharedWithUserId: targetUser.id,
      sharedByUserId: req.user.id,
      permissionLevel,
      expiresIn
    });

    res.status(201).json({
      message: 'Graph shared successfully',
      share: {
        id: share.id,
        permissionLevel: share.permission_level,
        expiresAt: share.expires_at,
        notes: share.notes,
        createdAt: share.createdAt
      }
    });
  })
);

/**
 * DELETE /api/graphs/:id/shares/:shareId
 * Revoke a graph share
 */
router.delete('/:id/shares/:shareId',
  requireGraphAccess('admin'),
  logActivity('graph_share_revoke'),
  asyncHandler(async (req, res) => {
    const graph = req.graph;
    const { shareId } = req.params;

    const share = await GraphShare.findOne({
      where: {
        id: shareId,
        graph_id: graph.id,
        is_active: true
      }
    });

    if (!share) {
      throw new AppError('Share not found', 404, 'SHARE_NOT_FOUND');
    }

    await share.revoke();

    logger.info('Graph share revoked', {
      graphId: graph.id,
      shareId: share.id,
      userId: req.user.id
    });

    res.json({
      message: 'Graph share revoked successfully'
    });
  })
);

/**
 * POST /api/graphs/:id/duplicate
 * Duplicate a graph
 */
router.post('/:id/duplicate',
  requireGraphAccess('view'),
  [
    body('title')
      .optional()
      .trim()
      .isLength({ min: 1, max: 255 })
      .withMessage('Title must be between 1 and 255 characters')
  ],
  logActivity('graph_duplicate'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const graph = req.graph;
    const { title } = req.body;

    const duplicatedGraph = await Graph.create({
      user_id: req.user.id,
      title: title || `${graph.title} (Copy)`,
      description: graph.description,
      dot_code: graph.dot_code,
      simulation_config: graph.simulation_config,
      visual_settings: graph.visual_settings,
      category: graph.category,
      tags: graph.tags,
      is_public: false // Always private for duplicates
    });

    // Create initial version
    await GraphVersion.createFromGraph(duplicatedGraph, `Duplicated from ${graph.title}`);

    logger.info('Graph duplicated', {
      originalGraphId: graph.id,
      duplicatedGraphId: duplicatedGraph.id,
      userId: req.user.id
    });

    res.status(201).json({
      message: 'Graph duplicated successfully',
      graph: {
        id: duplicatedGraph.id,
        title: duplicatedGraph.title,
        description: duplicatedGraph.description,
        createdAt: duplicatedGraph.createdAt
      }
    });
  })
);

/**
 * POST /api/graphs/validate-dot
 * Validate DOT code syntax
 */
router.post('/validate-dot',
  [
    body('dotCode')
      .trim()
      .notEmpty()
      .withMessage('DOT code is required')
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

    const { dotCode } = req.body;
    
    const validation = await dotValidator.validate(dotCode);
    
    res.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      metadata: validation.metadata
    });
  })
);

/**
 * GET /api/graphs/dot-examples
 * Get DOT code examples
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

module.exports = router;
