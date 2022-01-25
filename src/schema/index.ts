import { column, serializeColumnData } from './SchemaColumn';
import { schema as createSchema } from './Schema';
import { table } from './SchemaTable';

export const schema = {
  create: createSchema,
  column,
  table,
};

export { serializeColumnData };

export type { Schema, SchemaAny, SchemaOptions } from './Schema';
export type {
  SchemaColumn,
  SchemaColumnAny,
  SchemaColumnResolved,
  SchemaColumnsAny,
  DataFromSchemaColumn,
  DataFromSchemaColumns,
  DefaultValueBase,
} from './SchemaColumn';
export type {
  SchemaIndex,
  SchemaIndexAny,
  SchemaIndexFn,
  SchemaIndexResolved,
  SchemaIndexesAny,
  PartialSchemaTable,
  SchemaTable,
  SchemaTableAny,
  SchemaTableKey,
  SchemaTableResolved,
  SchemaTablesAny,
} from './SchemaTable';
