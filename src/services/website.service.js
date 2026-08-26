const WEBSITE = require("../models/website.model");
const HopDong = require("../models/hopDong.model");
const Album = require("../models/album.model");

// Dữ liệu mặc định Quốc Khánh 2/9 (Kỷ niệm 81 năm)
const DEFAULT_QUOC_KHANH_MESSAGES = [
  { id: 1, name: 'Nguyễn Văn Hùng', location: 'Hà Nội', text: 'Tự hào 81 năm non sông gấm vóc! Chúc Việt Nam ngày càng phồn vinh, hùng cường!', time: '1 phút trước', createdAt: new Date().toISOString() },
  { id: 2, name: 'Trần Thị Mai & Lê Quang', location: 'TP. Hồ Chí Minh', text: 'Vợ chồng mình chọn chụp bộ ảnh cưới Áo dài cờ đỏ sao vàng mừng Quốc khánh 2/9. Cảm ơn sự hy sinh của các thế hệ cha ông!', time: '3 phút trước', createdAt: new Date().toISOString() },
  { id: 3, name: 'Đoàn Thanh Niên', location: 'Đà Nẵng', text: 'Tuổi trẻ nguyện cống hiến hết mình cho Tổ quốc Việt Nam thân yêu! 2/9 muôn năm!', time: '6 phút trước', createdAt: new Date().toISOString() },
  { id: 4, name: 'Phạm Hương Giang', location: 'Hải Phòng', text: 'Hào khí 81 năm lịch sử vẫn rực cháy trong tim mỗi người con đất Việt!', time: '12 phút trước', createdAt: new Date().toISOString() },
  { id: 5, name: 'Hoàng Minh & Thảo Ly', location: 'Cần Thơ', text: 'Chúc toàn thể đồng bào có một kỳ nghỉ lễ 2/9 thật ấm áp và ngập tràn hạnh phúc!', time: '15 phút trước', createdAt: new Date().toISOString() }
];

const DEFAULT_QUOC_KHANH_FLAGS = 81945;

const DEFAULT_QUOC_KHANH_DEALS = [
  {
    id: 'deal-81-1',
    badge: 'ƯU ĐÃI ĐẠI LỄ 81 NĂM',
    title: 'Gói Chụp Cưới "Áo Dài Di Sản - Hồn Thiêng Non Sông"',
    discount: 'GIẢM NGAY 810.000đ',
    originalPrice: '7.800.000đ',
    price: '6.990.000đ',
    desc: 'Tôn vinh nét đẹp truyền thống của cô dâu chú rể trong tà áo dài di sản tại các địa danh lịch sử.',
    features: [
      'Miễn phí 02 bộ Áo dài Cổ Phục / Cờ đỏ sao vàng cao cấp',
      'Tặng 01 ảnh ép gỗ khổ lớn 60x90cm in hình kỷ niệm',
      'Miễn phí Trang Điểm & Phụ Kiện truyền thống (Nón lá, quạt lụa)',
      'Tặng toàn bộ file ảnh gốc chất lượng cao không nén'
    ]
  },
  {
    id: 'deal-81-2',
    badge: 'COMBO HOÀNG KIM VIP',
    title: 'Combo Cưới Trọn Gói "Độc Lập & Sum Vầy 2026"',
    discount: 'GIẢM 8.100.000đ',
    originalPrice: '26.000.000đ',
    price: '17.900.000đ',
    popular: true,
    desc: 'Gói cưới hoàn hảo và toàn diện nhất mừng đại lễ 81 năm Quốc khánh Việt Nam.',
    features: [
      'Trọn gói Chụp Ảnh Cưới Ngoại cảnh + Studio VIP',
      'Miễn phí Quay Phóng Sự Cưới Flycam 4K toàn cảnh',
      'Tặng 02 Váy Cưới Thiết Kế Hoàng Gia & 02 Vest Chú Rể',
      'Tặng 81 ảnh in pha lê cao cấp để bàn trang trí tiệc cưới'
    ]
  },
  {
    id: 'deal-81-3',
    badge: 'TRI ÂN QUỐC KHÁNH',
    title: 'Gói Phim Phóng Sự Cưới "Chuyện Tình Thời Bình"',
    discount: 'TẶNG TEASER 4K',
    originalPrice: '11.000.000đ',
    price: '8.100.000đ',
    desc: 'Ghi lại những thước phim xúc động, trang trọng và ngọt ngào nhất trong ngày trọng đại.',
    features: [
      '02 Máy quay 4K chuyên nghiệp ghi trọn vẹn Lễ Gia Tiên & Tiệc Cưới',
      'Tặng Clip Highlight Teaser 1-2 phút chuẩn định dạng MXH',
      'Lưu trữ Cloud riêng trọn đời cho hai bạn',
      'Tặng kèm 01 khung ảnh điện tử để bàn'
    ]
  }
];

