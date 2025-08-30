const socketIo = require('socket.io');
const websocketAuth = require('../middleware/websocket.auth.middleware');
const rateLimiter = require('../middleware/websocket.rateLimit.middleware');
// const { trackWebSocketEvents } = require('../middleware/monitoring.middleware'); // Removed for cleanup
const { logger } = require('../utils/logger');

class SecureWebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> Set of socketIds
    this.coupleSessions = new Map(); // sessionId -> Set of userIds
    this.activeSessions = new Map(); // coupleId -> { users: [], socketIds: {} }
    this.tempSessions = new Map(); // sessionCode -> { users: [], socketIds: {}, createdBy: userId }
    this.userSockets = new Map(); // userId -> { socketId, coupleId }
  }
  
  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://foodieswipe.com'] 
          : ['http://localhost:3000', 'http://localhost:8081', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });
    
    // Authentication middleware
    this.io.use((socket, next) => {
      websocketAuth.authenticateConnection(socket, next);
    });
    
    // Performance monitoring middleware (commented out for now)
    // this.io.use((socket, next) => {
    //   trackWebSocketEvents(socket, next);
    // });
    
    this.setupEventHandlers();
    
    logger.info('Secure WebSocket service initialized', {
      cors: this.io.engine.opts.cors,
      nodeEnv: process.env.NODE_ENV
    });
  }
  
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
      
      // Secure event handlers
      socket.on('couple_swipe', (data) => this.handleSecureEvent(
        socket, 'couple_swipe', data, this.handleCoupleSwipe.bind(this)
      ));
      
      socket.on('couple-swipe', (data) => this.handleSecureEvent(
        socket, 'couple_swipe', data, this.handleCoupleSwipe.bind(this)
      ));
      
      socket.on('couple_like', (data) => this.handleSecureEvent(
        socket, 'couple_like', data, this.handleCoupleLike.bind(this)
      ));
      
      socket.on('session_join', (data) => this.handleSecureEvent(
        socket, 'session_join', data, this.handleSessionJoin.bind(this)
      ));
      
      socket.on('session_leave', (data) => this.handleSecureEvent(
        socket, 'session_leave', data, this.handleSessionLeave.bind(this)
      ));
      
      // Legacy event handlers for compatibility
      socket.on('authenticate', (data) => this.handleSecureEvent(
        socket, 'authenticate', data, this.handleAuthenticate.bind(this)
      ));
      
      socket.on('start-couple-session', (data) => this.handleSecureEvent(
        socket, 'session_join', data, this.handleStartCoupleSession.bind(this)
      ));
      
      socket.on('end-couple-session', (data) => this.handleSecureEvent(
        socket, 'session_leave', data, this.handleEndCoupleSession.bind(this)
      ));
      
      socket.on('join-couple-session', (data) => this.handleSecureEvent(
        socket, 'session_join', data, this.handleJoinCoupleSession.bind(this)
      ));
      
      socket.on('leave-couple-session', (data) => this.handleSecureEvent(
        socket, 'session_leave', data, this.handleLeaveCoupleSession.bind(this)
      ));
      
      socket.on('decision:accept', (data) => this.handleSecureEvent(
        socket, 'message', data, this.handleDecisionAccept.bind(this)
      ));
      
      socket.on('disconnect', (reason) => this.handleDisconnection(socket, reason));
    });
  }
  
  /**
   * Secure event handler wrapper
   */
  async handleSecureEvent(socket, eventType, data, handler) {
    try {
      // Rate limiting check
      if (!rateLimiter.checkRateLimit(socket.userId, eventType)) {
        const rateLimitStatus = rateLimiter.getRateLimitStatus(socket.userId, eventType);
        
        socket.emit('error', { 
          message: 'Rate limit exceeded',
          eventType,
          retryAfter: rateLimitStatus.resetTime ? rateLimitStatus.resetTime - Date.now() : 60000,
          remaining: rateLimitStatus.remaining
        });
        
        logger.warn('Event rate limited', {
          userId: socket.userId,
          eventType,
          socketId: socket.id,
          rateLimitStatus
        });
        return;
      }
      
      // Permission validation (skip for authenticate event)
      if (eventType !== 'authenticate') {
        await websocketAuth.validateEventPermissions(socket, data);
      }
      
      // Execute handler
      await handler(socket, data);
      
      logger.debug('WebSocket event processed successfully', {
        userId: socket.userId,
        eventType,
        socketId: socket.id,
        dataKeys: data ? Object.keys(data) : []
      });
      
    } catch (error) {
      logger.error('WebSocket event error', {
        userId: socket.userId,
        eventType,
        error: error.message,
        socketId: socket.id,
        data: data ? Object.keys(data) : []
      });
      
      socket.emit('error', { 
        message: error.message,
        eventType,
        code: this.getErrorCode(error.message)
      });
    }
  }
  
  /**
   * Get error code from error message
   */
  getErrorCode(message) {
    if (message.includes('not authenticated')) return 'AUTH_REQUIRED';
    if (message.includes('not authorized')) return 'UNAUTHORIZED';
    if (message.includes('not partners')) return 'NOT_PARTNERS';
    if (message.includes('Rate limit')) return 'RATE_LIMITED';
    if (message.includes('Session not found')) return 'SESSION_NOT_FOUND';
    return 'UNKNOWN_ERROR';
  }
  
  handleConnection(socket) {
    const userId = socket.userId;
    
    // Track user connections
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(socket.id);
    
    logger.info('User connected to secure WebSocket', {
      userId,
      email: socket.userEmail,
      socketId: socket.id,
      totalConnections: this.connectedUsers.get(userId).size,
      totalUsers: this.connectedUsers.size
    });
    
    socket.emit('authenticated', {
      userId,
      email: socket.userEmail,
      message: 'Successfully connected and authenticated',
      timestamp: new Date().toISOString()
    });
  }
  
  handleDisconnection(socket, reason) {
    const userId = socket.userId;
    
    if (this.connectedUsers.has(userId)) {
      this.connectedUsers.get(userId).delete(socket.id);
      
      // Remove user entry if no connections left
      if (this.connectedUsers.get(userId).size === 0) {
        this.connectedUsers.delete(userId);
      }
    }
    
    // Clean up user socket mapping
    if (this.userSockets.has(userId)) {
      this.userSockets.delete(userId);
    }
    
    // Remove from couple sessions
    this.removeUserFromAllSessions(userId);
    
    logger.info('User disconnected from secure WebSocket', {
      userId,
      socketId: socket.id,
      reason,
      remainingConnections: this.connectedUsers.has(userId) ? this.connectedUsers.get(userId).size : 0
    });
  }
  
  /**
   * Secure couple swipe handler
   */
  async handleCoupleSwipe(socket, data) {
    const { sessionId, dishId, action, dishData } = data;
    const userId = socket.userId;
    
    // Additional validation for couple swipes
    if (!dishId || !['like', 'dislike', 'super_like'].includes(action)) {
      throw new Error('Invalid swipe data');
    }
    
    // Log the swipe
    logger.info('Couple swipe processed', {
      userId,
      dishId,
      action,
      sessionId,
      dishName: dishData?.name
    });
    
    // Emit to partner in same session
    if (sessionId) {
      this.emitToSession(sessionId, 'partner_swiped', {
        userId: socket.userId,
        dishId,
        action,
        dishData,
        timestamp: new Date().toISOString()
      }, socket.userId); // exclude sender
    }
    
    // Acknowledge the swipe
    socket.emit('swipe_acknowledged', {
      dishId,
      action,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Handle couple like events
   */
  async handleCoupleLike(socket, data) {
    const { dishId, restaurantId, dishData } = data;
    const userId = socket.userId;
    
    logger.info('Couple like processed', {
      userId,
      dishId,
      restaurantId,
      dishName: dishData?.name
    });
    
    socket.emit('like_acknowledged', {
      dishId,
      restaurantId,
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Handle session join events
   */
  async handleSessionJoin(socket, data) {
    const { sessionId, coupleId } = data;
    const userId = socket.userId;
    
    if (sessionId) {
      socket.join(`session-${sessionId}`);
      
      // Add to couple sessions tracking
      if (!this.coupleSessions.has(sessionId)) {
        this.coupleSessions.set(sessionId, new Set());
      }
      this.coupleSessions.get(sessionId).add(userId);
      
      logger.info('User joined session', {
        userId,
        sessionId,
        coupleId,
        socketId: socket.id
      });
      
      socket.emit('session_joined', {
        sessionId,
        coupleId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Handle session leave events
   */
  async handleSessionLeave(socket, data) {
    const { sessionId } = data;
    const userId = socket.userId;
    
    if (sessionId) {
      socket.leave(`session-${sessionId}`);
      
      // Remove from couple sessions tracking
      if (this.coupleSessions.has(sessionId)) {
        this.coupleSessions.get(sessionId).delete(userId);
        
        // Clean up empty sessions
        if (this.coupleSessions.get(sessionId).size === 0) {
          this.coupleSessions.delete(sessionId);
        }
      }
      
      logger.info('User left session', {
        userId,
        sessionId,
        socketId: socket.id
      });
      
      socket.emit('session_left', {
        sessionId,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  /**
   * Legacy handlers for compatibility with existing websocketService
   */
  async handleAuthenticate(socket, data) {
    // This is handled by the authentication middleware now
    // Just emit the authenticated event
    socket.emit('auth-result', {
      hasCouple: true,
      message: 'Authentication handled by secure middleware',
      timestamp: new Date().toISOString()
    });
  }
  
  async handleStartCoupleSession(socket, data) {
    await this.handleSessionJoin(socket, data);
  }
  
  async handleEndCoupleSession(socket, data) {
    await this.handleSessionLeave(socket, data);
  }
  
  async handleJoinCoupleSession(socket, data) {
    await this.handleSessionJoin(socket, data);
  }
  
  async handleLeaveCoupleSession(socket, data) {
    await this.handleSessionLeave(socket, data);
  }
  
  async handleDecisionAccept(socket, data) {
    const userId = socket.userId;
    const { sessionId, fromUserId } = data;
    
    logger.info('Decision accepted', {
      userId,
      sessionId,
      fromUserId,
      socketId: socket.id
    });
    
    socket.emit('decision_confirmed', {
      sessionId,
      message: 'Decision accepted successfully',
      timestamp: new Date().toISOString()
    });
  }
  
  /**
   * Emit event to all users in a session except sender
   */
  emitToSession(sessionId, eventName, data, excludeUserId = null) {
    const sessionUsers = this.coupleSessions.get(sessionId);
    
    if (!sessionUsers) {
      logger.debug('Session not found for emit', { sessionId });
      return;
    }
    
    let emittedCount = 0;
    sessionUsers.forEach(userId => {
      if (userId !== excludeUserId) {
        this.emitToUser(userId, eventName, data);
        emittedCount++;
      }
    });
    
    logger.debug('Event emitted to session', {
      sessionId,
      eventName,
      excludeUserId,
      emittedCount
    });
  }
  
  /**
   * Emit event to specific user (all their connections)
   */
  emitToUser(userId, eventName, data) {
    const userSockets = this.connectedUsers.get(userId);
    
    if (!userSockets) {
      logger.debug('User not connected for emit', { userId, eventName });
      return;
    }
    
    let emittedCount = 0;
    userSockets.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit(eventName, data);
        emittedCount++;
      }
    });
    
    logger.debug('Event emitted to user', {
      userId,
      eventName,
      emittedCount
    });
  }
  
  /**
   * Remove user from all sessions
   */
  removeUserFromAllSessions(userId) {
    let removedCount = 0;
    
    // Remove from couple sessions
    for (const [sessionId, users] of this.coupleSessions.entries()) {
      if (users.has(userId)) {
        users.delete(userId);
        removedCount++;
        
        // Clean up empty sessions
        if (users.size === 0) {
          this.coupleSessions.delete(sessionId);
        }
      }
    }
    
    if (removedCount > 0) {
      logger.debug('User removed from sessions', {
        userId,
        removedFromSessions: removedCount
      });
    }
  }
  
  /**
   * Get service statistics
   */
  getStats() {
    const rateLimiterStats = rateLimiter.getStats();
    
    return {
      connectedUsers: this.connectedUsers.size,
      totalConnections: Array.from(this.connectedUsers.values()).reduce((sum, sockets) => sum + sockets.size, 0),
      activeSessions: this.coupleSessions.size,
      rateLimiter: rateLimiterStats,
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Force disconnect user (admin function)
   */
  disconnectUser(userId, reason = 'Administrative action') {
    const userSockets = this.connectedUsers.get(userId);
    
    if (!userSockets) {
      return false;
    }
    
    let disconnectedCount = 0;
    userSockets.forEach(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
        disconnectedCount++;
      }
    });
    
    logger.warn('User force disconnected', {
      userId,
      reason,
      disconnectedSockets: disconnectedCount
    });
    
    return disconnectedCount > 0;
  }
}

module.exports = new SecureWebSocketService();