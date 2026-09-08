/**
 * Express OCR Service Client
 * Communicates over localhost with the Python PaddleOCR microservice (port 8002).
 */

export interface OCRPageResult {
  page_number: number;
  text: string;
  average_confidence: number;
}

export interface OCRResult {
  success: boolean;
  documentType: 'image' | 'pdf' | string;
  fullText: string;
  averageConfidence: number;
  needsReview: boolean;
  minConfidenceThreshold: number;
  pagesProcessed: number;
  processingTimeMs: number;
  pages?: OCRPageResult[];
  error?: string;
}

export interface OCRHealthStatus {
  status: string;
  ocrServiceReachable: boolean;
  serviceUrl: string;
  ocrReady?: boolean;
  device?: string;
  lang?: string;
  minConfidence?: number;
  error?: string;
}

export function getOCRServiceUrl(): string {
  return (process.env.OCR_SERVICE_URL || 'http://127.0.0.1:8002').replace(/\/+$/, '');
}

/**
 * Checks connectivity and readiness of the Python PaddleOCR service.
 */
export async function checkOCRServiceHealth(): Promise<OCRHealthStatus> {
  const serviceUrl = getOCRServiceUrl();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${serviceUrl}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        status: 'degraded',
        ocrServiceReachable: false,
        serviceUrl,
        error: `OCR service returned status ${response.status}`,
      };
    }

    const data: any = await response.json();
    return {
      status: data.status || 'healthy',
      ocrServiceReachable: true,
      serviceUrl,
      ocrReady: data.ocr_ready ?? true,
      device: data.device,
      lang: data.lang,
      minConfidence: data.min_confidence,
    };
  } catch (err: any) {
    return {
      status: 'offline',
      ocrServiceReachable: false,
      serviceUrl,
      error: 'OCR reading service is temporarily unavailable. Ensure Python ocr-service is running on ' + serviceUrl,
    };
  }
}

/**
 * Sends document file buffer to local Python PaddleOCR microservice for text extraction and confidence scoring.
 */
export async function executeDocumentOCR(
  fileBuffer: Buffer,
  fileName: string = 'document.pdf',
  mimeType: string = 'application/pdf'
): Promise<OCRResult> {
  const serviceUrl = getOCRServiceUrl();

  try {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('file', blob, fileName);

    const controller = new AbortController();
    const timeoutMs = Number(process.env.AI_TIMEOUT) || 120000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${serviceUrl}/ocr`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errData: any = await response.json().catch(() => ({}));
      return {
        success: false,
        documentType: fileName.endsWith('.pdf') ? 'pdf' : 'image',
        fullText: '',
        averageConfidence: 0.0,
        needsReview: true,
        minConfidenceThreshold: 0.70,
        pagesProcessed: 0,
        processingTimeMs: 0,
        error: errData?.error || `OCR service returned status ${response.status}`,
      };
    }

    const data: any = await response.json();
    return {
      success: data.success ?? true,
      documentType: data.document_type || 'document',
      fullText: data.full_text || '',
      averageConfidence: data.average_confidence ?? 0.0,
      needsReview: data.needs_review ?? false,
      minConfidenceThreshold: data.min_confidence_threshold ?? 0.70,
      pagesProcessed: data.pages_processed ?? 1,
      processingTimeMs: data.processing_time_ms ?? 0,
      pages: data.pages || [],
    };
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return {
        success: false,
        documentType: 'document',
        fullText: '',
        averageConfidence: 0.0,
        needsReview: true,
        minConfidenceThreshold: 0.70,
        pagesProcessed: 0,
        processingTimeMs: 0,
        error: 'Document OCR processing timed out. Document saved for staff review.',
      };
    }
    console.warn('[OCR Client Error] Could not reach OCR service:', err?.message || err);
    return {
      success: false,
      documentType: 'document',
      fullText: '',
      averageConfidence: 0.0,
      needsReview: true,
      minConfidenceThreshold: 0.70,
      pagesProcessed: 0,
      processingTimeMs: 0,
      error: 'Document reading service is temporarily unavailable. Your document has been saved for healthcare staff review.',
    };
  }
}