const DEFAULT_QUOC_KHANH_GIFTS = [
  { title: 'Voucher 8.100.000đ Gói Cưới VIP', code: 'QK81-VIP8100' },
  { title: 'Voucher 810.000đ Gói Áo Dài Di Sản', code: 'QK81-AODAI810' },
  { title: 'Tặng 01 Bộ Ảnh Khung Pha Lê 60x90', code: 'QK81-PHALE6090' },
  { title: 'Miễn Phí Thuê 01 Váy Cưới Thiết Kế', code: 'QK81-FREEVAY' },
  { title: 'Tặng 01 Gói Trang Điểm Chú Rể Cao Cấp', code: 'QK81-MAKEUPCR' },
  { title: 'Voucher Giảm 1.000.000đ Tiệc Cưới', code: 'QK81-TIEC1000' }
];

const DEFAULT_BANNER_SLIDES = [
  {
    id: 'slide-baby',
    tabLabel: 'Concept Sinh Nhật Bé',
    calligraphy: 'Mùa Thu Sang',
    subTitle: 'ƯU ĐÃI VÀNG',
    gift1: 'TẶNG NGAY 200K VÀO GIÁ GÓI',
    gift2: 'HOẶC 1 ẢNH ĐỂ BÀN 20X30 (GIÁ TRỊ 200K)',
    conceptTarget: 'DÀNH CHO ƯU ĐÃI CHO CONCEPT SINH NHẬT BÉ',
    specs: [
      '2 CONCEPT SINH NHẬT CHO BÉ',
      '2 TRANG PHỤC CHO CONCEPT',
      'TRẢ TOÀN BỘ ẢNH GỐC',
      '10 FILE ẢNH CHỈNH SỬA PHOTOSHOP'
    ],
    oldPrice: '1.190.000 VNĐ',
    newPrice: '990.000 VNĐ',
    time: 'THỜI GIAN: 01/09 - 15/09/2026',
    image: '',
    alt: 'Concept Sinh Nhật Bé Mùa Thu Sang - Long Wedding',
    btnLink: '/chup-anh-be',
    badge: 'GIẢM 200K'
  },
  {
    id: 'slide-aodai',
    tabLabel: 'Áo Dài Di Sản 2/9',
    calligraphy: 'Hào Khí Non Sông',
    subTitle: 'ƯU ĐÃI VÀNG ĐẠI LỄ 2/9',
    gift1: 'TẶNG NGAY 810.000Đ VÀO GIÁ GÓI',
    gift2: '+ 01 ẢNH CỔNG PHA LÊ 60x90 (TRỊ GIÁ 800K)',
    conceptTarget: 'DÀNH CHO CONCEPT ÁO DÀI CỔ PHỤC & DI SẢN HOÀNG TRIỀU',
    specs: [
      '2 CONCEPT ÁO DÀI CỔ PHỤC HOÀNG GIA',
      '2 BỘ TRANG PHỤC CAO CẤP ĐỘC QUYỀN',
      'MIỄN PHÍ MAKEUP & LÀM TÓC CHUYÊN NGHIỆP',
      'TRẢ TOÀN BỘ FILE GỐC & 20 ẢNH PHOTOSHOP'
    ],
    oldPrice: '7.800.000 VNĐ',
    newPrice: '5.990.000 VNĐ',
    time: 'THỜI GIAN: 01/09 - 15/09/2026',
    image: '',
    alt: 'Concept Áo Dài Cổ Phục Di Sản Đại Lễ 2/9 - Long Wedding',
    btnLink: '/quoc-khanh',
    badge: 'ĐẠI LỄ 2/9'
  },
  {
    id: 'slide-wedding',
    tabLabel: 'Combo Cưới Trọn Gói',
    calligraphy: 'Mùa Cưới Sum Vầy',
    subTitle: 'ƯU ĐÃI VÀNG NGÀY CƯỚI',
    gift1: 'TẶNG VOUCHER 8.100.000Đ TIỀN MẶT',
    gift2: '+ 01 VEST MAY ĐO CAO CẤP + ALBUM 30X30',
    conceptTarget: 'DÀNH CHO COMBO NGÀY CƯỚI & PRE-WEDDING ĐẲNG CẤP',
    specs: [
      '2 VÁY CƯỚI LUXURY VIP + 2 VÁY TIỆC + 2 VEST',
      'CHỤP PRE-WEDDING NGOẠI CẢNH & PHIM TRƯỜNG',
      'EKIP 1-1 CHUYÊN NGHIỆP TẬN TÂM',
      '01 ALBUM 30X30 MỞ PHẲNG + 02 ẢNH CỔNG 60X90'
    ],
    oldPrice: '26.200.000 VNĐ',
    newPrice: '18.100.000 VNĐ',
    time: 'THỜI GIAN: 01/09 - 15/09/2026',
    image: '',
    alt: 'Combo Cưới Trọn Gói Mùa Thu Sang - Long Wedding',
    btnLink: '/chup-anh-cuoi',
    badge: 'TIẾT KIỆM 8.1TR'
  }
];

