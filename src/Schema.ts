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

/**
 * Declares a database schema with typed tables.
 *
 * @param tables - Object mapping table names to column definitions
 * @returns A typed schema object with table accessors
 *
 * @example
 * ```ts
 * const schema = Schema.declare({
 *   users: {
 *     id: Column.text().primary(),
 *     name: Column.text(),
 *     email: Column.text()
 *   },
 *   tasks: {
 *     id: Column.text().primary(),
 *     title: Column.text()
 *   }
 * });
 * ```
 */
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

/**
 * Creates SQL CREATE TABLE operations for all tables in a schema.
 *
 * @param tables - The tables from a schema definition
 * @param options - Optional table creation options (ifNotExists, strict)
 * @returns Array of CREATE TABLE operations to execute with the driver
 *
 * @example
 * ```ts
 * const operations = Schema.createTables(schema.tables, {
 *   ifNotExists: true,
 *   strict: true
 * });
 * driver.execMany(db, operations);
 * ```
 */
export function createTables<
  Tables extends Record<string, TTable<any, any, any>>,
>(
  tables: Tables,
  options?: TCreateTableOptions,
): Array<TCreateTableOperation> {
  return Object.values(tables).map((table) => table.schema.create(options));
}
