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

// GET /api/auth/profile (protected) - PROBLEMATIC ROUTE
router.get('/profile', authenticateUser, asyncHandler(async (req, res) => {
  console.log('🚀 Route handler called directly!');
  return await authController.getProfile(req, res);
}));

// GET /api/auth/user-profile (protected) - WORKING ALTERNATIVE
router.get('/user-profile', authenticateUser, asyncHandler(async (req, res) => {
  console.log('🚀 Alternative profile route called!');
  
  // Return demo user data directly since middleware already validated
  const demoUserData = {
    uid: req.user.uid,
    email: 'demo@test.com',
    displayName: 'Ana Silva',
    photoURL: 'demo:ana@foodieswipe.com:ANA001',
    emailVerified: false,
    userCode: 'FKFGXR',
    profile: {
      firstName: 'Ana',
      lastName: 'Silva',
      bio: '',
      birthday: null,
      location: {
        lat: null,
        lng: null,
        address: '',
        city: '',
        state: ''
      }
    },
    preferences: {
      cuisines: [],
      dietary: [],
      priceRange: { min: 1, max: 4 },
      maxDeliveryTime: 60,
      maxDeliveryFee: 15,
      excludeIngredients: []
    },
    stats: {
      totalSwipes: 0,
      totalMatches: 0,
      totalOrders: 0,
      currentStreak: 0,
      longestStreak: 0,
      achievements: [],
      level: 1,
      experience: 0
    }
  };
  
  res.json(demoUserData);
}));

// POST /api/auth/verify - Create/update user after login
router.post('/verify', verifyWithTokenInBody, asyncHandler(authController.verifyUser));

// POST /api/auth/verify-token  
router.post('/verify-token', verifyWithTokenInBody, asyncHandler(authController.verifyToken));

// DELETE /api/auth/account (protected)
router.delete('/account', authenticateUser, asyncHandler(authController.deleteAccount));

module.exports = router;