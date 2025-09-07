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

Those libraries are quite simple; if your driver is not listed here, you can
easily create your own driver by looking at the source code of the existing
ones.

## Overview

Here is an overview of how to use this library:

### 1. Declare a schema

Use `Schema.declare`

```ts
import { Column, Schema } from "@dldc/zendb";

export const schema = Schema.declare({
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

You will access tables via `schema.tables.<tableName>`.

### 2. Initialize the database

```ts
import { Database } from "@db/sqlite";
import { DbDatabase } from "@dldc/zendb-db-sqlite";
import { Database as ZenDatabase } from "@dldc/zendb";
import { schema } from "./schema.ts";

// create @db/sqlite database
const sqlDb = new Database(dbPath);
// pass it to the adapter
const db = DbDatabase(sqlDb);

// then you probably want to create the tables if they don't exist
const tables = db.exec(ZenDatabase.tables());
if (tables.length === 0) {
  db.execMany(
    ZenDatabase.schema(schema.tables, { ifNotExists: true, strict: true }),
  );
}
```

### 3. Run queries

Your driver instance (`db`) exposes:

- `exec(DatabaseOperation)`
- `execMany(DatabaseOperation[])`

Use your schema to build operations:

```ts
import { schema } from "./schema.ts";

const userQueryOp = schema.tables.users.query()
  .andFilterEqual({ id: "my-id" })
  .maybeOne();

const result = db.exec(userQueryOp);
// result is type safe 🎉
```

## `insert`, `update`, `delete`

There are a few methods available on each `Table` object:

- `.insert(item)`
- `.insertMany(item[])`
- `.delete(condition)` (`condition` is an expression function, detailed below)
- `.deleteEqual(filters)` shortcut for simple equality filters
- `.update(item, condition)` (`condition` is an expression function)
- `.updateEqual(item, filters)` shortcut version for simple equality filters

(Use them from `schema.tables.<table>`.)

## Queries

Create a query with `.query()` on a table:

```ts
const query = schema.tables.tasks.query()
  .andFilterEqual({ completed: false })
  .all();

const tasks = db.exec(query);
```

Two kinds of methods on a `Query`:

- Terminal: `.all()`, `.one()`, `.maybeOne()`, `.first()`, `.maybeFirst()`
- Transforming: all others (return a new Query)

Always end with a terminal method.

## Query end methods

- `.all()`: all rows
- `.maybeFirst()`: first row or `null` (adds / overrides `LIMIT 1`)
- `.first()`: first row or error if none
- `.maybeOne()`: one row or `null`; error if more than one
- `.one()`: exactly one row or error if 0 or >1

`.first()` / `.maybeFirst()` override any existing `LIMIT`.

## Expressions

Expressions are type-safe SQL fragments:

- Column: `users.id`
- Literal: `42`, `"hello"`
- Function: `COUNT(*)`
- Binary op: `a + b`
- External variable (parameter): `:_var`

### `Expr.external`

The `Expr.external` function is used to create an expression from a variable.

```ts
import { Expr } from "@dldc/zendb";

const query2 = schema.tables.tasks.query()
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
const meOrYou = schema.tables.users.query()
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
// Select only some properties
const userQuery = schema.tables.users.query()
  .select((c) => ({ id: c.id, name: c.name }))
  .all();
// SELECT users.id AS id, users.name AS name FROM users

// Using destructuring
const userQuery = schema.tables.users.query()
  .select(({ id, name }) => ({ id, name }))
  .all();
// SELECT users.id AS id, users.name AS name FROM users

// Using expressions
const userQueryConcat = schema.tables.users.query()
  .select((c) => ({
    id: c.id,
    name: Expr.concatenate(c.name, c.email),
  }))
  .all();
// SELECT users.id AS id, users.name || users.email AS name FROM users

// All columns
const userQueryAll = schema.tables.users.query().all();
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
```

The resulting query will look like this:

```sql
SELECT users.id AS id,
  users.name AS name,
  t_8vUvrgUNne.name AS groupName
FROM users
  INNER JOIN groups AS t_8vUvrgUNne ON users.groupId == t_8vUvrgUNne.id
```

Note: The provided alias (`groupAlias`) is only for build-time typing; the SQL
uses an auto-generated internal alias.

## Using [CTEs](https://en.wikipedia.org/wiki/Hierarchical_and_recursive_queries_in_SQL)

When you join a table, the library will automatically use a CTE to make the join
if needed. But you might want to use a CTE yourself. You can do this by using
the `queryFrom()` function:

```ts
import { queryFrom } from "@dldc/zendb";

const query1 = schema.tables.users
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
