// =================== Y.js Collaboration System ===================
// Handles real-time collaboration using Y.js with shareable links

class CollaborationManager {
  constructor() {
    this.ydoc = null;
    this.provider = null;
    this.awareness = null;
    this.isHost = false;
    this.isGuest = false;
    this.collaborationId = null;
    this.sessionId = null;
    this.users = new Map();
    this.cursors = new Map();
    this.collabData = null;
    this.isInitialized = false;
    this.broadcastChannel = null;
    this.eventHandlers = new Map();
    
    // Generate unique session ID for guests
    this.sessionId = this.generateSessionId();
  }

  // =================== Initialization ===================
  
  async init() {
    if (this.isInitialized) return;
    
    try {
      // Check if Y.js is available, if not load it
      if (typeof Y === 'undefined') {
        await this.loadYjsLibraries();
      }
      
      this.setupEventListeners();
      this.isInitialized = true;
      console.log('[COLLAB] Collaboration manager initialized');
    } catch (error) {
      console.error('[COLLAB] Failed to initialize collaboration:', error);
    }
  }

  async loadYjsLibraries() {
    // Load Y.js libraries dynamically
    await this.loadScript('https://cdn.jsdelivr.net/npm/yjs@13.6.8/dist/yjs.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/y-websocket@1.5.0/dist/y-websocket.js');
    await this.loadScript('https://cdn.jsdelivr.net/npm/lib0@0.2.85/dist/lib0.js');
  }

  loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // =================== Collaboration Link Management ===================

  async createCollaborationLink() {
    try {
      const userId = await this.getCurrentUserId();
      if (!userId) {
        throw new Error('User must be authenticated to create collaboration link');
      }

      this.collaborationId = this.generateCollaborationId();
      this.isHost = true;

      // Save collaboration data to database
      const collabData = {
        id: this.collaborationId,
        host_user_id: userId,
        created_at: new Date().toISOString(),
        is_active: true,
        participants: [userId],
        settings: {
          allowGuests: true,
          maxParticipants: 10
        }
      };

      await this.saveCollaborationToDB(collabData);
      
      // Initialize Y.js document
      await this.initializeYDoc(this.collaborationId);
      
      // Generate shareable link
      const shareableLink = `${window.location.origin}${window.location.pathname}?collab=${this.collaborationId}`;
      
      // Save to local storage for quick access
      this.saveCollaborationToLocal(collabData, shareableLink);
      
      console.log('[COLLAB] Collaboration link created:', shareableLink);
      return shareableLink;
      
    } catch (error) {
      console.error('[COLLAB] Failed to create collaboration link:', error);
      throw error;
    }
  }

  async joinCollaboration(collaborationId) {
    try {
      this.collaborationId = collaborationId;
      this.isGuest = true;

      // Load collaboration data from database
      const collabData = await this.loadCollaborationFromDB(collaborationId);
      if (!collabData || !collabData.is_active) {
        throw new Error('Collaboration session not found or inactive');
      }

      this.collabData = collabData;
      
      // Initialize Y.js document
      await this.initializeYDoc(collaborationId);
      
      // Add current user/session to participants
      await this.addParticipant();
      
      console.log('[COLLAB] Joined collaboration:', collaborationId);
      return true;
      
    } catch (error) {
      console.error('[COLLAB] Failed to join collaboration:', error);
      throw error;
    }
  }

  async initializeYDoc(collaborationId) {
    // Create Y.js document
    this.ydoc = new Y.Doc();
    
    // Set up shared types
    this.sharedMessages = this.ydoc.getArray('messages');
    this.sharedArtifacts = this.ydoc.getMap('artifacts');
    this.sharedCursors = this.ydoc.getMap('cursors');
    this.sharedUsers = this.ydoc.getMap('users');
    
    // Initialize WebSocket provider for real-time sync
    const wsUrl = window.COLLABORATION_CONFIG?.websocketUrl || 'ws://localhost:1234';
    this.provider = new Y.WebsocketProvider(
      wsUrl,
      collaborationId,
      this.ydoc
    );

    // Set up awareness for cursor tracking
    this.awareness = this.provider.awareness;
    
    // Set user information
    const userInfo = await this.getUserInfo();
    this.awareness.setLocalStateField('user', userInfo);
    
    // Set up event listeners
    this.setupYjsEventListeners();
    
    console.log('[COLLAB] Y.js document initialized for collaboration:', collaborationId);
  }

  // =================== Event Handling ===================

  setupEventListeners() {
    // Listen for URL changes to detect collaboration links
    window.addEventListener('load', () => this.checkForCollaborationInURL());
    window.addEventListener('popstate', () => this.checkForCollaborationInURL());
    
    // Set up broadcast channel for cross-tab communication
    this.broadcastChannel = new BroadcastChannel('bike-collaboration');
    this.broadcastChannel.addEventListener('message', (event) => {
      this.handleBroadcastMessage(event.data);
    });
  }

