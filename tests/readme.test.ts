import {
  Column,
  Database as ZenDatabase,
  Expr,
  queryFrom,
  Random,
  Schema,
} from "@dldc/zendb";
import { expect } from "@std/expect";
import { TestDatabase } from "./utils/TestDatabase.ts";
import { format, sql } from "./utils/sql.ts";

Deno.test("Run code from README example", () => {
  let nextRandomId = 0;
  // disable random suffix for testing
  Random.setCreateId(() => `id${nextRandomId++}`);

  const schema = Schema.declare({
    tasks: {
      id: Column.text().primary(),
      title: Column.text(),
      description: Column.text(),
      completed: Column.boolean(),
    },
    users: {
      id: Column.text().primary(),
      name: Column.text(),
      email: Column.text(),
      displayName: Column.text().nullable(),
      groupId: Column.text(),
      updatedAt: Column.date().nullable(),
    },
    joinUsersTasks: {
      user_id: Column.text().primary(),
      task_id: Column.text().primary(),
    },
    groups: {
      id: Column.text().primary(),
      name: Column.text(),
    },
  });

  const db = TestDatabase.create();

  const tables = db.exec(ZenDatabase.tables());
  if (tables.length === 0) {
    // create the tables
    db.execMany(
      ZenDatabase.schema(schema.tables, { ifNotExists: true, strict: true }),
    );
  }

  const userQueryOp = schema.tables.users.query().andFilterEqual({
    id: "my-id",
  })
    .maybeOne();
  const result = db.exec(userQueryOp);
  expect(result).toEqual(null);

  const query = schema.tables.tasks.query()
    .andFilterEqual({ completed: false })
    .all();
  const tasks = db.exec(query);
  expect(tasks).toEqual([]);

  // External

  const query2 = schema.tables.tasks.query()
    .limit(Expr.external(10))
    .all();

  expect(query2).toMatchObject({
    kind: "Query",
    params: { _id4: 10 },
    sql: "SELECT tasks.* FROM tasks LIMIT :_id4",
  });

  // Expression functions

  const meOrYou = schema.tables.users.query()
    .where((c) =>
      Expr.or(
        Expr.equal(c.id, Expr.external("me")),
        Expr.equal(c.id, Expr.external("you")),
      )
    )
    .maybeOne();

  const res = db.exec(meOrYou);
  expect(res).toEqual(null);

  // .select()

  const userQuery = schema.tables.users.query()
    .select((c) => ({
      id: c.id,
      name: c.name,
    }))
    .all();
  expect(userQuery.sql).toEqual(
    `SELECT users.id AS id, users.name AS name FROM users`,
  );

  const userQueryConcat = schema.tables.users.query()
    .select((c) => ({ id: c.id, name: Expr.concatenate(c.name, c.email) }))
    .all();
  expect(userQueryConcat.sql).toEqual(
    `SELECT users.id AS id, users.name || users.email AS name FROM users`,
  );

  const userQueryAll = schema.tables.users.query().all();
  expect(userQueryAll.sql).toEqual(`SELECT users.* FROM users`);

  // Join

  const usersWithGroups = schema.tables.users.query()
    .innerJoin(
      schema.tables.groups.query(),
      "groupAlias",
      (c) => Expr.equal(c.groupId, c.groupAlias.id),
    )
    .select((c) => ({
      id: c.id,
      name: c.name,
      groupName: c.groupAlias.name, // Notice the .groupAlias here
    }))
    .all();

  expect(format(usersWithGroups.sql)).toEqual(sql`
    SELECT users.id AS id,
      users.name AS name,
      t_id11.name AS groupName
    FROM users
      INNER JOIN groups AS t_id11 ON users.groupId == t_id11.id
  `);

  // CTEs

  const query1 = schema.tables.users
    .query()
    .select((cols) => ({ demo: cols.id, id: cols.id }))
    .groupBy((cols) => [cols.name]);

  const withCte = queryFrom(query1).all();

  console.log(withCte.sql);
  expect(format(withCte.sql)).toEqual(sql`
    WITH cte_id15 AS (
      SELECT users.id AS demo,
        users.id AS id
      FROM users
      GROUP BY users.name
    )
    SELECT cte_id15.*
    FROM cte_id15
  `);
});
