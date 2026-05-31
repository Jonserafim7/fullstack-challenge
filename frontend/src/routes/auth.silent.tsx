import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { auth } from "@/auth/auth";

export const Route = createFileRoute("/auth/silent")({
  component: SilentCallback,
});

function SilentCallback() {
  useEffect(() => {
    void auth.completeSilentRenew();
  }, []);

  return null;
}
