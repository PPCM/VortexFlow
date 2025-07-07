const sequelize = require('../config/database');
const User = require('./User');
const Graph = require('./Graph');
const GraphVersion = require('./GraphVersion');
const GraphShare = require('./GraphShare');
const SimulationSession = require('./SimulationSession');

// Define associations
User.hasMany(Graph, { foreignKey: 'user_id', as: 'graphs' });
Graph.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(SimulationSession, { foreignKey: 'user_id', as: 'simulationSessions' });
SimulationSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Graph.hasMany(GraphVersion, { foreignKey: 'graph_id', as: 'versions' });
GraphVersion.belongsTo(Graph, { foreignKey: 'graph_id', as: 'graph' });

Graph.hasMany(GraphShare, { foreignKey: 'graph_id', as: 'shares' });
GraphShare.belongsTo(Graph, { foreignKey: 'graph_id', as: 'graph' });

Graph.hasMany(SimulationSession, { foreignKey: 'graph_id', as: 'simulationSessions' });
SimulationSession.belongsTo(Graph, { foreignKey: 'graph_id', as: 'graph' });

User.hasMany(GraphShare, { foreignKey: 'shared_with_user_id', as: 'sharedGraphs' });
GraphShare.belongsTo(User, { foreignKey: 'shared_with_user_id', as: 'sharedWithUser' });

module.exports = {
  sequelize,
  User,
  Graph,
  GraphVersion,
  GraphShare,
  SimulationSession
};
