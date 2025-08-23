# FoodieSwipe - Social Features Integration Guide

## 🎯 Quick Integration with Existing Backend

This guide shows how to incrementally add social features to your existing FoodieSwipe backend without breaking current functionality.

## 📋 Integration Phases

### Phase 1: Database Setup (30 minutes)
1. **Install PostgreSQL** (if not already using a database)
2. **Run database migrations** 
3. **Update existing endpoints** to use database

### Phase 2: Basic Social Infrastructure (2 hours)
1. **Add authentication middleware**
2. **Implement user management**
3. **Add friendship system**

### Phase 3: Real-time Features (3 hours)
1. **Add Socket.IO integration**
2. **Implement group management** 
3. **Add real-time swipe coordination**

### Phase 4: Advanced Features (4 hours)
1. **Add push notifications**
2. **Implement achievement system**
3. **Add activity feed**

## 🚀 Step-by-Step Integration

### Step 1: Update Dependencies

```bash
# Install required packages
npm install pg socket.io bcryptjs jsonwebtoken joi multer uuid
npm install --save-dev @types/bcryptjs @types/jsonwebtoken
```

### Step 2: Create Enhanced server.js

Here's how to modify your existing `server.js` to support social features:

```javascript
// Enhanced server.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const axios = require('axios');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Cache - Keep existing cache configuration
const cache = new NodeCache({ stdTTL: 600 });

// Middlewares - Keep existing ones
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting - Keep existing configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});
app.use('/api', limiter);

// Import social services (create these files as shown in implementation plan)
let SocketService, AuthService, SocialRoutes;

// Initialize social features if database is available
const initializeSocialFeatures = async () => {
  try {
    // Try to connect to database
    const pool = require('./config/database');
    await pool.query('SELECT NOW()');
    console.log('📊 Database connected - Social features enabled');
    
    // Load social modules
    SocketService = require('./services/SocketService');
    AuthService = require('./services/AuthService'); 
    SocialRoutes = require('./routes/social');
    
    // Initialize socket service
    new SocketService(io);
    
    // Add authentication middleware
    app.use('/api/auth', require('./routes/auth'));
    app.use('/api/social', require('./middleware/auth'), SocialRoutes);
    
    console.log('🤝 Social features initialized');
  } catch (error) {
    console.log('⚠️ Database not available - Running in basic mode');
    console.log('  Social features will be disabled');
  }
};

// Keep all existing iFood API functions exactly as they are
const getIfoodHeaders = () => ({
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'pt-BR,pt;q=1',
  'app_version': '9.126.1',
  'browser': 'Mac OS',
  'content-type': 'application/json',
  'country': 'BR',
  'origin': 'https://www.ifood.com.br',
  'platform': 'Desktop',
  'referer': 'https://www.ifood.com.br/',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'x-client-application-key': '41a266ee-51b7-4c37-9e9d-5cd331f280d5',
  'x-device-model': 'Macintosh Chrome'
});

// KEEP ALL EXISTING ENDPOINTS EXACTLY AS THEY ARE
// This ensures backward compatibility

// Existing restaurant endpoint - NO CHANGES
app.get('/api/restaurants/:lat/:lng', async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { size = 20 } = req.query;
    
    const cacheKey = `restaurants_${lat}_${lng}_${size}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    console.log(`🔍 Buscando restaurantes para lat: ${lat}, lng: ${lng}`);

    const response = await axios.post(
      `https://cw-marketplace.ifood.com.br/v2/bm/home?latitude=${lat}&longitude=${lng}&channel=IFOOD&size=${size}&alias=HOME_FOOD_DELIVERY`,
      {
        "supported-headers": ["OPERATION_HEADER"],
        "supported-cards": [
          "MERCHANT_LIST",
          "MERCHANT_LIST_V2", 
          "FEATURED_MERCHANT_LIST",
          "SIMPLE_MERCHANT_CAROUSEL"
        ],
        "supported-actions": ["merchant"],
        "feed-feature-name": "",
        "faster-overrides": ""
      },
      { headers: getIfoodHeaders() }
    );

    const restaurants = [];
    const data = response.data;
    
    if (data.sections) {
      data.sections.forEach(section => {
        section.cards?.forEach(card => {
          if (card.cardType && card.cardType.includes('MERCHANT')) {
            const contents = card.data?.contents || [];
            restaurants.push(...contents);
          }
        });
      });
    }

    const result = {
      baseImageUrl: data.baseImageUrl || 'https://static-images.ifood.com.br/image/upload',
      restaurants,
      total: restaurants.length
    };

    cache.set(cacheKey, result, 600);
    
    console.log(`✅ Encontrados ${restaurants.length} restaurantes`);
    res.json(result);

  } catch (error) {
    console.error('❌ Erro ao buscar restaurantes:', error.message);
    res.status(500).json({ 
      error: 'Erro ao buscar restaurantes',
      details: error.message 
    });
  }
});

