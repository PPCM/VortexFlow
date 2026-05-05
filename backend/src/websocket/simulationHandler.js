const { SimulationSession, Graph } = require('../models');
const logger = require('../utils/logger');

class SimulationHandler {
  constructor(io) {
    this.io = io;
    this.activeSessions = new Map(); // sessionId -> { socket, session, graph, simulation }
    this.setupSocketHandlers();
  }

  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Join simulation room
      socket.on('join-simulation', async (data) => {
        try {
          await this.handleJoinSimulation(socket, data);
        } catch (error) {
          logger.error('Error joining simulation', { error: error.message, socketId: socket.id });
          socket.emit('simulation-error', { error: error.message });
        }
      });

      // Leave simulation room
      socket.on('leave-simulation', async (data) => {
        try {
          await this.handleLeaveSimulation(socket, data);
        } catch (error) {
          logger.error('Error leaving simulation', { error: error.message, socketId: socket.id });
        }
      });

      // Start simulation
      socket.on('start-simulation', async (data) => {
        try {
          await this.handleStartSimulation(socket, data);
        } catch (error) {
          logger.error('Error starting simulation', { error: error.message, socketId: socket.id });
          socket.emit('simulation-error', { error: error.message });
        }
      });

      // Stop simulation
      socket.on('stop-simulation', async (data) => {
        try {
          await this.handleStopSimulation(socket, data);
        } catch (error) {
          logger.error('Error stopping simulation', { error: error.message, socketId: socket.id });
          socket.emit('simulation-error', { error: error.message });
        }
      });

      // Pause simulation
      socket.on('pause-simulation', async (data) => {
        try {
          await this.handlePauseSimulation(socket, data);
        } catch (error) {
          logger.error('Error pausing simulation', { error: error.message, socketId: socket.id });
          socket.emit('simulation-error', { error: error.message });
        }
      });

      // Resume simulation
      socket.on('resume-simulation', async (data) => {
        try {
          await this.handleResumeSimulation(socket, data);
        } catch (error) {
          logger.error('Error resuming simulation', { error: error.message, socketId: socket.id });
          socket.emit('simulation-error', { error: error.message });
        }
      });

