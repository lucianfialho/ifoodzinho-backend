/**
 * Main route aggregator for FoodieSwipe API
 */
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth.routes');
const usersRoutes = require('./users.routes');
const dishesRoutes = require('./dishes.routes');
const couplesRoutes = require('./couples.routes');
const healthRoutes = require('./health.routes');

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/dishes', dishesRoutes);
router.use('/couples', couplesRoutes);
router.use('/health', healthRoutes);

// API info endpoint
router.get('/', (req, res) => {
  res.json({
    name: 'FoodieSwipe API',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      dishes: '/api/dishes',
      couples: '/api/couples',
      health: '/api/health'
    }
  });
});

module.exports = router;