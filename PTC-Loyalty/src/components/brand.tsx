import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white">
        <Sparkles className="h-4 w-4" />
      </div>
      <span className="text-lg font-bold tracking-tight">
        PTC<span className="text-accent"> Loyalty</span>
      </span>
    </div>
  );
}
