/**
 * Circuit Breaker Pattern Implementation for API Resilience
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.name = options.name || 'CircuitBreaker';
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
    
    // Circuit states: CLOSED (normal), OPEN (failing), HALF_OPEN (testing)
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.halfOpenCalls = 0;
    
    // Enhanced metrics tracking
    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      circuitOpens: 0,
      fallbackCalls: 0,
      stateHistory: []
    };
    
    // Track state changes for debugging
    this.recordStateChange(this.state, 'Initial state');
  }
  
  async execute(operation, fallback = null) {
    this.metrics.requests++;
    
    // If circuit is OPEN, check if we should try HALF_OPEN
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        console.warn(`🔴 Circuit breaker OPEN for ${this.name} - using fallback`);
        this.metrics.fallbackCalls++;
        
        if (fallback) {
          return await this.executeFallback(fallback);
        }
        
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      } else {
        // Try to transition to HALF_OPEN
        this.transitionToHalfOpen();
      }
    }
    
    // If HALF_OPEN, limit the number of test calls
    if (this.state === 'HALF_OPEN' && this.halfOpenCalls >= this.halfOpenMaxCalls) {
      console.warn(`🟡 Circuit breaker HALF_OPEN limit reached for ${this.name}`);
      this.metrics.fallbackCalls++;
      
      if (fallback) {
        return await this.executeFallback(fallback);
      }
      
      throw new Error(`Circuit breaker HALF_OPEN limit exceeded for ${this.name}`);
    }
    
    // Execute the operation
    try {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenCalls++;
      }
      
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      
      // Use fallback if available
      if (fallback) {
        return await this.executeFallback(fallback);
      }
      
      throw error;
    }
  }
  
  async executeFallback(fallback) {
    try {
      console.log(`🔄 Executing fallback for ${this.name}`);
      return await fallback();
    } catch (fallbackError) {
      console.error(`❌ Fallback failed for ${this.name}:`, fallbackError.message);
      throw new Error(`Both primary and fallback failed for ${this.name}`);
    }
  }
  
  onSuccess() {
    this.metrics.successes++;
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      // If we have enough successful calls, close the circuit
      if (this.successCount >= 2) {
        this.transitionToClosed();
      }
    }
  }
  
  onFailure(error) {
    this.metrics.failures++;
    this.failureCount++;
    
    // Classify error types
    if (error.code === 'ECONNABORTED' || 
        error.message.includes('timeout') ||
        error.code === 'ETIMEDOUT') {
      this.metrics.timeouts++;
    }
    
    // Log failure details
    console.error(`💥 ${this.name} failure #${this.failureCount}:`, {
      error: error.message,
      code: error.code,
      status: error.response?.status
    });
    
    // Decide whether to open the circuit
    if (this.shouldOpenCircuit(error)) {
      this.transitionToOpen();
    }
  }
  
  shouldOpenCircuit(error) {
    // Open circuit if we've reached failure threshold
    if (this.failureCount >= this.failureThreshold) {
      return true;
    }
    
    // Open circuit immediately for certain error types
    if (error.response?.status === 503 || 
        error.response?.status === 429 ||
        error.code === 'ENOTFOUND' ||
        error.code === 'ECONNREFUSED') {
      return true;
    }
    
    return false;
  }
  
  transitionToOpen() {
    this.state = 'OPEN';
    this.nextAttempt = Date.now() + this.resetTimeout;
    this.metrics.circuitOpens++;
    this.recordStateChange('OPEN', `Failure threshold reached: ${this.failureCount}`);
    console.error(`🔴 Circuit breaker OPEN for ${this.name} - cooling down for ${this.resetTimeout}ms`);
  }
  
  transitionToHalfOpen() {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.recordStateChange('HALF_OPEN', 'Testing recovery');
    console.log(`🟡 Circuit breaker HALF_OPEN for ${this.name} - testing recovery`);
  }
  
  transitionToClosed() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.recordStateChange('CLOSED', 'Recovery successful');
    console.log(`🟢 Circuit breaker CLOSED for ${this.name} - fully recovered`);
  }
  
  recordStateChange(newState, reason) {
    this.metrics.stateHistory.push({
      state: newState,
      reason,
      timestamp: new Date().toISOString(),
      failures: this.failureCount,
      successes: this.metrics.successes
    });
    
    // Keep only last 10 state changes
    if (this.metrics.stateHistory.length > 10) {
      this.metrics.stateHistory = this.metrics.stateHistory.slice(-10);
    }
  }
  
  // Force circuit state (useful for testing)
  forceState(state) {
    this.state = state;
    this.recordStateChange(state, 'Forced by admin');
  }
  
  // Get comprehensive metrics
  getMetrics() {
    const uptime = this.state === 'CLOSED' ? 100 : 
                   this.state === 'HALF_OPEN' ? 50 : 0;
    
    const errorRate = this.metrics.requests > 0 
      ? Math.round((this.metrics.failures / this.metrics.requests) * 100) 
      : 0;
    
    const successRate = this.metrics.requests > 0 
      ? Math.round((this.metrics.successes / this.metrics.requests) * 100) 
      : 0;
    
    return {
      name: this.name,
      state: this.state,
      uptime: uptime,
      requests: this.metrics.requests,
      successes: this.metrics.successes,
      failures: this.metrics.failures,
      timeouts: this.metrics.timeouts,
      circuitOpens: this.metrics.circuitOpens,
      fallbackCalls: this.metrics.fallbackCalls,
      successRate: successRate,
      errorRate: errorRate,
      currentFailures: this.failureCount,
      thresholdFailures: this.failureThreshold,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
      stateHistory: this.metrics.stateHistory
    };
  }
  
  // Health check for monitoring systems
  isHealthy() {
    return this.state === 'CLOSED';
  }
  
  // Reset all metrics and state (useful for testing)
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCalls = 0;
    this.nextAttempt = Date.now();
    
    this.metrics = {
      requests: 0,
      failures: 0,
      successes: 0,
      timeouts: 0,
      circuitOpens: 0,
      fallbackCalls: 0,
      stateHistory: []
    };
    
    this.recordStateChange('CLOSED', 'Reset by admin');
    console.log(`🔄 Circuit breaker ${this.name} reset to initial state`);
  }
}

module.exports = CircuitBreaker;