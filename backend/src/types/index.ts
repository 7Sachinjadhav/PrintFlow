export type ColorMode = 'BW' | 'COLOR';
export type PaperSize = 'A4' | 'A3' | 'LEGAL' | 'LETTER';
export type DuplexMode = 'SINGLE' | 'DOUBLE';
export type Orientation = 'PORTRAIT' | 'LANDSCAPE';
export type PageRangeType = 'ALL' | 'CUSTOM';

export type OrderStatus =
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'QUEUED'
  | 'ASSIGNED'
  | 'PRINTING'
  | 'PRINTED'
  | 'READY_FOR_COLLECTION'
  | 'COLLECTED'
  | 'PAYMENT_FAILED'
  | 'PRINT_FAILED'
  | 'PAUSED'
  | 'CANCELLED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export type JobStatus =
  | 'QUEUED'
  | 'LEASED'
  | 'ASSIGNED'
  | 'PRINTING'
  | 'PRINTED'
  | 'SUBMITTED_TO_PRINTER'
  | 'NEEDS_REVIEW'
  | 'FAILED'
  | 'CANCELLED';

export type PrinterStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR' | 'PAUSED';

export type PrinterCapabilityType = 'BW' | 'COLOR' | 'BOTH';

export interface DocumentSettingInput {
  documentId: string;
  colorMode: ColorMode;
  paperSize: PaperSize;
  duplexMode: DuplexMode;
  orientation: Orientation;
  copies: number;
  pageRangeType: PageRangeType;
  customRange?: string;
  bindingService?: 'NONE' | 'SPIRAL' | 'STAPLE';
  laminationService?: boolean;
}

export interface CalculatedDocumentPrice {
  documentId: string;
  originalFilename: string;
  totalPages: number;
  selectedPages: number;
  billablePages: number;
  sheetsCount: number;
  copies: number;
  colorMode: ColorMode;
  paperSize: PaperSize;
  duplexMode: DuplexMode;
  basePrintRate: number;
  printCost: number;
  bindingCost: number;
  laminationCost: number;
  documentTotal: number;
}

export interface CalculatedOrderPrice {
  items: CalculatedDocumentPrice[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  currency: string;
}

export interface AdminAuthPayload {
  adminId: string;
  shopId: string;
  email: string;
  role: string;
}
