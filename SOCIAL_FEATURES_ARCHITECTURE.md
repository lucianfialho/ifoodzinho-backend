# FoodieSwipe - Social Features Architecture

## 📋 Overview

This document outlines the complete social features architecture for FoodieSwipe, designed to enhance the core swipe experience with meaningful social interactions while maintaining performance and engagement.

## 🏗️ Database Schema Design

### Core Social Tables

#### 1. Users Table (Enhanced)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100),
  avatar_url TEXT,
  bio TEXT,
  location_lat DECIMAL(10,8),
  location_lng DECIMAL(11,8),
  location_name VARCHAR(255),
  preferences JSONB DEFAULT '{}', -- dietary preferences, cuisine types
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
  status VARCHAR(20) DEFAULT 'active', -- active, inactive, banned
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 2. Friendships Table
```sql
CREATE TABLE friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

-- Indexes for friendship queries
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_friendships_status ON friendships(status);
```

#### 3. Groups Table
```sql
CREATE TABLE swipe_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  status VARCHAR(20) DEFAULT 'active', -- active, paused, ended
  session_started_at TIMESTAMP,
  session_ended_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 4. Group Members Table
```sql
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES swipe_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member', -- creator, admin, member
  status VARCHAR(20) DEFAULT 'active', -- invited, active, left, removed
  permissions JSONB DEFAULT '{
    "can_invite": false,
    "can_remove": false,
    "can_modify_settings": false
  }',
  joined_at TIMESTAMP DEFAULT NOW(),
  last_active_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);
```

#### 5. Swipes Table (Enhanced for Groups)
```sql
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dish_id VARCHAR(255) NOT NULL, -- iFood dish ID
  restaurant_id VARCHAR(255) NOT NULL, -- iFood restaurant ID
  direction VARCHAR(10) NOT NULL, -- left, right, super
  group_id UUID REFERENCES swipe_groups(id) ON DELETE SET NULL,
  session_id UUID, -- for tracking swipe sessions
  metadata JSONB DEFAULT '{}', -- dish details, restaurant info
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_swipes_user ON swipes(user_id);
CREATE INDEX idx_swipes_group ON swipes(group_id);
CREATE INDEX idx_swipes_dish ON swipes(dish_id);
CREATE INDEX idx_swipes_session ON swipes(session_id);
CREATE INDEX idx_swipes_created_at ON swipes(created_at);
```

#### 6. Group Matches Table
```sql
CREATE TABLE group_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES swipe_groups(id) ON DELETE CASCADE,
  dish_id VARCHAR(255) NOT NULL,
  restaurant_id VARCHAR(255) NOT NULL,
  dish_data JSONB NOT NULL, -- complete dish information
  restaurant_data JSONB NOT NULL, -- restaurant details
  match_percentage DECIMAL(4,2), -- 0.00 to 1.00
  member_votes JSONB DEFAULT '{}', -- {"user_id": "right/super", ...}
  status VARCHAR(20) DEFAULT 'active', -- active, ordered, expired
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP, -- matches expire after X hours
  UNIQUE(group_id, dish_id)
);

CREATE INDEX idx_group_matches_group ON group_matches(group_id);
CREATE INDEX idx_group_matches_status ON group_matches(status);
```

#### 7. Group Chat Messages
```sql
CREATE TABLE group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES swipe_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) DEFAULT 'text', -- text, match_share, dish_share, system
  content TEXT,
  metadata JSONB DEFAULT '{}', -- for match/dish shares
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_group_messages_group ON group_messages(group_id);
CREATE INDEX idx_group_messages_created_at ON group_messages(created_at);
```

#### 8. Social Activity Feed
```sql
CREATE TABLE activity_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- match_found, group_created, achievement_unlocked
  title VARCHAR(255),
  description TEXT,
  metadata JSONB DEFAULT '{}', -- dish/restaurant data, group info
  visibility VARCHAR(20) DEFAULT 'friends', -- public, friends, private
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_activity_feed_user ON activity_feed(user_id);
CREATE INDEX idx_activity_feed_type ON activity_feed(activity_type);
CREATE INDEX idx_activity_feed_created_at ON activity_feed(created_at);
```

#### 9. Achievements & Badges
```sql
CREATE TABLE achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL, -- first_match, swipe_master, group_creator
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon_url TEXT,
  category VARCHAR(30), -- social, swipe, discovery, streak
  difficulty VARCHAR(20), -- easy, medium, hard, legendary
  requirements JSONB NOT NULL, -- conditions to unlock
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  progress JSONB DEFAULT '{}', -- current progress towards achievement
  unlocked_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);
