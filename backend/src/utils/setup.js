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

    // Create sample graphs
    const sampleGraphs = [
      {
        title: 'Simple Network Flow',
        description: 'A basic network topology with routers and servers',
        dot_code: `digraph NetworkFlow {
  rankdir=LR;
  
  // Nodes with simulation properties
  Router1 [label="Router A", capacity=100, processing_time=1.0, node_type="router"]
  Server1 [label="Web Server", capacity=50, processing_time=2.0, node_type="server"]
  Server2 [label="Database", capacity=200, processing_time=0.5, node_type="database"]
  
  // Edges with flow properties
  Router1 -> Server1 [bandwidth=10, latency=0.2, data_type="http_requests"]
  Server1 -> Server2 [bandwidth=5, latency=0.1, data_type="db_queries"]
}`,
        is_public: true,
        tags: ['network', 'example', 'simple'],
        category: 'Network',
        is_template: true,
        template_category: 'Network Topology'
      },
      {
        title: 'Data Pipeline Simulation',
        description: 'Complex data processing pipeline with multiple stages',
        dot_code: `digraph DataPipeline {
  rankdir=TB;
  
  // Data Sources
  DataSource1 [label="Raw Data\\nIngestion", capacity=1000, processing_time=0.1, node_type="source"]
  DataSource2 [label="Stream Data\\nIngestion", capacity=500, processing_time=0.05, node_type="source"]
  
  // Processing Stages
  Cleaner [label="Data Cleaner", capacity=200, processing_time=2.0, node_type="processor"]
  Transformer [label="Transformer", capacity=150, processing_time=3.0, node_type="processor"]
  Aggregator [label="Aggregator", capacity=100, processing_time=1.5, node_type="processor"]
  
  // Storage
  DataLake [label="Data Lake", capacity=10000, processing_time=0.2, node_type="storage"]
  DataWarehouse [label="Data Warehouse", capacity=5000, processing_time=0.5, node_type="storage"]
  
  // Flows
  DataSource1 -> Cleaner [bandwidth=50, latency=0.1, data_type="raw_data"]
  DataSource2 -> Cleaner [bandwidth=25, latency=0.1, data_type="stream_data"]
  Cleaner -> Transformer [bandwidth=30, latency=0.2, data_type="clean_data"]
  Transformer -> Aggregator [bandwidth=20, latency=0.2, data_type="transformed_data"]
  Transformer -> DataLake [bandwidth=40, latency=0.1, data_type="processed_data"]
  Aggregator -> DataWarehouse [bandwidth=15, latency=0.3, data_type="aggregated_data"]
}`,
        is_public: true,
        tags: ['data', 'pipeline', 'etl', 'complex'],
        category: 'Data Processing',
        is_template: true,
        template_category: 'Data Pipeline'
      },
      {
        title: 'Microservices Architecture',
        description: 'Microservices communication pattern with API gateway',
        dot_code: `digraph Microservices {
  rankdir=TB;
  
  // Client and Gateway
  Client [label="Client App", capacity=0, processing_time=0, node_type="client"]
  Gateway [label="API Gateway", capacity=500, processing_time=0.1, node_type="gateway"]
  
  // Services
  AuthService [label="Auth Service", capacity=100, processing_time=0.5, node_type="service"]
  UserService [label="User Service", capacity=80, processing_time=1.0, node_type="service"]
  OrderService [label="Order Service", capacity=60, processing_time=1.5, node_type="service"]
  PaymentService [label="Payment Service", capacity=40, processing_time=2.0, node_type="service"]
  
  // Databases
  AuthDB [label="Auth DB", capacity=1000, processing_time=0.1, node_type="database"]
  UserDB [label="User DB", capacity=1000, processing_time=0.1, node_type="database"]
  OrderDB [label="Order DB", capacity=800, processing_time=0.2, node_type="database"]
  PaymentDB [label="Payment DB", capacity=500, processing_time=0.3, node_type="database"]
  
  // Client flows
  Client -> Gateway [bandwidth=20, latency=0.05, data_type="api_requests"]
  
  // Gateway to services
  Gateway -> AuthService [bandwidth=5, latency=0.02, data_type="auth_requests"]
  Gateway -> UserService [bandwidth=8, latency=0.02, data_type="user_requests"]
  Gateway -> OrderService [bandwidth=6, latency=0.02, data_type="order_requests"]
  Gateway -> PaymentService [bandwidth=3, latency=0.02, data_type="payment_requests"]
  
  // Service to database flows
  AuthService -> AuthDB [bandwidth=5, latency=0.01, data_type="auth_queries"]
  UserService -> UserDB [bandwidth=8, latency=0.01, data_type="user_queries"]
  OrderService -> OrderDB [bandwidth=6, latency=0.01, data_type="order_queries"]
  PaymentService -> PaymentDB [bandwidth=3, latency=0.01, data_type="payment_queries"]
  
  // Inter-service communication
  OrderService -> UserService [bandwidth=2, latency=0.05, data_type="user_validation"]
  OrderService -> PaymentService [bandwidth=2, latency=0.05, data_type="payment_processing"]
}`,
        is_public: true,
        tags: ['microservices', 'architecture', 'api', 'distributed'],
        category: 'Architecture',
        is_template: true,
        template_category: 'System Architecture'
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
