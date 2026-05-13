const { User } = require('../models');
const logger = require('./logger');

// Default credentials documented in backend/.env.example. They MUST NOT be
// used in production. See AUTH-PROD-GUARD below for the enforcement.
const DEFAULT_ADMIN_PASSWORD = 'change-me-in-production-please';
const LEGACY_DEFAULT_ADMIN_PASSWORD = 'VortexFlow2024!';

/**
 * Setup default admin user.
 *
 * In non-production environments this seeds an admin from
 * ADMIN_EMAIL / ADMIN_PASSWORD (with fallbacks). In production, we REFUSE
 * to seed an admin with a publicly-documented default password — the server
 * boot fails fast instead, which is preferable to silently shipping a
 * known-credential admin.
 */
const setupAdminUser = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

    // AUTH-PROD-GUARD: refuse known-default passwords in production.
    if (process.env.NODE_ENV === 'production') {
      if (
        adminPassword === DEFAULT_ADMIN_PASSWORD ||
        adminPassword === LEGACY_DEFAULT_ADMIN_PASSWORD ||
        !process.env.ADMIN_PASSWORD
      ) {
        const message =
          '[FATAL] ADMIN_PASSWORD is unset or set to a publicly-documented ' +
          'default value. Refusing to seed an admin user in production. ' +
          'Set a strong ADMIN_PASSWORD in the environment before starting.';
        logger.error(message);
        throw new Error(message);
      }
    }

    // Check if admin user already exists
    const existingAdmin = await User.findByEmail(adminEmail);
    
    if (existingAdmin) {
      logger.info('Admin user already exists', { email: adminEmail });
      return existingAdmin;
    }

    // Create admin user
    const adminUser = await User.create({
      email: adminEmail,
      password_hash: adminPassword, // Will be hashed by the model hook
      role: 'admin',
      first_name: 'System',
      last_name: 'Administrator',
      is_active: true,
      preferences: {
        theme: 'dark',
        notifications: {
          email: true,
          browser: true
        },
        simulation: {
          defaultSpeed: 1.0,
          showMetrics: true,
          autoSave: true
        }
      }
    });

    logger.info('Default admin user created successfully', {
      id: adminUser.id,
      email: adminUser.email,
      role: adminUser.role
    });

    // Log security event
    logger.warn('Default admin account created - CHANGE PASSWORD IMMEDIATELY', {
      email: adminEmail,
      securityEvent: 'DEFAULT_ADMIN_CREATED',
      timestamp: new Date().toISOString()
    });

    return adminUser;

  } catch (error) {
    logger.error('Failed to setup admin user:', error);
    throw error;
  }
};

/**
 * Create sample data for development
 */
