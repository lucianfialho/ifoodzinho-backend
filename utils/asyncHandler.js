/**
 * Async handler wrapper to eliminate repetitive try/catch blocks in route handlers
 */

function asyncHandler(fn) {
  return function(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };