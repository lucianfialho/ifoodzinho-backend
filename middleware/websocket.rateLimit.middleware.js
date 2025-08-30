const { logger } = require('../utils/logger');

class WebSocketRateLimiter {
  constructor() {
    // Store rate limit data: userId -> { count, resetTime }
    this.userLimits = new Map();
    
    // Cleanup old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  /**
   * Rate limit configuration per event type
   */
  getLimits(eventType) {
    const limits = {
      'swipe': { maxEvents: 100, windowMs: 60000 }, // 100 swipes per minute
      'like': { maxEvents: 50, windowMs: 60000 },   // 50 likes per minute  
      'message': { maxEvents: 30, windowMs: 60000 }, // 30 messages per minute
      'session_join': { maxEvents: 10, windowMs: 60000 }, // 10 joins per minute
      'couple_swipe': { maxEvents: 100, windowMs: 60000 }, // 100 couple swipes per minute
      'couple_like': { maxEvents: 50, windowMs: 60000 },   // 50 couple likes per minute
      'authenticate': { maxEvents: 5, windowMs: 60000 }, // 5 auth attempts per minute
      'default': { maxEvents: 20, windowMs: 60000 }  // 20 events per minute
    };
    
    return limits[eventType] || limits.default;
  }
  
  /**
   * Check if user is within rate limits
   */
  checkRateLimit(userId, eventType) {
    const limits = this.getLimits(eventType);
    const now = Date.now();
    const key = `${userId}:${eventType}`;
    
    // Get current limit data
    let userData = this.userLimits.get(key);
    
    // Initialize if first request
    if (!userData) {
      userData = { count: 0, resetTime: now + limits.windowMs };
      this.userLimits.set(key, userData);
    }
    
    // Reset if window expired
    if (now > userData.resetTime) {
      userData.count = 0;
      userData.resetTime = now + limits.windowMs;
    }
    
    // Check if limit exceeded
    if (userData.count >= limits.maxEvents) {
      logger.warn('Rate limit exceeded', {
        userId,
        eventType,
        count: userData.count,
        limit: limits.maxEvents
      });
      return false;
    }
    
    // Increment count
    userData.count++;
    return true;
  }
  
  /**
   * Get rate limit status for user
   */
  getRateLimitStatus(userId, eventType) {
    const limits = this.getLimits(eventType);
    const key = `${userId}:${eventType}`;
    const userData = this.userLimits.get(key);
    
    if (!userData) {
      return {
        remaining: limits.maxEvents,
        resetTime: null,
        limited: false
      };
    }
    
    const now = Date.now();
    
    // Check if window expired
    if (now > userData.resetTime) {
      return {
        remaining: limits.maxEvents,
        resetTime: now + limits.windowMs,
        limited: false
      };
    }
    
    return {
      remaining: Math.max(0, limits.maxEvents - userData.count),
      resetTime: userData.resetTime,
      limited: userData.count >= limits.maxEvents
    };
  }
  
  /**
   * Clean up old entries
   */
  cleanup() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, userData] of this.userLimits.entries()) {
      if (now > userData.resetTime + 60000) { // 1 minute grace period
        this.userLimits.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Rate limiter cleanup completed', {
        cleanedEntries: cleanedCount,
        remainingEntries: this.userLimits.size
      });
    }
  }
  
  /**
   * Reset rate limits for a specific user
   */
  resetUserLimits(userId) {
    let resetCount = 0;
    
    for (const [key] of this.userLimits.entries()) {
      if (key.startsWith(`${userId}:`)) {
        this.userLimits.delete(key);
        resetCount++;
      }
    }
    
    logger.info('User rate limits reset', { userId, resetCount });
    return resetCount;
  }
  
  /**
   * Get statistics about rate limiting
   */
  getStats() {
    const stats = {
      totalEntries: this.userLimits.size,
      activeUsers: new Set(),
      eventTypes: new Map()
    };
    
    for (const [key] of this.userLimits.entries()) {
      const [userId, eventType] = key.split(':');
      stats.activeUsers.add(userId);
      
      if (!stats.eventTypes.has(eventType)) {
        stats.eventTypes.set(eventType, 0);
      }
      stats.eventTypes.set(eventType, stats.eventTypes.get(eventType) + 1);
    }
    
    stats.activeUsers = stats.activeUsers.size;
    stats.eventTypes = Object.fromEntries(stats.eventTypes);
    
    return stats;
  }
}

module.exports = new WebSocketRateLimiter();