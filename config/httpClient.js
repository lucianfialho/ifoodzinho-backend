/**
 * Optimized HTTP client with connection pooling for external APIs
 */
const axios = require('axios');
const Agent = require('agentkeepalive');
const { HttpsAgent } = require('agentkeepalive');

class HttpClientManager {
  constructor() {
    this.clients = new Map();
    this.initializeClients();
  }
  
  initializeClients() {
    // iFood API Client with aggressive connection pooling
    this.ifoodClient = axios.create({
      timeout: 10000, // Reduced from 15s to 10s
      httpAgent: new Agent({
        keepAlive: true,
        maxSockets: 50,        // Increased for better concurrency
        maxFreeSockets: 10,    // More keep-alive connections
        timeout: 60000,
        freeSocketTimeout: 30000,
        socketActiveTTL: 110000 // 1m50s
      }),
      httpsAgent: new HttpsAgent({
        keepAlive: true,
        maxSockets: 50,
        maxFreeSockets: 10,
        timeout: 60000,
        freeSocketTimeout: 30000,
        socketActiveTTL: 110000
      }),
      // Compression for faster responses
      responseType: 'json',
      maxContentLength: 50 * 1024 * 1024, // 50MB
      maxBodyLength: 50 * 1024 * 1024,
      // Connection optimization
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors
    });
    
    // Request interceptor for performance tracking
    this.ifoodClient.interceptors.request.use((config) => {
      config.metadata = { 
        startTime: Date.now(),
        url: config.url 
      };
      
      // Add debug logging in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 iFood API Request: ${config.method?.toUpperCase()} ${this.truncateUrl(config.url)}`);
      }
      
      return config;
    });
    
    // Response interceptor for metrics and error handling
    this.ifoodClient.interceptors.response.use(
      (response) => {
        const duration = Date.now() - response.config.metadata.startTime;
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`✅ iFood API Success: ${response.status} (${duration}ms) - ${this.truncateUrl(response.config.metadata.url)}`);
        }
        
        // Track performance metrics
        this.recordMetric('success', duration);
        return response;
      },
      (error) => {
        const duration = error.config?.metadata?.startTime 
          ? Date.now() - error.config.metadata.startTime 
          : 0;
          
        const status = error.response?.status || 'TIMEOUT';
        const url = error.config?.metadata?.url || 'unknown';
        
        console.error(`❌ iFood API Error: ${status} (${duration}ms) - ${this.truncateUrl(url)}`);
        
        // Track error metrics
        this.recordMetric('error', duration, status);
        
        // Enhanced error information
        if (error.response) {
          error.apiError = {
            status: error.response.status,
            statusText: error.response.statusText,
            duration,
            url: this.truncateUrl(url)
          };
        }
        
        return Promise.reject(error);
      }
    );

    // Performance metrics tracking
    this.metrics = {
      requests: 0,
      successes: 0,
      errors: 0,
      totalDuration: 0,
      avgDuration: 0,
      errorsByStatus: new Map()
    };
  }
  
  truncateUrl(url) {
    if (!url) return 'unknown';
    return url.length > 100 ? url.substring(0, 100) + '...' : url;
  }
  
  recordMetric(type, duration, status = null) {
    this.metrics.requests++;
    this.metrics.totalDuration += duration;
    this.metrics.avgDuration = Math.round(this.metrics.totalDuration / this.metrics.requests);
    
    if (type === 'success') {
      this.metrics.successes++;
    } else {
      this.metrics.errors++;
      if (status) {
        const currentCount = this.metrics.errorsByStatus.get(status) || 0;
        this.metrics.errorsByStatus.set(status, currentCount + 1);
      }
    }
  }
  
  getIfoodClient() {
    return this.ifoodClient;
  }
  
  // Generic HTTP client factory
  createClient(baseURL, options = {}) {
    const clientKey = `${baseURL}_${JSON.stringify(options)}`;
    
    if (this.clients.has(clientKey)) {
      return this.clients.get(clientKey);
    }
    
    const client = axios.create({
      baseURL,
      timeout: options.timeout || 8000,
      ...options,
      httpAgent: new Agent({
        keepAlive: true,
        maxSockets: options.maxSockets || 20,
        maxFreeSockets: options.maxFreeSockets || 5,
        timeout: 30000,
        freeSocketTimeout: 15000,
      }),
      httpsAgent: new HttpsAgent({
        keepAlive: true,
        maxSockets: options.maxSockets || 20,
        maxFreeSockets: options.maxFreeSockets || 5,
        timeout: 30000,
        freeSocketTimeout: 15000,
      })
    });
    
    this.clients.set(clientKey, client);
    return client;
  }
  
  // Get performance metrics
  getMetrics() {
    return {
      ...this.metrics,
      errorsByStatus: Object.fromEntries(this.metrics.errorsByStatus),
      successRate: this.metrics.requests > 0 
        ? Math.round((this.metrics.successes / this.metrics.requests) * 100) 
        : 0,
      errorRate: this.metrics.requests > 0 
        ? Math.round((this.metrics.errors / this.metrics.requests) * 100) 
        : 0
    };
  }
  
  // Reset metrics (useful for testing)
  resetMetrics() {
    this.metrics = {
      requests: 0,
      successes: 0,
      errors: 0,
      totalDuration: 0,
      avgDuration: 0,
      errorsByStatus: new Map()
    };
  }
}

module.exports = new HttpClientManager();