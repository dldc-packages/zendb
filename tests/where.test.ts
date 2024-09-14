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

  const query = tasksDb.tasks.query().filterEqual({ id: "1" }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT tasks.*
    FROM tasks
    WHERE
      tasks.id == :_id0
  `);
});

Deno.test("Filter twice", () => {
  setup();

  const query = tasksDb.tasks.query().filterEqual({ id: "1" }).filterEqual({
    id: "2",
  }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT tasks.*
    FROM tasks
    WHERE
      tasks.id == :_id0 AND tasks.id == :_id2
  `);
});

Deno.test("Find task by user email", () => {
  setup();

  const tasksWithUser = tasksDb.joinUsersTasks
    .query()
    .leftJoin(
      tasksDb.tasks.query(),
      "task",
      (cols) => Expr.equal(cols.task_id, cols.task.id),
    )
    .leftJoin(
      tasksDb.users.query(),
      "user",
      (cols) => Expr.equal(cols.user_id, cols.user.id),
    )
    .select((cols) => ({
      user: Expr.jsonObj(cols.user),
      task: Expr.jsonObj(cols.task),
    }));

  const query = tasksWithUser.filterEqual({ "user.email": "john@example.com" })
    .first();

  expect(format(query.sql)).toEqual(sql`
    SELECT
      json_object(
        'id', users.id,
        'name', users.name,
        'email', users.email,
        'displayName', users.displayName,
        'groupId', users.groupId,
        'updatedAt', users.updatedAt
      ) AS user,
      json_object(
        'id', tasks.id,
        'title', tasks.title,
        'description', tasks.description,
        'completed', tasks.completed
      ) AS task
    FROM
      joinUsersTasks
      LEFT JOIN tasks ON joinUsersTasks.task_id == tasks.id
      LEFT JOIN users ON joinUsersTasks.user_id == users.id
    WHERE
      users.email == :_id3
  `);

  expect(query.params).toEqual({ _id3: "john@example.com" });
});

Deno.test("Filter null value", () => {
  setup();

  const query = tasksDb.users.query().filterEqual({ displayName: null })
    .first();

  expect(format(query.sql)).toEqual(sql`
    SELECT users.*
    FROM users
    WHERE users.displayName IS NULL
  `);
});

Deno.test("Filter multiple values", () => {
  setup();

  const query = tasksDb.users.query().filterEqual({
    displayName: null,
    email: "john@example.com",
  }).first();

  expect(format(query.sql)).toEqual(sql`
    SELECT users.*
    FROM users
    WHERE users.displayName IS NULL AND users.email == :_id0
  `);

  expect(query.params).toEqual({ _id0: "john@example.com" });
});