```

#### 10. Notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL, -- friend_request, group_invite, match_found
  title VARCHAR(255),
  message TEXT,
  metadata JSONB DEFAULT '{}',
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read_at);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
```

## 🔄 Real-time Communication Architecture

### WebSocket Integration with Socket.IO

```javascript
// Socket.IO server setup
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Socket Events Structure
const SOCKET_EVENTS = {
  // Group Management
  JOIN_GROUP: 'group:join',
  LEAVE_GROUP: 'group:leave',
  GROUP_UPDATE: 'group:update',
  
  // Swipe Coordination
  SWIPE_ACTION: 'swipe:action',
  SWIPE_RESULT: 'swipe:result',
  MATCH_FOUND: 'match:found',
  
  // Chat
  MESSAGE_SEND: 'chat:send',
  MESSAGE_RECEIVE: 'chat:receive',
  TYPING_START: 'chat:typing:start',
  TYPING_STOP: 'chat:typing:stop',
  
  // Presence
  USER_ONLINE: 'user:online',
  USER_OFFLINE: 'user:offline',
  GROUP_PRESENCE: 'group:presence',
  
  // Notifications
  NOTIFICATION: 'notification:new',
  FRIEND_REQUEST: 'friend:request',
  
  // System
  ERROR: 'error',
  DISCONNECT: 'disconnect'
};
```

### Real-time Group Swiping Flow

```javascript
// Group swipe coordination logic
class GroupSwipeManager {
  constructor(io) {
    this.io = io;
    this.activeGroups = new Map(); // groupId -> GroupSession
  }
  
  handleSwipe(socket, { groupId, userId, dishId, direction }) {
    const group = this.activeGroups.get(groupId);
    if (!group) return;
    
    // Record swipe
    group.recordSwipe(userId, dishId, direction);
    
    // Broadcast to group members
    socket.to(groupId).emit(SOCKET_EVENTS.SWIPE_ACTION, {
      userId,
      dishId,
      direction,
      timestamp: Date.now()
    });
    
    // Check for match
    const match = group.checkForMatch(dishId);
    if (match) {
      this.io.to(groupId).emit(SOCKET_EVENTS.MATCH_FOUND, {
        dish: match.dish,
        restaurant: match.restaurant,
        matchPercentage: match.percentage,
        votes: match.votes
      });
    }
  }
}
```

## 🔗 API Endpoints Design

### Authentication & User Management
```javascript
// User Profile
GET    /api/users/profile             // Get current user profile
PUT    /api/users/profile             // Update profile
POST   /api/users/avatar              // Upload avatar
GET    /api/users/stats               // Get user statistics

// Privacy & Settings
GET    /api/users/privacy             // Get privacy settings
PUT    /api/users/privacy             // Update privacy settings
```

### Friends System
```javascript
// Friend Management
GET    /api/friends                   // Get friends list
POST   /api/friends/request           // Send friend request
POST   /api/friends/accept/:id        // Accept friend request
POST   /api/friends/reject/:id        // Reject friend request
DELETE /api/friends/:id               // Remove friend
GET    /api/friends/requests          // Get pending requests
GET    /api/friends/search?q=term     // Search users

// Friend Activity
GET    /api/friends/activity          // Get friends' activity feed
GET    /api/friends/:id/matches       // Get friend's public matches (if allowed)
```

