import { ISchemaAny } from './Schema';
import { PRIV } from './Utils';

export type TablesNames<Schema extends ISchemaAny> = keyof Schema['tables'];

export type ExtractTable<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = Schema['tables'][TableName];

export type ExtractTableColumn<
  Schema extends ISchemaAny,
  TableName extends TablesNames<Schema>,
  ColumnName extends keyof ExtractTable<Schema, TableName>[PRIV]['columns']
> = ExtractTable<Schema, TableName>[PRIV]['columns'][ColumnName];
