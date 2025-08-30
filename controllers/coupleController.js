const secureWebSocketService = require('../services/secureWebSocketService');
const coupleService = require('../services/coupleService');

class CoupleController {
  
  // Enviar convite para formar casal
  async sendCoupleInvite(req, res) {
    try {
      const { uid: fromUserId, name: fromUserName } = req.user;
      const { partnerCode } = req.body;
      
      if (!partnerCode) {
        return res.status(400).json({
          error: 'Código do parceiro(a) é obrigatório',
          code: 'CODE_REQUIRED'
        });
      }
      
      const invite = await coupleService.sendCoupleInvite(fromUserId, partnerCode, fromUserName);
      
      res.json({
        success: true,
        message: 'Convite enviado com sucesso',
        invite
      });
      
    } catch (error) {
      console.error('❌ Erro ao enviar convite:', error);
      res.status(400).json({
        error: error.message,
        code: 'INVITE_ERROR'
      });
    }
  }
  
  // Aceitar convite
  async acceptCoupleInvite(req, res) {
    try {
      const { uid: userId } = req.user;
      const { inviteId } = req.params;
      
      const couple = await coupleService.acceptCoupleInvite(inviteId, userId);
      
      res.json({
        success: true,
        message: 'Convite aceito! Vocês agora são um casal no app',
        couple
      });
      
    } catch (error) {
      console.error('❌ Erro ao aceitar convite:', error);
      res.status(400).json({
        error: error.message,
        code: 'ACCEPT_ERROR'
      });
    }
  }
  
  // Rejeitar convite
  async rejectCoupleInvite(req, res) {
    try {
      const { uid: userId } = req.user;
      const { inviteId } = req.params;
      
      await coupleService.rejectCoupleInvite(inviteId, userId);
      
      res.json({
        success: true,
        message: 'Convite rejeitado'
      });
      
    } catch (error) {
      console.error('❌ Erro ao rejeitar convite:', error);
      res.status(400).json({
        error: error.message,
        code: 'REJECT_ERROR'
      });
    }
  }
  
