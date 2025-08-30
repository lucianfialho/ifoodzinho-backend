/**
 * Health check and system status routes
 */
const express = require('express');
const router = express.Router();
const { successResponse } = require('../utils/response');
const { asyncHandler } = require('../utils/asyncHandler');

// Basic health check
router.get('/', asyncHandler(async (req, res) => {
  const healthData = {
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  return successResponse(res, 'System is healthy', healthData);
}));

// Detailed system status
router.get('/status', asyncHandler(async (req, res) => {
  const statusData = {
    server: {
      status: 'running',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: process.version,
      platform: process.platform
    },
    database: {
      firebase: 'connected' // TODO: Add actual Firebase health check
    },
    cache: {
      status: 'active' // TODO: Add cache stats
    },
    external_apis: {
      ifood: 'unknown' // TODO: Add iFood API health check
    }
  };

  return successResponse(res, 'System status retrieved', statusData);
}));

// WebSocket connection stats
router.get('/websocket', asyncHandler(async (req, res) => {
  try {
    // Get WebSocket stats from secure service
    const secureWebSocketService = require('../services/secureWebSocketService');
    const wsStats = secureWebSocketService.getStats ? secureWebSocketService.getStats() : {
      active_connections: 0,
      total_connections: 0,
      messages_sent: 0,
      messages_received: 0
    };

    return successResponse(res, 'WebSocket stats retrieved', wsStats);
  } catch (error) {
    console.error('Error getting WebSocket stats:', error);
    return successResponse(res, 'WebSocket stats retrieved', {
      active_connections: 0,
      total_connections: 0,
      status: 'unknown'
    });
  }
}));

// Performance metrics endpoint
router.get('/metrics', asyncHandler(async (req, res) => {
  try {
    // Get comprehensive system metrics
    const optimizedIfoodService = require('../services/optimizedIfoodService');
    const httpClient = require('../config/httpClient');
    
    const metrics = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        environment: process.env.NODE_ENV || 'development'
      },
      api_optimization: optimizedIfoodService.getMetrics(),
      http_client: httpClient.getMetrics(),
      timestamp: new Date().toISOString()
    };

    return successResponse(res, 'System metrics retrieved', metrics);

  } catch (error) {
    console.error('Error getting system metrics:', error);
    return errorResponse(res, 'Failed to get metrics', 500);
  }
}));

module.exports = router;