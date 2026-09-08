import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadResult {
  fileKey: string;
  storagePath: string;
  url: string;
  sizeBytes: number;
}

export class StorageService {
  private uploadDir: string;
  private s3Bucket: string;
  private s3Region: string;
  private s3Client: S3Client | null = null;

  constructor(customClient?: S3Client) {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
    this.uploadDir = path.join(dataDir, 'uploads');
    this.s3Bucket = process.env.S3_BUCKET || 'medikiosk-clinical-records-2026';
    this.s3Region = process.env.AWS_REGION || 'ap-south-1';

    if (customClient) {
      this.s3Client = customClient;
    }

    // Ensure local uploads directory exists
    if (!fs.existsSync(this.uploadDir)) {
      try {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      } catch (err) {
        console.warn('[StorageService] Could not create local uploads dir:', err);
      }
    }
  }

  /**
   * Returns whether S3 should be used for storage.
   * Active in CLOUD deployment mode or when ENABLE_S3 is explicitly true.
   * In LOCAL_HOSPITAL mode, local persistent storage is retained.
   */
  public shouldUseS3(): boolean {
    const mode = process.env.DEPLOYMENT_MODE;
    return (mode === 'CLOUD' || process.env.ENABLE_S3 === 'true') && Boolean(this.s3Bucket);
  }

  public getBucket(): string {
    return this.s3Bucket;
  }

  public getRegion(): string {
    return this.s3Region;
  }

  public setS3Client(client: S3Client | null): void {
    this.s3Client = client;
  }

  /**
   * Lazily initializes S3Client using the AWS SDK standard credential provider chain:
   * 1. Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
   * 2. Shared credentials / SSO
   * 3. Web identity token / ECS task role
   * 4. EC2 instance metadata (IAM role)
   * Does NOT require long-lived static keys when running on EC2 with an IAM role.
   */
  private getS3Client(): S3Client {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: this.s3Region,
      });
    }
    return this.s3Client;
  }

  /**
   * Upload a medical document or report
   * In CLOUD mode: Uploads to private AWS S3 bucket (encounters/{encounterId}/...)
   * In LOCAL_HOSPITAL mode: Stores in secure local volume with checksums
   */
  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    encounterId: string
  ): Promise<UploadResult> {
    const cleanEncounterId = (encounterId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = path.extname(originalName) || '.bin';
    const randomHash = crypto.randomBytes(8).toString('hex');
    const safeBaseName = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const timestamp = Date.now();
    const fileKey = `encounters/${cleanEncounterId}/${timestamp}_${safeBaseName}_${randomHash}${ext}`;

    if (this.shouldUseS3()) {
      return this.uploadToS3(buffer, fileKey, mimeType, safeBaseName, cleanEncounterId);
    } else {
      return this.uploadToLocalStorage(buffer, fileKey);
    }
  }

  private async uploadToLocalStorage(buffer: Buffer, fileKey: string): Promise<UploadResult> {
    const localFilePath = path.join(this.uploadDir, fileKey);
    const parentDir = path.dirname(localFilePath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    await fs.promises.writeFile(localFilePath, buffer);

    return {
      fileKey,
      storagePath: localFilePath,
      url: `/api/documents/raw/${encodeURIComponent(fileKey)}`,
      sizeBytes: buffer.length,
    };
  }

  private async uploadToS3(
    buffer: Buffer,
    fileKey: string,
    mimeType: string,
    safeBaseName?: string,
    encounterId?: string
  ): Promise<UploadResult> {
    try {
      console.log(`[StorageService] Uploading to AWS S3 bucket: ${this.s3Bucket} in ${this.s3Region} (${fileKey})`);

      const client = this.getS3Client();
      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: fileKey,
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
        ServerSideEncryption: 'AES256',
        Metadata: {
          originalName: safeBaseName || '',
          encounterId: encounterId || '',
          uploadedAt: new Date().toISOString(),
        },
      });

      await client.send(command);

      return {
        fileKey,
        storagePath: `s3://${this.s3Bucket}/${fileKey}`,
        url: `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${fileKey}`,
        sizeBytes: buffer.length,
      };
    } catch (err: any) {
      console.error('[StorageService] S3 upload failed, falling back to local disk:', err.message || err);
      return this.uploadToLocalStorage(buffer, fileKey);
    }
  }

  /**
   * Generates a time-limited signed URL for authorized medical staff viewing.
   * In S3 mode: Uses @aws-sdk/s3-request-presigner GetObjectCommand (default 15 mins).
   * In Local mode: Uses HMAC-SHA256 signed URL with token verification (default 15 mins).
   */
  async getExpiringSignedUrl(fileKey: string, expiresInMinutes: number = 15): Promise<string> {
    const expiresInSeconds = expiresInMinutes * 60;

    if (this.shouldUseS3()) {
      try {
        const client = this.getS3Client();
        const command = new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: fileKey,
        });

        return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
      } catch (err: any) {
        console.warn('[StorageService] Failed to generate S3 presigned URL, falling back to local HMAC signed URL:', err.message || err);
      }
    }

    // Local signed URL with HMAC verification for LOCAL_HOSPITAL mode
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const token = crypto
      .createHmac('sha256', process.env.JWT_SECRET || 'medikiosk-secret')
      .update(`${fileKey}:${expires}`)
      .digest('hex')
      .slice(0, 16);

    return `/api/documents/view/${encodeURIComponent(fileKey)}?expires=${expires}&token=${token}`;
  }
}

export const storageService = new StorageService();
