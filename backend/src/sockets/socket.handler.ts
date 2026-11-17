import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export function initSocket(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*', // Allows local dev and cross-origin mobile scans
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    // Customer joins their order tracking room
    socket.on('join_order_room', (orderId: string) => {
      if (orderId) {
        socket.join(`order_${orderId}`);
      }
    });

    // Admin joins shop dashboard room
    socket.on('join_shop_room', (shopId: string) => {
      if (shopId) {
        socket.join(`shop_${shopId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}
