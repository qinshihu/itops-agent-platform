import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

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
  WEBHOOK_VERIFY_ENABLED?: boolean;
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

function validateEnv(): EnvConfig {
  const warnings: string[] = [];
  const errors: string[] = [];

  // 生产环境下JWT_SECRET是强制要求的
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction && !process.env.JWT_SECRET) {
    errors.push('Missing required environment variable: JWT_SECRET (must be set in production)');
  } else if (!process.env.JWT_SECRET) {
    warnings.push('Missing recommended environment variable: JWT_SECRET (using insecure default, DO NOT use in production)');
  }

  if (warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    warnings.forEach(warn => console.warn(`  - ${warn}`));
  }

  if (errors.length > 0) {
    console.error('❌ Environment errors:');
    errors.forEach(err => console.error(`  - ${err}`));
    if (isProduction) {
      throw new Error('Cannot start in production without required environment variables');
    }
  }

  const jwtSecret = process.env.JWT_SECRET;
  // 检查是否还在使用默认的不安全密钥
  if (jwtSecret && jwtSecret === 'itops-agent-platform-secret-key-change-in-production') {
    if (isProduction) {
      throw new Error('Cannot use default JWT_SECRET in production! Please set a secure secret.');
    } else {
      console.warn('⚠️ WARNING: Using default JWT secret. This is INSECURE and should ONLY be used for development!');
    }
  }

  if (!jwtSecret) {
    const generatedDevSecret = crypto.randomBytes(32).toString('hex');
    console.warn('⚠️ WARNING: Using a randomly generated JWT secret for this session.');
    console.warn('   This means all tokens will be invalidated on server restart.');
    console.warn('   Set JWT_SECRET in your .env file for persistent sessions.');
    return {
      NODE_ENV: getEnv('NODE_ENV', 'development'),
      PORT: getEnvAsNumber('PORT', 3001),
      DATABASE_PATH: getEnv('DATABASE_PATH', './data/app.db'),
      LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),
      JWT_SECRET: generatedDevSecret,
      JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '24h'),
      ALLOWED_ORIGINS: getEnv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',').map(s => s.trim()),
      DOUBAO_API_KEY: process.env.DOUBAO_API_KEY,
      DOUBAO_API_BASE: process.env.DOUBAO_API_BASE,
      DOUBAO_MODEL: process.env.DOUBAO_MODEL,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_API_BASE: process.env.OPENAI_API_BASE,
      OPENAI_MODEL: process.env.OPENAI_MODEL,
      LOCAL_AI_API_KEY: process.env.LOCAL_AI_API_KEY,
      LOCAL_AI_API_BASE: process.env.LOCAL_AI_API_BASE,
      LOCAL_AI_MODEL: process.env.LOCAL_AI_MODEL,
      WEBHOOK_VERIFY_ENABLED: process.env.WEBHOOK_VERIFY_ENABLED === 'true',
      WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
      ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
      ALERT_EMAIL_HOST: process.env.ALERT_EMAIL_HOST,
      ALERT_EMAIL_PORT: getEnvAsNumber('ALERT_EMAIL_PORT', 587),
      ALERT_EMAIL_USER: process.env.ALERT_EMAIL_USER,
      ALERT_EMAIL_PASS: process.env.ALERT_EMAIL_PASS,
      ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO
    };
  }

  return {
    NODE_ENV: getEnv('NODE_ENV', 'development'),
    PORT: getEnvAsNumber('PORT', 3001),
    DATABASE_PATH: getEnv('DATABASE_PATH', './data/app.db'),
    LOG_LEVEL: getEnv('LOG_LEVEL', 'info'),
    JWT_SECRET: jwtSecret,
    JWT_EXPIRES_IN: getEnv('JWT_EXPIRES_IN', '24h'),
    ALLOWED_ORIGINS: getEnv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',').map(s => s.trim()),
    DOUBAO_API_KEY: process.env.DOUBAO_API_KEY,
    DOUBAO_API_BASE: process.env.DOUBAO_API_BASE,
    DOUBAO_MODEL: process.env.DOUBAO_MODEL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_API_BASE: process.env.OPENAI_API_BASE,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    LOCAL_AI_API_KEY: process.env.LOCAL_AI_API_KEY,
    LOCAL_AI_API_BASE: process.env.LOCAL_AI_API_BASE,
    LOCAL_AI_MODEL: process.env.LOCAL_AI_MODEL,
    WEBHOOK_VERIFY_ENABLED: process.env.WEBHOOK_VERIFY_ENABLED === 'true',
    WEBHOOK_SECRET: process.env.WEBHOOK_SECRET,
    ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
    ALERT_EMAIL_HOST: process.env.ALERT_EMAIL_HOST,
    ALERT_EMAIL_PORT: getEnvAsNumber('ALERT_EMAIL_PORT', 587),
    ALERT_EMAIL_USER: process.env.ALERT_EMAIL_USER,
    ALERT_EMAIL_PASS: process.env.ALERT_EMAIL_PASS,
    ALERT_EMAIL_TO: process.env.ALERT_EMAIL_TO
  };
}

export const env = validateEnv();
