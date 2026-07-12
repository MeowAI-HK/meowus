import fs from "fs/promises";
import path from "path";

type KeytarLike = {
  findCredentials(service: string): Promise<Array<{ account: string; password: string }>>;
};

const servicePrefix = "social-auto-post";

function splitKeys(raw: string | undefined) {
  return Array.from(
    new Set(
      (raw ?? "")
        .split(/[\r\n,;]+/)
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
}

async function loadKeytar(): Promise<KeytarLike | null> {
  try {
    const dynamicImport = new Function("name", "return import(name)") as (
      name: string,
    ) => Promise<KeytarLike>;
    return await dynamicImport("keytar");
  } catch {
    return null;
  }
}

export type SecretProvider = "gemini" | "groq" | "openai" | "openrouter";

export async function readProviderKeys(provider: SecretProvider) {
  const keytar = await loadKeytar();
  if (keytar) {
    const credentials = await keytar.findCredentials(`${servicePrefix}:${provider}`);
    const stored = credentials.map((item) => item.password).filter(Boolean);
    if (stored.length > 0) {
      return Array.from(new Set(stored));
    }
  }

  if (provider === "gemini") return splitKeys(process.env.GEMINI_API_KEYS);
  if (provider === "openai") return splitKeys(process.env.OPENAI_API_KEYS ?? process.env.OPENAI_API_KEY);
  if (provider === "openrouter") return splitKeys(process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY);
  return splitKeys(process.env.GROQ_API_KEYS);
}

export function maskKey(key: string) {
  const cleaned = key.trim();
  if (!cleaned) {
    return "";
  }
  return `${"*".repeat(Math.max(0, cleaned.length - 4))}${cleaned.slice(-4)}`;
}

export async function writeProviderKey(provider: SecretProvider, key: string) {
  const envPath = path.join(process.cwd(), ".env.local");
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    try {
      content = await fs.readFile(path.join(process.cwd(), ".env"), "utf-8");
    } catch {
      content = "";
    }
  }

  const varName =
    provider === "gemini"
      ? "GEMINI_API_KEYS"
      : provider === "openai"
        ? "OPENAI_API_KEYS"
        : provider === "openrouter"
          ? "OPENROUTER_API_KEYS"
          : "GROQ_API_KEYS";
  const lines = content.split("\n");
  let found = false;
  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith(`${varName}=`)) {
      found = true;
      return `${varName}=${key}`;
    }
    return line;
  });

  if (!found) {
    if (newLines.length > 0 && newLines[newLines.length - 1].trim() !== "") {
      newLines.push("");
    }
    newLines.push(`${varName}=${key}`);
  }

  await fs.writeFile(envPath, newLines.join("\n"), "utf-8");
  process.env[varName] = key;
}
