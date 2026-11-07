// Test verification for PR 1.1 Security Hardening
const http = require('http');
const assert = require('assert');
const app = require('../src/index');

async function runTests() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🧪 Test Server running on port ${port}`);

  let passed = 0;
  let failed = 0;

  async function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      const req = http.request(url, { method, headers: reqHeaders }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch(e) { json = data; }
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        });
      });
      req.on('error', reject);
      if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
      req.end();
    });
  }

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. T-SEC01: GET /api/album/admin/list without token
  await test('T-SEC01: GET /api/album/admin/list without token returns 401', async () => {
    const res = await request('GET', '/api/album/admin/list');
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 2. GET /loaiHopDong/findAll without token returns 401
  await test('GET /loaiHopDong/findAll without token returns 401', async () => {
    const res = await request('POST', '/loaiHopDong/findAll', {});
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 3. POST /loaiHopDong/create without token returns 401
  await test('POST /loaiHopDong/create without token returns 401', async () => {
    const res = await request('POST', '/loaiHopDong/create', { tenLoaiHopDong: "HĐ VIP" });
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 4. GET /loaiDichVu/list without token returns 401
  await test('GET /loaiDichVu/list without token returns 401', async () => {
    const res = await request('GET', '/loaiDichVu/list');
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 5. POST /donViNhanTien/create without token returns 401
  await test('POST /donViNhanTien/create without token returns 401', async () => {
    const res = await request('POST', '/donViNhanTien/create', { tenDonVi: "Tài khoản giả" });
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 6. POST /api/album/download-base64 without token returns 401
  await test('POST /api/album/download-base64 without token returns 401', async () => {
    const res = await request('POST', '/api/album/download-base64', { idDrive: "12345678901234567" });
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 7. GET /api/visitors/logs without token returns 401
  await test('GET /api/visitors/logs without token returns 401', async () => {
    const res = await request('GET', '/api/visitors/logs');
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 8. GET /api/visitors/blocked without token returns 401
  await test('GET /api/visitors/blocked without token returns 401', async () => {
    const res = await request('GET', '/api/visitors/blocked');
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 9. GET /api/thiep-cuoi/:id/rsvp without token returns 401
  await test('GET /api/thiep-cuoi/thiep-123/rsvp without token returns 401', async () => {
    const res = await request('GET', '/api/thiep-cuoi/thiep-123/rsvp');
    assert.strictEqual(res.status, 401, `Expected status 401, got ${res.status}`);
  });

  // 10. T-SEC06: SSRF Test with valid JWT token but SSRF dangerous payload
  await test('T-SEC06: POST /api/album/download-base64 with loopback/internal IP is blocked (400 or 403)', async () => {
    const jwt = require('jsonwebtoken');
    const User = require('../src/models/user.model');
    const origFindOne = User.findOne;
    User.findOne = function(query) {
      if (query && query.username === 'testuser') {
        return {
          select: () => Promise.resolve({
            username: 'testuser',
            fullname: 'Tester',
            positon: 'Admin',
            permission: 1,
            tokenVersion: 0
          })
        };
      }
      return origFindOne.apply(this, arguments);
    };

    const token = jwt.sign({ username: 'testuser', fullname: 'Tester', positon: 'Admin', tokenVersion: 0 }, process.env.JWT_SECRET || 'secret');
    const authHeaders = { Authorization: `Bearer ${token}` };

    try {
      // Test loopback SSRF
      const res1 = await request('POST', '/api/album/download-base64', { url: 'http://127.0.0.1:5000/auth/findUsers' }, authHeaders);
      assert.ok(res1.status === 400 || res1.status === 403, `Loopback must be blocked, got ${res1.status}`);

      // Test AWS metadata SSRF
      const res2 = await request('POST', '/api/album/download-base64', { url: 'http://169.254.169.254/latest/meta-data/' }, authHeaders);
      assert.ok(res2.status === 400 || res2.status === 403, `Metadata must be blocked, got ${res2.status}`);

      // Test invalid drive ID format
      const res3 = await request('POST', '/api/album/download-base64', { idDrive: 'bad_id;rm -rf' }, authHeaders);
      assert.ok(res3.status === 400, `Bad idDrive format must be rejected with 400, got ${res3.status}`);
    } finally {
      User.findOne = origFindOne;
    }
  });

  server.close();
  console.log(`\n========================================`);
  console.log(`TỔNG KẾT KIỂM THỬ: ${passed} PASSED / ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