const createSampleData = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      logger.info('Skipping sample data creation in production');
      return;
    }

    const { Graph } = require('../models');

    // Get admin user
    const adminUser = await User.findByEmail(process.env.ADMIN_EMAIL || 'admin@admin.com');
    if (!adminUser) {
      logger.warn('Admin user not found, skipping sample data creation');
      return;
    }

    // Check if sample data already exists
    const existingGraphs = await Graph.findByUser(adminUser.id);
    if (existingGraphs.length > 0) {
      logger.info('Sample data already exists, skipping creation');
      return;
    }

    // VortexFlow Showcase — single demo graph exercising every documented
    // capability: the three nodeRoles (generator / relay / sink), all five 3D
    // geometries (Sphere / Box / Cylinder / Cone / Torus), both dropPolicies
    // (tail / head), failure_rate, weighted maxParticleFlow routing, variable
    // particleSpeed, queue saturation and legacy attributes (bandwidth /
    // capacity / latency). Used as the out-of-the-box demo when an admin
    // first opens the app.
    const sampleGraphs = [
      {
        title: 'VortexFlow Showcase',
        description: 'Démonstration complète : générateurs, relais, sinks, '
          + 'les 5 géométries 3D, drop policies, failure_rate, routage pondéré '
          + 'et saturation de file. Le pipeline simule un flux IoT : capteurs '
          + '→ load balancer → cluster de processeurs (un instable, un lent) '
          + '→ cache mémoire → archive rapide / analytics avec filtre saturé.',
        dot_code: `digraph VortexFlowShowcase {
  rankdir=LR;
  defaultNodeSize=1.2;
  particlesEnabled=true;
  autoColors=false;

  // ---------------------------------------------------------------
  // Generators — IoT sensors emitting telemetry packets (Cone)
  // ---------------------------------------------------------------
  SensorA [
    label="Capteur A",
    nodeRole="generator",
    particleGeneration=3,
    geometry="Cone",
    dimensions="{radius: 0.8, height: 1.6}",
    color="#ff6b35"
  ];

  SensorB [
    label="Capteur B",
    nodeRole="generator",
    particleGeneration=2,
    geometry="Cone",
    dimensions="{radius: 0.8, height: 1.6}",
    color="#ffa726"
  ];

  // ---------------------------------------------------------------
  // Load balancer — weighted dispatch (Torus ring)
  // ---------------------------------------------------------------
  LoadBalancer [
    label="Load Balancer",
    nodeRole="relay",
    maxParticleProcessing=20,
    queue_size=50,
    processing_time=100,
    geometry="Torus",
    dimensions="{radius: 1.2, tube: 0.4}",
    color="#42a5f5"
  ];

  // ---------------------------------------------------------------
  // Compute cluster — three parallel processors (Cylinder).
  //   P1 = nominal, P2 = unstable (failure_rate), P3 = slow goulot.
  // ---------------------------------------------------------------
  Processor1 [
    label="Processeur P1",
    nodeRole="relay",
    maxParticleProcessing=5,
    queue_size=20,
    processing_time=300,
    geometry="Cylinder",
    dimensions="{radius: 0.7, height: 1.8}",
    color="#66bb6a"
  ];

  Processor2 [
    label="Processeur P2 (instable)",
    nodeRole="relay",
    maxParticleProcessing=4,
    queue_size=15,
    processing_time=400,
    failure_rate=0.25,
    geometry="Cylinder",
    dimensions="{radius: 0.7, height: 1.8}",
    color="#ef5350"
  ];

  Processor3 [
    label="Processeur P3 (lent)",
    nodeRole="relay",
    maxParticleProcessing=1,
    queue_size=10,
    processing_time=800,
    geometry="Cylinder",
    dimensions="{radius: 0.7, height: 1.8}",
    color="#ab47bc"
  ];

  // ---------------------------------------------------------------
  // In-memory cache — fast aggregator (Sphere)
  // ---------------------------------------------------------------
  Cache [
    label="Cache mémoire",
    nodeRole="relay",
    maxParticleProcessing=30,
    queue_size=100,
    processing_time=50,
    geometry="Sphere",
    dimensions="{radius: 1.0}",
    color="#26c6da"
  ];

  // ---------------------------------------------------------------
  // Analytics filter — saturated relay, dropPolicy="tail"
  // ---------------------------------------------------------------
  Filter [
    label="Filtre Analytics",
    nodeRole="relay",
    maxParticleProcessing=2,
    queue_size=5,
    dropPolicy="tail",
    processing_time=1500,
    geometry="Cylinder",
    dimensions="{radius: 0.6, height: 1.4}",
    color="#ffca28"
  ];

  // ---------------------------------------------------------------
  // Sinks — terminal storage (Box). Analytics also demos dropPolicy="head".
  // ---------------------------------------------------------------
  Archive [
    label="Archive S3",
    nodeRole="sink",
    geometry="Box",
    dimensions="{width: 2.0, height: 1.4, depth: 1.4}",
    color="#5c6bc0"
  ];

  Analytics [
    label="Analytics DB",
    nodeRole="sink",
    queue_size=10,
    dropPolicy="head",
    geometry="Box",
    dimensions="{width: 2.0, height: 1.4, depth: 1.4}",
    color="#7e57c2"
  ];

  // ---------------------------------------------------------------
  // Edges — bandwidth/latency/capacity legacy attrs + DES particleSpeed
  // + maxParticleFlow weighting (60/30/10 split downstream of LB).
  // ---------------------------------------------------------------
  SensorA -> LoadBalancer [label="3 p/s", particleSpeed=1.5, bandwidth=10, latency=0.05, color="#ff6b35"];
  SensorB -> LoadBalancer [label="2 p/s", particleSpeed=1.5, bandwidth=10, latency=0.05, color="#ffa726"];

  LoadBalancer -> Processor1 [label="60%", maxParticleFlow=6, particleSpeed=1.2, capacity=60, color="#66bb6a"];
  LoadBalancer -> Processor2 [label="30%", maxParticleFlow=3, particleSpeed=1.2, capacity=30, color="#ef5350"];
  LoadBalancer -> Processor3 [label="10%", maxParticleFlow=1, particleSpeed=1.2, capacity=10, color="#ab47bc"];

  Processor1 -> Cache [particleSpeed=2.0, bandwidth=20, color="#66bb6a"];
  Processor2 -> Cache [particleSpeed=2.0, bandwidth=20, color="#ef5350"];
  Processor3 -> Cache [particleSpeed=2.0, bandwidth=20, color="#ab47bc"];

  Cache -> Archive [label="hot path", maxParticleFlow=10, particleSpeed=2.5, bandwidth=40, color="#26c6da"];
  Cache -> Filter  [label="cold path", maxParticleFlow=4, particleSpeed=0.8, bandwidth=8, color="#ffca28", style="dashed"];
  Filter -> Analytics [particleSpeed=1.0, bandwidth=4, color="#ffca28"];
}`,
        is_public: true,
        tags: ['showcase', 'demo', 'des', '3d', 'iot'],
        category: 'Showcase',
        is_template: true,
        template_category: 'Demo'
      }
    ];

    for (const graphData of sampleGraphs) {
      await Graph.create({
        ...graphData,
        user_id: adminUser.id
      });
    }

    logger.info('Sample data created successfully', {
      graphsCreated: sampleGraphs.length
    });

  } catch (error) {
    logger.error('Failed to create sample data:', error);
    // Don't throw error, just log it as sample data is optional
  }
};

