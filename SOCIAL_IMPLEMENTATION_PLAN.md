# FoodieSwipe - Social Features Implementation Plan

## 🎯 Implementation Strategy

This document provides the concrete implementation plan for the social features architecture, including code examples, configurations, and step-by-step development guidelines.

## 📦 Required Dependencies

### Backend Dependencies
```json
{
  "dependencies": {
    "socket.io": "^4.7.5",
    "redis": "^4.6.10",
    "@socket.io/redis-adapter": "^8.2.1",
    "pg": "^8.11.3",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "joi": "^17.11.0",
    "sharp": "^0.32.6",
    "multer": "^1.4.5-lts.1",
    "expo-server-sdk": "^3.7.0",
    "node-cron": "^3.0.3",
    "winston": "^3.11.0"
  }
}
```

### Frontend Dependencies (React Native)
```json
{
  "dependencies": {
    "socket.io-client": "^4.7.5",
    "@react-native-async-storage/async-storage": "^1.19.5",
    "react-native-push-notification": "^10.1.3",
    "expo-notifications": "^0.25.2",
    "react-native-gesture-handler": "^2.14.0",
    "react-native-reanimated": "^3.6.1",
    "react-native-image-picker": "^7.1.0"
  }
}
```

## 🗄️ Database Setup

### SQL Migration Script
```sql
-- File: migrations/001_create_social_tables.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (enhanced)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  password_hash VARCHAR(255) NOT NULL,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_name VARCHAR(255),
  preferences JSONB DEFAULT '{}',
  privacy_settings JSONB DEFAULT '{
    "profile_visibility": "friends",
    "activity_visibility": "friends", 
    "location_sharing": true,
    "match_sharing": "friends"
  }',
  stats JSONB DEFAULT '{
    "total_swipes": 0,
    "total_matches": 0,
    "favorite_cuisines": [],
    "streak_days": 0,
    "last_active": null
  }',
  push_token TEXT,
  status VARCHAR(20) DEFAULT 'active',
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Friendships table
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Groups table
CREATE TABLE swipe_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_name VARCHAR(255),
  settings JSONB DEFAULT '{
    "max_members": 8,
    "require_approval": true,
    "match_threshold": 0.5,
    "session_timeout_minutes": 30,
    "allow_chat": true,
    "visibility": "friends"
  }',
  status VARCHAR(20) DEFAULT 'active',
  current_session_id UUID,
  session_started_at TIMESTAMP,
  session_ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Group members table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES swipe_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',
  status VARCHAR(20) DEFAULT 'active',
  permissions JSONB DEFAULT '{
    "can_invite": false,
    "can_remove": false,
    "can_modify_settings": false
  }',
  joined_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Swipes table (enhanced)
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id VARCHAR(255) NOT NULL,
  restaurant_id VARCHAR(255) NOT NULL,
  direction VARCHAR(10) NOT NULL,
  group_id UUID REFERENCES swipe_groups(id) ON DELETE SET NULL,
  session_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Group matches table
CREATE TABLE group_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES swipe_groups(id) ON DELETE CASCADE,
  dish_id VARCHAR(255) NOT NULL,
  restaurant_id VARCHAR(255) NOT NULL,
  dish_data JSONB NOT NULL,
  restaurant_data JSONB NOT NULL,
  match_percentage DECIMAL(4,2),
  member_votes JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
  UNIQUE(group_id, dish_id)
);

-- Group messages table
CREATE TABLE group_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES swipe_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text',
  content TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activity feed table
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}',
  visibility VARCHAR(20) DEFAULT 'friends',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Achievements table
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  category VARCHAR(30),
  difficulty VARCHAR(20),
  requirements JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- User achievements table
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress JSONB DEFAULT '{}',
  unlocked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  title VARCHAR(255),
  message TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_swipes_user ON swipes(user_id);
CREATE INDEX idx_swipes_group ON swipes(group_id);
CREATE INDEX idx_swipes_dish ON swipes(dish_id);
CREATE INDEX idx_swipes_created_at ON swipes(created_at);
CREATE INDEX idx_group_matches_group ON group_matches(group_id);
CREATE INDEX idx_group_matches_status ON group_matches(status);
CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_created_at ON group_messages(created_at);
CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read_at);
```

