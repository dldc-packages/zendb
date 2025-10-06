import { Database } from "@db/sqlite";
import { expect } from "@std/expect";
import { Utils } from "../mod.ts";
import { TestDriver } from "./utils/TestDriver.ts";

const db = new Database(":memory:");

Deno.test("read pragma", () => {
  const res = TestDriver.exec(db, Utils.userVersion());
  expect(res).toEqual(0);
});

Deno.test("write pragma", () => {
  const res = TestDriver.exec(db, Utils.setUserVersion(42));
  expect(res).toEqual(null);
  const version = TestDriver.exec(db, Utils.userVersion());
  expect(version).toEqual(42);
});
