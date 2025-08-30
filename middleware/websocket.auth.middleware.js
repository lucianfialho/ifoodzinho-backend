const admin = require('../config/firebase');
const { logger } = require('../utils/logger');

class WebSocketAuthMiddleware {
  
  /**
   * Authenticate WebSocket connection on initial handshake
   */
  async authenticateConnection(socket, next) {
    try {
      const token = socket.handshake.auth.token || 
                   socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        // Para modo demo, permitir conexões sem token inicial
        logger.info('WebSocket connection without token - using demo mode', {
          socketId: socket.id,
          ip: socket.handshake.address
        });
        
        // Set demo user data
        socket.userId = 'demo-user-123';
        socket.userEmail = 'demo@test.com';
        socket.userData = { displayName: 'Demo User' };
        
        return next();
      }
      
      // Verify Firebase token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Get user data from Firestore
      const userDoc = await admin.firestore()
        .collection('users')
        .doc(decodedToken.uid)
        .get();
        
      if (!userDoc.exists) {
        logger.warn('WebSocket connection rejected - user not found', {
          uid: decodedToken.uid,
          socketId: socket.id
        });
        return next(new Error('User not found'));
      }
      
      // Attach user info to socket
      socket.userId = decodedToken.uid;
      socket.userEmail = decodedToken.email;
      socket.userData = userDoc.data();
      
      logger.info('WebSocket connection authenticated', {
        userId: socket.userId,
        email: socket.userEmail,
        socketId: socket.id
      });
      
      next();
      
    } catch (error) {
      logger.error('WebSocket authentication failed', {
        error: error.message,
        socketId: socket.id,
        ip: socket.handshake.address
      });
      next(new Error('Invalid token'));
    }
  }
  
  /**
   * Validate user for specific events
   */
  async validateEventPermissions(socket, eventData, requiredPermissions = []) {
    // Basic validation - user must be authenticated
    if (!socket.userId) {
      throw new Error('User not authenticated');
    }
    
    // Event-specific validations
    if (eventData.sessionId) {
      // Validate user belongs to this session
      if (!(await this.userBelongsToSession(socket.userId, eventData.sessionId))) {
        throw new Error('User not authorized for this session');
      }
    }
    
    if (eventData.partnerId) {
      // Validate user is partnered with specified user
      if (!(await this.usersArePartners(socket.userId, eventData.partnerId))) {
        throw new Error('Users are not partners');
      }
    }
    
    return true;
  }
  
  /**
   * Check if user belongs to session
   */
  async userBelongsToSession(userId, sessionId) {
    try {
      const sessionDoc = await admin.firestore()
        .collection('coupleSessions')
        .doc(sessionId)
        .get();
        
      if (!sessionDoc.exists) return false;
      
      const session = sessionDoc.data();
      return session.participants?.includes(userId);
      
    } catch (error) {
      logger.error('Error checking session membership', { userId, sessionId, error });
      return false;
    }
  }
  
  /**
   * Check if users are partners
   */
  async usersArePartners(userId1, userId2) {
    try {
      const user1Doc = await admin.firestore()
        .collection('users')
        .doc(userId1)
        .get();
        
      if (!user1Doc.exists) return false;
      
      const userData = user1Doc.data();
      return userData.partnerId === userId2;
      
    } catch (error) {
      logger.error('Error checking partnership', { userId1, userId2, error });
      return false;
    }
  }
}

module.exports = new WebSocketAuthMiddleware();