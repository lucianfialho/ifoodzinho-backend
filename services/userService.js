const { db, admin } = require('../config/firebase');

class UserService {
  constructor() {
    this.usersCollection = db.collection('users');
  }

  // Criar ou atualizar perfil do usuário
  async createOrUpdateUser(uid, userData) {
    try {
      const userRef = this.usersCollection.doc(uid);
      const userDoc = await userRef.get();
      
      const timestamp = new Date();
      
      if (!userDoc.exists) {
        // Criar novo usuário
        const newUser = {
          uid,
          email: userData.email,
          displayName: userData.displayName || userData.name,
          photoURL: userData.photoURL || userData.picture,
          emailVerified: userData.emailVerified || false,
          
          // Código único do usuário para facilitar convites
          userCode: this.generateUserCode(),
          
          // Profile completo
          profile: {
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            bio: '',
            birthday: null,
            location: {
              lat: null,
              lng: null,
              address: '',
              city: '',
              state: ''
            }
          },
          
          // Preferências alimentares
          preferences: {
            cuisines: [], // ['Italiana', 'Japonesa', 'Brasileira']
            dietary: [], // ['vegetarian', 'vegan', 'gluten-free']
            priceRange: {
              min: 1,
              max: 4
            },
            maxDeliveryTime: 60, // minutos
            maxDeliveryFee: 15.00, // reais
            excludeIngredients: []
          },
          
          // Dados sociais
          friends: [],
          groups: [],
          swipeHistory: [],
          matches: [],
          
          // Gamificação
          stats: {
            totalSwipes: 0,
            totalMatches: 0,
            totalOrders: 0,
            currentStreak: 0,
            longestStreak: 0,
            achievements: [],
            level: 1,
            experience: 0
          },
          
          // Configurações
          settings: {
            notifications: {
              matches: true,
              friendRequests: true,
              groupInvites: true,
              achievements: true
            },
            privacy: {
              profileVisible: true,
              showActivity: true,
              allowFriendRequests: true
            }
          },
          
          // Timestamps
          createdAt: timestamp,
          updatedAt: timestamp,
          lastActiveAt: timestamp
        };
        
        await userRef.set(newUser);
        console.log(`✅ Usuário criado: ${uid}`);
        return newUser;
        
      } else {
        // Atualizar usuário existente
        const updates = {
          email: userData.email,
          displayName: userData.displayName || userData.name,
          photoURL: userData.photoURL || userData.picture,
          emailVerified: userData.emailVerified,
          updatedAt: timestamp,
          lastActiveAt: timestamp
        };
        
        await userRef.update(updates);
        
        const updatedDoc = await userRef.get();
        console.log(`✅ Usuário atualizado: ${uid}`);
        return updatedDoc.data();
      }
      
    } catch (error) {
      console.error('❌ Erro ao criar/atualizar usuário:', error);
      throw error;
    }
  }

