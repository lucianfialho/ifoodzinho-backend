# 🚀 FoodieSwipe Backend

**API Proxy for iFood Integration** - Serves real restaurant and dish data for the FoodieSwipe mobile app.

[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.x-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎯 Purpose

This backend acts as a proxy to iFood's internal APIs, providing:
- 🍽️ **Real dish data** with photos, prices, descriptions
- 🏪 **Restaurant information** by location
- 📍 **Location-based search** using lat/lng coordinates
- 💾 **Smart caching** for optimal performance
- 🛡️ **Rate limiting** for API protection

## 🛠️ Tech Stack

- **Node.js** - JavaScript runtime
- **Express** - Web framework
- **Axios** - HTTP client for API requests
- **Node Cache** - In-memory caching
- **Express Rate Limit** - API rate limiting
- **Helmet** - Security headers
- **CORS** - Cross-origin resource sharing

## 📡 API Endpoints

### Health Check
```http
GET /health
```
Returns server status and cache statistics.

### Get Restaurants by Location
```http
GET /api/restaurants/:lat/:lng?size=20
```
**Parameters:**
- `lat` - Latitude (e.g., -23.5505)
- `lng` - Longitude (e.g., -46.6333)
- `size` - Number of restaurants (optional, default: 20)

**Response:**
```json
{
  "baseImageUrl": "https://static-images.ifood.com.br/image/upload",
  "restaurants": [
    {
      "id": "uuid",
      "name": "Restaurant Name",
      "mainCategory": "Brasileira", 
      "imageUrl": "relative-path.jpg",
      "userRating": 4.5,
      "distance": 0.43,
      "available": true,
      "deliveryInfo": {
        "fee": 0,
        "timeMinMinutes": 19,
        "timeMaxMinutes": 29
      }
    }
  ],
  "total": 20
}
```

### Get Restaurant Menu
```http
GET /api/menu/:restaurantId/:lat/:lng
```
**Parameters:**
- `restaurantId` - UUID of the restaurant
- `lat` - Latitude for delivery calculation
- `lng` - Longitude for delivery calculation

**Response:**
```json
{
  "dishes": [
    {
      "id": "uuid",
      "description": "Dish Name",
      "details": "Detailed description",
      "logoUrl": "dish-photo.jpg",
      "unitPrice": 2500,
      "restaurantId": "uuid",
      "restaurantName": "Restaurant Name"
    }
  ],
  "totalDishes": 117,
  "baseImageUrl": "https://static-images.ifood.com.br/image/upload"
}
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/[YOUR-USERNAME]/foodieswipe-backend.git
cd foodieswipe-backend

# Install dependencies
npm install

# Start the server
npm start
```

The server will be running on `http://localhost:3001`

### Development
```bash
# Start with auto-restart
npm run dev

# Test the API
curl http://localhost:3001/health
curl "http://localhost:3001/api/restaurants/-23.5505/-46.6333?size=5"
```

## ⚙️ Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Cache Configuration (optional)
CACHE_TTL=600000
MAX_CACHE_KEYS=1000

# Rate Limiting (optional)
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100
```

### Cache Settings
- **Restaurants**: 10 minutes TTL
- **Menus**: 30 minutes TTL
- **Health checks**: No cache

## 🛡️ Security Features

- **Helmet**: Security headers protection
- **CORS**: Configured for mobile app origins
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Request Validation**: Basic parameter validation
- **Error Handling**: Graceful error responses

## 📊 Monitoring

### Health Check Response
```json
{
  "status": "OK",
  "timestamp": "2025-01-23T16:02:43.581Z",
  "cache": {
    "keys": 15,
    "stats": {
      "hits": 42,
      "misses": 8,
      "ksize": 15,
      "vsize": 15
    }
  }
}
```

### Logging
The server logs:
- 🔍 API requests with lat/lng
- ✅ Successful data fetches
- ❌ Error responses
- 📊 Cache hit/miss statistics

## 🚀 Deployment

### Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway link
railway up
```

### Heroku
```bash
# Install Heroku CLI
npm install -g heroku

# Create and deploy
heroku create your-app-name
git push heroku main
```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3001
```

## 📁 Project Structure

```
foodieswipe-backend/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── README.md             # This file
├── .env.example          # Environment variables template
├── .gitignore           # Git ignore rules
└── LICENSE              # MIT License
```

## 🐛 Troubleshooting

### Common Issues

**Port already in use:**
```bash
lsof -ti:3001 | xargs kill -9
```

**Cache not working:**
- Check available memory
- Verify cache TTL settings

**API returning errors:**
- Check your internet connection
- Verify lat/lng parameters are valid
- Check iFood API status

### Debug Mode
```bash
DEBUG=* npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## ⚖️ Legal Disclaimer

This project is for **educational purposes only**. It demonstrates:
- API proxy patterns
- Caching strategies
- Rate limiting implementation
- Express.js best practices

*Not affiliated with iFood. Data belongs to respective restaurant owners.*

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Part of the FoodieSwipe ecosystem** 🍽️

**Related Repositories:**
- 📱 [FoodieSwipe App](https://github.com/[YOUR-USERNAME]/foodieswipe-app) - React Native mobile app