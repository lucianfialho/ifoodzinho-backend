const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const NodeCache = require('node-cache');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Cache - 10 minutos para restaurantes, 30 minutos para cardápios
const cache = new NodeCache({ stdTTL: 600 });

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

// Rate limiting - 100 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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

// Endpoint: Buscar restaurantes por localização
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

    const result = {
      baseImageUrl: data.baseImageUrl || 'https://static-images.ifood.com.br/image/upload',
      restaurants,
      total: restaurants.length
    };

    // Cache por 10 minutos
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
app.post('/api/dishes/feed', async (req, res) => {
  try {
    const { lat, lng, restaurantIds, limit = 50 } = req.body;
    
    if (!restaurantIds || !Array.isArray(restaurantIds)) {
      return res.status(400).json({ error: 'restaurantIds array is required' });
    }

    console.log(`🍽️ Buscando feed de pratos de ${restaurantIds.length} restaurantes`);

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

    // Embaralhar e limitar pratos
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

app.listen(PORT, () => {
  console.log(`🚀 FoodieSwipe Backend rodando na porta ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/health`);
});