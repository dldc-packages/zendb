import BetterSqlite3 from "better-sqlite3";
import * as zen from "../../mod.ts";

export const TestDriver = zen.Driver.createDriverFromPrepare({
  exec: (db, sql) => db.exec(sql),
  prepare: (db, sql) => {
    const stmt = db.prepare(sql);
    return {
      run: (params) => {
        const result = params ? stmt.run(params) : stmt.run();
        return result.changes;
      },
      all: (params) => (params ? stmt.all(params) : stmt.all()),
    };
  },
  createDatabase: () => new BetterSqlite3(":memory:"),
  closeDatabase: (db) => db.close(),
});
