# ZendDB

> Type safe query builder for SQLite

## Installation

This package is published on [JSR](https://jsr.io/@dldc/zendb):

```bash
# npm
npx jsr add @dldc/zendb
# deno
deno add @dldc/zendb
```

## Driver library

In addition to this package, you will need to install a driver library for
SQLite. There are 3 currently available:

- `@dldc/zendb-db-sqlite` for [`@db/sqlite`](https://jsr.io/@db/sqlite)
  available on [JSR](https://jsr.io/@dldc/zendb-db-sqlite)
- `@dldc/zendb-sqljs` for [`sql.js`](https://www.npmjs.com/package/sql.js)
  available on [NPM](https://www.npmjs.com/package/@dldc/zendb-sqljs)
- `@dldc/zendb-better-sqlite3` for
  [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) available on
  [NPM](https://www.npmjs.com/package/@dldc/zendb-better-sqlite3)

Those librairiers are quite simple, if your driver is not listed here, you can
easily create your own driver by looking at the source code of the existing
ones.

## Overview

Here is an overview of how to use this library:

### 1. Create a schema

```ts
import { Column, Table } from "@dldc/zendb";

export const schema = Table.declareMany({
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
```

### 2. Initialize the database

```ts
import { Database } from "@db/sqlite";
import { DbDatabase } from "@dldc/zendb-db-sqlite";

// create @db/sqlite database
const sqlDb = new Database(dbPath);
// pass it to the adapter
const db = DbDatabase(sqlDb);

// the you probably want to create the tables if they don't exist
// this library does not provide a proper migration system
// this is a simple way to create the tables if they don't exist
import { Database as ZenDatabase } from "@dldc/zendb";

// get the list of tables
const tables = db.exec(ZenDatabase.tables());
if (tables.length === 0) {
  // create the tables
  db.execMany(
    ZenDatabase.schema(schema, { ifNotExists: true, strict: true }),
  );
}
```

### 3. Run queries

Your `db` variable (created from the driver library) will expose at least 2
methods:

- `exec(DatabaseOperation)`
- `execMany(DatabaseOperation[])`

You will then use your schema to create `DatabaseOperation` objects:

```ts
import { schema } from "./schema.ts";

const userQueryOp = schema.users.query().andFilterEqual({ id: "my-id" })
  .maybeOne();
const result = db.exec(userQueryOp);
//    ^^^^^^ this is type safe 🎉
```

## `insert`, `update`, `delete`

They are 6 methods available on the `Table` object:

- `.insert(item)`
- `.insertMany(item[])`
- `.delete(condtion)` (`condition` is an expression function, detailed below)
- `.deleteEqual(filters)` this is a shortcut for `.delete()` with simple
  equality filters
- `.update(item, condition)` (`condition` is an expression function, detailed
  below)
- `.updateEqual(item, filters)` this is a shortcut for `.update()` with simple
  equality filters

## Queries

To create a query, you need to call the `.query()` method on a table. This will
return a `Query` object. You can then chain methods to build your query.

There are 2 kind of methods on the `Query` object:

- Methods that return an database operation (`.all()`, `.one()`, `.maybeOne()`,
  `.first()`, `.maybeFirst()`). You must always end your query with one of those
  methods.
- Methods that return a new query object with updated properties (all the other
  methods).

Here is an example:

```ts
const query = schema.tasks.query()
  .andFilterEqual({ completed: false })
  .all();

const tasks = db.exec(query);
```

## Query end methods

- `.all()`: return all the rows that match the query
- `.maybeFirst()`: add a `LIMIT 1` to the query and return the first row or
  `null`
- `.first()`: similar to `.maybeFirst()` but will throw an error if no row is
  found
- `.maybeOne()`: return the first row or `null` if no row is found, will throw
  an error if more than one row is found
- `.one()`: similar to `.maybeOne()` but will throw an error if no row is found

_Note: `.first()` and `.maybeFirst()` will override any `LIMIT` that was set on
the query._

## Expressions

One key concept in this library is its ability to create and manipulate type
safe [expressions](https://www.sqlite.org/lang_expr.html). If you don't already
know what an expression is, you can think of it as any piece of SQL that can be
evaluated to a value. This includes:

- A column name (`id`, `task.name`)
- A literal value (`"hello"`, `42`)
- A function (`COUNT(*)`, `SUM(task.duration)`)
- A binary operation (`1 + 2`, `task.duration * 60`)
- A variable (`:myVar`)

### `Expr.external`

The `Expr.external` function is used to create an expression from a variable.

```ts
import { Expr } from "@dldc/zendb";

const query2 = schema.tasks.query()
  .limit(Expr.external(10))
  .all();

console.log(query2.sql); // SELECT tasks.* FROM tasks LIMIT :_hgJnoKSYKp
console.log(query2.params); // { _hgJnoKSYKp: 10 }
```

As you can see, the `Expr.external` function create a variable with a unique
name (`_hgJnoKSYKp`) that will be send to the driver. This is important because
it protects you from SQL injection !

### Expression functions

Many methods on the `Query` object take an expression function as argument. This
is a function that will be called with an object that contains the columns of
the table, each column is an expression so you can use them to build your
expression.

Here is an example with the `.where` method:

```ts
const meOrYou = schema.users.query()
  .where((c) =>
    Expr.or(
      Expr.equal(c.id, Expr.external("me")),
      Expr.equal(c.id, Expr.external("you")),
    )
  )
  .all();
```

### Select function

The `.select()` method is used to select specific columns. It takes an
expression function as parameters that should return an object with the columns
you want to select, each columns can be any expression.

_Note: if you don't provide a select(), all columns from the source tables are
selected_

```ts
// select only some properties of the user
const userQuery = schema.users.query()
  .select((c) => ({ id: c.id, name: c.name }))
  .all();
// SELECT users.id AS id, users.name AS name FROM users

// Using destructuring
const userQuery = schema.users.query()
  .select(({ id, name }) => ({ id, name }))
  .all();
// SELECT users.id AS id, users.name AS name FROM users

// Using expressions
const userQueryConcat = schema.users.query()
  .select((c) => ({ id: c.id, name: Expr.concatenate(c.name, c.email) }))
  .all();
// SELECT users.id AS id, users.name || users.email AS name FROM users

// Without select, all columns are selected
const userQueryAll = schema.users.query().all();
// SELECT users.* FROM users
```

## Joins

You can join tables using the `.innerJoin()` and `.leftJoin()` method. Those two
have the same signature and take the following arguments:

- `table` The first argument is the Query object. Most of the time the result of
  a `.query()` call but it can be any query object. If needed, the library will
  use a CTE to make the join.
- `alias` The second argument is a string that will be used as an alias for the
  table. This will be used to reference the columns of the table in the
  expression function.
- `joinOn` The third argument is an expression function that should return a
  boolean expression that will be used to join the tables.

Here is an example:

```ts
const usersWithGroups = schema.users.query()
  .innerJoin(
    schema.groups.query(),
    "groupAlias",
    (c) => Expr.equal(c.groupId, c.groupAlias.id),
  )
  .select((c) => ({
    id: c.id,
    name: c.name,
    groupName: c.groupAlias.name, // Notice the .groupAlias here
  }))
  .all();
```

The resulting query will look like this:

```sql
SELECT users.id AS id,
  users.name AS name,
  t_8vUvrgUNne.name AS groupName
FROM users
  INNER JOIN groups AS t_8vUvrgUNne ON users.groupId == t_8vUvrgUNne.id
```

_Note: the join alias you define is not used in the query itself, instead a
random name is used !_

## Using [CTEs](https://en.wikipedia.org/wiki/Hierarchical_and_recursive_queries_in_SQL)

When you join a table, the library will automatically use a CTE to make the join
if needed. But you might want to use a CTE yourself. You can do this by using
the `queryFrom()` function:

```ts
import { queryFrom } from "@dldc/zendb";

const query1 = schema.users
  .query()
  .select((cols) => ({ demo: cols.id, id: cols.id }))
  .groupBy((cols) => [cols.name]);

const withCte = queryFrom(query1).all();
```

The resulting query will look like this:

```sql
WITH cte_id15 AS (
  SELECT users.id AS demo,
    users.id AS id
  FROM users
  GROUP BY users.name
)
SELECT cte_id15.*
FROM cte_id15
```
