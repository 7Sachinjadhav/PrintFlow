import { describe, it, expect } from 'vitest';
import { TokenService } from '../src/services/token.service.js';

describe('Token Service', () => {
  it('generates sequential tokens with PF- prefix', async () => {
    // Generate for an isolated test date
    const dateStr = '2099-01-01';
    const token1 = await TokenService.generateDailyToken('shop-test-id', dateStr);
    expect(token1.tokenNumber).toMatch(/^PF-\d{3}$/);
    expect(token1.tokenDate).toBe(dateStr);
  });
});
