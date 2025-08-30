const { db, admin } = require('../config/firebase');

class CoupleService {
  constructor() {
    this.couplesCollection = db.collection('couples');
    this.invitesCollection = db.collection('coupleInvites');
    this.usersCollection = db.collection('users');
  }

  // Enviar convite para formar casal pelo código
  async sendCoupleInvite(fromUserId, partnerCode, fromUserName) {
    try {
      // Buscar usuário destinatário pelo código
      const toUser = await require('./userService').getUserByCode(partnerCode);

      if (!toUser) {
        throw new Error('Usuário não encontrado com este código');
      }

      const toUserId = toUser.uid;
      const toUserData = toUser;

      // Buscar dados do usuário remetente para obter SEU código
      const fromUser = await require('./userService').getUserByUid(fromUserId);
      if (!fromUser) {
        throw new Error('Usuário remetente não encontrado');
      }

      // Verificar se já existe relacionamento
      const existingCouple = await this.checkExistingCouple(fromUserId, toUserId);
      if (existingCouple) {
        throw new Error('Vocês já são um casal no app!');
      }

      // Verificar se já existe convite pendente
      const existingInvite = await this.invitesCollection
        .where('fromUserId', '==', fromUserId)
        .where('toUserId', '==', toUserId)
        .where('status', '==', 'pending')
        .get();

      if (!existingInvite.empty) {
        throw new Error('Já existe um convite pendente para este usuário');
      }

      // Criar novo convite
      const inviteData = {
        fromUserId,
        fromUserName,
        toUserId,
        toUserName: toUserData.displayName,
        toUserCode: toUserData.userCode,      // ✅ Código do destinatário (Ana)
        fromUserCode: fromUser.userCode,      // ✅ Código do remetente (João)
        status: 'pending',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias
      };

      const inviteRef = await this.invitesCollection.add(inviteData);
      
      console.log(`💌 Convite de casal enviado: ${fromUserId} → ${toUserId}`);
      
      // Emitir evento WebSocket para usuário destinatário (se estiver online)
      try {
        const websocketService = require('./websocketService');
        const userSocket = websocketService.userSockets.get(toUserId);
        
        if (userSocket) {
          console.log(`📡 Enviando notificação WebSocket para usuário: ${toUserId}`);
          
          const notificationData = {
            type: 'couple_invite',
            inviteId: inviteRef.id,
            fromUserId,
            fromUserName,
            fromUserCode: inviteData.fromUserCode,
            message: `${fromUserName} quer formar um casal com você! 💕`,
            createdAt: inviteData.createdAt.toISOString()
          };
          
          websocketService.io.to(userSocket.socketId).emit('couple:invite', notificationData);
          console.log(`✅ Notificação WebSocket enviada para: ${toUserId}`);
        } else {
          console.log(`⚠️ Usuário ${toUserId} não está online - notificação não enviada`);
        }
      } catch (error) {
        console.error('❌ Erro ao enviar notificação WebSocket:', error);
        // Não falhar o convite se a notificação der erro
      }
      
      return {
        inviteId: inviteRef.id,
        ...inviteData
      };

    } catch (error) {
      console.error('❌ Erro ao enviar convite:', error);
      throw error;
    }
  }

