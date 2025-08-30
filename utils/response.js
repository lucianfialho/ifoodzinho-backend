/**
 * Standard response utilities for FoodieSwipe API
 */

function successResponse(res, message, data = null, statusCode = 200) {
  const response = {
    success: true,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return res.status(statusCode).json(response);
}

function errorResponse(res, message, statusCode = 500, errors = null) {
  const response = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  // Log error if 5xx
  if (statusCode >= 500) {
    console.error('🚨 Server Error:', message);
  }
  
  return res.status(statusCode).json(response);
}

function paginatedResponse(res, message, data, pagination) {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      page: pagination.page || 1,
      limit: pagination.limit || 10,
      total: pagination.total || 0,
      totalPages: Math.ceil((pagination.total || 0) / (pagination.limit || 10))
    },
    timestamp: new Date().toISOString()
  });
}

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse
};