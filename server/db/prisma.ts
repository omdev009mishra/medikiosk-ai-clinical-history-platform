import { clinicalStore } from './store';

/**
 * Prisma & DB Layer Initialization Module
 * Provides seamless repository routing between PostgreSQL database and local persistent store adapter.
 */
export const isPostgresConfigured = (): boolean => {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres'));
};

export const getDbStatus = async (): Promise<{ status: string; engine: string }> => {
  if (isPostgresConfigured()) {
    return { status: 'healthy', engine: 'PostgreSQL (Prisma ORM)' };
  }
  return { status: 'healthy', engine: 'MediKiosk Persistent Store Adapter' };
};
