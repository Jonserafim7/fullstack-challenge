/// <reference types="vite/client" />
import {
  Outlet,
  Scripts,
  HeadContent,
  createRootRouteWithContext,
} from "@tanstack/react-router";
import type { Auth } from "../auth/auth";
import appCss from "../styles/app.css?url";

export interface RouterContext {
  auth: Auth;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Crash Game" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
