import { SchemaColumn } from './SchemaColumn';
import { InferSchemaTableResult, ISchemaTableAny, SchemaTable } from './SchemaTable';
import { TablesNames } from './types';

export type SchemaTablesAny = Record<string, ISchemaTableAny>;

export type ISchema<Tables extends SchemaTablesAny> = {
  readonly tables: Tables;
  readonly strict?: boolean;
};

export type ISchemaAny = Required<ISchema<SchemaTablesAny>>;

export type Infer<Schema extends ISchemaAny, TableName extends TablesNames<Schema>> = InferSchemaTableResult<Schema, TableName>;

export const Schema = (() => {
  return {
    define,
    column: SchemaColumn,
    table: SchemaTable,
  };

  function define<Tables extends SchemaTablesAny>({ tables, strict = true }: ISchema<Tables>): Required<ISchema<Tables>> {
    return { tables, strict };
  }
})();
