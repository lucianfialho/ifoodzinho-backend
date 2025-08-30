/**
 * FoodieSwipe Backend Application Configuration
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// Import configuration and middleware
const { getCorsConfig } = require('./config/corsConfig');
const { securityHeaders } = require('./middleware/securityHeaders');
const { errorHandler } = require('./middleware/error.middleware');
// Monitoring middleware (optional for production)
// const { trackApiPerformance, trackMemoryUsage, trackSecurityEvents } = require('./middleware/monitoring.middleware');
const routes = require('./routes');

// Validate environment variables before starting
const { validateEnvironment } = require('./config/validateEnv');

try {
  validateEnvironment();
} catch (error) {
  console.error('❌ Environment validation failed:', error.message);
  console.error('💡 Please ensure all required environment variables are set:');
  console.error('   - FIREBASE_PROJECT_ID');
  console.error('   - FIREBASE_PRIVATE_KEY');
  console.error('   - FIREBASE_CLIENT_EMAIL');
  console.error('   - FIREBASE_CLIENT_ID');
  console.error('   - NODE_ENV');
  process.exit(1);
}

const app = express();

// Security middleware (must be first)
app.use(...securityHeaders());

// CORS configuration
const corsOptions = getCorsConfig();
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'development' ? 1000 : 100, // More lenient in dev
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString()
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Performance monitoring middleware
// Optional monitoring middleware (commented for cleaner production)
// app.use(trackApiPerformance);
// app.use(trackMemoryUsage);  
// app.use(trackSecurityEvents);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const method = req.method;
  const url = req.url;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const size = res.get('Content-Length') || 0;
    
    console.log(`${method} ${url} ${status} ${duration}ms - ${size}b`);
  });
  
  next();
});

// Health check endpoint (before rate limiting)
app.get('/ping', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Serve monitoring dashboard
app.use('/public', express.static('public'));
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/public/monitoring-dashboard.html');
});

// Mount API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FoodieSwipe Backend API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      api: '/api',
      health: '/api/health',
      docs: '/api/docs' // TODO: Add API documentation
    }
  });
});

// Custom error handler middleware (must be after all routes)
app.use(errorHandler || ((error, req, res, next) => {
  console.error('🚨 Unhandled error:', error);
  
  const statusCode = error.statusCode || error.status || 500;
  const message = error.message || 'Internal server error';
  
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? message : 'Internal server error',
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
}));

// 404 handler (must be last)
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    timestamp: new Date().toISOString(),
    availableRoutes: {
      api: '/api',
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      dishes: '/api/dishes',
      couples: '/api/couples'
    }
  });
});

module.exports = app;