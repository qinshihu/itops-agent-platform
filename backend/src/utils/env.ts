import crypto from "crypto";
import fs from "fs";
import path from "path";

// ══════════════════════════════════════════════════════════════
// 所有配置通过环境变量（Docker environment）或前端 UI 管理，
// 不读取 .env 文件（按 .trae/rules/architecture.md §七 规则：项目不需要 .env 文件）。
// ══════════════════════════════════════════════════════════════

interface EnvConfig {
  NODE_ENV: string;
  PORT: number;
  DATABASE_PATH: string;
  LOG_LEVEL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  ALLOWED_ORIGINS: string[];
  DOUBAO_API_KEY?: string;
  DOUBAO_API_BASE?: string;
  DOUBAO_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_API_BASE?: string;
  OPENAI_MODEL?: string;
  LOCAL_AI_API_KEY?: string;
  LOCAL_AI_API_BASE?: string;
  LOCAL_AI_MODEL?: string;
  WEBHOOK_VERIFY_ENABLED: "true" | "false" | "warn";
  WEBHOOK_SECRET?: string;
  WEBHOOK_IP_WHITELIST?: string;
  ALERT_WEBHOOK_URL?: string;
  ALERT_EMAIL_HOST?: string;
  ALERT_EMAIL_PORT?: number;
  ALERT_EMAIL_USER?: string;
  ALERT_EMAIL_PASS?: string;
  ALERT_EMAIL_TO?: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value !== undefined) {
    return value;
  }
  if (defaultValue !== undefined) {
    return defaultValue;
  }
  throw new Error(`Missing required environment variable: ${key}`);
}

function getEnvAsNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

function parseWebhookVerifyMode(
  value: string | undefined,
): "true" | "false" | "warn" {
  if (value === undefined || value === "") {
    return "warn";
  }
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "false" ||
    normalized === "0" ||
    normalized === "off" ||
    normalized === "no"
  ) {
    return "false";
  }
  if (normalized === "warn") {
    return "warn";
  }
  return "true";
}

/**
 * 获取持久化的 JWT 密钥。
 *
 * 优先级:
 *   1. 环境变量 JWT_SECRET（用户显式设置）
 *   2. 持久化文件 data/.jwt-secret（上次启动时自动生成的）
 *   3. 自动生成新密钥并保存到文件（首次启动 / 文件丢失时）
 *
 * 这样 docker run 零配置即可启动，且重启不会使已有 token 失效。
 */
function resolveJwtSecret(): { secret: string; source: string } {
  // 1. 用户显式设置的 JWT_SECRET 优先级最高
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return { secret: process.env.JWT_SECRET, source: "environment variable" };
  }
  if (process.env.JWT_SECRET) {
    console.warn(
      "⚠️  JWT_SECRET from environment is too short (< 32 chars), generating a secure one instead.",
    );
  }

  // 2. 尝试从持久化文件读取（确保多次重启 token 有效）
  const dataDir = path.resolve(
    process.env.DATABASE_PATH || "./data/app.db",
    "..",
  );
  const secretFile = path.join(dataDir, ".jwt-secret");
  try {
    if (fs.existsSync(secretFile)) {
      const saved = fs.readFileSync(secretFile, "utf-8").trim();
      if (saved.length >= 32) {
        return { secret: saved, source: `persisted file (${secretFile})` };
      }
    }
  } catch {
    // 文件读取失败，继续走自动生成
  }

  // 3. 自动生成并持久化
  const generated = crypto.randomBytes(32).toString("hex");
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(secretFile, generated, { mode: 0o600 });
    // eslint-disable-next-line no-console
    console.log(`🔐 Auto-generated JWT secret saved to ${secretFile}`);
  } catch (err) {
    console.warn(
      "⚠️  Could not persist JWT secret to file:",
      (err as Error).message,
    );
    console.warn("   Tokens will be invalidated on next restart.");
  }

  return { secret: generated, source: "auto-generated (persisted to file)" };
}

function validateEnv(): EnvConfig {
  const isProduction = process.env.NODE_ENV === "production";

  const { secret: jwtSecret, source: jwtSource } = resolveJwtSecret();

  if (!isProduction || jwtSource !== "auto-generated (persisted to file)") {
    // eslint-disable-next-line no-console
    console.log(`🔑 JWT secret source: ${jwtSource}`);
  }

  const ALWAYS_REFUSE_SECRETS = new Set([
    "itops-agent-platform-secret-key-change-in-production",
    "your-production-secret-key-change-me-32-chars",
    "please_change_this_to_a_random_64_char_string",
    "change-me",
    "secret",
    "jwt-secret",
  ]);

  if (ALWAYS_REFUSE_SECRETS.has(jwtSecret.trim().toLowerCase())) {
    if (isProduction) {
      throw new Error(
        "Cannot use placeholder JWT_SECRET in production! Please set a secure random secret (openssl rand -hex 32).",
      );
    } else {
      console.warn(
        "⚠️  WARNING: Using placeholder JWT secret. This is INSECURE and should ONLY be used for development!",
      );
    }
  }

  return {
    NODE_ENV: getEnv("NODE_ENV", "development"),
    PORT: getEnvAsNumber("PORT", 3001),
    DATABASE_PATH: getEnv("DATABASE_PATH", "./data/app.db"),
    LOG_LEVEL: getEnv("LOG_LEVEL", "info"),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: getEnv("JWT_EXPIRES_IN", "24h"),
    ALLOWED_ORIGINS: getEnv("ALLOWED_ORIGINS", "http://localhost:3000")
      .split(",")
      .map((s) => s.trim()),
    DOUBAO_API_KEY: process.env.DOUBAO_API_KEY,
    DOUBAO_API_BASE: process.env.DOUBAO_API_BASE,
    DOUBAO_MODEL: process.env.DOUBAO_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_API_BASE: process.env.OPENAI_API_BASE,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    LOCAL_AI_API_KEY: process.env.LOCAL_AI_API_KEY,
    LOCAL_AI_API_BASE: process.env.LOCAL_AI_API_BASE,
    LOCAL_AI_MODEL: process.env.LOCAL_AI_MODEL,
    WEBHOOK_VERIFY_ENABLED: parseWebhookVerifyMode(
      process.env.WEBHOOK_VERIFY_ENABLED,
    ),
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    ALERT_EMAIL_HOST: process.env.ALERT_EMAIL_HOST,
    ALERT_EMAIL_PORT: getEnvAsNumber("ALERT_EMAIL_PORT", 587),
    ALERT_EMAIL_USER: process.env.ALERT_EMAIL_USER,
    ALERT_EMAIL_PASS: process.env.ALERT_EMAIL_PASS,
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO,
  };
}

export const env = validateEnv();
