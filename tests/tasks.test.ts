import { expect } from "@std/expect";
import { Database, Expr, Random } from "../mod.ts";
import { TestDatabase } from "./utils/TestDatabase.ts";
import { format, sql } from "./utils/sql.ts";
import { tasksDb } from "./utils/tasksDb.ts";

let nextRandomId = 0;

function setup() {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
  nextRandomId = 0;
}

const db = TestDatabase.create();

Deno.test("create database", () => {
  setup();

  const res = db.execMany(Database.schema(tasksDb));
  expect(res).toEqual([null, null, null]);
  const tables = db.exec(Database.tables());
  expect(tables).toEqual(["tasks", "users", "users_tasks"]);
});

Deno.test("insert tasks", () => {
  setup();

  const res = db.exec(
    tasksDb.tasks.insert({
      id: "1",
      title: "Task 1",
      completed: false,
      description: "First task",
    }),
  );
  expect(res).toEqual({
    id: "1",
    title: "Task 1",
    completed: false,
    description: "First task",
  });
});

Deno.test("find tasks", () => {
  setup();

  const res = db.exec(
    tasksDb.tasks
      .query()
      .select(({ id, title }) => ({ id, title }))
      .all(),
  );
  expect(res).toEqual([{ id: "1", title: "Task 1" }]);
});