### Group Management
```javascript
// Group CRUD
GET    /api/groups                    // Get user's groups
POST   /api/groups                    // Create new group
GET    /api/groups/:id                // Get group details
PUT    /api/groups/:id                // Update group settings
DELETE /api/groups/:id               // Delete group (creator only)

// Group Membership
POST   /api/groups/:id/join           // Join public group
POST   /api/groups/:id/invite         // Invite friends to group
POST   /api/groups/:id/leave          // Leave group
DELETE /api/groups/:id/members/:userId // Remove member (admin only)
GET    /api/groups/:id/members        // Get group members

// Group Sessions
POST   /api/groups/:id/start          // Start swipe session
POST   /api/groups/:id/end            // End swipe session
GET    /api/groups/:id/matches        // Get group matches
POST   /api/groups/:id/matches/:dishId/order // Mark as ordered
```

### Social Features
```javascript
// Activity Feed
GET    /api/activity/feed             // Get personalized activity feed
POST   /api/activity/share            // Share achievement/match
GET    /api/activity/trending         // Get trending dishes/restaurants

// Achievements
GET    /api/achievements              // Get all achievements
GET    /api/achievements/user         // Get user's achievements
POST   /api/achievements/claim/:id    // Claim achievement reward

// Leaderboards
GET    /api/leaderboards/swipes       // Top swipers
GET    /api/leaderboards/matches      // Most matches
GET    /api/leaderboards/streaks      // Longest streaks
GET    /api/leaderboards/friends      // Friends leaderboard
```

### Enhanced Swipe System
```javascript
// Individual Swipes
POST   /api/swipes                    // Record swipe
GET    /api/swipes/history            // Get swipe history
GET    /api/swipes/matches            // Get personal matches
POST   /api/swipes/matches/:id/rate   // Rate a matched dish

// Group Swipes (WebSocket + REST)
POST   /api/groups/:id/swipes         // Record group swipe
GET    /api/groups/:id/swipes/current // Get current dish for group
GET    /api/groups/:id/swipes/stats   // Get group swipe statistics
```

### Chat System
```javascript
// Group Chat
GET    /api/groups/:id/messages       // Get chat messages
POST   /api/groups/:id/messages       // Send message (fallback to REST)
DELETE /api/groups/:id/messages/:msgId // Delete message (author/admin)

// Direct Messages (Future)
GET    /api/messages/conversations    // Get conversations list
GET    /api/messages/:userId          // Get messages with user
POST   /api/messages/:userId          // Send direct message
```

### Notifications
```javascript
// Notification Management
GET    /api/notifications             // Get notifications
POST   /api/notifications/:id/read    // Mark as read
POST   /api/notifications/read-all    // Mark all as read
DELETE /api/notifications/:id         // Delete notification
PUT    /api/notifications/settings    // Update notification preferences
```

## 🛡️ Privacy & Permissions System

### Privacy Levels
```javascript
const PRIVACY_LEVELS = {
  PUBLIC: 'public',     // Visible to everyone
  FRIENDS: 'friends',   // Visible to friends only
  PRIVATE: 'private'    // Visible to user only
};

const PRIVACY_SETTINGS = {
  profile_visibility: PRIVACY_LEVELS.FRIENDS,
  activity_visibility: PRIVACY_LEVELS.FRIENDS,
  location_sharing: true,
  match_sharing: PRIVACY_LEVELS.FRIENDS,
  online_status: true,
  search_visibility: true
};
```

### Group Permissions
```javascript
const GROUP_ROLES = {
  CREATOR: 'creator',   // Full permissions
  ADMIN: 'admin',       // Manage members, settings
  MEMBER: 'member'      // Basic participation
};

const GROUP_PERMISSIONS = {
  can_invite: false,
  can_remove: false,
  can_modify_settings: false,
  can_start_session: false,
  can_moderate_chat: false
};
```

