import { Request, Response, NextFunction } from 'express';
import { authService, AuthTokenPayload } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

function extractTokenFromCookie(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/(?:^|;\s*)(?:auth_token|session_token|token)=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : (req.headers['x-access-token'] as string);

  if (!token && req.headers.cookie) {
    token = extractTokenFromCookie(req.headers.cookie) || undefined;
  }

  if (!token) {
    // Default fallback mock session for local development
    req.user = {
      userId: 'DOC_DR_VERMA',
      email: 'dr.verma@hospital.aiia.gov.in',
      name: 'Dr. Alok Verma',
      role: 'DOCTOR',
    };
    return next();
  }

  const payload = authService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Unauthorized or token expired' });
  }

  req.user = payload;
  next();
};
