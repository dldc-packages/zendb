import { expect } from "@std/expect";
import { Expr, queryFrom, Random } from "../mod.ts";
import { allDatatypesDb } from "./utils/allDatatypesDb.ts";
import { format, sql } from "./utils/sql.ts";
import { tasksDb } from "./utils/tasksDb.ts";

let nextRandomId = 0;

function setup() {
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);
  nextRandomId = 0;
}

Deno.test("Insert", () => {
  setup();

  const result = tasksDb.users.insert({
    id: "1",
    name: "John Doe",
    email: "john@exemple.com",
    displayName: null,
    updatedAt: new Date("2023-12-24T22:30:12.250Z"),
    groupId: "1",
  });
  expect(result).toMatchObject({
    kind: "Insert",
    params: {
      email_id2: "john@exemple.com",
      id_id0: "1",
      name_id1: "John Doe",
      displayName_id3: null,
    },
  });
  expect(result.parse()).toEqual({
    email: "john@exemple.com",
    id: "1",
    name: "John Doe",
    displayName: null,
    groupId: "1",
    updatedAt: new Date("2023-12-24T22:30:12.250Z"),
  });
  expect(format(result.sql)).toEqual(sql`
    INSERT INTO users (id, name, email, displayName, groupId, updatedAt)
    VALUES (:id_id0, :name_id1, :email_id2, :displayName_id3, :groupId_id4, :updatedAt_id5)
  `);
});

Deno.test("Delete", () => {
  setup();

  const result = tasksDb.users.delete((cols) =>
    Expr.equal(cols.id, Expr.literal("1"))
  );
  expect(result).toMatchObject({ kind: "Delete", params: null });
  expect(format(result.sql)).toEqual(
    sql`DELETE FROM users WHERE users.id == '1'`,
  );
});

Deno.test("Delete with external value", () => {
  setup();

  const result = tasksDb.users.delete((cols) =>
    Expr.equal(cols.id, Expr.external("1", "delete_id"))
  );
  expect(result).toMatchObject({
    kind: "Delete",
    params: { delete_id_id0: "1" },
  });
  expect(format(result.sql)).toEqual(
    sql`DELETE FROM users WHERE users.id == :delete_id_id0`,
  );
});

Deno.test("Update", () => {
  setup();

  const result = tasksDb.users.update(
    { name: "Paul" },
    (cols) => Expr.equal(cols.id, Expr.literal("1234")),
  );
  expect(result).toMatchObject({
    kind: "Update",
    params: { name_id0: "Paul" },
  });
  expect(format(result.sql)).toEqual(
    sql`UPDATE users SET name = :name_id0 WHERE users.id == '1234'`,
  );
});

Deno.test("Update with external", () => {
  setup();

  const result = tasksDb.users.update(
    { name: "Paul" },
    (cols) => Expr.equal(cols.id, Expr.external("1234", "filter_id")),
  );
  expect(result).toMatchObject({
    kind: "Update",
    params: { filter_id_id1: "1234", name_id0: "Paul" },
  });
  expect(format(result.sql)).toEqual(
    sql`UPDATE users SET name = :name_id0 WHERE users.id == :filter_id_id1`,
  );
});

Deno.test("Update date", () => {
  setup();

  const result = tasksDb.users.update({
    updatedAt: new Date("2023-12-25T22:30:12.250Z"),
  }, (cols) => Expr.equal(cols.id, Expr.literal("1234")));
  expect(result).toMatchObject({
    kind: "Update",
    params: { updatedAt_id0: 1703543412250 },
  });
  expect(format(result.sql)).toEqual(
    sql`UPDATE users SET updatedAt = :updatedAt_id0 WHERE users.id == '1234'`,
  );
});

Deno.test("Query", () => {
  setup();

  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id, email: cols.email }))
    .all();
  expect(format(result.sql)).toEqual(
    sql`SELECT users.id AS id, users.email AS email FROM users`,
  );
  expect(result.params).toEqual(null);
});

