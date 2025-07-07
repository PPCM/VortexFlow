const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GraphVersion = sequelize.define('GraphVersion', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  graph_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'graphs',
      key: 'id'
    }
  },
  version_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  dot_code: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  simulation_config: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  visual_settings: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_major_version: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  changes_summary: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'graph_versions',
  indexes: [
    {
      fields: ['graph_id', 'version_number'],
      unique: true
    },
    {
      fields: ['graph_id']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['is_major_version']
    }
  ]
});

// Instance methods
GraphVersion.prototype.restore = async function() {
  const Graph = require('./Graph');
  const graph = await Graph.findByPk(this.graph_id);
  
  if (graph) {
    await graph.update({
      dot_code: this.dot_code,
      simulation_config: this.simulation_config || graph.simulation_config,
      visual_settings: this.visual_settings || graph.visual_settings,
      version: graph.version + 1
    });
    
    // Create a new version entry for the restore action
    await GraphVersion.create({
      graph_id: this.graph_id,
      version_number: graph.version,
      dot_code: this.dot_code,
      simulation_config: this.simulation_config,
      visual_settings: this.visual_settings,
      notes: `Restored from version ${this.version_number}`,
      changes_summary: `Restored from version ${this.version_number}`
    });
    
    return graph;
  }
  
  throw new Error('Graph not found');
};

// Class methods
GraphVersion.findByGraph = function(graphId, options = {}) {
  return this.findAll({
    where: { graph_id: graphId },
    order: [['version_number', 'DESC']],
    ...options
  });
};

GraphVersion.findLatestByGraph = function(graphId) {
  return this.findOne({
    where: { graph_id: graphId },
    order: [['version_number', 'DESC']]
  });
};

GraphVersion.findMajorVersions = function(graphId) {
  return this.findAll({
    where: { 
      graph_id: graphId,
      is_major_version: true
    },
    order: [['version_number', 'DESC']]
  });
};

GraphVersion.createFromGraph = async function(graph, notes = null) {
  return this.create({
    graph_id: graph.id,
    version_number: graph.version,
    dot_code: graph.dot_code,
    simulation_config: graph.simulation_config,
    visual_settings: graph.visual_settings,
    notes: notes,
    changes_summary: notes || 'Version created'
  });
};

module.exports = GraphVersion;
