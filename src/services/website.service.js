const WEBSITE = require("../models/website.model");

exports.getSection = async (req, res) => {
  try {
    const { section } = req.params;
    let websiteData = await WEBSITE.findOne({ section });
    
    if (!websiteData) {
      return res.status(200).json({ success: true, data: [] });
    }

    res.status(200).json({ success: true, data: websiteData.data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const { section } = req.params;
    const { data } = req.body;

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
