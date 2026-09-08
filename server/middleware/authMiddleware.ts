import { Request, Response, NextFunction } from 'express';
import { authService, AuthTokenPayload } from '../services/authService';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.headers['x-access-token'] as string;

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
