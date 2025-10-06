import { Database } from "@db/sqlite";
import { expect } from "@std/expect";
import { Expr, Random, Schema, Utils } from "../mod.ts";
import { TestDriver } from "./utils/TestDriver.ts";
import { format, sql } from "./utils/sql.ts";
import { tasksDb } from "./utils/tasksDb.ts";

let nextRandomId = 0;

function setup() {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
  nextRandomId = 0;
}

const db = new Database(":memory:");

Deno.test("create database", () => {
  setup();

  const res = TestDriver.execMany(db, Schema.createTables(tasksDb.tables));
  expect(res).toEqual([null, null, null, null]);
  const tables = TestDriver.exec(db, Utils.listTables());
  expect(tables).toEqual(["tasks", "users", "joinUsersTasks", "groups"]);
});

Deno.test("insert tasks", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.tasks.insert({
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

  const res = TestDriver.exec(
    db,
    tasksDb.tables.tasks
      .query()
      .select(({ id, title }) => ({ id, title }))
      .all(),
  );
  expect(res).toEqual([{ id: "1", title: "Task 1" }]);
});

Deno.test("create user", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.users.insert({
      id: "1",
      name: "John",
      email: "john@example.com",
      displayName: null,
      updatedAt: new Date("2023-12-25T22:30:12.250Z"),
      groupId: "1",
    }),
  );
  expect(res).toEqual({
    id: "1",
    name: "John",
    email: "john@example.com",
    displayName: null,
    groupId: "1",
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("link task and user", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.joinUsersTasks.insert({ user_id: "1", task_id: "1" }),
  );
  expect(res).toEqual({ user_id: "1", task_id: "1" });
});

Deno.test("Query tasks as object", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.tasks
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

  const res = TestDriver.exec(
    db,
    tasksDb.tables.users
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
        groupId: "1",
        updatedAt: new Date("2023-12-25T22:30:12.250Z"),
      },
      id: "1",
    },
  ]);
});

Deno.test("Concatenate nullable should return nullable", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.users
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

  const res = TestDriver.exec(
    db,
    tasksDb.tables.users
      .query()
      .where((c) => Expr.equal(c.email, Expr.external("john@example.com")))
      .first(),
  );

  expect(res).toEqual({
    id: "1",
    displayName: null,
    name: "John",
    email: "john@example.com",
    groupId: "1",
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("Find user by email using compare", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.users
      .query()
      .where((c) => Expr.compare(c.email, "=", "john@example.com"))
      .first(),
  );

  expect(res).toEqual({
    id: "1",
    displayName: null,
    name: "John",
    email: "john@example.com",
    groupId: "1",
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("Find user by email using filterEqual", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.users.query().andFilterEqual({ email: "john@example.com" })
      .first(),
  );
  expect(res).toEqual({
    id: "1",
    displayName: null,
    name: "John",
    email: "john@example.com",
    groupId: "1",
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  });
});

Deno.test("Find tasks with user", () => {
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

  const res = TestDriver.exec(db, tasksWithUser.all());
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
        groupId: "1",
        updatedAt: new Date("2023-12-25T22:30:12.250Z"),
      },
    },
  ]);
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
        'id',
        t_id2.id,
        'name',
        t_id2.name,
        'email',
        t_id2.email,
        'displayName',
        t_id2.displayName,
        'groupId',
        t_id2.groupId,
        'updatedAt',
        t_id2.updatedAt
      ) AS user,
      json_object(
        'id',
        t_id0.id,
        'title',
        t_id0.title,
        'description',
        t_id0.description,
        'completed',
        t_id0.completed
      ) AS task
    FROM joinUsersTasks
      LEFT JOIN tasks AS t_id0 ON joinUsersTasks.task_id == t_id0.id
      LEFT JOIN users AS t_id2 ON joinUsersTasks.user_id == t_id2.id
    WHERE t_id2.email == :_id5
  `);

  const res = TestDriver.exec(db, query);
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
      groupId: "1",
      updatedAt: new Date("2023-12-25T22:30:12.250Z"),
    },
  });
});

Deno.test("Update task", () => {
  setup();

  const res = TestDriver.exec(
    db,
    tasksDb.tables.tasks.update(
      { completed: true },
      (c) => Expr.equal(c.id, Expr.literal("1")),
    ),
  );
  expect(res).toEqual({ updated: 1 });
  const task = TestDriver.exec(
    db,
    tasksDb.tables.tasks.query().first(),
  );
  expect(task).toEqual({
    completed: true,
    description: "First task",
    id: "1",
    title: "Task 1",
  });
});

// Deno.test('tasks grouped by userId', () => {
setup();

//   const op = tasksDb.tables.joinUsersTasks
//     .query()
//     .groupBy((c) => [c.user_id])
//     .join(
//       tasksDb.tables.tasks.query(),
//       (l, r) => Expr.equal(l.task_id, r.id),
//       (l, r) => ({ user_id: l.user_id, tasks: Expr.AggregateFunctions.json_group_array(Expr.ScalarFunctions.json_object(r)) })
//     )
//     .all();

//   const res = db.exec(op);

//   expect(res).toEqual([{ user_id: '1', tasks: [{ completed: false, description: 'First task', id: '1', title: 'Task 1' }] }]);
// });

// Deno.test('find tasks for user email', () => {
setup();

//   const tasksByUserId = tasksDb.tables.joinUsersTasks
//     .query()
//     .groupBy((c) => [c.user_id])
//     .join(
//       tasksDb.tables.tasks.query(),
//       (l, r) => Expr.equal(l.task_id, r.id),
//       (l, r) => ({ user_id: l.user_id, tasks: Expr.AggregateFunctions.json_group_array(Expr.ScalarFunctions.json_object(r)) })
//     );

//   const op = tasksDb.tables.users
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
