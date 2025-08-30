/**
 * Authentication routes
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/asyncHandler');

// Import existing controllers and middleware
const authController = require('../controllers/authController');
const { authenticateUser, verifyWithTokenInBody } = require('../middleware/firebaseAuth');

// POST /api/auth/login
router.post('/login', asyncHandler(authController.login));

// POST /api/auth/register  
router.post('/register', asyncHandler(authController.register));

// POST /api/auth/google
router.post('/google', asyncHandler(authController.googleLogin));

// POST /api/auth/apple
router.post('/apple', asyncHandler(authController.appleLogin));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(authController.refreshToken));

// POST /api/auth/logout (protected)
router.post('/logout', authenticateUser, asyncHandler(authController.logout));

// GET /api/auth/profile (protected) - Fixed to use proper controller
router.get('/profile', authenticateUser, asyncHandler(authController.getProfile));

// Alternative route removed - using proper controller method above

// POST /api/auth/verify - Create/update user after login
router.post('/verify', verifyWithTokenInBody, asyncHandler(authController.verifyUser));

// POST /api/auth/verify-token  
router.post('/verify-token', verifyWithTokenInBody, asyncHandler(authController.verifyToken));

// DELETE /api/auth/account (protected)
router.delete('/account', authenticateUser, asyncHandler(authController.deleteAccount));

module.exports = router;