exports.getSection = async (req, res) => {
  try {
    const { section } = req.params;
    let websiteData = await WEBSITE.findOne({ section });
    
    let data = websiteData ? websiteData.data : [];

        // Fallback cho Slide Banner trang chủ nếu chưa có trong DB
    if (section === 'banners') {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        data = DEFAULT_BANNER_SLIDES;
      }
      return res.status(200).json({ success: true, data });
    }

    // Fallback thông minh cho các mục của Đại Lễ Quốc Khánh
    if (section === 'quoc_khanh_messages') {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        data = DEFAULT_QUOC_KHANH_MESSAGES;
      }
      return res.status(200).json({ success: true, data });
    }

    if (section === 'quoc_khanh_flags') {
      let count = DEFAULT_QUOC_KHANH_FLAGS;
      if (typeof data === 'number') count = data;
      else if (data && typeof data.count === 'number') count = data.count;
      return res.status(200).json({ success: true, data: { count } });
    }

    if (section === 'quoc_khanh_deals') {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        data = DEFAULT_QUOC_KHANH_DEALS;
      }
      return res.status(200).json({ success: true, data });
    }

    if (section === 'quoc_khanh_gifts') {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        data = DEFAULT_QUOC_KHANH_GIFTS;
      }
      return res.status(200).json({ success: true, data });
    }

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

// =========================================================================
// API CHUYÊN BIỆT CHO TRANG ĐẠI LỄ QUỐC KHÁNH 2/9 (/quoc-khanh)
// =========================================================================

/**
 * Lấy toàn bộ dữ liệu của trang Quốc Khánh: Lời tri ân, số lượt thắp cờ, ưu đãi, quà may mắn
 */
