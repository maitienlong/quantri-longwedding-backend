const { Server } = require("socket.io");

let io = null;

function initSocket(server) {
    io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on("connection", (socket) => {
        console.log(`⚡ [Socket.IO] Client connected: ${socket.id}`);

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
    if (io) {
        console.log(`📢 [Socket.IO Broadcast] Payment Success for contract: ${paymentData.maHopDong}`);
        io.emit("payment_success", paymentData);
    }
}

module.exports = {
    initSocket,
    getIO,
    notifyPaymentSuccess
};
