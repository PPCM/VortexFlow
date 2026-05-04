/**
 * VortexFlow Backend - Routes Administration
 * Gestion des utilisateurs, graphiques, simulations et système
 */

const express = require('express');
const router = express.Router();
const { validateSession, requireAdmin, logActivity } = require('../middleware/auth');
const { User, Graph, SimulationSession } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

// Appliquer le middleware d'authentification admin à toutes les routes
router.use(validateSession);
router.use(requireAdmin);
// TEMPORAIRE: logActivity sans paramètre cause un problème
// router.use(logActivity);

/**
 * GET /api/admin/stats
 * Statistiques globales du système
 */
router.get('/stats', async (req, res) => {
  try {
    const [
      totalUsers,
      totalGraphs,
      totalSimulations,
      activeSimulations,
      recentUsers,
      todayActivity
    ] = await Promise.all([
      User.count(),
      Graph.count(),
      SimulationSession.count(),
      SimulationSession.count({ where: { status: 'running' } }),
      User.count({ 
        where: { 
          created_at: { 
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) 
          } 
        } 
      }),
      Promise.resolve(0) // ActivityLog n'existe pas encore
    ]);

    // Statistiques par rôle
    const usersByRole = await User.findAll({
      attributes: ['role', [require('sequelize').fn('COUNT', '*'), 'count']],
      group: ['role'],
      raw: true
    });

    // Graphiques par statut
    const graphsByStatus = await Graph.findAll({
      attributes: ['is_public', [require('sequelize').fn('COUNT', '*'), 'count']],
      group: ['is_public'],
      raw: true
    });

    // Simulations par statut
    const simulationsByStatus = await SimulationSession.findAll({
      attributes: ['status', [require('sequelize').fn('COUNT', '*'), 'count']],
      group: ['status'],
      raw: true
    });

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalGraphs,
          totalSimulations,
          activeSimulations,
          recentUsers,
          todayActivity
        },
        breakdown: {
          usersByRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = parseInt(item.count);
            return acc;
          }, {}),
          graphsByStatus: {
            public: graphsByStatus.find(g => g.is_public)?.count || 0,
            private: graphsByStatus.find(g => !g.is_public)?.count || 0
          },
          simulationsByStatus: simulationsByStatus.reduce((acc, item) => {
            acc[item.status] = parseInt(item.count);
            return acc;
          }, {})
        }
      },
      message: 'Admin statistics retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching admin stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});



/**
 * GET /api/admin/users
 * Liste paginée des utilisateurs avec filtres
 */
