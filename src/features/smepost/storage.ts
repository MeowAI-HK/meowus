import { promises as fs } from "node:fs";
import path from "node:path";
import { dataRoot } from "@/lib/paths";
import { clearRunnerStatusCache } from "./runner-status-cache";

export type SMEPostAuthState = {
  baseUrl: string;
  runnerId: string;
  runnerToken: string;
  deviceName: string;
  org: {
    id: string;
    name: string;
    planId: string;
    imageCredit?: number;
    llmCredit?: number;
    planLimits?: {
      imageCredits: number;
      llmCredits: number;
    };
    brand?: {
      name?: string;
      description?: string;
      colors?: {
        primary?: string;
        accent?: string;
        background?: string;
      };
      logoUrl?: string;
    };
  };
  userId?: string;
  connectedAt: number;
};

function authPath() {
  return path.join(dataRoot(), "smepost-auth.json");
}

export async function readSMEPostAuth(): Promise<SMEPostAuthState | null> {
  try {
    const raw = await fs.readFile(authPath(), "utf8");
    return JSON.parse(raw) as SMEPostAuthState;
  } catch {
    return null;
  }
}

export async function writeSMEPostAuth(state: SMEPostAuthState) {
  await fs.mkdir(dataRoot(), { recursive: true });
  await fs.writeFile(authPath(), JSON.stringify(state, null, 2), "utf8");
}

export async function clearSMEPostAuth() {
  clearRunnerStatusCache();
  await fs.rm(authPath(), { force: true });
}
