import { expect } from "@std/expect";
import { Database, Expr, Random, type Table } from "../mod.ts";
import { TestDatabase, type TTestDatabase } from "./utils/TestDatabase.ts";
import { format, sql } from "./utils/sql.ts";
import { tasksDb } from "./utils/tasksDb.ts";

let nextRandomId = 0;

let db: TTestDatabase;

function setupDatabase() {
  db = TestDatabase.create();

  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);

  db.execMany(Database.schema(tasksDb));

  const users: UserInput[] = [
    {
      id: "1",
      name: "John Doe",
      email: "john@exmaple.com",
      displayName: null,
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
    {
      id: "2",
      name: "Jane Doe",
      email: "jane@example.com",
      displayName: "Jane",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
    {
      id: "3",
      name: "Jack Doe",
      email: "jack@example.com",
      displayName: "Jack",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
    {
      id: "4",
      name: "Jill Doe",
      email: "jill@example.com",
      displayName: "Jill",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
  ];

  db.exec(tasksDb.users.insertMany(users));

  const tasks: TaksInput[] = [
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

  tasks.forEach((task) => db.exec(tasksDb.tasks.insert(task)));

  db.exec(tasksDb.users_tasks.insert({ user_id: "1", task_id: "1" }));
  db.exec(tasksDb.users_tasks.insert({ user_id: "1", task_id: "2" }));
  db.exec(tasksDb.users_tasks.insert({ user_id: "2", task_id: "3" }));
  db.exec(tasksDb.users_tasks.insert({ user_id: "3", task_id: "1" }));

  nextRandomId = 0;
}

type UserInput = (typeof tasksDb)["users"] extends Table.TTable<infer Val, any>
  ? Val
  : never;

type TaksInput = (typeof tasksDb)["tasks"] extends Table.TTable<infer Val, any>
  ? Val
  : never;

Deno.test("Find all user with their linked tasks", () => {
  setupDatabase();
  const allUsers = tasksDb.users.query();
  const tasksByUserId = tasksDb.users_tasks
    .query()
    .innerJoin(
      tasksDb.tasks.query(),
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
      users_tasks.user_id AS userId,
      json_group_array(
        json_object(
          'id',
          tasks.id,
          'title',
          tasks.title,
          'description',
          tasks.description,
          'completed',
          tasks.completed
        )
      ) AS tasks
    FROM
      users_tasks
      INNER JOIN tasks ON users_tasks.task_id == tasks.id
    GROUP BY
      users_tasks.user_id
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
      cte_id2 AS (
        SELECT
          users_tasks.user_id AS userId,
          json_group_array(
            json_object(
              'id',
              tasks.id,
              'title',
              tasks.title,
              'description',
              tasks.description,
              'completed',
              tasks.completed
            )
          ) AS tasks
        FROM
          users_tasks
          INNER JOIN tasks ON users_tasks.task_id == tasks.id
        GROUP BY
          users_tasks.user_id
      )
    SELECT
      users.id AS id,
      users.name AS name,
      users.email AS email,
      users.displayName AS displayName,
      users.updatedAt AS updatedAt,
      cte_id2.tasks AS tasks
    FROM
      users
      LEFT JOIN cte_id2 ON users.id == cte_id2.userId
  `);

  const result = db.exec(query);

  expect(result).toEqual([
    {
      displayName: null,
      email: "john@exmaple.com",
      id: "1",
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
      name: "Jill Doe",
      tasks: null,
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
  ]);
});

Deno.test("Find all users with only task 1 & 2 using subquery in expression", () => {
  setupDatabase();

  const subQuery = tasksDb.users_tasks
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
      users_tasks.user_id AS id
    FROM
      users_tasks
    WHERE
      users_tasks.task_id IN ('1', '2')
    GROUP BY
      users_tasks.user_id
    HAVING
      count(users_tasks.task_id) == 2
  `);

  const subQueryRes = db.exec(subQueryOp);
  expect(subQueryRes).toEqual([{ id: "1" }]);

  const filteredUsers = tasksDb.users
    .query()
    .where((c) => Expr.inSubquery(c.id, subQuery))
    .all();

  expect(format(filteredUsers.sql)).toEqual(sql`
    WITH
      cte_id3 AS (
        SELECT
          users_tasks.user_id AS id
        FROM
          users_tasks
        WHERE
          users_tasks.task_id IN ('1', '2')
        GROUP BY
          users_tasks.user_id
        HAVING
          count(users_tasks.task_id) == 2
      )
    SELECT
      *
    FROM
      users
    WHERE
      users.id IN cte_id3
  `);

  const result = db.exec(filteredUsers);
  expect(result).toEqual([
    {
      displayName: null,
      email: "john@exmaple.com",
      id: "1",
      name: "John Doe",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
  ]);
});

Deno.test("Find all users with no tasks", () => {
  setupDatabase();

  const usersWithTasks = tasksDb.users_tasks
    .query()
    .groupBy((c) => [c.user_id])
    .select((c) => ({ id: c.user_id }));

  const usersWithNoTasks = tasksDb.users
    .query()
    .where((c) => Expr.notInSubquery(c.id, usersWithTasks))
    .all();

  expect(format(usersWithNoTasks.sql)).toEqual(sql`
    WITH
      cte_id1 AS (
        SELECT
          users_tasks.user_id AS id
        FROM
          users_tasks
        GROUP BY
          users_tasks.user_id
      )
    SELECT
      *
    FROM
      users
    WHERE
      users.id NOT IN cte_id1
  `);

  const result = db.exec(usersWithNoTasks);

  expect(result).toEqual([
    {
      displayName: "Jill",
      email: "jill@example.com",
      id: "4",
      name: "Jill Doe",
      updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    },
  ]);
});