### Initial Data Setup
```sql
-- File: seeds/001_initial_achievements.sql

INSERT INTO achievements (code, name, description, icon_url, category, difficulty, requirements) VALUES
('first_match', 'First Taste', 'Get your first dish match', '/icons/heart-first.svg', 'milestone', 'easy', '{"matches_count": 1}'),
('swipe_master', 'Swipe Master', 'Swipe 1000 dishes', '/icons/swipe-champion.svg', 'swipe', 'hard', '{"swipes_count": 1000}'),
('social_butterfly', 'Social Butterfly', 'Join 10 different groups', '/icons/butterfly.svg', 'social', 'medium', '{"groups_joined": 10}'),
('taste_explorer', 'Taste Explorer', 'Match dishes from 20 cuisines', '/icons/compass.svg', 'discovery', 'hard', '{"cuisines_matched": 20}'),
('streak_champion', 'Streak Champion', 'Maintain a 30-day streak', '/icons/fire.svg', 'streak', 'legendary', '{"streak_days": 30}'),
('group_creator', 'Group Leader', 'Create your first swipe group', '/icons/crown.svg', 'social', 'easy', '{"groups_created": 1}'),
('match_maker', 'Match Maker', 'Help groups find 50 matches', '/icons/cupid.svg', 'social', 'hard', '{"group_matches_facilitated": 50}'),
('chat_champion', 'Chat Champion', 'Send 500 group messages', '/icons/chat-bubble.svg', 'social', 'medium', '{"messages_sent": 500}'),
('friend_collector', 'Friend Collector', 'Have 20 friends', '/icons/users.svg', 'social', 'medium', '{"friends_count": 20}'),
('early_adopter', 'Early Adopter', 'One of the first 1000 users', '/icons/rocket.svg', 'milestone', 'legendary', '{"user_rank": 1000}');
```

## 🔧 Core Implementation

### 1. Database Connection and Models

```javascript
// config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = pool;
```

