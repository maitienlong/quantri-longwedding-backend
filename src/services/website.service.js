const WEBSITE = require("../models/website.model");
const HopDong = require("../models/hopDong.model");
const Album = require("../models/album.model");
const Voucher = require("../models/voucher.model");


// Hàm chuẩn hóa dữ liệu Voucher từ MongoDB sang định dạng Website
// Helper chuẩn hóa số điện thoại về chuỗi số đồng nhất (ví dụ: 0987654321)
function normalizePhoneNumber(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.startsWith('84') && clean.length > 9) {
    clean = '0' + clean.slice(2);
  }
  return clean;
}

// Helper sinh chuỗi ngẫu nhiên ký tự dễ đọc
function generateRandomSuffix(len = 4) {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let str = "";
  for (let i = 0; i < len; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

// Hàm chuẩn hóa dữ liệu Voucher từ MongoDB sang định dạng Website
function formatVoucherForWebsite(v) {
  const isPercent = Number(v.discountType) === 1;
  const valNum = Number(v.discountValue) || 0;
  const discountValStr = isPercent 
    ? `Giảm ${valNum}%` 
    : `Giảm ${valNum.toLocaleString('vi-VN')}đ`;
  const badgeStr = isPercent 
    ? `GIẢM ${valNum}%` 
    : (valNum >= 1000000 
       ? `GIẢM ${(valNum / 1000000).toFixed(1).replace('.0', '')}TR` 
       : `GIẢM ${Math.round(valNum / 1000)}K`);
  
  let expiryStr = '31/12/2026';
  if (v.endDate) {
    const d = new Date(v.endDate);
    if (!isNaN(d.getTime())) {
      expiryStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    }
  }

  const minOrderNum = Number(v.minOrderValue) || 0;
  const minOrderStr = minOrderNum > 0 
    ? `Đơn từ ${minOrderNum.toLocaleString('vi-VN')} đ` 
    : 'Mọi hợp đồng dịch vụ';

  return {
    id: v._id ? v._id.toString() : (v.id || v.code),
    _id: v._id,
    code: v.code,
    title: v.title,
    value: discountValStr,
    badge: badgeStr,
    desc: v.description || (minOrderNum > 0 ? `Áp dụng cho đơn từ ${minOrderNum.toLocaleString('vi-VN')} đ.` : 'Áp dụng cho tất cả các dịch vụ cưới tại Long Wedding Studio.'),
    minOrder: minOrderStr,
    minOrderValue: minOrderNum,
    discountType: isPercent ? 'percent' : 'fixed',
    discountValue: valNum,
    maxDiscount: Number(v.maxDiscount) || 0,
    quantity: v.usageLimit ? Number(v.usageLimit) : 999,
    claimedCount: Number(v.usedCount) || 0,
    usedCount: Number(v.usedCount) || 0,
    winningRate: Number(v.winningRate !== undefined ? v.winningRate : 50),
    isActive: v.isActive !== false,
    active: v.isActive !== false,
    expiry: expiryStr,
    expiryDate: v.endDate ? (typeof v.endDate === 'string' ? v.endDate : v.endDate.toISOString().split('T')[0]) : '2026-12-31'
  };
}

// Dữ liệu mặc định Quốc Khánh 2/9 (Kỷ niệm 81 năm)
const DEFAULT_QUOC_KHANH_MESSAGES = [];

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


// Dữ liệu mẫu thiệp cưới online mặc định (E-Invitation Templates)
const DEFAULT_INVITATION_TEMPLATES = [
  {
    id: 'tpl-luxury-gold',
    code: 'VIP-GOLD-01',
    name: 'Hoàng Gia & Ánh Kim (Luxury Gold)',
    category: 'Hoàng Gia',
    themeId: 'luxury-gold',
    thumbnail: 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1519741497674-611481863552?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    accessType: 'vip',
    price: '299.000đ',
    badge: 'ĐẶC QUYỀN VIP',
    requiredPackage: 'Gói Chụp Ảnh Cưới / Trọn Gói Studio',
    description: 'Thiết kế quý phái với viền nhũ vàng kim vương giả, hoa văn Baroque tinh tế và phong cách hoàng gia Châu Âu.',
    primaryColor: '#D4AF37',
    secondaryColor: '#1A1A1A',
    bgType: 'dark-gold',
    musicUrl: 'https://assets.mixkit.co/music/preview/mixkit-wedding-waltz-1498.mp3',
    musicTitle: 'Wedding Waltz - Lãng Mạn Hoàng Gia',
    isActive: true,
    isPopular: true
  },
  {
    id: 'tpl-romantic-rose',
    code: 'VIP-ROSE-02',
    name: 'Nàng Thơ & Hoa Hồng (Romantic Rose)',
    category: 'Lãng Mạn',
    themeId: 'romantic-rose',
    thumbnail: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1583939003579-730e3918a45a?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    accessType: 'vip',
    price: '250.000đ',
    badge: 'ĐẶC QUYỀN VIP',
    requiredPackage: 'Khách Hàng Studio Long Wedding',
    description: 'Sắc hồng pastel ngọt ngào, cánh hoa hồng bay nhẹ nhàng tạo cảm giác thơ mộng như câu chuyện cổ tích.',
    primaryColor: '#E07A5F',
    secondaryColor: '#FFF1F2',
    bgType: 'rose-blush',
    musicUrl: 'https://assets.mixkit.co/music/preview/mixkit-beautiful-dream-493.mp3',
    musicTitle: 'Beautiful Dream - Nhạc Cưới Dịu Êm',
    isActive: true,
    isPopular: true
  },
  {
    id: 'tpl-modern-minimal',
    code: 'FREE-MINIMAL-01',
    name: 'Tối Giản & Thanh Lịch (Modern Minimalist)',
    category: 'Hiện Đại',
    themeId: 'modern-minimal',
    thumbnail: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1511285560929-80b456fea0bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    accessType: 'free',
    price: '0đ (Miễn Phí)',
    badge: 'MIỄN PHÍ',
    requiredPackage: 'Mọi Khách Hàng',
    description: 'Phong cách tối giản chuẩn tạp chí thời trang quốc tế, chú trọng typography hiện đại và bố cục tinh gọn.',
    primaryColor: '#2B2D42',
    secondaryColor: '#F8F9FA',
    bgType: 'clean-white',
    musicUrl: 'https://assets.mixkit.co/music/preview/mixkit-serene-view-443.mp3',
    musicTitle: 'Serene View - Giai Điệu Trong Trẻo',
    isActive: true,
    isPopular: false
  },
  {
    id: 'tpl-botanical-garden',
    code: 'FREE-BOTANIC-02',
    name: 'Cỏ Hoa & Thảo Mộc (Botanical Garden)',
    category: 'Rustic',
    themeId: 'botanical-garden',
    thumbnail: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1606800052052-a08af7148866?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    accessType: 'free',
    price: '0đ (Miễn Phí)',
    badge: 'MIỄN PHÍ',
    requiredPackage: 'Mọi Khách Hàng',
    description: 'Họa tiết cành lá bạch đàn watercolor tươi mát, mộc mạc và gần gũi, hoàn hảo cho tiệc cưới ngoài trời.',
    primaryColor: '#2D6A4F',
    secondaryColor: '#F4F7F5',
    bgType: 'sage-green',
    musicUrl: 'https://assets.mixkit.co/music/preview/mixkit-acoustic-guitar-dream-2342.mp3',
    musicTitle: 'Acoustic Guitar - Nhẹ Nhàng Mộc Mạc',
    isActive: true,
    isPopular: true
  },
  {
    id: 'tpl-royal-red',
    code: 'VIP-RED-03',
    name: 'Son Hỷ & Á Đông (Royal Crimson)',
    category: 'Truyền Thống',
    themeId: 'royal-red',
    thumbnail: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1544077960-604201fe74bc?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    accessType: 'vip',
    price: '280.000đ',
    badge: 'ĐẶC QUYỀN VIP',
    requiredPackage: 'Gói Chụp Áo Dài / Trọn Gói VIP',
    description: 'Sắc đỏ son hỷ sự kết hợp nhũ vàng kim may mắn, hoa văn cổ điển tượng trưng cho tình duyên sắt son viên mãn.',
    primaryColor: '#C9184A',
    secondaryColor: '#FFF0F3',
    bgType: 'crimson-gold',
    musicUrl: 'https://assets.mixkit.co/music/preview/mixkit-traditional-oriental-flute-and-harp-2900.mp3',
    musicTitle: 'Oriental Harmony - Lễ Hỷ Sum Vầy',
    isActive: true,
    isPopular: false
  },
  {
    id: 'tpl-korean-pastel',
    code: 'VIP-PASTEL-04',
    name: 'Hàn Quốc Dịu Êm (Korean Pastel)',
    category: 'Hàn Quốc',
    themeId: 'korean-pastel',
    thumbnail: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    coverImage: 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80',
    accessType: 'paid',
    price: '199.000đ',
    badge: 'TRẢ PHÍ / VIP',
    requiredPackage: 'Mở Khóa Theo Yêu Cầu',
    description: 'Tông màu pastel trong trẻo kiểu Hàn Quốc, tạo cảm giác tinh khôi, trẻ trung và thanh thoát.',
    primaryColor: '#7B2CBF',
    secondaryColor: '#F8F7FF',
    bgType: 'pastel-dream',
    musicUrl: 'https://assets.mixkit.co/music/preview/mixkit-piano-reflections-148.mp3',
    musicTitle: 'Piano Reflections - Tình Yêu Thuần Khiết',
    isActive: true,
    isPopular: false
  }
];

exports.getSection = async (req, res) => {
  try {
    const { section } = req.params;
    let websiteData = await WEBSITE.findOne({ section });
    
    let data = websiteData ? websiteData.data : [];

    // Mẫu Thiệp Mời Cưới Online (E-Invitation Templates)
    if (section === 'invitation-templates') {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        data = DEFAULT_INVITATION_TEMPLATES;
        try {
          await WEBSITE.findOneAndUpdate(
            { section: 'invitation-templates' },
            { section: 'invitation-templates', data: DEFAULT_INVITATION_TEMPLATES },
            { upsert: true, new: true }
          );
        } catch (e) {
          console.warn("Lỗi lưu mẫu thiệp mặc định vào DB:", e.message);
        }
      }
      return res.status(200).json({ success: true, data });
    }


        // Fallback cho Slide Banner trang chủ nếu chưa có trong DB
    if (section === 'banners') {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        data = DEFAULT_BANNER_SLIDES;
      }
      return res.status(200).json({ success: true, data });
    }

    // Lời Tri Ân Đại Lễ Quốc Khánh - Chỉ lấy dữ liệu thật, loại bỏ dữ liệu mẫu
    if (section === 'quoc_khanh_messages') {
      const sampleNames = ['Nguyễn Văn Hùng', 'Trần Thị Mai & Lê Quang', 'Đoàn Thanh Niên', 'Phạm Hương Giang', 'Hoàng Minh & Thảo Ly'];
      const sampleIds = [1, 2, 3, 4, 5, '1', '2', '3', '4', '5'];
      const realData = (Array.isArray(data) ? data : []).filter(m => !sampleNames.includes(m?.name) && !sampleIds.includes(m?.id));
      return res.status(200).json({ success: true, data: realData });
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

    // Trả về Voucher từ bảng quản trị Voucher hoặc từ Website Section
    if (section === 'vouchers' || section === 'event_vouchers') {
      try {
        const now = new Date();
        const dbVouchers = await Voucher.find({ 
          isActive: true,
          $and: [
            { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
            { $or: [{ endDate: null }, { endDate: { $gte: now } }] }
          ]
        }).sort({ createdAt: -1 });

        if (dbVouchers && dbVouchers.length > 0) {
          const formatted = dbVouchers.map(formatVoucherForWebsite);
          return res.status(200).json({ success: true, data: formatted });
        }
      } catch (err) {
        console.error("Error fetching vouchers from Voucher model:", err);
      }
      return res.status(200).json({ success: true, data: data && data.length > 0 ? data : [] });
    }

    if (section === 'quoc_khanh_gifts') {
      try {
        const activeVouchers = await Voucher.find({ isActive: true }).sort({ createdAt: -1 });
        if (activeVouchers && activeVouchers.length > 0) {
          const giftsFromVouchers = activeVouchers.map(v => ({
            title: v.title,
            code: v.code,
            value: Number(v.discountType) === 1 ? `Giảm ${v.discountValue}%` : `Giảm ${Number(v.discountValue).toLocaleString('vi-VN')}đ`,
            desc: v.description || (v.minOrderValue > 0 ? `Đơn từ ${Number(v.minOrderValue).toLocaleString('vi-VN')}đ` : 'Áp dụng mọi dịch vụ')
          }));
          return res.status(200).json({ success: true, data: giftsFromVouchers });
        }
      } catch (e) {}

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
    const normPhone = normalizePhoneNumber(cleanPhone);

    // 1. Kiểm tra xem Số điện thoại hoặc IP đã từng nhận mã voucher trước đó hay chưa
    let claimsData = await WEBSITE.findOne({ section: 'voucher_claims' });
    if (!claimsData) {
      claimsData = new WEBSITE({ section: 'voucher_claims', data: [] });
    }

    const existingClaim = claimsData.data.find(c => normalizePhoneNumber(c.phone) === normPhone);
    let existingVoucherWithSubCode = null;

    if (!existingClaim && normPhone) {
      try {
        existingVoucherWithSubCode = await Voucher.findOne({
          "generatedCodes.claimedPhone": { $regex: new RegExp(normPhone.slice(-9) + '$') }
        });
      } catch (err) {}
    }

    const hasClaimedByIp = clientIp && clientIp !== '127.0.0.1' && clientIp !== '::1' && clientIp !== 'localhost'
      ? claimsData.data.some(c => c.ip === clientIp) 
      : false;

    if (existingClaim || existingVoucherWithSubCode || hasClaimedByIp) {
      return res.status(400).json({ 
        success: false, 
        alreadyClaimed: true,
        message: `Số điện thoại ${cleanPhone} đã từng nhận mã Voucher trước đó! Mỗi số điện thoại chỉ được nhận 1 mã voucher khi quay thưởng.` 
      });
    }

    // 2. Check Voucher model first
    const cleanCode = voucherCode ? String(voucherCode).trim().toUpperCase() : null;
    let targetVoucherDoc = null;

    if (cleanCode || voucherId) {
      try {
        const query = cleanCode ? { code: cleanCode } : { _id: voucherId };
        targetVoucherDoc = await Voucher.findOne(query);
      } catch (err) {}
    }

    if (targetVoucherDoc) {
      if (targetVoucherDoc.usageLimit && targetVoucherDoc.usageLimit > 0 && targetVoucherDoc.usedCount >= targetVoucherDoc.usageLimit) {
        return res.status(400).json({ 
          success: false, 
          isOutStock: true,
          message: "Đã hết số lượng ưu đãi, Quý khách có thể trải nghiệm dịch vụ trên website của Long Wedding, hoặc liên hệ đến cửa hàng để có những ưu đãi khác" 
        });
      }
      await targetVoucherDoc.save();

      const formatted = formatVoucherForWebsite(targetVoucherDoc);

      const newClaim = {
        id: Date.now(),
        voucherId: targetVoucherDoc._id,
        voucherCode: targetVoucherDoc.code,
        voucherTitle: targetVoucherDoc.title,
        name,
        phone: cleanPhone,
        address: address || '',
        ip: clientIp,
        claimedAt: new Date().toISOString()
      };
      claimsData.data.push(newClaim);
      claimsData.markModified('data');
      await claimsData.save();

      let bookingsData = await WEBSITE.findOne({ section: 'bookings' });
      if (!bookingsData) {
        bookingsData = new WEBSITE({ section: 'bookings', data: [] });
      }
      bookingsData.data.push({
        id: Date.now() + 1,
        name,
        phone: cleanPhone,
        address: address || '',
        service: `[SĂN VOUCHER] ${targetVoucherDoc.code} - ${formatted.value}`,
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
        voucherCode: targetVoucherDoc.code,
        voucher: formatted
      });
    }

    // Fallback: Fetch vouchers section
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

    const sampleNames = ['Nguyễn Văn Hùng', 'Trần Thị Mai & Lê Quang', 'Đoàn Thanh Niên', 'Phạm Hương Giang', 'Hoàng Minh & Thảo Ly'];
    const sampleIds = [1, 2, 3, 4, 5, '1', '2', '3', '4', '5'];
    let messages = (messagesDoc && Array.isArray(messagesDoc.data))
      ? messagesDoc.data.filter(m => !sampleNames.includes(m?.name) && !sampleIds.includes(m?.id))
      : [];

    let flagCount = DEFAULT_QUOC_KHANH_FLAGS;
    if (flagsDoc) {
      if (typeof flagsDoc.data === 'number') flagCount = flagsDoc.data;
      else if (flagsDoc.data && typeof flagsDoc.data.count === 'number') flagCount = flagsDoc.data.count;
    }

    let deals = dealsDoc && Array.isArray(dealsDoc.data) && dealsDoc.data.length > 0 
      ? dealsDoc.data 
      : DEFAULT_QUOC_KHANH_DEALS;

    let gifts = [];
    try {
      const activeVouchers = await Voucher.find({ isActive: true }).sort({ createdAt: -1 });
      if (activeVouchers && activeVouchers.length > 0) {
        gifts = activeVouchers.map(v => ({
          title: v.title,
          code: v.code,
          value: Number(v.discountType) === 1 ? `Giảm ${v.discountValue}%` : `Giảm ${Number(v.discountValue).toLocaleString('vi-VN')}đ`,
          desc: v.description || (v.minOrderValue > 0 ? `Đơn từ ${Number(v.minOrderValue).toLocaleString('vi-VN')}đ` : 'Áp dụng mọi dịch vụ')
        }));
      }
    } catch (e) {}

    if (gifts.length === 0) {
      gifts = giftsDoc && Array.isArray(giftsDoc.data) && giftsDoc.data.length > 0 
        ? giftsDoc.data 
        : DEFAULT_QUOC_KHANH_GIFTS;
    }

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
 * Gửi lời tri ân mừng Quốc Khánh: Backend chọn chương trình và cấp 1 mã code độc nhất thuộc chương trình đó
 */
exports.addQuocKhanhTribute = async (req, res) => {
  try {
    const { name, phone, province, commune, hamlet, location, text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập nội dung lời tri ân / chúc mừng!" });
    }

    const cleanName = (name && name.trim()) ? name.trim() : 'Người con Đất Việt';
    const cleanPhone = phone ? String(phone).trim() : '';
    const normPhone = normalizePhoneNumber(cleanPhone);
    const cleanLocation = location ? String(location).trim() : 'Việt Nam';

    // 1. Kiểm tra xem SĐT này đã từng gửi lời chúc hoặc nhận voucher trước đó chưa (Mỗi SĐT chỉ được gửi 1 lần)
    let messagesDoc = await WEBSITE.findOne({ section: 'quoc_khanh_messages' });
    if (!messagesDoc) {
      messagesDoc = new WEBSITE({ section: 'quoc_khanh_messages', data: [] });
    }

    let claimsDoc = await WEBSITE.findOne({ section: 'voucher_claims' });
    if (!claimsDoc) {
      claimsDoc = new WEBSITE({ section: 'voucher_claims', data: [] });
    }

    const existingMessage = normPhone && Array.isArray(messagesDoc.data) 
      ? messagesDoc.data.find(m => normalizePhoneNumber(m.phone) === normPhone) 
      : null;
    const existingClaim = normPhone && Array.isArray(claimsDoc.data) 
      ? claimsDoc.data.find(c => normalizePhoneNumber(c.phone) === normPhone) 
      : null;

    let existingVoucherDoc = null;
    let existingSubCode = null;

    if (!existingClaim && normPhone) {
      try {
        const vDoc = await Voucher.findOne({
          "generatedCodes.claimedPhone": { $regex: new RegExp(normPhone.slice(-9) + '$') }
        });
        if (vDoc && Array.isArray(vDoc.generatedCodes)) {
          existingSubCode = vDoc.generatedCodes.find(c => normalizePhoneNumber(c.claimedPhone) === normPhone);
          if (existingSubCode) {
            existingVoucherDoc = vDoc;
          }
        }
      } catch (err) {}
    }

    // NẾU SĐT ĐÃ TỒN TẠI (ĐÃ GỬI LỜI CHÚC TRƯỚC ĐÓ HOẶC ĐÃ CÓ MÃ VOUCHER)
    if (existingMessage || existingClaim || (existingSubCode && existingVoucherDoc)) {
      let existingVoucher = null;
      if (existingClaim) {
        existingVoucher = {
          id: existingClaim.voucherId || 'existing',
          code: existingClaim.voucherCode,
          title: existingClaim.voucherTitle || 'Voucher Tri Ân',
          value: existingClaim.voucherValue || existingClaim.voucherTitle || 'Ưu đãi Tri Ân'
        };
      } else if (existingSubCode && existingVoucherDoc) {
        existingVoucher = {
          ...formatVoucherForWebsite(existingVoucherDoc),
          code: existingSubCode.code,
          assignedCode: existingSubCode.code
        };
      } else if (existingMessage && existingMessage.voucherCode) {
        existingVoucher = {
          code: existingMessage.voucherCode,
          title: existingMessage.voucherTitle || 'Voucher Tri Ân',
          value: existingMessage.voucherValue || 'Ưu đãi Tri Ân'
        };
      }

      return res.status(200).json({
        success: false,
        alreadySubmitted: true,
        message: "Cảm ơn bạn đã gửi lời chúc. Lời chúc của bạn đã được ghi nhận trước đó, xin cảm ơn",
        voucher: existingVoucher
      });
    }

    let selectedVoucher = null;
    // SĐT mới chưa từng nhận Voucher -> Tiến hành rút Voucher mới từ Database
    const now = new Date();
    try {
      const activeVouchers = await Voucher.find({
        isActive: true,
        $and: [
          { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
          { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
          { $or: [{ usageLimit: null }, { usageLimit: 0 }, { $expr: { $lt: ["$usedCount", "$usageLimit"] } }] }
        ]
      }).sort({ createdAt: -1 });

      if (activeVouchers && activeVouchers.length > 0) {
        let totalWeight = 0;
        const weightedList = activeVouchers.map(v => {
          const rate = Number(v.winningRate !== undefined ? v.winningRate : 50);
          const weight = rate > 0 ? rate : 10;
          totalWeight += weight;
          return { voucher: v, weight };
        });

        let randomNum = Math.random() * totalWeight;
        let chosenVoucherDoc = null;

        for (const item of weightedList) {
          if (randomNum <= item.weight) {
            chosenVoucherDoc = item.voucher;
            break;
          }
          randomNum -= item.weight;
        }

        if (!chosenVoucherDoc) {
          chosenVoucherDoc = activeVouchers[Math.floor(Math.random() * activeVouchers.length)];
        }

        if (!chosenVoucherDoc.generatedCodes) {
          chosenVoucherDoc.generatedCodes = [];
        }

        let assignedCode = null;
        const availableSubCode = chosenVoucherDoc.generatedCodes.find(c => !c.isClaimed && !c.isUsed);

        if (availableSubCode) {
          availableSubCode.isClaimed = true;
          availableSubCode.claimedName = cleanName;
          availableSubCode.claimedPhone = cleanPhone;
          availableSubCode.claimedAt = new Date();
          assignedCode = availableSubCode.code;
        } else {
          const existingSet = new Set(chosenVoucherDoc.generatedCodes.map(c => c.code.toUpperCase()));
          let newCodeStr = '';
          for (let i = 0; i < 20; i++) {
            newCodeStr = `${chosenVoucherDoc.code}-${generateRandomSuffix(4)}`;
            if (!existingSet.has(newCodeStr)) break;
          }
          if (!newCodeStr) newCodeStr = `${chosenVoucherDoc.code}-${Date.now().toString().slice(-4)}`;

          const newSubCodeObj = {
            code: newCodeStr,
            isClaimed: true,
            claimedName: cleanName,
            claimedPhone: cleanPhone,
            claimedAt: new Date(),
            isUsed: false,
            createdAt: new Date()
          };
          chosenVoucherDoc.generatedCodes.push(newSubCodeObj);
          assignedCode = newCodeStr;
        }

        chosenVoucherDoc.markModified('generatedCodes');
        await chosenVoucherDoc.save();

        selectedVoucher = formatVoucherForWebsite(chosenVoucherDoc);
        selectedVoucher.code = assignedCode;
        selectedVoucher.assignedCode = assignedCode;

        // Ghi nhận claim vào voucher_claims cho SĐT mới
        claimsDoc.data.push({
          id: Date.now(),
          voucherId: selectedVoucher._id || selectedVoucher.id,
          voucherCode: selectedVoucher.code,
          voucherTitle: selectedVoucher.title,
          voucherValue: selectedVoucher.value,
          name: cleanName,
          phone: cleanPhone,
          location: cleanLocation,
          source: 'quoc_khanh_tribute',
          claimedAt: new Date().toISOString()
        });
        claimsDoc.markModified('data');
        await claimsDoc.save();
      }
    } catch (err) {
      console.error("Lỗi khi rút voucher trong addQuocKhanhTribute:", err);
    }

    if (selectedVoucher) {
      selectedVoucher.userName = cleanName;
      selectedVoucher.userPhone = cleanPhone;
      selectedVoucher.userLocation = cleanLocation;
      if (!selectedVoucher.claimedAt) {
        selectedVoucher.claimedAt = new Date().toISOString();
      }
    }

    // 2. Tự động thêm vào danh sách Bookings (Leads) nếu có SĐT
    if (cleanPhone) {
      try {
        let bookingsDoc = await WEBSITE.findOne({ section: 'bookings' });
        if (!bookingsDoc) {
          bookingsDoc = new WEBSITE({ section: 'bookings', data: [] });
        }
        bookingsDoc.data.unshift({
          id: Date.now() + 1,
          name: cleanName,
          phone: cleanPhone,
          service: selectedVoucher 
            ? `[TRI ÂN QUỐC KHÁNH 2/9] ${selectedVoucher.title} (${selectedVoucher.code})`
            : `[TRI ÂN QUỐC KHÁNH 2/9] Khách gửi lời tri ân`,
          promoCode: selectedVoucher ? selectedVoucher.code : 'QUOCKHANH2026',
          date: new Date().toISOString().split('T')[0],
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          note: `[LỜI TRI ÂN 2/9]: "${text.trim().substring(0, 150)}" | Địa chỉ: ${cleanLocation}`,
          status: 'chua_lien_he',
          source: 'quoc_khanh_tribute_voucher',
          createdAt: new Date().toISOString()
        });
        bookingsDoc.markModified('data');
        await bookingsDoc.save();
      } catch (e) {}
    }

    // 3. Thêm lời chúc vào mục quoc_khanh_messages
    if (!messagesDoc) {
      messagesDoc = await WEBSITE.findOne({ section: 'quoc_khanh_messages' });
      if (!messagesDoc) {
        messagesDoc = new WEBSITE({ section: 'quoc_khanh_messages', data: [] });
      }
    }

    const newTribute = {
      id: Date.now(),
      name: cleanName,
      phone: cleanPhone,
      province: province || '',
      commune: commune || '',
      hamlet: hamlet || '',
      location: cleanLocation,
      text: text.trim(),
      voucherCode: selectedVoucher ? selectedVoucher.code : null,
      voucherTitle: selectedVoucher ? selectedVoucher.title : null,
      voucherValue: selectedVoucher ? selectedVoucher.value : null,
      time: 'Vừa xong',
      createdAt: new Date().toISOString()
    };

    messagesDoc.data.unshift(newTribute);
    if (messagesDoc.data.length > 500) {
      messagesDoc.data = messagesDoc.data.slice(0, 500);
    }
    messagesDoc.markModified('data');
    await messagesDoc.save();

    // 4. Lưu vào feedback
    try {
      let feedbackDoc = await WEBSITE.findOne({ section: 'feedback' });
      if (!feedbackDoc) {
        feedbackDoc = new WEBSITE({ section: 'feedback', data: [] });
      }
      feedbackDoc.data.unshift({
        id: Date.now() + 2,
        type: 'quoc_khanh_tribute',
        name: cleanName,
        phone: cleanPhone,
        location: cleanLocation,
        text: text.trim(),
        voucherCode: selectedVoucher ? selectedVoucher.code : null,
        voucherTitle: selectedVoucher ? selectedVoucher.title : null,
        createdAt: new Date().toISOString()
      });
      if (feedbackDoc.data.length > 500) {
        feedbackDoc.data = feedbackDoc.data.slice(0, 500);
      }
      feedbackDoc.markModified('data');
      await feedbackDoc.save();
    } catch (e) {}

    // 5. Tự động tăng số lượt thắp sáng cờ Tổ quốc (+1)
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

    if (!selectedVoucher) {
      return res.status(200).json({
        success: true,
        isOutOfVouchers: true,
        message: "Voucher đã hết, cảm ơn quý khách đã quan tâm đến sự kiện. Hẹn quý khách vào sự kiện tiếp theo",
        data: newTribute,
        voucher: null,
        flagCount: currentCount
      });
    }

    return res.status(200).json({
      success: true,
      isOutOfVouchers: false,
      message: "Gửi lời tri ân và nhận Voucher tri ân thành công! 🇻🇳",
      data: newTribute,
      voucher: selectedVoucher,
      flagCount: currentCount
    });
  } catch (error) {
    console.error("Error in addQuocKhanhTribute:", error);
    return res.status(500).json({ success: false, message: "Lỗi khi gửi lời tri ân: " + error.message });
  }
};

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
    const normPhone = normalizePhoneNumber(cleanPhone);

    // 1. Kiểm tra xem SĐT đã nhận quà / voucher trước đó hay chưa
    let claimsDoc = await WEBSITE.findOne({ section: 'voucher_claims' });
    if (!claimsDoc) {
      claimsDoc = new WEBSITE({ section: 'voucher_claims', data: [] });
    }

    const existingClaim = claimsDoc.data.find(c => normalizePhoneNumber(c.phone) === normPhone);
    if (existingClaim) {
      return res.status(400).json({
        success: false,
        alreadyClaimed: true,
        message: `Số điện thoại ${cleanPhone} đã nhận mã voucher trước đó! Mỗi số điện thoại chỉ được nhận 1 mã voucher khi quay thưởng.`
      });
    }

    if (giftCode) {
      // Claimed gift on website (do not inc contract usedCount)
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


/**
 * Kiểm tra & Áp dụng Voucher công khai cho Website
 */
exports.validateVoucherPublic = async (req, res) => {
  try {
    let { code, orderTotal, khachHangId, soDienThoai } = req.body;
    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập mã Voucher" });
    }

    code = code.trim().toUpperCase().replace(/\s+/g, '');
    
    // Tìm theo mã chính hoặc mã con trong generatedCodes
    const voucher = await Voucher.findOne({
      $or: [
        { code },
        { "generatedCodes.code": code }
      ]
    });

    if (!voucher) {
      return res.status(404).json({ success: false, message: `Mã Voucher "${code}" không tồn tại trên hệ thống` });
    }

    // Kiểm tra mã con đã dùng chưa
    let matchedSubCode = null;
    if (Array.isArray(voucher.generatedCodes)) {
      matchedSubCode = voucher.generatedCodes.find(c => c.code.toUpperCase() === code);
    }
    if (matchedSubCode && matchedSubCode.isUsed) {
      return res.status(400).json({ success: false, message: `Mã code "${code}" này đã được sử dụng trước đó` });
    }

    if (!voucher.isActive) {
      return res.status(400).json({ success: false, message: `Voucher "${code}" hiện đang tạm ngừng áp dụng` });
    }

    const now = new Date();
    if (voucher.startDate && new Date(voucher.startDate) > now) {
      return res.status(400).json({ success: false, message: `Voucher "${code}" chỉ có hiệu lực từ ngày ${new Date(voucher.startDate).toLocaleDateString('vi-VN')}` });
    }

    if (voucher.endDate && new Date(voucher.endDate) < now) {
      return res.status(400).json({ success: false, message: `Voucher "${code}" đã hết hạn sử dụng vào ngày ${new Date(voucher.endDate).toLocaleDateString('vi-VN')}` });
    }

    if (!matchedSubCode && voucher.usageLimit && voucher.usageLimit > 0 && voucher.usedCount >= voucher.usageLimit) {
      return res.status(400).json({ success: false, message: `Voucher "${code}" đã hết lượt sử dụng` });
    }

    const total = Number(orderTotal) || 0;
    if (voucher.minOrderValue && total < voucher.minOrderValue) {
      return res.status(400).json({ success: false, message: `Voucher "${code}" yêu cầu đơn hàng từ ${voucher.minOrderValue.toLocaleString('vi-VN')} đ` });
    }

    let discountAmount = 0;
    if (Number(voucher.discountType) === 1) {
      discountAmount = (total * voucher.discountValue) / 100;
      if (voucher.maxDiscount && voucher.maxDiscount > 0 && discountAmount > voucher.maxDiscount) {
        discountAmount = voucher.maxDiscount;
      }
    } else {
      discountAmount = voucher.discountValue;
    }

    discountAmount = Math.min(total, Math.round(discountAmount));
    const finalTotal = Math.max(0, total - discountAmount);

    return res.status(200).json({
      success: true,
      message: `Áp dụng mã Voucher "${code}" thành công!`,
      data: {
        voucher: {
          ...formatVoucherForWebsite(voucher),
          appliedCode: code,
          isSubCode: Boolean(matchedSubCode)
        },
        discountAmount,
        finalTotal
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
