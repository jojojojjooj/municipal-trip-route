import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getLocalPersonalUserConfig } from "./localPersonal";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  const localPersonalUser = getLocalPersonalUserConfig();
  if (localPersonalUser) {
    try {
      await db.upsertUser(localPersonalUser);
      user = (await db.getUserByOpenId(localPersonalUser.openId)) ?? null;
      if (!user) {
        console.warn(
          "[Auth] LOCAL_PERSONAL_MODE needs DATABASE_URL to create the local owner"
        );
      }
    } catch (error) {
      console.warn("[Auth] Local personal user initialization failed", error);
    }
  }

  if (user) {
    return { req: opts.req, res: opts.res, user };
  }

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
