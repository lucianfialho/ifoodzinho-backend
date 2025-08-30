const { auth } = require('../config/firebase');

// Middleware para verificar autenticação obrigatória
const authenticateUser = async (req, res, next) => {
  try {
    console.log('🔐 Verificando autenticação...');
    console.log('📋 Headers recebidos:', {
      authorization: req.header('Authorization'),
      'x-auth-token': req.header('x-auth-token'),
      cookie: req.header('Cookie')
    });
    
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Token não encontrado no header Authorization');
      return res.status(401).json({ 
        error: 'Token de acesso obrigatório',
        code: 'AUTH_TOKEN_REQUIRED' 
      });
    }

    const idToken = authHeader.replace('Bearer ', '');
    
    console.log('🎫 Token extraído:', idToken.substring(0, 50) + '...');
    
    // Verificar token com Firebase
    console.log('🔥 Verificando token com Firebase...');
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Adicionar dados do usuário à request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      firebaseUser: decodedToken
    };
    
    console.log('✅ Token válido! Usuário:', decodedToken.uid);
    
    next();
    console.log('🚀 next() chamado no authenticateUser - indo para rota');
  } catch (error) {
    console.error('❌ Erro de autenticação:', error.message);
    
    let errorMessage = 'Token inválido';
    let errorCode = 'AUTH_INVALID_TOKEN';
    
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token expirado';
      errorCode = 'AUTH_TOKEN_EXPIRED';
    } else if (error.code === 'auth/argument-error') {
      errorMessage = 'Formato de token inválido';
      errorCode = 'AUTH_TOKEN_MALFORMED';
    }
    
    res.status(401).json({ 
      error: errorMessage,
      code: errorCode 
    });
  }
};

// Middleware para autenticação opcional
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const idToken = authHeader.replace('Bearer ', '');
      const decodedToken = await auth.verifyIdToken(idToken);
      
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture,
        firebaseUser: decodedToken
      };
    }
    
    next();
  } catch (error) {
    // Em caso de erro, continua sem autenticação
    console.warn('⚠️  Token inválido (opcional):', error.message);
    next();
  }
};

// Middleware para verificar se email foi verificado
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Autenticação obrigatória',
      code: 'AUTH_REQUIRED' 
    });
  }
  
  if (!req.user.emailVerified) {
    return res.status(403).json({ 
      error: 'Email não verificado',
      code: 'EMAIL_NOT_VERIFIED' 
    });
  }
  
  next();
};

// Middleware especial para /api/auth/verify que aceita token no body
const verifyWithTokenInBody = async (req, res, next) => {
  try {
    console.log('🔐 Verificando autenticação com token no body...');
    
    let idToken = null;
    
    // Tentar pegar token do header primeiro
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      idToken = authHeader.replace('Bearer ', '');
      console.log('🎫 Token encontrado no header Authorization');
    } 
    // Se não tiver no header, tentar pegar do body
    else if (req.body && req.body.firebaseToken) {
      idToken = req.body.firebaseToken;
      console.log('🎫 Token encontrado no body.firebaseToken');
    }
    
    if (!idToken) {
      console.log('❌ Token não encontrado nem no header nem no body');
      return res.status(401).json({ 
        error: 'Token de acesso obrigatório',
        code: 'AUTH_TOKEN_REQUIRED' 
      });
    }

    console.log('🎫 Token extraído:', idToken.substring(0, 50) + '...');
    
    // Verificar token com Firebase
    console.log('🔥 Verificando token com Firebase...');
    const decodedToken = await auth.verifyIdToken(idToken);
    
    // Adicionar dados do usuário à request
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      name: decodedToken.name,
      picture: decodedToken.picture,
      firebaseUser: decodedToken
    };
    
    console.log('✅ Token válido! Usuário:', decodedToken.uid);
    
    next();
  } catch (error) {
    console.error('❌ Erro de autenticação:', error.message);
    
    let errorMessage = 'Token inválido';
    let errorCode = 'AUTH_INVALID_TOKEN';
    
    if (error.code === 'auth/id-token-expired') {
      errorMessage = 'Token expirado';
      errorCode = 'AUTH_TOKEN_EXPIRED';
    } else if (error.code === 'auth/argument-error') {
      errorMessage = 'Formato de token inválido';
      errorCode = 'AUTH_TOKEN_MALFORMED';
    }
    
    res.status(401).json({ 
      error: errorMessage,
      code: errorCode 
    });
  }
};

module.exports = {
  authenticateUser,
  optionalAuth,
  requireEmailVerification,
  verifyWithTokenInBody
};