import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: { box: "h-7 w-7 rounded-md", icon: "h-3.5 w-3.5", text: "text-base" },
  md: { box: "h-8 w-8 rounded-lg", icon: "h-4 w-4", text: "text-lg" },
  lg: { box: "h-11 w-11 rounded-xl", icon: "h-6 w-6", text: "text-2xl" },
} as const;

export function Brand({
  className,
  size = "md",
}: {
  className?: string;
  size?: keyof typeof sizes;
}) {
  const s = sizes[size];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center bg-gradient-to-br from-primary to-accent text-white shadow-sm ring-1 ring-inset ring-white/25",
          s.box,
        )}
      >
        {/* soft top highlight for a glassy logo mark */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-[inherit] bg-white/15" />
        <Sparkles className={cn("relative", s.icon)} />
      </div>
      <span className={cn("font-bold tracking-tight", s.text)}>
        PTC<span className="text-accent"> Loyalty</span>
      </span>
    </div>
  );
}
