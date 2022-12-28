import { ISchemaAny, SchemaColumnAny } from '../schema';
import { PRIV } from '../Utils';

export function getColumnSchema(schema: ISchemaAny, table: string, column: string): SchemaColumnAny {
  const tableSchema = schema.tables[table];
  if (!tableSchema) {
    throw new Error(`Table "${table}" not found`);
  }
  const columnSchema = tableSchema[PRIV].columns[column];
  if (!columnSchema) {
    throw new Error(`Column "${column}" not found in table "${table}"`);
  }
  return columnSchema;
}
