import { type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "rounded-panel border border-border bg-card/85 p-[18px] shadow-panel backdrop-blur-md",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  title,
  icon,
  tag,
}: {
  title: string;
  icon?: ReactNode;
  tag?: ReactNode;
}) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-sm font-black text-white">
        {icon}
        {title}
      </span>
      {tag && (
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
          {tag}
        </span>
      )}
    </div>
  );
}