/**
 * Initialize database with required data
 */
const initializeDatabase = async () => {
  try {
    logger.info('Initializing database...');

    // Setup admin user
    await setupAdminUser();

    // Create sample data in development
    if (process.env.NODE_ENV === 'development') {
      await createSampleData();
    }

    logger.info('Database initialization completed successfully');

  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
};

/**
 * Cleanup expired sessions and data
 */
const cleanupExpiredData = async () => {
  try {
    const { GraphShare, SimulationSession } = require('../models');

    // Cleanup expired graph shares
    const expiredShares = await GraphShare.cleanupExpired();
    logger.info('Cleaned up expired graph shares', { count: expiredShares });

    // Cleanup old simulation sessions (older than 30 days)
    const oldSessions = await SimulationSession.cleanupOldSessions(30);
    logger.info('Cleaned up old simulation sessions', { count: oldSessions });

  } catch (error) {
    logger.error('Failed to cleanup expired data:', error);
  }
};

/**
 * Health check for system components
 */
const healthCheck = async () => {
  const status = {
    database: false,
    redis: false,
    adminUser: false,
    timestamp: new Date().toISOString()
  };

  try {
    // Check database connection
    const { sequelize } = require('../models');
    await sequelize.authenticate();
    status.database = true;

    // Check if admin user exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@admin.com';
    const adminUser = await User.findByEmail(adminEmail);
    status.adminUser = !!adminUser;

    logger.info('Health check completed', status);
    return status;

  } catch (error) {
    logger.error('Health check failed:', error);
    return status;
  }
};

module.exports = {
  setupAdminUser,
  createSampleData,
  initializeDatabase,
  cleanupExpiredData,
  healthCheck
};
