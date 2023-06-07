import { Column, Table } from '../../src/mod';

export const allDatatypesDb = Table.declareMany({
  datatype: {
    id: Column.dt.text().primary(),
    text: Column.dt.text(),
    integer: Column.dt.integer(),
    boolean: Column.dt.boolean(),
    date: Column.dt.date(),
    json: Column.dt.json(),
    number: Column.dt.number(),
  },
});
