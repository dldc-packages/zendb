import { expect } from "@std/expect";
import { Database, Expr, Random } from "../mod.ts";
import type { TTableTypes } from "../src/Table.ts";
import { TestDatabase, type TTestDatabase } from "./utils/TestDatabase.ts";
import { format, sql } from "./utils/sql.ts";
import { tasksDb } from "./utils/tasksDb.ts";

let nextRandomId = 0;

let db: TTestDatabase;

function setupDatabase() {
  db = TestDatabase.create();

  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);

  db.execMany(Database.schema(tasksDb.tables));

  const users: UserInput[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john@exmaple.com",
      displayName: null,
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
      groupId: "1",
    },
    {
      id: "2",
      name: "Jane Doe",
      email: "jane@example.com",
      displayName: "Jane",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
      groupId: "1",
    },
    {
      id: "3",
      name: "Jack Doe",
      email: "jack@example.com",
      displayName: "Jack",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
      groupId: "1",
    },
    {
      id: "4",
      name: "Jill Doe",
      email: "jill@example.com",
      displayName: "Jill",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
      groupId: "1",
    },
  ];

  db.exec(tasksDb.tables.users.insertMany(users));

  const tasks: TasksInput[] = [
    {
      id: "1",
      title: "First Task",
      description: "First Task",
      completed: false,
    },
    {
      id: "2",
      title: "Second Task",
      description: "Second Task",
      completed: true,
    },
    {
      id: "3",
      title: "Third Task",
      description: "Third Task",
      completed: true,
    },
    {
      id: "4",
      title: "Fourth Task",
      description: "Fourth Task",
      completed: false,
    },
    {
      id: "5",
      title: "Fifth Task",
      description: "Fifth Task",
      completed: false,
    },
  ];

  tasks.forEach((task) => db.exec(tasksDb.tables.tasks.insert(task)));

  db.exec(tasksDb.tables.joinUsersTasks.insert({ user_id: "1", task_id: "1" }));
  db.exec(tasksDb.tables.joinUsersTasks.insert({ user_id: "1", task_id: "2" }));
  db.exec(tasksDb.tables.joinUsersTasks.insert({ user_id: "2", task_id: "3" }));
  db.exec(tasksDb.tables.joinUsersTasks.insert({ user_id: "3", task_id: "1" }));

  nextRandomId = 0;
}

type UserInput = TTableTypes<(typeof tasksDb.tables)["users"]>["input"];

type TasksInput = TTableTypes<(typeof tasksDb.tables)["tasks"]>["input"];

