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
      tasksDb.joinUsersTasks.query(),
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
      joinUsersTasks.task_id AS taskId
    FROM
      users
      INNER JOIN joinUsersTasks ON joinUsersTasks.user_id == users.id
  `);
});

Deno.test("Query joins", () => {
  setup();

  const result = tasksDb.users
    .query()
    .innerJoin(
      tasksDb.joinUsersTasks.query(),
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
      INNER JOIN joinUsersTasks ON joinUsersTasks.user_id == users.id
      INNER JOIN tasks ON tasks.id == joinUsersTasks.task_id
  `);
});

Deno.test("Join on aggregate should use CTE", () => {
  setup();

  const countUsersByGroup = tasksDb.users.query()
    .select(({ id, groupId }) => ({
      groupId,
      usersCount: Expr.Aggregate.count(id),
    }))
    .groupBy((c) => [c.groupId]);

  const groupsWithUsersCount = tasksDb.groups.query().innerJoin(
    countUsersByGroup,
    "users",
    (c) => Expr.equal(c.id, c.users.groupId),
  ).select(({ id, name, users }) => ({
    id,
    name,
    usersCount: users.usersCount,
  })).all();

  expect(format(groupsWithUsersCount.sql)).toEqual(sql`
    WITH
      cte_id1 AS (
        SELECT
          users.groupId AS groupId,
          count(users.id) AS usersCount
        FROM
          users
        GROUP BY
          users.groupId
      )
    SELECT
      groups.id AS id,
      groups.name AS name,
      cte_id1.usersCount AS usersCount
    FROM
      groups
      INNER JOIN cte_id1 ON groups.id == cte_id1.groupId
  `);
});
