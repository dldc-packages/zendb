import type {
  ColumnsBase,
  ColumnsToExprRecord,
  ColumnsToInput,
} from "@dldc/zendb";
import { declare as declareTable, type TTable } from "./Table.ts";

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