      // Update simulation config
      socket.on('update-simulation-config', async (data) => {
        try {
          await this.handleUpdateConfig(socket, data);
        } catch (error) {
          logger.error('Error updating simulation config', { error: error.message, socketId: socket.id });
          socket.emit('simulation-error', { error: error.message });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnection(socket);
      });
    });
  }

  async handleJoinSimulation(socket, { sessionId, userId }) {
    // Verify session exists and user has access
    const session = await SimulationSession.findOne({
      where: { id: sessionId, user_id: userId },
      include: [{ model: Graph, as: 'graph' }]
    });

    if (!session) {
      throw new Error('Simulation session not found or access denied');
    }

    const roomName = `simulation-${sessionId}`;
    socket.join(roomName);
    socket.sessionId = sessionId;
    socket.userId = userId;

    logger.info('User joined simulation', {
      sessionId,
      userId,
      socketId: socket.id,
      roomName
    });

    // Send current simulation state
    socket.emit('simulation-joined', {
      session: {
        id: session.id,
        sessionName: session.session_name,
        status: session.status,
        config: session.config,
        startTime: session.start_time
      },
      graph: {
        id: session.graph.id,
        title: session.graph.title,
        dotCode: session.graph.dot_code
      }
    });

    // If simulation is running, send current state
    if (this.activeSessions.has(sessionId)) {
      const activeSession = this.activeSessions.get(sessionId);
      socket.emit('simulation-state', activeSession.simulation.getCurrentState());
    }
  }

  async handleLeaveSimulation(socket, { sessionId }) {
    const roomName = `simulation-${sessionId}`;
    socket.leave(roomName);
    
    logger.info('User left simulation', {
      sessionId,
      userId: socket.userId,
      socketId: socket.id
    });

    socket.emit('simulation-left', { sessionId });
  }

  async handleStartSimulation(socket, { sessionId }) {
    const session = await SimulationSession.findOne({
      where: { id: sessionId, user_id: socket.userId },
      include: [{ model: Graph, as: 'graph' }]
    });

    if (!session) {
      throw new Error('Simulation session not found');
    }

    if (session.status === 'running') {
      throw new Error('Simulation is already running');
    }

    // Update session status
    await session.update({
      status: 'running',
      start_time: new Date()
    });

    // Create simulation engine
    const simulation = new SimulationEngine(session.graph.dot_code, session.config);
    
    // Store active session
    this.activeSessions.set(sessionId, {
      socket,
      session,
      graph: session.graph,
      simulation,
      startTime: Date.now()
    });

    const roomName = `simulation-${sessionId}`;
    
    // Start simulation loop
    simulation.start((state) => {
      this.io.to(roomName).emit('simulation-update', {
        sessionId,
        timestamp: Date.now(),
        state
      });
    });

    // Notify room that simulation started
    this.io.to(roomName).emit('simulation-started', {
      sessionId,
      startTime: session.start_time,
      config: session.config
    });

    logger.info('Simulation started', {
      sessionId,
      userId: socket.userId,
      config: session.config
    });
  }

  async handleStopSimulation(socket, { sessionId }) {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('No active simulation found');
    }

    // Stop simulation engine
    activeSession.simulation.stop();

    // Update session in database
    const duration = Math.floor((Date.now() - activeSession.startTime) / 1000);
    await activeSession.session.update({
      status: 'completed',
      end_time: new Date(),
      duration,
      results: activeSession.simulation.getResults(),
      metrics: activeSession.simulation.getMetrics()
    });

    // Remove from active sessions
    this.activeSessions.delete(sessionId);

    const roomName = `simulation-${sessionId}`;
    this.io.to(roomName).emit('simulation-stopped', {
      sessionId,
      duration,
      results: activeSession.simulation.getResults(),
      metrics: activeSession.simulation.getMetrics()
    });

    logger.info('Simulation stopped', {
      sessionId,
      userId: socket.userId,
      duration
    });
  }

  async handlePauseSimulation(socket, { sessionId }) {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('No active simulation found');
    }

    activeSession.simulation.pause();

    const roomName = `simulation-${sessionId}`;
    this.io.to(roomName).emit('simulation-paused', { sessionId });

    logger.info('Simulation paused', {
      sessionId,
      userId: socket.userId
    });
  }

  async handleResumeSimulation(socket, { sessionId }) {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('No active simulation found');
    }

    activeSession.simulation.resume();

    const roomName = `simulation-${sessionId}`;
    this.io.to(roomName).emit('simulation-resumed', { sessionId });

    logger.info('Simulation resumed', {
      sessionId,
      userId: socket.userId
    });
  }

  async handleUpdateConfig(socket, { sessionId, config }) {
    const activeSession = this.activeSessions.get(sessionId);
    if (!activeSession) {
      throw new Error('No active simulation found');
    }

    // Update simulation config
    activeSession.simulation.updateConfig(config);

    // Update session in database
    const mergedConfig = { ...activeSession.session.config, ...config };
    await activeSession.session.update({ config: mergedConfig });

    const roomName = `simulation-${sessionId}`;
    this.io.to(roomName).emit('simulation-config-updated', {
      sessionId,
      config: mergedConfig
    });

    logger.info('Simulation config updated', {
      sessionId,
      userId: socket.userId,
      config
    });
  }

  handleDisconnection(socket) {
    logger.info('WebSocket client disconnected', {
      socketId: socket.id,
      userId: socket.userId,
      sessionId: socket.sessionId
    });

    // Clean up if this was the last connection for a simulation
    if (socket.sessionId) {
      const roomName = `simulation-${socket.sessionId}`;
      const room = this.io.sockets.adapter.rooms.get(roomName);
      
      if (!room || room.size === 0) {
        // No more clients in this simulation room
        const activeSession = this.activeSessions.get(socket.sessionId);
        if (activeSession) {
          logger.info('Auto-pausing simulation due to no active connections', {
            sessionId: socket.sessionId
          });
          activeSession.simulation.pause();
        }
      }
    }
  }

  // Cleanup method for graceful shutdown
  async cleanup() {
    logger.info('Cleaning up simulation handler');
    
    for (const [sessionId, activeSession] of this.activeSessions) {
      try {
        activeSession.simulation.stop();
        
        const duration = Math.floor((Date.now() - activeSession.startTime) / 1000);
        await activeSession.session.update({
          status: 'completed',
          end_time: new Date(),
          duration
        });
        
        logger.info('Cleaned up active simulation', { sessionId });
      } catch (error) {
        logger.error('Error cleaning up simulation', { sessionId, error: error.message });
      }
    }
    
    this.activeSessions.clear();
  }
}

