const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SimulationSession = sequelize.define('SimulationSession', {
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
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  session_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  session_data: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      frames: [],
      metrics: {
        totalPackets: 0,
        avgLatency: 0,
        maxThroughput: 0,
        nodeUtilization: {}
      },
      events: [],
      config: {}
    }
  },
  duration: {
    type: DataTypes.INTEGER, // Duration in seconds
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('running', 'paused', 'completed', 'failed'),
    defaultValue: 'running'
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  simulation_config: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  performance_metrics: {
    type: DataTypes.JSONB,
    defaultValue: {
      avgFps: 0,
      minFps: 0,
      maxFps: 0,
      totalFrames: 0,
      droppedFrames: 0,
      memoryUsage: 0
    }
  },
  is_saved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: []
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'simulation_sessions',
  indexes: [
    {
      fields: ['graph_id']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['status']
    },
    {
      fields: ['start_time']
    },
    {
      fields: ['is_saved']
    },
    {
      fields: ['tags'],
      using: 'gin'
    }
  ]
});

// Instance methods
SimulationSession.prototype.start = async function() {
  this.status = 'running';
  this.start_time = new Date();
  await this.save({ fields: ['status', 'start_time'] });
};

SimulationSession.prototype.pause = async function() {
  this.status = 'paused';
  await this.save({ fields: ['status'] });
};

SimulationSession.prototype.resume = async function() {
  this.status = 'running';
  await this.save({ fields: ['status'] });
};

SimulationSession.prototype.complete = async function() {
  this.status = 'completed';
  this.end_time = new Date();
  if (this.start_time) {
    this.duration = Math.floor((this.end_time - this.start_time) / 1000);
  }
  await this.save({ fields: ['status', 'end_time', 'duration'] });
};

SimulationSession.prototype.fail = async function(error = null) {
  this.status = 'failed';
  this.end_time = new Date();
  if (this.start_time) {
    this.duration = Math.floor((this.end_time - this.start_time) / 1000);
  }
  if (error) {
    this.notes = (this.notes || '') + `\nError: ${error.message || error}`;
  }
  await this.save({ fields: ['status', 'end_time', 'duration', 'notes'] });
};

SimulationSession.prototype.addFrame = async function(frameData) {
  const sessionData = { ...this.session_data };
  if (!sessionData.frames) sessionData.frames = [];
  
  sessionData.frames.push({
    timestamp: Date.now(),
    ...frameData
  });
  
  // Keep only last 1000 frames to prevent memory issues
  if (sessionData.frames.length > 1000) {
    sessionData.frames = sessionData.frames.slice(-1000);
  }
  
  this.session_data = sessionData;
  await this.save({ fields: ['session_data'] });
};

SimulationSession.prototype.updateMetrics = async function(metrics) {
  const sessionData = { ...this.session_data };
  sessionData.metrics = { ...sessionData.metrics, ...metrics };
  this.session_data = sessionData;
  await this.save({ fields: ['session_data'] });
};

SimulationSession.prototype.addEvent = async function(event) {
  const sessionData = { ...this.session_data };
  if (!sessionData.events) sessionData.events = [];
  
  sessionData.events.push({
    timestamp: Date.now(),
    ...event
  });
  
  this.session_data = sessionData;
  await this.save({ fields: ['session_data'] });
};

SimulationSession.prototype.export = function(format = 'json') {
  const data = {
    id: this.id,
    graph_id: this.graph_id,
    session_name: this.session_name,
    duration: this.duration,
    status: this.status,
    start_time: this.start_time,
    end_time: this.end_time,
    session_data: this.session_data,
    performance_metrics: this.performance_metrics,
    tags: this.tags,
    notes: this.notes
  };
  
  if (format === 'csv') {
    // Convert metrics to CSV format
    const frames = this.session_data.frames || [];
    const csvData = frames.map(frame => ({
      timestamp: frame.timestamp,
      ...frame.metrics
    }));
    return csvData;
  }
  
  return data;
};

// Class methods
SimulationSession.findByGraph = function(graphId, options = {}) {
  return this.findAll({
    where: { graph_id: graphId },
    order: [['start_time', 'DESC']],
    ...options
  });
};

SimulationSession.findByUser = function(userId, options = {}) {
  return this.findAll({
    where: { user_id: userId },
    order: [['start_time', 'DESC']],
    ...options
  });
};

SimulationSession.findRunning = function(options = {}) {
  return this.findAll({
    where: { status: 'running' },
    ...options
  });
};

SimulationSession.findSaved = function(options = {}) {
  return this.findAll({
    where: { is_saved: true },
    order: [['start_time', 'DESC']],
    ...options
  });
};

SimulationSession.createSession = async function(graphId, userId, config = {}) {
  return this.create({
    graph_id: graphId,
    user_id: userId,
    session_name: config.name || `Session ${new Date().toISOString()}`,
    simulation_config: config,
    session_data: {
      frames: [],
      metrics: {
        totalPackets: 0,
        avgLatency: 0,
        maxThroughput: 0,
        nodeUtilization: {}
      },
      events: [],
      config: config
    }
  });
};

SimulationSession.cleanupOldSessions = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  const oldSessions = await this.findAll({
    where: {
      is_saved: false,
      createdAt: { [sequelize.Sequelize.Op.lt]: cutoffDate }
    }
  });
  
  for (const session of oldSessions) {
    await session.destroy();
  }
  
  return oldSessions.length;
};

module.exports = SimulationSession;
