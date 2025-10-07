import { Database } from "@db/sqlite";
import * as zen from "../../mod.ts";

export const TestDriver = zen.Driver.createDriverFromPrepare({
  exec: (db, sql) => db.exec(sql),
  prepare: (db, sql) => db.prepare(sql),
  createDatabase: () => new Database(":memory:"),
  closeDatabase: (db) => db.close(),
});