exports.getQuocKhanhAllData = async (req, res) => {
  try {
    const [messagesDoc, flagsDoc, dealsDoc, giftsDoc] = await Promise.all([
      WEBSITE.findOne({ section: 'quoc_khanh_messages' }),
      WEBSITE.findOne({ section: 'quoc_khanh_flags' }),
      WEBSITE.findOne({ section: 'quoc_khanh_deals' }),
      WEBSITE.findOne({ section: 'quoc_khanh_gifts' })
    ]);

    let messages = messagesDoc && Array.isArray(messagesDoc.data) && messagesDoc.data.length > 0 
      ? messagesDoc.data 
      : DEFAULT_QUOC_KHANH_MESSAGES;

    let flagCount = DEFAULT_QUOC_KHANH_FLAGS;
    if (flagsDoc) {
      if (typeof flagsDoc.data === 'number') flagCount = flagsDoc.data;
      else if (flagsDoc.data && typeof flagsDoc.data.count === 'number') flagCount = flagsDoc.data.count;
    }

    let deals = dealsDoc && Array.isArray(dealsDoc.data) && dealsDoc.data.length > 0 
      ? dealsDoc.data 
      : DEFAULT_QUOC_KHANH_DEALS;

    let gifts = giftsDoc && Array.isArray(giftsDoc.data) && giftsDoc.data.length > 0 
      ? giftsDoc.data 
      : DEFAULT_QUOC_KHANH_GIFTS;

    return res.status(200).json({
      success: true,
      data: {
        flagCount,
        messages,
        deals,
        gifts
      }
    });
  } catch (error) {
    console.error("Error in getQuocKhanhAllData:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi lấy dữ liệu trang Quốc Khánh: " + error.message });
  }
};

/**
 * Gửi lời tri ân mừng Quốc Khánh & tự động thắp sáng cờ Tổ quốc (+1)
 */
exports.addQuocKhanhTribute = async (req, res) => {
  try {
    const { name, location, text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập nội dung lời tri ân / chúc mừng!" });
    }

    // 1. Thêm lời chúc vào mục quoc_khanh_messages
    let messagesDoc = await WEBSITE.findOne({ section: 'quoc_khanh_messages' });
    if (!messagesDoc) {
      messagesDoc = new WEBSITE({ section: 'quoc_khanh_messages', data: [...DEFAULT_QUOC_KHANH_MESSAGES] });
    }

    const newTribute = {
      id: Date.now(),
      name: (name && name.trim()) ? name.trim() : 'Người con Đất Việt',
      location: (location && location.trim()) ? location.trim() : 'Hà Nội',
      text: text.trim(),
      time: 'Vừa xong',
      createdAt: new Date().toISOString()
    };

    // Đưa tin nhắn mới lên đầu mảng
    messagesDoc.data.unshift(newTribute);
    // Giới hạn lưu tối đa 500 lời chúc gần nhất để tối ưu hiệu năng
    if (messagesDoc.data.length > 500) {
      messagesDoc.data = messagesDoc.data.slice(0, 500);
    }
    messagesDoc.markModified('data');
    await messagesDoc.save();

    // 2. Tự động tăng số lượt thắp sáng cờ Tổ quốc (+1)
    let flagsDoc = await WEBSITE.findOne({ section: 'quoc_khanh_flags' });
    let currentCount = DEFAULT_QUOC_KHANH_FLAGS;
    if (!flagsDoc) {
      currentCount = DEFAULT_QUOC_KHANH_FLAGS + 1;
      flagsDoc = new WEBSITE({ section: 'quoc_khanh_flags', data: { count: currentCount } });
    } else {
      if (typeof flagsDoc.data === 'number') {
        currentCount = flagsDoc.data + 1;
        flagsDoc.data = { count: currentCount };
      } else if (flagsDoc.data && typeof flagsDoc.data.count === 'number') {
        currentCount = flagsDoc.data.count + 1;
        flagsDoc.data.count = currentCount;
      } else {
        currentCount = DEFAULT_QUOC_KHANH_FLAGS + 1;
        flagsDoc.data = { count: currentCount };
      }
      flagsDoc.markModified('data');
    }
    await flagsDoc.save();

    return res.status(200).json({
      success: true,
      message: "Gửi lời tri ân và thắp sáng cờ Tổ quốc thành công! 🇻🇳",
      data: newTribute,
      flagCount: currentCount
    });
  } catch (error) {
    console.error("Error in addQuocKhanhTribute:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi gửi lời tri ân: " + error.message });
  }
};

/**
 * Thắp sáng cờ đỏ sao vàng (+1 lượt)
 */
