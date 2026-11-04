import { and, asc, count, eq, gte, ilike, isNull, lte, or } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { ticketTypes } from '../db/schemas/index.js';
import { isForeignKeyViolation } from '../utils/db-errors.js';
import { AppError } from '../utils/errors.js';
import {
  containsPattern,
  paginate,
  parsePagination,
  type Paginated,
  type PaginationQuery,
} from '../utils/query.js';
import {
  assertIsoDate,
  assertNonEmpty,
  normalizeTimeOfDay,
  toMinorUnits,
} from '../utils/validation.js';
import { requirePublishedMuseumBySlug } from './support.js';

type TicketType = typeof ticketTypes.$inferSelect;
type DateMode = TicketType['dateMode'];
type TimeMode = TicketType['timeMode'];

export interface PublicTicketTypeListQuery extends PaginationQuery {
  q?: string;
}

export interface AdminTicketTypeListQuery extends PaginationQuery {
  q?: string;
}

export interface CreateTicketTypeInput {
  name: string;
  description?: string | null;
  priceMinor: number | bigint | string;
  dateMode?: DateMode;
  validDate?: string | null;
  timeMode?: TimeMode;
  slotStartTime?: string | null;
  slotEndTime?: string | null;
  capacity?: number | null;
  salesStartAt?: Date | null;
  salesEndAt?: Date | null;
  isActive?: boolean;
}

export type UpdateTicketTypeInput = Partial<CreateTicketTypeInput>;

interface TicketTypeConfiguration {
  dateMode: DateMode;
  validDate: string | null;
  timeMode: TimeMode;
  slotStartTime: string | null;
  slotEndTime: string | null;
  capacity: number | null;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
}

