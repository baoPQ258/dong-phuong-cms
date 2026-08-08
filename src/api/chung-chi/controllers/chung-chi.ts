// File: src/api/chung-chi/controllers/chung-chi.ts

import { factories } from '@strapi/strapi';

// Rate limit đơn giản trong bộ nhớ: tối đa 5 lần tra cứu / 1 phút / 1 IP
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
  'api::chung-chi.chung-chi',
  ({ strapi }) => ({
    async traCuu(ctx) {
      const ip = ctx.request.ip;

      if (isRateLimited(ip)) {
        return ctx.tooManyRequests(
          'Ban da tra cuu qua nhieu lan. Vui long thu lai sau 1 phut.'
        );
      }

      const { so_dien_thoai, cccd } = ctx.request.body as {
        so_dien_thoai?: string;
        cccd?: string;
      };

      if (!so_dien_thoai || !cccd) {
        return ctx.badRequest('Vui long nhap day du so dien thoai va CCCD.');
      }

      const sdt = String(so_dien_thoai).trim();
      const cccdInput = String(cccd).trim();

      const ketQua: any = await strapi.db
        .query('api::chung-chi.chung-chi')
        .findOne({
          where: {
            so_dien_thoai: sdt,
            cccd: cccdInput,
          },
          populate: {
            khoa_hoc: true,
            file_chung_chi: true,
          },
        });

      if (!ketQua) {
        return ctx.notFound('Khong tim thay chung chi voi thong tin da nhap.');
      }

      return ctx.send({
        ho_ten: ketQua.ho_ten,
        ma_chung_chi: ketQua.ma_chung_chi,
        ten_khoa_hoc: ketQua.khoa_hoc?.ten ?? null,
        ngay_cap: ketQua.ngay_cap,
        trang_thai: ketQua.trang_thai,
        file_chung_chi_url: ketQua.file_chung_chi?.url ?? null,
      });
    },
  })
);