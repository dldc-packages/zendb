# ZenDB

> Type safe query builder for SQLite

## Table of Contents

- [ZenDB](#zendb)
  - [Table of Contents](#table-of-contents)
  - [Installation](#installation)
  - [Quick Start](#quick-start)
  - [Getting Started](#getting-started)
    - [1. Declare a schema](#1-declare-a-schema)
      - [Column Types](#column-types)
    - [2. Setup the driver and database](#2-setup-the-driver-and-database)
    - [3. Run queries](#3-run-queries)
    - [Type Safety](#type-safety)
  - [Core Operations](#core-operations)
    - [Insert](#insert)
    - [Update](#update)
    - [Delete](#delete)
  - [Queries](#queries)
    - [Query End Methods](#query-end-methods)
    - [Filtering](#filtering)
    - [Selecting Columns](#selecting-columns)
    - [Sorting and Limiting](#sorting-and-limiting)
    - [Grouping and Aggregation](#grouping-and-aggregation)
  - [Expressions](#expressions)
    - [`Expr.external` - Safe Dynamic Values](#exprexternal---safe-dynamic-values)
      - [What does it do?](#what-does-it-do)
      - [Why not just use the value directly?](#why-not-just-use-the-value-directly)
      - [When to use `Expr.external()` vs `Expr.literal()`](#when-to-use-exprexternal-vs-exprliteral)
    - [Inspecting Generated SQL](#inspecting-generated-sql)
    - [Expression Functions](#expression-functions)
    - [Common Expression Operations](#common-expression-operations)
  - [Joins](#joins)
    - [Inner Join Example](#inner-join-example)
    - [Left Join Example](#left-join-example)
    - [Multiple Joins](#multiple-joins)
    - [Joins with Aggregation (Automatic CTE)](#joins-with-aggregation-automatic-cte)
  - [Advanced Features](#advanced-features)
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
    - [Migration FAQ](#migration-faq)
    - [Migration Best Practices](#migration-best-practices)
    - [Complete Migration Example](#complete-migration-example)
  - [Drivers](#drivers)
    - [Available Drivers](#available-drivers)
    - [Why Drivers?](#why-drivers)
    - [Creating a Custom Driver](#creating-a-custom-driver)
    - [Advanced: Custom Operation Handling](#advanced-custom-operation-handling)

## Installation

This package is published on [JSR](https://jsr.io/@dldc/zendb):

```bash
# npm
npx jsr add @dldc/zendb
# deno
deno add @dldc/zendb
```

You'll also need a driver for your environment:

```bash
# Deno
deno add @dldc/zendb-db-sqlite
# Node.js
npm install @dldc/zendb-better-sqlite3
# Browser
npm install @dldc/zendb-sqljs
```

## Quick Start

Here's a complete example to get you started:

```ts
import { Column, Expr, Schema } from "@dldc/zendb";
import { Database } from "@db/sqlite";
import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";

// 1. Define schema
const schema = Schema.declare({
  users: {
    id: Column.text().primary(),
    name: Column.text(),
    email: Column.text(),
  },
  tasks: {
    id: Column.text().primary(),
    title: Column.text(),
    completed: Column.boolean(),
    userId: Column.text(),
  },
});

// 2. Initialize database
const db = new Database(":memory:");
DbSqliteDriver.execMany(
  db,
  Schema.createTables(schema.tables, { ifNotExists: true, strict: true }),
);

// 3. Insert data
DbSqliteDriver.exec(
  db,
  schema.tables.users.insert({
    id: "1",
    name: "Alice",
    email: "alice@example.com",
  }),
);

// 4. Query with type safety
const users = DbSqliteDriver.exec(
  db,
  schema.tables.users.query()
    .where((c) => Expr.equal(c.name, Expr.external("Alice")))
    .all(),
);

console.log(users); // [{ id: "1", name: "Alice", email: "alice@example.com" }]
```

## Getting Started

Here's how to use ZenDB in your project:

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

### 2. Setup the driver and database

```ts
import { Database } from "@db/sqlite";
import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";
import { Schema, Utils } from "@dldc/zendb";
import { schema } from "./schema.ts";

// Create your SQLite database instance
const db = new Database(dbPath);

// Create tables if they don't exist
const tables = DbSqliteDriver.exec(db, Utils.listTables());
if (tables.length === 0) {
  DbSqliteDriver.execMany(
    db,
    Schema.createTables(schema.tables, { ifNotExists: true, strict: true }),
  );
}
```

### 3. Run queries

Use the driver to execute operations on your database:

```ts
import { schema } from "./schema.ts";
import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";

// Build an operation
const userQueryOp = schema.tables.users.query()
  .andFilterEqual({ id: "my-id" })
  .maybeOne();

// Execute it with the driver
const result = DbSqliteDriver.exec(db, userQueryOp);
// result is type safe 🎉
// result type: { id: string; name: string; email: string; ... } | null
```

**Note:** The driver and database are separate - you always have direct access
to your database instance (`db`) for low-level operations when needed.

**Tip:** For convenience, you can create helper functions to avoid repeating the
driver and database:

```ts
// Create helper functions for your specific database
const exec = <Op extends TOperation>(op: Op) => DbSqliteDriver.exec(db, op);
const execMany = <Op extends TOperation>(ops: Op[]) =>
  DbSqliteDriver.execMany(db, ops);

// Now you can use them more concisely
const result = exec(userQueryOp);
const results = execMany([op1, op2, op3]);
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
// Use Expr.external() to pass dynamic values safely
const filtered = schema.tables.users.query()
  .where((c) => Expr.equal(c.id, Expr.external("123")))
  // c.id is known to be a string column
  .maybeOne();
```

## Core Operations

ZenDB provides type-safe methods for all basic database operations on each
`Table` object (accessed via `schema.tables.<table>`).

### Insert

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
driver.exec(db, insertOp);

// Insert multiple items at once
const users = [
  { id: "1", name: "John", email: "john@example.com", groupId: "1" },
  { id: "2", name: "Jane", email: "jane@example.com", groupId: "1" },
];
driver.exec(db, schema.tables.users.insertMany(users));
```

### Update

```ts
// Update with custom condition
const updateOp = schema.tables.users.update(
  { name: "Paul" },
  (cols) => Expr.equal(cols.id, Expr.external("1234")),
);
driver.exec(db, updateOp);

// Update with simple equality filter (shortcut)
const updateEqualOp = schema.tables.users.updateEqual(
  { name: "Paul" },
  { id: "1234" },
);
driver.exec(db, updateEqualOp);
```

### Delete

```ts
// Delete with custom condition
const deleteOp = schema.tables.users.delete((cols) =>
  Expr.equal(cols.id, Expr.external("1"))
);
driver.exec(db, deleteOp);

// Delete with simple equality filter (shortcut)
const deleteEqualOp = schema.tables.users.deleteEqual({ id: "1" });
driver.exec(db, deleteEqualOp);
```

## Queries

Build type-safe queries with the `.query()` method on any table:

```ts
const query = schema.tables.tasks.query()
  .andFilterEqual({ completed: false })
  .all();

const tasks = driver.exec(db, query);
```

### Query End Methods

Every query must end with a **terminal method** that defines how to retrieve
results:

- `.all()` - Returns all matching rows as an array
- `.maybeFirst()` - Returns first row or `null` (adds `LIMIT 1`)
- `.first()` - Returns first row or throws error if none
- `.maybeOne()` - Returns one row or `null`; throws error if more than one
- `.one()` - Returns exactly one row; throws error if 0 or >1 results
- `.count()` - Returns the count of matching rows as a number

```ts
// Get all users
const allUsers = schema.tables.users.query().all();

// Get one specific user (error if multiple found)
const user = schema.tables.users.query()
  .andFilterEqual({ id: "123" })
  .one();

// Get first result or null
const firstTask = schema.tables.tasks.query()
  .orderBy((c) => [c.title])
  .maybeFirst();
```

### Filtering

```ts
// Simple equality filter (automatically safe, like Expr.external)
const query = schema.tables.tasks.query()
  .andFilterEqual({ id: "1" })
  .one();

// Multiple filters (AND)
const query2 = schema.tables.tasks.query()
  .andFilterEqual({ completed: false })
  .andFilterEqual({ id: "1" })
  .maybeOne();

// Custom filter with where (use Expr.external for dynamic values)
const query3 = schema.tables.users.query()
  .where((c) =>
    Expr.or(
      Expr.equal(c.id, Expr.external("me")),
      Expr.equal(c.id, Expr.external("you")),
    )
  )
  .all();
```

### Selecting Columns

The `.select()` method lets you choose which columns to return and transform
them with expressions:

```ts
// Select specific columns
const userQuery = schema.tables.users.query()
  .select((c) => ({ id: c.id, name: c.name }))
  .all();
// SELECT users.id AS id, users.name AS name FROM users

// Using destructuring
const userQuery2 = schema.tables.users.query()
  .select(({ id, name }) => ({ id, name }))
  .all();

// Using expressions to transform data
const userQueryConcat = schema.tables.users.query()
  .select((c) => ({
    id: c.id,
    fullInfo: Expr.concatenate(c.name, c.email),
  }))
  .all();

// Without select(), all columns are returned
const allColumns = schema.tables.users.query().all();
// SELECT users.* FROM users
```

### Sorting and Limiting

```ts
// Order by column(s)
const orderedTasks = schema.tables.tasks.query()
  .orderBy((cols) => [cols.title])
  .all();

// Order ascending/descending
const sortedUsers = schema.tables.users.query()
  .andSortAsc((c) => c.name)
  .all();

// Limit results
const limitedTasks = schema.tables.tasks.query()
  .limit(Expr.external(10))
  .all();

// Pagination with offset
const paginatedTasks = schema.tables.tasks.query()
  .limit(Expr.external(10))
  .offset(Expr.external(20))
  .all();
```

### Grouping and Aggregation

```ts
// Group by with aggregation
const userCounts = schema.tables.users.query()
  .select((cols) => ({
    email: cols.email,
    count: Expr.Aggregate.count(cols.id),
  }))
  .groupBy((cols) => [cols.email])
  .all();

// Multiple aggregate functions
const taskStats = schema.tables.tasks.query()
  .select((c) => ({
    total: Expr.Aggregate.count(c.id),
    completed: Expr.Aggregate.sum(c.completed),
  }))
  .one();
```

## Expressions

> ⚠️ **Security Warning**: Always use `Expr.external()` for dynamic values to
> prevent SQL injection attacks. Never concatenate user input directly into SQL
> strings or use `Expr.literal()` with untrusted data.

Expressions are type-safe SQL fragments:

- Column: `users.id`
- Literal: `42`, `"hello"`
- Function: `COUNT(*)`
- Binary op: `a + b`
- External variable (parameter): `:_var`

### `Expr.external` - Safe Dynamic Values

The `Expr.external()` function is used to safely pass **dynamic values**
(variables) into your SQL queries.

#### What does it do?

`Expr.external()` creates a **SQL parameter placeholder** (like `:_id0`,
`:_var123`) that is sent to the database separately from the SQL string itself.
This is the standard way to prevent SQL injection attacks.

```ts
import { Expr } from "@dldc/zendb";

const userId = "user-123"; // Dynamic value from user input

const query = schema.tables.users.query()
  .where((c) => Expr.equal(c.id, Expr.external(userId)))
  .all();

console.log(query.sql);
// SELECT users.* FROM users WHERE users.id == :_hgJnoKSYKp

console.log(query.params);
// { _hgJnoKSYKp: "user-123" }
```

#### Why not just use the value directly?

**You should ALWAYS use `Expr.external()` for dynamic values!** Here's why:

```ts
// ❌ WRONG - Vulnerable to SQL injection if userId comes from user input
const badQuery = db.exec(`SELECT * FROM users WHERE id = '${userId}'`);

// ✅ CORRECT - Safe from SQL injection
const goodQuery = schema.tables.users.query()
  .where((c) => Expr.equal(c.id, Expr.external(userId)))
  .all();
```

Using `Expr.external()` ensures:

- **Protection from SQL injection** - Values are properly escaped
- **Type safety** - TypeScript validates the value type
- **Better performance** - Databases can cache prepared statements

#### When to use `Expr.external()` vs `Expr.literal()`

Use **`Expr.external()`** for:

- ✅ Variables and dynamic values
- ✅ User input
- ✅ Runtime values that change between queries
- ✅ Almost all cases (this is the safe default!)

Use **`Expr.literal()`** for:

- Static, hardcoded values known at compile time
- Constants that never change
- Values that must be in the SQL string itself (rare)

```ts
// Good: Use external for dynamic values
const limit = 10;
const query = schema.tables.tasks.query()
  .limit(Expr.external(limit))
  .all();

// Also valid: Use literal for truly static values
// (but external works fine too!)
const query2 = schema.tables.tasks.query()
  .limit(Expr.literal(10))
  .all();
```

**When in doubt, use `Expr.external()`** - it's always safe!

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

### Expression Functions

Many query methods accept **expression functions** - callbacks that receive
column references and return expressions. This provides type-safe access to
columns:

```ts
// where() takes an expression function
const meOrYou = schema.tables.users.query()
  .where((c) =>
    // c contains typed column references
    Expr.or(
      Expr.equal(c.id, Expr.external("me")),
      Expr.equal(c.id, Expr.external("you")),
    )
  )
  .all();

// select() uses an expression function to transform columns
const userEmails = schema.tables.users.query()
  .select((c) => ({ email: c.email }))
  .all();
```

### Common Expression Operations

ZenDB provides a rich set of expression operations through the `Expr` namespace:

```ts
// Comparison operators
Expr.equal(a, b); // a == b
Expr.notEqual(a, b); // a != b
Expr.lessThan(a, b); // a < b
Expr.lessThanOrEqual(a, b); // a <= b
Expr.greaterThan(a, b); // a > b
Expr.greaterThanOrEqual(a, b); // a >= b

// Logical operators
Expr.and(a, b); // a AND b
Expr.or(a, b); // a OR b
Expr.not(a); // NOT a

// Arithmetic operations
Expr.add(a, b); // a + b
Expr.subtract(a, b); // a - b
Expr.multiply(a, b); // a * b
Expr.divide(a, b); // a / b

// String operations
Expr.concatenate(a, b); // a || b (string concatenation)

// Aggregate functions
Expr.Aggregate.count(col); // COUNT(col)
Expr.Aggregate.countStar(); // COUNT(*)
Expr.Aggregate.sum(col); // SUM(col)
Expr.Aggregate.avg(col); // AVG(col)
Expr.Aggregate.min(col); // MIN(col)
Expr.Aggregate.max(col); // MAX(col)

// JSON functions (see JSON Operations section)
Expr.jsonObj(cols); // json_object(...)
Expr.jsonGroupArray(expr); // json_group_array(...)
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

When joining a query with aggregation or select, ZenDB automatically uses a CTE
(Common Table Expression):

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

## Advanced Features

### JSON Operations

ZenDB provides powerful JSON functions for working with structured data:

#### Creating JSON Objects

```ts
// Create JSON object from all columns
const query = schema.tables.users.query()
  .select((c) => ({
    id: c.id,
    userData: Expr.jsonObj(c),
  }))
  .all();
```

#### Aggregating to JSON Arrays

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

### Using [CTEs](https://en.wikipedia.org/wiki/Hierarchical_and_recursive_queries_in_SQL)

While ZenDB automatically creates CTEs when needed for joins, you can manually
create them using the `queryFrom()` function:

```ts
import { queryFrom } from "@dldc/zendb";

const aggregatedQuery = schema.tables.users
  .query()
  .select((cols) => ({ demo: cols.id, id: cols.id }))
  .groupBy((cols) => [cols.name]);

// Explicitly create a CTE from the query
const withCte = queryFrom(aggregatedQuery).all();
```

This generates:

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

### Database Utilities

The `Utils` namespace provides utility functions for database management:

#### Schema Operations

```ts
import { Schema, Utils } from "@dldc/zendb";

// Create all tables from schema
driver.execMany(
  db,
  Schema.createTables(schema.tables, { ifNotExists: true, strict: true }),
);

// List all tables in database
const tableNames = driver.exec(db, Utils.listTables());
console.log(tableNames); // ["users", "tasks", "groups"]
```

#### User Version (for migrations)

SQLite's `user_version` pragma is used to track migration state:

```ts
// Get current version
const version = driver.exec(db, Utils.userVersion());
console.log(version); // 0 for new database

// Set version (typically used by migration system)
driver.exec(db, Utils.setUserVersion(3));
```

## Migrations

ZenDB provides a **basic migration system** that helps you evolve your database
schema over time while preserving data. Migrations use SQLite's `user_version`
pragma to track which migrations have been applied.

> ⚠️ **Note**: This migration system is designed for simple use cases. For
> complex production scenarios, consider using a more feature-rich migration
> tool. See the [Migration FAQ](#migration-faq) below for limitations.

### Creating Migrations

Start by initializing a migration with your initial schema and a driver:

```ts
import { Column, Migration, Schema } from "@dldc/zendb";
import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";

const migration = Migration.init(
  DbSqliteDriver, // Pass your driver
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
    DbSqliteDriver.exec(
      database,
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
const migration = Migration.init(driver, initialSchema, initExec)
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

Apply migrations using the `.apply()` method. The driver handles database
creation and operations:

```ts
import { Database } from "@db/sqlite";

// Open your database
const db = new Database("my-database.db");

// Apply all pending migrations
// Returns a tuple: [migratedDb, needsPersist]
const [migratedDb, needsPersist] = await migration.apply(db);

// needsPersist is true if migrations were applied, false if already up-to-date
if (needsPersist) {
  // Save the migrated database to disk (this depends on your driver)
  const diskDb = new Database("my-database.db");
  migratedDb.backup(diskDb, "main", -1);
  diskDb.close();
}

migratedDb.close();
```

The migration system returns:

- **First element**: The migrated database instance
- **Second element**: Boolean indicating if you need to persist the database
  - `true` - Migrations were applied, the returned database is inMemory and
    needs to be saved
  - `false` - Database is already up-to-date, no persistence needed

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

const version = driver.exec(db, Utils.userVersion());
console.log(`Current database version: ${version}`);
```

#### Setting Version (Advanced)

```ts
// Manually set version (use with caution!)
driver.exec(db, Utils.setUserVersion(3));
```

### Migration FAQ

**Q: What happens if I run `migration.apply()` twice?**\
A: Migrations are idempotent. The system tracks which migrations have been
applied using SQLite's `user_version` pragma, so already-applied migrations are
automatically skipped. The second call will return `needsPersist: false`
indicating no changes were made.

**Q: Can I run migrations in parallel?**\
A: No. Migrations should always be run sequentially. The migration system is not
designed for concurrent execution.

**Q: How do I handle rollbacks?**\
A: ZenDB doesn't support automatic rollbacks. If you need to revert changes,
create a new migration step that reverses the previous changes.

**Q: Is this migration system production-ready?**\
A: The migration system is **basic and suitable for simple use cases**. For
complex production scenarios with multiple environments, consider:

- Backing up your database before migrations
- Testing migrations thoroughly on copies of production data
- Using a more feature-rich migration tool for critical applications
- The system does not support: rollbacks, branching, or migration conflict
  resolution

**Q: What happens if a migration fails?**\
A: The migration will throw an error and stop. The `user_version` will reflect
the last successfully completed migration. Fix the issue and run `apply()`
again.

### Migration Best Practices

1. **Check `needsPersist` flag**: Always check the second return value to know
   if you need to save the database to disk. This avoids unnecessary backup
   operations when the database is already up-to-date.

2. **Use in-memory for migrations**: Run migrations on an in-memory database
   first, then save to disk if needed. This is faster and safer than migrating
   directly on disk.

3. **Always use `copyTable`**: Don't manually query and insert data. The
   `copyTable` helper handles pagination automatically.

4. **Transform data carefully**: When adding non-nullable columns, provide
   default values in the transform function.

5. **Test migrations**: Always test migrations with a copy of production data
   before applying them.

6. **Keep migrations immutable**: Once a migration is deployed, don't modify it.
   Add new steps instead.

7. **Export final schema**: Export `migration.schema` so your application always
   uses the latest schema definition.

8. **Backup first**: Always backup your database before running migrations in
   production.

### Complete Migration Example

```ts
import { Column, Migration, Schema } from "@dldc/zendb";
import { DbSqliteDriver } from "@dldc/zendb-db-sqlite";

// Initial schema (version 1)
const migration = Migration.init(
  DbSqliteDriver,
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
const inMemoryDb = new Database(":memory:");
const [migratedDb, needsPersist] = await migration.apply(inMemoryDb);

// Save to disk if migrations were applied
if (needsPersist) {
  const diskDb = new Database("my-database.db");
  migratedDb.backup(diskDb, "main", -1);
  diskDb.close();
}
```

## Drivers

ZenDB uses a **Driver** pattern to support multiple SQLite libraries across
different environments. A driver is a simple object that knows how to execute
operations on your database instance.

### Available Drivers

| Environment | Driver Package               | SQLite Library                                                   |
| ----------- | ---------------------------- | ---------------------------------------------------------------- |
| **Deno**    | `@dldc/zendb-db-sqlite`      | [`@db/sqlite`](https://jsr.io/@db/sqlite)                        |
| **Node.js** | `@dldc/zendb-better-sqlite3` | [`better-sqlite3`](https://www.npmjs.com/package/better-sqlite3) |
| **Browser** | `@dldc/zendb-sqljs`          | [`sql.js`](https://www.npmjs.com/package/sql.js)                 |

### Why Drivers?

The Driver pattern provides several benefits:

- ✅ **Performance** - Uses prepared statements and supports cursors efficiently
- ✅ **Flexibility** - Works with Node.js, Deno, and Browser SQLite libraries
- ✅ **Direct Access** - You keep full control of your database instance
- ✅ **Type Safety** - Fully typed operations and results

### Creating a Custom Driver

If you need to use a different SQLite library, you can easily create your own
driver using the `Driver.createDriverFromPrepare` helper:

```ts
import { Driver } from "@dldc/zendb";
import type { Database } from "your-sqlite-library";

export const MyDriver = Driver.createDriverFromPrepare<Database>({
  exec: (db, sql) => db.exec(sql),
  prepare: (db, sql) => db.prepare(sql),
  createDatabase: () => new Database(":memory:"),
  closeDatabase: (db) => db.close(),
});
```

The driver requires four methods:

- `exec` - Execute SQL statements without returning results
- `prepare` - Prepare statements for parameterized queries
- `createDatabase` - Create new database instances (used by migrations)
- `closeDatabase` - Close database connections and release resources

The driver expects `prepare()` to return an object with:

- `run(params?)` - Execute a statement, returns number of affected rows
- `all(params?)` - Execute a query, returns array of result rows

### Advanced: Custom Operation Handling

For advanced use cases, you can implement a driver manually to have full control
over operation execution. This is useful when you need to:

- Optimize specific operation types (e.g., batch inserts)
- Add custom caching or connection pooling
- Support unique database features (e.g., cursors, streaming)
- Implement driver-specific performance optimizations

```ts
import type { TDriver, TOperation, TOperationResult } from "@dldc/zendb";
import type { Database } from "your-sqlite-library";

export const CustomDriver: TDriver<Database> = {
  exec<Op extends TOperation>(db: Database, op: Op): TOperationResult<Op> {
    // Handle each operation type explicitly
    if (op.kind === "Query") {
      // Example: Use cursor for large result sets
      const stmt = db.prepare(op.sql);
      const rows = op.params ? stmt.all(op.params) : stmt.all();
      return op.parse(rows) as TOperationResult<Op>;
    }

    if (op.kind === "Insert") {
      // Example: Use RETURNING clause if supported
      db.prepare(op.sql).run(op.params);
      return op.parse() as TOperationResult<Op>;
    }

    if (op.kind === "Update" || op.kind === "Delete") {
      const stmt = db.prepare(op.sql);
      const result = op.params ? stmt.run(op.params) : stmt.run();
      return op.parse({
        [op.kind === "Update" ? "updated" : "deleted"]: result.changes,
      }) as TOperationResult<Op>;
    }

    // Handle other operation types...
    throw new Error(`Unsupported operation: ${op.kind}`);
  },

  execMany<Op extends TOperation>(
    db: Database,
    ops: Op[],
  ): TOperationResult<Op>[] {
    // Example: Use transaction for multiple operations
    db.exec("BEGIN");
    try {
      const results = ops.map((op) => this.exec(db, op));
      db.exec("COMMIT");
      return results;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },

  createDatabase: () => new Database(":memory:"),

  closeDatabase: (db) => db.close(),
};
```

**Benefits of custom implementation:**

- **Performance**: Optimize hot paths with custom logic
- **Features**: Leverage database-specific capabilities
- **Control**: Full visibility into operation execution
- **Monitoring**: Add logging, metrics, or tracing

**When to use:**

- ✅ You need database-specific optimizations
- ✅ You're implementing a new driver for a different SQLite library
- ✅ You need transaction control or connection pooling
- ❌ Standard driver is usually sufficient for most use cases
