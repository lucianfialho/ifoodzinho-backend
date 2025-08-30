/**
 * Centralized error handling middleware
 */
const { errorResponse } = require('../utils/response');

function errorHandler(error, req, res, next) {
  // Log error details
  console.error('🚨 Error caught by middleware:', {
    message: error.message,
    stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Default error response
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Internal server error';

  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized access';
  } else if (error.name === 'FirebaseError') {
    statusCode = 401;
    message = 'Authentication failed';
  } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    statusCode = 503;
    message = 'External service unavailable';
  } else if (error.name === 'SyntaxError' && error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON format';
  }

  // Don't expose internal errors in production
  if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
    message = 'Internal server error';
  }

  // Send error response
  return errorResponse(res, message, statusCode, 
    process.env.NODE_ENV === 'development' ? { 
      name: error.name,
      stack: error.stack 
    } : null
  );
}

module.exports = { errorHandler };