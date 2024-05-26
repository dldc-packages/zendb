import { expect } from "@std/expect";
import { Database } from "../mod.ts";
import { TestDatabase } from "./utils/TestDatabase.ts";

const db = TestDatabase.create();

Deno.test("read pragma", () => {
  const res = db.exec(Database.userVersion());
  expect(res).toEqual(0);
});

Deno.test("write pragma", () => {
  const res = db.exec(Database.setUserVersion(42));
  expect(res).toEqual(null);
  const version = db.exec(Database.userVersion());
  expect(version).toEqual(42);
});
