import * as zen from '../../src/mod';
import { MockDriverDatabase } from './MockDriver';

export const allDatatypesSchema = zen.schema({
  tables: {
    datatype: zen.table({
      id: zen.column.text().primary(),
      text: zen.column.text(),
      integer: zen.column.integer(),
      boolean: zen.column.boolean(),
      date: zen.column.date(),
      json: zen.column.json(),
      number: zen.column.number(),
    }),
  },
});

export function initAllDatatypesDatabase(database: MockDriverDatabase) {
  const db = new zen.Database(database, allDatatypesSchema, 0);

  const stmt = database.mockNextStatement(`SELECT name FROM sqlite_master WHERE type = 'table'`);
  stmt.all.mockReturnValueOnce([]);
  db.initSchema();
  return db;
}
