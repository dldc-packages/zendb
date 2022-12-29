import { Schema } from '../../src/mod';

export const allDatatypesSchema = Schema.create({
  tables: {
    datatype: Schema.table({
      id: Schema.column.dt.text().primary(),
      text: Schema.column.dt.text(),
      integer: Schema.column.dt.integer(),
      boolean: Schema.column.dt.boolean(),
      date: Schema.column.dt.date(),
      json: Schema.column.dt.json(),
      number: Schema.column.dt.number(),
    }),
  },
});
