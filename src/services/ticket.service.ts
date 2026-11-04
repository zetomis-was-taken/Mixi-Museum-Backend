import { and, count, desc, eq } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { tickets } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import {
  paginate,
  parsePagination,
  type Paginated,
  type PaginationQuery,
} from '../utils/query.js';
import { assertIsoDate } from '../utils/validation.js';

type Ticket = typeof tickets.$inferSelect;
type TicketStatus = Ticket['status'];

export interface MyTicketListQuery extends PaginationQuery {
  museum_id?: string;
  status?: TicketStatus;
  valid_date?: string;
}

export interface MuseumTicketListQuery extends PaginationQuery {
  ticket_type_id?: string;
  status?: TicketStatus;
  valid_date?: string;
}

export function createTicketService(database: Database) {
  async function listMyTickets(
    userId: string,
    query: MyTicketListQuery = {},
  ): Promise<Paginated<Ticket>> {
    const pagination = parsePagination(query);

    const where = and(
      eq(tickets.userId, userId),
      query.museum_id ? eq(tickets.museumId, query.museum_id) : undefined,
      query.status ? eq(tickets.status, query.status) : undefined,
      query.valid_date
        ? eq(tickets.validDate, assertIsoDate(query.valid_date, 'valid_date'))
        : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(tickets)
        .where(where)
        .orderBy(desc(tickets.purchasedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(tickets).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  /** Returns one owned ticket including its QR code and purchase snapshot. */
  async function getMyTicket(userId: string, ticketId: string): Promise<Ticket> {
    const [ticket] = await database
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.userId, userId)))
      .limit(1);

    if (!ticket) {
      throw AppError.notFound('Ticket not found');
    }

    return ticket;
  }

  /** Tenant-scoped ticket listing for admission operations. */
  async function listMuseumTickets(
    museumId: string,
    query: MuseumTicketListQuery = {},
  ): Promise<Paginated<Ticket>> {
    const pagination = parsePagination(query);

    const where = and(
      eq(tickets.museumId, museumId),
      query.ticket_type_id
        ? eq(tickets.ticketTypeId, query.ticket_type_id)
        : undefined,
      query.status ? eq(tickets.status, query.status) : undefined,
      query.valid_date
        ? eq(tickets.validDate, assertIsoDate(query.valid_date, 'valid_date'))
        : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(tickets)
        .where(where)
        .orderBy(desc(tickets.purchasedAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(tickets).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getMuseumTicket(museumId: string, ticketId: string): Promise<Ticket> {
    const [ticket] = await database
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.museumId, museumId)))
      .limit(1);

    if (!ticket) {
      throw AppError.notFound('Ticket not found');
    }

    return ticket;
  }

  return { listMyTickets, getMyTicket, listMuseumTickets, getMuseumTicket };
}

export const ticketService = createTicketService(db);
