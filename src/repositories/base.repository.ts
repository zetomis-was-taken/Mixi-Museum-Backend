import { and, eq } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

type TableConfig = Record<string, unknown>;

export function createRepository<TTable extends PgTable>(db: any, table: TTable) {
  type Row = typeof table.$inferSelect;
  type Insert = typeof table.$inferInsert;

  function conditions(filters: Partial<Row>) {
    const entries = Object.entries(filters).filter(([, value]) => value !== undefined);
    return entries.length ? and(...entries.map(([key, value]) => eq((table as unknown as TableConfig)[key] as never, value as never))) : undefined;
  }

  return {
    async create(values: Insert): Promise<Row | undefined> {
      const rows = await db.insert(table).values(values).returning();
      return rows[0] as Row | undefined;
    },
    async findById(id: string, scope: Partial<Row> = {}): Promise<Row | undefined> {
      const rows = await db.select().from(table).where(conditions({ ...scope, id } as Partial<Row>)).limit(1);
      return rows[0] as Row | undefined;
    },
    async findMany(filters: Partial<Row> = {}, options: { limit?: number; offset?: number } = {}): Promise<Row[]> {
      let query = db.select().from(table).where(conditions(filters));
      if (options.limit !== undefined) query = query.limit(options.limit);
      if (options.offset !== undefined) query = query.offset(options.offset);
      return query as Promise<Row[]>;
    },
    async updateById(id: string, values: Partial<Insert>, scope: Partial<Row> = {}): Promise<Row | undefined> {
      const rows = await db.update(table).set(values).where(conditions({ ...scope, id } as Partial<Row>)).returning();
      return rows[0] as Row | undefined;
    },
    async deleteById(id: string, scope: Partial<Row> = {}): Promise<Row | undefined> {
      const rows = await db.delete(table).where(conditions({ ...scope, id } as Partial<Row>)).returning();
      return rows[0] as Row | undefined;
    },
  };
}
