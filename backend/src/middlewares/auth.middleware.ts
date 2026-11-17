import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';

export interface AuthenticatedRequest extends Request {
  admin?: {
    adminId: string;
    shopId: string;
    email: string;
    role: string;
  };
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.admin = payload;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'Unauthorized: Token expired or invalid' });
  }
}

export function requireAgentAuth(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-agent-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  const expectedKey = process.env.AGENT_API_KEY || 'pf_agent_secret_win11_2026_key';

  if (!apiKey || apiKey !== expectedKey) {
    res.status(401).json({ success: false, error: 'Unauthorized: Invalid Agent API Key' });
    return;
  }

  next();
}
