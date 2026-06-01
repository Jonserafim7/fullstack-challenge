import {
  InMemoryWebStorage,
  UserManager,
  WebStorageStateStore,
} from "oidc-client-ts";

let userManager: UserManager | null = null;

export function getUserManager(): UserManager {
  if (typeof window === "undefined") {
    throw new Error("getUserManager must only be called in the browser");
  }

  if (!userManager) {
    const { origin } = window.location;
    userManager = new UserManager({
      authority: import.meta.env.VITE_OIDC_AUTHORITY,
      client_id: import.meta.env.VITE_OIDC_CLIENT_ID,
      redirect_uri: `${origin}/auth/callback`,
      silent_redirect_uri: `${origin}/auth/silent`,
      post_logout_redirect_uri: `${origin}/login`,
      response_type: "code",
      scope: "openid profile email",
      automaticSilentRenew: true,
      // Access token lives in memory only — never localStorage (XSS exposure).
      userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
      // PKCE verifier / redirect state must survive the full-page redirect to the IdP.
      stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
    });
  }

  return userManager;
}