```javascript
// models/User.js
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
  static async create({ email, username, password, displayName }) {
    const hashedPassword = await bcrypt.hash(password, 12);
    const query = `
      INSERT INTO users (email, username, password_hash, display_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, username, display_name, created_at
    `;
    const result = await pool.query(query, [email, username, hashedPassword, displayName]);
    return result.rows[0];
  }

  static async findById(id) {
    const query = `
      SELECT id, email, username, display_name, avatar_url, bio,
             location_lat, location_lng, location_name, preferences,
             privacy_settings, stats, status, created_at
      FROM users WHERE id = $1 AND status = 'active'
    `;
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  static async findByEmail(email) {
    const query = `
      SELECT id, email, username, password_hash, display_name, status
      FROM users WHERE email = $1
    `;
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  static async updateStats(userId, statUpdates) {
    const query = `
      UPDATE users 
      SET stats = stats || $2::jsonb, updated_at = NOW()
      WHERE id = $1
      RETURNING stats
    `;
    const result = await pool.query(query, [userId, JSON.stringify(statUpdates)]);
    return result.rows[0];
  }
}

module.exports = User;
```

```javascript
// models/SwipeGroup.js
const pool = require('../config/database');

class SwipeGroup {
  static async create({ name, description, creatorId, location, settings }) {
    const query = `
      INSERT INTO swipe_groups (name, description, creator_id, location_lat, location_lng, location_name, settings)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const result = await pool.query(query, [
      name, description, creatorId,
      location?.lat, location?.lng, location?.name,
      JSON.stringify(settings || {})
    ]);

    // Add creator as admin member
    await this.addMember(result.rows[0].id, creatorId, 'creator');
    
    return result.rows[0];
  }

  static async addMember(groupId, userId, role = 'member') {
    const query = `
      INSERT INTO group_members (group_id, user_id, role)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id, user_id) DO UPDATE SET
        status = 'active', role = $3, joined_at = NOW()
      RETURNING *
    `;
    const result = await pool.query(query, [groupId, userId, role]);
    return result.rows[0];
  }

  static async getMembers(groupId) {
    const query = `
      SELECT gm.*, u.username, u.display_name, u.avatar_url
      FROM group_members gm
      JOIN users u ON gm.user_id = u.id
      WHERE gm.group_id = $1 AND gm.status = 'active'
      ORDER BY gm.role DESC, gm.joined_at ASC
    `;
    const result = await pool.query(query, [groupId]);
    return result.rows;
  }

  static async startSession(groupId, sessionId) {
    const query = `
      UPDATE swipe_groups 
      SET current_session_id = $2, session_started_at = NOW(), status = 'active'
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [groupId, sessionId]);
    return result.rows[0];
  }
}

module.exports = SwipeGroup;
```

### 2. WebSocket Server Setup

```javascript
// services/SocketService.js
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

class SocketService {
  constructor(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.CLIENT_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
    
    // Track active users and groups
    this.activeUsers = new Map(); // userId -> socketId
    this.activeGroups = new Map(); // groupId -> Set of userIds
  }

  async setupRedisAdapter() {
    if (process.env.REDIS_URL) {
      const pubClient = redis.createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();
      
      await pubClient.connect();
      await subClient.connect();
      
      this.io.adapter(createAdapter(pubClient, subClient));
    }
  }

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token;
        if (!token) throw new Error('No token provided');
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (!user) throw new Error('User not found');
        
        socket.userId = user.id;
        socket.user = user;
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.user.username} connected`);
      
      // Track user connection
      this.activeUsers.set(socket.userId, socket.id);
      
      // Join user to their personal room
      socket.join(`user:${socket.userId}`);
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.user.username} disconnected`);
        this.activeUsers.delete(socket.userId);
        
        // Remove from all groups
        this.activeGroups.forEach((members, groupId) => {
          if (members.has(socket.userId)) {
            members.delete(socket.userId);
            socket.to(groupId).emit('group:member:left', {
              userId: socket.userId,
              username: socket.user.username
            });
          }
        });
      });

      // Group events
      this.setupGroupEvents(socket);
      
      // Swipe events
      this.setupSwipeEvents(socket);
      
      // Chat events
      this.setupChatEvents(socket);
      
      // Friend events
      this.setupFriendEvents(socket);
    });
  }

  setupGroupEvents(socket) {
    socket.on('group:join', async ({ groupId }) => {
      try {
        // Verify user is member of the group
        const isMember = await this.verifyGroupMembership(socket.userId, groupId);
        if (!isMember) {
          socket.emit('error', { message: 'Not authorized to join this group' });
          return;
        }
        
        socket.join(groupId);
        
        // Track group membership
        if (!this.activeGroups.has(groupId)) {
          this.activeGroups.set(groupId, new Set());
        }
        this.activeGroups.get(groupId).add(socket.userId);
        
        // Notify other members
        socket.to(groupId).emit('group:member:joined', {
          userId: socket.userId,
          username: socket.user.username,
          displayName: socket.user.display_name
        });
        
        socket.emit('group:joined', { groupId });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('group:leave', ({ groupId }) => {
      socket.leave(groupId);
      
      if (this.activeGroups.has(groupId)) {
        this.activeGroups.get(groupId).delete(socket.userId);
      }
      
      socket.to(groupId).emit('group:member:left', {
        userId: socket.userId,
        username: socket.user.username
      });
    });
  }

  setupSwipeEvents(socket) {
    socket.on('swipe:action', async ({ groupId, dishId, direction, metadata }) => {
      try {
        const SwipeService = require('./SwipeService');
        const GroupMatchService = require('./GroupMatchService');
        
        // Record the swipe
        await SwipeService.recordSwipe(socket.userId, dishId, direction, groupId, metadata);
        
        // Broadcast to group members
        socket.to(groupId).emit('swipe:member:action', {
          userId: socket.userId,
          username: socket.user.username,
          dishId,
          direction,
          timestamp: Date.now()
        });
        
        // Check for group match
        const matchResult = await GroupMatchService.processGroupSwipe(
          groupId, socket.userId, dishId, direction
        );
        
        if (matchResult.type === 'match') {
          // Broadcast match to all group members
          this.io.to(groupId).emit('group:match', {
            dishId,
            matchScore: matchResult.score,
            dish: metadata?.dish,
            restaurant: metadata?.restaurant,
            votes: matchResult.votes
          });
          
          // Send push notifications
          await this.sendGroupMatchNotification(groupId, metadata?.dish);
        } else if (matchResult.type === 'waiting') {
          socket.emit('swipe:waiting', {
            dishId,
            votes: matchResult.votes,
            remaining: matchResult.remaining
          });
        }
        
        socket.emit('swipe:recorded', { dishId, direction });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
  }

  setupChatEvents(socket) {
    socket.on('chat:message', async ({ groupId, content, type = 'text', metadata = {} }) => {
      try {
        const GroupMessageService = require('./GroupMessageService');
        
        const message = await GroupMessageService.createMessage({
          groupId,
          userId: socket.userId,
          content,
          type,
          metadata
        });
        
        // Broadcast to group members
        this.io.to(groupId).emit('chat:message', {
          id: message.id,
          userId: socket.userId,
          username: socket.user.username,
          displayName: socket.user.display_name,
          avatarUrl: socket.user.avatar_url,
          content,
          type,
          metadata,
          createdAt: message.created_at
        });
        
        socket.emit('chat:message:sent', { messageId: message.id });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });

    socket.on('chat:typing:start', ({ groupId }) => {
      socket.to(groupId).emit('chat:typing:start', {
        userId: socket.userId,
        username: socket.user.username
      });
    });

    socket.on('chat:typing:stop', ({ groupId }) => {
      socket.to(groupId).emit('chat:typing:stop', {
        userId: socket.userId
      });
    });
  }

  setupFriendEvents(socket) {
    socket.on('friend:request', async ({ targetUserId }) => {
      try {
        const FriendshipService = require('./FriendshipService');
        
        await FriendshipService.sendFriendRequest(socket.userId, targetUserId);
        
        // Send real-time notification to target user
        this.io.to(`user:${targetUserId}`).emit('friend:request:received', {
          fromUserId: socket.userId,
          fromUsername: socket.user.username,
          fromDisplayName: socket.user.display_name,
          fromAvatarUrl: socket.user.avatar_url
        });
        
        socket.emit('friend:request:sent', { targetUserId });
      } catch (error) {
        socket.emit('error', { message: error.message });
      }
    });
  }

  async verifyGroupMembership(userId, groupId) {
    const pool = require('../config/database');
    const query = `
      SELECT 1 FROM group_members 
      WHERE group_id = $1 AND user_id = $2 AND status = 'active'
    `;
    const result = await pool.query(query, [groupId, userId]);
    return result.rows.length > 0;
  }

  async sendGroupMatchNotification(groupId, dish) {
    const PushNotificationService = require('./PushNotificationService');
    
    await PushNotificationService.sendToGroup(groupId, {
      title: "It's a Match! 🎉",
      message: `Your group matched on ${dish?.name || 'a delicious dish'}!`,
      type: 'group_match',
      metadata: { groupId, dish }
    });
  }
}

module.exports = SocketService;
```