  setupYjsEventListeners() {
    // Listen for document changes
    this.sharedMessages.observe((event) => {
      this.handleMessagesUpdate(event);
    });

    this.sharedArtifacts.observe((event) => {
      this.handleArtifactsUpdate(event);
    });

    // Listen for awareness changes (cursors, user presence)
    this.awareness.on('change', (changes) => {
      this.handleAwarenessChange(changes);
    });

    // Listen for user joins/leaves
    this.sharedUsers.observe((event) => {
      this.handleUsersUpdate(event);
    });
  }

  checkForCollaborationInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const collaborationId = urlParams.get('collab');
    
    if (collaborationId && collaborationId !== this.collaborationId) {
      this.joinCollaboration(collaborationId);
    }
  }

  // =================== Real-time Updates ===================

  handleMessagesUpdate(event) {
    event.changes.added.forEach((item) => {
      const message = item.content.getJSON();
      this.displayCollaborativeMessage(message);
      this.saveMessageActivity(message);
    });
  }

  handleArtifactsUpdate(event) {
    event.changes.keys.forEach((change, key) => {
      if (change.action === 'add' || change.action === 'update') {
        const artifact = this.sharedArtifacts.get(key);
        this.updateArtifactDisplay(artifact);
        this.saveArtifactActivity(artifact);
      }
    });
  }

  handleAwarenessChange(changes) {
    const states = this.awareness.getStates();
    
    states.forEach((state, clientId) => {
      if (clientId !== this.awareness.clientID) {
        this.updateUserPresence(clientId, state);
      }
    });
  }

  handleUsersUpdate(event) {
    const users = Array.from(this.sharedUsers.values());
    this.updateParticipantsList(users);
  }

  // =================== Collaborative Actions ===================

  shareMessage(message) {
    if (!this.ydoc || !this.sharedMessages) return;
    
    const collaborativeMessage = {
      ...message,
      collaborationId: this.collaborationId,
      authorId: this.isGuest ? this.sessionId : message.userId,
      authorType: this.isGuest ? 'guest' : 'user',
      timestamp: new Date().toISOString(),
      syncId: this.generateSyncId()
    };
    
    this.sharedMessages.push([collaborativeMessage]);
  }

  shareArtifact(artifact) {
    if (!this.ydoc || !this.sharedArtifacts) return;
    
    const collaborativeArtifact = {
      ...artifact,
      collaborationId: this.collaborationId,
      authorId: this.isGuest ? this.sessionId : artifact.userId,
      authorType: this.isGuest ? 'guest' : 'user',
      lastModified: new Date().toISOString(),
      syncId: this.generateSyncId()
    };
    
    this.sharedArtifacts.set(artifact.id, collaborativeArtifact);
  }

  shareCursor(position) {
    if (!this.awareness) return;
    
    this.awareness.setLocalStateField('cursor', {
      position,
      timestamp: Date.now(),
      userId: this.isGuest ? this.sessionId : this.getCurrentUserId()
    });
  }

  // =================== Database Operations ===================

  async saveCollaborationToDB(collabData) {
    try {
      if (!window.supabase) {
        console.warn('[COLLAB] Supabase not available, saving to local storage only');
        return;
      }

      const { data, error } = await window.supabase
        .from('collaborations')
        .insert(collabData);

      if (error) throw error;
      
      console.log('[COLLAB] Collaboration saved to database');
      return data;
    } catch (error) {
      console.error('[COLLAB] Failed to save collaboration to database:', error);
      // Fallback to local storage
      this.saveCollaborationToLocal(collabData);
    }
  }

  async loadCollaborationFromDB(collaborationId) {
    try {
      if (!window.supabase) {
        return this.loadCollaborationFromLocal(collaborationId);
      }

      const { data, error } = await window.supabase
        .from('collaborations')
        .select('*')
        .eq('id', collaborationId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[COLLAB] Failed to load collaboration from database:', error);
      return this.loadCollaborationFromLocal(collaborationId);
    }
  }

  async saveMessageActivity(message) {
    const activity = {
      collaboration_id: this.collaborationId,
      user_id: this.isGuest ? null : await this.getCurrentUserId(),
      session_id: this.isGuest ? this.sessionId : null,
      activity_type: 'message',
      activity_data: message,
      timestamp: new Date().toISOString()
    };

    await this.saveActivityToDB(activity);
  }

  async saveArtifactActivity(artifact) {
    const activity = {
      collaboration_id: this.collaborationId,
      user_id: this.isGuest ? null : await this.getCurrentUserId(),
      session_id: this.isGuest ? this.sessionId : null,
      activity_type: 'artifact',
      activity_data: artifact,
      timestamp: new Date().toISOString()
    };

    await this.saveActivityToDB(activity);
  }

  async saveActivityToDB(activity) {
    try {
      if (!window.supabase) {
        this.saveActivityToLocal(activity);
        return;
      }

      const { data, error } = await window.supabase
        .from('collaboration_activities')
        .insert(activity);

      if (error) throw error;
      console.log('[COLLAB] Activity saved to database');
    } catch (error) {
      console.error('[COLLAB] Failed to save activity to database:', error);
      this.saveActivityToLocal(activity);
    }
  }

  // =================== Local Storage Fallbacks ===================

  saveCollaborationToLocal(collabData, shareableLink = null) {
    const localCollabs = this.getLocalCollaborations();
    localCollabs[collabData.id] = {
      ...collabData,
      shareableLink,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('bike_collaborations', JSON.stringify(localCollabs));
  }

  loadCollaborationFromLocal(collaborationId) {
    const localCollabs = this.getLocalCollaborations();
    return localCollabs[collaborationId] || null;
  }

  saveActivityToLocal(activity) {
    const localActivities = this.getLocalActivities();
    if (!localActivities[activity.collaboration_id]) {
      localActivities[activity.collaboration_id] = [];
    }
    localActivities[activity.collaboration_id].push(activity);
    localStorage.setItem('bike_collaboration_activities', JSON.stringify(localActivities));
  }

  getLocalCollaborations() {
    try {
      return JSON.parse(localStorage.getItem('bike_collaborations') || '{}');
    } catch {
      return {};
    }
  }

  getLocalActivities() {
    try {
      return JSON.parse(localStorage.getItem('bike_collaboration_activities') || '{}');
    } catch {
      return {};
    }
  }

  // =================== User Management ===================

  async getCurrentUserId() {
    if (window.userSession?.user?.id) {
      return window.userSession.user.id;
    }
    return null;
  }

  async getUserInfo() {
    const userId = await this.getCurrentUserId();
    
    if (userId) {
      return {
        id: userId,
        type: 'user',
        name: window.userSession.user.email || 'User',
        color: this.generateUserColor(userId)
      };
    } else {
      return {
        id: this.sessionId,
        type: 'guest',
        name: `Guest ${this.sessionId.slice(0, 6)}`,
        color: this.generateUserColor(this.sessionId)
      };
    }
  }

  async addParticipant() {
    const userInfo = await this.getUserInfo();
    this.sharedUsers.set(userInfo.id, userInfo);
  }

  // =================== UI Updates ===================

  displayCollaborativeMessage(message) {
    // Integrate with existing message display system
    if (window.messages && typeof window.messages.displayMessage === 'function') {
      window.messages.displayMessage(message);
    }
  }

  updateArtifactDisplay(artifact) {
    // Integrate with existing artifact system
    if (window.artifacts && typeof window.artifacts.updateArtifact === 'function') {
      window.artifacts.updateArtifact(artifact);
    }
  }

  updateUserPresence(clientId, state) {
    const user = state.user;
    const cursor = state.cursor;
    
    if (user) {
      this.users.set(clientId, user);
      this.updateParticipantsUI();
    }
    
    if (cursor) {
      this.cursors.set(clientId, cursor);
      this.updateCursorsUI();
    }
  }

  updateParticipantsList(users) {
    // Update UI to show current participants
    const participantsContainer = document.getElementById('collaboration-participants');
    if (participantsContainer) {
      participantsContainer.innerHTML = users.map(user => `
        <div class="participant" style="color: ${user.color}">
          <span class="participant-name">${user.name}</span>
          <span class="participant-type">${user.type}</span>
        </div>
      `).join('');
    }
  }

  updateParticipantsUI() {
    const users = Array.from(this.users.values());
    this.updateParticipantsList(users);
  }

  updateCursorsUI() {
    // Display other users' cursors
    this.cursors.forEach((cursor, clientId) => {
      const user = this.users.get(clientId);
      if (user && cursor.position) {
        this.showUserCursor(user, cursor.position);
      }
    });
  }

  showUserCursor(user, position) {
    // Implementation to show user cursor in the UI
    // This would integrate with your existing editor/input system
  }

  // =================== Utility Functions ===================

  generateCollaborationId() {
    return 'collab_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateSyncId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateUserColor(id) {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    const hash = id.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  handleBroadcastMessage(data) {
    // Handle cross-tab collaboration messages
    if (data.type === 'collaboration-update') {
      // Sync collaboration state across tabs
    }
  }

  // =================== Public API ===================

  async createLink() {
    return await this.createCollaborationLink();
  }

  async joinByUrl() {
    return this.checkForCollaborationInURL();
  }

  isCollaborating() {
    return this.collaborationId !== null;
  }

  getCollaborationId() {
    return this.collaborationId;
  }

  getParticipants() {
    return Array.from(this.users.values());
  }

  async leaveCollaboration() {
    if (this.provider) {
      this.provider.destroy();
    }
    if (this.ydoc) {
      this.ydoc.destroy();
    }
    
    this.collaborationId = null;
    this.isHost = false;
    this.isGuest = false;
    this.users.clear();
    this.cursors.clear();
    
    console.log('[COLLAB] Left collaboration');
  }
}

// Create global collaboration manager instance
const collaboration = new CollaborationManager();
window.collaboration = collaboration;

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = collaboration;
}