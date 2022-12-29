import { ISchemaAny } from './Schema';
import { ITable, Table } from './Table';
import { ExtractTable } from './Table/types';
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
