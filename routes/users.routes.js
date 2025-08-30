/**
 * User management routes
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/asyncHandler');

// Import existing middleware
const { authenticateUser, optionalAuth } = require('../middleware/firebaseAuth');
const userService = require('../services/userService');
const { successResponse, errorResponse } = require('../utils/response');

// GET /api/users/profile (protected)
router.get('/profile', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const userProfile = await userService.getUserProfile(req.user.uid);
    return successResponse(res, 'Profile retrieved successfully', userProfile);
  } catch (error) {
    console.error('Error getting user profile:', error);
    return errorResponse(res, 'Failed to get profile', 500);
  }
}));

// PUT /api/users/profile (protected)
router.put('/profile', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const updatedProfile = await userService.updateUserProfile(req.user.uid, req.body);
    return successResponse(res, 'Profile updated successfully', updatedProfile);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return errorResponse(res, 'Failed to update profile', 500);
  }
}));

// POST /api/users/preferences (protected)
router.post('/preferences', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const preferences = await userService.updateUserPreferences(req.user.uid, req.body);
    return successResponse(res, 'Preferences updated successfully', preferences);
  } catch (error) {
    console.error('Error updating preferences:', error);
    return errorResponse(res, 'Failed to update preferences', 500);
  }
}));

// GET /api/users/preferences (protected)
router.get('/preferences', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const preferences = await userService.getUserPreferences(req.user.uid);
    return successResponse(res, 'Preferences retrieved successfully', preferences);
  } catch (error) {
    console.error('Error getting preferences:', error);
    return errorResponse(res, 'Failed to get preferences', 500);
  }
}));

// GET /api/users/stats (protected)
router.get('/stats', authenticateUser, asyncHandler(async (req, res) => {
  try {
    const stats = await userService.getUserStats(req.user.uid);
    return successResponse(res, 'User stats retrieved successfully', stats);
  } catch (error) {
    console.error('Error getting user stats:', error);
    return errorResponse(res, 'Failed to get stats', 500);
  }
}));

module.exports = router;