const admin = require('firebase-admin');
require('dotenv').config();

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
          set: () => Promise.resolve(),
          update: () => Promise.resolve(),
          delete: () => Promise.resolve()
        }),
        add: () => Promise.resolve({ id: 'mock-doc-id' }),
        where: () => mockQuery,
        limit: () => mockQuery,
        orderBy: () => mockQuery,
        get: () => Promise.resolve({ empty: true, docs: [] })
      };
    }
  }),
  auth: () => ({
    verifyIdToken: () => Promise.resolve({ uid: 'demo-user-123', email: 'demo@test.com' }),
    getUser: () => Promise.resolve({ uid: 'demo-user-123', email: 'demo@test.com' })
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