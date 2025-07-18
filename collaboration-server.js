// =================== Y.js WebSocket Server ===================
// Node.js server for handling Y.js real-time collaboration

const WebSocket = require('ws');
const http = require('http');
const { setupWSConnection } = require('y-websocket/bin/utils');

const PORT = process.env.PORT || 1234;
const HOST = process.env.HOST || 'localhost';

// Create HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Y.js WebSocket Server is running');
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active collaborations
const activeCollaborations = new Map();

wss.on('connection', (ws, req) => {
  console.log('[COLLAB-SERVER] New WebSocket connection');
  
  // Set up Y.js WebSocket connection
  setupWSConnection(ws, req, {
    // Optional: Add authentication and room management here
    docName: req.url?.slice(1) || 'default', // Use URL path as document name
    gc: true // Enable garbage collection
  });

  // Track collaboration rooms
  const docName = req.url?.slice(1) || 'default';
  if (!activeCollaborations.has(docName)) {
    activeCollaborations.set(docName, {
      participants: new Set(),
      createdAt: new Date(),
      lastActivity: new Date()
    });
  }

  const collaboration = activeCollaborations.get(docName);
  collaboration.participants.add(ws);
  collaboration.lastActivity = new Date();

  console.log(`[COLLAB-SERVER] Client joined room: ${docName}, participants: ${collaboration.participants.size}`);

  // Handle disconnection
  ws.on('close', () => {
    console.log('[COLLAB-SERVER] Client disconnected');
    if (collaboration) {
      collaboration.participants.delete(ws);
      collaboration.lastActivity = new Date();
      
      if (collaboration.participants.size === 0) {
        console.log(`[COLLAB-SERVER] Room ${docName} is now empty`);
        // Optionally clean up empty rooms after a timeout
        setTimeout(() => {
          if (collaboration.participants.size === 0) {
            activeCollaborations.delete(docName);
            console.log(`[COLLAB-SERVER] Cleaned up empty room: ${docName}`);
          }
        }, 60000); // Clean up after 1 minute of inactivity
      }
    }
  });

  ws.on('error', (error) => {
    console.error('[COLLAB-SERVER] WebSocket error:', error);
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('[COLLAB-SERVER] Shutting down gracefully...');
  wss.close(() => {
    server.close(() => {
      console.log('[COLLAB-SERVER] Server closed');
      process.exit(0);
    });
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[COLLAB-SERVER] Y.js WebSocket server running on ws://${HOST}:${PORT}`);
  console.log(`[COLLAB-SERVER] Active collaborations will be tracked`);
});

// Health check endpoint
server.on('request', (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      activeCollaborations: activeCollaborations.size,
      uptime: process.uptime()
    }));
  } else if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const stats = {};
    activeCollaborations.forEach((collab, name) => {
      stats[name] = {
        participants: collab.participants.size,
        createdAt: collab.createdAt,
        lastActivity: collab.lastActivity
      };
    });
    res.end(JSON.stringify(stats));
  }
});

module.exports = { server, wss, activeCollaborations };