// Existing menu endpoint - NO CHANGES  
app.get('/api/menu/:restaurantId/:lat/:lng', async (req, res) => {
  try {
    const { restaurantId, lat, lng } = req.params;
    
    const cacheKey = `menu_${restaurantId}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    console.log(`🍽️ Buscando cardápio para restaurante: ${restaurantId}`);

    const response = await axios.get(
      `https://cw-marketplace.ifood.com.br/v1/bm/merchants/${restaurantId}/catalog?latitude=${lat}&longitude=${lng}`,
      {
        headers: {
          ...getIfoodHeaders(),
          'access_key': '69f181d5-0046-4221-b7b2-deef62bd60d5',
          'secret_key': '9ef4fb4f-7a1d-4e0d-a9b1-9b82873297d8'
        }
      }
    );

    const catalogData = response.data;
    
    if (catalogData.code !== '00') {
      throw new Error(`API retornou erro: ${catalogData.code}`);
    }

    const dishes = [];
    const menu = catalogData.data?.menu || [];
    
    menu.forEach(category => {
      const categoryDishes = category.itens?.map(dish => ({
        ...dish,
        category: category.name,
        categoryCode: category.code,
        imageUrl: dish.logoUrl ? `https://static-images.ifood.com.br/image/upload/${dish.logoUrl}` : null,
        restaurantId
      })) || [];
      
      dishes.push(...categoryDishes);
    });

    const result = {
      restaurantId,
      totalCategories: menu.length,
      totalDishes: dishes.length,
      categories: menu.map(cat => ({ 
        name: cat.name, 
        code: cat.code, 
        itemCount: cat.itens?.length || 0 
      })),
      dishes: dishes.filter(dish => dish.imageUrl)
    };

    cache.set(cacheKey, result, 1800);
    
    console.log(`✅ Encontrados ${result.dishes.length} pratos com fotos`);
    res.json(result);

  } catch (error) {
    console.error('❌ Erro ao buscar cardápio:', error.message);
    res.status(500).json({ 
      error: 'Erro ao buscar cardápio',
      details: error.message 
    });
  }
});

