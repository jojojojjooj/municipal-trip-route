import type { InsertUser } from "../../drizzle/schema";

export type LocalPersonalUserConfig = Pick<
  InsertUser,
  "openId" | "name" | "email" | "loginMethod" | "role"
>;

/**
 * Local personal mode deliberately never activates in production. It is a
 * convenience for a single developer running the app on their own machine,
 * not an OAuth replacement for a deployed service.
 */
export function getLocalPersonalUserConfig(
  env: NodeJS.ProcessEnv = process.env
): LocalPersonalUserConfig | null {
  if (env.NODE_ENV === "production" || env.LOCAL_PERSONAL_MODE !== "true") {
    return null;
  }

  return {
    openId: env.LOCAL_PERSONAL_OPEN_ID?.trim() || "local-personal-owner",
    name: env.LOCAL_PERSONAL_NAME?.trim() || "개인 사용자",
    email: env.LOCAL_PERSONAL_EMAIL?.trim() || null,
    loginMethod: "local-personal",
    role: "admin",
  };
}
