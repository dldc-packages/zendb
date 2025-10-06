import type { TCreateTableOperation } from "./Operation.ts";
import {
  declare as declareTable,
  type TCreateTableOptions,
  type TTable,
} from "./Table.ts";
import type {
  ColumnsBase,
  ColumnsToExprRecord,
  ColumnsToInput,
} from "./utils/types.ts";

export interface TSchema<Tables extends Record<string, ColumnsBase>> {
  readonly definition: Tables;
  readonly tables: {
    [TableName in keyof Tables]: TTable<
      Tables[TableName],
      ColumnsToInput<Tables[TableName]>,
      ColumnsToExprRecord<Tables[TableName]>
    >;
  };
}

export type TAnySchema = TSchema<any>;

export function declare<Tables extends Record<string, ColumnsBase>>(
  tables: Tables,
): TSchema<Tables> {
  return {
    definition: tables,
    tables: Object.fromEntries(
      Object.entries(tables).map((
        [tableName, columns],
      ) => [tableName, declareTable(tableName, columns)]),
    ) as any,
  };
}

export function createTables<
  Tables extends Record<string, TTable<any, any, any>>,
>(
  tables: Tables,
  options?: TCreateTableOptions,
): Array<TCreateTableOperation> {
  return Object.values(tables).map((table) => table.schema.create(options));
}
