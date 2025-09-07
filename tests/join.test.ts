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

  const result = tasksDb.tables.users
    .query()
    .innerJoin(
      tasksDb.tables.joinUsersTasks.query(),
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
      t_id0.task_id AS taskId
    FROM users
      INNER JOIN joinUsersTasks AS t_id0 ON t_id0.user_id == users.id
  `);
});

Deno.test("Query joins", () => {
  setup();

  const result = tasksDb.tables.users
    .query()
    .innerJoin(
      tasksDb.tables.joinUsersTasks.query(),
      "usersTasks",
      (cols) => Expr.equal(cols.usersTasks.user_id, cols.id),
    )
    .innerJoin(
      tasksDb.tables.tasks.query(),
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
      t_id2.title AS taskName
    FROM users
      INNER JOIN joinUsersTasks AS t_id0 ON t_id0.user_id == users.id
      INNER JOIN tasks AS t_id2 ON t_id2.id == t_id0.task_id
  `);
});

Deno.test("Join on aggregate should use CTE", () => {
  setup();

  const countUsersByGroup = tasksDb.tables.users.query()
    .select(({ id, groupId }) => ({
      groupId,
      usersCount: Expr.Aggregate.count(id),
    }))
    .groupBy((c) => [c.groupId]);

  const groupsWithUsersCount = tasksDb.tables.groups.query().innerJoin(
    countUsersByGroup,
    "users",
    (c) => Expr.equal(c.id, c.users.groupId),
  ).select(({ id, name, users }) => ({
    id,
    name,
    usersCount: users.usersCount,
  })).all();

  expect(format(groupsWithUsersCount.sql)).toEqual(sql`
    WITH cte_id1 AS (
      SELECT
        users.groupId AS groupId,
        count(users.id) AS usersCount
      FROM users
      GROUP BY users.groupId
    )
    SELECT
      groups.id AS id,
      groups.name AS name,
      t_id2.usersCount AS usersCount
    FROM groups
      INNER JOIN cte_id1 AS t_id2 ON groups.id == t_id2.groupId
  `);
});

Deno.test("Join on table with select should use CTE", () => {
  setup();

  const usersWithSelect = tasksDb.tables.users.query()
    .select(({ id, email }) => ({ id, userEmail: email }));

  const groupsWithUsersCount = tasksDb.tables.groups.query().innerJoin(
    usersWithSelect,
    "users",
    (c) => Expr.equal(c.id, c.users.userEmail),
  ).select(({ id, name, users }) => ({
    id,
    name,
    userEmail: users.userEmail,
  })).all();

  expect(format(groupsWithUsersCount.sql)).toEqual(sql`
    WITH cte_id0 AS (
      SELECT
        users.id AS id,
        users.email AS userEmail
      FROM users
    )
    SELECT
      groups.id AS id,
      groups.name AS name,
      t_id1.userEmail AS userEmail
    FROM groups
      INNER JOIN cte_id0 AS t_id1 ON groups.id == t_id1.userEmail
  `);
});

Deno.test("Joining the same table twice should work", () => {
  setup();

  const result = tasksDb.tables.users.query()
    .innerJoin(
      tasksDb.tables.joinUsersTasks.query(),
      "usersTasks",
      (cols) => Expr.equal(cols.usersTasks.user_id, cols.id),
    )
    .innerJoin(
      tasksDb.tables.joinUsersTasks.query(),
      "usersTasks2",
      (cols) => Expr.equal(cols.usersTasks2.user_id, cols.id),
    )
    .select((cols) => ({
      id: cols.id,
      email: cols.email,
      taskId: cols.usersTasks.task_id,
      taskId2: cols.usersTasks2.task_id,
    }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT users.id AS id,
      users.email AS email,
      t_id0.task_id AS taskId,
      t_id2.task_id AS taskId2
    FROM users
      INNER JOIN joinUsersTasks AS t_id0 ON t_id0.user_id == users.id
      INNER JOIN joinUsersTasks AS t_id2 ON t_id2.user_id == users.id
  `);
});