### 3. REST API Routes

```javascript
// routes/social.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const FriendshipService = require('../services/FriendshipService');
const SwipeGroupService = require('../services/SwipeGroupService');
const ActivityFeedService = require('../services/ActivityFeedService');

// Friends routes
router.get('/friends', auth, async (req, res) => {
  try {
    const friends = await FriendshipService.getFriends(req.user.id);
    res.json({ friends });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/friends/request', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const friendship = await FriendshipService.sendFriendRequest(req.user.id, targetUserId);
    res.json({ friendship });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/friends/accept/:requestId', auth, async (req, res) => {
  try {
    const friendship = await FriendshipService.acceptFriendRequest(
      req.params.requestId, 
      req.user.id
    );
    res.json({ friendship });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/friends/requests', auth, async (req, res) => {
  try {
    const requests = await FriendshipService.getPendingRequests(req.user.id);
    res.json({ requests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Groups routes
router.get('/groups', auth, async (req, res) => {
  try {
    const groups = await SwipeGroupService.getUserGroups(req.user.id);
    res.json({ groups });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/groups', auth, async (req, res) => {
  try {
    const { name, description, location, settings } = req.body;
    const group = await SwipeGroupService.createGroup({
      name,
      description,
      creatorId: req.user.id,
      location,
      settings
    });
    res.json({ group });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/groups/:id', auth, async (req, res) => {
  try {
    const group = await SwipeGroupService.getGroup(req.params.id, req.user.id);
    res.json({ group });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

router.post('/groups/:id/join', auth, async (req, res) => {
  try {
    const membership = await SwipeGroupService.joinGroup(req.params.id, req.user.id);
    res.json({ membership });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/groups/:id/invite', auth, async (req, res) => {
  try {
    const { userIds } = req.body;
    const invitations = await SwipeGroupService.inviteMembers(
      req.params.id,
      userIds,
      req.user.id
    );
    res.json({ invitations });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/groups/:id/matches', auth, async (req, res) => {
  try {
    const matches = await SwipeGroupService.getGroupMatches(req.params.id, req.user.id);
    res.json({ matches });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});

// Activity feed
router.get('/activity/feed', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const feed = await ActivityFeedService.getUserFeed(req.user.id, { page, limit });
    res.json({ feed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### 4. Core Services

```javascript
// services/FriendshipService.js
const pool = require('../config/database');
const User = require('../models/User');
const NotificationService = require('./NotificationService');

