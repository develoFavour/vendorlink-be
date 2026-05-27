"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitNewMessage = exports.initializeSocket = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const socket_io_1 = require("socket.io");
const user_repository_1 = require("./repositories/user.repository");
let io = null;
const parseCookie = (cookieHeader, name) => {
    if (!cookieHeader)
        return null;
    const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
    const target = cookies.find((cookie) => cookie.startsWith(`${name}=`));
    return target ? decodeURIComponent(target.slice(name.length + 1)) : null;
};
const initializeSocket = (server) => {
    io = new socket_io_1.Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:3000",
            credentials: true,
        },
    });
    io.use((socket, next) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const token = parseCookie(socket.handshake.headers.cookie, "auth_token");
            if (!token)
                return next(new Error("Authentication required"));
            const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET || "default_secret");
            const user = yield user_repository_1.userRepository.findById(decoded.id);
            if (!user)
                return next(new Error("User session is no longer valid"));
            socket.data.user = {
                id: user._id.toString(),
                role: user.role,
            };
            next();
        }
        catch (_a) {
            next(new Error("Invalid socket session"));
        }
    }));
    io.on("connection", (socket) => {
        socket.join(`user:${socket.data.user.id}`);
        socket.on("conversation:join", (conversationId) => {
            socket.join(`conversation:${conversationId}`);
        });
        socket.on("conversation:leave", (conversationId) => {
            socket.leave(`conversation:${conversationId}`);
        });
        socket.on("typing:start", (conversationId) => {
            socket.to(`conversation:${conversationId}`).emit("typing:start", {
                conversationId,
                userId: socket.data.user.id,
            });
        });
        socket.on("typing:stop", (conversationId) => {
            socket.to(`conversation:${conversationId}`).emit("typing:stop", {
                conversationId,
                userId: socket.data.user.id,
            });
        });
    });
    return io;
};
exports.initializeSocket = initializeSocket;
const emitNewMessage = ({ conversationId, receiverId, senderId, message, conversation, }) => {
    if (!io)
        return;
    io.to(`user:${receiverId}`).emit("message:new", { conversationId, message, conversation });
    io.to(`user:${senderId}`).emit("message:sent", { conversationId, message, conversation });
    io.to(`conversation:${conversationId}`).emit("conversation:update", { conversationId, conversation });
};
exports.emitNewMessage = emitNewMessage;
