import { ExtractTable } from './Query';
import { ISchemaAny } from './schema';
import { ITable, Table } from './Table';
import { mapObject } from './Utils';

export interface IDatabase<Schema extends ISchemaAny> {
  readonly tables: {
    [K in keyof Schema['tables']]: ITable<Schema, K, ExtractTable<Schema, K>>;
  };
}

export const Database = (() => {
  return {
    create,
  };

  function create<ISchema extends ISchemaAny>(schema: ISchema): IDatabase<ISchema> {
    return {
      tables: mapObject(schema.tables, (tableName) => {
        return Table.create(schema, tableName);
      }),
    };
  }
})();
