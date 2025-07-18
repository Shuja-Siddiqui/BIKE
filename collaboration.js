// =================== Collaboration Module ===================
// This module handles live collaboration using Yjs and WebRTC
// Follows the same patterns as other modules in the codebase

// =================== Storage Keys ===================
const COLLAB_KEYS = {
  COLLAB_ID: "collaborationId",
  COLLAB_DATA: "collaborationData",
  COLLAB_PARTICIPANTS: "collaborationParticipants"
};

// =================== Collaboration State ===================
let collaborationState = {
  isActive: false,
  collaborationId: null,
  doc: null,
  provider: null,
  participants: new Map(),
  localData: {
    chats: {},
    messages: {},
    artifacts: {}
  }
};

// =================== Yjs Document Setup ===================
function createCollaborationDocument(collaborationId) {
  if (typeof Y === 'undefined') {
    console.error("[COLLAB] Yjs not loaded");
    return null;
  }

  const doc = new Y.Doc();
  const ychats = doc.getMap('chats');
  const ymessages = doc.getMap('messages');
  const yartifacts = doc.getMap('artifacts');
  const yparticipants = doc.getMap('participants');

  return {
    doc,
    ychats,
    ymessages,
    yartifacts,
    yparticipants
  };
}

// =================== WebRTC Provider Setup ===================
function createWebRTCProvider(doc, collaborationId) {
  if (typeof YWebRTC === 'undefined') {
    console.error("[COLLAB] Y-WebRTC not loaded");
    return null;
  }

  const provider = new YWebRTC.WebRTCProvider(doc, {
    room: collaborationId,
    signaling: ['wss://signaling.yjs.dev'],
    password: null,
    awareness: new YWebRTC.Awareness(doc)
  });

  return provider;
}

// =================== Collaboration Data Management ===================
function saveCollaborationData(collaborationId, data) {
  const key = `${COLLAB_KEYS.COLLAB_DATA}_${collaborationId}`;
  localStorage.setItem(key, JSON.stringify(data));
  console.log(`[COLLAB] Saved collaboration data for ${collaborationId}`);
}

function loadCollaborationData(collaborationId) {
  const key = `${COLLAB_KEYS.COLLAB_DATA}_${collaborationId}`;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : null;
}

function saveCollaborationId(collaborationId) {
  localStorage.setItem(COLLAB_KEYS.COLLAB_ID, collaborationId);
  console.log(`[COLLAB] Saved collaboration ID: ${collaborationId}`);
}

function loadCollaborationId() {
  return localStorage.getItem(COLLAB_KEYS.COLLAB_ID);
}

function clearCollaborationData(collaborationId) {
  const key = `${COLLAB_KEYS.COLLAB_DATA}_${collaborationId}`;
  localStorage.removeItem(key);
  localStorage.removeItem(COLLAB_KEYS.COLLAB_ID);
  console.log(`[COLLAB] Cleared collaboration data for ${collaborationId}`);
}

// =================== Data Synchronization ===================
function syncLocalDataToYjs() {
  if (!collaborationState.doc || !collaborationState.isActive) return;

  const { ychats, ymessages, yartifacts } = collaborationState.doc;
  
  // Sync chats
  const currentChats = window.context?.getChats() || [];
  currentChats.forEach(chat => {
    ychats.set(chat.id, chat);
  });

  // Sync messages
  const currentMessages = window.context?.getMessagesByChat() || {};
  Object.keys(currentMessages).forEach(chatId => {
    ymessages.set(chatId, currentMessages[chatId]);
  });

  // Sync artifacts
  const currentArtifacts = window.context?.getArtifacts() || [];
  currentArtifacts.forEach(artifact => {
    yartifacts.set(artifact.id, artifact);
  });

  console.log("[COLLAB] Synced local data to Yjs");
}

function syncYjsDataToLocal() {
  if (!collaborationState.doc || !collaborationState.isActive) return;

  const { ychats, ymessages, yartifacts } = collaborationState.doc;
  
  // Sync chats
  const chats = Array.from(ychats.values());
  if (chats.length > 0) {
    window.context?.setState({ chats });
  }

  // Sync messages
  const messagesByChat = {};
  ymessages.forEach((messages, chatId) => {
    messagesByChat[chatId] = messages;
  });
  if (Object.keys(messagesByChat).length > 0) {
    window.context?.setState({ messagesByChat });
  }

  // Sync artifacts
  const artifacts = Array.from(yartifacts.values());
  if (artifacts.length > 0) {
    window.context?.setState({ artifacts });
  }

  // Save to localStorage using existing memory module
  if (window.memory?.saveAll) {
    window.memory.saveAll(true); // Force immediate save
  }

  console.log("[COLLAB] Synced Yjs data to local");
}

// =================== Collaboration Session Management ===================
async function startCollaboration(collaborationId) {
  if (collaborationState.isActive) {
    console.warn("[COLLAB] Collaboration already active");
    return false;
  }

  try {
    // Create Yjs document
    const yjsData = createCollaborationDocument(collaborationId);
    if (!yjsData) return false;

    // Create WebRTC provider
    const provider = createWebRTCProvider(yjsData.doc, collaborationId);
    if (!provider) return false;

    // Set up collaboration state
    collaborationState = {
      isActive: true,
      collaborationId,
      doc: yjsData,
      provider,
      participants: new Map(),
      localData: {
        chats: {},
        messages: {},
        artifacts: {}
      }
    };

    // Save collaboration ID
    saveCollaborationId(collaborationId);

    // Set up event listeners
    setupCollaborationEventListeners();

    // Initial sync
    syncLocalDataToYjs();

    console.log(`[COLLAB] Started collaboration session: ${collaborationId}`);
    return true;
  } catch (error) {
    console.error("[COLLAB] Failed to start collaboration:", error);
    return false;
  }
}