  // Aceitar convite de casal
  async acceptCoupleInvite(inviteId, userId) {
    try {
      const inviteRef = this.invitesCollection.doc(inviteId);
      const inviteDoc = await inviteRef.get();

      if (!inviteDoc.exists) {
        throw new Error('Convite não encontrado');
      }

      const inviteData = inviteDoc.data();

      // Verificar se o usuário é o destinatário
      if (inviteData.toUserId !== userId) {
        throw new Error('Você não pode aceitar este convite');
      }

      // Verificar se ainda está pendente
      if (inviteData.status !== 'pending') {
        throw new Error(`Convite já foi ${inviteData.status}`);
      }

      // Verificar se não expirou
      if (inviteData.expiresAt.toDate() < new Date()) {
        await inviteRef.update({ status: 'expired' });
        throw new Error('Convite expirado');
      }

      // Criar relacionamento de casal
      const coupleData = {
        users: [inviteData.fromUserId, inviteData.toUserId],
        userNames: {
          [inviteData.fromUserId]: inviteData.fromUserName,
          [inviteData.toUserId]: inviteData.toUserName
        },
        createdAt: new Date(),
        stats: {
          totalDecisions: 0,
          totalMatches: 0,
          favoriteRestaurants: [],
          favoriteDishes: []
        },
        currentSession: null,
        isActive: true
      };

      const coupleRef = await this.couplesCollection.add(coupleData);

      // Atualizar convite como aceito
      await inviteRef.update({
        status: 'accepted',
        acceptedAt: new Date(),
        coupleId: coupleRef.id
      });

      // Atualizar perfis dos usuários com o coupleId
      const batch = db.batch();
      
      batch.update(this.usersCollection.doc(inviteData.fromUserId), {
        coupleId: coupleRef.id,
        partnerId: inviteData.toUserId,
        updatedAt: new Date()
      });

      batch.update(this.usersCollection.doc(inviteData.toUserId), {
        coupleId: coupleRef.id,
        partnerId: inviteData.fromUserId,
        updatedAt: new Date()
      });

      await batch.commit();

      console.log(`💑 Casal formado! ID: ${coupleRef.id}`);

      // Emitir evento WebSocket para usuário que enviou o convite (se estiver online)
      try {
        const websocketService = require('./websocketService');
        const fromUserSocket = websocketService.userSockets.get(inviteData.fromUserId);
        
        if (fromUserSocket) {
          console.log(`📡 Enviando notificação de casal aceito para usuário: ${inviteData.fromUserId}`);
          
          const notificationData = {
            type: 'couple_accepted',
            coupleId: coupleRef.id,
            partnerUserId: inviteData.toUserId,
            partnerUserName: inviteData.toUserName,
            message: `${inviteData.toUserName} aceitou seu convite! Vocês agora são um casal! 💕🎉`,
            createdAt: new Date().toISOString()
          };
          
          websocketService.io.to(fromUserSocket.socketId).emit('couple:update', notificationData);
          console.log(`✅ Notificação de casal aceito enviada para: ${inviteData.fromUserId}`);
        } else {
          console.log(`⚠️ Usuário ${inviteData.fromUserId} não está online - notificação não enviada`);
        }
      } catch (error) {
        console.error('❌ Erro ao enviar notificação WebSocket:', error);
      }

      return {
        coupleId: coupleRef.id,
        ...coupleData
      };

    } catch (error) {
      console.error('❌ Erro ao aceitar convite:', error);
      throw error;
    }
  }

