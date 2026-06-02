import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

// Toasts are themed through sonner's own CSS variables so type-specific states keep the right
// semantic surface: emerald for cash-out success, red for failures, neutral for everything else.
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="dark"
      richColors
      position="top-right"
      style={
        {
          "--normal-bg": "color-mix(in oklch, var(--popover) 96%, transparent)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg":
            "color-mix(in oklch, var(--success) 13%, var(--popover) 87%)",
          "--success-text": "var(--popover-foreground)",
          "--success-border":
            "color-mix(in oklch, var(--success) 35%, var(--border) 65%)",
          "--error-bg":
            "color-mix(in oklch, var(--destructive) 14%, var(--popover) 86%)",
          "--error-text": "var(--popover-foreground)",
          "--error-border":
            "color-mix(in oklch, var(--destructive) 35%, var(--border) 65%)",
          "--border-radius": "var(--radius-2xl)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
