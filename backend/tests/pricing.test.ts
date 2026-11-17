import { describe, it, expect } from 'vitest';
import { parsePageRange, PricingService } from '../src/services/pricing.service.js';

describe('Pricing Service & Page Range Parser', () => {
  it('correctly parses empty or undefined range as all pages', () => {
    const pages = parsePageRange('', 5);
    expect(pages).toEqual([1, 2, 3, 4, 5]);
  });

  it('correctly parses custom ranges like "1-3, 5, 8"', () => {
    const pages = parsePageRange('1-3, 5, 8', 10);
    expect(pages).toEqual([1, 2, 3, 5, 8]);
  });

  it('clamps custom range within document total pages', () => {
    const pages = parsePageRange('1-15, 20', 5);
    expect(pages).toEqual([1, 2, 3, 4, 5]);
  });

  it('calculates single document pricing with duplex savings', () => {
    const rulesMap = new Map<string, number>();
    rulesMap.set('PRINT_BW:A4_BW', 2.0);
    rulesMap.set('DUPLEX_DISCOUNT:DOUBLE_SIDED_DISCOUNT', 0.5);

    const servicesMap = new Map<string, { price: number; unitType: string }>();
    servicesMap.set('SPIRAL_BINDING', { price: 40.0, unitType: 'PER_DOCUMENT' });

    const result = PricingService.calculateItemPrice(
      {
        documentId: 'doc-1',
        colorMode: 'BW',
        paperSize: 'A4',
        duplexMode: 'DOUBLE',
        orientation: 'PORTRAIT',
        copies: 1,
        pageRangeType: 'ALL',
        bindingService: 'SPIRAL',
      },
      { originalFilename: 'contract.pdf', totalPages: 4 },
      { rulesMap, servicesMap }
    );

    // 4 pages at ₹2.00 = ₹8.00 - (2 duplex sheets * ₹0.50 discount = ₹1.00) = ₹7.00
    // Spiral binding = ₹40.00
    // Document total = ₹47.00
    expect(result.printCost).toBe(7.0);
    expect(result.bindingCost).toBe(40.0);
    expect(result.sheetsCount).toBe(2);
    expect(result.documentTotal).toBe(47.0);
  });
});
