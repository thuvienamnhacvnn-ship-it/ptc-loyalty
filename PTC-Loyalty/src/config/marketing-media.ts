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

  /** Ba nhóm ngành đang phục vụ. */
  industry: {
    restaurant: "/img/industry-restaurant.svg",
    beauty: "/img/industry-beauty.svg",
    retail: "/img/industry-retail.svg",
  },

  /** Sáu dịch vụ của PTC Creative. */
  service: {
    cnc: "/img/service-cnc.svg",
    werbetechnik: "/img/service-werbetechnik.svg",
    druck: "/img/service-druck.svg",
    branding: "/img/service-branding.svg",
    web: "/img/service-web.svg",
    marketing: "/img/service-marketing.svg",
  },

  /** Dải ảnh dự án đã làm. */
  work: {
    signage: "/img/work-signage.svg",
    print: "/img/work-print.svg",
    brandkit: "/img/work-brandkit.svg",
  },
} as const;
