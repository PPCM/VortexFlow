const express = require('express');
const { body, validationResult } = require('express-validator');
const { Graph, GraphVersion, User } = require('../models');
const { requireEditor, logActivity } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { 
  uploadGraphFile, 
  uploadExportFile, 
  handleUploadError,
  readDotFile,
  readJsonFile,
  cleanupFile 
} = require('../utils/fileUpload');
const dotValidator = require('../utils/dotValidator');
const logger = require('../utils/logger');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

/**
 * POST /api/import-export/import-dot
 * Import DOT file and create new graph
 */
router.post('/import-dot',
  requireEditor,
  (req, res, next) => {
    uploadGraphFile(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  },
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
      .withMessage('Description must be less than 1000 characters'),
    body('category')
      .optional()
      .trim()
      .isLength({ max: 50 })
      .withMessage('Category must be less than 50 characters'),
    body('isPublic')
      .optional()
      .isBoolean()
      .withMessage('isPublic must be a boolean')
  ],
  logActivity('import_dot_file'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded file on validation error
      if (req.file) {
        cleanupFile(req.file.path);
      }
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    try {
      // Read and validate DOT file
      const fileResult = readDotFile(req.file.path);
      if (!fileResult.success) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Invalid DOT file',
          code: 'INVALID_DOT_FILE',
          details: fileResult.error
        });
      }

      // Validate DOT syntax
      const dotValidation = await dotValidator.validate(fileResult.content);
      if (!dotValidation.valid) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Invalid DOT syntax',
          code: 'DOT_VALIDATION_ERROR',
          details: dotValidation.errors,
          warnings: dotValidation.warnings
        });
      }

      // Extract metadata from filename if title not provided
      const originalName = path.parse(req.file.originalname).name;
      const title = req.body.title || originalName || 'Imported Graph';

      // Create graph
      const graph = await Graph.create({
        user_id: req.user.id,
        title,
        description: req.body.description || `Imported from ${req.file.originalname}`,
        category: req.body.category || 'imported',
        is_public: req.body.isPublic === 'true' || req.body.isPublic === true,
        dot_code: fileResult.content,
        simulation_config: {},
        visual_settings: {},
        metadata: {
          imported: true,
          originalFilename: req.file.originalname,
          fileSize: fileResult.size,
          importedAt: new Date().toISOString(),
          dotValidation: dotValidation.metadata
        }
      });

      // Create initial version
      await GraphVersion.create({
        graph_id: graph.id,
        version_number: 1,
        dot_code: fileResult.content,
        simulation_config: {},
        visual_settings: {},
        change_description: 'Initial import from DOT file',
        created_by: req.user.id
      });

      // Clean up uploaded file
      cleanupFile(req.file.path);

      logger.info('DOT file imported successfully', {
        graphId: graph.id,
        userId: req.user.id,
        filename: req.file.originalname,
        fileSize: fileResult.size
      });

      res.status(201).json({
        message: 'Graph imported successfully',
        graph: {
          id: graph.id,
          title: graph.title,
          description: graph.description,
          category: graph.category,
          is_public: graph.is_public,
          created_at: graph.created_at
        },
        validation: {
          warnings: dotValidation.warnings,
          metadata: dotValidation.metadata
        }
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        cleanupFile(req.file.path);
      }
      throw error;
    }
  })
);

/**
 * POST /api/import-export/import-json
 * Import JSON graph export and create new graph
 */