  // Buscar convites pendentes
  async getCoupleInvites(req, res) {
    try {
      const { uid: userId } = req.user;
      
      const invites = await coupleService.getPendingInvites(userId);
      
      res.json({
        success: true,
        invites
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar convites:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
  
  // Buscar dados do casal
  async getCoupleInfo(req, res) {
    try {
      const { uid: userId } = req.user;
      
      const couple = await coupleService.getUserCouple(userId);
      
      if (!couple) {
        return res.status(200).json({
          success: false,
          error: 'Você ainda não tem um casal formado',
          code: 'NO_COUPLE'
        });
      }
      
      res.json({
        success: true,
        couple
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar casal:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
  
  // Desfazer casal
  async disconnectCouple(req, res) {
    try {
      const { uid: userId } = req.user;
      
      const couple = await coupleService.getUserCouple(userId);
      
      if (!couple) {
        return res.status(404).json({
          error: 'Você não tem um casal formado',
          code: 'NO_COUPLE'
        });
      }
      
      await coupleService.breakupCouple(couple.id, userId);
      
      res.json({
        success: true,
        message: 'Casal desfeito com sucesso'
      });
      
    } catch (error) {
      console.error('❌ Erro ao desfazer casal:', error);
      res.status(400).json({
        error: error.message,
        code: 'BREAKUP_ERROR'
      });
    }
  }

  // Buscar usuário pelo código (para preview antes de enviar convite)
  async searchUserByCode(req, res) {
    try {
      const { code } = req.params;
      
      console.log(`🔍 [searchUserByCode] Buscando usuário com código: "${code}"`);
      
      const user = await require('../services/userService').getUserByCode(code);
      
      console.log(`🔍 [searchUserByCode] Usuário encontrado:`, user ? 'SIM' : 'NÃO');
      if (user) {
        console.log(`🔍 [searchUserByCode] Dados do usuário:`, {
          uid: user.uid,
          displayName: user.displayName,
          userCode: user.userCode,
          email: user.email ? `${user.email.substring(0, 3)}***` : 'N/A'
        });
      }
      
      if (!user) {
        console.log(`❌ [searchUserByCode] Usuário não encontrado com código: "${code}"`);
        return res.status(404).json({
          error: 'Usuário não encontrado com este código',
          code: 'USER_NOT_FOUND'
        });
      }
      
      const response = {
        success: true,
        user
      };
      
      console.log(`✅ [searchUserByCode] Enviando resposta:`, {
        success: response.success,
        userUid: response.user.uid,
        userCode: response.user.userCode
      });
      
      res.json(response);
      
    } catch (error) {
      console.error('❌ Erro ao buscar usuário:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
  
  // Debug: Listar sessões ativas
  async getActiveSessions(req, res) {
    try {
      const sessions = secureWebSocketService.getActiveSessions();
      
      res.json({
        success: true,
        sessions,
        total: sessions.length,
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar sessões ativas:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Limpar sessões antigas manualmente
  async cleanupSessions(req, res) {
    try {
      secureWebSocketService.cleanupOldSessions();
      
      res.json({
        success: true,
        message: 'Limpeza de sessões executada',
        timestamp: new Date()
      });
      
    } catch (error) {
      console.error('❌ Erro ao limpar sessões:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Estatísticas das sessões de casal
  async getCoupleStats(req, res) {
    try {
      const sessions = secureWebSocketService.getActiveSessions();
      
      const stats = {
        totalSessions: sessions.length,
        activeSessions: sessions.filter(s => s.isActive).length,
        completedSessions: sessions.filter(s => s.hasDecision).length,
        totalUsers: sessions.reduce((acc, s) => acc + s.userCount, 0),
        avgSwipesPerSession: sessions.length > 0 ? 
          sessions.reduce((acc, s) => acc + s.swipeCount, 0) / sessions.length : 0,
        timestamp: new Date()
      };
      
      res.json({
        success: true,
        stats
      });
      
    } catch (error) {
      console.error('❌ Erro ao buscar estatísticas:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Debug: Verificar sincronização REST-WebSocket
  async debugWebSocketSync(req, res) {
    try {
      console.log('🔍 [DEBUG_SYNC] Verificando sincronização REST-WebSocket...');
      
      const sessions = secureWebSocketService.getActiveSessions();
      const tempSessionKeys = Array.from(secureWebSocketService.tempSessions.keys());
      const tempSessionsDetail = [];
      
      // Coletar detalhes das sessões temporárias
      for (const [key, session] of secureWebSocketService.tempSessions.entries()) {
        tempSessionsDetail.push({
          roomCode: key,
          originalSessionId: session.originalSessionId,
          syncedFromRest: session.syncedFromRest || false,
          coupleId: session.coupleId,
          userCount: session.users?.length || 0,
          users: session.users?.map(u => ({ userId: u.userId, userName: u.userName })),
          isActive: session.isActive,
          createdAt: session.createdAt,
          hasSocketIds: Object.keys(session.socketIds || {}).length > 0
        });
      }
      
      const userSocketsInfo = [];
      for (const [userId, socketInfo] of secureWebSocketService.userSockets.entries()) {
        userSocketsInfo.push({
          userId,
          socketId: socketInfo.socketId,
          coupleId: socketInfo.coupleId
        });
      }
      
      const debugInfo = {
        success: true,
        timestamp: new Date().toISOString(),
        websocketSessions: {
          persistent: sessions.persistentSessions,
          temporary: sessions.tempSessions,
          tempSessionKeys: tempSessionKeys,
          tempSessionsDetail: tempSessionsDetail
        },
        totals: {
          persistentSessions: sessions.persistentSessions?.length || 0,
          temporarySessions: sessions.tempSessions?.length || 0,
          tempSessionKeys: tempSessionKeys.length,
          activeConnections: secureWebSocketService.io?.sockets?.sockets?.size || 0,
          userSockets: secureWebSocketService.userSockets?.size || 0
        },
        userSockets: userSocketsInfo,
        systemInfo: {
          nodeUptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          platform: process.platform
        }
      };
      
      console.log('✅ [DEBUG_SYNC] Informações coletadas:', {
        tempSessions: tempSessionKeys.length,
        persistentSessions: sessions.persistentSessions?.length || 0,
        activeConnections: secureWebSocketService.io?.sockets?.sockets?.size || 0
      });
      
      res.json(debugInfo);
      
    } catch (error) {
      console.error('❌ [DEBUG_SYNC] Erro ao coletar informações de debug:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'DEBUG_ERROR'
      });
    }
  }

  // Criar sessão de casal
  async createCoupleSession(req, res) {
    try {
      const { uid: userId } = req.user;
      
      const couple = await coupleService.getUserCouple(userId);
      if (!couple) {
        return res.status(404).json({
          error: 'Você não tem um casal formado',
          code: 'NO_COUPLE'
        });
      }
      
      const session = await coupleService.startDecisionSession(couple.id, userId);
      
      res.json({
        success: true,
        message: 'Sessão criada com sucesso',
        session
      });
      
    } catch (error) {
      console.error('❌ Erro ao criar sessão:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Entrar em sessão de casal
  async joinCoupleSession(req, res) {
    try {
      const { uid: userId } = req.user;
      const { sessionId } = req.body;
      
      const session = await coupleService.joinCoupleSession(sessionId, userId);
      
      res.json({
        success: true,
        message: 'Entrou na sessão com sucesso',
        session
      });
      
    } catch (error) {
      console.error('❌ Erro ao entrar na sessão:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Obter status da sessão
  async getCoupleSessionStatus(req, res) {
    try {
      const { uid: userId } = req.user;
      
      const couple = await coupleService.getUserCouple(userId);
      if (!couple) {
        return res.status(404).json({
          error: 'Você não tem um casal formado',
          code: 'NO_COUPLE'
        });
      }
      
      const session = await coupleService.getCoupleSessionStatus(couple.id);
      
      res.json({
        success: true,
        session: session || null
      });
      
    } catch (error) {
      console.error('❌ Erro ao obter status da sessão:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Sair da sessão
  async leaveCoupleSession(req, res) {
    try {
      const { uid: userId } = req.user;
      
      await coupleService.leaveCoupleSession(userId);
      
      res.json({
        success: true,
        message: 'Saiu da sessão com sucesso'
      });
      
    } catch (error) {
      console.error('❌ Erro ao sair da sessão:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Obter feed sincronizado para casais
  async getCouplesFeed(req, res) {
    try {
      const { uid: userId } = req.user;
      
      const couple = await coupleService.getUserCouple(userId);
      if (!couple) {
        return res.status(404).json({
          error: 'Você não tem um casal formado',
          code: 'NO_COUPLE'
        });
      }
      
      // Return demo feed for now
      const feed = {
        dishes: [],
        restaurants: [],
        sessionActive: false
      };
      
      res.json({
        success: true,
        feed
      });
      
    } catch (error) {
      console.error('❌ Erro ao obter feed:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Processar swipe de casal
  async handleCoupleSwipe(req, res) {
    try {
      const { uid: userId } = req.user;
      const { dishId, action } = req.body;
      
      if (!dishId || !action) {
        return res.status(400).json({
          error: 'dishId e action são obrigatórios',
          code: 'MISSING_FIELDS'
        });
      }
      
      const result = await coupleService.handleCoupleSwipe(userId, dishId, action);
      
      res.json({
        success: true,
        result
      });
      
    } catch (error) {
      console.error('❌ Erro ao processar swipe:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Obter matches do casal
  async getCoupleMatches(req, res) {
    try {
      const { uid: userId } = req.user;
      
      const couple = await coupleService.getUserCouple(userId);
      if (!couple) {
        return res.status(404).json({
          error: 'Você não tem um casal formado',
          code: 'NO_COUPLE'
        });
      }
      
      const matches = await coupleService.getCoupleMatches(couple.id);
      
      res.json({
        success: true,
        matches: matches || []
      });
      
    } catch (error) {
      console.error('❌ Erro ao obter matches:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Debug: Testar criação de sessão manual
  async testCreateSession(req, res) {
    try {
      console.log('🧪 [TEST_SESSION] Criando sessão de teste...');
      
      const testSessionId = `test_${Date.now()}`;
      const testCoupleId = `test_couple_${Date.now()}`;
      const testUsers = ['test_user_1', 'test_user_2'];
      
      console.log('🧪 [TEST_SESSION] Dados de teste:', {
        sessionId: testSessionId,
        coupleId: testCoupleId,
        users: testUsers
      });
      
      const syncResult = secureWebSocketService.syncCoupleSession(testSessionId, testCoupleId, testUsers);
      
      res.json({
        success: true,
        message: 'Sessão de teste criada',
        testData: {
          sessionId: testSessionId,
          coupleId: testCoupleId,
          users: testUsers,
          roomCode: syncResult.roomCode
        },
        syncResult: syncResult,
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      console.error('❌ [TEST_SESSION] Erro ao criar sessão de teste:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'TEST_ERROR'
      });
    }
  }

  // Iniciar sessão de decisão automaticamente (novo fluxo simplificado)
  async startDecisionSession(req, res) {
    try {
      const { uid: userId, name: userName } = req.user;
      const { message } = req.body;
      
      console.log(`🚀 [START_DECISION] ${userName} (${userId}) quer iniciar decisão`);
      
      // Verificar se usuários são realmente um casal
      const couple = await coupleService.getUserCouple(userId);
      if (!couple) {
        return res.status(404).json({
          error: 'Você não tem um casal formado',
          code: 'NO_COUPLE'
        });
      }
      
      console.log(`📊 [START_DECISION] Dados do casal:`, JSON.stringify({
        id: couple.id,
        users: couple.users,
        userNames: couple.userNames
      }, null, 2));
      
      // Extrair automaticamente o partnerId do casal
      const partnerId = couple.users.find(id => id !== userId);
      if (!partnerId) {
        return res.status(500).json({
          error: 'Erro interno: parceiro não encontrado no casal',
          code: 'PARTNER_NOT_FOUND'
        });
      }
      
      console.log(`👫 [START_DECISION] Parceiro identificado: ${partnerId} (${couple.userNames[partnerId]})`);
      
      console.log(`✅ [START_DECISION] Casal válido encontrado: ${couple.id}`);
      console.log(`🎯 [START_DECISION] Iniciando sessão para: ${userName} (${userId}) + ${couple.userNames[partnerId]} (${partnerId})`);
      
      // Iniciar sessão de decisão no Firebase
      const session = await coupleService.startDecisionSession(couple.id, userId);
      console.log(`📝 [START_DECISION] Sessão criada no Firebase: ${session.sessionId}`);
      
      // 🆕 SINCRONIZAR SESSÃO COM WEBSOCKET
      console.log(`🔄 [START_DECISION] === SINCRONIZANDO SESSÃO COM WEBSOCKET ===`);
      console.log(`🔄 [START_DECISION] Sincronizando sessão ${session.sessionId} com WebSocket`);
      
      try {
        const syncResult = secureWebSocketService.syncCoupleSession(session.sessionId, couple.id, [userId, partnerId]);
        
        if (syncResult.success) {
          console.log(`✅ [START_DECISION] Sessão ${session.sessionId} sincronizada com WebSocket (roomCode: ${syncResult.roomCode})`);
        } else {
          console.error(`❌ [START_DECISION] Falha ao sincronizar sessão: ${syncResult.error}`);
        }
      } catch (syncError) {
        console.error('❌ [START_DECISION] Erro na sincronização WebSocket:', syncError);
      }
      
      // Enviar notificação em tempo real para o parceiro via WebSocket
      try {
        const partnerSocket = secureWebSocketService.userSockets.get(partnerId);
        
        if (partnerSocket) {
          console.log(`📡 [START_DECISION] Enviando notificação WebSocket para parceiro ${partnerId}`);
          
          const notificationData = {
            type: 'decision_session_invite',
            fromUserId: userId,
            fromUserName: userName,
            coupleId: couple.id,
            sessionId: session.sessionId,
            message: message || `${userName} quer decidir o que pedir! 🍽️`,
            timestamp: new Date().toISOString()
          };
          
          secureWebSocketService.io.to(partnerSocket.socketId).emit('decision:invite', notificationData);
          console.log(`✅ [START_DECISION] Notificação WebSocket enviada para parceiro`);
        } else {
          console.log(`⚠️ [START_DECISION] Parceiro ${partnerId} não está online - notificação não enviada`);
        }
      } catch (wsError) {
        console.error('❌ [START_DECISION] Erro ao enviar notificação WebSocket:', wsError);
      }
      
      res.json({
        success: true,
        message: 'Convite de decisão enviado para seu parceiro',
        session: {
          sessionId: session.sessionId,
          coupleId: couple.id,
          startedBy: userId,
          startedAt: session.startedAt
        }
      });
      
    } catch (error) {
      console.error('❌ [START_DECISION] Erro ao iniciar sessão de decisão:', error);
      res.status(500).json({
        error: 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

module.exports = new CoupleController();