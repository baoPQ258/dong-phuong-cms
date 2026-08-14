/**
 * Script import "Sổ gốc cấp chứng chỉ" (file .xlsx) vào Strapi.
 * Dùng lại được cho MỌI đợt thi — chỉ cần đổi đường dẫn file khi chạy.
 *
 * CÁCH DÙNG:
 *   1. Cài thư viện đọc Excel (chỉ cần làm 1 lần):
 *        npm install xlsx
 *
 *   2. Tạo API Token trong Strapi Admin:
 *        Settings -> API Tokens -> Create new API Token
 *        - Token type: Full access
 *        - Copy token vừa tạo (chỉ hiện 1 lần duy nhất)
 *
 *   3. Chạy script (thay đường dẫn file và token cho đúng):
 *        node scripts/import-chung-chi.js "C:\duong\dan\file.xlsx" "http://localhost:1338" "<API_TOKEN>"
 *
 *      Khi deploy thật, đổi URL thành link Render:
 *        node scripts/import-chung-chi.js "file.xlsx" "https://dong-phuong-cms.onrender.com" "<API_TOKEN>"
 */

const XLSX = require("xlsx");
const path = require("path");

const [, , filePath, apiUrlArg, apiTokenArg] = process.argv;

const API_URL =
  apiUrlArg || process.env.STRAPI_API_URL || "http://localhost:1338";
const API_TOKEN = apiTokenArg || process.env.STRAPI_API_TOKEN;

if (!filePath) {
  console.error("❌ Thiếu đường dẫn file. Cách dùng:");
  console.error(
    '   node scripts/import-chung-chi.js "duong-dan-file.xlsx" "http://localhost:1338" "API_TOKEN"',
  );
  process.exit(1);
}

if (!API_TOKEN) {
  console.error(
    "❌ Thiếu API Token. Tạo token tại Strapi Admin -> Settings -> API Tokens.",
  );
  process.exit(1);
}

// Chuyển "1/1/1989" hoặc "01/01/1989" thành "1989-01-01" (chuẩn ISO cho Strapi)
function chuyenNgayThangSangISO(chuoi) {
  if (!chuoi) return null;
  const parts = String(chuoi).trim().split("/");
  if (parts.length !== 3) return null;
  const [ngay, thang, nam] = parts;
  return `${nam}-${thang.padStart(2, "0")}-${ngay.padStart(2, "0")}`;
}

function trichNgayThiTuTieuDe(rows) {
  for (const row of rows) {
    for (const cell of row) {
      if (typeof cell === "string" && cell.includes("Khóa thi ngày")) {
        const match = cell.match(/Khóa thi ngày:\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
        if (match) return chuyenNgayThangSangISO(match[1]);
      }
    }
  }
  return null;
}

async function main() {
  console.log(`Đang đọc file: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

  const khoaThiNgay = trichNgayThiTuTieuDe(rows);
  console.log(`Khóa thi ngày: ${khoaThiNgay || "(không tìm thấy, để trống)"}`);

  // Tìm dòng bắt đầu dữ liệu: dòng có cột đầu tiên là số nguyên dương (1, 2, 3...)
  let startRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const firstCell = rows[i][0];
    if (typeof firstCell === "number" && firstCell === 1) {
      startRow = i;
      break;
    }
  }

  if (startRow === -1) {
    console.error(
      "❌ Không tìm thấy dòng dữ liệu bắt đầu (cột đầu tiên = 1). Kiểm tra lại cấu trúc file.",
    );
    process.exit(1);
  }

  // Đọc liên tục cho tới khi gặp dòng không phải số ở cột đầu (hết dữ liệu)
  const banGhi = [];
  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (typeof row[0] !== "number") break;

    const hoTenPhan1 = String(row[1] || "").trim();
    const hoTenPhan2 = String(row[2] || "").trim();

    banGhi.push({
      ho_ten: `${hoTenPhan1} ${hoTenPhan2}`.trim(),
      ngay_sinh: chuyenNgayThangSangISO(row[3]),
      gioi_tinh: String(row[4] || "").trim(),
      cccd: String(row[5] || "").trim(),
      diem_trac_nghiem: parseFloat(row[6]) || null,
      diem_thuc_hanh: parseFloat(row[7]) || null,
      so_hieu_chung_chi: String(row[8] || "").trim(),
      so_vao_so_goc: String(row[9] || "").trim(),
      khoa_thi_ngay: khoaThiNgay,
      trang_thai: "hoan_thanh",
      ghi_chu: String(row[11] || "").trim() || null,
    });
  }

  console.log(`Tìm thấy ${banGhi.length} bản ghi. Bắt đầu import...`);

  let thanhCong = 0;
  let boQua = 0;
  let loi = 0;

  for (const record of banGhi) {
    if (!record.cccd || !record.so_hieu_chung_chi) {
      console.log(
        `⚠️  Bỏ qua (thiếu CCCD hoặc số hiệu chứng chỉ): ${record.ho_ten}`,
      );
      boQua++;
      continue;
    }

    try {
      const res = await fetch(`${API_URL}/api/chung-chis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_TOKEN}`,
        },
        body: JSON.stringify({
          data: {
            ...record,
            publishedAt: new Date().toISOString(), // publish ngay, không để nháp
          },
        }),
      });

      if (res.ok) {
        thanhCong++;
        console.log(`✅ ${record.ho_ten} (${record.so_hieu_chung_chi})`);
      } else {
        const errBody = await res.text();
        loi++;
        console.log(`❌ Lỗi với ${record.ho_ten}: ${res.status} - ${errBody}`);
      }
    } catch (err) {
      loi++;
      console.log(`❌ Lỗi kết nối với ${record.ho_ten}: ${err.message}`);
    }
  }

  console.log("\n===== KẾT QUẢ =====");
  console.log(`✅ Thành công: ${thanhCong}`);
  console.log(`⚠️  Bỏ qua (thiếu dữ liệu): ${boQua}`);
  console.log(`❌ Lỗi: ${loi}`);
}

main();
