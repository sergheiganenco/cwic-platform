import crypto from 'node:crypto';
import { config } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

const keyMaterial = config.security.connectionEncryptionKey;
if (!keyMaterial) {
  throw new Error('Connection encryption key is not configured');
}

const encryptionKey = crypto.createHash('sha256').update(keyMaterial).digest().subarray(0, KEY_LENGTH);

export interface EncryptedPayload {
  __encrypted: true;
  v: 1;
  alg: typeof ALGORITHM;
  iv: string;
  tag: string;
  data: string;
}

export function encryptConfig(value: unknown): EncryptedPayload {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  const json = Buffer.from(JSON.stringify(value ?? {}), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(json), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    __encrypted: true,
    v: 1,
    alg: ALGORITHM,
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
    data: ciphertext.toString('base64'),
  };
}

export function decryptConfig<T = unknown>(payload: unknown): T {
  if (!isEncryptedConfig(payload)) {
    return payload as T;
  }

  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function isEncryptedConfig(value: any): value is EncryptedPayload {
  return (
    value &&
    typeof value === 'object' &&
    value.__encrypted === true &&
    typeof value.data === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.tag === 'string'
  );
}

const EXACT_SENSITIVE_KEYS = new Set(
  [
    'password',
    'pass',
    'passwd',
    'pwd',
    'secret',
    'secretkey',
    'accesskey',
    'access_key',
    'clientsecret',
    'client_secret',
    'sharedsecret',
    'shared_secret',
    'token',
    'access_token',
    'refresh_token',
    'bearer_token',
    'bearertoken',
    'api_key',
    'apikey',
    'private_key',
    'privatekey',
    'service_account_key',
    'serviceaccountkey',
    'connection_string',
    'connectionstring',
    'credentials',
    'certificate',
  ].map((key) => key.toLowerCase()),
);

const PARTIAL_SENSITIVE_KEYS = ['password', 'secret', 'token', 'credential'];

function isSensitiveKey(name: string): boolean {
  if (EXACT_SENSITIVE_KEYS.has(name)) {
    return true;
  }
  return PARTIAL_SENSITIVE_KEYS.some((fragment) => name.includes(fragment));
}

export function maskSecrets<T>(input: T): T {
  return maskValue(input, new WeakSet()) as T;
}

function maskValue(value: any, seen: WeakSet<object>): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return value;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => maskValue(entry, seen));
  }

  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(value)) {
    const lowered = key.toLowerCase();
    if (isSensitiveKey(lowered)) {
      result[key] = maskSecretValue(val, seen);
    } else {
      result[key] = maskValue(val, seen);
    }
  }

  return result;
}

function maskSecretValue(value: any, seen: WeakSet<object>): any {
  if (value === null || value === undefined) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map(() => '***');
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '***';
    }

    seen.add(value);
    const masked: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      masked[key] = '***';
    }
    return masked;
  }

  if (typeof value === 'string') {
    return value.length ? '***' : '';
  }

  return '***';
}
