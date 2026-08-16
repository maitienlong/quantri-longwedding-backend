const http = require("http");
const app = require("./index");
const connectDB = require("./config/db");
const { initSocket } = require("./socket");

const PORT = process.env.PORT || 5000;

connectDB();

const server = http.createServer(app);
initSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server with Socket.IO running on port ${PORT}`);
});
