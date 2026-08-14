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

      const { cccd, ngay_sinh } = ctx.request.body as {
        cccd?: string;
        ngay_sinh?: string; // dang "YYYY-MM-DD"
      };

      if (!cccd || !ngay_sinh) {
        return ctx.badRequest("Vui long nhap day du CCCD va ngay sinh.");
      }

      const cccdInput = String(cccd).trim();

      const ketQua: any = await strapi.db
        .query("api::chung-chi.chung-chi")
        .findOne({
          where: {
            cccd: cccdInput,
            ngay_sinh: ngay_sinh,
          },
        });

      if (!ketQua) {
        return ctx.notFound("Khong tim thay chung chi voi thong tin da nhap.");
      }

      return ctx.send({
        ho_ten: ketQua.ho_ten,
        ten_chung_chi: ketQua.ten_chung_chi,
        so_hieu_chung_chi: ketQua.so_hieu_chung_chi,
        so_vao_so_goc: ketQua.so_vao_so_goc,
        khoa_thi_ngay: ketQua.khoa_thi_ngay,
        trang_thai: ketQua.trang_thai,
        file_chung_chi_url: ketQua.file_chung_chi?.url ?? null,
      });
    },
  }),
);