/**
 * Simulation Engine Class
 * Handles the actual simulation logic and physics
 */
class SimulationEngine {
  constructor(dotCode, config) {
    this.dotCode = dotCode;
    this.config = config;
    this.isRunning = false;
    this.isPaused = false;
    this.particles = [];
    this.nodes = [];
    this.edges = [];
    this.currentStep = 0;
    this.startTime = null;
    this.metrics = {
      totalParticles: 0,
      particlesProcessed: 0,
      averageLatency: 0,
      throughput: 0
    };
    
    this.parseDotCode();
    this.initializeParticles();
  }

  parseDotCode() {
    // Basic DOT parsing - in a real implementation, you'd use a proper DOT parser
    const lines = this.dotCode.split('\n').map(line => line.trim());
    
    for (const line of lines) {
      // Parse nodes: A [label="Node A"];
      if (line.includes('[') && line.includes('label=')) {
        const nodeMatch = line.match(/(\w+)\s*\[.*label="([^"]+)"/);
        if (nodeMatch) {
          this.nodes.push({
            id: nodeMatch[1],
            label: nodeMatch[2],
            position: this.generateRandomPosition(),
            connections: 0
          });
        }
      }
      
      // Parse edges: A -> B;
      if (line.includes('->')) {
        const edgeMatch = line.match(/(\w+)\s*->\s*(\w+)/);
        if (edgeMatch) {
          this.edges.push({
            from: edgeMatch[1],
            to: edgeMatch[2],
            capacity: Math.random() * 100 + 50,
            currentFlow: 0
          });
        }
      }
    }
  }

  generateRandomPosition() {
    return {
      x: (Math.random() - 0.5) * 200,
      y: (Math.random() - 0.5) * 200,
      z: (Math.random() - 0.5) * 200
    };
  }

  initializeParticles() {
    const particleCount = this.config.particleCount || 100;
    
    for (let i = 0; i < particleCount; i++) {
      const sourceNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
      if (sourceNode) {
        this.particles.push({
          id: i,
          position: { ...sourceNode.position },
          velocity: { x: 0, y: 0, z: 0 },
          currentEdge: null,
          targetNode: null,
          progress: 0,
          age: 0,
          data: Math.random() * 1000
        });
      }
    }
    
    this.metrics.totalParticles = particleCount;
  }

  start(onUpdate) {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.isPaused = false;
    this.startTime = Date.now();
    this.onUpdate = onUpdate;
    
    this.simulationLoop();
  }

  stop() {
    this.isRunning = false;
    this.isPaused = false;
  }

  pause() {
    this.isPaused = true;
  }