class FriendshipService {
  static async sendFriendRequest(requesterId, addresseeId) {
    if (requesterId === addresseeId) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if friendship already exists
    const existing = await this.getFriendshipStatus(requesterId, addresseeId);
    if (existing) {
      throw new Error('Friendship already exists');
    }

    const query = `
      INSERT INTO friendships (requester_id, addressee_id, status)
      VALUES ($1, $2, 'pending')
      RETURNING *
    `;
    const result = await pool.query(query, [requesterId, addresseeId]);

    // Send notification
    await NotificationService.create({
      userId: addresseeId,
      type: 'friend_request',
      title: 'New friend request',
      message: 'Someone wants to be your friend!',
      metadata: { fromUserId: requesterId }
    });

    return result.rows[0];
  }

  static async acceptFriendRequest(requestId, userId) {
    // Verify the user is the addressee
    const checkQuery = `
      SELECT * FROM friendships 
      WHERE id = $1 AND addressee_id = $2 AND status = 'pending'
    `;
    const checkResult = await pool.query(checkQuery, [requestId, userId]);
    
    if (checkResult.rows.length === 0) {
      throw new Error('Friend request not found');
    }

    const updateQuery = `
      UPDATE friendships 
      SET status = 'accepted', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [requestId]);

    const friendship = checkResult.rows[0];
    
    // Create reciprocal friendship
    await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id, status) 
       VALUES ($1, $2, 'accepted')
       ON CONFLICT (requester_id, addressee_id) DO UPDATE SET status = 'accepted'`,
      [userId, friendship.requester_id]
    );

    // Update user stats
    await User.updateStats(friendship.requester_id, { friends_count: 1 });
    await User.updateStats(userId, { friends_count: 1 });

    // Send notification to requester
    await NotificationService.create({
      userId: friendship.requester_id,
      type: 'friend_request_accepted',
      title: 'Friend request accepted',
      message: 'Your friend request was accepted!',
      metadata: { fromUserId: userId }
    });

