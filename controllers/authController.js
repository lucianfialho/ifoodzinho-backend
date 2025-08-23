const userService = require('../services/userService');
const { auth } = require('../config/firebase');

class AuthController {
  
  // Verificar/Criar usuário após login
  async verifyUser(req, res) {
    try {
      const { uid, email, emailVerified, name, picture } = req.user;
      
      // Criar ou atualizar usuário no Firestore
      const userData = await userService.createOrUpdateUser(uid, {
        email,
        emailVerified,
        displayName: name,
        photoURL: picture
      });
      
      res.json({
        success: true,
        message: 'Usuário verificado com sucesso',
        user: {
          uid: userData.uid,
          email: userData.email,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          emailVerified: userData.emailVerified,
          profile: userData.profile,
          preferences: userData.preferences,
          stats: userData.stats
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao verificar usuário:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Buscar dados do perfil
  async getProfile(req, res) {
    try {
      const { uid } = req.user;
      
      const userData = await userService.getUserByUid(uid);
      
      if (!userData) {
        return res.status(404).json({
          error: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Retornar dados do perfil (sem dados sensíveis)
      res.json({
        uid: userData.uid,
        email: userData.email,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        emailVerified: userData.emailVerified,
        profile: userData.profile,
        preferences: userData.preferences,
        stats: userData.stats,
        settings: userData.settings,
        createdAt: userData.createdAt,
        lastActiveAt: userData.lastActiveAt
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar perfil:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Atualizar preferências do usuário
  async updatePreferences(req, res) {
    try {
      const { uid } = req.user;
      const preferences = req.body;
      
      // Validação básica
      const allowedFields = [
        'cuisines', 'dietary', 'priceRange', 
        'maxDeliveryTime', 'maxDeliveryFee', 'excludeIngredients'
      ];
      
      const validPreferences = {};
      allowedFields.forEach(field => {
        if (preferences[field] !== undefined) {
          validPreferences[field] = preferences[field];
        }
      });
      
      await userService.updatePreferences(uid, validPreferences);
      
      res.json({
        success: true,
        message: 'Preferências atualizadas com sucesso',
        preferences: validPreferences
      });
      
    } catch (error) {
      console.error('❌ Erro ao atualizar preferências:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Atualizar perfil do usuário
  async updateProfile(req, res) {
    try {
      const { uid } = req.user;
      const profileData = req.body;
      
      // Validação básica
      const allowedFields = [
        'firstName', 'lastName', 'bio', 'birthday', 'location'
      ];
      
      const validProfileData = {};
      allowedFields.forEach(field => {
        if (profileData[field] !== undefined) {
          validProfileData[field] = profileData[field];
        }
      });
      
      await userService.updateProfile(uid, validProfileData);
      
      res.json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        profileData: validProfileData
      });
      
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Registrar ação de swipe
  async recordSwipe(req, res) {
    try {
      console.log('🔄 recordSwipe iniciado');
      const { uid } = req.user;
      const { dishId, restaurantId, action, location } = req.body;
      
      console.log('📝 Dados recebidos:', { uid, dishId, restaurantId, action, location });
      
      // Validação
      if (!dishId || !restaurantId || !action) {
        return res.status(400).json({
          error: 'dishId, restaurantId e action são obrigatórios',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }
      
      if (!['like', 'pass', 'super_like'].includes(action)) {
        return res.status(400).json({
          error: 'action deve ser: like, pass ou super_like',
          code: 'INVALID_ACTION'
        });
      }
      
      console.log('🔥 Chamando userService.recordSwipe...');
      await userService.recordSwipe(uid, {
        dishId,
        restaurantId,
        action,
        location
      });
      
      console.log('✅ Swipe registrado com sucesso!');
      
      res.json({
        success: true,
        message: 'Swipe registrado com sucesso'
      });
      
    } catch (error) {
      console.error('❌ Erro ao registrar swipe:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Buscar histórico de swipes
  async getSwipeHistory(req, res) {
    try {
      const { uid } = req.user;
      const { limit = 50, offset = 0 } = req.query;
      
      const userData = await userService.getUserByUid(uid);
      
      if (!userData) {
        return res.status(404).json({
          error: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Retornar histórico paginado
      const swipeHistory = userData.swipeHistory || [];
      const paginatedHistory = swipeHistory
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(offset, offset + limit);
      
      res.json({
        swipes: paginatedHistory,
        total: swipeHistory.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar histórico:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Buscar matches do usuário
  async getMatches(req, res) {
    try {
      const { uid } = req.user;
      
      const userData = await userService.getUserByUid(uid);
      
      if (!userData) {
        return res.status(404).json({
          error: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      const matches = userData.matches || [];
      
      res.json({
        matches: matches.sort((a, b) => new Date(b.matchedAt) - new Date(a.matchedAt)),
        total: matches.length
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar matches:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Buscar estatísticas do usuário
  async getStats(req, res) {
    try {
      const { uid } = req.user;
      
      const userData = await userService.getUserByUid(uid);
      
      if (!userData) {
        return res.status(404).json({
          error: 'Usuário não encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      
      res.json({
        stats: userData.stats,
        totals: {
          friends: userData.friends?.length || 0,
          groups: userData.groups?.length || 0,
          swipes: userData.swipeHistory?.length || 0,
          matches: userData.matches?.length || 0
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

module.exports = new AuthController();