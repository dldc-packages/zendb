# ZendDB

> Type safe query builder for SQLite

## Table of Contents

- [ZendDB](#zenddb)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Driver library](#driver-library)
  - [Overview](#overview)
    - [1. Declare a schema](#1-declare-a-schema)
      - [Column Types](#column-types)
    - [2. Initialize the database](#2-initialize-the-database)
    - [3. Run queries](#3-run-queries)
    - [Type Safety](#type-safety)
  - [`insert`, `update`, `delete`](#insert-update-delete)
    - [Insert examples](#insert-examples)
    - [Update examples](#update-examples)
    - [Delete examples](#delete-examples)
  - [Queries](#queries)
    - [Common Query Methods](#common-query-methods)
      - [Filtering](#filtering)
      - [Sorting and Limiting](#sorting-and-limiting)
      - [Grouping and Aggregation](#grouping-and-aggregation)
  - [Query end methods](#query-end-methods)
  - [Expressions](#expressions)
    - [`Expr.external`](#exprexternal)
    - [Inspecting Generated SQL](#inspecting-generated-sql)
    - [Expression functions](#expression-functions)
    - [Common Expression Operations](#common-expression-operations)
    - [Select function](#select-function)
  - [Joins](#joins)
    - [Inner Join Example](#inner-join-example)
    - [Left Join Example](#left-join-example)
    - [Multiple Joins](#multiple-joins)
    - [Joins with Aggregation (Automatic CTE)](#joins-with-aggregation-automatic-cte)
  - [JSON Operations](#json-operations)
    - [Creating JSON Objects](#creating-json-objects)
    - [Aggregating to JSON Arrays](#aggregating-to-json-arrays)
  - [Using CTEs](#using-ctes)
  - [Database Utilities](#database-utilities)
    - [Schema Operations](#schema-operations)
    - [User Version (for migrations)](#user-version-for-migrations)
  - [Migrations](#migrations)
    - [Creating Migrations](#creating-migrations)
    - [Adding Migration Steps](#adding-migration-steps)
    - [Applying Migrations](#applying-migrations)
    - [Version Management](#version-management)
      - [Checking Current Version](#checking-current-version)
      - [Setting Version (Advanced)](#setting-version-advanced)
    - [Migration Best Practices](#migration-best-practices)
    - [Complete Migration Example](#complete-migration-example)
  - [Complete Example](#complete-example)

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

#### Column Types

ZenDB supports the following column types:

- `Column.text()` - Text/string values
- `Column.integer()` - Integer values
- `Column.number()` - Floating point numbers
- `Column.boolean()` - Boolean values (stored as 0/1 in SQLite)
- `Column.date()` - JavaScript Date objects (stored as timestamps)
- `Column.json()` - JSON objects (stored as text, auto-serialized)

All column types can be made nullable with `.nullable()` and set as primary key
with `.primary()`:

```ts
{
  id: Column.text().primary(),
  name: Column.text(),
  age: Column.integer().nullable(),
}
```

### 2. Initialize the database

```ts
import { Database } from "@db/sqlite";
import { DbDatabase } from "@dldc/zendb-db-sqlite";
import { Schema, Utils } from "@dldc/zendb";
import { schema } from "./schema.ts";

// create @db/sqlite database
const sqlDb = new Database(dbPath);
// pass it to the adapter
const db = DbDatabase(sqlDb);

// then you probably want to create the tables if they don't exist
const tables = db.exec(Utils.listTables());
if (tables.length === 0) {
  db.execMany(
    Schema.createTables(schema.tables, { ifNotExists: true, strict: true }),
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
// result type: { id: string; name: string; email: string; ... } | null
```

### Type Safety

ZenDB provides full type safety throughout the query building process:

```ts
// Insert - requires all non-nullable fields
const user = schema.tables.users.insert({
  id: "1",
  name: "John",
  email: "john@example.com",
  displayName: null, // nullable field
  groupId: "1",
  updatedAt: new Date(),
});

// Query results are typed based on select
const query = schema.tables.users.query()
  .select(({ id, name }) => ({ id, name }))
  .all();
// Result type: Array<{ id: string; name: string }>

// Columns are typed in expression functions
const filtered = schema.tables.users.query()
  .where((c) => Expr.equal(c.id, Expr.external("123")))
  // c.id is known to be a string column
  .maybeOne();
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

### Insert examples

```ts
// Insert a single item
const insertOp = schema.tables.users.insert({
  id: "1",
  name: "John Doe",
  email: "john@example.com",
  displayName: null,
  groupId: "1",
  updatedAt: new Date("2023-12-24T22:30:12.250Z"),
});
db.exec(insertOp);

// Insert multiple items
const users = [
  { id: "1", name: "John", email: "john@example.com", groupId: "1" },
  { id: "2", name: "Jane", email: "jane@example.com", groupId: "1" },
];
db.exec(schema.tables.users.insertMany(users));
```

### Update examples

```ts
// Update with condition
const updateOp = schema.tables.users.update(
  { name: "Paul" },
  (cols) => Expr.equal(cols.id, Expr.external("1234")),
);
db.exec(updateOp);

// Update with simple equality filter
const updateEqualOp = schema.tables.users.updateEqual(
  { name: "Paul" },
  { id: "1234" },
);
db.exec(updateEqualOp);
```

### Delete examples

```ts
// Delete with condition
const deleteOp = schema.tables.users.delete((cols) =>
  Expr.equal(cols.id, Expr.external("1"))
);
db.exec(deleteOp);

// Delete with simple equality filter
const deleteEqualOp = schema.tables.users.deleteEqual({ id: "1" });
db.exec(deleteEqualOp);
```

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

### Common Query Methods

#### Filtering

```ts
// Simple equality filter
const query = schema.tables.tasks.query()
  .andFilterEqual({ id: "1" })
  .one();

// Multiple filters (AND)
const query = schema.tables.tasks.query()
  .andFilterEqual({ completed: false })
  .andFilterEqual({ id: "1" })
  .maybeOne();

// Custom filter with where
const query = schema.tables.users.query()
  .where((c) =>
    Expr.or(
      Expr.equal(c.id, Expr.external("me")),
      Expr.equal(c.id, Expr.external("you")),
    )
  )
  .all();
```

#### Sorting and Limiting

```ts
// Order by
const query = schema.tables.tasks.query()
  .orderBy((cols) => [cols.title])
  .all();

// Limit
const query = schema.tables.tasks.query()
  .limit(Expr.external(10))
  .all();

// Offset
const query = schema.tables.tasks.query()
  .offset(Expr.external(5))
  .all();
```

#### Grouping and Aggregation

```ts
// Group by with count
const query = schema.tables.users.query()
  .select((cols) => ({
    email: cols.email,
    count: Expr.Aggregate.count(cols.id),
  }))
  .groupBy((cols) => [cols.email])
  .all();
```

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

As you can see, the `Expr.external` function creates a variable with a unique
name (`_hgJnoKSYKp`) that will be sent to the driver. This is important because
it protects you from SQL injection!

### Inspecting Generated SQL

All operations expose `.sql` and `.params` properties:

```ts
const query = schema.tables.tasks.query()
  .andFilterEqual({ completed: false })
  .limit(Expr.external(10))
  .all();

console.log(query.sql);
// SELECT tasks.* FROM tasks WHERE tasks.completed == :_id0 LIMIT :_id1

console.log(query.params);
// { _id0: 0, _id1: 10 }
// Note: boolean false is stored as 0 in SQLite
```

The operation also has a `.kind` property:

```ts
const insertOp = schema.tables.users.insert({ ... });
console.log(insertOp.kind); // "Insert"

const queryOp = schema.tables.users.query().all();
console.log(queryOp.kind); // "Query"

const updateOp = schema.tables.users.update({ ... }, (c) => ...);
console.log(updateOp.kind); // "Update"

const deleteOp = schema.tables.users.delete((c) => ...);
console.log(deleteOp.kind); // "Delete"
```

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

### Common Expression Operations

```ts
// Comparison operators
Expr.equal(a, b); // a == b
Expr.notEqual(a, b); // a != b
Expr.lessThan(a, b); // a < b
Expr.greaterThan(a, b); // a > b

// Logical operators
Expr.and(a, b); // a AND b
Expr.or(a, b); // a OR b
Expr.not(a); // NOT a

// String operations
Expr.concatenate(a, b); // a || b

// Aggregate functions
Expr.Aggregate.count(col);
Expr.Aggregate.sum(col);
Expr.Aggregate.avg(col);
Expr.Aggregate.min(col);
Expr.Aggregate.max(col);

// JSON functions
Expr.jsonObj(cols); // Create JSON object from columns
Expr.jsonGroupArray(expr); // Aggregate rows into JSON array
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

### Inner Join Example

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

### Left Join Example

```ts
const tasksWithUser = schema.tables.joinUsersTasks.query()
  .leftJoin(
    schema.tables.tasks.query(),
    "task",
    (cols) => Expr.equal(cols.task_id, cols.task.id),
  )
  .leftJoin(
    schema.tables.users.query(),
    "user",
    (cols) => Expr.equal(cols.user_id, cols.user.id),
  )
  .select((cols) => ({
    user: Expr.jsonObj(cols.user),
    task: Expr.jsonObj(cols.task),
  }))
  .all();
```

### Multiple Joins

```ts
const result = schema.tables.users.query()
  .innerJoin(
    schema.tables.joinUsersTasks.query(),
    "usersTasks",
    (cols) => Expr.equal(cols.usersTasks.user_id, cols.id),
  )
  .innerJoin(
    schema.tables.tasks.query(),
    "tasks",
    (cols) => Expr.equal(cols.tasks.id, cols.usersTasks.task_id),
  )
  .select((cols) => ({
    id: cols.id,
    email: cols.email,
    taskName: cols.tasks.title,
  }))
  .all();
```

### Joins with Aggregation (Automatic CTE)

When joining a query with aggregation or select, the library automatically uses
a CTE:

```ts
const countUsersByGroup = schema.tables.users.query()
  .select(({ id, groupId }) => ({
    groupId,
    usersCount: Expr.Aggregate.count(id),
  }))
  .groupBy((c) => [c.groupId]);

const groupsWithUsersCount = schema.tables.groups.query()
  .innerJoin(
    countUsersByGroup,
    "users",
    (c) => Expr.equal(c.id, c.users.groupId),
  )
  .select(({ id, name, users }) => ({
    id,
    name,
    usersCount: users.usersCount,
  }))
  .all();
```

Results in:

```sql
WITH cte_id1 AS (
  SELECT users.groupId AS groupId,
    count(users.id) AS usersCount
  FROM users
  GROUP BY users.groupId
)
SELECT groups.id AS id,
  groups.name AS name,
  t_id2.usersCount AS usersCount
FROM groups
  INNER JOIN cte_id1 AS t_id2 ON groups.id == t_id2.groupId
```

## JSON Operations

ZenDB provides powerful JSON functions for working with structured data:

### Creating JSON Objects

```ts
// Create JSON object from all columns
const query = schema.tables.users.query()
  .select((c) => ({
    id: c.id,
    userData: Expr.jsonObj(c),
  }))
  .all();
```

### Aggregating to JSON Arrays

```ts
// Group related records into JSON arrays
const tasksByUserId = schema.tables.joinUsersTasks.query()
  .innerJoin(
    schema.tables.tasks.query(),
    "task",
    (c) => Expr.equal(c.task_id, c.task.id),
  )
  .groupBy((c) => [c.user_id])
  .select((c) => ({
    userId: c.user_id,
    tasks: Expr.jsonGroupArray(Expr.jsonObj(c.task)),
  }))
  .all();
```

This will return results like:

```json
[
  {
    "userId": "1",
    "tasks": [
      { "id": "1", "title": "First Task", "completed": false },
      { "id": "2", "title": "Second Task", "completed": true }
    ]
  }
]
```

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

## Database Utilities

The `Utils` namespace provides utility functions for database management:

### Schema Operations

```ts
import { Schema, Utils } from "@dldc/zendb";

// Create all tables from schema
db.execMany(
  Schema.createTables(schema.tables, { ifNotExists: true, strict: true }),
);

// List all tables in database
const tableNames = db.exec(Utils.listTables());
console.log(tableNames); // ["users", "tasks", "groups"]
```

### User Version (for migrations)

SQLite's `user_version` pragma is used to track migration state:

```ts
// Get current version
const version = db.exec(Utils.userVersion());
console.log(version); // 0 for new database

// Set version (typically used by migration system)
db.exec(Utils.setUserVersion(3));
```

## Migrations

ZenDB provides a powerful migration system that helps you evolve your database
schema over time while preserving data. Migrations use SQLite's `user_version`
pragma to track which migrations have been applied.

### Creating Migrations

Start by initializing a migration with your initial schema:

```ts
import { Column, Migration, Schema } from "@dldc/zendb";

const migration = Migration.initMigration(
  Schema.declare({
    users: {
      id: Column.text().primary(),
      name: Column.text(),
      email: Column.text(),
      groupId: Column.text(),
    },
    groups: {
      id: Column.text().primary(),
      name: Column.text(),
    },
  }),
  ({ database, schema }) => {
    // Optional: Seed initial data
    database.exec(
      schema.tables.groups.insertMany([
        { id: "group1", name: "Engineering" },
        { id: "group2", name: "Sales" },
      ]),
    );

    return Promise.resolve();
  },
);
```

### Adding Migration Steps

Add migration steps using `.step()`. Each step takes a schema updater function
and an execution function:

```ts
const migration = Migration.initMigration(initialSchema, initExec)
  // Step 1: Add 'archived' column to users table
  .step((schema) =>
    Schema.declare({
      ...schema.definition,
      users: {
        ...schema.tables.users.definition,
        archived: Column.boolean(),
      },
    })
  )(({ copyTable }) => {
    // Copy data from old schema to new schema
    copyTable("users", "users", (user) => ({
      ...user,
      archived: false, // Set default value for new column
    }));
    copyTable("groups", "groups", (group) => group);

    return Promise.resolve();
  })
  // Step 2: Add 'tasks' table
  .step((schema) =>
    Schema.declare({
      ...schema.definition,
      tasks: {
        id: Column.text().primary(),
        title: Column.text(),
        completed: Column.boolean(),
        userId: Column.text(),
      },
    })
  )(({ copyTable }) => {
    // Copy existing tables
    copyTable("users", "users", (r) => r);
    copyTable("groups", "groups", (r) => r);
    // New table will be empty initially

    return Promise.resolve();
  });

// Export the final schema for use in your application
export const schema = migration.schema;
```

### Applying Migrations

Apply migrations using the `.apply()` method:

```ts
const resultDb = await migration.apply({
  // Current database instance
  currentDatabase: db,

  // Function to create a temporary database for migration
  createTempDatabase: () => Promise.resolve(createDatabase()),

  // Function to save the migrated database
  saveDatabase: (db) => {
    // Save to file, copy data, etc.
    return Promise.resolve(db);
  },
});
```

### Version Management

ZenDB automatically tracks migration versions using SQLite's `user_version`:

- **Version 0**: No migrations applied (empty database)
- **Version 1**: Initial migration completed
- **Version 2+**: Each subsequent `.step()` increments the version

The migration system:

- ✅ Automatically skips already-applied migrations
- ✅ Only runs new migrations that haven't been applied
- ✅ Creates tables automatically for each schema version
- ✅ Validates that the database version isn't higher than expected
- ❌ Throws an error if `user_version` is higher than the number of steps

#### Checking Current Version

```ts
import { Utils } from "@dldc/zendb";

const version = db.exec(Utils.userVersion());
console.log(`Current database version: ${version}`);
```

#### Setting Version (Advanced)

```ts
// Manually set version (use with caution!)
db.exec(Utils.setUserVersion(3));
```

### Migration Best Practices

1. **Always use `copyTable`**: Don't manually query and insert data. The
   `copyTable` helper handles pagination automatically.

2. **Transform data carefully**: When adding non-nullable columns, provide
   default values in the transform function.

3. **Test migrations**: Always test migrations with a copy of production data
   before applying them.

4. **Keep migrations immutable**: Once a migration is deployed, don't modify it.
   Add new steps instead.

5. **Export final schema**: Export `migration.schema` so your application always
   uses the latest schema definition.

### Complete Migration Example

```ts
import { Column, Migration, Schema } from "@dldc/zendb";

// Initial schema (version 1)
const migration = Migration.initMigration(
  Schema.declare({
    users: {
      id: Column.text().primary(),
      name: Column.text(),
      email: Column.text(),
    },
  }),
  ({ database, schema }) => {
    // Seed initial data if needed
    return Promise.resolve();
  },
)
  // Add displayName column (version 2)
  .step((schema) =>
    Schema.declare({
      ...schema.definition,
      users: {
        ...schema.tables.users.definition,
        displayName: Column.text().nullable(),
      },
    })
  )(({ copyTable }) => {
    copyTable("users", "users", (user) => ({
      ...user,
      displayName: null,
    }));
    return Promise.resolve();
  })
  // Add archived flag (version 3)
  .step((schema) =>
    Schema.declare({
      ...schema.definition,
      users: {
        ...schema.tables.users.definition,
        archived: Column.boolean(),
      },
    })
  )(({ copyTable }) => {
    copyTable("users", "users", (user) => ({
      ...user,
      archived: false,
    }));
    return Promise.resolve();
  });

// Export the final schema
export const schema = migration.schema;

// Apply migrations
const migratedDb = await migration.apply({
  currentDatabase: db,
  createTempDatabase: () => Promise.resolve(createTempDb()),
  saveDatabase: async (tempDb) => {
    // Copy data from temp to current, or replace file, etc.
    return tempDb;
  },
});
```

## Complete Example

Here's a complete example showing common operations:

```ts
import { Column, Expr, Schema } from "@dldc/zendb";
import { Database } from "@db/sqlite";
import { DbDatabase } from "@dldc/zendb-db-sqlite";

// 1. Define schema
const schema = Schema.declare({
  users: {
    id: Column.text().primary(),
    name: Column.text(),
    email: Column.text(),
    groupId: Column.text(),
  },
  tasks: {
    id: Column.text().primary(),
    title: Column.text(),
    completed: Column.boolean(),
    userId: Column.text(),
  },
  groups: {
    id: Column.text().primary(),
    name: Column.text(),
  },
});

// 2. Initialize database
const sqlDb = new Database(":memory:");
const db = DbDatabase(sqlDb);

// Create tables
db.execMany(
  Schema.createTables(schema.tables, { ifNotExists: true, strict: true }),
);

// 3. Insert data
db.exec(
  schema.tables.groups.insert({ id: "1", name: "Engineering" }),
);

db.exec(
  schema.tables.users.insertMany([
    { id: "1", name: "Alice", email: "alice@example.com", groupId: "1" },
    { id: "2", name: "Bob", email: "bob@example.com", groupId: "1" },
  ]),
);

db.exec(
  schema.tables.tasks.insertMany([
    { id: "1", title: "Write docs", completed: false, userId: "1" },
    { id: "2", title: "Review PR", completed: true, userId: "1" },
    { id: "3", title: "Deploy", completed: false, userId: "2" },
  ]),
);

// 4. Query with joins and aggregation
const usersWithTaskCounts = schema.tables.users.query()
  .innerJoin(
    schema.tables.groups.query(),
    "group",
    (c) => Expr.equal(c.groupId, c.group.id),
  )
  .leftJoin(
    schema.tables.tasks.query(),
    "tasks",
    (c) => Expr.equal(c.id, c.tasks.userId),
  )
  .groupBy((c) => [c.id, c.name, c.email, c.group.name])
  .select((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    groupName: c.group.name,
    taskCount: Expr.Aggregate.count(c.tasks.id),
  }))
  .all();

const result = db.exec(usersWithTaskCounts);
console.log(result);
// [
//   { id: '1', name: 'Alice', email: 'alice@example.com',
//     groupName: 'Engineering', taskCount: 2 },
//   { id: '2', name: 'Bob', email: 'bob@example.com',
//     groupName: 'Engineering', taskCount: 1 }
// ]

// 5. Update
db.exec(
  schema.tables.tasks.updateEqual(
    { completed: true },
    { id: "1" },
  ),
);

// 6. Delete
db.exec(
  schema.tables.tasks.deleteEqual({ completed: true }),
);
```
