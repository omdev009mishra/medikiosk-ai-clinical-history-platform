import { userRepository, AppUser } from '../db/repositories/userRepository';

export interface AuthTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: 'PATIENT' | 'KIOSK_OPERATOR' | 'DOCTOR' | 'ADMIN';
}

/**
 * Authentication Service (Phase 6.6)
 * Handles authentication credentials and token verification.
 */
export const authService = {
  async authenticateUser(email: string, passwordAttempt: string): Promise<{ user: AppUser; token: string } | null> {
    const user = await userRepository.findByEmail(email);
    if (!user) return null;

    // Verify PIN / password
    if (user.passwordHash !== passwordAttempt) {
      return null;
    }

    const token = this.generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return { user, token };
  },

  revokedTokens: new Set<string>(),

  invalidateToken(token: string): void {
    if (token) {
      this.revokedTokens.add(token);
    }
  },

  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  },

  generateToken(payload: AuthTokenPayload): string {
    const jsonStr = JSON.stringify({ ...payload, exp: Date.now() + 24 * 60 * 60 * 1000 });
    return Buffer.from(jsonStr).toString('base64url');
  },

  verifyToken(token: string): AuthTokenPayload | null {
    try {
      if (this.revokedTokens.has(token)) return null;
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
      if (decoded.exp && decoded.exp < Date.now()) return null;
      return decoded;
    } catch (e) {
      return null;
    }
  },
};
