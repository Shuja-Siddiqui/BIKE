// =================== Real-time Messenger System ===================
// Standalone chat room using Yjs for real-time messaging
// Independent of collaboration.js - pure messenger functionality

const messenger = {
  // State
  ydoc: null,
  provider: null,
  isConnected: false,
  roomId: null,
  username: null,
  userId: null,
  sharedMessages: null,
  sharedUsers: null,
  localMessages: [],
  onlineUsers: new Set(),
  isVisible: false,

  // UI Elements
  messengerContainer: null,
  messagesContainer: null,
  messageInput: null,
  usersList: null,
  connectionStatus: null,

  // Initialize messenger
  async init() {
    await this.waitForYjs();
    this.setupUI();
    this.setupLocalStorage();
    this.generateUserId();
    console.log("[MESSENGER] Initialized");
  },

  // Wait for Yjs to be available
  async waitForYjs() {
    return new Promise((resolve) => {
      const check = () => {
        if (window.Y && window.WebrtcProvider) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  },

  // Generate unique user ID
  generateUserId() {
    this.userId =
      localStorage.getItem("messenger_userId") ||
      "user_" + Math.random().toString(36).substr(2, 9);
    localStorage.setItem("messenger_userId", this.userId);

    this.username =
      localStorage.getItem("messenger_username") ||
      "Anonymous_" + this.userId.slice(-4);
    localStorage.setItem("messenger_username", this.username);
  },

  // Setup local storage and IndexedDB
  setupLocalStorage() {
    // Load existing messages from localStorage
    try {
      this.localMessages = JSON.parse(
        localStorage.getItem("messenger_messages") || "[]"
      );
    } catch (e) {
      console.warn("[MESSENGER] Failed to load messages from localStorage:", e);
      this.localMessages = [];
    }
  },

  // Save messages to localStorage
  saveToLocalStorage() {
    try {
      localStorage.setItem(
        "messenger_messages",
        JSON.stringify(this.localMessages)
      );
    } catch (e) {
      console.warn("[MESSENGER] Failed to save messages to localStorage:", e);
    }
  },

  // Join a chat room
  async joinRoom(roomId) {
    if (this.isConnected && this.roomId === roomId) {
      console.log("[MESSENGER] Already connected to room:", roomId);
      return;
    }

    await this.leaveRoom(); // Leave current room first

    console.log("[MESSENGER] Joining room:", roomId);
    this.roomId = roomId;

    try {
      // Create new Yjs document
      this.ydoc = new window.Y.Doc();

      // Set up shared data structures
      this.sharedMessages = this.ydoc.getArray("messages");
      this.sharedUsers = this.ydoc.getMap("users");

      // Create WebRTC provider with dedicated namespace and clean slate
      const messengerRoomId = "messenger_" + roomId; // Consistent room name
      console.log(
        "[MESSENGER] Creating WebRTC provider for room:",
        messengerRoomId,
        "using dedicated signaling server on port 4445"
      );
      this.provider = new window.WebrtcProvider(messengerRoomId, this.ydoc, {
        signaling: ["ws://localhost:4445"],
        maxConns: 50,
        filterBcConns: false,
        peerOpts: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
            { urls: "stun:stun3.l.google.com:19302" },
          ],
          config: {
            iceTransportPolicy: "all",
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require",
          },
        },
      });

      console.log("[MESSENGER] WebRTC provider created:", {
        originalRoomId: roomId,
        actualRoomId: messengerRoomId,
        connected: this.provider.connected,
        awareness: !!this.provider.awareness,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Wait a moment for provider to initialize
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Mark user as online
      this.markUserOnline();

      // Set up periodic sync monitoring
      this.startSyncMonitoring();

      // Load existing messages
      this.loadRoomMessages();

      this.isConnected = true;
      this.updateConnectionStatus("Connected to " + roomId);

      // Log final connection state
      console.log("[MESSENGER] ✅ Successfully joined room:", {
        roomId,
        actualRoomId: messengerRoomId,
        providerConnected: this.provider?.connected,
        awareness: this.provider?.awareness?.getStates().size || 0,
        sharedMessagesLength: this.sharedMessages?.length || 0,
        sharedUsersSize: this.sharedUsers?.size || 0,
      });
    } catch (error) {
      console.error("[MESSENGER] ❌ Failed to join room:", error);
      this.updateConnectionStatus("Failed to connect");
    }
  },

  // Leave current room
  async leaveRoom() {
    if (!this.isConnected) return;

    console.log("[MESSENGER] Leaving room:", this.roomId);

    // Stop sync monitoring
    this.stopSyncMonitoring();

    // Mark user as offline
    this.markUserOffline();

    // Disconnect provider
    if (this.provider) {
      this.provider.disconnect();
      this.provider.destroy();
      this.provider = null;
    }

    // Clean up
    this.ydoc = null;
    this.sharedMessages = null;
    this.sharedUsers = null;
    this.onlineUsers.clear();
    this.isConnected = false;
    this.roomId = null;

    this.updateConnectionStatus("Disconnected");
    this.updateUsersList();
  },

  // Mark user as online
  markUserOnline() {
    if (!this.sharedUsers) return;

    const userInfo = {
      id: this.userId,
      username: this.username,
      joinedAt: Date.now(),
      status: "online",
    };

    console.log("[MESSENGER] Marking user online:", userInfo);
    this.sharedUsers.set(this.userId, userInfo);

    console.log("[MESSENGER] Total users in room:", this.sharedUsers.size);
  },

  // Mark user as offline
  markUserOffline() {
    if (!this.sharedUsers) return;
    this.sharedUsers.delete(this.userId);
  },

  // Setup Yjs event listeners
  setupEventListeners() {
    // Listen for new messages
    this.sharedMessages.observe((event) => {
      console.log("[MESSENGER] ═══ OBSERVER FIRED ═══");
      console.log("[MESSENGER] Observer event details:", {
        added: event.changes.added.length,
        deleted: event.changes.deleted.length,
        userId: this.userId,
        username: this.username,
        timestamp: new Date().toISOString(),
        sharedArrayLength: this.sharedMessages.length,
        allMessages: this.sharedMessages.toArray().map((m) => ({
          id: m.id,
          from: m.username,
          content: m.content?.substring(0, 20) + "...",
        })),
      });

      event.changes.added.forEach((item, index) => {
        console.log(`[MESSENGER] Processing added item ${index}:`, {
          itemType: typeof item.content,
          isArray: Array.isArray(item.content),
          hasArr: !!(item.content && item.content.arr),
          raw: item.content,
        });

        let newMessages = [];
        if (item.content && item.content.arr) {
          newMessages = item.content.arr;
        } else if (Array.isArray(item.content)) {
          newMessages = item.content;
        } else {
          newMessages = [item.content];
        }

        console.log(
          `[MESSENGER] Extracted ${newMessages.length} messages:`,
          newMessages.map((m) => ({
            id: m?.id,
            from: m?.username,
            to: this.username,
            content: m?.content?.substring(0, 30),
          }))
        );

        newMessages.forEach((message, msgIndex) => {
          console.log(`[MESSENGER] ▶ Processing message ${msgIndex}:`, {
            messageId: message?.id,
            from: message?.username,
            to: this.username,
            currentUserId: this.userId,
            isMyMessage: message?.userId === this.userId,
          });
          this.handleNewMessage(message);
        });
      });

      console.log("[MESSENGER] ═══ OBSERVER COMPLETE ═══");
    });

    // Listen for user changes
    this.sharedUsers.observe((event) => {
      this.updateOnlineUsers();
    });

    // Provider connection events
    this.provider.on("status", (event) => {
      console.log("[MESSENGER] Provider status changed:", {
        status: event.status,
        roomId: this.roomId,
        userId: this.userId,
        username: this.username,
        connected: this.provider?.connected,
        peerCount: this.provider?.awareness?.getStates().size || 0,
      });

      if (event.status === "connected") {
        this.updateConnectionStatus("Connected to " + this.roomId);
      } else if (event.status === "disconnected") {
        this.updateConnectionStatus("Disconnected");
      }
    });

    // Enhanced peer monitoring
    this.provider.on("peers", (event) => {
      if (event.added.length > 0) {
        event.added.forEach((peerId) => {
          console.log(
            `[MESSENGER] 🟢 Peer connected: ${peerId.substring(0, 8)}...`
          );
        });
      }
      if (event.removed.length > 0) {
        event.removed.forEach((peerId) => {
          console.log(
            `[MESSENGER] 🔴 Peer disconnected: ${peerId.substring(0, 8)}...`
          );
        });
      }

      const totalPeers = this.provider.awareness?.getStates().size || 0;
      console.log(`[MESSENGER] 👥 Total peers: ${totalPeers}`);

      // Force sync when peer count changes
      if (totalPeers >= 2) {
        setTimeout(() => {
          this.markUserOnline(); // Trigger awareness update
        }, 500);
      }
    });

    // Monitor WebRTC connection state
    this.provider.on("synced", (event) => {
      console.log("[MESSENGER] 🔄 Document synced:", event);
    });
  },

  // Handle new incoming message
  handleNewMessage(message) {
    console.log("[MESSENGER] handleNewMessage called:", {
      messageExists: !!message,
      messageId: message?.id,
      messageFrom: message?.username,
      currentUser: this.username,
      currentUserId: this.userId,
    });

    if (!message || !message.id) {
      console.warn("[MESSENGER] Invalid message received:", message);
      return;
    }

    // Check if we already have this message in local storage OR if it's already rendered
    const existsInLocal = this.localMessages.some((m) => m.id === message.id);
    const existsInUI =
      this.messagesContainer &&
      Array.from(this.messagesContainer.children).some(
        (el) => el.dataset.messageId === message.id
      );

    console.log("[MESSENGER] Duplicate check:", {
      existsInLocal,
      existsInUI,
      messageId: message.id,
      localMessagesCount: this.localMessages.length,
    });

    if (existsInLocal || existsInUI) {
      console.log("[MESSENGER] Duplicate message ignored:", message.id);
      return;
    }

    // Add to local messages
    this.localMessages.push(message);
    this.saveToLocalStorage();

    console.log("[MESSENGER] Message added to UI:", {
      content: message.content,
      from: message.username,
      to: this.username,
      isOwnMessage: message.userId === this.userId,
    });

    // Update UI
    this.renderMessage(message);
    this.scrollToBottom();

    console.log(
      "[MESSENGER] New message processed successfully:",
      message.content
    );
  },

  // Send a message
  sendMessage(content) {
    if (!this.isConnected || !content.trim()) return;

    const message = {
      id: Date.now() + "_" + this.userId,
      content: content.trim(),
      username: this.username,
      userId: this.userId,
      timestamp: Date.now(),
      roomId: this.roomId,
    };

    try {
      console.log("[MESSENGER] Sending message:", {
        content: message.content,
        from: this.username,
        userId: this.userId,
        sharedArrayLength: this.sharedMessages.length,
      });

      // Add to shared messages - the observer will handle UI updates
      this.sharedMessages.push([message]);

      console.log(
        "[MESSENGER] Message pushed to shared array. New length:",
        this.sharedMessages.length
      );
    } catch (error) {
      console.error("[MESSENGER] Failed to send message:", error);
    }
  },

  // Load existing messages for room
  loadRoomMessages() {
    if (!this.sharedMessages) return;

    // Clear current UI and reset local messages for this room
    this.clearMessages();

    // Load messages from shared array (this is the source of truth)
    const existingMessages = this.sharedMessages.toArray();

    // Clear local messages for this room to avoid duplicates
    this.localMessages = this.localMessages.filter(
      (m) => m.roomId !== this.roomId && m.roomId // keep messages from other rooms
    );

    // Process each message from shared array
    existingMessages.forEach((message) => {
      this.handleNewMessage(message);
    });

    this.scrollToBottom();
  },

  // Update online users list
  updateOnlineUsers() {
    if (!this.sharedUsers) return;

    this.onlineUsers.clear();

    // Get all users from shared map
    this.sharedUsers.forEach((userData, userId) => {
      if (userData.status === "online") {
        this.onlineUsers.add(userData);
      }
    });

    this.updateUsersList();
  },

  // Set username
  setUsername(newUsername) {
    if (!newUsername || !newUsername.trim()) return;

    this.username = newUsername.trim();
    localStorage.setItem("messenger_username", this.username);

    // Update in shared users if connected
    if (this.isConnected && this.sharedUsers) {
      this.markUserOnline();
    }

    console.log("[MESSENGER] Username set to:", this.username);
  },

  // Show messenger
  show() {
    if (this.messengerContainer) {
      this.messengerContainer.style.display = "flex";
      this.isVisible = true;
      this.messageInput?.focus();
    }
  },

  // Hide messenger
  hide() {
    if (this.messengerContainer) {
      this.messengerContainer.style.display = "none";
      this.isVisible = false;
    }
  },

  // Debug function to test message sending
  debugSendTest() {
    console.log("[MESSENGER] 🧪 ═══ FULL DEBUG STATE ═══");
    console.log("[MESSENGER] 🧪 Connection state:", {
      isConnected: this.isConnected,
      roomId: this.roomId,
      userId: this.userId,
      username: this.username,
      providerConnected: this.provider?.connected,
      providerAwareness: this.provider?.awareness?.getStates().size || 0,
    });

    console.log("[MESSENGER] 🧪 Yjs state:", {
      sharedMessagesExists: !!this.sharedMessages,
      sharedMessagesLength: this.sharedMessages?.length,
      sharedUsersExists: !!this.sharedUsers,
      sharedUsersSize: this.sharedUsers?.size,
      ydocExists: !!this.ydoc,
    });

    console.log("[MESSENGER] 🧪 All messages in shared array:");
    const allMessages = this.sharedMessages?.toArray() || [];
    allMessages.forEach((msg, index) => {
      console.log(`[MESSENGER] 🧪 Message ${index}:`, {
        id: msg.id,
        from: msg.username,
        userId: msg.userId,
        content: msg.content,
        timestamp: new Date(msg.timestamp).toLocaleTimeString(),
      });
    });

    console.log("[MESSENGER] 🧪 All users in shared map:");
    if (this.sharedUsers) {
      this.sharedUsers.forEach((user, userId) => {
        console.log(`[MESSENGER] 🧪 User:`, {
          id: userId,
          username: user.username,
          status: user.status,
          joinedAt: new Date(user.joinedAt).toLocaleTimeString(),
        });
      });
    }

    // Force sync check and repair
    this.forceSyncCheck();

    if (this.isConnected) {
      const testMessage = `🧪 Debug test from ${
        this.username
      } at ${new Date().toLocaleTimeString()}`;
      console.log("[MESSENGER] 🧪 Sending test message:", testMessage);
      this.sendMessage(testMessage);
    } else {
      console.warn("[MESSENGER] 🧪 Cannot send - not connected");
    }

    console.log("[MESSENGER] 🧪 ═══ DEBUG COMPLETE ═══");
  },

  // Force Yjs sync check and repair
  forceSyncCheck() {
    console.log("[MESSENGER] 🔄 Force sync check initiated");

    if (!this.provider || !this.ydoc) {
      console.warn("[MESSENGER] ⚠️ Cannot sync - missing provider or doc");
      return;
    }

    try {
      // Force awareness update
      if (this.provider.awareness) {
        const currentState = this.provider.awareness.getLocalState();
        this.provider.awareness.setLocalState({
          ...currentState,
          forceSyncTimestamp: Date.now(),
        });
        console.log("[MESSENGER] 🔄 Awareness state updated for sync");
      }

      // Force WebRTC reconnection if needed
      if (
        this.provider.connected &&
        this.provider.awareness?.getStates().size < 2
      ) {
        console.log(
          "[MESSENGER] 🔄 Forcing provider reconnection due to peer count"
        );
        setTimeout(() => {
          this.provider.disconnect();
          setTimeout(() => {
            this.provider.connect();
          }, 1000);
        }, 100);
      }

      // Force document state vector exchange
      if (this.provider.connected) {
        console.log("[MESSENGER] 🔄 Broadcasting sync request");
        // Trigger a state vector update by modifying awareness
        this.markUserOnline();
      }
    } catch (error) {
      console.error("[MESSENGER] ❌ Sync check failed:", error);
    }
  },

  // Start periodic sync monitoring
  startSyncMonitoring() {
    // Clear any existing interval
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    console.log("[MESSENGER] 🔄 Starting sync monitoring");

    this.syncInterval = setInterval(() => {
      if (!this.isConnected || !this.provider) return;

      const peerCount = this.provider.awareness?.getStates().size || 0;
      const isProviderConnected = this.provider.connected;

      console.log("[MESSENGER] 🔄 Sync check:", {
        peerCount,
        isProviderConnected,
        messagesLength: this.sharedMessages?.length || 0,
      });

      // Check for connection instability
      if (isProviderConnected && peerCount < 2) {
        console.log("[MESSENGER] ⚠️ Connection unstable - peer count low");

        // Try to reconnect WebRTC
        if (this.provider.room) {
          console.log("[MESSENGER] 🔄 Attempting WebRTC reconnection");
          this.provider.room.webrtcConns.forEach((conn, peerId) => {
            if (conn.connected === false) {
              console.log(
                `[MESSENGER] 🔄 Reconnecting to peer: ${peerId.substring(
                  0,
                  8
                )}...`
              );
              conn.destroy();
            }
          });
        }
      }

      // Force sync if we have peers but no recent activity
      if (peerCount >= 2 && isProviderConnected) {
        // Update awareness to trigger sync
        if (this.provider.awareness) {
          const currentState = this.provider.awareness.getLocalState();
          this.provider.awareness.setLocalState({
            ...currentState,
            lastHeartbeat: Date.now(),
          });
        }
      }
    }, 5000); // Check every 5 seconds for faster detection
  },

  // Stop sync monitoring
  stopSyncMonitoring() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("[MESSENGER] 🔄 Sync monitoring stopped");
    }
  },

  // Force complete resynchronization
  forceResync() {
    console.log("[MESSENGER] 🔄 ═══ FORCE RESYNC INITIATED ═══");

    if (!this.isConnected || !this.roomId) {
      console.warn("[MESSENGER] ⚠️ Cannot resync - not connected");
      return;
    }

    const currentRoomId = this.roomId;
    const currentUsername = this.username;

    console.log("[MESSENGER] 🔄 Rejoining room for complete resync...");

    // Force complete reconnection
    this.leaveRoom().then(() => {
      setTimeout(() => {
        this.setUsername(currentUsername);
        this.joinRoom(currentRoomId).then(() => {
          console.log("[MESSENGER] ✅ Force resync complete");
          // Refresh UI
          this.loadRoomMessages();
          this.updateUsersList();
        });
      }, 2000); // Wait 2 seconds before rejoining
    });
  },

  // Send a ping test message
  sendPing() {
    console.log("[MESSENGER] 📡 Sending ping test...");

    // Check for collaboration system interference
    const isCollabActive = window.collaboration?.isCollaborating;
    const collabProvider = window.collaboration?.provider;
    console.log("[MESSENGER] 📡 Collaboration status:", {
      isActive: isCollabActive,
      hasProvider: !!collabProvider,
      collabConnected: collabProvider?.connected,
    });

    if (!this.isConnected || !this.sharedMessages) {
      console.warn("[MESSENGER] ⚠️ Cannot ping - not connected");
      return;
    }

    // Send a special ping message
    const pingMessage = {
      id: Date.now() + "_PING_" + this.userId,
      content: `📡 PING from ${
        this.username
      } - ${new Date().toLocaleTimeString()}`,
      username: this.username,
      userId: this.userId,
      timestamp: Date.now(),
      roomId: this.roomId,
      isPing: true,
    };

    try {
      console.log("[MESSENGER] 📡 Broadcasting ping:", pingMessage);

      // Force direct push to shared array
      this.sharedMessages.push([pingMessage]);

      console.log(
        "[MESSENGER] 📡 Ping sent! Check other window for reception."
      );

      // Also try awareness ping
      if (this.provider?.awareness) {
        this.provider.awareness.setLocalState({
          user: this.userId,
          username: this.username,
          ping: Date.now(),
          pingMessage: `Ping from ${this.username}`,
        });
        console.log("[MESSENGER] 📡 Awareness ping sent");
      }
    } catch (error) {
      console.error("[MESSENGER] ❌ Ping failed:", error);
    }
  },

  // Toggle messenger visibility
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  },
};

// Auto-initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => messenger.init());
} else {
  messenger.init();
}

// Make messenger globally available
window.messenger = messenger;
