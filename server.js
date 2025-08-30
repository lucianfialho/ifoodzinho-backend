/**
 * FoodieSwipe Backend Server Entry Point
 */
require('dotenv').config();

const app = require('./app');
const secureWebSocketService = require('./services/secureWebSocketService');

const PORT = process.env.PORT || 4000;

// Create HTTP server
const server = require('http').createServer(app);

// Initialize secure WebSocket service
secureWebSocketService.initialize(server);

// Start server (bind to all interfaces for React Native connectivity)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 FoodieSwipe Backend running on port ${PORT}`);
  console.log(`📈 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Server URL: http://localhost:${PORT}`);
  console.log(`📡 WebSocket initialized for real-time features`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
    console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  }
});

// Graceful shutdown handlers
const shutdown = (signal) => {
  console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    
    // Close database connections, cleanup resources, etc.
    // TODO: Add any cleanup logic here
    
    console.log('👋 Process terminated gracefully');
    process.exit(0);
  });
  
  // Force shutdown after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  shutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('UNHANDLED_REJECTION');
});

module.exports = server;