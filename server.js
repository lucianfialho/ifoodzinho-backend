const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const axios = require('axios');
require('dotenv').config();

// Firebase imports
const { authenticateUser, optionalAuth, verifyWithTokenInBody } = require('./middleware/firebaseAuth');
const authController = require('./controllers/authController');
const userService = require('./services/userService');

const app = express();
const PORT = process.env.PORT || 3001;

// Cache - 10 minutos para restaurantes, 30 minutos para cardápios
const cache = new NodeCache({ stdTTL: 600 });

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Debug middleware para logar todas as requisições
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) {
    console.log(`\n🌐 Requisição recebida: ${req.method} ${req.path}`);
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📦 Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Rate limiting - 1000 requests per 15 minutes (aumentado para debug)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests from this IP'
});
app.use('/api', limiter);

// Headers padrão para iFood API
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

// ===============================
// FIREBASE AUTH ROUTES
// ===============================

// Verificar/criar usuário após login (aceita token no body ou header)
app.post('/api/auth/verify', verifyWithTokenInBody, authController.verifyUser);

// Buscar perfil do usuário
app.get('/api/auth/profile', authenticateUser, authController.getProfile);

// Atualizar preferências
app.put('/api/auth/preferences', authenticateUser, authController.updatePreferences);

// Atualizar perfil
app.put('/api/auth/profile', authenticateUser, authController.updateProfile);

// Registrar swipe
app.post('/api/auth/swipe', authenticateUser, authController.recordSwipe);

// Histórico de swipes
app.get('/api/auth/swipe-history', authenticateUser, authController.getSwipeHistory);

// Matches do usuário
app.get('/api/auth/matches', authenticateUser, authController.getMatches);

// Estatísticas do usuário
app.get('/api/auth/stats', authenticateUser, authController.getStats);

// ===============================
// iFood API ROUTES (Enhanced with Firebase)
// ===============================

// Endpoint: Buscar restaurantes por localização (agora com contexto do usuário)
app.get('/api/restaurants/:lat/:lng', optionalAuth, async (req, res) => {
  try {
    const { lat, lng } = req.params;
    const { size = 20 } = req.query;
    
    const cacheKey = `restaurants_${lat}_${lng}_${size}`;
    const cached = cache.get(cacheKey);
    
    if (cached) {
      return res.json({ ...cached, fromCache: true });
    }

    const userId = req.user ? req.user.uid : null;
    console.log(`🔍 Buscando restaurantes para lat: ${lat}, lng: ${lng}${userId ? ` (usuário: ${userId})` : ' (anônimo)'}`);    
    
    // Buscar preferências do usuário se autenticado
    let userPreferences = null;
    if (userId) {
      try {
        const userData = await userService.getUserByUid(userId);
        userPreferences = userData?.preferences;
      } catch (error) {
        console.warn('⚠️  Erro ao buscar preferências do usuário:', error.message);
      }
    }

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

    // Extrair restaurantes da resposta
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

    // Aplicar filtros baseados nas preferências do usuário
    let filteredRestaurants = restaurants;
    if (userPreferences) {
      filteredRestaurants = applyUserFiltersToRestaurants(restaurants, userPreferences);
    }
    
    const result = {
      baseImageUrl: data.baseImageUrl || 'https://static-images.ifood.com.br/image/upload',
      restaurants: filteredRestaurants,
      total: filteredRestaurants.length,
      originalTotal: restaurants.length,
      userFilters: userPreferences ? {
        cuisines: userPreferences.cuisines,
        priceRange: userPreferences.priceRange,
        maxDeliveryTime: userPreferences.maxDeliveryTime,
        maxDeliveryFee: userPreferences.maxDeliveryFee
      } : null,
      isAuthenticated: !!userId
    };

    // Cache por 10 minutos
    cache.set(cacheKey, result, 600);
    
    console.log(`✅ Encontrados ${restaurants.length} restaurantes${userPreferences ? ` (${filteredRestaurants.length} após filtros do usuário)` : ''}`);
    res.json(result);

  } catch (error) {
    console.error('❌ Erro ao buscar restaurantes:', error.message);
    res.status(500).json({ 
      error: 'Erro ao buscar restaurantes',
      details: error.message 
    });
  }
});

