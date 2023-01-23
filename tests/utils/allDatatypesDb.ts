import { ColumnDef, Database } from '../../src/mod';

export const allDatatypesDb = Database({
  datatype: {
    id: ColumnDef.dt.text().primary(),
    text: ColumnDef.dt.text(),
    integer: ColumnDef.dt.integer(),
    boolean: ColumnDef.dt.boolean(),
    date: ColumnDef.dt.date(),
    json: ColumnDef.dt.json(),
    number: ColumnDef.dt.number(),
  },
});
