"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Hiệu ứng hiện dần khi cuộn tới, dùng khắp các trang marketing.
 *
 * Trước đây phần này dùng framer-motion `whileInView` + `initial={{opacity:0}}`.
 * Nó chạy animation bằng requestAnimationFrame, mà rAF bị trình duyệt điều tiết
 * khi tab ở chế độ nền — hệ quả: những khối có `delay` KHÔNG BAO GIỜ chạy xong
 * và nằm lại vĩnh viễn ở opacity 0. Trang trông như mất nội dung.
 *
 * Bản này tách đôi trách nhiệm:
 *  - phát hiện đã vào khung nhìn: IntersectionObserver (đáng tin, vẫn bắn khi
 *    người dùng quay lại tab),
 *  - chạy animation: CSS (do compositor lo, không phụ thuộc rAF).
 *
 * Và có lưới an toàn: sau 2,5s là hiện bằng mọi giá, kể cả khi observer không
 * bắn hoặc trình duyệt không hỗ trợ. Không có kịch bản nào nội dung biến mất.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  /** giữ chữ ký cũ để các trang khác không phải sửa */
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (shown) return;
    const el = ref.current;

    // Lưới an toàn — hiện nội dung dù chuyện gì xảy ra.
    const failsafe = window.setTimeout(() => setShown(true), 2500);

    if (!el || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return () => window.clearTimeout(failsafe);
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "-80px" },
    );
    io.observe(el);

    return () => {
      window.clearTimeout(failsafe);
      io.disconnect();
    };
  }, [shown]);

  return (
    <div
      ref={ref}
      className={cn("ptc-reveal", className)}
      data-reveal={shown ? "in" : "idle"}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}