// Endpoint: Buscar cardápio de um restaurante
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

    // Extrair todos os pratos de todas as categorias
    const dishes = [];
    const menu = catalogData.data?.menu || [];
    
    menu.forEach(category => {
      const categoryDishes = category.itens?.map(dish => ({
        ...dish,
        category: category.name,
        categoryCode: category.code,
        // URL completa da imagem
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
      dishes: dishes.filter(dish => dish.imageUrl) // Só pratos com foto
    };

    // Cache por 30 minutos (cardápio muda menos)
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

// Endpoint: Buscar pratos de múltiplos restaurantes (para feed de swipe)
app.post('/api/dishes/feed', optionalAuth, async (req, res) => {
  try {
    const { lat, lng, restaurantIds, limit = 50 } = req.body;
    
    if (!restaurantIds || !Array.isArray(restaurantIds)) {
      return res.status(400).json({ error: 'restaurantIds array is required' });
    }

    const userId = req.user ? req.user.uid : null;
    console.log(`🍽️ Buscando feed de pratos de ${restaurantIds.length} restaurantes${userId ? ` (usuário: ${userId})` : ' (anônimo)'}`);
    
    // Buscar preferências e histórico do usuário
    let userPreferences = null;
    let userSwipeHistory = [];
    if (userId) {
      try {
        const userData = await userService.getUserByUid(userId);
        userPreferences = userData?.preferences;
        userSwipeHistory = userData?.swipeHistory || [];
      } catch (error) {
        console.warn('⚠️  Erro ao buscar dados do usuário:', error.message);
      }
    }

    const allDishes = [];
    const errors = [];

    // Buscar cardápio de cada restaurante
    for (const restaurantId of restaurantIds.slice(0, 10)) { // Max 10 restaurantes por vez
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

        // Rate limiting - aguardar 100ms entre requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors.push({ restaurantId, error: error.message });
      }
    }

    // Filtrar pratos já visualizados pelo usuário
    let availableDishes = allDishes;
    if (userId && userSwipeHistory.length > 0) {
      const swipedDishIds = new Set(userSwipeHistory.map(swipe => swipe.dishId));
      availableDishes = allDishes.filter(dish => !swipedDishIds.has(dish.id));
      console.log(`📊 Filtrados ${allDishes.length - availableDishes.length} pratos já visualizados`);
    }
    
    // Aplicar filtros de preferências
    if (userPreferences) {
      availableDishes = applyUserFiltersToDishes(availableDishes, userPreferences);
    }
    
    // Embaralhar e limitar pratos
    const shuffled = availableDishes.sort(() => 0.5 - Math.random());
    const limitedDishes = shuffled.slice(0, limit);

    console.log(`✅ Feed de ${limitedDishes.length} pratos criado`);

    res.json({
      dishes: limitedDishes,
      total: limitedDishes.length,
      originalTotal: allDishes.length,
      availableTotal: availableDishes.length,
      filteredOut: allDishes.length - availableDishes.length,
      userFilters: userPreferences ? {
        cuisines: userPreferences.cuisines,
        dietary: userPreferences.dietary,
        excludeIngredients: userPreferences.excludeIngredients
      } : null,
      isAuthenticated: !!userId,
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

// Endpoint: Buscar pratos com autenticação obrigatória (para usuários logados)
app.post('/api/dishes/feed/social', authenticateUser, async (req, res) => {
  try {
    const { lat, lng, restaurantIds, limit = 50 } = req.body;
    
    if (!restaurantIds || !Array.isArray(restaurantIds)) {
      return res.status(400).json({ error: 'restaurantIds array is required' });
    }

    const userId = req.user.uid;
    console.log(`🍽️ Buscando feed SOCIAL de pratos de ${restaurantIds.length} restaurantes (usuário: ${userId})`);
    
    // Buscar preferências e histórico do usuário
    let userPreferences = null;
    let userSwipeHistory = [];
    try {
      const userData = await userService.getUserByUid(userId);
      userPreferences = userData?.preferences;
      userSwipeHistory = userData?.swipeHistory || [];
    } catch (error) {
      console.warn('⚠️  Erro ao buscar dados do usuário:', error.message);
    }

    const allDishes = [];
    const errors = [];

    // Buscar cardápio de cada restaurante
    for (const restaurantId of restaurantIds.slice(0, 10)) { // Max 10 restaurantes por vez
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

        // Rate limiting - aguardar 100ms entre requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors.push({ restaurantId, error: error.message });
      }
    }
    
    // Filtrar pratos já visualizados pelo usuário
    let availableDishes = allDishes;
    if (userSwipeHistory.length > 0) {
      const swipedDishIds = new Set(userSwipeHistory.map(swipe => swipe.dishId));
      availableDishes = allDishes.filter(dish => !swipedDishIds.has(dish.id));
      console.log(`📊 Filtrados ${allDishes.length - availableDishes.length} pratos já visualizados`);
    }
    
    // Aplicar filtros de preferências
    if (userPreferences) {
      availableDishes = applyUserFiltersToDishes(availableDishes, userPreferences);
    }
    
    // Embaralhar e limitar pratos
    const shuffled = availableDishes.sort(() => 0.5 - Math.random());
    const limitedDishes = shuffled.slice(0, limit);

    console.log(`✅ Feed SOCIAL de ${limitedDishes.length} pratos criado`);

    res.json({
      dishes: limitedDishes,
      total: limitedDishes.length,
      originalTotal: allDishes.length,
      availableTotal: availableDishes.length,
      filteredOut: allDishes.length - availableDishes.length,
      userFilters: userPreferences ? {
        cuisines: userPreferences.cuisines,
        dietary: userPreferences.dietary,
        excludeIngredients: userPreferences.excludeIngredients
      } : null,
      isAuthenticated: true,
      userId: userId,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Erro ao criar feed social:', error.message);
    res.status(500).json({ 
      error: 'Erro ao criar feed de pratos',
      details: error.message 
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    cache: {
      keys: cache.keys().length,
      stats: cache.getStats()
    }
  });
});

// ===============================
// HELPER FUNCTIONS
// ===============================

// Aplicar filtros do usuário aos restaurantes
function applyUserFiltersToRestaurants(restaurants, preferences) {
  return restaurants.filter(restaurant => {
    // Filtro de taxa de entrega
    if (preferences.maxDeliveryFee && restaurant.deliveryFee > preferences.maxDeliveryFee) {
      return false;
    }
    
    // Filtro de tempo de entrega
    if (preferences.maxDeliveryTime && restaurant.deliveryTime > preferences.maxDeliveryTime) {
      return false;
    }
    
    // Filtro de tipo de cozinha
    if (preferences.cuisines && preferences.cuisines.length > 0) {
      const restaurantCuisine = restaurant.mainCategory || restaurant.category || '';
      const matchesCuisine = preferences.cuisines.some(cuisine => 
        restaurantCuisine.toLowerCase().includes(cuisine.toLowerCase())
      );
      if (!matchesCuisine) {
        return false;
      }
    }
    
    return true;
  });
}

// Aplicar filtros do usuário aos pratos
function applyUserFiltersToDishes(dishes, preferences) {
  return dishes.filter(dish => {
    // Filtro de ingredientes excluídos
    if (preferences.excludeIngredients && preferences.excludeIngredients.length > 0) {
      const dishDescription = (dish.description || '').toLowerCase();
      const dishName = (dish.name || '').toLowerCase();
      const hasExcludedIngredient = preferences.excludeIngredients.some(ingredient => 
        dishDescription.includes(ingredient.toLowerCase()) || 
        dishName.includes(ingredient.toLowerCase())
      );
      if (hasExcludedIngredient) {
        return false;
      }
    }
    
    // Filtro de restrições alimentares
    if (preferences.dietary && preferences.dietary.length > 0) {
      const dishDescription = (dish.description || '').toLowerCase();
      const dishName = (dish.name || '').toLowerCase();
      
      // Verificar se o prato atende às restrições
      const meetsRestrictions = preferences.dietary.every(restriction => {
        switch (restriction.toLowerCase()) {
          case 'vegetarian':
            return !dishDescription.includes('carne') && !dishDescription.includes('frango') && !dishDescription.includes('peixe');
          case 'vegan':
            return !dishDescription.includes('carne') && !dishDescription.includes('queijo') && !dishDescription.includes('leite') && !dishDescription.includes('ovo');
          case 'gluten-free':
            return !dishDescription.includes('trigo') && !dishDescription.includes('farinha') && !dishName.includes('pão');
          default:
            return true;
        }
      });
      
      if (!meetsRestrictions) {
        return false;
      }
    }
    
    return true;
  });
}

app.listen(PORT, () => {
  console.log(`🚀 FoodieSwipe Backend rodando na porta ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Firebase Auth integrado`);
  console.log(`\n📋 Endpoints disponíveis:`);
  console.log(`   Auth: POST /api/auth/verify`);
  console.log(`   Perfil: GET /api/auth/profile`);
  console.log(`   Swipe: POST /api/auth/swipe`);
  console.log(`   Restaurantes: GET /api/restaurants/:lat/:lng`);
  console.log(`   Feed: POST /api/dishes/feed`);
  console.log(`   Feed Social: POST /api/dishes/feed/social`);
});