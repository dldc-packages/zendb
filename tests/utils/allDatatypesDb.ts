import { Column, Table } from "../../mod.ts";

export const allDatatypesDb = Table.declareMany({
  datatype: {
    id: Column.text().primary(),
    text: Column.text(),
    integer: Column.integer(),
    boolean: Column.boolean(),
    date: Column.date(),
    json: Column.json(),
    number: Column.number(),
  },
});