// Existing dishes feed endpoint - NO CHANGES
app.post('/api/dishes/feed', async (req, res) => {
  try {
    const { lat, lng, restaurantIds, limit = 50 } = req.body;
    
    if (!restaurantIds || !Array.isArray(restaurantIds)) {
      return res.status(400).json({ error: 'restaurantIds array is required' });
    }

    console.log(`🍽️ Buscando feed de pratos de ${restaurantIds.length} restaurantes`);

    const allDishes = [];
    const errors = [];

    for (const restaurantId of restaurantIds.slice(0, 10)) {
      try {
        const cacheKey = `menu_${restaurantId}`;
        let menuData = cache.get(cacheKey);
        
        if (!menuData) {
          const response = await axios.get(
            `https://cw-marketplace.ifood.com.br/v1/bm/merchants/${restaurantId}/catalog?latitude=${lat}&longitude=${lng}`,
            {
              headers: {
                ...getIfoodHeaders(),
                'access_key': '69f181d5-0046-4221-b7b2-deef62bd60d5',
                'secret_key': '9ef4fb4f-7a1d-4e0d-a9b1-9b82873297d8'
              }
            }
          );

          if (response.data.code === '00') {
            const menu = response.data.data?.menu || [];
            const dishes = [];
            
            menu.forEach(category => {
              const categoryDishes = category.itens?.map(dish => ({
                ...dish,
                category: category.name,
                categoryCode: category.code,
                imageUrl: dish.logoUrl ? `https://static-images.ifood.com.br/image/upload/${dish.logoUrl}` : null,
                restaurantId
              })) || [];
              
              dishes.push(...categoryDishes.filter(d => d.imageUrl));
            });

            menuData = { dishes };
            cache.set(cacheKey, menuData, 1800);
          }
        }

        if (menuData && menuData.dishes) {
          allDishes.push(...menuData.dishes);
        }

        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors.push({ restaurantId, error: error.message });
      }
    }

    const shuffled = allDishes.sort(() => 0.5 - Math.random());
    const limitedDishes = shuffled.slice(0, limit);

    console.log(`✅ Feed de ${limitedDishes.length} pratos criado`);

    res.json({
      dishes: limitedDishes,
      total: limitedDishes.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Erro ao criar feed:', error.message);
    res.status(500).json({ 
      error: 'Erro ao criar feed de pratos',
      details: error.message 
    });
  }
});

// NEW: Enhanced dishes feed with social context (only if database is available)
app.post('/api/dishes/feed/social', async (req, res) => {
  try {
    // Check if social features are available
    if (!SocketService) {
      return res.status(501).json({ 
        error: 'Social features not available', 
        message: 'Database required for social features' 
      });
    }

    const { lat, lng, restaurantIds, userId, groupId, limit = 50 } = req.body;
    
    // Get regular feed
    const regularFeedResponse = await axios.post(`http://localhost:${PORT}/api/dishes/feed`, {
      lat, lng, restaurantIds, limit: limit * 2 // Get more dishes to filter
    });

    let dishes = regularFeedResponse.data.dishes;

    // Add social context if user is provided
    if (userId) {
      const SocialDishService = require('./services/SocialDishService');
      dishes = await SocialDishService.addSocialContext(dishes, userId, groupId);
    }

    // Limit final results
    dishes = dishes.slice(0, limit);

    res.json({
      dishes,
      total: dishes.length,
      social_features_enabled: true
    });

  } catch (error) {
    console.error('❌ Erro ao criar feed social:', error.message);
    res.status(500).json({ 
      error: 'Erro ao criar feed social',
      details: error.message 
    });
  }
});

// Keep existing health check with enhanced info
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    },
    features: {
      ifood_api: 'enabled',
      social_features: SocketService ? 'enabled' : 'disabled',
      realtime_communication: io ? 'enabled' : 'disabled'
    }
  };
  
  res.json(healthInfo);
});

// Initialize social features
initializeSocialFeatures();

