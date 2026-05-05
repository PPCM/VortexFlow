const express = require('express');
const { Graph, SimulationSession, User } = require('../models');
const { validateSession, logActivity } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { Op } = require('sequelize');

const router = express.Router();

/**
 * GET /api/dashboard/stats
 * Get dashboard statistics
 */
router.get('/stats',
  validateSession,
  logActivity('dashboard_stats_view'),
  asyncHandler(async (req, res) => {
    try {
      // Récupérer les statistiques en parallèle
      const [
        totalGraphsResult,
        activeSimulationsResult,
        totalUsersResult,
        recentActivityResult
      ] = await Promise.allSettled([
        // Total des graphiques de l'utilisateur
        Graph.count({
          where: { user_id: req.user.id }
        }),
        
        // Simulations actives (toutes les simulations running)
        SimulationSession.count({
          where: { status: 'running' }
        }),
        
        // Total utilisateurs (pour les admins seulement)
        req.user.role === 'admin' ? User.count() : Promise.resolve(1),
        
        // Activité récente (graphiques modifiés dans les 7 derniers jours)
        Graph.count({
          where: {
            user_id: req.user.id,
            updatedAt: {
              [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            }
          }
        })
      ]);

      // Extraire les résultats ou utiliser des valeurs par défaut
      const stats = {
        totalGraphs: totalGraphsResult.status === 'fulfilled' ? totalGraphsResult.value : 0,
        activeSimulations: activeSimulationsResult.status === 'fulfilled' ? activeSimulationsResult.value : 0,
        totalUsers: totalUsersResult.status === 'fulfilled' ? totalUsersResult.value : 1,
        recentActivity: recentActivityResult.status === 'fulfilled' ? recentActivityResult.value : 0
      };

      res.json({
        success: true,
        data: stats,
        message: 'Dashboard statistics retrieved successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error retrieving dashboard statistics',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  })
);

/**
 * GET /api/dashboard/recent-graphs
 * Get recent graphs for dashboard
 */
router.get('/recent-graphs',
  validateSession,
  logActivity('dashboard_recent_graphs'),
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;

    const graphs = await Graph.findAll({
      where: { user_id: req.user.id },
      order: [['updatedAt', 'DESC']],
      limit,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: graphs,
      message: 'Recent graphs retrieved successfully'
    });
  })
);

/**
 * GET /api/dashboard/activity-feed
 * Get recent activity feed
 */
router.get('/activity-feed',
  validateSession,
  asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 10;

    // Pour l'instant, on simule un feed d'activité
    // Dans une vraie implémentation, on aurait une table d'activités
    const activities = [
      {
        id: 1,
        type: 'graph_created',
        message: 'Nouveau graphique créé',
        timestamp: new Date(),
        user: req.user.username
      },
      {
        id: 2,
        type: 'simulation_started',
        message: 'Simulation démarrée',
        timestamp: new Date(Date.now() - 3600000), // 1h ago
        user: req.user.username
      }
    ];

    res.json({
      success: true,
      data: activities.slice(0, limit),
      message: 'Activity feed retrieved successfully'
    });
  })
);

module.exports = router;
