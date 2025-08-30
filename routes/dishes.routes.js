/**
 * Dishes and restaurant routes
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/asyncHandler');

// Import existing middleware
const { authenticateUser, optionalAuth } = require('../middleware/firebaseAuth');
const { successResponse, errorResponse } = require('../utils/response');

// Import simple iFood service  
const ifoodService = require('../services/simpleIfoodService');

// POST /api/dishes/feed (protected) - Generate optimized dish feed for user
router.post('/feed', authenticateUser, asyncHandler(async (req, res) => {
  const { latitude, longitude, feedSize = 100, filters = {} } = req.body;
  const userId = req.user.uid;

  // Validate input
  if (!latitude || !longitude) {
    return errorResponse(res, 'Latitude and longitude are required', 400);
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return errorResponse(res, 'Invalid latitude or longitude format', 400);
  }

  try {
    console.log(`🍽️ Generating optimized dish feed for user ${userId} at (${latitude}, ${longitude})`);
    
    const dishes = await ifoodService.getOptimizedDishFeed(
      latitude, 
      longitude, 
      feedSize
    );

    return successResponse(res, 'Optimized dish feed generated successfully', {
      dishes,
      total: dishes.length,
      performance: {
        optimized: true,
        cached: dishes.length > 0 // Simple indicator
      }
    });

  } catch (error) {
    console.error('Error generating optimized dish feed:', error);
    return errorResponse(res, 'Failed to generate dish feed', 500);
  }
}));

// GET /api/dishes/restaurants (optional auth) - Optimized restaurant retrieval
router.get('/restaurants', optionalAuth, asyncHandler(async (req, res) => {
  const { latitude, longitude, limit = 20 } = req.query;

  if (!latitude || !longitude) {
    return errorResponse(res, 'Latitude and longitude are required', 400);
  }

  if (isNaN(latitude) || isNaN(longitude)) {
    return errorResponse(res, 'Invalid latitude or longitude format', 400);
  }

  try {
    const restaurants = await ifoodService.getRestaurants(
      parseFloat(latitude), 
      parseFloat(longitude), 
      { size: parseInt(limit) }
    );

    return successResponse(res, 'Restaurants retrieved successfully', {
      restaurants,
      total: restaurants.length,
      performance: {
        optimized: true
      }
    });

  } catch (error) {
    console.error('Error getting optimized restaurants:', error);
    return errorResponse(res, 'Failed to get restaurants', 500);
  }
}));

// GET /api/dishes/restaurant/:id/menu - Optimized menu retrieval
router.get('/restaurant/:id/menu', optionalAuth, asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  if (!id) {
    return errorResponse(res, 'Restaurant ID is required', 400);
  }
  
  try {
    const dishes = await ifoodService.getRestaurantMenu(id);
    
    // Group dishes by category for better presentation
    const categories = new Map();
    
    dishes.forEach(dish => {
      const categoryName = dish.category || 'Other';
      if (!categories.has(categoryName)) {
        categories.set(categoryName, []);
      }
      categories.get(categoryName).push({
        id: dish.id,
        name: dish.name,
        description: dish.description,
        price: dish.price,
        imageUrl: dish.imageUrl
      });
    });

    const menu = {
      restaurantId: id,
      restaurantName: dishes[0]?.restaurantName || '',
      categories: Array.from(categories.entries()).map(([name, items]) => ({
        name,
        items
      })),
      totalItems: dishes.length
    };

    return successResponse(res, 'Menu retrieved successfully', menu);

  } catch (error) {
    console.error('Error getting optimized restaurant menu:', error);
    return errorResponse(res, 'Failed to get restaurant menu', 500);
  }
}));

// GET /api/dishes/metrics - Performance metrics endpoint
router.get('/metrics', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const metrics = ifoodService.getMetrics();
    
    return successResponse(res, 'Performance metrics retrieved successfully', {
      ...metrics,
      health: {
        status: ifoodService.isHealthy() ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error getting service metrics:', error);
    return errorResponse(res, 'Failed to get metrics', 500);
  }
}));

module.exports = router;