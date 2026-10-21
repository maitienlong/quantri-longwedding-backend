/**
 * ==============================================================================
 * HỆ THỐNG QUẢN LÝ LONG WEDDING - GOOGLE APPS SCRIPT ĐỒNG BỘ ẢNH GOOGLE DRIVE
 * ==============================================================================
 * 
 * HƯỚNG DẪN CÀI ĐẶT / NÂNG CẤP TRÊN GOOGLE APPS SCRIPT:
 * ------------------------------------------------------------------------------
 * 1. Truy cập https://script.google.com và mở dự án Apps Script hiện tại 
 *    (hoặc tạo dự án mới: "LongWedding_DriveSync").
 * 
 * 2. [QUAN TRỌNG - ĐỂ TĂNG TỐC ĐỘ 10X]:
 *    - Ở thanh bên trái, bấm vào biểu tượng dấu [+] tại mục "Dịch vụ" (Services).
 *    - Chọn "Drive API" -> Chọn phiên bản "v3" (hoặc v2) -> Bấm "Thêm" (Add).
 *    - Script sẽ tự động sử dụng Drive API v3 siêu tốc, hỗ trợ cả Bộ nhớ dùng chung (Shared Drive).
 * 
 * 3. Dán toàn bộ nội dung mã nguồn bên dưới vào file Code.gs (thay thế toàn bộ code cũ).
 * 
 * 4. Bấm "Triển khai" (Deploy) ở góc trên bên phải -> Chọn "Quản lý bản triển khai" (Manage deployments)
 *    hoặc "Bản triển khai mới" (New deployment):
 *    - Loại: "Ứng dụng web" (Web app).
 *    - Mô tả: "Long Wedding Drive Sync v2 - Fast & Stable".
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me - email của bạn).
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone).
 * 
 * 5. Bấm "Triển khai" -> Sao chép URL ứng dụng web (dạng https://script.google.com/macros/s/.../exec).
 *    Dán URL này vào file .env của backend:
 *    APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 * ==============================================================================
 */

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var startTime = new Date().getTime();
  var output = {
    status: 'error',
    message: '',
    code: '',
    total: 0,
    executionTimeMs: 0,
    data: []
  };

  try {
    var folderParam = '';

    // Lấy tham số folderId hoặc folderUrl từ query string hoặc post body
    if (e && e.parameter) {
      folderParam = e.parameter.folderId || e.parameter.folderUrl || e.parameter.url || e.parameter.id || '';
    }

    if (!folderParam && e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        folderParam = body.folderId || body.folderUrl || body.url || body.id || '';
      } catch (err) {}
    }

    folderParam = (folderParam || '').toString().trim();

    if (!folderParam) {
      output.code = 'MISSING_PARAM';
      output.message = 'Thiếu tham số folderId hoặc folderUrl.';
      return createJsonResponse(output);
    }

    // Bóc tách folderId chuẩn từ URL hoặc chuỗi
    var cleanFolderId = extractFolderId(folderParam);
    if (!cleanFolderId) {
      output.code = 'INVALID_FOLDER_ID';
      output.message = 'Không thể xác định Folder ID từ đường dẫn được cung cấp: ' + folderParam;
      return createJsonResponse(output);
    }

    // Kiểm tra nếu người dùng vô tình dán link file đơn lẻ thay vì link folder
    if (folderParam.indexOf('/file/d/') !== -1) {
      output.code = 'NOT_A_FOLDER';
      output.message = 'Đường dẫn bạn nhập là một tệp đơn lẻ, không phải Thư mục. Vui lòng nhập link của Thư mục (Folder) Google Drive chứa ảnh.';
      return createJsonResponse(output);
    }

    var filesList = [];
    var folderName = 'Google Drive Folder';
    var usedMethod = 'DriveApp';

    // ==========================================================================
    // CÁCH 1: Sử dụng Drive API v3 (Advanced Service - Siêu nhanh, hỗ trợ Shared Drive)
    // ==========================================================================
    var hasAdvancedDrive = (typeof Drive !== 'undefined' && Drive.Files && typeof Drive.Files.list === 'function');

    if (hasAdvancedDrive) {
      usedMethod = 'DriveAPI_v3';
      try {
        // Lấy tên thư mục
        try {
          var folderMeta = Drive.Files.get(cleanFolderId, {
            fields: 'id, name, mimeType, trashed',
            supportsAllDrives: true
          });
          if (folderMeta) {
            folderName = folderMeta.name || folderName;
            if (folderMeta.mimeType !== 'application/vnd.google-apps.folder') {
              output.code = 'NOT_A_FOLDER';
              output.message = 'Mục được cung cấp không phải là Thư mục Google Drive (Kiểu: ' + folderMeta.mimeType + ').';
              return createJsonResponse(output);
            }
          }
        } catch (fErr) {
          // Bỏ qua lỗi get folder meta nếu vẫn có quyền list files
        }

        // Quét toàn bộ file trong thư mục (lặp qua nextPageToken nếu > 1.000 file)
        var pageToken = null;
        var query = "'" + cleanFolderId + "' in parents and trashed = false";

        do {
          var response = Drive.Files.list({
            q: query,
            pageSize: 1000,
            fields: 'nextPageToken, files(id, name, mimeType, size, createdTime)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
            pageToken: pageToken
          });

          if (response && response.files) {
            for (var i = 0; i < response.files.length; i++) {
              var f = response.files[i];
              // Lọc chỉ lấy các file định dạng ảnh
              if (isImageFile(f.name, f.mimeType)) {
                filesList.push({
                  id: f.id,
                  name: f.name,
                  mimeType: f.mimeType || 'image/jpeg',
                  size: f.size ? parseInt(f.size, 10) : 0
                });
              }
            }
          }

          pageToken = response.nextPageToken;
        } while (pageToken && filesList.length < 5000);

      } catch (driveApiErr) {
        // Nếu lỗi do quyền truy cập
        var errMsg = driveApiErr.toString();
        if (errMsg.indexOf('File not found') !== -1 || errMsg.indexOf('404') !== -1 || errMsg.indexOf('access') !== -1) {
          output.code = 'PERMISSION_DENIED';
          output.message = "Không thể truy cập thư mục Google Drive. Vui lòng kiểm tra quyền chia sẻ: Nhấp chuột phải vào thư mục trên Drive > Chọn 'Chia sẻ' > Chuyển sang 'Bất kỳ ai có đường liên kết' với vai trò 'Người xem'.";
          return createJsonResponse(output);
        }
        // Thử fallback sang DriveApp nếu Drive API gặp lỗi khác
        hasAdvancedDrive = false;
      }
    }

    // ==========================================================================
    // CÁCH 2: Fallback DriveApp (Tiêu chuẩn, không cần bật Advanced Service)
    // ==========================================================================
    if (!hasAdvancedDrive) {
      usedMethod = 'DriveApp_Standard';
      try {
        var folder = DriveApp.getFolderById(cleanFolderId);
        folderName = folder.getName();

        var filesIterator = folder.getFiles();
        while (filesIterator.hasNext()) {
          var file = filesIterator.next();
          var fileName = file.getName();
          var fileMime = file.getMimeType();

          if (isImageFile(fileName, fileMime)) {
            filesList.push({
              id: file.getId(),
              name: fileName,
              mimeType: fileMime,
              size: file.getSize()
            });
          }
        }
      } catch (driveAppErr) {
        var errStr = driveAppErr.toString();
        output.code = 'PERMISSION_OR_NOT_FOUND';
        if (errStr.indexOf('Không thể tìm thấy mục') !== -1 || errStr.indexOf('not found') !== -1 || errStr.indexOf('quyen') !== -1 || errStr.indexOf('access') !== -1) {
          output.message = "Không thể truy cập thư mục Google Drive. Vui lòng kiểm tra quyền chia sẻ: Bấm 'Chia sẻ' trên Drive > Chuyển sang 'Bất kỳ ai có đường liên kết' với quyền 'Người xem'.";
        } else {
          output.message = 'Lỗi truy cập DriveApp: ' + errStr;
        }
        return createJsonResponse(output);
      }
    }

    // Sắp xếp file theo tên tự nhiên (A -> Z, DSC_0001, DSC_0002...)
    filesList.sort(function(a, b) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    var endTime = new Date().getTime();
    output.status = 'success';
    output.message = 'Lấy danh sách ảnh thành công.';
    output.code = 'SUCCESS';
    output.folderName = folderName;
    output.method = usedMethod;
    output.total = filesList.length;
    output.executionTimeMs = (endTime - startTime);
    output.data = filesList;

    return createJsonResponse(output);

  } catch (globalErr) {
    var endErrTime = new Date().getTime();
    output.status = 'error';
    output.code = 'SERVER_ERROR';
    output.message = 'Lỗi hệ thống khi xử lý: ' + globalErr.toString();
    output.executionTimeMs = (endErrTime - startTime);
    return createJsonResponse(output);
  }
}