exports.incrementQuocKhanhFlag = async (req, res) => {
  try {
    let flagsDoc = await WEBSITE.findOne({ section: 'quoc_khanh_flags' });
    let currentCount = DEFAULT_QUOC_KHANH_FLAGS;

    if (!flagsDoc) {
      currentCount = DEFAULT_QUOC_KHANH_FLAGS + 1;
      flagsDoc = new WEBSITE({ section: 'quoc_khanh_flags', data: { count: currentCount } });
    } else {
      if (typeof flagsDoc.data === 'number') {
        currentCount = flagsDoc.data + 1;
        flagsDoc.data = { count: currentCount };
      } else if (flagsDoc.data && typeof flagsDoc.data.count === 'number') {
        currentCount = flagsDoc.data.count + 1;
        flagsDoc.data.count = currentCount;
      } else {
        currentCount = DEFAULT_QUOC_KHANH_FLAGS + 1;
        flagsDoc.data = { count: currentCount };
      }
      flagsDoc.markModified('data');
    }
    await flagsDoc.save();

    return res.status(200).json({
      success: true,
      message: "Đã thắp sáng cờ Tổ quốc! 🇻🇳",
      flagCount: currentCount
    });
  } catch (error) {
    console.error("Error in incrementQuocKhanhFlag:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi thắp sáng cờ: " + error.message });
  }
};

/**
 * Đăng ký tư vấn & nhận ưu đãi gói Đại Lễ 81 năm
 */
exports.addQuocKhanhBooking = async (req, res) => {
  try {
    const { name, phone, service, weddingDate, note, promoCode } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ Họ tên và Số điện thoại!" });
    }

    const cleanPhone = String(phone).trim();

    let bookingsDoc = await WEBSITE.findOne({ section: 'bookings' });
    if (!bookingsDoc) {
      bookingsDoc = new WEBSITE({ section: 'bookings', data: [] });
    }

    const newBooking = {
      id: Date.now(),
      name: name.trim(),
      phone: cleanPhone,
      service: service || 'Gói Chụp Cưới Áo Dài Di Sản (Đại Lễ 2/9)',
      promoCode: promoCode || 'QUOCKHANH81-TRIAN2026',
      date: weddingDate || new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      note: note ? `[ĐẠI LỄ QUỐC KHÁNH 2/9] ${note}` : `[ĐẠI LỄ QUỐC KHÁNH 2/9] Khách đăng ký nhận ưu đãi giảm giá ngày 2/9`,
      status: 'chua_lien_he',
      source: 'quoc_khanh_page',
      createdAt: new Date().toISOString()
    };

    bookingsDoc.data.unshift(newBooking);
    bookingsDoc.markModified('data');
    await bookingsDoc.save();

    return res.status(200).json({
      success: true,
      message: "Đăng ký nhận ưu đãi Đại Lễ thành công! Chuyên viên Long Wedding sẽ liên hệ với bạn trong thời gian sớm nhất.",
      data: newBooking
    });
  } catch (error) {
    console.error("Error in addQuocKhanhBooking:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi lưu đăng ký tư vấn: " + error.message });
  }
};

/**
 * Ghi nhận khách hàng rút thẻ quà may mắn
 */
exports.claimQuocKhanhGift = async (req, res) => {
  try {
    const { name, phone, giftCode, giftTitle } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Vui lòng điền Họ tên và Số điện thoại để nhận quà!" });
    }

    const cleanPhone = String(phone).trim();

    // 1. Lưu vào voucher_claims
    let claimsDoc = await WEBSITE.findOne({ section: 'voucher_claims' });
    if (!claimsDoc) {
      claimsDoc = new WEBSITE({ section: 'voucher_claims', data: [] });
    }

    const newClaim = {
      id: Date.now(),
      voucherCode: giftCode,
      voucherTitle: giftTitle,
      name: name.trim(),
      phone: cleanPhone,
      source: 'quoc_khanh_lucky_box',
      claimedAt: new Date().toISOString()
    };
    claimsDoc.data.push(newClaim);
    claimsDoc.markModified('data');
    await claimsDoc.save();

    // 2. Lưu vào bookings
    let bookingsDoc = await WEBSITE.findOne({ section: 'bookings' });
    if (!bookingsDoc) {
      bookingsDoc = new WEBSITE({ section: 'bookings', data: [] });
    }

    bookingsDoc.data.unshift({
      id: Date.now() + 1,
      name: name.trim(),
      phone: cleanPhone,
      service: `[RÚT THẺ QUÀ 2/9] ${giftCode} - ${giftTitle}`,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      status: 'chua_lien_he',
      source: 'quoc_khanh_lucky_box',
      createdAt: new Date().toISOString()
    });
    bookingsDoc.markModified('data');
    await bookingsDoc.save();

    return res.status(200).json({
      success: true,
      message: "Chúc mừng bạn đã nhận thẻ quà may mắn thành công!",
      data: newClaim
    });
  } catch (error) {
    console.error("Error in claimQuocKhanhGift:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi nhận quà: " + error.message });
  }
};

