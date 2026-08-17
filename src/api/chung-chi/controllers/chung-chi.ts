// File: src/api/chung-chi/controllers/chung-chi.ts

import { factories } from "@strapi/strapi";

const rateLimitMap = new Map<string, { count: number; start: number }>();
const LIMIT = 5;
const WINDOW_MS = 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.start > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }

  record.count += 1;
  return record.count > LIMIT;
}

function dinhDangKetQua(ketQua: any) {
  return {
    ho_ten: ketQua.ho_ten,
    ten_chung_chi: ketQua.ten_chung_chi,
    so_hieu_chung_chi: ketQua.so_hieu_chung_chi,
    so_vao_so_goc: ketQua.so_vao_so_goc,
    khoa_thi_ngay: ketQua.khoa_thi_ngay,
    trang_thai: ketQua.trang_thai,
    file_chung_chi_url: ketQua.file_chung_chi?.url ?? null,
  };
}

export default factories.createCoreController(
  "api::chung-chi.chung-chi",
  ({ strapi }) => ({
    async traCuu(ctx) {
      const ip = ctx.request.ip;

      if (isRateLimited(ip)) {
        return ctx.tooManyRequests(
          "Ban da tra cuu qua nhieu lan. Vui long thu lai sau 1 phut.",
        );
      }

      const { cccd, ho_ten, ngay_sinh } = ctx.request.body as {
        cccd?: string;
        ho_ten?: string;
        ngay_sinh?: string;
      };

      if (!ngay_sinh || (!cccd && !ho_ten)) {
        return ctx.badRequest("Vui long nhap ngay sinh va (CCCD hoac Ho ten).");
      }

      // Ưu tiên tra bằng CCCD nếu có (an toàn hơn, luôn trả đúng 1 kết quả)
      if (cccd) {
        const ketQua: any = await strapi.db
          .query("api::chung-chi.chung-chi")
          .findOne({
            where: {
              cccd: String(cccd).trim(),
              ngay_sinh,
            },
          });

        if (!ketQua) {
          return ctx.notFound(
            "Khong tim thay chung chi voi thong tin da nhap.",
          );
        }

        return ctx.send(dinhDangKetQua(ketQua));
      }

      // Tra bằng Họ tên (dành cho dữ liệu cũ không có CCCD)
      // Dùng $eqi để so khớp không phân biệt hoa/thường, khoảng trắng thừa
      const danhSach: any[] = await strapi.db
        .query("api::chung-chi.chung-chi")
        .findMany({
          where: {
            ho_ten: { $eqi: String(ho_ten).trim() },
            ngay_sinh,
          },
        });

      if (danhSach.length === 0) {
        return ctx.notFound("Khong tim thay chung chi voi thong tin da nhap.");
      }

      if (danhSach.length > 1) {
        // Trùng nhiều người cùng tên + cùng ngày sinh -> KHÔNG tự chọn đại 1 kết quả
        return ctx.conflict(
          "Tim thay nhieu ket qua trung khop. Vui long lien he truc tiep trung tam de duoc ho tro tra cuu chinh xac.",
        );
      }

      return ctx.send(dinhDangKetQua(danhSach[0]));
    },
  }),
);
