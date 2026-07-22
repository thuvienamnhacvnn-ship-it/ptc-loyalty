import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PTC Loyalty Platform",
    short_name: "PTC Loyalty",
    description: "Nền tảng khách hàng thân thiết cho doanh nghiệp Việt tại Đức.",
    start_url: "/member",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#2563eb",
    lang: "vi",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
