import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

export function initWebSocketServer(server: HttpServer) {
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log(`[WebSocket] Client connected: ${socket.id}`);

    // Join guild channel room for targeted live sync
    socket.on('join-guild-room', (guildId: string) => {
      socket.join(`guild:${guildId}`);
      console.log(`[WebSocket] Client ${socket.id} joined room guild:${guildId}`);
    });

    // Broadcast plugin toggle live sync
    socket.on('plugin:toggle', (data: { guildId: string; pluginKey: string; enabled: boolean }) => {
      io.to(`guild:${data.guildId}`).emit('plugin:updated', data);
    });

    // Ticket message stream
    socket.on('ticket:message', (data: { ticketId: string; author: string; message: string }) => {
      io.emit('ticket:stream', data);
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}