function stopCollaboration() {
  if (!collaborationState.isActive) return;

  try {
    // Clean up provider
    if (collaborationState.provider) {
      collaborationState.provider.destroy();
    }

    // Clean up document
    if (collaborationState.doc) {
      collaborationState.doc.doc.destroy();
    }

    // Reset state
    collaborationState = {
      isActive: false,
      collaborationId: null,
      doc: null,
      provider: null,
      participants: new Map(),
      localData: {
        chats: {},
        messages: {},
        artifacts: {}
      }
    };

    // Clear collaboration ID
    localStorage.removeItem(COLLAB_KEYS.COLLAB_ID);

    console.log("[COLLAB] Stopped collaboration session");
  } catch (error) {
    console.error("[COLLAB] Error stopping collaboration:", error);
  }
}

// =================== Event Listeners ===================
function setupCollaborationEventListeners() {
  if (!collaborationState.doc || !collaborationState.provider) return;

  const { doc, ychats, ymessages, yartifacts, yparticipants } = collaborationState.doc;

  // Listen for data changes
  ychats.observe(event => {
    console.log("[COLLAB] Chats updated:", event);
    syncYjsDataToLocal();
  });

  ymessages.observe(event => {
    console.log("[COLLAB] Messages updated:", event);
    syncYjsDataToLocal();
  });

  yartifacts.observe(event => {
    console.log("[COLLAB] Artifacts updated:", event);
    syncYjsDataToLocal();
  });

  // Listen for participant changes
  yparticipants.observe(event => {
    console.log("[COLLAB] Participants updated:", event);
    updateParticipantsList();
  });

  // Listen for provider events
  collaborationState.provider.on('sync', isSynced => {
    console.log("[COLLAB] Sync status:", isSynced);
  });

  collaborationState.provider.on('connection-error', error => {
    console.error("[COLLAB] Connection error:", error);
  });
}

function updateParticipantsList() {
  if (!collaborationState.doc) return;

  const { yparticipants } = collaborationState.doc;
  collaborationState.participants.clear();
  
  yparticipants.forEach((participant, id) => {
    collaborationState.participants.set(id, participant);
  });

  console.log(`[COLLAB] Updated participants: ${collaborationState.participants.size} total`);
}

// =================== URL Management ===================
function generateCollaborationLink(collaborationId) {
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#/collab-${collaborationId}`;
}

function extractCollaborationIdFromUrl() {
  const hash = window.location.hash;
  const match = hash.match(/#\/collab-([a-zA-Z0-9-]+)/);
  return match ? match[1] : null;
}

// =================== Public API ===================
const collaboration = {
  // Initialize collaboration module
  init: function() {
    console.log("[COLLAB] Initializing collaboration module");
    
    // Check if we should join a collaboration from URL
    const collaborationId = extractCollaborationIdFromUrl();
    if (collaborationId) {
      this.joinCollaboration(collaborationId);
    }
  },

  // Create a new collaboration session
  createCollaboration: async function() {
    const collaborationId = 'collab-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    const success = await startCollaboration(collaborationId);
    
    if (success) {
      const link = generateCollaborationLink(collaborationId);
      return {
        success: true,
        collaborationId,
        link,
        message: `Collaboration session created! Share this link: ${link}`
      };
    } else {
      return {
        success: false,
        error: "Failed to create collaboration session"
      };
    }
  },

  // Join an existing collaboration session
  joinCollaboration: async function(collaborationId) {
    if (!collaborationId) {
      return {
        success: false,
        error: "No collaboration ID provided"
      };
    }

    const success = await startCollaboration(collaborationId);
    
    if (success) {
      return {
        success: true,
        collaborationId,
        message: `Joined collaboration session: ${collaborationId}`
      };
    } else {
      return {
        success: false,
        error: "Failed to join collaboration session"
      };
    }
  },

  // Leave current collaboration session
  leaveCollaboration: function() {
    stopCollaboration();
    return {
      success: true,
      message: "Left collaboration session"
    };
  },

  // Get current collaboration status
  getStatus: function() {
    return {
      isActive: collaborationState.isActive,
      collaborationId: collaborationState.collaborationId,
      participants: Array.from(collaborationState.participants.values()),
      participantCount: collaborationState.participants.size
    };
  },

  // Generate shareable link for current collaboration
  getShareableLink: function() {
    if (!collaborationState.isActive || !collaborationState.collaborationId) {
      return null;
    }
    return generateCollaborationLink(collaborationState.collaborationId);
  },

  // Save collaboration data to localStorage (following existing patterns)
  saveCollaborationData: function() {
    if (!collaborationState.isActive || !collaborationState.collaborationId) return;

    const data = {
      chats: window.context?.getChats() || [],
      messages: window.context?.getMessagesByChat() || {},
      artifacts: window.context?.getArtifacts() || [],
      timestamp: new Date().toISOString()
    };

    saveCollaborationData(collaborationState.collaborationId, data);
    
    // Also trigger the existing memory save to ensure data is persisted
    if (window.memory?.saveAll) {
      window.memory.saveAll(true); // Force immediate save
    }
  },

  // Load collaboration data from localStorage
  loadCollaborationData: function(collaborationId) {
    return loadCollaborationData(collaborationId);
  }
};

// Expose collaboration module globally
window.collaboration = collaboration;

// Set up page unload handler to save collaboration data
window.addEventListener("beforeunload", () => {
  if (collaborationState.isActive) {
    collaboration.saveCollaborationData();
  }
});

console.log("[COLLAB] Collaboration module loaded");