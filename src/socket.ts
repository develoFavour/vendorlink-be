import { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { UserRole } from "./models/user.model";
import { userRepository } from "./repositories/user.repository";

type JwtPayload = {
  id: string;
  role: UserRole;
};

let io: Server | null = null;

const parseCookie = (cookieHeader: string | undefined, name: string): string | null => {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return target ? decodeURIComponent(target.slice(name.length + 1)) : null;
};

export const initializeSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = parseCookie(socket.handshake.headers.cookie, "auth_token");
      if (!token) return next(new Error("Authentication required"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret") as JwtPayload;
      const user = await userRepository.findById(decoded.id);
      if (!user) return next(new Error("User session is no longer valid"));

      socket.data.user = {
        id: user._id.toString(),
        role: user.role,
      };

      next();
    } catch {
      next(new Error("Invalid socket session"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.user.id}`);

    socket.on("conversation:join", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on("conversation:leave", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on("typing:start", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing:start", {
        conversationId,
        userId: socket.data.user.id,
      });
    });

    socket.on("typing:stop", (conversationId: string) => {
      socket.to(`conversation:${conversationId}`).emit("typing:stop", {
        conversationId,
        userId: socket.data.user.id,
      });
    });
  });

  return io;
};

export const emitNewMessage = ({
  conversationId,
  receiverId,
  senderId,
  message,
  conversation,
}: {
  conversationId: string;
  receiverId: string;
  senderId: string;
  message: unknown;
  conversation: unknown;
}) => {
  if (!io) return;

  io.to(`user:${receiverId}`).emit("message:new", { conversationId, message, conversation });
  io.to(`user:${senderId}`).emit("message:sent", { conversationId, message, conversation });
  io.to(`conversation:${conversationId}`).emit("conversation:update", { conversationId, conversation });
};
