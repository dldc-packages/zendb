import { PRIV } from '../Utils';
import { SchemaIndexResolved, SchemaTableResolved, SchemaTablesAny } from './SchemaTable';

export type Schema<Tables extends SchemaTablesAny> = {
  [PRIV]: Tables;
  tables: Array<SchemaTableResolved>;
  sanitize: (data: unknown) => unknown;
  restore: (data: unknown) => unknown;
};

export type SchemaAny = Schema<SchemaTablesAny>;

export type SchemaOptions<Tables extends SchemaTablesAny> = {
  tables: Tables;
  sanitize?: (data: unknown) => unknown;
  restore?: (data: unknown) => unknown;
};

export function schema<Tables extends SchemaTablesAny>({
  tables,
  restore = (d) => d,
  sanitize = (d) => d,
}: SchemaOptions<Tables>): Schema<Tables> {
  return {
    [PRIV]: tables,
    sanitize,
    restore,
    tables: Object.entries(tables).map(([name, table]): SchemaTableResolved => {
      const indexesNames = new Set<string>();
      return {
        name,
        key: {
          fn: table[PRIV].key.fn,
          column: table[PRIV].key.column[PRIV],
        },
        indexes: table[PRIV].indexes.map(({ name, column, fn }): SchemaIndexResolved => {
          const nameLower = name.toLowerCase();
          if (nameLower === 'key') {
            throw new Error(`Index name 'key' is reserved`);
          }
          if (nameLower === 'data') {
            throw new Error(`Index name 'data' is reserved`);
          }
          if (indexesNames.has(nameLower)) {
            throw new Error(`Duplicate index name '${nameLower}'`);
          }
          indexesNames.add(nameLower);
          return { name, column: column[PRIV], fn };
        }),
      };
    }),
  };
}
