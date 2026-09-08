import { Pool } from 'pg';
import { clinicalStore } from './store';
import { Patient, ClinicalEncounter } from '../types/clinical';

export interface DatabaseHealthStatus {
  status: 'healthy' | 'degraded' | 'in_memory';
  provider: 'postgresql' | 'file_backed' | 'in_memory_store';
  connected: boolean;
  activePatients: number;
  activeEncounters: number;
  latencyMs?: number;
  error?: string;
}

export class DatabaseClient {
  private pool: Pool | null = null;
  private isPostgresEnabled: boolean;
  private connectionUrl?: string;
  private schemaInitialized: boolean = false;

  constructor() {
    this.connectionUrl = process.env.DATABASE_URL;
    this.isPostgresEnabled = Boolean(
      this.connectionUrl &&
      !this.connectionUrl.includes('placeholder') &&
      this.connectionUrl.startsWith('postgres')
    );

    if (this.isPostgresEnabled) {
      this.initPool();
    }
  }

  private initPool() {
    try {
      this.pool = new Pool({
        connectionString: this.connectionUrl,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });

      this.pool.on('error', (err) => {
        console.warn('[DatabaseClient] Unexpected client error in pg pool:', err.message);
      });

      // Asynchronously initialize database schema
      this.initializeSchema().catch((err) => {
        console.warn('[DatabaseClient] Initial schema check failed, will retry on demand:', err.message);
      });
    } catch (err: any) {
      console.warn('[DatabaseClient] Failed to initialize PostgreSQL pool:', err.message);
      this.pool = null;
    }
  }

  public async initializeSchema(): Promise<boolean> {
    if (!this.pool || this.schemaInitialized) return this.schemaInitialized;

    let client;
    try {
      client = await this.pool.connect();
      await client.query('BEGIN');

      await client.query(`
        CREATE TABLE IF NOT EXISTS patients (
          id VARCHAR(64) PRIMARY KEY,
          hospital_patient_id VARCHAR(64),
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(32),
          abha_id VARCHAR(64),
          data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients (phone);
        CREATE INDEX IF NOT EXISTS idx_patients_abha ON patients (abha_id);
        CREATE INDEX IF NOT EXISTS idx_patients_hospital_id ON patients (hospital_patient_id);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS encounters (
          id VARCHAR(64) PRIMARY KEY,
          patient_id VARCHAR(64) NOT NULL,
          status VARCHAR(64) NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_encounters_patient ON encounters (patient_id);
        CREATE INDEX IF NOT EXISTS idx_encounters_status ON encounters (status);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS sync_queue (
          id VARCHAR(64) PRIMARY KEY,
          operation VARCHAR(64) NOT NULL,
          entity_type VARCHAR(32) NOT NULL,
          entity_id VARCHAR(64) NOT NULL,
          status VARCHAR(32) NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue (status);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS idempotency_keys (
          key VARCHAR(128) PRIMARY KEY,
          result JSONB NOT NULL,
          created_at BIGINT NOT NULL
        );
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          action VARCHAR(64) NOT NULL,
          actor VARCHAR(64) NOT NULL,
          role VARCHAR(32) NOT NULL,
          resource VARCHAR(64),
          resource_id VARCHAR(64),
          details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);

      await client.query('COMMIT');
      this.schemaInitialized = true;
      console.log('[DatabaseClient] PostgreSQL schemas and tables successfully verified.');
      return true;
    } catch (err: any) {
      if (client) await client.query('ROLLBACK').catch(() => {});
      console.warn('[DatabaseClient] Schema initialization warning:', err.message);
      return false;
    } finally {
      if (client) client.release();
    }
  }

  async checkHealth(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    const patientCount = clinicalStore.getAllPatients().length;
    const encounterCount = clinicalStore.getAllEncounters().length;

    if (!this.isPostgresEnabled || !this.pool) {
      return {
        status: 'healthy',
        provider: 'file_backed',
        connected: true,
        activePatients: patientCount,
        activeEncounters: encounterCount,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const res = await this.pool.query('SELECT 1 as healthy;');
      if (res.rows[0]?.healthy === 1) {
        return {
          status: 'healthy',
          provider: 'postgresql',
          connected: true,
          activePatients: patientCount,
          activeEncounters: encounterCount,
          latencyMs: Date.now() - startTime,
        };
      }
      throw new Error('Database ping query returned unexpected response');
    } catch (err: any) {
      console.warn('[DatabaseClient] PostgreSQL connection check failed, running on durable local storage:', err.message);
      return {
        status: 'degraded',
        provider: 'file_backed',
        connected: false,
        activePatients: patientCount,
        activeEncounters: encounterCount,
        latencyMs: Date.now() - startTime,
        error: err.message,
      };
    }
  }

  async savePatient(patient: Patient): Promise<void> {
    if (!this.pool || !this.schemaInitialized) return;
    try {
      await this.pool.query(
        `INSERT INTO patients (id, hospital_patient_id, name, phone, abha_id, data, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           abha_id = EXCLUDED.abha_id,
           data = EXCLUDED.data,
           updated_at = NOW();`,
        [patient.id, patient.hospitalPatientId || null, patient.name, patient.phone, patient.abhaId || null, JSON.stringify(patient)]
      );
    } catch (err: any) {
      console.warn('[DatabaseClient] Failed to persist patient to PostgreSQL:', err.message);
    }
  }

  async saveEncounter(encounter: ClinicalEncounter): Promise<void> {
    if (!this.pool || !this.schemaInitialized) return;
    try {
      await this.pool.query(
        `INSERT INTO encounters (id, patient_id, status, data, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status,
           data = EXCLUDED.data,
           updated_at = NOW();`,
        [encounter.id, encounter.patientId, encounter.status, JSON.stringify(encounter)]
      );
    } catch (err: any) {
      console.warn('[DatabaseClient] Failed to persist encounter to PostgreSQL:', err.message);
    }
  }

  getStore() {
    return clinicalStore;
  }

  async close() {
    if (this.pool) {
      await this.pool.end().catch(() => {});
    }
  }
}

export const dbClient = new DatabaseClient();