export function createTicketTypeService(database: Database) {
  async function requireTicketType(
    museumId: string,
    ticketTypeId: string,
  ): Promise<TicketType> {
    const [type] = await database
      .select()
      .from(ticketTypes)
      .where(
        and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.museumId, museumId)),
      )
      .limit(1);

    if (!type) {
      throw AppError.notFound('Ticket type not found');
    }

    return type;
  }

  /** Public listing: active types whose sale window is currently open. */
  async function listPublicTicketTypes(
    museumSlug: string,
    query: PublicTicketTypeListQuery = {},
  ): Promise<Paginated<TicketType>> {
    const museum = await requirePublishedMuseumBySlug(database, museumSlug, 'tickets');
    const pagination = parsePagination(query);
    const term = query.q?.trim();
    const now = new Date();

    const where = and(
      eq(ticketTypes.museumId, museum.id),
      eq(ticketTypes.isActive, true),
      or(isNull(ticketTypes.salesStartAt), lte(ticketTypes.salesStartAt, now)),
      or(isNull(ticketTypes.salesEndAt), gte(ticketTypes.salesEndAt, now)),
      term ? ilike(ticketTypes.name, containsPattern(term)) : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(ticketTypes)
        .where(where)
        .orderBy(asc(ticketTypes.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(ticketTypes).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getPublicTicketType(
    museumSlug: string,
    ticketTypeId: string,
  ): Promise<TicketType> {
    const museum = await requirePublishedMuseumBySlug(database, museumSlug, 'tickets');
    const now = new Date();

    const [type] = await database
      .select()
      .from(ticketTypes)
      .where(
        and(
          eq(ticketTypes.id, ticketTypeId),
          eq(ticketTypes.museumId, museum.id),
          eq(ticketTypes.isActive, true),
          or(isNull(ticketTypes.salesStartAt), lte(ticketTypes.salesStartAt, now)),
          or(isNull(ticketTypes.salesEndAt), gte(ticketTypes.salesEndAt, now)),
        ),
      )
      .limit(1);

    if (!type) {
      throw AppError.notFound('Ticket type not found');
    }

    return type;
  }

  async function listTicketTypes(
    museumId: string,
    query: AdminTicketTypeListQuery = {},
  ): Promise<Paginated<TicketType>> {
    const pagination = parsePagination(query);
    const term = query.q?.trim();

    const where = and(
      eq(ticketTypes.museumId, museumId),
      term ? ilike(ticketTypes.name, containsPattern(term)) : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(ticketTypes)
        .where(where)
        .orderBy(asc(ticketTypes.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(ticketTypes).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getTicketType(
    museumId: string,
    ticketTypeId: string,
  ): Promise<TicketType> {
    return requireTicketType(museumId, ticketTypeId);
  }

  async function createTicketType(
    museumId: string,
    input: CreateTicketTypeInput,
  ): Promise<TicketType> {
    const configuration = normalizeConfiguration({
      dateMode: input.dateMode ?? 'open',
      validDate: input.validDate ?? null,
      timeMode: input.timeMode ?? 'all_day',
      slotStartTime: input.slotStartTime ?? null,
      slotEndTime: input.slotEndTime ?? null,
      capacity: input.capacity ?? null,
      salesStartAt: input.salesStartAt ?? null,
      salesEndAt: input.salesEndAt ?? null,
    });

    const [type] = await database
      .insert(ticketTypes)
      .values({
        museumId,
        name: assertNonEmpty(input.name, 'name'),
        description: input.description?.trim() || null,
        priceMinor: toMinorUnits(input.priceMinor, 'price_minor'),
        ...configuration,
        isActive: input.isActive ?? true,
      })
      .returning();

    if (!type) {
      throw new Error('Ticket type insert returned no row');
    }

    return type;
  }

  async function updateTicketType(
    museumId: string,
    ticketTypeId: string,
    input: UpdateTicketTypeInput,
  ): Promise<TicketType> {
    if (Object.keys(input).length === 0) {
      throw AppError.badRequest('No ticket type fields to update');
    }

    const existing = await requireTicketType(museumId, ticketTypeId);

    const configuration = normalizeConfiguration({
      dateMode: input.dateMode ?? existing.dateMode,
      validDate: input.validDate !== undefined ? input.validDate : existing.validDate,
      timeMode: input.timeMode ?? existing.timeMode,
      slotStartTime:
        input.slotStartTime !== undefined ? input.slotStartTime : existing.slotStartTime,
      slotEndTime:
        input.slotEndTime !== undefined ? input.slotEndTime : existing.slotEndTime,
      capacity: input.capacity !== undefined ? input.capacity : existing.capacity,
      salesStartAt:
        input.salesStartAt !== undefined ? input.salesStartAt : existing.salesStartAt,
      salesEndAt:
        input.salesEndAt !== undefined ? input.salesEndAt : existing.salesEndAt,
    });

    const values: Partial<typeof ticketTypes.$inferInsert> = {
      ...configuration,
      updatedAt: new Date(),
    };

    if (input.name !== undefined) {
      values.name = assertNonEmpty(input.name, 'name');
    }
    if (input.description !== undefined) {
      values.description = input.description?.trim() || null;
    }
    if (input.priceMinor !== undefined) {
      values.priceMinor = toMinorUnits(input.priceMinor, 'price_minor');
    }
    if (input.isActive !== undefined) {
      values.isActive = input.isActive;
    }

    const [updated] = await database
      .update(ticketTypes)
      .set(values)
      .where(
        and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.museumId, museumId)),
      )
      .returning();

    if (!updated) {
      throw AppError.notFound('Ticket type not found');
    }

    return updated;
  }

  async function deleteTicketType(
    museumId: string,
    ticketTypeId: string,
  ): Promise<TicketType> {
    try {
      const [deleted] = await database
        .delete(ticketTypes)
        .where(
          and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.museumId, museumId)),
        )
        .returning();

      if (!deleted) {
        throw AppError.notFound('Ticket type not found');
      }

      return deleted;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw AppError.conflict(
          'Ticket type has issued tickets or invoice history and cannot be deleted',
        );
      }
      throw error;
    }
  }

  async function setTicketTypeActive(
    museumId: string,
    ticketTypeId: string,
    isActive: boolean,
  ): Promise<TicketType> {
    const [updated] = await database
      .update(ticketTypes)
      .set({ isActive, updatedAt: new Date() })
      .where(
        and(eq(ticketTypes.id, ticketTypeId), eq(ticketTypes.museumId, museumId)),
      )
      .returning();

    if (!updated) {
      throw AppError.notFound('Ticket type not found');
    }

    return updated;
  }

  async function activateTicketType(museumId: string, ticketTypeId: string) {
    return setTicketTypeActive(museumId, ticketTypeId, true);
  }

  async function deactivateTicketType(museumId: string, ticketTypeId: string) {
    return setTicketTypeActive(museumId, ticketTypeId, false);
  }

  return {
    listPublicTicketTypes,
    getPublicTicketType,
    listTicketTypes,
    getTicketType,
    createTicketType,
    updateTicketType,
    deleteTicketType,
    activateTicketType,
    deactivateTicketType,
  };
}

/**
 * Applies the ticket-type CHECK constraints in the service layer:
 * fixed dates need `valid_date`, slot mode needs ordered times, and price/capacity
 * cannot be negative.
 */
function normalizeConfiguration(
  input: TicketTypeConfiguration,
): TicketTypeConfiguration {
  const configuration = { ...input };

  if (configuration.capacity !== null) {
    if (!Number.isInteger(configuration.capacity) || configuration.capacity < 0) {
      throw AppError.badRequest('Invalid capacity', [
        { field: 'capacity', message: 'must be a non-negative integer' },
      ]);
    }
  }

  if (configuration.dateMode === 'fixed') {
    if (!configuration.validDate) {
      throw AppError.badRequest('valid_date is required when date_mode is fixed', [
        { field: 'valid_date', message: 'is required for fixed-date ticket types' },
      ]);
    }
    configuration.validDate = assertIsoDate(configuration.validDate, 'valid_date');
  } else {
    configuration.validDate = null;
  }

  if (configuration.timeMode === 'slot') {
    if (!configuration.slotStartTime || !configuration.slotEndTime) {
      throw AppError.badRequest(
        'slot_start_time and slot_end_time are required when time_mode is slot',
        [{ field: 'slot_start_time', message: 'is required for slot ticket types' }],
      );
    }

    configuration.slotStartTime = normalizeTimeOfDay(
      configuration.slotStartTime,
      'slot_start_time',
    );
    configuration.slotEndTime = normalizeTimeOfDay(
      configuration.slotEndTime,
      'slot_end_time',
    );

    if (configuration.slotEndTime <= configuration.slotStartTime) {
      throw AppError.badRequest('slot_end_time must be after slot_start_time', [
        { field: 'slot_end_time', message: 'must be after slot_start_time' },
      ]);
    }
  } else {
    configuration.slotStartTime = null;
    configuration.slotEndTime = null;
  }

  if (
    configuration.salesStartAt &&
    configuration.salesEndAt &&
    configuration.salesStartAt >= configuration.salesEndAt
  ) {
    throw AppError.badRequest('sales_end_at must be after sales_start_at', [
      { field: 'sales_end_at', message: 'must be after sales_start_at' },
    ]);
  }

  return configuration;
}

export const ticketTypeService = createTicketTypeService(db);