router.get('/users', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      role = '',
      status = '',
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Filtres
    if (search) {
      whereClause[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (role) {
      whereClause.role = role;
    }

    if (status === 'active') {
      whereClause.is_active = true;
    } else if (status === 'inactive') {
      whereClause.is_active = false;
    }

    const { count, rows: users } = await User.findAndCountAll({
      where: whereClause,
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset),
      attributes: { exclude: ['password_hash'] }
    });

    // Ajouter les statistiques par utilisateur
    const usersWithStats = await Promise.all(users.map(async (user) => {
      const [graphCount, simulationCount] = await Promise.all([
        Graph.count({ where: { user_id: user.id } }),
        SimulationSession.count({ where: { user_id: user.id } })
      ]);

      return {
        ...user.toJSON(),
        stats: {
          totalGraphs: graphCount,
          totalSimulations: simulationCount,
          lastActivity: user.last_login || null // Utiliser last_login à la place
        }
      };
    }));

    res.json({
      success: true,
      data: {
        users: usersWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      },
      message: 'Users retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/users
 * Créer un nouvel utilisateur
 */
router.post('/users', async (req, res) => {
  try {
    const { email, password, first_name, last_name, role = 'viewer' } = req.body;

    // Validation des champs requis
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, first name, and last name are required'
      });
    }

    // Vérifier que l'email n'existe pas déjà
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
    }

    // Valider le rôle
    const validRoles = ['viewer', 'editor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be viewer, editor, or admin'
      });
    }

    // Créer l'utilisateur
    const user = await User.create({
      email,
      password_hash: password, // Le modèle User devrait hasher automatiquement
      first_name,
      last_name,
      role,
      is_active: true
    });

    res.status(201).json({
      success: true,
      data: {
        ...user.toJSON(),
        password_hash: undefined
      },
      message: 'User created successfully'
    });

  } catch (error) {
    logger.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * Modifier un utilisateur
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role, is_active, first_name, last_name, email } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Empêcher la modification de son propre compte admin
    if (user.id === req.user.id && (role !== user.role || is_active === false)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot modify your own admin account role or deactivate it'
      });
    }

    // Vérifier l'unicité de l'email si modifié
    if (email && email !== user.email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already exists'
        });
      }
    }

    await user.update({
      role: role || user.role,
      is_active: is_active !== undefined ? is_active : user.is_active,
      first_name: first_name || user.first_name,
      last_name: last_name || user.last_name,
      email: email || user.email
    });

    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        password_hash: undefined
      },
      message: 'User updated successfully'
    });

  } catch (error) {
    logger.error('Error updating user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Supprimer un utilisateur (soft delete)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Empêcher la suppression de son propre compte
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Soft delete - désactiver au lieu de supprimer
    await user.update({ is_active: false });

    res.json({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/admin/users/:id/permanent
 * Supprimer définitivement un utilisateur (hard delete)
 */
router.delete('/users/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Empêcher la suppression de son propre compte
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Empêcher la suppression du dernier admin
    if (user.role === 'admin') {
      const adminCount = await User.count({ where: { role: 'admin', is_active: true } });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the last active admin'
        });
      }
    }

    // Suppression définitive - hard delete
    await user.destroy();

    res.json({
      success: true,
      message: 'User permanently deleted'
    });

  } catch (error) {
    logger.error('Error permanently deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to permanently delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/users/:id/reset-password
 * Réinitialiser le mot de passe d'un utilisateur
 */
router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({
        success: false,
        message: 'New password is required'
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    await user.update({ password_hash: new_password });

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    logger.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset password',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/users/bulk-action
 * Actions en masse sur les utilisateurs
 */
router.post('/users/bulk-action', async (req, res) => {
  try {
    const { action, user_ids } = req.body;

    if (!action || !user_ids || !Array.isArray(user_ids)) {
      return res.status(400).json({
        success: false,
        message: 'Action and user_ids array are required'
      });
    }

    // Empêcher l'action sur son propre compte
    if (user_ids.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot perform bulk actions on your own account'
      });
    }

    let updateData = {};
    let message = '';

    let affectedCount = 0;

    switch (action) {
      case 'activate':
        updateData = { is_active: true };
        message = 'Users activated successfully';
        [affectedCount] = await User.update(updateData, {
          where: {
            id: user_ids
          }
        });
        break;
      case 'deactivate':
        updateData = { is_active: false };
        message = 'Users deactivated successfully';
        [affectedCount] = await User.update(updateData, {
          where: {
            id: user_ids
          }
        });
        break;
      case 'delete':
        updateData = { is_active: false };
        message = 'Users deleted successfully';
        [affectedCount] = await User.update(updateData, {
          where: {
            id: user_ids
          }
        });
        break;
      case 'permanent_delete': {
        // Empêcher la suppression des derniers admins
        const adminCount = await User.count({
          where: {
            role: 'admin',
            is_active: true,
            id: { [Op.not]: user_ids }
          }
        });

        const adminToDeleteCount = await User.count({
          where: {
            role: 'admin',
            id: user_ids
          }
        });

        if (adminCount === 0 && adminToDeleteCount > 0) {
          return res.status(400).json({
            success: false,
            message: 'Cannot delete all active admin users'
          });
        }

        affectedCount = await User.destroy({
          where: {
            id: user_ids
          }
        });
        message = 'Users permanently deleted';
        break;
      }
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action. Use activate, deactivate, delete, or permanent_delete'
        });
    }

    res.json({
      success: true,
      data: { affected_count: affectedCount },
      message
    });

  } catch (error) {
    logger.error('Error performing bulk action:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform bulk action',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/graphs
 * Liste paginée des graphiques avec filtres
 */
router.get('/graphs', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = '',
      userId = '',
      isPublic = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Filtres
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (userId) {
      whereClause.user_id = userId;
    }

    if (isPublic === 'true') {
      whereClause.is_public = true;
    } else if (isPublic === 'false') {
      whereClause.is_public = false;
    }

    const { count, rows: graphs } = await Graph.findAndCountAll({
      where: whereClause,
      include: [{
        model: User,
        attributes: ['id', 'first_name', 'last_name', 'email']
      }],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Ajouter les statistiques par graphique
    const graphsWithStats = await Promise.all(graphs.map(async (graph) => {
      const simulationCount = await SimulationSession.count({
        where: { graph_id: graph.id }
      });

      return {
        ...graph.toJSON(),
        stats: {
          totalSimulations: simulationCount
        }
      };
    }));

    res.json({
      success: true,
      data: {
        graphs: graphsWithStats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      },
      message: 'Graphs retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching graphs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch graphs',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * DELETE /api/admin/graphs/:id
 * Supprimer un graphique
 */
router.delete('/graphs/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const graph = await Graph.findByPk(id);
    if (!graph) {
      return res.status(404).json({
        success: false,
        message: 'Graph not found'
      });
    }

    // Vérifier s'il y a des simulations actives
    const activeSimulations = await SimulationSession.count({
      where: {
        graph_id: id,
        status: 'running'
      }
    });

    if (activeSimulations > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete graph with active simulations'
      });
    }

    await graph.destroy();

    res.json({
      success: true,
      message: 'Graph deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting graph:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete graph',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/simulations
 * Liste paginée des sessions de simulation avec filtres
 */
router.get('/simulations', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = '',
      userId = '',
      graphId = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Filtres
    if (status) {
      whereClause.status = status;
    }

    if (userId) {
      whereClause.user_id = userId;
    }

    if (graphId) {
      whereClause.graph_id = graphId;
    }

    const { count, rows: simulations } = await SimulationSession.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          attributes: ['id', 'first_name', 'last_name', 'email']
        },
        {
          model: Graph,
          attributes: ['id', 'name', 'description']
        }
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: {
        simulations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      },
      message: 'Simulations retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching simulations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch simulations',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/simulations/:id/stop
 * Arrêter une simulation
 */
router.post('/simulations/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    const simulation = await SimulationSession.findByPk(id);
    if (!simulation) {
      return res.status(404).json({
        success: false,
        message: 'Simulation not found'
      });
    }

    if (simulation.status !== 'running') {
      return res.status(400).json({
        success: false,
        message: 'Simulation is not running'
      });
    }

    await simulation.update({
      status: 'completed',
      end_time: new Date()
    });

    // TODO: Notifier via WebSocket si nécessaire

    res.json({
      success: true,
      data: simulation,
      message: 'Simulation stopped successfully'
    });

  } catch (error) {
    logger.error('Error stopping simulation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to stop simulation',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/activity
 * Journal d'activité du système
 */
router.get('/activity', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userId = '',
      action = '',
      startDate = '',
      endDate = '',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const whereClause = {};

    // Filtres
    if (userId) {
      whereClause.user_id = userId;
    }

    if (action) {
      whereClause.action = action;
    }

    if (startDate) {
      whereClause.created_at = {
        [Op.gte]: new Date(startDate)
      };
    }

    if (endDate) {
      whereClause.created_at = {
        ...whereClause.created_at,
        [Op.lte]: new Date(endDate)
      };
    }

    // ActivityLog n'existe pas encore - retourner des données vides
    const count = 0;
    const activities = [];

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          pages: Math.ceil(count / limit)
        }
      },
      message: 'Activity log retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching activity log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity log',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/system
 * Informations système et configuration
 */
router.get('/system', async (req, res) => {
  try {
    const systemInfo = {
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      environment: process.env.NODE_ENV,
      uptime: Math.floor(process.uptime()),
      memory: process.memoryUsage(),
      platform: process.platform,
      architecture: process.arch,
      database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        name: process.env.DB_NAME
      },
      redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT
      }
    };

    res.json({
      success: true,
      data: systemInfo,
      message: 'System information retrieved successfully'
    });

  } catch (error) {
    logger.error('Error fetching system info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system information',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * POST /api/admin/backup
 * Créer une sauvegarde de la base de données
 */
router.post('/backup', async (req, res) => {
  try {
    // TODO: Implémenter la sauvegarde de la base de données
    res.json({
      success: false,
      message: 'Backup functionality not yet implemented'
    });

  } catch (error) {
    logger.error('Error creating backup:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
