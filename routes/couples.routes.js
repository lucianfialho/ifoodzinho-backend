/**
 * Couple features routes
 */
const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/asyncHandler');

// Import existing controllers and middleware
const coupleController = require('../controllers/coupleController');
const { authenticateUser } = require('../middleware/firebaseAuth');

// POST /api/couples/invite (protected)
router.post('/invite', authenticateUser, asyncHandler(coupleController.sendCoupleInvite));

// GET /api/couples/invites (protected)
router.get('/invites', authenticateUser, asyncHandler(coupleController.getCoupleInvites));

// POST /api/couples/accept (protected)
router.post('/accept', authenticateUser, asyncHandler(coupleController.acceptCoupleInvite));

// POST /api/couples/reject (protected)
router.post('/reject', authenticateUser, asyncHandler(coupleController.rejectCoupleInvite));

// GET /api/couples/info (protected)
router.get('/info', authenticateUser, asyncHandler(coupleController.getCoupleInfo));

// DELETE /api/couples/disconnect (protected)
router.delete('/disconnect', authenticateUser, asyncHandler(coupleController.disconnectCouple));

// POST /api/couples/session/create (protected)
router.post('/session/create', authenticateUser, asyncHandler(coupleController.createCoupleSession));

// POST /api/couples/session/join (protected)
router.post('/session/join', authenticateUser, asyncHandler(coupleController.joinCoupleSession));

// GET /api/couples/session/status (protected)
router.get('/session/status', authenticateUser, asyncHandler(coupleController.getCoupleSessionStatus));

// POST /api/couples/session/leave (protected)
router.post('/session/leave', authenticateUser, asyncHandler(coupleController.leaveCoupleSession));

// GET /api/couples/feed (protected) - Synchronized dish feed for couples
router.get('/feed', authenticateUser, asyncHandler(coupleController.getCouplesFeed));

// POST /api/couples/swipe (protected)
router.post('/swipe', authenticateUser, asyncHandler(coupleController.handleCoupleSwipe));

// GET /api/couples/matches (protected)
router.get('/matches', authenticateUser, asyncHandler(coupleController.getCoupleMatches));

module.exports = router;