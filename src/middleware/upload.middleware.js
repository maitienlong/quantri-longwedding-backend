const multer = require('multer');
const path = require('path');

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    // Generate unique name
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // Get extension
    const ext = path.extname(file.originalname);
    // Safe filename - replace special characters
    const baseName = path.basename(file.originalname, ext)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-');
    cb(null, `${uniqueSuffix}-${baseName}${ext}`);
  }
});

// File filter (accept images only)
const fileFilter = (req, file, cb) => {
  const isImage = file.mimetype.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(file.originalname);
  const isAudio = file.mimetype.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|flac)$/i.test(file.originalname);

  if (isImage || isAudio) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ cho phép định dạng ảnh (JPG, PNG, WEBP) hoặc âm thanh (MP3, WAV, M4A, OGG)!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

module.exports = upload;
