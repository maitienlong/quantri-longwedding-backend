const WEBSITE = require("../models/website.model");
const HopDong = require("../models/hopDong.model");
const Album = require("../models/album.model");

exports.getSection = async (req, res) => {
  try {
    const { section } = req.params;
    let websiteData = await WEBSITE.findOne({ section });
    
    let data = websiteData ? websiteData.data : [];

    if (section === 'special_collections') {
      try {
        const specialContracts = await HopDong.find({ isSpecialCollection: true })
          .populate('khachHang1', 'tenKhachHang')
          .populate('khachHang2', 'tenKhachHang')
          .sort({ specialCollectionOrder: 1, createdAt: -1 });

        const specialCollections = [];
        for (const contract of specialContracts) {
          const album = await Album.findOne({ maHopDong: contract.maHopDong });
          let images = [];
          if (album) {
            const list = album.danhSachAnhChinhSua || [];
            images = list.map(img => img.urlNen || img.urlGoc).filter(Boolean);
          }

          let coupleName = '';
          if (contract.khachHang1) {
            coupleName = contract.khachHang1.tenKhachHang;
            if (contract.khachHang2) {
              coupleName += ' & ' + contract.khachHang2.tenKhachHang;
            }
          }

          specialCollections.push({
            id: contract.maHopDong,
            _id: contract._id,
            maHopDong: contract.maHopDong,
            title: (album && album.chuDe) ? album.chuDe : `Bộ Sưu Tập ${coupleName || contract.maHopDong}`,
            coupleName: coupleName,
            coverImage: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            cover: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            images: images,
            category: 'wedding',
            showOnHome: true,
            hienThiTrangChu: true,
            isSpecial: true,
            photoCount: images.length
          });
        }
        return res.status(200).json({ success: true, data: specialCollections });
      } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
      }
    }

    if (section === 'collections') {
      try {
        const specialContracts = await HopDong.find({ isSpecialCollection: true })
          .populate('khachHang1', 'tenKhachHang')
          .populate('khachHang2', 'tenKhachHang')
          .sort({ specialCollectionOrder: 1, createdAt: -1 });

        const specialCollections = [];
        for (const contract of specialContracts) {
          const album = await Album.findOne({ maHopDong: contract.maHopDong });
          let images = [];
          if (album) {
            const list = album.danhSachAnhChinhSua || [];
            images = list.map(img => img.urlNen || img.urlGoc).filter(Boolean);
          }

          let coupleName = '';
          if (contract.khachHang1) {
            coupleName = contract.khachHang1.tenKhachHang;
            if (contract.khachHang2) {
              coupleName += ' & ' + contract.khachHang2.tenKhachHang;
            }
          }

          specialCollections.push({
            id: contract.maHopDong,
            _id: contract.maHopDong,
            title: (album && album.chuDe) ? album.chuDe : `Bộ Sưu Tập ${coupleName || contract.maHopDong}`,
            coupleName: coupleName,
            coverImage: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            cover: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
            images: images,
            category: 'wedding',
            showOnHome: true,
            hienThiTrangChu: true,
            isSpecial: true,
            photoCount: images.length
          });
        }

        // Merge special collections at the beginning of the list
        data = [...specialCollections, ...data];
      } catch (err) {
        console.error("Error fetching special collections from contracts:", err);
      }
    }

    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const { section } = req.params;
    const { data } = req.body;

    if (section === 'special_collections') {
      if (Array.isArray(data)) {
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (item._id) {
            await HopDong.findByIdAndUpdate(item._id, { specialCollectionOrder: i });
          }
        }
      }

      // Return the newly sorted special collections
      const specialContracts = await HopDong.find({ isSpecialCollection: true })
        .populate('khachHang1', 'tenKhachHang')
        .populate('khachHang2', 'tenKhachHang')
        .sort({ specialCollectionOrder: 1, createdAt: -1 });

      const specialCollections = [];
      for (const contract of specialContracts) {
        const album = await Album.findOne({ maHopDong: contract.maHopDong });
        let images = [];
        if (album) {
          const list = album.danhSachAnhChinhSua || [];
          images = list.map(img => img.urlNen || img.urlGoc).filter(Boolean);
        }

        let coupleName = '';
        if (contract.khachHang1) {
          coupleName = contract.khachHang1.tenKhachHang;
          if (contract.khachHang2) {
            coupleName += ' & ' + contract.khachHang2.tenKhachHang;
          }
        }

        specialCollections.push({
          id: contract.maHopDong,
          _id: contract._id,
          maHopDong: contract.maHopDong,
          title: (album && album.chuDe) ? album.chuDe : `Bộ Sưu Tập ${coupleName || contract.maHopDong}`,
          coupleName: coupleName,
          coverImage: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
          cover: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
          images: images,
          category: 'wedding',
          showOnHome: true,
          hienThiTrangChu: true,
          isSpecial: true,
          photoCount: images.length
        });
      }
      return res.status(200).json({ success: true, message: "Cập nhật thứ tự thành công", data: specialCollections });
    }

    let websiteData = await WEBSITE.findOne({ section });

    if (!websiteData) {
      websiteData = new WEBSITE({ section, data });
      await websiteData.save();
    } else {
      websiteData.data = data;
      await websiteData.save();
    }

    res.status(200).json({ success: true, message: "Cập nhật thành công", data: websiteData.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addSectionItem = async (req, res) => {
  try {
    const { section } = req.params;
    const { item } = req.body;

    let websiteData = await WEBSITE.findOne({ section });

    if (!websiteData) {
      websiteData = new WEBSITE({ section, data: [] });
    }

    if (!item.id && !item._id) {
      item.id = Date.now();
    }

    websiteData.data.push(item);
    websiteData.markModified('data');
    await websiteData.save();

    res.status(200).json({ success: true, message: "Thêm thành công", data: websiteData.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSectionItem = async (req, res) => {
  try {
    const { section, id } = req.params;
    const { item } = req.body;

    let websiteData = await WEBSITE.findOne({ section });

    if (!websiteData) {
      return res.status(404).json({ success: false, message: "Không tìm thấy chuyên mục" });
    }

    const updatedData = websiteData.data.map(d => {
      if ((d.id && String(d.id) === String(id)) || (d._id && String(d._id) === String(id))) {
        return { ...d, ...item };
      }
      return d;
    });

    websiteData.data = updatedData;
    websiteData.markModified('data');
    await websiteData.save();

    res.status(200).json({ success: true, message: "Sửa thành công", data: websiteData.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteSectionItem = async (req, res) => {
  try {
    const { section, id } = req.params;

    if (section === 'special_collections') {
      await HopDong.findByIdAndUpdate(id, { isSpecialCollection: false });

      const specialContracts = await HopDong.find({ isSpecialCollection: true })
        .populate('khachHang1', 'tenKhachHang')
        .populate('khachHang2', 'tenKhachHang')
        .sort({ specialCollectionOrder: 1, createdAt: -1 });

      const specialCollections = [];
      for (const contract of specialContracts) {
        const album = await Album.findOne({ maHopDong: contract.maHopDong });
        let images = [];
        if (album) {
          const list = album.danhSachAnhChinhSua || [];
          images = list.map(img => img.urlNen || img.urlGoc).filter(Boolean);
        }

        let coupleName = '';
        if (contract.khachHang1) {
          coupleName = contract.khachHang1.tenKhachHang;
          if (contract.khachHang2) {
            coupleName += ' & ' + contract.khachHang2.tenKhachHang;
          }
        }

        specialCollections.push({
          id: contract.maHopDong,
          _id: contract._id,
          maHopDong: contract.maHopDong,
          title: (album && album.chuDe) ? album.chuDe : `Bộ Sưu Tập ${coupleName || contract.maHopDong}`,
          coupleName: coupleName,
          coverImage: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
          cover: images[0] || 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
          images: images,
          category: 'wedding',
          showOnHome: true,
          hienThiTrangChu: true,
          isSpecial: true,
          photoCount: images.length
        });
      }
      return res.status(200).json({ success: true, message: "Hủy công bố thành công", data: specialCollections });
    }

    let websiteData = await WEBSITE.findOne({ section });

    if (!websiteData) {
      return res.status(404).json({ success: false, message: "Không tìm thấy chuyên mục" });
    }

    const filteredData = websiteData.data.filter(d => {
      return !((d.id && String(d.id) === String(id)) || (d._id && String(d._id) === String(id)));
    });

    websiteData.data = filteredData;
    websiteData.markModified('data');
    await websiteData.save();

    res.status(200).json({ success: true, message: "Xóa thành công", data: websiteData.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addSectionItemPublic = async (req, res) => {
  try {
    const { section } = req.params;
    const { item } = req.body;

    // Chỉ cho phép lưu công khai cho 'bookings' hoặc 'feedback' để bảo mật
    if (section !== 'bookings' && section !== 'feedback') {
      return res.status(403).json({ success: false, message: "Không được phép thực hiện hành động này" });
    }

    let websiteData = await WEBSITE.findOne({ section });

    if (!websiteData) {
      websiteData = new WEBSITE({ section, data: [] });
    }

    if (!item.id && !item._id) {
      item.id = Date.now();
    }

    // Gắn thêm thời gian gửi và trạng thái mặc định cho lịch tư vấn
    item.createdAt = new Date().toISOString();
    if (section === 'bookings') {
      item.status = 'chua_lien_he';
    }

    websiteData.data.push(item);
    websiteData.markModified('data');
    await websiteData.save();

    res.status(200).json({ success: true, message: "Gửi yêu cầu thành công!", data: websiteData.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng chọn ảnh!" });
    }

    const relativePath = `/uploads/${req.file.filename}`;
    const host = req.protocol + '://' + req.get('host');
    const absoluteUrl = `${host}${relativePath}`;

    res.status(200).json({
      success: true,
      message: "Tải ảnh lên thành công",
      url: absoluteUrl,
      path: relativePath
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.claimVoucher = async (req, res) => {
  try {
    const { voucherId, voucherCode, name, phone, address } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.ip;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ Họ tên và Số điện thoại!" });
    }

    const cleanPhone = String(phone).trim();

    // 1. Check if Phone or IP has already claimed ANY voucher
    let claimsData = await WEBSITE.findOne({ section: 'voucher_claims' });
    if (!claimsData) {
      claimsData = new WEBSITE({ section: 'voucher_claims', data: [] });
    }

    const hasClaimedByPhone = claimsData.data.some(c => String(c.phone).trim() === cleanPhone);
    const hasClaimedByIp = clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== 'localhost'
      ? claimsData.data.some(c => c.ip === clientIp) 
      : false;

    if (hasClaimedByPhone || hasClaimedByIp) {
      return res.status(400).json({ 
        success: false, 
        message: "Số điện thoại hoặc thiết bị này đã từng săn Voucher trước đó! Mỗi khách hàng chỉ được săn 1 lần." 
      });
    }

    // 2. Fetch vouchers section
    let vouchersData = await WEBSITE.findOne({ section: 'vouchers' });
    if (!vouchersData || !Array.isArray(vouchersData.data)) {
      return res.status(400).json({ success: false, message: "Hiện tại hệ thống không tìm thấy danh sách Voucher!" });
    }

    // Find the specific voucher
    const targetIdx = vouchersData.data.findIndex(v => 
      (voucherId && (String(v.id) === String(voucherId) || String(v._id) === String(voucherId))) ||
      (voucherCode && String(v.code).toLowerCase() === String(voucherCode).toLowerCase())
    );

    if (targetIdx === -1) {
      return res.status(404).json({ success: false, message: "Không tìm thấy mã Voucher này!" });
    }

    const targetVoucher = vouchersData.data[targetIdx];
    const maxQty = Number(targetVoucher.quantity || 0);
    const currentClaimed = Number(targetVoucher.claimedCount || 0);

    if (currentClaimed >= maxQty || maxQty === 0) {
      return res.status(400).json({ 
        success: false, 
        isOutStock: true,
        message: "Đã hết số lượng ưu đãi, Quý khách có thể trải nghiệm dịch vụ trên website của Long Wedding, hoặc liên hệ đến cửa hàng để có những ưu đãi khác" 
      });
    }

    // Increment claimedCount
    vouchersData.data[targetIdx].claimedCount = currentClaimed + 1;
    vouchersData.markModified('data');
    await vouchersData.save();

    // 3. Record claim into voucher_claims
    const newClaim = {
      id: Date.now(),
      voucherId: targetVoucher.id,
      voucherCode: targetVoucher.code || voucherCode,
      voucherTitle: targetVoucher.value || targetVoucher.title,
      name,
      phone: cleanPhone,
      address: address || '',
      ip: clientIp,
      claimedAt: new Date().toISOString()
    };

    claimsData.data.push(newClaim);
    claimsData.markModified('data');
    await claimsData.save();

    // 4. Also automatically add to bookings (Leads) so Admin sees it in QuanLyWebsite -> Bookings!
    let bookingsData = await WEBSITE.findOne({ section: 'bookings' });
    if (!bookingsData) {
      bookingsData = new WEBSITE({ section: 'bookings', data: [] });
    }

    bookingsData.data.push({
      id: Date.now() + 1,
      name,
      phone: cleanPhone,
      address: address || '',
      service: `[SĂN VOUCHER] ${targetVoucher.code || voucherCode} - ${targetVoucher.value || targetVoucher.title}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      status: 'chua_lien_he',
      createdAt: new Date().toISOString()
    });
    bookingsData.markModified('data');
    await bookingsData.save();

    return res.status(200).json({
      success: true,
      message: "Săn Voucher thành công!",
      voucherCode: targetVoucher.code || voucherCode,
      voucher: vouchersData.data[targetIdx]
    });

  } catch (error) {
    console.error("Error claiming voucher:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi săn voucher: " + error.message });
  }
};
