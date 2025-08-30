const admin = require('firebase-admin');
require('dotenv').config();

// Check if we have real Firebase credentials or should use demo mode
const hasRealFirebaseCredentials = (
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_PRIVATE_KEY && 
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY !== 'demo-key-for-testing-purposes-only'
);

const isProduction = process.env.NODE_ENV === 'production';

if (hasRealFirebaseCredentials) {
  console.log(`🔥 Firebase: Using real credentials for project: ${process.env.FIREBASE_PROJECT_ID}`);
  
  // Initialize Firebase Admin with real credentials
  const serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
  };
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
    });
  }
  
  const db = admin.firestore();
  
  module.exports = {
    admin,
    db,
    auth: admin.auth(),
    messaging: admin.messaging()
  };
  
} else {
  if (isProduction) {
    console.error('❌ PRODUCTION ERROR: Real Firebase credentials required in production!');
    console.error('Please set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, and FIREBASE_CLIENT_EMAIL');
    process.exit(1);
  }
  
  console.log('🧪 Demo Mode: Using mock Firebase configuration for testing');
  
  // Mock Firebase Admin for demo purposes
  const mockAdmin = {
    apps: [],
    firestore: () => ({
      settings: () => {},
      collection: (collectionName) => {
        const mockQuery = {
          get: () => Promise.resolve({ empty: true, docs: [] }),
          where: () => mockQuery,
          limit: () => mockQuery,
          orderBy: () => mockQuery
        };
        
        return {
          doc: (docId) => ({
            get: () => {
              // Mock user document for WebSocket auth
              if (collectionName === 'users') {
                return Promise.resolve({ 
                  exists: true, 
                  data: () => ({
                    uid: 'demo-user-123',
                    email: 'demo@test.com',
                    displayName: 'Demo User',
                    partnerId: null
                  })
                });
              }
              return Promise.resolve({ exists: false, data: () => null });
            },
            set: (data) => {
              console.log(`📝 Mock Firebase: Setting document ${docId} in ${collectionName}:`, data);
              return Promise.resolve();
            },
            update: (data) => {
              console.log(`📝 Mock Firebase: Updating document ${docId} in ${collectionName}:`, data);
              return Promise.resolve();
            },
            delete: () => Promise.resolve()
          }),
          add: (data) => {
            console.log(`📝 Mock Firebase: Adding document to ${collectionName}:`, data);
            return Promise.resolve({ id: 'mock-doc-id' });
          },
          where: () => mockQuery,
          limit: () => mockQuery,
          orderBy: () => mockQuery,
          get: () => Promise.resolve({ empty: true, docs: [] })
        };
      }
    }),
    auth: () => ({
      verifyIdToken: (token) => {
        console.log('🎫 Mock Firebase: Verifying token:', token.substring(0, 50) + '...');
        // Extract info from token if it's a real Firebase token, otherwise use demo
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
          return Promise.resolve({ 
            uid: payload.user_id || payload.sub || 'demo-user-123', 
            email: payload.email || 'demo@test.com',
            name: payload.name || 'Demo User',
            picture: payload.picture || 'demo:user@foodieswipe.com:USER001'
          });
        } catch (e) {
          return Promise.resolve({ uid: 'demo-user-123', email: 'demo@test.com' });
        }
      },
      getUser: (uid) => {
        console.log('👤 Mock Firebase: Getting user:', uid);
        return Promise.resolve({ uid, email: 'demo@test.com' });
      }
    }),
    messaging: () => ({
      send: () => Promise.resolve('mock-message-id')
    })
  };

  console.log('🔥 Firebase Admin SDK initialized in DEMO mode');

  // Export mock Firebase services
  const db = mockAdmin.firestore();
  const auth = mockAdmin.auth();
  const messaging = mockAdmin.messaging();

  module.exports = {
    admin: mockAdmin,
    db,
    auth,
    messaging
  };
}