## 🔔 Notification System Architecture

### Notification Types & Templates
```javascript
const NOTIFICATION_TYPES = {
  FRIEND_REQUEST: {
    title: '{sender_name} sent you a friend request',
    message: 'Accept to start swiping together!',
    actions: ['accept', 'decline'],
    icon: 'user-plus'
  },
  
  GROUP_INVITE: {
    title: 'Invited to {group_name}',
    message: '{inviter_name} invited you to join their swipe group',
    actions: ['join', 'decline'],
    icon: 'users'
  },
  
  MATCH_FOUND: {
    title: 'It\'s a Match! 🎉',
    message: 'You and your group matched on {dish_name}',
    actions: ['view', 'order'],
    icon: 'heart'
  },
  
  ACHIEVEMENT_UNLOCKED: {
    title: 'Achievement Unlocked!',
    message: 'You earned the "{achievement_name}" badge',
    actions: ['view'],
    icon: 'trophy'
  },
  
  GROUP_MATCH: {
    title: 'Group Match in {group_name}',
    message: '{match_percentage}% of the group loved {dish_name}!',
    actions: ['view', 'chat'],
    icon: 'users-heart'
  }
};
```

### Push Notification Integration
```javascript
// Push notification service
class PushNotificationService {
  static async sendToUser(userId, notification) {
    const user = await User.findById(userId);
    if (!user.push_token) return;
    
    const message = {
      to: user.push_token,
      title: notification.title,
      body: notification.message,
      data: notification.metadata,
      categoryId: notification.type
    };
    
    await expo.sendPushNotificationsAsync([message]);
  }
  
  static async sendToGroup(groupId, notification, excludeUserId = null) {
    const members = await GroupMember.getActiveMembers(groupId);
    const promises = members
      .filter(member => member.user_id !== excludeUserId)
      .map(member => this.sendToUser(member.user_id, notification));
    
    await Promise.all(promises);
  }
}
```

## 🎮 Gamification & Engagement

### Achievement System
```javascript
const ACHIEVEMENTS = {
  FIRST_MATCH: {
    code: 'first_match',
    name: 'First Taste',
    description: 'Get your first match',
    icon: 'heart-first',
    category: 'milestone',
    requirements: { matches_count: 1 }
  },
  
  SWIPE_MASTER: {
    code: 'swipe_master',
    name: 'Swipe Master',
    description: 'Swipe 1000 dishes',
    icon: 'swipe-champion',
    category: 'swipe',
    requirements: { swipes_count: 1000 }
  },
  
  SOCIAL_BUTTERFLY: {
    code: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Join 10 different groups',
    icon: 'butterfly',
    category: 'social',
    requirements: { groups_joined: 10 }
  },
  
  TASTE_EXPLORER: {
    code: 'taste_explorer',
    name: 'Taste Explorer',
    description: 'Match dishes from 20 different cuisines',
    icon: 'compass',
    category: 'discovery',
    requirements: { cuisines_matched: 20 }
  },
  
  STREAK_CHAMPION: {
    code: 'streak_champion',
    name: 'Streak Champion',
    description: 'Maintain a 30-day streak',
    icon: 'fire',
    category: 'streak',
    requirements: { streak_days: 30 }
  }
};
```

### Leaderboard System
```javascript
class LeaderboardService {
  static async getSwipeLeaderboard(period = 'week', limit = 50) {
    const query = `
      SELECT u.id, u.display_name, u.avatar_url, COUNT(s.id) as swipe_count
      FROM users u
      JOIN swipes s ON u.id = s.user_id
      WHERE s.created_at >= NOW() - INTERVAL '1 ${period}'
      GROUP BY u.id, u.display_name, u.avatar_url
      ORDER BY swipe_count DESC
      LIMIT $1
    `;
    return await db.query(query, [limit]);
  }
  
  static async getFriendsLeaderboard(userId, period = 'week') {
    const query = `
      SELECT u.id, u.display_name, u.avatar_url, COUNT(s.id) as swipe_count
      FROM users u
      JOIN swipes s ON u.id = s.user_id
      JOIN friendships f ON (f.requester_id = $1 AND f.addressee_id = u.id)
                          OR (f.addressee_id = $1 AND f.requester_id = u.id)
      WHERE f.status = 'accepted'
        AND s.created_at >= NOW() - INTERVAL '1 ${period}'
      GROUP BY u.id, u.display_name, u.avatar_url
      ORDER BY swipe_count DESC
    `;
    return await db.query(query, [userId]);
  }
}
```

