import { Toaster as SonnerToaster } from "sonner";

type ToasterProps = React.ComponentProps<typeof SonnerToaster>;

// Toasts are themed through sonner's own CSS variables (set on the toaster root) rather than utility
// classes, so we don't fight sonner's injected stylesheet on specificity. The app runs dark-only, so
// the theme is fixed; per-toast accent colours (emerald success, red error, lime info) come from the
// lucide icon passed at the call site, on this neutral glass card.
export function Toaster(props: ToasterProps) {
  return (
    <SonnerToaster
      theme="dark"
      position="top-right"
      style={
        {
          "--normal-bg": "color-mix(in oklch, var(--popover) 96%, transparent)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-2xl)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
