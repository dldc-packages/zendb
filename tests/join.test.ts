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

Deno.test("Query innerJoin", () => {
  setup();

  const result = tasksDb.users
    .query()
    .innerJoin(
      tasksDb.users_tasks.query(),
      "usersTasks",
      (cols) => Expr.equal(cols.usersTasks.user_id, cols.id),
    )
    .select((cols) => ({
      id: cols.id,
      email: cols.email,
      taskId: cols.usersTasks.task_id,
    }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT
      users.id AS id,
      users.email AS email,
      users_tasks.task_id AS taskId
    FROM
      users
      INNER JOIN users_tasks ON users_tasks.user_id == users.id
  `);
});

Deno.test("Query joins", () => {
  setup();

  const result = tasksDb.users
    .query()
    .innerJoin(
      tasksDb.users_tasks.query(),
      "usersTasks",
      (cols) => Expr.equal(cols.usersTasks.user_id, cols.id),
    )
    .innerJoin(
      tasksDb.tasks.query(),
      "tasks",
      (cols) => Expr.equal(cols.tasks.id, cols.usersTasks.task_id),
    )
    .select((cols) => ({
      id: cols.id,
      email: cols.email,
      taskName: cols.tasks.title,
    }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT
      users.id AS id,
      users.email AS email,
      tasks.title AS taskName
    FROM
      users
      INNER JOIN users_tasks ON users_tasks.user_id == users.id
      INNER JOIN tasks ON tasks.id == users_tasks.task_id
  `);
});
