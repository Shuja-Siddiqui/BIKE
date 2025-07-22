const http = require("http");
const crypto = require("crypto");

class MessengerSignalingServer {
  constructor() {
    this.clients = new Map();
    this.rooms = new Map();
    this.server = null;
  }

  start(port = 4445) {
    this.server = http.createServer();

    this.server.on("upgrade", (req, socket, head) => {
      this.handleWebSocketUpgrade(req, socket);
    });

    this.server.listen(port, () => {
      console.log(
        `[MESSENGER-SIGNALING] Server listening on ws://localhost:${port}`
      );
    });
  }

  handleWebSocketUpgrade(req, socket) {
    const key = req.headers["sec-websocket-key"];
    if (!key) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.end();
      return;
    }

    // Generate accept key
    const acceptKey = crypto
      .createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");

    // Send upgrade response
    const responseHeaders = [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${acceptKey}`,
      "",
      "",
    ].join("\r\n");

    socket.write(responseHeaders);

    // Handle the WebSocket connection
    const clientId = Math.random().toString(36).substr(2, 9);
    console.log(`[MESSENGER-SIGNALING] Client connected: ${clientId}`);

    this.clients.set(socket, { room: null, id: clientId });

    // Handle incoming data
    socket.on("data", (data) => {
      try {
        const message = this.parseWebSocketFrame(socket, data);
        if (message) {
          const parsed = JSON.parse(message);
          console.log(
            `[MESSENGER-SIGNALING] ${clientId} -> ${JSON.stringify(parsed)}`
          );
          this.handleMessage(socket, parsed);
        }
      } catch (error) {
        console.error(`[MESSENGER-SIGNALING] Error parsing message:`, error);
      }
    });

    socket.on("close", () => {
      console.log(`[MESSENGER-SIGNALING] Client disconnected: ${clientId}`);
      this.removeClient(socket);
    });
  }

  parseWebSocketFrame(socket, buffer) {
    if (buffer.length < 2) return null;

    const firstByte = buffer[0];
    const secondByte = buffer[1];

    const opCode = firstByte & 0x0f;
    if (opCode === 0x8) {
      socket.end();
      return null;
    }

    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      payloadLength = buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      payloadLength = buffer.readBigUInt64BE(2);
      offset = 10;
    }

    if (masked) {
      const maskingKey = buffer.slice(offset, offset + 4);
      offset += 4;
      const payload = buffer.slice(offset, offset + Number(payloadLength));

      for (let i = 0; i < payload.length; i++) {
        payload[i] ^= maskingKey[i % 4];
      }

      return payload.toString();
    } else {
      return buffer.slice(offset, offset + Number(payloadLength)).toString();
    }
  }

  handleMessage(ws, data) {
    const client = this.clients.get(ws);
    if (!client) return;

    console.log(
      `[MESSENGER-SIGNALING] ${client.id} -> ${JSON.stringify(data)}`
    );

    // Handle Yjs protocol messages
    if (data.type === "join" || data.type === "room") {
      this.joinRoom(ws, data.room);
    } else if (data.type === "subscribe" && data.topics) {
      console.log(
        `[MESSENGER-SIGNALING] Client ${client.id} subscribing to topics:`,
        data.topics
      );
      if (data.topics.length > 0) {
        this.joinRoom(ws, data.topics[0]);
      }
    } else if (data.type === "leave") {
      this.leaveRoom(ws);
    } else if (data.type === "ping") {
      this.send(ws, { type: "pong" });
    } else {
      // Broadcast all other messages to room (WebRTC signaling)
      console.log(
        `[MESSENGER-SIGNALING] Broadcasting ${data.type} to room ${client.room}`
      );
      this.broadcastToRoom(ws, data);
    }
  }

  joinRoom(ws, room) {
    const client = this.clients.get(ws);
    if (!client) return;

    console.log(
      `[MESSENGER-SIGNALING] Client ${client.id} joining room: ${room}`
    );

    // Leave previous room
    this.leaveRoom(ws);

    // Join new room
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(ws);
    client.room = room;

    console.log(
      `[MESSENGER-SIGNALING] Room ${room} has ${
        this.rooms.get(room).size
      } clients`
    );
  }

  leaveRoom(ws) {
    const client = this.clients.get(ws);
    if (!client || !client.room) return;

    const room = client.room;
    const roomSet = this.rooms.get(room);
    if (roomSet) {
      roomSet.delete(ws);
      if (roomSet.size === 0) {
        this.rooms.delete(room);
      }
    }
    client.room = null;
    console.log(`[MESSENGER-SIGNALING] Client ${client.id} left room: ${room}`);
  }

  broadcastToRoom(sender, data) {
    const client = this.clients.get(sender);
    if (!client || !client.room) {
      console.log(
        `[MESSENGER-SIGNALING] Cannot broadcast - client not in room`
      );
      return;
    }

    const room = client.room;
    const roomSet = this.rooms.get(room);
    if (!roomSet) {
      console.log(
        `[MESSENGER-SIGNALING] Cannot broadcast - room ${room} not found`
      );
      return;
    }

    console.log(
      `[MESSENGER-SIGNALING] Broadcasting to ${roomSet.size} clients in room ${room}`
    );

    let sentCount = 0;
    roomSet.forEach((clientWs) => {
      if (clientWs !== sender && !clientWs.destroyed) {
        const targetClient = this.clients.get(clientWs);
        console.log(
          `[MESSENGER-SIGNALING] Sending to ${targetClient?.id}: ${data.type}`
        );
        this.send(clientWs, data);
        sentCount++;
      }
    });

    console.log(
      `[MESSENGER-SIGNALING] Sent ${sentCount} messages for ${data.type}`
    );
  }

  removeClient(ws) {
    this.leaveRoom(ws);
    this.clients.delete(ws);
  }

  send(ws, data) {
    if (ws.destroyed || ws.readyState !== "open") return;

    const message = JSON.stringify(data);
    const messageBuffer = Buffer.from(message);
    const frame = this.createWebSocketFrame(messageBuffer);

    try {
      ws.write(frame);
    } catch (error) {
      console.error(`[MESSENGER-SIGNALING] Failed to send message:`, error);
    }
  }

  createWebSocketFrame(payload) {
    const payloadLength = payload.length;
    let frame;

    if (payloadLength < 126) {
      frame = Buffer.allocUnsafe(2 + payloadLength);
      frame[0] = 0x81; // FIN + text frame
      frame[1] = payloadLength;
      payload.copy(frame, 2);
    } else if (payloadLength < 65536) {
      frame = Buffer.allocUnsafe(4 + payloadLength);
      frame[0] = 0x81;
      frame[1] = 126;
      frame.writeUInt16BE(payloadLength, 2);
      payload.copy(frame, 4);
    } else {
      frame = Buffer.allocUnsafe(10 + payloadLength);
      frame[0] = 0x81;
      frame[1] = 127;
      frame.writeBigUInt64BE(BigInt(payloadLength), 2);
      payload.copy(frame, 10);
    }

    return frame;
  }
}

// Start the messenger signaling server
const server = new MessengerSignalingServer();
server.start(4445);

console.log(
  "[MESSENGER-SIGNALING] Messenger signaling server started on port 4445"
);
console.log(
  "[MESSENGER-SIGNALING] This is separate from the collaboration signaling server on port 4444"
);
