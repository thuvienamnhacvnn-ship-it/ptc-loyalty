/**
 * ĐIỂM THAY ẢNH DUY NHẤT của trang marketing.
 *
 * Toàn bộ ảnh đang dùng là ảnh minh hoạ SVG tạm, sinh bởi
 * `npm run images` (scripts/gen-marketing-images.mjs).
 *
 * KHI CÓ ẢNH THẬT:
 *   1. Bỏ file vào `public/img/` (đặt tên gì cũng được).
 *   2. Sửa đường dẫn ở dưới, ví dụ:
 *        hero: "/img/hero.jpg"
 *   3. Xong. Không phải đụng vào JSX ở bất cứ đâu.
 *
 * Khuyến nghị ảnh thật: tỉ lệ 3:2 (vd 1200×800), JPG/WebP ~150–300 KB,
 * chủ thể lệch về giữa vì thẻ cắt theo `object-cover`.
 *
 * LƯU Ý: các khối ảnh đều KHÔNG phủ lớp mờ lên ảnh (chỉ có dải gradient tối ở
 * mép dưới để chữ đọc được) — giữ nguyên quy ước này khi thay ảnh.
 */
export const MEDIA = {
  /** Ảnh nền khối hero, sau tấm thẻ thành viên. */
  hero: "/img/hero.svg",

  /**
   * Ba nhóm ngành đang phục vụ — ảnh thật, lấy từ kho `E:\Works\PTC\ảnh mẫu`.
   * Bản gốc là banner 16:9 có panel chữ bên trái; ở đây chỉ lấy phần ảnh chụp
   * bên phải (bỏ 39% bên trái) vì thẻ đã có sẵn tiêu đề và huy hiệu icon rồi,
   * để nguyên banner thì chữ chồng chữ và logo PTC lặp ba lần.
   */
  industry: {
    restaurant: "/img/industry-restaurant.jpg",
    beauty: "/img/industry-beauty.jpg",
    retail: "/img/industry-retail.jpg",
  },

  /** Sáu dịch vụ của PTC Creative — ảnh thật, lấy từ kho `E:\Works\PTC\ảnh web`. */
  service: {
    cnc: "/img/service-cnc.jpg",
    werbetechnik: "/img/service-werbetechnik.jpg",
    druck: "/img/service-druck.jpg",
    branding: "/img/service-branding.jpg",
    web: "/img/service-web.jpg",
    marketing: "/img/service-marketing.jpg",
  },

  /** Dải ảnh dự án đã làm. */
  work: {
    signage: "/img/work-signage.svg",
    print: "/img/work-print.svg",
    brandkit: "/img/work-brandkit.svg",
  },
} as const;