## 🔄 Integration with Existing iFood Data Flow

### Enhanced Dish Service with Social Context
```javascript
// Enhanced dish service that considers social context
class SocialDishService extends DishService {
  static async getDishesForGroup(groupId, lat, lng, options = {}) {
    const group = await SwipeGroup.findById(groupId);
    const members = await GroupMember.getActiveMembers(groupId);
    
    // Get member preferences
    const memberPreferences = await this.getMemberPreferences(members);
    
    // Get dishes with preference filtering
    const dishes = await super.getDishesFeed(lat, lng, {
      ...options,
      preferences: memberPreferences,
      exclude_swiped: await this.getGroupSwipedDishes(groupId)
    });
    
    // Add social context
    return dishes.map(dish => ({
      ...dish,
      social_context: {
        group_id: groupId,
        member_count: members.length,
        predicted_match_score: this.predictGroupMatch(dish, memberPreferences)
      }
    }));
  }
  
  static async getDishesForUser(userId, lat, lng, options = {}) {
    const user = await User.findById(userId);
    const friends = await FriendshipService.getFriends(userId);
    
    // Get personalized recommendations
    const dishes = await super.getDishesFeed(lat, lng, {
      ...options,
      preferences: user.preferences,
      exclude_swiped: await this.getUserSwipedDishes(userId)
    });
    
    // Add social signals
    return dishes.map(dish => ({
      ...dish,
      social_signals: {
        friends_liked: await this.getFriendsWhoLikedDish(dish.id, friends),
        trending_score: await this.getDishTrendingScore(dish.id),
        recent_matches: await this.getRecentMatchesCount(dish.id)
      }
    }));
  }
}
```

### Group Match Algorithm
```javascript
class GroupMatchService {
  static calculateMatchScore(groupVotes, totalMembers) {
    const rightVotes = Object.values(groupVotes).filter(vote => vote === 'right').length;
    const superVotes = Object.values(groupVotes).filter(vote => vote === 'super').length;
    const totalVotes = rightVotes + superVotes;
    
    // Super likes count as 1.5x
    const weightedScore = (rightVotes + (superVotes * 1.5)) / totalMembers;
    return Math.min(weightedScore, 1.0);
  }
  
  static isMatch(groupVotes, totalMembers, threshold = 0.5) {
    const score = this.calculateMatchScore(groupVotes, totalMembers);
    return score >= threshold;
  }
  
  static async processGroupSwipe(groupId, userId, dishId, direction) {
    // Record the swipe
    await SwipeService.recordSwipe(userId, dishId, direction, groupId);
    
    // Get all votes for this dish in this group
    const groupVotes = await this.getGroupVotes(groupId, dishId);
    const group = await SwipeGroup.findById(groupId);
    const totalMembers = await GroupMember.getActiveMemberCount(groupId);
    
    // Check if all members have voted
    if (Object.keys(groupVotes).length === totalMembers) {
      const isMatch = this.isMatch(groupVotes, totalMembers, group.settings.match_threshold);
      
      if (isMatch) {
        await this.createGroupMatch(groupId, dishId, groupVotes);
        return { type: 'match', score: this.calculateMatchScore(groupVotes, totalMembers) };
      } else {
        return { type: 'no_match', votes: groupVotes };
      }
    }
    
    return { type: 'waiting', votes: groupVotes, remaining: totalMembers - Object.keys(groupVotes).length };
  }
}
```

