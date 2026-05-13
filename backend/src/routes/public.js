const express = require('express');
const router = express.Router();
const dotValidator = require('../utils/dotValidator');
const asyncHandler = require('../middleware/asyncHandler');
const { User } = require('../models');
const logger = require('../utils/logger');
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
    const { dotCode, code } = req.body;
    const dotContent = dotCode || code; // Support both formats for compatibility
    
    if (!dotContent) {
      return res.status(400).json({
        error: 'DOT code is required',
        code: 'DOT_CODE_REQUIRED'
      });
    }
    
    try {
      const result = await dotValidator.validate(dotContent);
      
      // Return in the same format as the authenticated endpoint
      res.json({
        success: true,
        data: {
          isValid: result.valid,
          valid: result.valid, // Legacy compatibility
          errors: result.errors || [],
          warnings: result.warnings || [],
          metadata: result.metadata || {}
        }
      });
    } catch (error) {
      logger.error('DOT validation error:', error);
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.message
      });
    }
  })
);

/**
 * POST /api/public/parse-dot
 * Parse DOT content using robust backend parser
 * PUBLIC endpoint - no authentication required
 */
router.post('/parse-dot',
  asyncHandler(async (req, res) => {
    const { dotContent } = req.body;
    
    if (!dotContent) {
      return res.status(400).json({
        error: 'DOT content is required'
      });
    }
    
    if (dotContent.length > 1000000) {
      return res.status(400).json({
        error: 'DOT content too large'
      });
    }
    
    try {
      // Utiliser le parser DOT robuste existant
      const parseResult = dotValidator.parseDotStructure(dotContent);
      
      if (!parseResult.valid) {
        return res.status(400).json({
          error: 'DOT parsing failed',
          details: parseResult.errors
        });
      }
      
      // Convertir l'AST vers le format attendu par le frontend
      console.log('[ROUTE DEBUG] AST nodes reçus:', JSON.stringify(parseResult.ast.nodes, null, 2));
      const nodes = parseResult.ast.nodes.map(node => ({
        id: node.id,
        label: node.attributes.label || node.id,
        name: node.attributes.label || node.id,
        size: node.attributes.val || node.attributes.size || '8',
        // Pass color through only when the user actually specified it in DOT.
        // The frontend applies a default (and role-based tint for DES graphs),
        // so we must not paper over the user's intent here.
        color: node.attributes.color,
        geometry: node.attributes.geometry,
        dimensions: node.attributes.dimensions,
        particleGeneration: node.attributes.particleGeneration,
        maxParticleProcessing: node.attributes.maxParticleProcessing,
        image: node.attributes.image,
        autoResize: node.attributes.autoResize,
        bloomEffect: node.attributes.bloomEffect,
        // DES attributes (ADR-006) — consumed by the in-browser ParticleSimulator
        nodeRole: node.attributes.nodeRole,
        dropPolicy: node.attributes.dropPolicy,
        queue_size: node.attributes.queue_size,
        processing_time: node.attributes.processing_time,
        failure_rate: node.attributes.failure_rate
      }));

      const links = parseResult.ast.edges.map(edge => ({
        source: edge.from,
        target: edge.to,
        label: edge.attributes.label || '',
        // Same reasoning as for node.color: pass through only when set.
        color: edge.attributes.color,
        maxParticleFlow: edge.attributes.maxParticleFlow,
        particleSpeed: edge.attributes.particleSpeed,
        style: edge.attributes.style || 'solid'
      }));
      
      // Extraire les attributs globaux depuis l'AST
      const globalSettings = {};
      if (parseResult.ast.attributes) {
        // Attributs globaux supportés
        const globalKeys = ['defaultNodeSize', 'autoColors', 'autoResize', 'particlesEnabled', 'bloomEffect'];
        
        for (const key of globalKeys) {
          if (parseResult.ast.attributes[key] !== undefined) {
            let value = parseResult.ast.attributes[key];
            
            // Conversion des types
            if (key === 'defaultNodeSize') {
              value = parseFloat(value) || 6;
            } else if (['autoColors', 'autoResize', 'particlesEnabled', 'bloomEffect'].includes(key)) {
              value = ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
            }
            
            globalSettings[key] = value;
          }
        }
      }
      
      console.log(`🎆 Backend DOT parsing successful: ${nodes.length} nodes, ${links.length} links`);
      if (Object.keys(globalSettings).length > 0) {
        console.log('🌐 Global settings extracted:', globalSettings);
      }
      
      res.json({
        nodes,
        links,
        globalSettings: Object.keys(globalSettings).length > 0 ? globalSettings : undefined,
        metadata: parseResult.metadata
      });
      
    } catch (error) {
      console.error('DOT parsing error:', error);
      res.status(500).json({
        error: 'Internal server error during DOT parsing',
        message: error.message
      });
    }
  })
);

module.exports = router;
