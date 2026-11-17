import jwt from 'jsonwebtoken';
import { AdminAuthPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'printflow-super-secure-jwt-secret-key-32chars';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'printflow-super-secure-refresh-token-key-32chars';

export function signAccessToken(payload: AdminAuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

export function signRefreshToken(payload: { adminId: string }): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AdminAuthPayload {
  return jwt.verify(token, JWT_SECRET) as AdminAuthPayload;
}

export function verifyRefreshToken(token: string): { adminId: string } {
  return jwt.verify(token, JWT_REFRESH_SECRET) as { adminId: string };
}
