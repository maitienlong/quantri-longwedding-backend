const jwt = require("jsonwebtoken");

/**
 * Middleware kiểm tra quyền truy cập Cổng Khách Hàng (Client Portal)
 * Chấp nhận:
 * 1. Scoped Portal Token (được ký cho riêng mã hợp đồng đó, role: "client_portal")
 * 2. Nhân viên studio đã đăng nhập (Bearer user token hợp lệ)
 * Chặn:
 * - Không có token (401)
 * - Token hết hạn hoặc sai chữ ký (401)
 * - Scoped Token của hợp đồng này nhưng cố tình truy cập hợp đồng khác - Tamper/IDOR (403)
 */
module.exports = async function portalAuthMiddleware(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const customPortalHeader = req.headers["x-portal-token"];
    const queryToken = req.query.token;

    const token = customPortalHeader || queryToken || (authHeader && authHeader.split(" ")[1]);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Yêu cầu có Scoped Portal Token để truy cập cổng thông tin hợp đồng này"
      });
    }

    const secretKey = process.env.JWT_SECRET;
    let decoded;
    try {
      decoded = jwt.verify(token, secretKey);
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "Mã truy cập cổng khách hàng không hợp lệ hoặc đã hết hạn"
      });
    }

    const rawParam = req.params.maHopDong || req.params.id || req.body?.maHopDong || "";
    const requestedMaHopDong = rawParam.replace(/[^A-Z0-9]/gi, "").toUpperCase();

    // 1. Nếu là nhân viên studio đang đăng nhập (có username trong decoded payload)
    if (decoded && decoded.username) {
      req.user = decoded;
      return next();
    }

    // 2. Nếu là Scoped Portal Token
    if (decoded && decoded.role === "client_portal") {
      const tokenMaHopDong = String(decoded.maHopDong || "").replace(/[^A-Z0-9]/gi, "").toUpperCase();

      if (!tokenMaHopDong || tokenMaHopDong !== requestedMaHopDong) {
        if (/^[0-9a-fA-F]{24}$/.test(rawParam)) {
          try {
            const Album = require("../models/album.model");
            const albumDoc = await Album.findById(rawParam).select("maHopDong");
            if (albumDoc && albumDoc.maHopDong && albumDoc.maHopDong.replace(/[^A-Z0-9]/gi, "").toUpperCase() === tokenMaHopDong) {
              req.portalClient = decoded;
              return next();
            }
          } catch (e) {}
        }
        console.warn(`[Portal Security Alert] IDOR/Tamper attempt detected: Token '${tokenMaHopDong}' does not match requested contract '${requestedMaHopDong}'`);
        return res.status(403).json({
          success: false,
          message: "Mã truy cập không khớp với hợp đồng yêu cầu (Truy cập bị từ chối)"
        });
      }

      req.portalClient = decoded;
      return next();
    }

    // 3. Token không đúng định dạng cho portal
    return res.status(403).json({
      success: false,
      message: "Quyền truy cập không hợp lệ"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Lỗi hệ thống khi xác thực cổng khách hàng: " + error.message
    });
  }
};