Deno.test("create user", () => {
  setup();

  const res = db.exec(
    tasksDb.users.insert({
      id: "1",
      name: "John",
      email: "john@example.com",
      displayName: null,
      updatedAt: new Date("2023-12-25T22:30:12.250Z"),
    }),
  );
  expect(res).toEqual({
    id: "1",
    name: "John",
    email: "john@example.com",
    displayName: null,
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("link task and user", () => {
  setup();

  const res = db.exec(
    tasksDb.users_tasks.insert({ user_id: "1", task_id: "1" }),
  );
  expect(res).toEqual({ user_id: "1", task_id: "1" });
});

Deno.test("Query tasks as object", () => {
  setup();

  const res = db.exec(
    tasksDb.tasks
      .query()
      .select((c) => ({
        id: c.id,
        data: Expr.jsonObj(c),
      }))
      .all(),
  );
  res.forEach((r) => {
    expect(typeof r.data.completed).toBe("boolean");
  });
  expect(res).toEqual([{
    data: {
      completed: false,
      description: "First task",
      id: "1",
      title: "Task 1",
    },
    id: "1",
  }]);
});

Deno.test("Query users as object", () => {
  setup();

  const res = db.exec(
    tasksDb.users
      .query()
      .select((c) => ({
        id: c.id,
        data: Expr.jsonObj(c),
      }))
      .all(),
  );
  expect(res).toEqual([
    {
      data: {
        displayName: null,
        email: "john@example.com",
        id: "1",
        name: "John",
        updatedAt: new Date("2023-12-25T22:30:12.250Z"),
      },
      id: "1",
    },
  ]);
});

Deno.test("Concatenate nullable should return nullable", () => {
  setup();

  const res = db.exec(
    tasksDb.users
      .query()
      .select((c) => ({
        id: c.id,
        name: Expr.concatenate(c.name, c.displayName),
      }))
      .first(),
  );
  expect(res).toEqual({ id: "1", name: null });
});

Deno.test("Find user by email", () => {
  setup();

  const res = db.exec(
    tasksDb.users
      .query()
      .where((c) => Expr.equal(c.email, Expr.external("john@example.com")))
      .first(),
  );

  expect(res).toEqual({
    id: "1",
    displayName: null,
    name: "John",
    email: "john@example.com",
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("Find user by email using compare", () => {
  setup();

  const res = db.exec(
    tasksDb.users
      .query()
      .where((c) => Expr.compare(c.email, "=", "john@example.com"))
      .first(),
  );

  expect(res).toEqual({
    id: "1",
    displayName: null,
    name: "John",
    email: "john@example.com",
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("Find user by email using filterEqual", () => {
  setup();

  const res = db.exec(
    tasksDb.users.query().filterEqual({ email: "john@example.com" }).first(),
  );
  expect(res).toEqual({
    id: "1",
    displayName: null,
    name: "John",
    email: "john@example.com",
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("Find tasks with user", () => {
  setup();

  const tasksWithUser = tasksDb.users_tasks
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

  const res = db.exec(tasksWithUser.all());
  expect(res).toEqual([
    {
      task: {
        completed: false,
        description: "First task",
        id: "1",
        title: "Task 1",
      },
      user: {
        displayName: null,
        email: "john@example.com",
        id: "1",
        name: "John",
        updatedAt: new Date("2023-12-25T22:30:12.250Z"),
      },
    },
  ]);
});

Deno.test("Find task by user email", () => {
  setup();

  const tasksWithUser = tasksDb.users_tasks
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
        'updatedAt', users.updatedAt
      ) AS user,
      json_object(
        'id', tasks.id,
        'title', tasks.title,
        'description', tasks.description,
        'completed', tasks.completed
      ) AS task
    FROM
      users_tasks
      LEFT JOIN tasks ON users_tasks.task_id == tasks.id
      LEFT JOIN users ON users_tasks.user_id == users.id
    WHERE
      users.email == :_id3
  `);

  const res = db.exec(query);
  expect(res).toEqual({
    task: {
      completed: false,
      description: "First task",
      id: "1",
      title: "Task 1",
    },
    user: {
      displayName: null,
      email: "john@example.com",
      id: "1",
      name: "John",
      updatedAt: new Date("2023-12-25T22:30:12.250Z"),
    },
  });
});

Deno.test("Update task", () => {
  setup();

  const res = db.exec(
    tasksDb.tasks.update(
      { completed: true },
      (c) => Expr.equal(c.id, Expr.literal("1")),
    ),
  );
  expect(res).toEqual({ updated: 1 });
  const task = db.exec(tasksDb.tasks.query().first());
  expect(task).toEqual({
    completed: true,
    description: "First task",
    id: "1",
    title: "Task 1",
  });
});

// Deno.test('tasks grouped by userId', () => {
setup();

//   const op = tasksDb.users_tasks
//     .query()
//     .groupBy((c) => [c.user_id])
//     .join(
//       tasksDb.tasks.query(),
//       (l, r) => Expr.equal(l.task_id, r.id),
//       (l, r) => ({ user_id: l.user_id, tasks: Expr.AggregateFunctions.json_group_array(Expr.ScalarFunctions.json_object(r)) })
//     )
//     .all();

//   const res = db.exec(op);

//   expect(res).toEqual([{ user_id: '1', tasks: [{ completed: false, description: 'First task', id: '1', title: 'Task 1' }] }]);
// });

// Deno.test('find tasks for user email', () => {
setup();

//   const tasksByUserId = tasksDb.users_tasks
//     .query()
//     .groupBy((c) => [c.user_id])
//     .join(
//       tasksDb.tasks.query(),
//       (l, r) => Expr.equal(l.task_id, r.id),
//       (l, r) => ({ user_id: l.user_id, tasks: Expr.AggregateFunctions.json_group_array(Expr.ScalarFunctions.json_object(r)) })
//     );

//   const op = tasksDb.users
//     .query()
//     .where((c) => Expr.equal(c.email, Expr.literal('john@example.com')))
//     .join(
//       tasksByUserId,
//       (l, r) => Expr.equal(l.id, r.user_id),
//       (l, r) => ({ id: l.id, name: l.name, tasks: r.tasks })
//     )
//     .all();

//   const res = db.exec(op);
//   expect(res).toEqual([{ id: '1', name: 'John', tasks: [{ completed: false, description: 'First task', id: '1', title: 'Task 1' }] }]);
// });