/**
 * Xóa lời tri ân (Dành cho Quản lý / Admin)
 */
exports.deleteQuocKhanhMessage = async (req, res) => {
  try {
    const { id } = req.params;
    let messagesDoc = await WEBSITE.findOne({ section: 'quoc_khanh_messages' });
    if (!messagesDoc || !Array.isArray(messagesDoc.data)) {
      return res.status(404).json({ success: false, message: "Không tìm thấy danh sách lời tri ân" });
    }

    messagesDoc.data = messagesDoc.data.filter(m => String(m.id) !== String(id) && String(m._id) !== String(id));
    messagesDoc.markModified('data');
    await messagesDoc.save();

    return res.status(200).json({ success: true, message: "Đã xóa lời tri ân thành công", data: messagesDoc.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cập nhật số lượt cờ (Dành cho Quản lý / Admin)
 */
exports.updateQuocKhanhFlags = async (req, res) => {
  try {
    const { count } = req.body;
    const num = Number(count);
    if (isNaN(num) || num < 0) {
      return res.status(400).json({ success: false, message: "Số lượt thắp cờ không hợp lệ" });
    }

    let flagsDoc = await WEBSITE.findOne({ section: 'quoc_khanh_flags' });
    if (!flagsDoc) {
      flagsDoc = new WEBSITE({ section: 'quoc_khanh_flags', data: { count: num } });
    } else {
      flagsDoc.data = { count: num };
      flagsDoc.markModified('data');
    }
    await flagsDoc.save();

    return res.status(200).json({ success: true, message: "Đã cập nhật số lượt thắp cờ thành công", flagCount: num });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cập nhật danh sách ưu đãi 2/9 (Dành cho Quản lý / Admin)
 */
exports.updateQuocKhanhDeals = async (req, res) => {
  try {
    const { deals } = req.body;
    if (!Array.isArray(deals)) {
      return res.status(400).json({ success: false, message: "Dữ liệu ưu đãi phải là một mảng" });
    }

    let dealsDoc = await WEBSITE.findOne({ section: 'quoc_khanh_deals' });
    if (!dealsDoc) {
      dealsDoc = new WEBSITE({ section: 'quoc_khanh_deals', data: deals });
    } else {
      dealsDoc.data = deals;
      dealsDoc.markModified('data');
    }
    await dealsDoc.save();

    return res.status(200).json({ success: true, message: "Đã cập nhật danh sách gói ưu đãi 2/9 thành công", data: dealsDoc.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Cập nhật danh sách hộp quà may mắn 2/9 (Dành cho Quản lý / Admin)
 */
exports.updateQuocKhanhGifts = async (req, res) => {
  try {
    const { gifts } = req.body;
    if (!Array.isArray(gifts)) {
      return res.status(400).json({ success: false, message: "Dữ liệu quà tặng phải là một mảng" });
    }

    let giftsDoc = await WEBSITE.findOne({ section: 'quoc_khanh_gifts' });
    if (!giftsDoc) {
      giftsDoc = new WEBSITE({ section: 'quoc_khanh_gifts', data: gifts });
    } else {
      giftsDoc.data = gifts;
      giftsDoc.markModified('data');
    }
    await giftsDoc.save();

    return res.status(200).json({ success: true, message: "Đã cập nhật danh sách quà may mắn 2/9 thành công", data: giftsDoc.data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

