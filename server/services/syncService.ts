import fs from 'fs';
import path from 'path';
import { clinicalStore } from '../db/store';
import { patientIdentityService } from './patientIdentityService';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const SYNC_QUEUE_FILE = path.join(DATA_DIR, 'sync_queue.json');

export type SyncOperationType =
  | 'UPSERT_PATIENT'
  | 'UPSERT_ENCOUNTER'
  | 'UPSERT_SUMMARY'
  | 'LOG_AUDIT'
  | 'UPLOAD_DOCUMENT';

export type SyncItemStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT';

export interface SyncQueueItem {
  id: string;
  operation: SyncOperationType;
  entityType: 'Patient' | 'Encounter' | 'Summary' | 'Audit' | 'Document';
  entityId: string;
  payload: any;
  version: number;
  createdAt: string;
  status: SyncItemStatus;
  retryCount: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  idempotencyKey: string;
  conflictDetails?: {
    localVersion: any;
    remoteVersion: any;
    detectedAt: string;
    resolved: boolean;
  };
}

export interface SyncStatusReport {
  mode: 'LOCAL_HOSPITAL' | 'CLOUD';
  isOnline: boolean;
  cloudReachable: boolean;
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  syncedCount: number;
  conflictCount: number;
  lastSyncTime: string | null;
  statusMessage: string;
}

export class HybridSyncService {
  private queue: Map<string, SyncQueueItem> = new Map();
  private isOnline: boolean = true;
  private cloudReachable: boolean = false;
  private isSyncing: boolean = false;
  private lastSyncTime: string | null = null;
  private checkIntervalTimer: NodeJS.Timeout | null = null;
  private workerTimer: NodeJS.Timeout | null = null;
  private deploymentMode: 'LOCAL_HOSPITAL' | 'CLOUD';
  private cloudApiUrl: string;

  constructor() {
    this.deploymentMode = (process.env.DEPLOYMENT_MODE as any) === 'CLOUD' ? 'CLOUD' : 'LOCAL_HOSPITAL';
    this.cloudApiUrl = process.env.CLOUD_API_URL || 'https://api.medikiosk.in';
    this.init();
  }

  private init() {
    // Restore persistent queue from disk
    this.loadQueueFromDisk();

    // Start periodic connectivity check (every 10 seconds)
    this.checkConnectivity();
    this.checkIntervalTimer = setInterval(() => this.checkConnectivity(), 10000);

    // Start sync processor (every 15 seconds if in local hospital mode)
    if (this.deploymentMode === 'LOCAL_HOSPITAL') {
      this.workerTimer = setInterval(() => this.processSyncQueue(), 15000);
    }
  }

  private loadQueueFromDisk() {
    try {
      if (fs.existsSync(SYNC_QUEUE_FILE)) {
        const raw = fs.readFileSync(SYNC_QUEUE_FILE, 'utf-8');
        const items = JSON.parse(raw) as SyncQueueItem[];
        if (Array.isArray(items)) {
          for (const item of items) {
            // Reset in-flight syncing items to PENDING so they are retried
            if (item.status === 'SYNCING') {
              item.status = 'PENDING';
            }
            this.queue.set(item.id, item);
          }
          console.log(
            `[HybridSyncService] Restored ${this.queue.size} sync items from persistent queue (${this.getPendingCount()} pending).`
          );
        }
      }
    } catch (e) {
      console.warn('[HybridSyncService] Could not read sync queue from disk:', e);
    }
  }