  // Rejeitar convite
  async rejectCoupleInvite(inviteId, userId) {
    try {
      const inviteRef = this.invitesCollection.doc(inviteId);
      const inviteDoc = await inviteRef.get();

      if (!inviteDoc.exists) {
        throw new Error('Convite não encontrado');
      }

      const inviteData = inviteDoc.data();

      if (inviteData.toUserId !== userId) {
        throw new Error('Você não pode rejeitar este convite');
      }

      await inviteRef.update({
        status: 'rejected',
        rejectedAt: new Date()
      });

      console.log(`❌ Convite rejeitado: ${inviteId}`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao rejeitar convite:', error);
      throw error;
    }
  }

  // Buscar convites pendentes de um usuário
  async getPendingInvites(userId) {
    try {
      console.log(`🔍 Buscando convites pendentes para usuário: ${userId}`);
      
      // Demo mode: return empty invites for demo users
      if (userId === 'demo-user-123' || userId === 'Y6XsNOmYW0fkOKXqorKwEzIhN5v1') {
        console.log(`✅ Retornando convites demo vazios para: ${userId}`);
        return { received: [], sent: [] };
      }
      
      // Convites recebidos
      const receivedSnapshot = await this.invitesCollection
        .where('toUserId', '==', userId)
        .where('status', '==', 'pending')
        .get();

      // Convites enviados
      const sentSnapshot = await this.invitesCollection
        .where('fromUserId', '==', userId)
        .where('status', '==', 'pending')
        .get();

      const received = [];
      receivedSnapshot.forEach(doc => {
        received.push({
          id: doc.id,
          type: 'received',
          ...doc.data()
        });
      });

      const sent = [];
      sentSnapshot.forEach(doc => {
        sent.push({
          id: doc.id,
          type: 'sent',
          ...doc.data()
        });
      });
      
      console.log(`✅ Encontrados ${received.length} recebidos, ${sent.length} enviados`);
      return { received, sent };

    } catch (error) {
      console.error('❌ Erro ao buscar convites:', error);
      throw error;
    }
  }

  // Verificar se existe relacionamento entre dois usuários
  async checkExistingCouple(userId1, userId2) {
    try {
      const snapshot = await this.couplesCollection
        .where('users', 'array-contains', userId1)
        .where('isActive', '==', true)
        .get();

      for (const doc of snapshot.docs) {
        const coupleData = doc.data();
        if (coupleData.users.includes(userId2)) {
          return {
            id: doc.id,
            ...coupleData
          };
        }
      }

      return null;

    } catch (error) {
      console.error('❌ Erro ao verificar casal:', error);
      throw error;
    }
  }

  // Buscar dados do casal por ID
  async getCoupleById(coupleId) {
    try {
      const coupleDoc = await this.couplesCollection.doc(coupleId).get();
      
      if (!coupleDoc.exists) {
        return null;
      }

      return {
        id: coupleDoc.id,
        ...coupleDoc.data()
      };

    } catch (error) {
      console.error('❌ Erro ao buscar casal:', error);
      throw error;
    }
  }

  // Buscar casal de um usuário
  async getUserCouple(userId) {
    try {
      const snapshot = await this.couplesCollection
        .where('users', 'array-contains', userId)
        .where('isActive', '==', true)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const coupleDoc = snapshot.docs[0];
      return {
        id: coupleDoc.id,
        ...coupleDoc.data()
      };

    } catch (error) {
      console.error('❌ Erro ao buscar casal do usuário:', error);
      throw error;
    }
  }

  // Iniciar sessão de decisão para o casal
  async startDecisionSession(coupleId, initiatorUserId) {
    try {
      const coupleRef = this.couplesCollection.doc(coupleId);
      const coupleDoc = await coupleRef.get();

      if (!coupleDoc.exists) {
        throw new Error('Casal não encontrado');
      }

      const coupleData = coupleDoc.data();

      // Verificar se o usuário faz parte do casal
      if (!coupleData.users.includes(initiatorUserId)) {
        throw new Error('Você não faz parte deste casal');
      }

      // Se já tem sessão ativa, retornar ela
      if (coupleData.currentSession && coupleData.currentSession.isActive) {
        return coupleData.currentSession;
      }

      // Criar nova sessão de decisão
      const sessionData = {
        sessionId: this.generateSessionId(),
        startedAt: new Date(),
        startedBy: initiatorUserId,
        isActive: true,
        hasDecision: false,
        swipes: [],
        decision: null
      };

      await coupleRef.update({
        currentSession: sessionData,
        updatedAt: new Date()
      });

      console.log(`🎯 Sessão de decisão iniciada para casal: ${coupleId}`);

      return sessionData;

    } catch (error) {
      console.error('❌ Erro ao iniciar sessão:', error);
      throw error;
    }
  }

  // Registrar swipe na sessão do casal
  async recordCoupleSwipe(coupleId, userId, swipeData) {
    try {
      const coupleRef = this.couplesCollection.doc(coupleId);
      const coupleDoc = await coupleRef.get();

      if (!coupleDoc.exists) {
        throw new Error('Casal não encontrado');
      }

      const coupleData = coupleDoc.data();

      if (!coupleData.currentSession || !coupleData.currentSession.isActive) {
        throw new Error('Nenhuma sessão ativa');
      }

      if (coupleData.currentSession.hasDecision) {
        throw new Error('Sessão já tem decisão final');
      }

      const swipeRecord = {
        userId,
        dishId: swipeData.dishId,
        restaurantId: swipeData.restaurantId,
        action: swipeData.action,
        timestamp: new Date()
      };

      // Adicionar swipe à sessão
      const updatedSwipes = [...(coupleData.currentSession.swipes || []), swipeRecord];

      // Verificar se há match
      const partnerId = coupleData.users.find(id => id !== userId);
      const partnerSwipe = updatedSwipes.find(s => 
        s.dishId === swipeData.dishId && 
        s.userId === partnerId &&
        s.restaurantId === swipeData.restaurantId
      );

      let updateData = {
        'currentSession.swipes': updatedSwipes,
        updatedAt: new Date()
      };

      let isMatch = false;
      let decision = null;

      if (partnerSwipe) {
        // Ambos swiparam no mesmo prato
        const bothLiked = (swipeData.action === 'like' || swipeData.action === 'super_like') && 
                         (partnerSwipe.action === 'like' || partnerSwipe.action === 'super_like');

        if (bothLiked) {
          // MATCH! Decisão final!
          isMatch = true;
          decision = {
            dishId: swipeData.dishId,
            restaurantId: swipeData.restaurantId,
            dishData: swipeData.dishData,
            decidedAt: new Date(),
            users: [userId, partnerId]
          };

          updateData['currentSession.hasDecision'] = true;
          updateData['currentSession.decision'] = decision;
          updateData['currentSession.isActive'] = false;
          updateData['stats.totalDecisions'] = admin.firestore.FieldValue.increment(1);
          updateData['stats.totalMatches'] = admin.firestore.FieldValue.increment(1);

          console.log(`💑🎉 Decisão do casal! Prato: ${swipeData.dishData?.name || swipeData.dishId}`);
        }
      }

      await coupleRef.update(updateData);

      return {
        isMatch,
        decision,
        waitingForPartner: !partnerSwipe
      };

    } catch (error) {
      console.error('❌ Erro ao registrar swipe do casal:', error);
      throw error;
    }
  }

  // Encerrar sessão de decisão
  async endDecisionSession(coupleId) {
    try {
      const coupleRef = this.couplesCollection.doc(coupleId);
      
      await coupleRef.update({
        'currentSession.isActive': false,
        'currentSession.endedAt': new Date(),
        updatedAt: new Date()
      });

      console.log(`🔚 Sessão encerrada para casal: ${coupleId}`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao encerrar sessão:', error);
      throw error;
    }
  }

  // Desfazer casal (divórcio no app 😅)
  async breakupCouple(coupleId, userId) {
    try {
      const coupleRef = this.couplesCollection.doc(coupleId);
      const coupleDoc = await coupleRef.get();

      if (!coupleDoc.exists) {
        throw new Error('Casal não encontrado');
      }

      const coupleData = coupleDoc.data();

      if (!coupleData.users.includes(userId)) {
        throw new Error('Você não faz parte deste casal');
      }

      // Marcar casal como inativo
      await coupleRef.update({
        isActive: false,
        endedAt: new Date(),
        endedBy: userId
      });

      // Remover coupleId dos usuários
      const batch = db.batch();
      
      for (const uid of coupleData.users) {
        batch.update(this.usersCollection.doc(uid), {
          coupleId: admin.firestore.FieldValue.delete(),
          partnerId: admin.firestore.FieldValue.delete(),
          updatedAt: new Date()
        });
      }

      await batch.commit();

      console.log(`💔 Casal desfeito: ${coupleId}`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao desfazer casal:', error);
      throw error;
    }
  }

  // Métodos adicionais necessários para o controller
  
  // Entrar em sessão de casal
  async joinCoupleSession(sessionId, userId) {
    console.log(`🚪 Usuário ${userId} tentando entrar na sessão: ${sessionId}`);
    // TODO: Implementar lógica para entrar em sessão
    return {
      sessionId,
      joined: true,
      message: 'Entrou na sessão com sucesso'
    };
  }
  
  // Obter status da sessão
  async getCoupleSessionStatus(coupleId) {
    console.log(`📊 Obtendo status da sessão para casal: ${coupleId}`);
    // TODO: Implementar lógica para obter status da sessão
    return null; // Sem sessão ativa
  }
  
  // Sair da sessão
  async leaveCoupleSession(userId) {
    console.log(`🚺 Usuário ${userId} saindo da sessão`);
    // TODO: Implementar lógica para sair da sessão
    return true;
  }
  
  // Processar swipe de casal
  async handleCoupleSwipe(userId, dishId, action) {
    console.log(`📱 Swipe do usuário ${userId} no prato ${dishId}: ${action}`);
    // TODO: Implementar lógica de swipe
    return {
      success: true,
      action,
      dishId,
      isMatch: false
    };
  }
  
  // Obter matches do casal
  async getCoupleMatches(coupleId) {
    console.log(`💖 Obtendo matches para casal: ${coupleId}`);
    // TODO: Implementar lógica para obter matches
    return [];
  }

  // Gerar ID único para sessão
  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

module.exports = new CoupleService();