import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { invoiceService } from './invoice.service.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockDb = vi.mocked(db);

describe('invoiceService.createInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates total and creates invoice with items', async () => {
    const createdInvoice = {
      id: 'inv-1',
      userId: 'u-1',
      museumId: 'm-1',
      kind: 'merchandise',
      status: 'paid',
      subtotal: '45.00',
      total: '45.00',
      currency: 'USD',
      createdAt: new Date(),
    };

    const createdItems = [
      {
        id: 'item-1',
        invoiceId: 'inv-1',
        productId: 'prod-1',
        description: 'T-Shirt',
        unitPrice: '15.00',
        quantity: 3,
      },
    ];

    mockDb.transaction.mockImplementation(async (callback: any) => {
      const tx = {
        insert: vi.fn().mockImplementation((table: any) => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue(
              table.name === 'invoice_items' ? createdItems : [createdInvoice],
            ),
          }),
        })),
      };
      return callback(tx);
    });

    const result = await invoiceService.createInvoice({
      userId: 'u-1',
      museumId: 'm-1',
      kind: 'merchandise',
      currency: 'USD',
      status: 'paid',
      items: [
        {
          productId: 'prod-1',
          description: 'T-Shirt',
          unitPrice: '15.00',
          quantity: 3,
        },
      ],
    });

    expect(result.id).toBe('inv-1');
    expect(result.total).toBe('45.00');
    expect(result.items).toHaveLength(1);
  });
});

describe('invoiceService.checkoutCart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws error if shop is disabled for this museum', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'm-1', shopEnabled: false, currency: 'USD' }]),
      }),
    } as any);

    await expect(invoiceService.checkoutCart('u-1', 'm-1')).rejects.toThrow(AppError);
  });

  it('throws error if cart has no items', async () => {
    let call = 0;
    mockDb.select.mockImplementation(() => {
      call++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            call === 1
              ? [{ id: 'm-1', shopEnabled: true, currency: 'USD' }]
              : [{ id: 'cart-1' }],
          ),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]), // No cart items
          }),
        }),
      } as any;
    });

    await expect(invoiceService.checkoutCart('u-1', 'm-1')).rejects.toThrow(AppError);
  });
});

describe('invoiceService.getUserInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws not found if invoice does not belong to user', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as any);

    await expect(invoiceService.getUserInvoice('u-1', 'inv-999')).rejects.toThrow(AppError);
  });
});
