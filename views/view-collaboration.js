// =================== Collaboration View ===================
// UI component for managing collaborative sessions

const CollaborationView = {
  id: 'collaboration',
  name: 'Collaboration',
  type: 'collaboration',
  
  async render(container) {
    const isCollaborating = window.collaboration?.isCollaborating();
    const collaborationId = window.collaboration?.getCollaborationId();
    const participants = window.collaboration?.getParticipants() || [];
    
    container.innerHTML = `
      <div class="collaboration-view">
        <div class="collaboration-header">
          <h2>Live Collaboration</h2>
          <p>Share your workspace in real-time with others</p>
        </div>
        
        ${await this.renderCollaborationStatus(isCollaborating, collaborationId, participants)}
        
        <div class="collaboration-actions">
          ${await this.renderCollaborationActions(isCollaborating)}
        </div>
        
        <div class="collaboration-participants">
          ${await this.renderParticipants(participants)}
        </div>
        
        <div class="collaboration-activities">
          ${await this.renderRecentActivities(collaborationId)}
        </div>
        
        <div class="collaboration-help">
          ${this.renderHelpSection()}
        </div>
      </div>
    `;
    
    this.setupEventListeners(container);
  },

  async renderCollaborationStatus(isCollaborating, collaborationId, participants) {
    if (!isCollaborating) {
      return `
        <div class="collaboration-status inactive">
          <div class="status-indicator offline"></div>
          <div class="status-text">
            <h3>Not Collaborating</h3>
            <p>Create a collaboration link to start sharing your workspace</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="collaboration-status active">
        <div class="status-indicator online"></div>
        <div class="status-text">
          <h3>Collaboration Active</h3>
          <p>Session ID: ${collaborationId}</p>
          <p>${participants.length} participant${participants.length !== 1 ? 's' : ''} connected</p>
        </div>
        <div class="collaboration-link-display">
          <input type="text" value="${window.location.origin}${window.location.pathname}?collab=${collaborationId}" readonly class="collab-link-input">
          <button class="copy-link-btn" data-link="${window.location.origin}${window.location.pathname}?collab=${collaborationId}">
            Copy Link
          </button>
        </div>
      </div>
    `;
  },

  async renderCollaborationActions(isCollaborating) {
    if (!isCollaborating) {
      return `
        <div class="action-buttons">
          <button class="btn primary create-collab-btn">
            <span class="btn-icon">🔗</span>
            Create Collaboration Link
          </button>
          <button class="btn secondary join-collab-btn">
            <span class="btn-icon">👥</span>
            Join Collaboration
          </button>
        </div>
      `;
    }

    return `
      <div class="action-buttons">
        <button class="btn secondary share-collab-btn">
          <span class="btn-icon">📤</span>
          Share Link
        </button>
        <button class="btn secondary manage-participants-btn">
          <span class="btn-icon">⚙️</span>
          Manage Participants
        </button>
        <button class="btn danger leave-collab-btn">
          <span class="btn-icon">🚪</span>
          Leave Collaboration
        </button>
      </div>
    `;
  },

  async renderParticipants(participants) {
    if (participants.length === 0) {
      return `
        <div class="participants-section">
          <h3>Participants</h3>
          <p class="no-participants">No active participants</p>
        </div>
      `;
    }

    const participantsList = participants.map(participant => `
      <div class="participant-item" data-participant-id="${participant.id}">
        <div class="participant-avatar" style="background-color: ${participant.color}">
          ${participant.name.charAt(0).toUpperCase()}
        </div>
        <div class="participant-info">
          <div class="participant-name">${participant.name}</div>
          <div class="participant-type">${participant.type === 'guest' ? 'Guest' : 'User'}</div>
        </div>
        <div class="participant-status online"></div>
      </div>
    `).join('');

    return `
      <div class="participants-section">
        <h3>Participants (${participants.length})</h3>
        <div class="participants-list" id="collaboration-participants">
          ${participantsList}
        </div>
      </div>
    `;
  },

  async renderRecentActivities(collaborationId) {
    if (!collaborationId) {
      return `
        <div class="activities-section">
          <h3>Recent Activities</h3>
          <p class="no-activities">No activities yet</p>
        </div>
      `;
    }

    try {
      const activities = await this.getRecentActivities(collaborationId);
      
      if (activities.length === 0) {
        return `
          <div class="activities-section">
            <h3>Recent Activities</h3>
            <p class="no-activities">No activities yet</p>
          </div>
        `;
      }

      const activitiesList = activities.slice(0, 10).map(activity => `
        <div class="activity-item" data-activity-type="${activity.activity_type}">
          <div class="activity-icon">${this.getActivityIcon(activity.activity_type)}</div>
          <div class="activity-content">
            <div class="activity-description">${this.getActivityDescription(activity)}</div>
            <div class="activity-time">${this.formatTime(activity.timestamp)}</div>
          </div>
        </div>
      `).join('');

      return `
        <div class="activities-section">
          <h3>Recent Activities</h3>
          <div class="activities-list">
            ${activitiesList}
          </div>
        </div>
      `;
    } catch (error) {
      console.error('[COLLAB-VIEW] Failed to load activities:', error);
      return `
        <div class="activities-section">
          <h3>Recent Activities</h3>
          <p class="error">Failed to load activities</p>
        </div>
      `;
    }
  },

  renderHelpSection() {
    return `
      <div class="help-section">
        <h3>How Collaboration Works</h3>
        <div class="help-content">
          <div class="help-item">
            <h4>🔗 Create Link</h4>
            <p>Generate a shareable link that others can use to join your session</p>
          </div>
          <div class="help-item">
            <h4>👥 Real-time Sync</h4>
            <p>See changes from all participants instantly, just like Figma</p>
          </div>
          <div class="help-item">
            <h4>💬 Messages & Artifacts</h4>
            <p>All messages and artifacts are saved to your account or session</p>
          </div>
          <div class="help-item">
            <h4>🎯 Guest Access</h4>
            <p>Guests can collaborate without signing up, using session-based tracking</p>
          </div>
        </div>
      </div>
    `;
  },

  setupEventListeners(container) {
    // Create collaboration link
    const createBtn = container.querySelector('.create-collab-btn');
    if (createBtn) {
      createBtn.addEventListener('click', async () => {
        try {
          createBtn.disabled = true;
          createBtn.textContent = 'Creating...';
          
          const link = await window.collaboration.createLink();
          this.showSuccessMessage(`Collaboration link created: ${link}`);
          this.refresh();
        } catch (error) {
          console.error('[COLLAB-VIEW] Failed to create collaboration:', error);
          this.showErrorMessage(error.message);
        } finally {
          createBtn.disabled = false;
          createBtn.innerHTML = '<span class="btn-icon">🔗</span>Create Collaboration Link';
        }
      });
    }

    // Join collaboration
    const joinBtn = container.querySelector('.join-collab-btn');
    if (joinBtn) {
      joinBtn.addEventListener('click', () => {
        this.showJoinDialog();
      });
    }

    // Copy link
    const copyBtn = container.querySelector('.copy-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const link = copyBtn.dataset.link;
        navigator.clipboard.writeText(link).then(() => {
          this.showSuccessMessage('Link copied to clipboard!');
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.textContent = 'Copy Link';
          }, 2000);
        });
      });
    }

    // Share collaboration
    const shareBtn = container.querySelector('.share-collab-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.showShareDialog();
      });
    }

    // Leave collaboration
    const leaveBtn = container.querySelector('.leave-collab-btn');
    if (leaveBtn) {
      leaveBtn.addEventListener('click', async () => {
        if (confirm('Are you sure you want to leave this collaboration?')) {
          try {
            await window.collaboration.leaveCollaboration();
            this.showSuccessMessage('Left collaboration');
            this.refresh();
          } catch (error) {
            console.error('[COLLAB-VIEW] Failed to leave collaboration:', error);
            this.showErrorMessage('Failed to leave collaboration');
          }
        }
      });
    }
  },

  showJoinDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'collab-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Join Collaboration</h3>
        <p>Enter a collaboration link or ID:</p>
        <input type="text" class="collab-id-input" placeholder="Paste collaboration link here...">
        <div class="dialog-actions">
          <button class="btn secondary cancel-btn">Cancel</button>
          <button class="btn primary join-btn">Join</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const cancelBtn = dialog.querySelector('.cancel-btn');
    const joinBtn = dialog.querySelector('.join-btn');
    const input = dialog.querySelector('.collab-id-input');

    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    joinBtn.addEventListener('click', async () => {
      const value = input.value.trim();
      if (!value) return;

      try {
        joinBtn.disabled = true;
        joinBtn.textContent = 'Joining...';

        // Extract collaboration ID from URL or use as-is
        const collaborationId = value.includes('?collab=') 
          ? new URL(value).searchParams.get('collab')
          : value;

        await window.collaboration.joinCollaboration(collaborationId);
        this.showSuccessMessage('Joined collaboration successfully!');
        document.body.removeChild(dialog);
        this.refresh();
      } catch (error) {
        console.error('[COLLAB-VIEW] Failed to join collaboration:', error);
        this.showErrorMessage(error.message);
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join';
      }
    });

    input.focus();
  },

  showShareDialog() {
    const collaborationId = window.collaboration?.getCollaborationId();
    if (!collaborationId) return;

    const link = `${window.location.origin}${window.location.pathname}?collab=${collaborationId}`;
    
    const dialog = document.createElement('div');
    dialog.className = 'collab-dialog';
    dialog.innerHTML = `
      <div class="dialog-content">
        <h3>Share Collaboration</h3>
        <p>Share this link with others to invite them to collaborate:</p>
        <div class="share-link-container">
          <input type="text" value="${link}" readonly class="share-link-input">
          <button class="btn primary copy-share-btn">Copy</button>
        </div>
        <div class="share-options">
          <button class="btn secondary email-share-btn">Share via Email</button>
          <button class="btn secondary qr-share-btn">Show QR Code</button>
        </div>
        <div class="dialog-actions">
          <button class="btn secondary close-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const closeBtn = dialog.querySelector('.close-btn');
    const copyBtn = dialog.querySelector('.copy-share-btn');
    const emailBtn = dialog.querySelector('.email-share-btn');

    closeBtn.addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(link);
      this.showSuccessMessage('Link copied!');
    });

    emailBtn.addEventListener('click', () => {
      const subject = 'Join my Bike collaboration session';
      const body = `Hi! I'd like to invite you to collaborate on my Bike workspace. Click this link to join: ${link}`;
      window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
    });
  },

  async getRecentActivities(collaborationId) {
    try {
      if (!window.supabase) {
        // Fallback to local storage
        const localActivities = window.collaboration.getLocalActivities();
        return localActivities[collaborationId] || [];
      }

      const { data, error } = await window.supabase
        .from('collaboration_activities')
        .select('*')
        .eq('collaboration_id', collaborationId)
        .order('timestamp', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[COLLAB-VIEW] Failed to fetch activities:', error);
      return [];
    }
  },

  getActivityIcon(type) {
    const icons = {
      'message': '💬',
      'artifact': '📄',
      'join': '👋',
      'leave': '👋',
      'edit': '✏️',
      'cursor': '🖱️'
    };
    return icons[type] || '📝';
  },

  getActivityDescription(activity) {
    const authorName = activity.user_id ? 'User' : `Guest ${activity.session_id?.slice(0, 6)}`;
    
    switch (activity.activity_type) {
      case 'message':
        return `${authorName} sent a message`;
      case 'artifact':
        return `${authorName} ${activity.activity_data.action || 'modified'} an artifact`;
      case 'join':
        return `${authorName} joined the collaboration`;
      case 'leave':
        return `${authorName} left the collaboration`;
      case 'edit':
        return `${authorName} made an edit`;
      default:
        return `${authorName} performed an action`;
    }
  },

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)} minutes ago`;
    } else if (diff < 86400000) { // Less than 1 day
      return `${Math.floor(diff / 3600000)} hours ago`;
    } else {
      return date.toLocaleDateString();
    }
  },

  showSuccessMessage(message) {
    this.showMessage(message, 'success');
  },

  showErrorMessage(message) {
    this.showMessage(message, 'error');
  },

  showMessage(message, type) {
    const messageEl = document.createElement('div');
    messageEl.className = `collab-message ${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    setTimeout(() => {
      messageEl.classList.add('fade-out');
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.parentNode.removeChild(messageEl);
        }
      }, 300);
    }, 3000);
  },

  async refresh() {
    // Re-render the current view
    const container = document.querySelector('.view[data-view="collaboration"]');
    if (container) {
      await this.render(container);
    }
  },

  // Integration with existing view system
  getViewElement() {
    const container = document.createElement('div');
    container.className = 'view';
    container.setAttribute('data-view', 'collaboration');
    return container;
  }
};

// Register with the views system
if (window.views) {
  window.views.register(CollaborationView);
}

// Export for use in other modules
window.CollaborationView = CollaborationView;