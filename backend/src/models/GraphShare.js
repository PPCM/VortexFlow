const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GraphShare = sequelize.define('GraphShare', {
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
  shared_with_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  permission_level: {
    type: DataTypes.ENUM('view', 'edit', 'admin'),
    defaultValue: 'view',
    allowNull: false
  },
  shared_by_user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  share_token: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  access_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  last_accessed: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'graph_shares',
  indexes: [
    {
      fields: ['graph_id', 'shared_with_user_id'],
      unique: true
    },
    {
      fields: ['graph_id']
    },
    {
      fields: ['shared_with_user_id']
    },
    {
      fields: ['share_token'],
      unique: true,
      where: {
        share_token: {
          [sequelize.Sequelize.Op.ne]: null
        }
      }
    },
    {
      fields: ['is_active']
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Instance methods
GraphShare.prototype.isExpired = function() {
  if (!this.expires_at) return false;
  return new Date() > this.expires_at;
};

GraphShare.prototype.isValid = function() {
  return this.is_active && !this.isExpired();
};

GraphShare.prototype.incrementAccessCount = async function() {
  this.access_count += 1;
  this.last_accessed = new Date();
  await this.save({ fields: ['access_count', 'last_accessed'] });
};

GraphShare.prototype.revoke = async function() {
  this.is_active = false;
  await this.save({ fields: ['is_active'] });
};

GraphShare.prototype.extend = async function(hours = 24) {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  this.expires_at = expiresAt;
  await this.save({ fields: ['expires_at'] });
};

// Class methods
GraphShare.findByGraph = function(graphId, options = {}) {
  return this.findAll({
    where: { 
      graph_id: graphId,
      is_active: true
    },
    ...options
  });
};

GraphShare.findByUser = function(userId, options = {}) {
  return this.findAll({
    where: { 
      shared_with_user_id: userId,
      is_active: true
    },
    ...options
  });
};

GraphShare.findByToken = function(token) {
  return this.findOne({
    where: { 
      share_token: token,
      is_active: true
    }
  });
};

GraphShare.findActiveShares = function(options = {}) {
  return this.findAll({
    where: {
      is_active: true,
      [sequelize.Sequelize.Op.or]: [
        { expires_at: null },
        { expires_at: { [sequelize.Sequelize.Op.gt]: new Date() } }
      ]
    },
    ...options
  });
};

GraphShare.cleanupExpired = async function() {
  const expiredShares = await this.findAll({
    where: {
      is_active: true,
      expires_at: { [sequelize.Sequelize.Op.lt]: new Date() }
    }
  });
  
  for (const share of expiredShares) {
    await share.revoke();
  }
  
  return expiredShares.length;
};

GraphShare.createShare = async function(graphId, sharedWithUserId, permissionLevel = 'view', options = {}) {
  const { sharedByUserId = null, expiresIn = null, notes = null } = options;
  
  let expiresAt = null;
  if (expiresIn) {
    expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiresIn);
  }
  
  return this.create({
    graph_id: graphId,
    shared_with_user_id: sharedWithUserId,
    shared_by_user_id: sharedByUserId,
    permission_level: permissionLevel,
    expires_at: expiresAt,
    notes: notes
  });
};

module.exports = GraphShare;
