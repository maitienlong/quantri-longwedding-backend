const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let io = null;

function initSocket(server) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
        : [
            "http://localhost:3000",
            "http://localhost:8386",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:8386",
            "https://quanly.longwedding.vn",
            "https://longwedding.vn"
        ];

    io = new Server(server, {
        cors: {
            origin: (origin, callback) => {
                // Cho phép requests không có origin (server-to-server, mobile app, postman, curl)
                if (!origin) return callback(null, true);
                if (process.env.NODE_ENV !== "production") return callback(null, true);
                if (allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
                    return callback(null, true);
                }
                return callback(new Error("CORS policy does not allow access from origin: " + origin), false);
            },
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Authentication middleware in Socket handshake
    io.use((socket, next) => {
        try {
            const authHeader = socket.handshake.headers?.authorization;
            const token = 
                socket.handshake.auth?.token || 
                socket.handshake.query?.token || 
                (authHeader && authHeader.split(" ")[1]);

            if (!token) {
                // Ở chế độ production, bắt buộc xác thực token
                if (process.env.NODE_ENV === "production") {
                    return next(new Error("Authentication error: Token required"));
                }
                socket.user = { isAnonymous: true };
                return next();
            }

            const secretKey = process.env.JWT_SECRET;
            const decoded = jwt.verify(token, secretKey);
            socket.user = decoded;
            return next();
        } catch (err) {
            return next(new Error("Authentication error: Invalid or expired token"));
        }
    });

    io.on("connection", (socket) => {
        const username = socket.user?.username || (socket.user?.isAnonymous ? "anonymous" : "authenticated");
        console.log(`⚡ [Socket.IO] Client connected: ${socket.id} (user: ${username})`);

        // Nhân viên đã xác thực tự động tham gia phòng thông báo thanh toán admin
        if (socket.user && !socket.user.isAnonymous) {
            socket.join("admin_payments");
        }

        // Người dùng mở dialog thanh toán của hợp đồng cụ thể sẽ tham gia room của hợp đồng đó
        socket.on("join_contract", (data) => {
            const maHopDong = data?.maHopDong;
            if (maHopDong) {
                const cleanMa = String(maHopDong).replace(/[^A-Z0-9]/gi, "").toUpperCase();
                socket.join(`contract:${cleanMa}`);
                console.log(`📌 [Socket.IO] Socket ${socket.id} joined room: contract:${cleanMa}`);
            }
        });

        socket.on("leave_contract", (data) => {
            const maHopDong = data?.maHopDong;
            if (maHopDong) {
                const cleanMa = String(maHopDong).replace(/[^A-Z0-9]/gi, "").toUpperCase();
                socket.leave(`contract:${cleanMa}`);
                console.log(`👋 [Socket.IO] Socket ${socket.id} left room: contract:${cleanMa}`);
            }
        });

        socket.on("disconnect", () => {
            console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id}`);
        });
    });

    return io;
}

function getIO() {
    if (!io) {
        console.warn("⚠️ Socket.IO has not been initialized!");
    }
    return io;
}

function notifyPaymentSuccess(paymentData) {
    if (!io) {
        console.warn("⚠️ Socket.IO has not been initialized!");
        return;
    }

    const cleanMa = String(paymentData?.maHopDong || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
    console.log(`📢 [Socket.IO Room Dispatch] Payment Success targeted to room: contract:${cleanMa}`);

    // Phát sự kiện CHỈ tới phòng hợp đồng liên quan và phòng ban quản lý
    if (cleanMa) {
        io.to(`contract:${cleanMa}`).emit("payment_success", paymentData);
    }
    io.to("admin_payments").emit("payment_success", paymentData);
}

module.exports = {
    initSocket,
    getIO,
    notifyPaymentSuccess
};
