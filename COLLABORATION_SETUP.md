# Bike Live Collaboration Setup Guide

This guide explains how to set up and use the Y.js-based live collaboration system in Bike.

## Features

✅ **Real-time Collaboration**: Like Figma, see changes from all participants instantly  
✅ **Shareable Links**: Create public collaboration links that anyone can join  
✅ **Guest Access**: Collaborators don't need accounts - they get session-based tracking  
✅ **Message & Artifact Sync**: All messages and artifacts are shared in real-time  
✅ **Database Persistence**: Activities saved to database with user/session attribution  
✅ **Cursor Tracking**: See where other users are working  
✅ **Participant Management**: View active collaborators and their status  

## Quick Start

### 1. Database Setup (Supabase)

First, set up the collaboration tables in your Supabase database:

```sql
-- Run the SQL from database-schema.sql in your Supabase SQL editor
-- This creates tables for collaborations, activities, and participants
```

### 2. WebSocket Server Setup

Install and start the Y.js WebSocket server:

```bash
# Install dependencies
npm install

# Start the collaboration server
npm run start-collab
```

The server will run on `ws://localhost:1234` by default.

### 3. Configuration

Update your `config.js` file with your actual Supabase credentials:

```javascript
window.SUPABASE_CONFIG = {
  url: 'https://your-project.supabase.co',
  key: 'your-supabase-anon-key'
};

window.COLLABORATION_CONFIG = {
  websocketUrl: 'ws://localhost:1234', // or your deployed WebSocket server
  maxParticipants: 10,
  allowGuests: true
};
```

### 4. Start Collaborating

1. **Create a Collaboration Link**:
   - Navigate to the Collaboration view in Bike
   - Click "Create Collaboration Link"
   - Share the generated link with others

2. **Join a Collaboration**:
   - Click on a collaboration link, or
   - Use "Join Collaboration" and paste the link/ID

## Usage Guide

### For Authenticated Users

When you're logged in and create a collaboration:
- Your messages and artifacts are saved to your user account
- You appear as a named user to other participants
- You can create and manage collaboration sessions

### For Guest Users

When joining as a guest (not logged in):
- You get a unique session ID for tracking
- Your activities are saved with the session ID
- You appear as "Guest [ID]" to other participants
- No account required - just click the link and start collaborating

### Collaboration Features

**Real-time Sync**: Every message, artifact, and edit is instantly shared across all participants.

**Participant Awareness**: See who's online, their cursor positions, and recent activities.

**Session Management**: Collaborations automatically clean up after 24 hours of inactivity.

**Activity Tracking**: All actions are logged to the database for audit and recovery.

## Technical Architecture

### Y.js Integration

- **Y.Doc**: Shared document that synchronizes between all participants
- **Shared Arrays**: Messages are stored in a shared Y.Array
- **Shared Maps**: Artifacts, cursors, and user info in Y.Maps
- **Awareness**: Real-time cursor and presence tracking

### Database Schema

- **collaborations**: Main collaboration sessions
- **collaboration_activities**: All user actions and changes
- **collaboration_participants**: Real-time participant tracking
- **collaboration_documents**: Y.js document state persistence

### WebSocket Server

- Built on `y-websocket` for reliable real-time sync
- Handles room management and participant tracking
- Automatic cleanup of empty rooms
- Health check and stats endpoints

## Deployment Guide

### 1. WebSocket Server Deployment

Deploy the collaboration server to a cloud provider:

```bash
# Example for Heroku
git subtree push --prefix . heroku main

# Example for Railway
railway up

# Example for DigitalOcean App Platform
doctl apps create --spec collaboration-app.yaml
```

Update the WebSocket URL in your config:

```javascript
window.COLLABORATION_CONFIG = {
  websocketUrl: 'wss://your-collab-server.com'
};
```

### 2. Database Migration

Run the database schema SQL in your production Supabase instance.

### 3. Environment Variables

Set these environment variables in production:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
COLLABORATION_WS_URL=wss://your-collab-server.com
NODE_ENV=production
```

## Troubleshooting

### Common Issues

**WebSocket Connection Failed**:
- Check if the collaboration server is running
- Verify the WebSocket URL in config
- Check firewall/proxy settings

**Messages Not Syncing**:
- Ensure Y.js libraries are loaded
- Check browser console for errors
- Verify Supabase connection

**Guest Users Can't Join**:
- Check collaboration settings allow guests
- Verify the collaboration is still active
- Ensure proper URL parameter format

### Debug Mode

Enable debug logging by opening browser console and running:

```javascript
// Enable collaboration debug logs
localStorage.setItem('debug-collaboration', 'true');

// Check collaboration status
console.log('Collaboration Status:', {
  isCollaborating: window.collaboration.isCollaborating(),
  collaborationId: window.collaboration.getCollaborationId(),
  participants: window.collaboration.getParticipants()
});
```

### Health Checks

Check server health:

```bash
# Health check
curl http://localhost:1234/health

# Get collaboration statistics
curl http://localhost:1234/stats
```

## API Reference

### Collaboration Manager

```javascript
// Create a collaboration link
const link = await window.collaboration.createLink();

// Join a collaboration
await window.collaboration.joinCollaboration(collaborationId);

// Check if collaborating
const isActive = window.collaboration.isCollaborating();

// Get participants
const participants = window.collaboration.getParticipants();

// Leave collaboration
await window.collaboration.leaveCollaboration();

// Share a message (automatically called)
window.collaboration.shareMessage(message);

// Share an artifact (automatically called)
window.collaboration.shareArtifact(artifact);
```

### Events

Listen for collaboration events:

```javascript
// User joined
window.collaboration.on('user-joined', (user) => {
  console.log('User joined:', user);
});

// User left
window.collaboration.on('user-left', (user) => {
  console.log('User left:', user);
});

// Message received
window.collaboration.on('message-received', (message) => {
  console.log('Collaborative message:', message);
});
```

## Security Considerations

- **Row Level Security**: Database policies ensure users only access appropriate data
- **Guest Limitations**: Guest users are limited to session-based activities
- **Rate Limiting**: Consider implementing rate limits on the WebSocket server
- **CORS**: Configure proper CORS policies for your domain
- **Input Validation**: All collaborative content is validated before processing

## Performance Notes

- **Scalability**: Y.js WebSocket server can handle hundreds of concurrent users
- **Bandwidth**: Collaborative updates are efficiently compressed
- **Storage**: Old collaborations are automatically cleaned up
- **Memory**: Client-side document state is managed efficiently

## Support

For issues or questions about the collaboration system:

1. Check the browser console for error messages
2. Verify server connectivity and health
3. Review database logs for persistence issues
4. Check Y.js documentation for advanced configuration

## License

The collaboration system is built on top of Y.js (MIT License) and integrates with the existing Bike architecture.