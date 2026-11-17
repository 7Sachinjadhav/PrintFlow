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

export interface UploadedFileItem {
  tempId: string;
  originalFilename: string;
  storedFilename: string;
  fileSizeBytes: number;
  mimeType: string;
  pageCount: number;
  file?: File;
  previewUrl?: string;
  setting: {
    colorMode: ColorMode;
    paperSize: PaperSize;
    duplexMode: DuplexMode;
    orientation: Orientation;
    copies: number;
    pageRangeType: PageRangeType;
    customRange?: string;
    bindingService?: 'NONE' | 'SPIRAL' | 'STAPLE';
    laminationService?: boolean;
  };
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

export interface ShopInfo {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  workingHours?: string;
  isOpen: boolean;
  maxUploadSizeBytes: number;
  maxPageCount: number;
  supportedFormats: string;
}

export interface Printer {
  id: string;
  name: string;
  modelNumber?: string;
  ipAddress: string;
  windowsQueueName?: string;
  assignedCapability: 'BW' | 'COLOR' | 'BOTH';
  supportedPaperSizes: string;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'ERROR' | 'PAUSED';
  isDefault: boolean;
  isEnabled: boolean;
  routingPriority: number;
  lastHeartbeat?: string;
  currentJobId?: string;
  errorMessage?: string;
}

export interface PrintJob {
  id: string;
  orderId: string;
  documentId: string;
  printerId?: string;
  status: string;
  queueSequence: number;
  attemptCount: number;
  spoolerJobId?: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  order: {
    id: string;
    tokenNumber: string;
    status: OrderStatus;
    totalAmount: number;
    createdAt: string;
    customer?: {
      name?: string;
      phone?: string;
    };
  };
  document: {
    originalFilename: string;
    storedFilename: string;
    pageCount: number;
    settings?: {
      colorMode: ColorMode;
      paperSize: PaperSize;
      duplexMode: DuplexMode;
      copies: number;
      customRange?: string;
      bindingService?: string;
      laminationService?: boolean;
    };
  };
  printer?: Printer;
}
