# Collaboration Feature

This document describes the live collaboration functionality added to the Bike application using Yjs and WebRTC.

## Overview

The collaboration feature allows multiple users to work together in real-time on the same session. All data (chats, messages, artifacts) is synchronized between participants using Yjs and WebRTC.

## How It Works

1. **Create Collaboration**: A user creates a collaboration session and gets a shareable link
2. **Join Collaboration**: Other users can join using the shared link
3. **Real-time Sync**: All changes are synchronized in real-time between participants
4. **Local Storage**: Collaboration data is saved locally following the existing patterns

## Usage

### Creating a Collaboration Session

Users can create a collaboration session by:
- Asking the AI: "create collab link" or "create collaboration link"
- The system will generate a unique collaboration ID and shareable link
- The collaboration ID is saved in localStorage following existing patterns

### Joining a Collaboration Session

Users can join an existing session by:
- Opening the shareable link (e.g., `/#/collab-<id>`)
- The system automatically detects the collaboration ID from the URL and joins the session

### Collaboration Actions

The following actions are available:

- `collaboration.create` - Create a new collaboration session
- `collaboration.join` - Join an existing collaboration session
- `collaboration.leave` - Leave the current collaboration session
- `collaboration.status` - Get the current collaboration status

## Technical Implementation

### Dependencies

- **Yjs**: Core collaboration framework
- **Y-WebRTC**: WebRTC provider for peer-to-peer communication
- Loaded via CDN (no package.json required)

### Data Synchronization

- **Chats**: Synchronized using Yjs Map
- **Messages**: Synchronized using Yjs Map
- **Artifacts**: Synchronized using Yjs Map
- **Participants**: Tracked using Yjs Map

### Storage Integration

- Collaboration data is saved to localStorage using the same patterns as existing data
- Collaboration IDs are stored with the key `collaborationId`
- Collaboration data is stored with keys like `collaborationData_<id>`
- Integrates with existing memory module for data persistence

### URL Structure

Collaboration links follow the pattern:
```
https://your-domain.com/#/collab-<collaboration-id>
```

Example:
```
https://bike-app.com/#/collab-collab-1703123456789-abc123def
```

## Files Modified

1. **index.html**: Added Yjs CDN scripts and collaboration module initialization
2. **collaboration.js**: New collaboration module (created)
3. **actions.js**: Added collaboration actions to the registry
4. **test-collaboration.html**: Test file for collaboration functionality (created)

## Testing

Use the test file `test-collaboration.html` to verify collaboration functionality:

1. Open the test file in a browser
2. Click "Create Collaboration" to start a session
3. Copy the generated link
4. Open the link in another browser/tab to test joining
5. Use the other buttons to test various collaboration functions

## Integration with Existing System

The collaboration feature is designed to:
- Follow existing coding patterns and architecture
- Use the same localStorage structure as other data
- Integrate with the existing memory module
- Work with the existing action system
- Preserve all existing functionality

## Limitations

- Requires WebRTC support in browsers
- Peer-to-peer connections may not work in all network environments
- No server-side persistence (data is only stored locally)
- Maximum collaboration size depends on WebRTC limitations

## Future Enhancements

- Add server-side persistence for collaboration data
- Implement collaboration permissions and roles
- Add collaboration history and audit trails
- Support for larger collaboration groups
- Better error handling and reconnection logic