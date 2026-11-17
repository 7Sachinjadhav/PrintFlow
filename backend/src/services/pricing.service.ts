import prisma from '../utils/prisma.js';
import {
  DocumentSettingInput,
  CalculatedDocumentPrice,
  CalculatedOrderPrice,
  PaperSize,
  ColorMode,
  DuplexMode
} from '../types/index.js';

export function parsePageRange(rangeStr: string | undefined, totalPages: number): number[] {
  if (!rangeStr || rangeStr.trim() === '') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pagesSet = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = Math.max(1, start); i <= Math.min(totalPages, end); i++) {
          pagesSet.add(i);
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
        pagesSet.add(pageNum);
      }
    }
  }

  return Array.from(pagesSet).sort((a, b) => a - b);
}

export class PricingService {
  /**
   * Fetches active pricing rules and services for a given shop
   */
  static async getShopPricingConfig(shopId: string) {
    const [rules, services] = await Promise.all([
      prisma.pricingRule.findMany({ where: { shopId, isActive: true } }),
      prisma.service.findMany({ where: { shopId, isEnabled: true } }),
    ]);

    const rulesMap = new Map<string, number>();
    for (const r of rules) {
      rulesMap.set(`${r.category}:${r.itemKey}`, r.unitPrice);
    }

    const servicesMap = new Map<string, { price: number; unitType: string }>();
    for (const s of services) {
      servicesMap.set(s.serviceKey, { price: s.basePrice, unitType: s.unitType });
    }

    return { rulesMap, servicesMap };
  }

  /**
   * Calculate single document price
   */
  static calculateItemPrice(
    setting: DocumentSettingInput,
    docInfo: { originalFilename: string; totalPages: number },
    pricingConfig: {
      rulesMap: Map<string, number>;
      servicesMap: Map<string, { price: number; unitType: string }>;
    }
  ): CalculatedDocumentPrice {
    const { rulesMap, servicesMap } = pricingConfig;

    // 1. Determine selected page count
    let selectedPagesCount = docInfo.totalPages;
    if (setting.pageRangeType === 'CUSTOM' && setting.customRange) {
      const selected = parsePageRange(setting.customRange, docInfo.totalPages);
      selectedPagesCount = Math.max(1, selected.length);
    }

    // 2. Base rate lookup
    // Format: PRINT_<COLORMODE>:<PAPERSIZE>_<COLORMODE> e.g. "PRINT_BW:A4_BW"
    const lookupKey = `PRINT_${setting.colorMode}:${setting.paperSize}_${setting.colorMode}`;
    let baseRate = rulesMap.get(lookupKey);

    // Fallbacks if custom size not explicitly in rules
    if (baseRate === undefined) {
      if (setting.colorMode === 'COLOR') {
        baseRate = setting.paperSize === 'A3' ? 20.0 : 10.0;
      } else {
        baseRate = setting.paperSize === 'A3' ? 5.0 : 2.0;
      }
    }

    // 3. Duplex adjustment
    // In duplex, 2 pages fit on 1 sheet. If shop offers duplex discount:
    const sheetsCount = setting.duplexMode === 'DOUBLE' 
      ? Math.ceil(selectedPagesCount / 2) 
      : selectedPagesCount;

    let duplexDiscountPerSheet = 0;
    if (setting.duplexMode === 'DOUBLE') {
      duplexDiscountPerSheet = rulesMap.get('DUPLEX_DISCOUNT:DOUBLE_SIDED_DISCOUNT') || 0.50; // default 50p discount per duplex sheet
    }

    const singlePrintCostBeforeDiscount = selectedPagesCount * baseRate;
    const duplexSavings = (setting.duplexMode === 'DOUBLE' && selectedPagesCount > 1)
      ? Math.floor(selectedPagesCount / 2) * duplexDiscountPerSheet
      : 0;

    const basePrintCostPerCopy = Math.max(0, singlePrintCostBeforeDiscount - duplexSavings);
    const copies = Math.max(1, setting.copies || 1);
    const printCost = Math.round(basePrintCostPerCopy * copies * 100) / 100;

    // 4. Add-on services
    let bindingCost = 0;
    if (setting.bindingService === 'SPIRAL') {
      const s = servicesMap.get('SPIRAL_BINDING');
      bindingCost = (s?.price ?? 40.0) * copies;
    } else if (setting.bindingService === 'STAPLE') {
      const s = servicesMap.get('STAPLING');
      bindingCost = (s?.price ?? 5.0) * copies;
    }

    let laminationCost = 0;
    if (setting.laminationService) {
      const s = servicesMap.get('LAMINATION');
      const lamRate = s?.price ?? 20.0;
      // Lamination is per sheet
      laminationCost = lamRate * sheetsCount * copies;
    }

    const documentTotal = Math.round((printCost + bindingCost + laminationCost) * 100) / 100;

    return {
      documentId: setting.documentId,
      originalFilename: docInfo.originalFilename,
      totalPages: docInfo.totalPages,
      selectedPages: selectedPagesCount,
      billablePages: selectedPagesCount * copies,
      sheetsCount: sheetsCount * copies,
      copies,
      colorMode: setting.colorMode,
      paperSize: setting.paperSize,
      duplexMode: setting.duplexMode,
      basePrintRate: baseRate,
      printCost,
      bindingCost,
      laminationCost,
      documentTotal,
    };
  }

  /**
   * Calculate complete order price
   */
  static async calculateOrderPrice(
    shopId: string,
    items: {
      setting: DocumentSettingInput;
      originalFilename: string;
      pageCount: number;
    }[]
  ): Promise<CalculatedOrderPrice> {
    const pricingConfig = await this.getShopPricingConfig(shopId);

    const calculatedItems = items.map((item) =>
      this.calculateItemPrice(
        item.setting,
        { originalFilename: item.originalFilename, totalPages: item.pageCount },
        pricingConfig
      )
    );

    const subtotal = calculatedItems.reduce((acc, curr) => acc + curr.documentTotal, 0);

    // Minimum order amount check (e.g., Rs. 5.00 min if configured)
    const taxAmount = 0.0; // Currently Xerox shops typically quote tax-inclusive rates, can be configured
    const discountAmount = 0.0;
    const totalAmount = Math.max(0, Math.round((subtotal + taxAmount - discountAmount) * 100) / 100);

    return {
      items: calculatedItems,
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount,
      discountAmount,
      totalAmount,
      currency: 'INR',
    };
  }
}
