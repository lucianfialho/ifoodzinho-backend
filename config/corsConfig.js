const corsConfig = {
  development: {
    origin: true, // Allow all origins in development for React Native
    /* 
    origin: [
      'http://localhost:3000',        // React dev server
      'http://localhost:8081',        // Expo dev server
      'exp://127.0.0.1:8081',        // Expo local
      'exp://192.168.68.115:8081',   // Expo LAN (current IP)
      'http://localhost:19006'        // Expo web
    ],
    */
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin'
    ]
  },
  
  production: {
    origin: [
      'https://foodieswipe.com',           // Production domain
      'https://www.foodieswipe.com',       // WWW version
      'https://admin.foodieswipe.com',     // Admin panel se houver
      // Add mobile app schemes when published
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept'
    ]
  },

  test: {
    origin: true, // Allow all origins in test environment
    credentials: true
  }
};

function getCorsConfig() {
  const env = process.env.NODE_ENV || 'development';
  let config = corsConfig[env];
  
  if (!config) {
    throw new Error(`No CORS configuration found for environment: ${env}`);
  }
  
  // Override with environment variables if provided
  if (process.env.ALLOWED_ORIGINS) {
    const envOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    config = {
      ...config,
      origin: envOrigins
    };
  }
  
  return {
    ...config,
    // Custom origin function for more control
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      if (config.origin === true) {
        return callback(null, true);
      }
      
      if (config.origin.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      
      // Log blocked origins for debugging
      if (process.env.NODE_ENV === 'development') {
        console.warn(`🚫 CORS blocked origin: ${origin}`);
        console.warn(`🔍 Allowed origins:`, typeof config.origin === 'object' ? config.origin : 'Custom function');
      }
      return callback(new Error('Not allowed by CORS'), false);
    }
  };
}

module.exports = { getCorsConfig };