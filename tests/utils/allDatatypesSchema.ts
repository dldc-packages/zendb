import * as zen from '../../src/mod';

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
