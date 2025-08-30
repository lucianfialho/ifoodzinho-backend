/**
 * Simple iFood API Service - Clean production version
 */
const httpClient = require('../config/httpClient');
const NodeCache = require('node-cache');

class SimpleIfoodService {
  constructor() {
    this.client = httpClient.getIfoodClient();
    
    // Simple cache
    this.cache = new NodeCache({ 
      stdTTL: 300, // 5 minutes default
      checkperiod: 60 // Check for expired keys every 60 seconds
    });
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      errors: 0
    };
  }

  /**
   * Get restaurants for a location
   */
  async getRestaurants(latitude, longitude, filters = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      const cacheKey = `restaurants_${latitude}_${longitude}_${JSON.stringify(filters)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        console.log(`📦 Cache hit for restaurants`);
        this.metrics.cacheHits++;
        return cached;
      }
      
      // Make API request
      this.metrics.totalRequests++;
      console.log(`🌐 API request for restaurants at ${latitude}, ${longitude}`);
      
      const response = await this.client.post('/v2/bm/home', {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        channel: 'IFOOD',
        size: 20,
        ...filters
      });
      
      const restaurants = this.processRestaurantResponse(response.data);
      
      // Store in cache
      this.cache.set(cacheKey, restaurants);
      
      console.log(`✅ Found ${restaurants.length} restaurants`);
      return restaurants;
      
    } catch (error) {
      console.error('❌ Error fetching restaurants:', error.message);
      this.metrics.errors++;
      
      // Return cached data if available, even if expired
      const fallbackKey = `restaurants_${latitude}_${longitude}`;
      const fallback = this.cache.get(fallbackKey);
      if (fallback) {
        console.log('🔄 Using fallback cache for restaurants');
        return fallback;
      }
      
      throw new Error(`Failed to fetch restaurants: ${error.message}`);
    }
  }

  /**
   * Get menu for a specific restaurant
   */
  async getRestaurantMenu(restaurantId) {
    const startTime = Date.now();
    
    try {
      // Check cache
      const cacheKey = `menu_${restaurantId}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached) {
        console.log(`📦 Cache hit for menu ${restaurantId}`);
        this.metrics.cacheHits++;
        return cached;
      }
      
      // Make API request
      this.metrics.totalRequests++;
      console.log(`🍽️ Fetching menu for restaurant ${restaurantId}`);
      
      const response = await this.client.get(`/v1/bm/merchants/${restaurantId}/catalog`);
      const dishes = this.processMenuResponse(response.data);
      
      // Cache for 15 minutes (menu changes less frequently)
      this.cache.set(cacheKey, dishes, 900);
      
      console.log(`✅ Found ${dishes.length} dishes`);
      return dishes;
      
    } catch (error) {
      console.error(`❌ Error fetching menu for ${restaurantId}:`, error.message);
      this.metrics.errors++;
      throw new Error(`Failed to fetch menu: ${error.message}`);
    }
  }

  /**
   * Get optimized dish feed for swiping
   */
  async getOptimizedDishFeed(latitude, longitude, feedSize = 50) {
    try {
      console.log(`🎯 Building optimized dish feed`);
      
      // Get restaurants first
      const restaurants = await this.getRestaurants(latitude, longitude, { limit: 10 });
      
      if (restaurants.length === 0) {
        return [];
      }
      
      // Get dishes from multiple restaurants
      const allDishes = [];
      
      for (const restaurant of restaurants.slice(0, 5)) { // Limit to 5 restaurants
        try {
          const dishes = await this.getRestaurantMenu(restaurant.id);
          
          // Add restaurant info to each dish
          const dishesWithRestaurant = dishes.map(dish => ({
            ...dish,
            restaurantId: restaurant.id,
            restaurantName: restaurant.name,
            restaurantRating: restaurant.userRating,
            deliveryInfo: restaurant.deliveryInfo
          }));
          
          allDishes.push(...dishesWithRestaurant);
        } catch (error) {
          console.warn(`⚠️ Failed to get menu for ${restaurant.name}`);
        }
      }
      
      // Filter dishes with images and shuffle
      const dishesWithImages = allDishes
        .filter(dish => dish.logoUrl && dish.logoUrl.trim() !== '')
        .sort(() => 0.5 - Math.random()) // Simple shuffle
        .slice(0, feedSize);
      
      console.log(`✅ Generated feed with ${dishesWithImages.length} dishes`);
      return dishesWithImages;
      
    } catch (error) {
      console.error('❌ Error generating dish feed:', error.message);
      this.metrics.errors++;
      return [];
    }
  }

  /**
   * Process restaurant API response
   */
  processRestaurantResponse(data) {
    if (!data || !data.sections) {
      return [];
    }
    
    const restaurants = [];
    
    for (const section of data.sections) {
      if (section.items) {
        for (const item of section.items) {
          if (item.data && item.data.merchant) {
            const merchant = item.data.merchant;
            restaurants.push({
              id: merchant.id,
              name: merchant.name,
              mainCategory: merchant.mainCategory?.name || 'Diversos',
              imageUrl: merchant.resources?.items?.[0]?.resource || '',
              userRating: merchant.userRating || 0,
              distance: merchant.distance || 0,
              available: merchant.available || false,
              deliveryInfo: {
                fee: merchant.deliveryInfo?.fee || 0,
                timeMinMinutes: merchant.deliveryInfo?.timeMinMinutes || 30,
                timeMaxMinutes: merchant.deliveryInfo?.timeMaxMinutes || 45
              }
            });
          }
        }
      }
    }
    
    return restaurants;
  }

  /**
   * Process menu API response
   */
  processMenuResponse(data) {
    if (!data || !data.menu) {
      return [];
    }
    
    const dishes = [];
    const baseImageUrl = data.baseImageUrl || '';
    
    for (const category of data.menu) {
      if (category.itens) {
        for (const item of category.itens) {
          dishes.push({
            id: item.id,
            name: item.name,
            description: item.description || '',
            price: item.unitPrice || 0,
            originalPrice: item.unitOriginalPrice || item.unitPrice || 0,
            logoUrl: item.logoUrl ? baseImageUrl + item.logoUrl : '',
            categoryName: category.name,
            available: item.available !== false,
            tags: item.tags || []
          });
        }
      }
    }
    
    return dishes;
  }

  /**
   * Get service metrics
   */
  getMetrics() {
    const cacheKeys = this.cache.keys().length;
    const cacheHitRate = this.metrics.totalRequests > 0 
      ? ((this.metrics.cacheHits / this.metrics.totalRequests) * 100).toFixed(2)
      : '0.00';
    
    return {
      performance: {
        totalRequests: this.metrics.totalRequests,
        cacheHits: this.metrics.cacheHits,
        errors: this.metrics.errors,
        cacheHitRate: cacheHitRate + '%'
      },
      cache: {
        keys: cacheKeys,
        stats: this.cache.getStats()
      }
    };
  }

  /**
   * Health check
   */
  isHealthy() {
    return this.metrics.errors < 10; // Allow up to 10 errors
  }

  /**
   * Clear all caches
   */
  async clearAllCaches() {
    this.cache.flushAll();
    console.log('🗑️ All caches cleared');
    return true;
  }
}

module.exports = new SimpleIfoodService();