// Start server
server.listen(PORT, () => {
  console.log(`🚀 FoodieSwipe Backend rodando na porta ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  
  if (io) {
    console.log(`🔄 WebSocket server inicializado`);
  }
});
```

### Step 3: Add Authentication Middleware

```javascript
// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token.' });
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);
      if (user) req.user = user;
    }
    
    next();
  } catch (error) {
    // Ignore auth errors in optional auth
    next();
  }
};

module.exports = { auth, optionalAuth };
```

### Step 4: Create Basic Database Configuration

```javascript
// config/database.js
const { Pool } = require('pg');

let pool;

try {
  pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'foodieswipe',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // Test connection on import
  pool.query('SELECT NOW()', (err) => {
    if (err) {
      console.log('Database connection failed - social features will be disabled');
      pool = null;
    }
  });
  
} catch (error) {
  console.log('Database configuration failed - social features will be disabled');
  pool = null;
}

module.exports = pool;
```

### Step 5: Create Basic Auth Routes

```javascript
// routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const joi = require('joi');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Registration schema
const registerSchema = joi.object({
  email: joi.string().email().required(),
  username: joi.string().alphanum().min(3).max(30).required(),
  password: joi.string().min(6).required(),
  displayName: joi.string().max(100).optional()
});

// Login schema
const loginSchema = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required()
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, username, password, displayName } = req.body;

    // Check if user exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      email,
      username,
      password,
      displayName: displayName || username
    });

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.display_name
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      displayName: req.user.display_name,
      avatarUrl: req.user.avatar_url,
      bio: req.user.bio,
      stats: req.user.stats
    }
  });
});

module.exports = router;
```

## 🔄 Migration Strategy

### Progressive Enhancement Approach

1. **Week 1: Database Foundation**
   - Set up PostgreSQL
   - Run initial migrations
   - Add basic user authentication
   - **Existing API endpoints remain unchanged**

2. **Week 2: Core Social Features**
   - Implement friendship system
   - Add basic group management
   - **All existing functionality still works**

3. **Week 3: Real-time Features**
   - Add Socket.IO integration
   - Implement group swipe coordination
   - **Enhanced experience for social users, basic experience for others**

4. **Week 4: Advanced Features**
   - Add push notifications
   - Implement achievement system
   - Add activity feed
   - **Full social experience**

### Feature Flags

```javascript
// config/features.js
module.exports = {
  SOCIAL_FEATURES: process.env.ENABLE_SOCIAL === 'true',
  REALTIME_CHAT: process.env.ENABLE_CHAT === 'true',
  PUSH_NOTIFICATIONS: process.env.ENABLE_PUSH === 'true',
  ACHIEVEMENTS: process.env.ENABLE_ACHIEVEMENTS === 'true'
};
```

Use feature flags in your code:

```javascript
const features = require('./config/features');

if (features.SOCIAL_FEATURES) {
  // Add social routes
  app.use('/api/social', socialRoutes);
}

if (features.REALTIME_CHAT) {
  // Initialize socket.io
  setupSocketIO();
}
```

## 📊 Testing the Integration

### 1. Test Database Connection
```bash
# Test if database is accessible
curl http://localhost:3001/health
```

### 2. Test Authentication
```bash
# Register a new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 3. Test Social Features
```bash
# Get friends (requires auth token)
curl http://localhost:3001/api/social/friends \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Create a group
curl -X POST http://localhost:3001/api/social/groups \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Group","description":"Testing social features"}'
```

## 🚨 Rollback Plan

If anything goes wrong, you can quickly disable social features:

1. **Set environment variable**: `ENABLE_SOCIAL=false`
2. **Restart server** - it will run in basic mode
3. **All existing iFood API endpoints continue working**
4. **No data loss** - everything is preserved in database

## 📈 Monitoring

Add monitoring to track the integration:

```javascript
// Add to your health endpoint
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: {
      ifood_api: 'enabled',
      database: pool ? 'connected' : 'disconnected',
      social_features: SocketService ? 'enabled' : 'disabled',
      websockets: io ? 'active' : 'inactive'
    },
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    }
  };
  
  res.json(healthInfo);
});
```

This integration approach ensures:
- ✅ **Zero downtime** - existing features continue working
- ✅ **Backward compatibility** - all existing endpoints preserved  
- ✅ **Progressive enhancement** - social features added incrementally
- ✅ **Easy rollback** - can disable social features anytime
- ✅ **Performance maintained** - existing caching and optimization preserved

The key is that your existing iFood API integration remains completely unchanged while new social features are added as optional enhancements.