Deno.test("Query select twice (override)", () => {
  setup();

  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id, email: cols.email }))
    .select((cols) => {
      return { idEmail: Expr.concatenate(cols.id, cols.email) };
    })
    .all();
  expect(format(result.sql)).toEqual(sql`
    SELECT users.id || users.email AS idEmail
    FROM users
  `);
  expect(result.params).toEqual(null);
});

Deno.test(`Query groupBy`, () => {
  setup();

  const result = tasksDb.users
    .query()
    .groupBy((cols) => [cols.email])
    .select((cols) => ({ count: Expr.Aggregate.count(cols.id) }))
    .all();
  expect(format(result.sql)).toEqual(
    sql`SELECT count(users.id) AS count FROM users GROUP BY users.email`,
  );
  expect(result.params).toEqual(null);
});

Deno.test(`Query groupBy reverse order (same result)`, () => {
  setup();

  const result = tasksDb.users
    .query()
    .select((cols) => ({ count: Expr.Aggregate.count(cols.id) }))
    .groupBy((cols) => [cols.email])
    .all();
  expect(format(result.sql)).toEqual(
    sql`SELECT count(users.id) AS count FROM users GROUP BY users.email`,
  );
  expect(result.params).toEqual(null);
});

Deno.test("read and write datatypes", () => {
  setup();

  const result = allDatatypesDb.datatype.insert({
    id: "1",
    text: "test",
    boolean: true,
    date: new Date(1663075512250),
    integer: 42,
    number: 3.14,
    json: { foo: "bar", baz: true },
  });
  expect(result).toMatchObject({
    sql:
      "INSERT INTO datatype (id, text, integer, boolean, date, json, number) VALUES (:id_id0, :text_id1, :integer_id2, :boolean_id3, :date_id4, :json_id5, :number_id6)",
    params: {
      boolean_id3: 1,
      date_id4: 1663075512250,
      id_id0: "1",
      integer_id2: 42,
      json_id5: '{"foo":"bar","baz":true}',
      number_id6: 3.14,
      text_id1: "test",
    },
  });
  expect(result.parse()).toEqual({
    boolean: true,
    date: new Date("2022-09-13T13:25:12.250Z"),
    id: "1",
    integer: 42,
    json: { baz: true, foo: "bar" },
    number: 3.14,
    text: "test",
  });
  const update = allDatatypesDb.datatype.update({
    id: "1",
    text: "test",
    boolean: true,
    date: new Date(1663075512250),
    integer: 42,
    number: 3.14,
    json: { foo: "bar", baz: true },
  });
  expect(update).toMatchObject({
    sql:
      "UPDATE datatype SET id = :id_id7, text = :text_id8, integer = :integer_id9, boolean = :boolean_id10, date = :date_id11, json = :json_id12, number = :number_id13",
    params: {
      boolean_id10: 1,
      date_id11: 1663075512250,
      id_id7: "1",
      integer_id9: 42,
      json_id12: '{"foo":"bar","baz":true}',
      number_id13: 3.14,
      text_id8: "test",
    },
  });
});

Deno.test("Query simple CTE", () => {
  setup();

  const query1 = tasksDb.users
    .query()
    .select((cols) => ({ demo: cols.id, id: cols.id }))
    .groupBy((cols) => [cols.name])
    .limit(Expr.literal(10));

  const result = queryFrom(query1).all();

  expect(format(result.sql)).toEqual(sql`
    WITH
      cte_id2 AS (
        SELECT users.id AS demo, users.id AS id
        FROM users
        GROUP BY users.name
        LIMIT 10
      )
    SELECT cte_id2.* FROM cte_id2
  `);
  expect(result.params).toEqual(null);
});

