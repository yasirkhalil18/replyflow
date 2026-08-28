import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_secret_key_32_bytes_len!!'; // Must be 32 bytes
const IV_LENGTH = 16;

/**
 * AES-256-GCM Token Encryption for Discord OAuth & User Tokens
 */
export function encryptToken(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * AES-256-GCM Token Decryption
 */
export function decryptToken(encryptedText: string): string {
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted token format');
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Zod Payload Validation Middleware Generator
 */
export function validateSchema(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err: any) {
      res.status(400).json({
        error: 'Validation Failed',
        details: err.errors || err.message,
      });
    }
  };
}

/**
 * Security Headers Middleware (Helmet Equivalent)
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
  res.setHeader('Content-Security-Policy', "default-src 'self' https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:;");
  next();
}
