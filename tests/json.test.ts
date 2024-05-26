import { expect } from "@std/expect";
import { Expr, queryFrom, Random } from "../mod.ts";
import { format, sql } from "./utils/sql.ts";
import { tasksDb } from "./utils/tasksDb.ts";

let nextRandomId = 0;

function setup() {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
  nextRandomId = 0;
}

Deno.test("Basic json function", () => {
  setup();

  const res = tasksDb.tasks
    .query()
    .select((c) => ({
      id: c.id,
      data: Expr.jsonObj(c),
    }))
    .all();

  expect(format(res.sql)).toEqual(sql`
    SELECT
      tasks.id AS id,
      json_object(
        'id', tasks.id,
        'title', tasks.title,
        'description', tasks.description,
        'completed', tasks.completed
      ) AS data
    FROM
      tasks
  `);
});

Deno.test("Nested json object", () => {
  setup();

  const res = tasksDb.tasks
    .query()
    .select(({ id, title, description }) => ({
      id,
      data: Expr.jsonObj({
        title,
        description,
        inner: Expr.jsonObj({ title, description }),
      }),
    }))
    .all();

  expect(format(res.sql)).toEqual(sql`
    SELECT
      tasks.id AS id,
      json_object (
        'title', tasks.title,
        'description', tasks.description,
        'inner', json_object (
          'title', tasks.title,
          'description', tasks.description
        )
      ) AS data
    FROM tasks
  `);
});

Deno.test("Json in json", () => {
  setup();

  const base = tasksDb.tasks.query().select((c) => ({
    id: c.id,
    data: Expr.jsonObj(c),
  }));

  const res = queryFrom(base)
    .select((c) => ({
      id: c.id,
      data: Expr.jsonObj({ data: c.data }),
    }))
    .all();

  expect(format(res.sql)).toEqual(sql`
    WITH
      cte_id0 AS (
        SELECT
          tasks.id AS id,
          json_object(
            'id', tasks.id,
            'title', tasks.title,
            'description', tasks.description,
            'completed', tasks.completed
          ) AS data
        FROM
          tasks
      )
    SELECT
      cte_id0.id AS id,
      json_object('data', json(cte_id0.data)) AS data
    FROM
      cte_id0
  `);
});