router.post('/import-json',
  requireEditor,
  (req, res, next) => {
    uploadExportFile(req, res, (err) => {
      if (err) {
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  },
  logActivity('import_json_file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        code: 'NO_FILE'
      });
    }

    try {
      // Read and validate JSON file
      const fileResult = readJsonFile(req.file.path);
      if (!fileResult.success) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Invalid JSON file',
          code: 'INVALID_JSON_FILE',
          details: fileResult.error
        });
      }

      const importData = fileResult.data;

      // Validate JSON structure
      if (!importData.graph || !importData.graph.dot_code) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Invalid graph export format',
          code: 'INVALID_EXPORT_FORMAT',
          details: 'Missing required graph data'
        });
      }

      // Validate DOT syntax
      const dotValidation = await dotValidator.validate(importData.graph.dot_code);
      if (!dotValidation.valid) {
        cleanupFile(req.file.path);
        return res.status(400).json({
          error: 'Invalid DOT syntax in imported graph',
          code: 'DOT_VALIDATION_ERROR',
          details: dotValidation.errors,
          warnings: dotValidation.warnings
        });
      }

      // Create graph with imported data
      const graph = await Graph.create({
        user_id: req.user.id,
        title: importData.graph.title || 'Imported Graph',
        description: importData.graph.description || `Imported from ${req.file.originalname}`,
        category: importData.graph.category || 'imported',
        is_public: false, // Always import as private initially
        dot_code: importData.graph.dot_code,
        simulation_config: importData.graph.simulation_config || {},
        visual_settings: importData.graph.visual_settings || {},
        metadata: {
          ...importData.graph.metadata,
          imported: true,
          originalFilename: req.file.originalname,
          importedAt: new Date().toISOString(),
          importedFrom: importData.exportInfo?.exportedBy || 'unknown'
        }
      });

      // Create versions if they exist in export
      if (importData.versions && Array.isArray(importData.versions)) {
        const versionsToCreate = importData.versions.slice(0, 10); // Limit versions
        
        for (let i = 0; i < versionsToCreate.length; i++) {
          const versionData = versionsToCreate[i];
          await GraphVersion.create({
            graph_id: graph.id,
            version_number: i + 1,
            dot_code: versionData.dot_code || importData.graph.dot_code,
            simulation_config: versionData.simulation_config || {},
            visual_settings: versionData.visual_settings || {},
            change_description: versionData.change_description || `Imported version ${i + 1}`,
            created_by: req.user.id
          });
        }
      } else {
        // Create initial version
        await GraphVersion.create({
          graph_id: graph.id,
          version_number: 1,
          dot_code: importData.graph.dot_code,
          simulation_config: importData.graph.simulation_config || {},
          visual_settings: importData.graph.visual_settings || {},
          change_description: 'Initial import from JSON export',
          created_by: req.user.id
        });
      }

      // Clean up uploaded file
      cleanupFile(req.file.path);

      logger.info('JSON graph imported successfully', {
        graphId: graph.id,
        userId: req.user.id,
        filename: req.file.originalname
      });

      res.status(201).json({
        message: 'Graph imported successfully from JSON export',
        graph: {
          id: graph.id,
          title: graph.title,
          description: graph.description,
          category: graph.category,
          is_public: graph.is_public,
          created_at: graph.created_at
        },
        importInfo: {
          versionsImported: importData.versions?.length || 1,
          originalExportInfo: importData.exportInfo
        }
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        cleanupFile(req.file.path);
      }
      throw error;
    }
  })
);

/**
 * GET /api/import-export/export/:id
 * Export graph as JSON
 */
router.get('/export/:id',
  requireEditor,
  logActivity('export_graph'),
  asyncHandler(async (req, res) => {
    const { includeVersions = false, format = 'json' } = req.query;
    
    // Find graph with user check
    const graph = await Graph.findOne({
      where: { 
        id: req.params.id,
        [require('sequelize').Op.or]: [
          { user_id: req.user.id },
          { is_public: true }
        ]
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }
      ]
    });

    if (!graph) {
      return res.status(404).json({
        error: 'Graph not found',
        code: 'GRAPH_NOT_FOUND'
      });
    }

    const exportData = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.email,
        exportVersion: '1.0',
        format: format
      },
      graph: {
        title: graph.title,
        description: graph.description,
        category: graph.category,
        is_public: graph.is_public,
        dot_code: graph.dot_code,
        simulation_config: graph.simulation_config,
        visual_settings: graph.visual_settings,
        metadata: graph.metadata,
        created_at: graph.created_at,
        updated_at: graph.updated_at,
        originalAuthor: {
          email: graph.user.email,
          name: `${graph.user.first_name || ''} ${graph.user.last_name || ''}`.trim()
        }
      }
    };

    // Include versions if requested
    if (includeVersions === 'true') {
      const versions = await GraphVersion.findAll({
        where: { graph_id: graph.id },
        order: [['version_number', 'ASC']],
        include: [
          {
            model: User,
            as: 'creator',
            attributes: ['email', 'first_name', 'last_name']
          }
        ]
      });
      
      exportData.versions = versions.map(version => ({
        version_number: version.version_number,
        dot_code: version.dot_code,
        simulation_config: version.simulation_config,
        visual_settings: version.visual_settings,
        change_description: version.change_description,
        created_at: version.created_at,
        created_by: version.creator ? {
          email: version.creator.email,
          name: `${version.creator.first_name || ''} ${version.creator.last_name || ''}`.trim()
        } : null
      }));
    }

    if (format === 'dot') {
      // Export as DOT file
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${graph.title.replace(/[^a-zA-Z0-9]/g, '_')}.dot"`);
      res.send(graph.dot_code);
    } else {
      // Export as JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${graph.title.replace(/[^a-zA-Z0-9]/g, '_')}_export.json"`);
      res.json(exportData);
    }

    logger.info('Graph exported', {
      graphId: graph.id,
      userId: req.user.id,
      format,
      includeVersions
    });
  })
);