  resume() {
    this.isPaused = false;
  }

  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Adjust particle count if changed
    if (newConfig.particleCount && newConfig.particleCount !== this.particles.length) {
      this.adjustParticleCount(newConfig.particleCount);
    }
  }

  adjustParticleCount(newCount) {
    const currentCount = this.particles.length;
    
    if (newCount > currentCount) {
      // Add particles
      for (let i = currentCount; i < newCount; i++) {
        const sourceNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
        if (sourceNode) {
          this.particles.push({
            id: i,
            position: { ...sourceNode.position },
            velocity: { x: 0, y: 0, z: 0 },
            currentEdge: null,
            targetNode: null,
            progress: 0,
            age: 0,
            data: Math.random() * 1000
          });
        }
      }
    } else if (newCount < currentCount) {
      // Remove particles
      this.particles = this.particles.slice(0, newCount);
    }
    
    this.metrics.totalParticles = newCount;
  }

  simulationLoop() {
    if (!this.isRunning) return;
    
    if (!this.isPaused) {
      this.updateSimulation();
      this.currentStep++;
      
      if (this.onUpdate) {
        this.onUpdate(this.getCurrentState());
      }
    }
    
    // Continue loop
    setTimeout(() => this.simulationLoop(), 1000 / 60); // 60 FPS
  }

  updateSimulation() {
    const deltaTime = this.config.speed || 1.0;
    
    for (const particle of this.particles) {
      this.updateParticle(particle, deltaTime);
    }
    
    this.updateMetrics();
  }

  updateParticle(particle, deltaTime) {
    particle.age += deltaTime;
    
    // Simple particle movement simulation
    if (!particle.currentEdge) {
      // Find next edge to traverse
      const availableEdges = this.edges.filter(edge => {
        const sourceNode = this.nodes.find(n => n.id === edge.from);
        return sourceNode && this.isNearNode(particle.position, sourceNode.position);
      });
      
      if (availableEdges.length > 0) {
        particle.currentEdge = availableEdges[Math.floor(Math.random() * availableEdges.length)];
        particle.targetNode = this.nodes.find(n => n.id === particle.currentEdge.to);
        particle.progress = 0;
      }
    } else {
      // Move along current edge
      particle.progress += deltaTime * 0.02; // Adjust speed
      
      if (particle.progress >= 1.0) {
        // Reached target node
        particle.position = { ...particle.targetNode.position };
        particle.currentEdge = null;
        particle.targetNode = null;
        particle.progress = 0;
        this.metrics.particlesProcessed++;
      } else {
        // Interpolate position along edge
        const sourceNode = this.nodes.find(n => n.id === particle.currentEdge.from);
        if (sourceNode && particle.targetNode) {
          particle.position = this.interpolatePosition(
            sourceNode.position,
            particle.targetNode.position,
            particle.progress
          );
        }
      }
    }
  }

  isNearNode(particlePos, nodePos, threshold = 10) {
    const dx = particlePos.x - nodePos.x;
    const dy = particlePos.y - nodePos.y;
    const dz = particlePos.z - nodePos.z;
    return Math.sqrt(dx*dx + dy*dy + dz*dz) < threshold;
  }

  interpolatePosition(start, end, progress) {
    return {
      x: start.x + (end.x - start.x) * progress,
      y: start.y + (end.y - start.y) * progress,
      z: start.z + (end.z - start.z) * progress
    };
  }

  updateMetrics() {
    const elapsed = (Date.now() - this.startTime) / 1000;
    this.metrics.averageLatency = elapsed / Math.max(this.metrics.particlesProcessed, 1);
    this.metrics.throughput = this.metrics.particlesProcessed / elapsed;
  }

  getCurrentState() {
    return {
      step: this.currentStep,
      timestamp: Date.now(),
      particles: this.particles.map(p => ({
        id: p.id,
        position: p.position,
        age: p.age,
        data: p.data
      })),
      nodes: this.nodes,
      edges: this.edges.map(e => ({
        ...e,
        currentFlow: this.particles.filter(p => p.currentEdge === e).length
      })),
      metrics: this.metrics,
      isRunning: this.isRunning,
      isPaused: this.isPaused
    };
  }

  getResults() {
    return {
      totalSteps: this.currentStep,
      duration: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
      finalParticleCount: this.particles.length,
      finalMetrics: this.metrics
    };
  }

  getMetrics() {
    return this.metrics;
  }
}

module.exports = SimulationHandler;
