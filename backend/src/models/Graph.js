const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Graph = sequelize.define('Graph', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 255]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dot_code: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  simulation_config: {
    type: DataTypes.JSONB,
    defaultValue: {
      speed: 1.0,
      showParticles: true,
      showMetrics: true,
      maxParticles: 100,
      particleSize: 2,
      particleColors: {
        default: '#4CAF50',
        packets: '#2196F3',
        queries: '#FF9800',
        data: '#9C27B0'
      },
      physics: {
        gravity: 0.1,
        damping: 0.9,
        repulsion: 1000
      }
    }
  },
  visual_settings: {
    type: DataTypes.JSONB,
    defaultValue: {
      layout: 'force-directed',
      nodeSize: 10,
      edgeWidth: 2,
      nodeColors: {
        default: '#42A5F5',
        router: '#FF7043',
        server: '#66BB6A',
        database: '#AB47BC'
      },
      backgroundColor: '#1a1a1a',
      showLabels: true,
      show3D: true
    }
  },
  is_public: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  version: {
    type: DataTypes.INTEGER,
    defaultValue: 1
  },
  view_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  is_template: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  template_category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  last_simulation: {
    type: DataTypes.DATE,
    allowNull: true
  },
  performance_metrics: {
    type: DataTypes.JSONB,
    defaultValue: {
      avgFrameRate: 0,
      maxNodes: 0,
      maxEdges: 0,
      renderTime: 0
    }
  }
}, {
  tableName: 'graphs',
  indexes: [
    {
      fields: ['user_id']
    },
    {
      fields: ['is_public']
    },
    {
      fields: ['title']
    },
    {
      fields: ['tags'],
      using: 'gin'
    },
    {
      fields: ['category']
    },
    {
      fields: ['is_template']
    },
    {
      fields: ['createdAt']
    }
  ]
});

// Instance methods
Graph.prototype.incrementViewCount = async function() {
  this.view_count += 1;
  await this.save({ fields: ['view_count'] });
};

Graph.prototype.updateLastSimulation = async function() {
  this.last_simulation = new Date();
  await this.save({ fields: ['last_simulation'] });
};

Graph.prototype.createVersion = async function() {
  const GraphVersion = require('./GraphVersion');
  return GraphVersion.create({
    graph_id: this.id,
    version_number: this.version,
    dot_code: this.dot_code,
    simulation_config: this.simulation_config,
    visual_settings: this.visual_settings
  });
};

Graph.prototype.canBeAccessedBy = function(user) {
  if (!user) return this.is_public;
  if (this.user_id === user.id || user.role === 'admin') return true;
  return this.is_public;
};

Graph.prototype.canBeEditedBy = function(user) {
  if (!user) return false;
  return this.user_id === user.id || user.role === 'admin';
};

// Class methods
Graph.findPublic = function(options = {}) {
  return this.findAll({
    where: { is_public: true },
    ...options
  });
};

Graph.findByUser = function(userId, options = {}) {
  return this.findAll({
    where: { user_id: userId },
    ...options
  });
};

Graph.findByTag = function(tag, options = {}) {
  return this.findAll({
    where: {
      tags: {
        [sequelize.Sequelize.Op.contains]: [tag]
      }
    },
    ...options
  });
};

Graph.findTemplates = function(category = null) {
  const where = { is_template: true };
  if (category) {
    where.template_category = category;
  }
  return this.findAll({ where });
};

Graph.search = function(query, options = {}) {
  return this.findAll({
    where: {
      [sequelize.Sequelize.Op.or]: [
        {
          title: {
            [sequelize.Sequelize.Op.iLike]: `%${query}%`
          }
        },
        {
          description: {
            [sequelize.Sequelize.Op.iLike]: `%${query}%`
          }
        },
        {
          tags: {
            [sequelize.Sequelize.Op.overlap]: [query]
          }
        }
      ]
    },
    ...options
  });
};

module.exports = Graph;
