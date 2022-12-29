import { SchemaColumn } from './SchemaColumn';
import { InferSchemaTableResult, ISchemaTableAny, SchemaTable } from './SchemaTable';

export type SchemaTablesAny = Record<string, ISchemaTableAny>;

export type ISchema<Tables extends SchemaTablesAny> = {
  tables: Tables;
  strict?: boolean;
};

export type ISchemaAny = Required<ISchema<SchemaTablesAny>>;

export type Infer<Table extends ISchemaTableAny> = InferSchemaTableResult<Table>;

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
