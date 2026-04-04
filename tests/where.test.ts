import { expect } from "@std/expect";
import { Expr, Random } from "../mod.ts";
import { allDatatypesDb } from "./utils/allDatatypesDb.ts";
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

Deno.test("Filter datatype primitive columns", () => {
  setup();

  const query = allDatatypesDb.tables.datatype.query().andFilterEqual({
    id: "1",
    text: "test",
    integer: 42,
    boolean: true,
    number: 3.14,
  }).one();

  expect(format(query.sql)).toEqual(sql`
    SELECT datatype.*
    FROM datatype
    WHERE
      (
       (
         (
           datatype.id == :_id0
           AND datatype.text == :_id1
         )
         AND datatype.integer == :_id2
       )
       AND datatype.boolean == :_id3
     )
     AND datatype.number == :_id4
  `);

  expect(query.params).toEqual({
    _id0: "1",
    _id1: "test",
    _id2: 42,
    _id3: 1,
    _id4: 3.14,
  });
});

Deno.test("Filter datatype date and json columns", () => {
  setup();

  const date = new Date(1663075512250);
  const data = { foo: "bar", baz: true };

  const query = allDatatypesDb.tables.datatype.query().andFilterEqual({
    date,
    json: data,
  }).one();

  expect(format(query.sql)).toEqual(sql`
    SELECT datatype.*
    FROM datatype
    WHERE
      datatype.date == :_id0 AND datatype.json == :_id1
  `);

  expect(query.params).toEqual({
    _id0: 1663075512250,
    _id1: '{"foo":"bar","baz":true}',
  });
});