  // Buscar usuário por UID
  async getUserByUid(uid) {
    try {
      console.log(`🔍 UserService.getUserByUid called with UID: ${uid}`);
      
      // Demo mode: return mock data for demo users
      if (uid === 'demo-user-123' || uid === 'Y6XsNOmYW0fkOKXqorKwEzIhN5v1') {
        console.log(`✅ Returning demo data for UID: ${uid}`);
        return {
          id: uid,
          uid,
          email: 'demo@test.com',
          displayName: 'Ana Silva',
          photoURL: 'demo:ana@foodieswipe.com:ANA001',
          emailVerified: false,
          userCode: 'FKFGXR',
          profile: {
            firstName: 'Ana',
            lastName: 'Silva',
            bio: '',
            birthday: null,
            location: {
              lat: null,
              lng: null,
              address: '',
              city: '',
              state: ''
            }
          },
          preferences: {
            cuisines: [],
            dietary: [],
            priceRange: { min: 1, max: 4 },
            maxDeliveryTime: 60,
            maxDeliveryFee: 15,
            excludeIngredients: []
          },
          stats: {
            totalSwipes: 0,
            totalMatches: 0,
            totalOrders: 0,
            currentStreak: 0,
            longestStreak: 0,
            achievements: [],
            level: 1,
            experience: 0
          }
        };
      }

      const userDoc = await this.usersCollection.doc(uid).get();
      
      if (!userDoc.exists) {
        return null;
      }
      
      return { id: userDoc.id, ...userDoc.data() };
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error);
      console.error('❌ Stack trace:', error.stack);
      throw error;
    }
  }

  // Atualizar preferências do usuário
  async updatePreferences(uid, preferences) {
    try {
      const userRef = this.usersCollection.doc(uid);
      
      await userRef.update({
        preferences: preferences,
        updatedAt: new Date()
      });
      
      console.log(`✅ Preferências atualizadas: ${uid}`);
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao atualizar preferências:', error);
      throw error;
    }
  }

  // Atualizar perfil do usuário
  async updateProfile(uid, profileData) {
    try {
      const userRef = this.usersCollection.doc(uid);
      
      const updates = {
        updatedAt: new Date()
      };
      
      // Atualizar campos do perfil
      Object.keys(profileData).forEach(key => {
        updates[`profile.${key}`] = profileData[key];
      });
      
      await userRef.update(updates);
      
      console.log(`✅ Perfil atualizado: ${uid}`);
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao atualizar perfil:', error);
      throw error;
    }
  }

  // Registrar swipe do usuário
  async recordSwipe(uid, swipeData) {
    try {
      const userRef = this.usersCollection.doc(uid);
      const timestamp = new Date();
      
      const swipeRecord = {
        dishId: swipeData.dishId,
        restaurantId: swipeData.restaurantId,
        action: swipeData.action, // 'like', 'pass', 'super_like'
        timestamp,
        location: swipeData.location || null
      };
      
      await userRef.update({
        swipeHistory: admin.firestore.FieldValue.arrayUnion(swipeRecord),
        'stats.totalSwipes': admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp,
        lastActiveAt: timestamp
      });
      
      // Verificar se é um match (implementar lógica de match)
      if (swipeData.action === 'like' || swipeData.action === 'super_like') {
        await this.checkForMatch(uid, swipeData);
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao registrar swipe:', error);
      throw error;
    }
  }

  // Verificar match (lógica simplificada - pode ser expandida)
  async checkForMatch(uid, swipeData) {
    try {
      // Por enquanto, registra como match aleatoriamente (30% chance)
      const isMatch = Math.random() < 0.3;
      
      if (isMatch) {
        const userRef = this.usersCollection.doc(uid);
        const matchRecord = {
          dishId: swipeData.dishId,
          restaurantId: swipeData.restaurantId,
          matchedAt: new Date(),
          ordered: false
        };
        
        await userRef.update({
          matches: admin.firestore.FieldValue.arrayUnion(matchRecord),
          'stats.totalMatches': admin.firestore.FieldValue.increment(1)
        });
        
        console.log(`🎉 Match registrado para usuário: ${uid}`);
      }
      
    } catch (error) {
      console.error('❌ Erro ao verificar match:', error);
    }
  }

  // Registrar match (decisão final de casal)
  async recordMatch(uid, matchData) {
    try {
      const userRef = this.usersCollection.doc(uid);
      const timestamp = new Date();
      
      const matchRecord = {
        dishId: matchData.dishId,
        restaurantId: matchData.restaurantId,
        matchType: matchData.matchType || 'couple',
        partnerUserId: matchData.partnerUserId,
        sessionCode: matchData.sessionCode,
        isFinalDecision: matchData.isFinalDecision || false,
        matchedAt: timestamp
      };
      
      await userRef.update({
        matches: admin.firestore.FieldValue.arrayUnion(matchRecord),
        'stats.totalMatches': admin.firestore.FieldValue.increment(1),
        updatedAt: timestamp,
        lastActiveAt: timestamp
      });
      
      console.log(`🎯 Match registrado para usuário: ${uid} (tipo: ${matchData.matchType})`);
      return true;
      
    } catch (error) {
      console.error('❌ Erro ao registrar match:', error);
      throw error;
    }
  }

  // Gerar código único do usuário (6 caracteres)
  generateUserCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Buscar usuário pelo código
  async getUserByCode(userCode) {
    try {
      const snapshot = await this.usersCollection
        .where('userCode', '==', userCode.toUpperCase())
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const userDoc = snapshot.docs[0];
      const userData = userDoc.data();
      
      // Retornar dados básicos (não sensíveis)
      return {
        uid: userData.uid,
        displayName: userData.displayName,
        photoURL: userData.photoURL,
        userCode: userData.userCode
      };
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuário por código:', error);
      throw error;
    }
  }

  // Buscar usuários por email (para adicionar amigos)
  async searchUsersByEmail(email) {
    try {
      const snapshot = await this.usersCollection
        .where('email', '==', email)
        .limit(1)
        .get();
      
      const users = [];
      snapshot.forEach(doc => {
        const userData = doc.data();
        // Não retornar dados sensíveis
        users.push({
          uid: userData.uid,
          displayName: userData.displayName,
          photoURL: userData.photoURL,
          email: userData.email
        });
      });
      
      return users;
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuários:', error);
      throw error;
    }
  }
}

module.exports = new UserService();