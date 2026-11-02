import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoiceService } from '../services/invoice.service.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import {
  checkoutCartHandler,
  museumInvoiceDetailHandler,
  museumInvoicesHandler,
  myInvoiceDetailHandler,
  myInvoicesHandler,
} from './invoice.controller.js';

vi.mock('../services/invoice.service.js', () => ({
  invoiceService: {
    checkoutCart: vi.fn(),
    listUserInvoices: vi.fn(),
    getUserInvoice: vi.fn(),
    listMuseumInvoices: vi.fn(),
    getMuseumInvoice: vi.fn(),
  },
}));

vi.mock('../utils/response.js', async () => {
  const actual = await vi.importActual('../utils/response.js');
  return {
    ...actual,
    sendSuccess: vi.fn(),
  };
});

const mockInvoiceService = vi.mocked(invoiceService);
const mockSendSuccess = vi.mocked(sendSuccess);

describe('InvoiceController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = { locals: {} };
  });

  it('checkoutCartHandler calls invoiceService.checkoutCart and responds with 201', async () => {
    mockReq = { user: { id: 'u-1', email: 'buyer@museum.com', roles: ['user'] } };
    mockRes.locals = { museum: { id: 'm-1' } };

    const mockInvoice = { id: 'inv-1', total: '50.00' } as any;
    mockInvoiceService.checkoutCart.mockResolvedValue(mockInvoice);

    await checkoutCartHandler(mockReq as Request, mockRes as Response);

    expect(mockInvoiceService.checkoutCart).toHaveBeenCalledWith('u-1', 'm-1');
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      mockInvoice,
      HttpStatus.CREATED,
      'Checkout completed successfully',
    );
  });

  it('myInvoicesHandler calls invoiceService.listUserInvoices', async () => {
    mockReq = { user: { id: 'u-1', email: 'buyer@museum.com', roles: ['user'] }, query: {} };
    const mockResult = { items: [], pagination: {} } as any;
    mockInvoiceService.listUserInvoices.mockResolvedValue(mockResult);

    await myInvoicesHandler(mockReq as Request, mockRes as Response);

    expect(mockInvoiceService.listUserInvoices).toHaveBeenCalledWith('u-1', {});
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockResult);
  });

  it('myInvoiceDetailHandler calls invoiceService.getUserInvoice', async () => {
    mockReq = {
      user: { id: 'u-1', email: 'buyer@museum.com', roles: ['user'] },
      params: { invoiceId: 'inv-1' },
    };

    const mockInvoice = { id: 'inv-1' } as any;
    mockInvoiceService.getUserInvoice.mockResolvedValue(mockInvoice);

    await myInvoiceDetailHandler(mockReq as Request, mockRes as Response);

    expect(mockInvoiceService.getUserInvoice).toHaveBeenCalledWith('u-1', 'inv-1');
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockInvoice);
  });

  it('museumInvoicesHandler calls invoiceService.listMuseumInvoices', async () => {
    mockReq = { query: {} };
    mockRes.locals = { museum: { id: 'm-1' } };

    const mockResult = { items: [], pagination: {} } as any;
    mockInvoiceService.listMuseumInvoices.mockResolvedValue(mockResult);

    await museumInvoicesHandler(mockReq as Request, mockRes as Response);

    expect(mockInvoiceService.listMuseumInvoices).toHaveBeenCalledWith('m-1', {});
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockResult);
  });
});