## 📊 Analytics & Insights

### Social Engagement Metrics
```javascript
const SOCIAL_METRICS = {
  // Group Metrics
  group_creation_rate: 'Groups created per day',
  group_completion_rate: 'Groups that find matches',
  average_group_size: 'Average number of members',
  group_session_duration: 'Average session time',
  
  // Social Interaction
  friend_request_rate: 'Friend requests sent per user',
  friend_acceptance_rate: 'Accepted requests percentage',
  social_swipe_ratio: 'Group swipes vs individual swipes',
  
  // Engagement
  social_retention_rate: 'Users who return for social features',
  viral_coefficient: 'New users from social invites',
  match_conversion_rate: 'Matches that lead to orders'
};
```

### Performance Monitoring
```javascript
// Monitor real-time performance
class SocialMetricsCollector {
  static trackGroupSession(groupId, action, metadata = {}) {
    console.log(`[SOCIAL_METRIC] Group ${groupId}: ${action}`, metadata);
    
    // Send to analytics service
    analytics.track('social_group_action', {
      group_id: groupId,
      action,
      timestamp: Date.now(),
      ...metadata
    });
  }
  
  static trackUserSocialAction(userId, action, metadata = {}) {
    analytics.track('social_user_action', {
      user_id: userId,
      action,
      timestamp: Date.now(),
      ...metadata
    });
  }
}
```

## 🚀 Implementation Phases

### Phase 1: Core Social Infrastructure (2 weeks)
- [ ] Database schema implementation
- [ ] User authentication & profiles
- [ ] Basic friendship system
- [ ] WebSocket infrastructure
- [ ] Privacy settings

### Phase 2: Group Swipe System (3 weeks)
- [ ] Group creation & management
- [ ] Real-time group swipe coordination
- [ ] Group match algorithm
- [ ] Basic group chat
- [ ] Group notifications

### Phase 3: Social Features (2 weeks)
- [ ] Activity feed
- [ ] Achievement system
- [ ] Leaderboards
- [ ] Enhanced notifications
- [ ] Social sharing

### Phase 4: Advanced Features (2 weeks)
- [ ] Advanced group permissions
- [ ] Social discovery
- [ ] Trending system
- [ ] Analytics dashboard
- [ ] Performance optimizations

### Phase 5: Polish & Launch (1 week)
- [ ] Comprehensive testing
- [ ] Performance tuning
- [ ] Documentation
- [ ] Monitoring setup
- [ ] Beta release

## 🔧 Technical Implementation Notes

### Database Considerations
- Use PostgreSQL with JSONB for flexible metadata storage
- Implement proper indexing for social queries
- Consider read replicas for heavy social feed queries
- Use Redis for real-time session management and caching

### WebSocket Optimization
- Implement room-based broadcasting for groups
- Use Redis adapter for horizontal scaling
- Implement proper disconnection handling
- Add reconnection logic with state recovery

### Caching Strategy
```javascript
const CACHE_KEYS = {
  user_friends: (userId) => `friends:${userId}`,
  group_members: (groupId) => `group_members:${groupId}`,
  activity_feed: (userId) => `feed:${userId}`,
  leaderboard: (type, period) => `leaderboard:${type}:${period}`,
  user_achievements: (userId) => `achievements:${userId}`
};

const CACHE_TTL = {
  friends_list: 300,      // 5 minutes
  group_members: 600,     // 10 minutes  
  activity_feed: 180,     // 3 minutes
  leaderboards: 3600,     // 1 hour
  achievements: 1800      // 30 minutes
};
```

### Security Considerations
- Validate all group permissions before actions
- Implement rate limiting for social actions
- Sanitize user-generated content
- Encrypt sensitive metadata
- Implement proper session management for WebSocket connections

This architecture provides a solid foundation for engaging social features while maintaining the core swipe experience that makes FoodieSwipe unique. The system is designed to scale and can be implemented incrementally.