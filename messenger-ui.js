// =================== Messenger UI Components ===================
// UI creation and management for the messenger system

// Extend messenger object with UI methods
Object.assign(window.messenger || {}, {
  // Setup the messenger UI
  setupUI() {
    this.createMessengerHTML();
    this.attachEventListeners();
    this.hide(); // Start hidden
  },

  // Create the messenger HTML structure
  createMessengerHTML() {
    // Create main messenger container
    const messengerHTML = `
      <div id="messenger-container" class="messenger-container">
        <div class="messenger-header">
          <div class="messenger-title">
            <span class="messenger-icon">💬</span>
            <span class="messenger-room-name">Chat Room</span>
          </div>
          <div class="messenger-controls">
            <div class="messenger-status" id="messenger-status">Disconnected</div>
            <button class="messenger-debug-btn" id="messenger-debug" style="background: #ff6b6b; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">🧪 DEBUG</button>
            <button class="messenger-resync-btn" id="messenger-resync" style="background: #4ecdc4; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">🔄 RESYNC</button>
            <button class="messenger-ping-btn" id="messenger-ping" style="background: #f39c12; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-right: 8px;">📡 PING</button>
            <button class="messenger-close-btn" id="messenger-close">×</button>
          </div>
        </div>
        
        <div class="messenger-body">
          <div class="messenger-sidebar">
            <div class="messenger-user-info">
              <div class="user-avatar">👤</div>
              <input 
                type="text" 
                id="messenger-username" 
                class="username-input" 
                placeholder="Your name..."
                maxlength="20"
              />
            </div>
            
            <div class="messenger-room-controls">
              <input 
                type="text" 
                id="messenger-room-input" 
                class="room-input" 
                placeholder="Room ID..."
                maxlength="20"
              />
              <button id="messenger-join-btn" class="join-btn">Join</button>
              <button id="messenger-leave-btn" class="leave-btn">Leave</button>
            </div>
            
            <div class="messenger-users">
              <h4>Online Users (<span id="users-count">0</span>)</h4>
              <div id="messenger-users-list" class="users-list"></div>
            </div>
          </div>
          
          <div class="messenger-chat">
            <div id="messenger-messages" class="messages-container"></div>
            
            <div class="messenger-input-area">
              <input 
                type="text" 
                id="messenger-message-input" 
                class="message-input" 
                placeholder="Type a message..."
                maxlength="500"
              />
              <button id="messenger-send-btn" class="send-btn">Send</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add to page
    document.body.insertAdjacentHTML("beforeend", messengerHTML);

    // Store references
    this.messengerContainer = document.getElementById("messenger-container");
    this.messagesContainer = document.getElementById("messenger-messages");
    this.messageInput = document.getElementById("messenger-message-input");
    this.usersList = document.getElementById("messenger-users-list");
    this.connectionStatus = document.getElementById("messenger-status");
    this.usernameInput = document.getElementById("messenger-username");
    this.roomInput = document.getElementById("messenger-room-input");

    // Set initial username
    if (this.usernameInput && this.username) {
      this.usernameInput.value = this.username;
    }
  },

  // Attach event listeners
  attachEventListeners() {
    // Close button
    const closeBtn = document.getElementById("messenger-close");
    closeBtn?.addEventListener("click", () => this.hide());

    // Debug button
    const debugBtn = document.getElementById("messenger-debug");
    debugBtn?.addEventListener("click", () => this.debugSendTest());

    // Resync button
    const resyncBtn = document.getElementById("messenger-resync");
    resyncBtn?.addEventListener("click", () => this.forceResync());

    // Ping button
    const pingBtn = document.getElementById("messenger-ping");
    pingBtn?.addEventListener("click", () => this.sendPing());

    // Send message
    const sendBtn = document.getElementById("messenger-send-btn");
    sendBtn?.addEventListener("click", () => this.handleSendMessage());

    // Enter key in message input
    this.messageInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleSendMessage();
      }
    });

    // Username change
    this.usernameInput?.addEventListener("change", (e) => {
      this.setUsername(e.target.value);
    });

    // Join room
    const joinBtn = document.getElementById("messenger-join-btn");
    joinBtn?.addEventListener("click", () => this.handleJoinRoom());

    // Leave room
    const leaveBtn = document.getElementById("messenger-leave-btn");
    leaveBtn?.addEventListener("click", () => this.leaveRoom());

    // Enter key in room input
    this.roomInput?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleJoinRoom();
      }
    });

    // Escape key to close
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && this.isVisible) {
        this.hide();
      }
    });
  },

  // Handle send message button click
  handleSendMessage() {
    const content = this.messageInput?.value?.trim();
    if (content) {
      this.sendMessage(content);
      this.messageInput.value = "";
    }
  },

  // Handle join room button click
  handleJoinRoom() {
    const roomId = this.roomInput?.value?.trim();
    if (roomId) {
      this.joinRoom(roomId);
    }
  },

  // Render a message in the UI
  renderMessage(message) {
    if (!this.messagesContainer || !message) return;

    const isOwnMessage = message.userId === this.userId;
    const messageTime = new Date(message.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const messageHTML = `
      <div class="message ${
        isOwnMessage ? "own-message" : "other-message"
      }" data-message-id="${message.id}">
        <div class="message-header">
          <span class="message-username">${this.escapeHtml(
            message.username
          )}</span>
          <span class="message-time">${messageTime}</span>
        </div>
        <div class="message-content">${this.escapeHtml(message.content)}</div>
      </div>
    `;

    this.messagesContainer.insertAdjacentHTML("beforeend", messageHTML);
  },

  // Clear all messages from UI
  clearMessages() {
    if (this.messagesContainer) {
      this.messagesContainer.innerHTML = "";
    }
  },

  // Scroll to bottom of messages
  scrollToBottom() {
    if (this.messagesContainer) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  },

  // Update connection status
  updateConnectionStatus(status) {
    if (this.connectionStatus) {
      this.connectionStatus.textContent = status;
      this.connectionStatus.className =
        "messenger-status " +
        (status.includes("Connected") ? "connected" : "disconnected");
    }

    // Update room name in header
    const roomNameEl = document.querySelector(".messenger-room-name");
    if (roomNameEl) {
      roomNameEl.textContent = this.isConnected
        ? `Chat Room: ${this.roomId}`
        : "Chat Room";
    }
  },

  // Update users list
  updateUsersList() {
    if (!this.usersList) return;

    this.usersList.innerHTML = "";

    const usersArray = Array.from(this.onlineUsers);
    const usersCount = document.getElementById("users-count");
    if (usersCount) {
      usersCount.textContent = usersArray.length.toString();
    }

    usersArray.forEach((user) => {
      const userHTML = `
        <div class="user-item ${user.id === this.userId ? "current-user" : ""}">
          <span class="user-avatar">👤</span>
          <span class="user-name">${this.escapeHtml(user.username)}</span>
          ${
            user.id === this.userId ? '<span class="user-tag">(You)</span>' : ""
          }
        </div>
      `;
      this.usersList.insertAdjacentHTML("beforeend", userHTML);
    });
  },

  // Escape HTML to prevent XSS
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  },
});