    return result.rows[0];
  }

  static async getFriends(userId) {
    const query = `
      SELECT u.id, u.username, u.display_name, u.avatar_url, f.created_at as friends_since
      FROM friendships f
      JOIN users u ON (
        CASE 
          WHEN f.requester_id = $1 THEN u.id = f.addressee_id
          ELSE u.id = f.requester_id
        END
      )
      WHERE (f.requester_id = $1 OR f.addressee_id = $1) 
        AND f.status = 'accepted'
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }

  static async getFriendshipStatus(user1Id, user2Id) {
    const query = `
      SELECT status FROM friendships
      WHERE (requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1)
      LIMIT 1
    `;
    const result = await pool.query(query, [user1Id, user2Id]);
    return result.rows[0]?.status || null;
  }

  static async getPendingRequests(userId) {
    const query = `
      SELECT f.id, f.created_at, u.id as user_id, u.username, u.display_name, u.avatar_url
      FROM friendships f
      JOIN users u ON u.id = f.requester_id
      WHERE f.addressee_id = $1 AND f.status = 'pending'
      ORDER BY f.created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  }
}

module.exports = FriendshipService;
```

```javascript
// services/GroupMatchService.js
const pool = require('../config/database');
const SwipeGroup = require('../models/SwipeGroup');

class GroupMatchService {
  static async processGroupSwipe(groupId, userId, dishId, direction) {
    // Get all swipes for this dish in this group
    const votesQuery = `
      SELECT user_id, direction 
      FROM swipes 
      WHERE group_id = $1 AND dish_id = $2
    `;
    const votesResult = await pool.query(votesQuery, [groupId, dishId]);
    
    // Convert to votes object
    const votes = {};
    votesResult.rows.forEach(row => {
      votes[row.user_id] = row.direction;
    });

    // Get group info and member count
    const group = await SwipeGroup.findById(groupId);
    const members = await SwipeGroup.getMembers(groupId);
    const totalMembers = members.length;

    // Check if all members have voted
    if (Object.keys(votes).length === totalMembers) {
      const matchScore = this.calculateMatchScore(votes, totalMembers);
      const threshold = group.settings.match_threshold || 0.5;

      if (matchScore >= threshold) {
        // Create group match
        await this.createGroupMatch(groupId, dishId, votes, matchScore);
        return { type: 'match', score: matchScore, votes };
      } else {
        return { type: 'no_match', votes };
      }
    }

    return { 
      type: 'waiting', 
      votes, 
      remaining: totalMembers - Object.keys(votes).length 
    };
  }

  static calculateMatchScore(votes, totalMembers) {
    const rightVotes = Object.values(votes).filter(vote => vote === 'right').length;
    const superVotes = Object.values(votes).filter(vote => vote === 'super').length;
    
    // Super likes count as 1.5x
    const weightedScore = (rightVotes + (superVotes * 1.5)) / totalMembers;
    return Math.min(weightedScore, 1.0);
  }

  static async createGroupMatch(groupId, dishId, votes, matchScore) {
    // Get dish and restaurant data from the swipe metadata
    const dishDataQuery = `
      SELECT metadata FROM swipes 
      WHERE group_id = $1 AND dish_id = $2 
      LIMIT 1
    `;
    const dishResult = await pool.query(dishDataQuery, [groupId, dishId]);
    const metadata = dishResult.rows[0]?.metadata || {};

    const query = `
      INSERT INTO group_matches (
        group_id, dish_id, restaurant_id, dish_data, 
        restaurant_data, match_percentage, member_votes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      groupId,
      dishId,
      metadata.restaurantId || '',
      JSON.stringify(metadata.dish || {}),
      JSON.stringify(metadata.restaurant || {}),
      matchScore,
      JSON.stringify(votes)
    ]);

    // Update group stats
    await this.updateGroupStats(groupId);

    return result.rows[0];
  }

  static async updateGroupStats(groupId) {
    const query = `
      UPDATE swipe_groups 
      SET settings = settings || '{"total_matches": COALESCE((settings->>"total_matches")::int, 0) + 1}'::jsonb
      WHERE id = $1
    `;
    await pool.query(query, [groupId]);
  }

  static async getGroupMatches(groupId, userId, limit = 50) {
    // Verify user is group member
    const memberCheck = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2 AND status = \'active\'',
      [groupId, userId]
    );
    
    if (memberCheck.rows.length === 0) {
      throw new Error('Not authorized to view group matches');
    }

    const query = `
      SELECT * FROM group_matches
      WHERE group_id = $1 AND status = 'active'
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await pool.query(query, [groupId, limit]);
    return result.rows;
  }
}

