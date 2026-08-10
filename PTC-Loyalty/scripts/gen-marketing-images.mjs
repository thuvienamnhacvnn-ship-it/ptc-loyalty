/**
 * Sinh ảnh minh hoạ SVG cho trang marketing ptc-bonus.
 *
 *   node scripts/gen-marketing-images.mjs      (hoặc: npm run images)
 *
 * Vì sao là SVG sinh tại chỗ chứ không phải ảnh stock:
 *  - không phụ thuộc mạng (Unsplash từng là điểm chết khi DNS bị chặn),
 *  - nhẹ (~2 KB/ảnh) nên không ảnh hưởng tốc độ tải,
 *  - đúng bảng màu PTC Creative ngay từ đầu.
 *
 * ĐÂY LÀ ẢNH TẠM. Thay ảnh thật: bỏ file vào `public/img/` rồi sửa đường dẫn
 * trong `src/config/marketing-media.ts` — không cần đụng vào JSX.
 *
 * Hệ màu (xem memory ptc-creative-design): cobalt #145DFF là màu chủ đạo,
 * navy #050E1B/#0A1F3D làm nền, vàng #B8893F–#CDA45E CHỈ dùng cho nét mảnh —
 * tuyệt đối không tô mảng vàng lớn.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "img");
mkdirSync(OUT, { recursive: true });

const NAVY = "#050E1B";
const NAVY_2 = "#0A1F3D";
const COBALT = "#145DFF";
const COBALT_HI = "#5B8CFF";
const GOLD = "#B8893F";
const GOLD_HI = "#CDA45E";

/** Khung nền dùng chung: nền navy, ma trận chấm, nêm cobalt chéo, quầng sáng. */
function frame(w, h, id, body, { index = "", label = "", shift = 0 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${NAVY_2}"/>
    </linearGradient>
    <linearGradient id="c-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COBALT_HI}"/><stop offset="1" stop-color="${COBALT}"/>
    </linearGradient>
    <linearGradient id="au-${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${GOLD}"/><stop offset=".5" stop-color="${GOLD_HI}"/><stop offset="1" stop-color="${GOLD}"/>
    </linearGradient>
    <radialGradient id="glow-${id}" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="${COBALT}" stop-opacity=".55"/>
      <stop offset="1" stop-color="${COBALT}" stop-opacity="0"/>
    </radialGradient>
    <pattern id="dots-${id}" width="26" height="26" patternUnits="userSpaceOnUse">
      <circle cx="1.6" cy="1.6" r="1.6" fill="${COBALT_HI}" opacity=".26"/>
    </pattern>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#g-${id})"/>
  <rect width="${w}" height="${h}" fill="url(#dots-${id})"/>
  <ellipse cx="${w * 0.72}" cy="${h * 0.22}" rx="${w * 0.42}" ry="${h * 0.42}" fill="url(#glow-${id})"/>
  <polygon points="0,${h} ${w * 0.46},${h} 0,${h * 0.42}" fill="${COBALT}" opacity=".14"/>

  <g transform="translate(0 ${shift})">${body}</g>

  <path d="M64 ${h - 64} H ${w * 0.3}" stroke="url(#au-${id})" stroke-width="2" opacity=".95"/>
  ${index ? `<text x="64" y="${h - 82}" font-family="Segoe UI,Arial,sans-serif" font-size="22" font-weight="700" letter-spacing="4" fill="${GOLD_HI}" opacity=".95">${index}</text>` : ""}
  <rect x="1" y="1" width="${w - 2}" height="${h - 2}" fill="none" stroke="${COBALT_HI}" stroke-width="2" opacity=".16"/>
</svg>
`;
}

/** Nét vẽ cobalt dùng chung cho mọi glyph. */
const S = (extra = "") =>
  `fill="none" stroke="url(#c-__ID__)" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" ${extra}`;
const SG = (extra = "") =>
  `fill="none" stroke="url(#au-__ID__)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" ${extra}`;

/** Mỗi chủ đề một glyph riêng — vẽ bằng primitive để giữ file nhỏ và sắc nét. */
const GLYPHS = {
  restaurant: `
    <path ${S()} d="M470 470 h260 a130 130 0 0 1 -260 0 z"/>
    <path ${S()} d="M430 470 h340"/>
    <path ${SG()} d="M545 350 q26 -34 0 -68 M600 350 q26 -34 0 -68 M655 350 q26 -34 0 -68"/>
    <path ${S()} d="M820 330 v220 M820 330 q46 0 46 66 t-46 46"/>`,
  beauty: `
    <path ${S()} d="M480 560 q0 -150 120 -150 t120 150 z"/>
    <path ${S()} d="M540 410 v-90 a60 60 0 0 1 120 0 v90"/>
    <path ${SG()} d="M600 250 v-70 M520 286 l-40 -58 M680 286 l40 -58"/>
    <circle ${S()} cx="600" cy="500" r="26"/>`,
  retail: `
    <path ${S()} d="M450 400 h300 l34 220 H416 z"/>
    <path ${S()} d="M530 400 v-52 a70 70 0 0 1 140 0 v52"/>
    <path ${SG()} d="M470 470 h260"/>
    <circle ${S()} cx="600" cy="530" r="22"/>`,
  cnc: `
    <circle ${S()} cx="600" cy="440" r="118"/>
    <circle ${S()} cx="600" cy="440" r="46"/>
    <path ${S()} d="M600 300 v-52 M600 632 v-52 M740 440 h52 M408 440 h52 M700 340 l38 -38 M462 578 l38 -38 M700 540 l38 38 M462 302 l38 38"/>
    <path ${SG()} d="M356 660 h488"/>`,
  signage: `
    <path ${S()} d="M400 330 h400 v190 H400 z"/>
    <path ${S()} d="M600 520 v130 M520 650 h160"/>
    <path ${SG()} d="M446 392 h130 M446 452 h220"/>
    <circle ${S()} cx="742" cy="392" r="20"/>`,
  print: `
    <path ${S()} d="M430 400 h340 v150 H430 z"/>
    <path ${S()} d="M500 400 v-88 h200 v88"/>
    <path ${S()} d="M500 550 h200 v130 H500 z"/>
    <path ${SG()} d="M546 596 h108 M546 638 h108"/>
    <circle ${S()} cx="726" cy="462" r="14"/>`,
  branding: `
    <path ${S()} d="M600 300 l150 88 v176 l-150 88 -150 -88 V388 z"/>
    <path ${S()} d="M600 396 l66 38 v78 l-66 38 -66 -38 v-78 z"/>
    <path ${SG()} d="M600 300 v96 M750 388 l-84 46 M450 388 l84 46 M600 652 v-100"/>`,
  web: `
    <path ${S()} d="M420 320 h360 a24 24 0 0 1 24 24 v260 a24 24 0 0 1 -24 24 H420 a24 24 0 0 1 -24 -24 V344 a24 24 0 0 1 24 -24 z"/>
    <path ${S()} d="M396 400 h408"/>
    <path ${SG()} d="M440 362 h18 M482 362 h18 M524 362 h18"/>
    <path ${S()} d="M446 460 h150 M446 516 h230 M446 572 h110"/>
    <path ${SG()} d="M690 470 h74 v130 h-74 z"/>`,
  marketing: `
    <path ${S()} d="M430 620 V500 M530 620 V430 M630 620 V470 M730 620 V350"/>
    <path ${SG()} d="M400 660 h380"/>
    <path ${S()} d="M420 430 l110 -80 100 50 130 -110"/>
    <circle ${S()} cx="760" cy="290" r="20"/>`,
  qr: `
    <path ${S()} d="M420 330 h120 v120 H420 z M660 330 h120 v120 H660 z M420 570 h120 v120 H420 z"/>
    <path ${SG()} d="M470 380 h20 v20 h-20 z M710 380 h20 v20 h-20 z M470 620 h20 v20 h-20 z"/>
    <path ${S()} d="M660 570 h40 v40 h-40 z M740 570 h40 v40 h-40 z M660 650 h40 v40 h-40 z M740 650 h40 v40 h-40 z"/>`,
  install: `
    <path ${S()} d="M380 640 h440"/>
    <path ${S()} d="M470 640 V400 h260 v240"/>
    <path ${S()} d="M470 400 l130 -90 130 90"/>
    <path ${SG()} d="M540 640 V500 h120 v140"/>
    <circle ${S()} cx="820" cy="470" r="26"/>`,
  press: `
    <circle ${S()} cx="510" cy="440" r="86"/>
    <circle ${S()} cx="700" cy="440" r="86"/>
    <path ${S()} d="M380 600 h450"/>
    <path ${SG()} d="M420 660 h380"/>
    <path ${S()} d="M510 354 v-64 M700 354 v-64"/>`,
  kit: `
    <path ${S()} d="M410 350 h230 v300 H410 z"/>
    <path ${S()} d="M676 396 h150 v210 h-150 z"/>
    <path ${SG()} d="M456 420 h140 M456 470 h140 M456 520 h90"/>
    <circle ${S()} cx="751" cy="470" r="34"/>
    <path ${SG()} d="M706 560 h90"/>`,
};

// [tên file, glyph, chỉ số, nhãn, dịch dọc]
// Ảnh hero bị tấm thẻ thành viên chồng lên nửa dưới, nên glyph của nó được
// đẩy lên cao để phần còn lộ ra vẫn đọc được trọn hình.
const FILES = [
  ["hero", "qr", "", "Thẻ thành viên QR", -150],
  ["industry-restaurant", "restaurant", "01", "Nhà hàng & Café"],
  ["industry-beauty", "beauty", "02", "Nail & Beauty"],
  ["industry-retail", "retail", "03", "Bán lẻ & Siêu thị"],
  ["service-cnc", "cnc", "01", "CNC"],
  ["service-werbetechnik", "signage", "02", "Werbetechnik"],
  ["service-druck", "print", "03", "Druck"],
  ["service-branding", "branding", "04", "Branding"],
  ["service-web", "web", "05", "Web"],
  ["service-marketing", "marketing", "06", "Digital Marketing"],
  ["work-signage", "install", "", "Thi công biển hiệu"],
  ["work-print", "press", "", "In ấn"],
  ["work-brandkit", "kit", "", "Bộ nhận diện"],
];

let n = 0;
for (const [name, glyph, index, label, shift = 0] of FILES) {
  const id = name.replace(/[^a-z0-9]/gi, "");
  const body = GLYPHS[glyph].replaceAll("__ID__", id);
  const svg = frame(1200, 800, id, body, { index, label, shift });
  writeFileSync(join(OUT, `${name}.svg`), svg, "utf8");
  n++;
}

console.log(`✅ Đã sinh ${n} ảnh minh hoạ SVG vào public/img/`);
console.log("   Thay ảnh thật: bỏ file vào public/img/ rồi sửa src/config/marketing-media.ts");