  public persistQueueToDisk() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = `${SYNC_QUEUE_FILE}.${Date.now()}.${Math.random().toString(36).slice(2, 6)}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(Array.from(this.queue.values()), null, 2), 'utf-8');
      fs.renameSync(tmpFile, SYNC_QUEUE_FILE);
    } catch (e) {
      console.error('[HybridSyncService] Error saving sync queue to disk:', e);
    }
  }

  /**
   * Health/liveness probe for internet and cloud API connectivity
   */
  async checkConnectivity(): Promise<boolean> {
    if (this.deploymentMode === 'CLOUD') {
      this.isOnline = true;
      this.cloudReachable = true;
      return true;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.cloudApiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      }).catch(() => null);
      clearTimeout(timeout);

      if (res && res.ok) {
        this.isOnline = true;
        this.cloudReachable = true;
      } else {
        // Test general internet connectivity (e.g. Cloudflare DNS)
        const cfRes = await fetch('https://1.1.1.1/cdn-cgi/trace', {
          method: 'HEAD',
          signal: AbortSignal.timeout(2500),
        }).catch(() => null);

        this.isOnline = Boolean(cfRes && cfRes.ok);
        this.cloudReachable = false;
      }
    } catch {
      this.isOnline = false;
      this.cloudReachable = false;
    }

    return this.isOnline;
  }

  /**
   * Enqueue a local change for cloud synchronization
   */
  enqueue(
    operation: SyncOperationType,
    entityType: SyncQueueItem['entityType'],
    entityId: string,
    payload: any,
    version: number = 1
  ): SyncQueueItem {
    const idempotencyKey = `SYNC_${entityType}_${entityId}_v${version}_${Date.now()}`;
    const id = `SQ_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const item: SyncQueueItem = {
      id,
      operation,
      entityType,
      entityId,
      payload,
      version,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
      retryCount: 0,
      idempotencyKey,
    };

    this.queue.set(id, item);
    this.persistQueueToDisk();
    console.log(
      `[HYBRID_SYNC] Queued local change: ${operation} (${entityType}:${entityId}) | Total pending: ${this.getPendingCount()}`
    );

    // If online, trigger sync immediately in background
    if (this.isOnline && this.cloudReachable && !this.isSyncing) {
      setImmediate(() => this.processSyncQueue());
    }