module.exports = GroupMatchService;
```

## 🚀 Frontend Integration Examples

### React Native Socket Integration
```typescript
// services/SocketService.ts
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  async connect() {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) throw new Error('No auth token found');

    this.socket = io(process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001', {
      auth: { token }
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    // Setup event forwarding
    this.socket.onAny((event, ...args) => {
      const listeners = this.listeners.get(event) || [];
      listeners.forEach(listener => listener(...args));
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data?: any) {
    if (this.socket) {
      this.socket.emit(event, data);
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off(event: string, callback?: Function) {
    if (callback) {
      const listeners = this.listeners.get(event) || [];
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    } else {
      this.listeners.delete(event);
    }
  }

  // Group methods
  joinGroup(groupId: string) {
    this.emit('group:join', { groupId });
  }

  leaveGroup(groupId: string) {
    this.emit('group:leave', { groupId });
  }

  sendSwipe(groupId: string, dishId: string, direction: string, metadata?: any) {
    this.emit('swipe:action', { groupId, dishId, direction, metadata });
  }

  sendMessage(groupId: string, content: string, type = 'text', metadata = {}) {
    this.emit('chat:message', { groupId, content, type, metadata });
  }
}

export default new SocketService();
```

### Group Swipe Hook
```typescript
// hooks/useGroupSwipe.ts
import { useState, useEffect } from 'react';
import SocketService from '../services/SocketService';

export interface GroupSwipeState {
  currentDish: any | null;
  waitingForVotes: boolean;
  memberVotes: Record<string, string>;
  matches: any[];
  loading: boolean;
}

export const useGroupSwipe = (groupId: string) => {
  const [state, setState] = useState<GroupSwipeState>({
    currentDish: null,
    waitingForVotes: false,
    memberVotes: {},
    matches: [],
    loading: false
  });

  useEffect(() => {
    if (!groupId) return;

    // Join the group
    SocketService.joinGroup(groupId);

    // Listen for swipe events
    const handleMemberSwipe = (data: any) => {
      setState(prev => ({
        ...prev,
        memberVotes: {
          ...prev.memberVotes,
          [data.userId]: data.direction
        }
      }));
    };

    const handleGroupMatch = (data: any) => {
      setState(prev => ({
        ...prev,
        matches: [data, ...prev.matches],
        waitingForVotes: false,
        memberVotes: {},
        currentDish: null
      }));
    };

    const handleSwipeWaiting = (data: any) => {
      setState(prev => ({
        ...prev,
        waitingForVotes: true,
        memberVotes: data.votes
      }));
    };

    SocketService.on('swipe:member:action', handleMemberSwipe);
    SocketService.on('group:match', handleGroupMatch);
    SocketService.on('swipe:waiting', handleSwipeWaiting);

    return () => {
      SocketService.off('swipe:member:action', handleMemberSwipe);
      SocketService.off('group:match', handleGroupMatch);
      SocketService.off('swipe:waiting', handleSwipeWaiting);
      SocketService.leaveGroup(groupId);
    };
  }, [groupId]);

  const swipeDish = (dishId: string, direction: string, dishData?: any) => {
    setState(prev => ({ ...prev, loading: true }));
    
    SocketService.sendSwipe(groupId, dishId, direction, {
      dish: dishData?.dish,
      restaurant: dishData?.restaurant,
      restaurantId: dishData?.restaurantId
    });
  };

  const setCurrentDish = (dish: any) => {
    setState(prev => ({
      ...prev,
      currentDish: dish,
      waitingForVotes: false,
      memberVotes: {},
      loading: false
    }));
  };

  return {
    ...state,
    swipeDish,
    setCurrentDish
  };
};
```

### Group Chat Component
```typescript
// components/GroupChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import SocketService from '../services/SocketService';

interface Message {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  content: string;
  type: string;
  createdAt: string;
}

interface GroupChatProps {
  groupId: string;
  currentUserId: string;
}

export const GroupChat: React.FC<GroupChatProps> = ({ groupId, currentUserId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    // Load chat history
    loadChatHistory();

    // Listen for new messages
    const handleNewMessage = (message: Message) => {
      setMessages(prev => [...prev, message]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    };

    const handleTypingStart = (data: any) => {
      if (data.userId !== currentUserId) {
        setTypingUsers(prev => new Set([...prev, data.username]));
      }
    };

    const handleTypingStop = (data: any) => {
      setTypingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.username);
        return newSet;
      });
    };

    SocketService.on('chat:message', handleNewMessage);
    SocketService.on('chat:typing:start', handleTypingStart);
    SocketService.on('chat:typing:stop', handleTypingStop);

    return () => {
      SocketService.off('chat:message', handleNewMessage);
      SocketService.off('chat:typing:start', handleTypingStart);
      SocketService.off('chat:typing:stop', handleTypingStop);
    };
  }, [groupId, currentUserId]);

  const loadChatHistory = async () => {
    try {
      const response = await fetch(`/api/groups/${groupId}/messages`);
      const data = await response.json();
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim()) {
      SocketService.sendMessage(groupId, newMessage.trim());
      setNewMessage('');
      stopTyping();
    }
  };

  const startTyping = () => {
    SocketService.emit('chat:typing:start', { groupId });
  };

  const stopTyping = () => {
    SocketService.emit('chat:typing:stop', { groupId });
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[
      styles.messageContainer,
      item.userId === currentUserId ? styles.myMessage : styles.otherMessage
    ]}>
      {item.userId !== currentUserId && (
        <Text style={styles.username}>{item.displayName}</Text>
      )}
      <Text style={styles.messageContent}>{item.content}</Text>
      <Text style={styles.timestamp}>
        {new Date(item.createdAt).toLocaleTimeString()}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
      />
      
      {typingUsers.size > 0 && (
        <Text style={styles.typingIndicator}>
          {Array.from(typingUsers).join(', ')} typing...
        </Text>
      )}
      
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={newMessage}
          onChangeText={(text) => {
            setNewMessage(text);
            if (text.length === 1) startTyping();
            if (text.length === 0) stopTyping();
          }}
          placeholder="Type a message..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim()}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#007AFF',
    alignSelf: 'flex-end',
  },
  otherMessage: {
    backgroundColor: '#F0F0F0',
    alignSelf: 'flex-start',
  },
  username: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#666',
  },
  messageContent: {
    fontSize: 16,
    color: '#000',
  },
  timestamp: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
  },
  typingIndicator: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
```

## 🔄 Deployment Configuration

### Environment Variables
```bash
# .env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=foodieswipe
DB_USER=your_db_user
DB_PASSWORD=your_db_password

REDIS_URL=redis://localhost:6379

JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d

CLIENT_URL=http://localhost:3000

EXPO_ACCESS_TOKEN=your-expo-access-token

# Optional: Push notifications
FCM_SERVER_KEY=your-fcm-server-key
APNS_KEY_ID=your-apns-key-id
APNS_TEAM_ID=your-apns-team-id
```

### Docker Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - redis
    volumes:
      - ./uploads:/app/uploads

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=foodieswipe
      - POSTGRES_USER=foodieswipe
      - POSTGRES_PASSWORD=your-secure-password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

This implementation plan provides a complete foundation for the social features architecture. The system is designed to be scalable, maintainable, and provides excellent real-time user experience while integrating seamlessly with the existing iFood data flow.