Deno.test("Find all user with their linked tasks", () => {
  setupDatabase();
  const allUsers = tasksDb.tables.users.query();
  const tasksByUserId = tasksDb.tables.joinUsersTasks
    .query()
    .innerJoin(
      tasksDb.tables.tasks.query(),
      "task",
      (c) => Expr.equal(c.task_id, c.task.id),
    )
    .groupBy((c) => [c.user_id])
    .select((c) => ({
      userId: c.user_id,
      tasks: Expr.jsonGroupArray(Expr.jsonObj(c.task)),
    }));

  const tasksByUserIdOp = tasksByUserId.all();

  expect(format(tasksByUserIdOp.sql)).toEqual(sql`
    SELECT
      joinUsersTasks.user_id AS userId,
      json_group_array(
        json_object(
          'id',
          t_id0.id,
          'title',
          t_id0.title,
          'description',
          t_id0.description,
          'completed',
          t_id0.completed
        )
      ) AS tasks
    FROM
      joinUsersTasks
      INNER JOIN tasks AS t_id0 ON joinUsersTasks.task_id == t_id0.id
    GROUP BY
      joinUsersTasks.user_id
  `);

  const tasksByUserIdResult = db.exec(tasksByUserIdOp);

  expect(tasksByUserIdResult).toEqual([
    {
      userId: "1",
      tasks: [
        {
          completed: false,
          description: "First Task",
          id: "1",
          title: "First Task",
        },
        {
          completed: true,
          description: "Second Task",
          id: "2",
          title: "Second Task",
        },
      ],
    },
    {
      userId: "2",
      tasks: [{
        completed: true,
        description: "Third Task",
        id: "3",
        title: "Third Task",
      }],
    },
    {
      userId: "3",
      tasks: [{
        completed: false,
        description: "First Task",
        id: "1",
        title: "First Task",
      }],
    },
  ]);

  const query = allUsers
    .leftJoin(tasksByUserId, "tasks", (c) => Expr.equal(c.id, c.tasks.userId))
    .select(({ tasks, ...rest }) => ({ ...rest, tasks: tasks.tasks }))
    .all();

  expect(format(query.sql)).toEqual(sql`
    WITH
      cte_id3 AS (
        SELECT
          joinUsersTasks.user_id AS userId,
          json_group_array(
            json_object(
              'id', t_id0.id,
              'title', t_id0.title,
              'description', t_id0.description,
              'completed', t_id0.completed
            )
          ) AS tasks
        FROM
          joinUsersTasks
          INNER JOIN tasks AS t_id0 ON joinUsersTasks.task_id == t_id0.id
        GROUP BY
          joinUsersTasks.user_id
      )
    SELECT
      users.id AS id,
      users.name AS name,
      users.email AS email,
      users.displayName AS displayName,
      users.groupId AS groupId,
      users.updatedAt AS updatedAt,
      t_id4.tasks AS tasks
    FROM
      users
      LEFT JOIN cte_id3 AS t_id4 ON users.id == t_id4.userId
  `);

  const result = db.exec(query);

  expect(result).toEqual([
    {
      displayName: null,
      email: "john@exmaple.com",
      id: "1",
      groupId: "1",
      name: "John Doe",
      tasks: [
        {
          completed: false,
          description: "First Task",
          id: "1",
          title: "First Task",
        },
        {
          completed: true,
          description: "Second Task",
          id: "2",
          title: "Second Task",
        },
      ],
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
    {
      displayName: "Jane",
      email: "jane@example.com",
      id: "2",
      groupId: "1",
      name: "Jane Doe",
      tasks: [{
        completed: true,
        description: "Third Task",
        id: "3",
        title: "Third Task",
      }],
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
    {
      displayName: "Jack",
      email: "jack@example.com",
      id: "3",
      groupId: "1",
      name: "Jack Doe",
      tasks: [{
        completed: false,
        description: "First Task",
        id: "1",
        title: "First Task",
      }],
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
    {
      displayName: "Jill",
      email: "jill@example.com",
      id: "4",
      groupId: "1",
      name: "Jill Doe",
      tasks: null,
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
  ]);
});

Deno.test("Find all users with only task 1 & 2 using subquery in expression", () => {
  setupDatabase();

  const subQuery = tasksDb.tables.joinUsersTasks
    .query()
    .where((c) =>
      Expr.inList(c.task_id, [Expr.literal("1"), Expr.literal("2")])
    )
    .groupBy((c) => [c.user_id])
    .select((c) => ({ id: c.user_id }))
    .having((c) =>
      Expr.equal(Expr.Aggregate.count(c.task_id), Expr.literal(2))
    );

  const subQueryOp = subQuery.all();

  expect(format(subQueryOp.sql)).toEqual(sql`
    SELECT
      joinUsersTasks.user_id AS id
    FROM
      joinUsersTasks
    WHERE
      joinUsersTasks.task_id IN ('1', '2')
    GROUP BY
      joinUsersTasks.user_id
    HAVING
      count(joinUsersTasks.task_id) == 2
  `);

  const subQueryRes = db.exec(subQueryOp);
  expect(subQueryRes).toEqual([{ id: "1" }]);

  const filteredUsers = tasksDb.tables.users
    .query()
    .where((c) => Expr.inSubquery(c.id, subQuery))
    .all();

  expect(format(filteredUsers.sql)).toEqual(sql`
    WITH
      cte_id3 AS (
        SELECT
          joinUsersTasks.user_id AS id
        FROM
          joinUsersTasks
        WHERE
          joinUsersTasks.task_id IN ('1', '2')
        GROUP BY
          joinUsersTasks.user_id
        HAVING
          count(joinUsersTasks.task_id) == 2
      )
    SELECT
      users.*
    FROM
      users
    WHERE
      users.id IN cte_id3
  `);

  const result = db.exec(filteredUsers);
  expect(result).toEqual([
    {
      id: "1",
      displayName: null,
      email: "john@exmaple.com",
      name: "John Doe",
      groupId: "1",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
  ]);
});

Deno.test("Find all users with no tasks", () => {
  setupDatabase();

  const usersWithTasks = tasksDb.tables.joinUsersTasks
    .query()
    .groupBy((c) => [c.user_id])
    .select((c) => ({ id: c.user_id }));

  const usersWithNoTasks = tasksDb.tables.users
    .query()
    .where((c) => Expr.notInSubquery(c.id, usersWithTasks))
    .all();

  expect(format(usersWithNoTasks.sql)).toEqual(sql`
    WITH
      cte_id1 AS (
        SELECT
          joinUsersTasks.user_id AS id
        FROM
          joinUsersTasks
        GROUP BY
          joinUsersTasks.user_id
      )
    SELECT
      users.*
    FROM
      users
    WHERE
      users.id NOT IN cte_id1
  `);

  const result = db.exec(usersWithNoTasks);

  expect(result).toEqual([
    {
      id: "4",
      displayName: "Jill",
      email: "jill@example.com",
      name: "Jill Doe",
      groupId: "1",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
  ]);
});