/**
 * GET /api/import-export/export-multiple
 * Export multiple graphs as ZIP archive
 */
router.post('/export-multiple',
  requireEditor,
  [
    body('graphIds')
      .isArray({ min: 1, max: 50 })
      .withMessage('Must provide 1-50 graph IDs'),
    body('graphIds.*')
      .isUUID()
      .withMessage('Each graph ID must be a valid UUID'),
    body('format')
      .optional()
      .isIn(['json', 'dot', 'both'])
      .withMessage('Format must be json, dot, or both'),
    body('includeVersions')
      .optional()
      .isBoolean()
      .withMessage('includeVersions must be a boolean')
  ],
  logActivity('export_multiple_graphs'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { graphIds, format = 'json', includeVersions = false } = req.body;

    // Find accessible graphs
    const graphs = await Graph.findAll({
      where: { 
        id: graphIds,
        [require('sequelize').Op.or]: [
          { user_id: req.user.id },
          { is_public: true }
        ]
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'email', 'first_name', 'last_name']
        }
      ]
    });

    if (graphs.length === 0) {
      return res.status(404).json({
        error: 'No accessible graphs found',
        code: 'NO_GRAPHS_FOUND'
      });
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="vortexflow_graphs_${Date.now()}.zip"`);

    archive.pipe(res);

    // Add graphs to archive
    for (const graph of graphs) {
      const safeTitle = graph.title.replace(/[^a-zA-Z0-9]/g, '_');
      
      if (format === 'json' || format === 'both') {
        const exportData = {
          exportInfo: {
            exportedAt: new Date().toISOString(),
            exportedBy: req.user.email,
            exportVersion: '1.0'
          },
          graph: {
            title: graph.title,
            description: graph.description,
            category: graph.category,
            is_public: graph.is_public,
            dot_code: graph.dot_code,
            simulation_config: graph.simulation_config,
            visual_settings: graph.visual_settings,
            metadata: graph.metadata,
            created_at: graph.created_at,
            updated_at: graph.updated_at,
            originalAuthor: {
              email: graph.user.email,
              name: `${graph.user.first_name || ''} ${graph.user.last_name || ''}`.trim()
            }
          }
        };

        // Include versions if requested
        if (includeVersions) {
          const versions = await GraphVersion.findAll({
            where: { graph_id: graph.id },
            order: [['version_number', 'ASC']],
            include: [
              {
                model: User,
                as: 'creator',
                attributes: ['email', 'first_name', 'last_name']
              }
            ]
          });
          
          exportData.versions = versions.map(version => ({
            version_number: version.version_number,
            dot_code: version.dot_code,
            simulation_config: version.simulation_config,
            visual_settings: version.visual_settings,
            change_description: version.change_description,
            created_at: version.created_at,
            created_by: version.creator ? {
              email: version.creator.email,
              name: `${version.creator.first_name || ''} ${version.creator.last_name || ''}`.trim()
            } : null
          }));
        }

        archive.append(JSON.stringify(exportData, null, 2), { 
          name: `${safeTitle}/${safeTitle}_export.json` 
        });
      }

      if (format === 'dot' || format === 'both') {
        archive.append(graph.dot_code, { 
          name: `${safeTitle}/${safeTitle}.dot` 
        });
      }
    }

    // Add export manifest
    const manifest = {
      exportInfo: {
        exportedAt: new Date().toISOString(),
        exportedBy: req.user.email,
        totalGraphs: graphs.length,
        format: format,
        includeVersions: includeVersions
      },
      graphs: graphs.map(g => ({
        id: g.id,
        title: g.title,
        category: g.category,
        author: g.user.email
      }))
    };

    archive.append(JSON.stringify(manifest, null, 2), { name: 'export_manifest.json' });

    await archive.finalize();

    logger.info('Multiple graphs exported', {
      graphIds: graphs.map(g => g.id),
      userId: req.user.id,
      format,
      count: graphs.length
    });
  })
);

module.exports = router;
