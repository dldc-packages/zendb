import BetterSqlite3 from "better-sqlite3";
import { expect, test } from "vite-plus/test";
import { Utils } from "../mod.ts";
import { TestDriver } from "./utils/TestDriver.ts";

const db = new BetterSqlite3(":memory:");

test("read pragma", () => {
  const res = TestDriver.exec(db, Utils.userVersion());
  expect(res).toEqual(0);
});

test("write pragma", () => {
  const res = TestDriver.exec(db, Utils.setUserVersion(42));
  expect(res).toEqual(null);
  const version = TestDriver.exec(db, Utils.userVersion());
  expect(version).toEqual(42);
});