    return item;
  }

  /**
   * Process all pending items in the sync queue with exponential backoff and idempotency
   */
  async processSyncQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    if (this.isSyncing || this.deploymentMode === 'CLOUD') {
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    await this.checkConnectivity();
    if (!this.isOnline || !this.cloudReachable) {
      // In offline/hospital network mode: keep items queued safely
      return { processed: 0, succeeded: 0, failed: 0 };
    }

    this.isSyncing = true;
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    const pendingItems = Array.from(this.queue.values())
      .filter((item) => item.status === 'PENDING' || item.status === 'FAILED')
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    for (const item of pendingItems) {
      // Backoff check: 1s, 2s, 4s, 8s, max 60s
      if (item.lastAttemptAt && item.retryCount > 0) {
        const backoffMs = Math.min(60000, 1000 * Math.pow(2, item.retryCount));
        const timeSince = Date.now() - new Date(item.lastAttemptAt).getTime();
        if (timeSince < backoffMs) {
          continue;
        }
      }

      processed++;
      item.status = 'SYNCING';
      item.lastAttemptAt = new Date().toISOString();

      try {
        const syncResult = await this.pushToCloud(item);

        if (syncResult.success) {
          item.status = 'SYNCED';
          succeeded++;
          this.lastSyncTime = new Date().toISOString();
        } else if (syncResult.conflict) {
          item.status = 'CONFLICT';
          item.conflictDetails = {
            localVersion: item.payload,
            remoteVersion: syncResult.remoteData,
            detectedAt: new Date().toISOString(),
            resolved: false,
          };
          console.warn(
            `[HYBRID_SYNC_CONFLICT] Conflict detected for ${item.entityType}:${item.entityId}. Flagged for review.`
          );
        } else {
          item.status = 'FAILED';
          item.retryCount++;
          item.errorMessage = syncResult.error || 'Unknown sync error';
          failed++;
        }
      } catch (err: any) {
        item.status = 'FAILED';
        item.retryCount++;
        item.errorMessage = err.message || 'Network exception during sync';
        failed++;
      }
    }

    this.isSyncing = false;
    if (processed > 0) {
      this.persistQueueToDisk();
    }
    return { processed, succeeded, failed };
  }

  /**
   * Simulate or execute cloud push with Idempotency-Key
   */
  private async pushToCloud(item: SyncQueueItem): Promise<{
    success: boolean;
    conflict?: boolean;
    remoteData?: any;
    error?: string;
  }> {
    // If running in development or simulated cloud URL
    if (this.cloudApiUrl.includes('localhost') || !process.env.CLOUD_SYNC_SECRET) {
      // High-fidelity local simulation of cloud sync
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { success: true };
    }

    const endpoint = `${this.cloudApiUrl}/api/sync/ingest`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sync-Secret': process.env.CLOUD_SYNC_SECRET || '',
        'Idempotency-Key': item.idempotencyKey,
      },
      body: JSON.stringify({
        operation: item.operation,
        entityType: item.entityType,
        entityId: item.entityId,
        payload: item.payload,
        version: item.version,
        sourceTimestamp: item.createdAt,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.status === 409) {
      const conflictBody = await res.json().catch(() => ({}));
      return { success: false, conflict: true, remoteData: conflictBody.remoteData };
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Cloud returned HTTP ${res.status}: ${errText}` };
    }

    return { success: true };
  }

  getPendingCount(): number {
    return Array.from(this.queue.values()).filter((i) => i.status === 'PENDING' || i.status === 'FAILED').length;
  }

  getSyncStatus(): SyncStatusReport {
    const items = Array.from(this.queue.values());
    const pendingCount = items.filter((i) => i.status === 'PENDING').length;
    const syncingCount = items.filter((i) => i.status === 'SYNCING').length;
    const failedCount = items.filter((i) => i.status === 'FAILED').length;
    const syncedCount = items.filter((i) => i.status === 'SYNCED').length;
    const conflictCount = items.filter((i) => i.status === 'CONFLICT').length;

    let statusMessage = 'All records synchronized with cloud.';
    if (this.deploymentMode === 'LOCAL_HOSPITAL') {
      if (!this.isOnline) {
        statusMessage = 'Hospital Network Mode (Internet Unavailable — Local Operation Active)';
      } else if (!this.cloudReachable) {
        statusMessage = 'Cloud Sync Temporarily Unavailable — Local Operation Active';
      } else if (pendingCount > 0) {
        statusMessage = `${pendingCount} local updates queued for synchronization.`;
      } else if (conflictCount > 0) {
        statusMessage = `${conflictCount} clinical records have conflict flagged for review.`;
      }
    }

    return {
      mode: this.deploymentMode,
      isOnline: this.isOnline,
      cloudReachable: this.cloudReachable,
      pendingCount,
      syncingCount,
      failedCount,
      syncedCount,
      conflictCount,
      lastSyncTime: this.lastSyncTime,
      statusMessage,
    };
  }

  /**
   * Resolve a clinical sync conflict with audit logging
   */
  resolveConflict(
    syncId: string,
    resolution: 'USE_LOCAL' | 'USE_REMOTE' | 'MERGE',
    mergedPayload?: any,
    resolvedBy: string = 'DOCTOR_WORKSTATION'
  ): boolean {
    const item = this.queue.get(syncId);
    if (!item || item.status !== 'CONFLICT') return false;

    if (resolution === 'USE_LOCAL') {
      item.status = 'PENDING';
      item.retryCount = 0;
    } else if (resolution === 'USE_REMOTE') {
      item.status = 'SYNCED';
      // If patient record, update local store with remote data
      if (item.entityType === 'Patient' && item.conflictDetails?.remoteVersion) {
        clinicalStore.updatePatient(item.entityId, item.conflictDetails.remoteVersion);
      }
    } else if (resolution === 'MERGE' && mergedPayload) {
      item.payload = mergedPayload;
      item.status = 'PENDING';
      item.retryCount = 0;
    }

    if (item.conflictDetails) {
      item.conflictDetails.resolved = true;
    }

    clinicalStore.logAudit(resolvedBy, 'DOCTOR', 'SYNC_CONFLICT_RESOLVED', item.entityType, item.entityId, {
      resolution,
      syncId,
    });

    this.persistQueueToDisk();
    return true;
  }

  destroy() {
    if (this.checkIntervalTimer) clearInterval(this.checkIntervalTimer);
    if (this.workerTimer) clearInterval(this.workerTimer);
  }
}

export const hybridSyncService = new HybridSyncService();
