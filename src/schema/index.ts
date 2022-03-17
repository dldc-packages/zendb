import { SchemaTableAny, SchemaTable, InferSchemaTableResult } from './SchemaTable';
import { SchemaColumn } from './SchemaColumn';

export * from './Datatype';
export * from './SchemaTable';
export * from './SchemaColumn';

export type SchemaTablesAny = Record<string, SchemaTableAny>;

export type Schema<Tables extends SchemaTablesAny> = {
  tables: Tables;
  strict?: boolean;
  sanitize?: (data: unknown) => unknown;
  restore?: (data: unknown) => unknown;
};

export type SchemaAny = Required<Schema<SchemaTablesAny>>;

export function schema<Tables extends SchemaTablesAny>({
  tables,
  strict = true,
  restore = (d) => d,
  sanitize = (d) => d,
}: Schema<Tables>): Required<Schema<Tables>> {
  return { sanitize, restore, tables, strict };
}

export const column = SchemaColumn;

export const table = SchemaTable.create;

export type Infer<Table extends SchemaTableAny> = InferSchemaTableResult<Table>;
