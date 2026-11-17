import prisma from '../utils/prisma.js';

export class TokenService {
  /**
   * Generates a sequential daily token (e.g. PF-001, PF-002) atomically
   */
  static async generateDailyToken(shopId: string, customDateStr?: string): Promise<{ tokenNumber: string; tokenDate: string }> {
    const todayStr = customDateStr || new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Find the highest existing token for today in this shop
    const lastOrderToday = await prisma.order.findFirst({
      where: {
        shopId,
        tokenDate: todayStr,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        tokenNumber: true,
      },
    });

    let nextSequence = 1;

    if (lastOrderToday && lastOrderToday.tokenNumber) {
      // Extract number from format PF-XXX
      const match = lastOrderToday.tokenNumber.match(/\d+$/);
      if (match) {
        nextSequence = parseInt(match[0], 10) + 1;
      }
    }

    const paddedNumber = String(nextSequence).padStart(3, '0');
    const tokenNumber = `PF-${paddedNumber}`;

    return { tokenNumber, tokenDate: todayStr };
  }
}