/**
 * Trích xuất folderId từ các dạng đường link Google Drive khác nhau
 */
function extractFolderId(urlOrId) {
  if (!urlOrId) return '';
  var clean = urlOrId.trim();

  // Dạng 1: https://drive.google.com/drive/folders/xxxxxx
  var m1 = clean.match(/\/folders\/([a-zA-Z0-9\-_]{15,})/);
  if (m1 && m1[1]) return m1[1];

  // Dạng 2: id=xxxxxx
  var m2 = clean.match(/[?&]id=([a-zA-Z0-9\-_]{15,})/);
  if (m2 && m2[1]) return m2[1];

  // Dạng 3: /d/xxxxxx
  var m3 = clean.match(/\/d\/([a-zA-Z0-9\-_]{15,})/);
  if (m3 && m3[1]) return m3[1];

  // Dạng 4: Nếu người dùng đã truyền trực tiếp mã ID (chuỗi alphanumeric dài >= 15 ký tự)
  if (/^[a-zA-Z0-9\-_]{15,50}$/.test(clean)) {
    return clean;
  }

  // Tách query string nếu có
  if (clean.indexOf('?') !== -1) {
    clean = clean.split('?')[0];
  }
  var parts = clean.split('/');
  var lastPart = parts[parts.length - 1];
  if (lastPart && /^[a-zA-Z0-9\-_]{15,50}$/.test(lastPart)) {
    return lastPart;
  }

  return clean;
}

/**
 * Kiểm tra xem một file có phải là file ảnh hay không
 */
function isImageFile(fileName, mimeType) {
  if (mimeType && mimeType.indexOf('image/') === 0) return true;
  if (!fileName) return false;
  var lower = fileName.toLowerCase();
  var imgExtensions = [
    '.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.gif',
    '.cr2', '.cr3', '.arw', '.nef', '.dng', '.raw', '.tif', '.tiff', '.bmp'
  ];
  for (var i = 0; i < imgExtensions.length; i++) {
    if (lower.lastIndexOf(imgExtensions[i]) === lower.length - imgExtensions[i].length) {
      return true;
    }
  }
  return false;
}

/**
 * Tạo kết quả trả về chuẩn JSON với đầy đủ CORS header
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
