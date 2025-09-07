import { expect } from "@std/expect";
import { Expr, Random } from "../mod.ts";
import { format, sql } from "./utils/sql.ts";
import { tasksDb } from "./utils/tasksDb.ts";

let nextRandomId = 0;

function setup() {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
  nextRandomId = 0;
}

Deno.test("Simple filter", () => {
  setup();

  const query = tasksDb.tables.tasks.query().andFilterEqual({ id: "1" }).one();

  expect(format(query.sql)).toEqual(sql`
    SELECT tasks.*
    FROM tasks
    WHERE
      tasks.id == :_id0
  `);
});

Deno.test("Filter twice", () => {
  setup();

  const query = tasksDb.tables.tasks.query().andFilterEqual({ id: "1" })
    .andFilterEqual({
      id: "2",
    }).one();

  expect(format(query.sql)).toEqual(sql`
    SELECT tasks.*
    FROM tasks
    WHERE
      tasks.id == :_id0 AND tasks.id == :_id2
  `);
});

Deno.test("Find task by user email", () => {
  setup();

  const tasksWithUser = tasksDb.tables.joinUsersTasks
    .query()
    .leftJoin(
      tasksDb.tables.tasks.query(),
      "task",
      (cols) => Expr.equal(cols.task_id, cols.task.id),
    )
    .leftJoin(
      tasksDb.tables.users.query(),
      "user",
      (cols) => Expr.equal(cols.user_id, cols.user.id),
    )
    .select((cols) => ({
      user: Expr.jsonObj(cols.user),
      task: Expr.jsonObj(cols.task),
    }));

  const query = tasksWithUser.andFilterEqual({
    "user.email": "john@example.com",
  })
    .one();

  expect(format(query.sql)).toEqual(sql`
    SELECT json_object(
        'id', t_id2.id,
        'name', t_id2.name,
        'email', t_id2.email,
        'displayName', t_id2.displayName,
        'groupId', t_id2.groupId,
        'updatedAt', t_id2.updatedAt
      ) AS user,
      json_object(
        'id', t_id0.id,
        'title', t_id0.title,
        'description', t_id0.description,
        'completed', t_id0.completed
      ) AS task
    FROM joinUsersTasks
      LEFT JOIN tasks AS t_id0 ON joinUsersTasks.task_id == t_id0.id
      LEFT JOIN users AS t_id2 ON joinUsersTasks.user_id == t_id2.id
    WHERE t_id2.email == :_id5
  `);

  expect(query.params).toEqual({ _id5: "john@example.com" });
});

Deno.test("Filter null value", () => {
  setup();

  const query = tasksDb.tables.users.query().andFilterEqual({
    displayName: null,
  })
    .one();

  expect(format(query.sql)).toEqual(sql`
    SELECT users.*
    FROM users
    WHERE users.displayName IS NULL
  `);
});

Deno.test("Filter multiple values", () => {
  setup();

  const query = tasksDb.tables.users.query().andFilterEqual({
    displayName: null,
    email: "john@example.com",
  }).one();

  expect(format(query.sql)).toEqual(sql`
    SELECT users.*
    FROM users
    WHERE users.displayName IS NULL AND users.email == :_id0
  `);

  expect(query.params).toEqual({ _id0: "john@example.com" });
});
