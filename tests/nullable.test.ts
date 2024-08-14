import { expect } from "@std/expect";
import { Column, Database, Datatype, Random, Table } from "../mod.ts";
import { TestDatabase } from "./utils/TestDatabase.ts";

let nextRandomId = 0;

function setup() {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
  nextRandomId = 0;
}

const db = TestDatabase.create();

Deno.test("create database", () => {
  setup();

  const customDt = Datatype.create<string[], string>({
    name: "custom",
    type: "TEXT",
    parse: (value) => value.split(","),
    serialize: (value) => value.join(","),
    isJson: false,
  });

  const schema = Table.declareMany({
    demo: {
      id: Column.text().primary(),
      date: Column.date().nullable(),
      text: Column.text().nullable(),
      number: Column.number().nullable(),
      json: Column.json<{ num: number }>().nullable(),
      boolean: Column.boolean().nullable(),
      integer: Column.integer().nullable(),
      custom: Column.declare(customDt).nullable(),
    },
  });

  const res = db.execMany(Database.schema(schema));
  expect(res).toEqual([null]);
  const tables = db.exec(Database.tables());
  expect(tables).toEqual(["demo"]);

  const insertedNull = db.exec(
    schema.demo.insert({
      id: "1",
      boolean: null,
      custom: null,
      date: null,
      integer: null,
      json: null,
      number: null,
      text: null,
    }),
  );
  expect(insertedNull).toEqual(
    {
      id: "1",
      boolean: null,
      custom: null,
      date: null,
      integer: null,
      json: null,
      number: null,
      text: null,
    },
  );

  const date = new Date();
  const insertedNotNull = db.exec(
    schema.demo.insert({
      id: "2",
      boolean: true,
      custom: ["a", "b"],
      date,
      integer: 1,
      json: { num: 1 },
      number: 1,
      text: "text",
    }),
  );
  expect(insertedNotNull).toEqual(
    {
      boolean: true,
      custom: [
        "a",
        "b",
      ],
      date,
      id: "2",
      integer: 1,
      json: {
        num: 1,
      },
      number: 1,
      text: "text",
    },
  );

  const rawData = db.sqlDb.prepare("SELECT * FROM demo").values();
  expect(rawData).toEqual(
    [
      [
        "1",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
      ],
      [
        "2",
        date.getTime(),
        "text",
        1,
        '{"num":1}',
        1,
        1,
        "a,b",
      ],
    ],
  );

  const all = db.exec(schema.demo.query().all());
  expect(all).toEqual(
    [
      {
        id: "1",
        boolean: null,
        custom: null,
        date: null,
        integer: null,
        json: null,
        number: null,
        text: null,
      },
      {
        boolean: true,
        custom: [
          "a",
          "b",
        ],
        date: date,
        id: "2",
        integer: 1,
        json: {
          num: 1,
        },
        number: 1,
        text: "text",
      },
    ],
  );
});