Deno.test("Query CTE", () => {
  setup();

  const query1 = tasksDb.users
    .query()
    .select((cols) => ({ demo: cols.id, id: cols.id }))
    .groupBy((cols) => [cols.name])
    .limit(Expr.literal(10));

  const result = queryFrom(query1)
    .select((cols) => ({ demo2: cols.demo, id: cols.id }))
    .where((cols) => Expr.equal(cols.id, Expr.literal(2)))
    .one();

  expect(format(result.sql)).toEqual(sql`
    WITH
      cte_id2 AS (
        SELECT users.id AS demo, users.id AS id
        FROM users
        GROUP BY users.name
        LIMIT 10
      )
    SELECT cte_id2.demo AS demo2, cte_id2.id AS id
    FROM cte_id2
    WHERE cte_id2.id == 2
  `);
  expect(result.params).toEqual(null);
});

Deno.test("Query add select column", () => {
  setup();

  const result = tasksDb.users
    .query()
    .select((cols) => ({ id: cols.id }))
    .select((cols, current) => ({ ...current, email: cols.email }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT users.id AS id, users.email AS email
    FROM users
  `);
});

Deno.test("Query with json", () => {
  setup();

  const result = tasksDb.joinUsersTasks
    .query()
    .innerJoin(
      tasksDb.tasks.query(),
      "tasks",
      (c) => Expr.equal(c.task_id, c.tasks.id),
    )
    .select((c) => ({ userId: c.user_id, task: Expr.jsonObj(c.tasks) }))
    .all();

  expect(format(result.sql)).toEqual(sql`
    SELECT
      joinUsersTasks.user_id AS userId,
      json_object(
        'id', t_id0.id,
        'title', t_id0.title,
        'description', t_id0.description,
        'completed', t_id0.completed
      ) AS task
    FROM joinUsersTasks
    INNER JOIN tasks AS t_id0 ON joinUsersTasks.task_id == t_id0.id
  `);
});

// test('Query populate tasksIds', () => {
//   const result = tasksDb.users
//     .query()
//     .select((cols) => ({ id: cols.id }))
//     .populate(
//       'taskIds',
//       (c) => c.id,
//       tasksDb.joinUsersTasks.query(),
//       (c) => c.user_id,
//       (c) => c.task_id
//     )
//     .all();

//   expect(format(result.sql)).toEqual(sql`
//     WITH
//       cte_id4 AS (
//         SELECT
//           joinUsersTasks.user_id AS key,
//           json_group_array(joinUsersTasks.task_id) AS value
//         FROM joinUsersTasks
//         GROUP BY joinUsersTasks.user_id
//       )
//     SELECT
//       users.id AS id,
//       json_group_array(joinUsersTasks.task_id) AS taskIds
//     FROM users
//       LEFT JOIN joinUsersTasks ON users.id == joinUsersTasks.user_id
//   `);
// });

// test('Query populate', () => {
//   const tasksWithUserId = tasksDb.joinUsersTasks
//     .query()
//     .join(tasksDb.tasks.query(), 'tasks', (c) => Expr.equal(c.task_id, c.tasks.id))
//     .select((c) => ({ userId: c.user_id, task: Expr.ScalarFunctions.json_object(c.tasks) }));

//   const result = tasksDb.users
//     .query()
//     .select((cols) => ({ id: cols.id }))
//     .populate(
//       'tasks',
//       (c) => c.id,
//       tasksWithUserId,
//       (c) => c.userId,
//       (c) => c.task
//     )
//     .all();

//   expect(format(result.sql)).toEqual(sql`
//     WITH
//       cte_id3 AS (
//         SELECT
//           joinUsersTasks.user_id AS userId,
//           json_object(
//             'id', tasks.id,
//             'title', tasks.title,
//             'description', tasks.description,
//             'completed', tasks.completed
//           ) AS task
//         FROM joinUsersTasks
//           LEFT JOIN tasks ON joinUsersTasks.task_id == tasks.id
//       ),
//       cte_id8 AS (
//         SELECT
//           cte_id3.userId AS key,
//           json_group_array(json(cte_id3.task)) AS value
//         FROM cte_id3
//         GROUP BY cte_id3.userId
//       )
//     SELECT
//       users.id AS id,
//       json_group_array(json(cte_id3.task)) AS tasks
//     FROM
//       users
//       LEFT JOIN joinUsersTasks ON users.id == cte_id3.userId
//   `);
// });
