import type { User } from "oidc-client-ts";
import { getUserManager } from "./user-manager";

let currentUser: User | null = null;
let initialization: Promise<void> | null = null;

async function restoreSession(): Promise<void> {
  const manager = getUserManager();

  manager.events.addUserLoaded((user) => {
    currentUser = user;
  });
  manager.events.addUserUnloaded(() => {
    currentUser = null;
  });
  manager.events.addAccessTokenExpired(() => {
    currentUser = null;
  });

  try {
    const stored = await manager.getUser();
    currentUser =
      stored && !stored.expired ? stored : await manager.signinSilent();
  } catch {
    currentUser = null;
  }
}

export const auth = {
  ensureInitialized(): Promise<void> {
    if (typeof window === "undefined") return Promise.resolve();
    if (!initialization) initialization = restoreSession();
    return initialization;
  },

  isAuthenticated(): boolean {
    return currentUser !== null && !currentUser.expired;
  },

  get username(): string | null {
    return (
      (currentUser?.profile.preferred_username as string | undefined) ?? null
    );
  },

  getAccessToken(): string | null {
    return currentUser?.access_token ?? null;
  },

  login(): Promise<void> {
    return getUserManager().signinRedirect();
  },

  async completeLogin(): Promise<void> {
    currentUser = await getUserManager().signinRedirectCallback();
  },

  async completeSilentRenew(): Promise<void> {
    await getUserManager().signinSilentCallback();
  },

  async logout(): Promise<void> {
    await getUserManager().removeUser();
    currentUser = null;
  },
};

export type Auth = typeof auth;
