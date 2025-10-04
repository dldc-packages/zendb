import { assertEquals } from "@std/assert";
import { expect } from "@std/expect";
import { Column, Database, Migration, Schema } from "../mod.ts";
import { tasksDb } from "./utils/tasksDb.ts";
import { TestDatabase } from "./utils/TestDatabase.ts";

const migration = Migration.initMigration(
  tasksDb,
  ({ database, schema }) => {
    // Insert some groups
    database.exec(schema.tables.groups.insertMany([
      { id: "group1", name: "Group 1" },
      { id: "group2", name: "Group 2" },
    ]));

    // Insert some users
    database.exec(schema.tables.users.insertMany([
      {
        id: "user1",
        name: "User 1",
        email: "user1@example.com",
        displayName: null,
        groupId: "group1",
        updatedAt: null,
      },
      {
        id: "user2",
        name: "User 2",
        email: "user2@example.com",
        displayName: null,
        groupId: "group1",
        updatedAt: null,
      },
      {
        id: "user3",
        name: "User 3",
        email: "user3@example.com",
        displayName: null,
        groupId: "group2",
        updatedAt: null,
      },
    ]));

    // Insert some tasks
    database.exec(schema.tables.tasks.insertMany([
      {
        id: "task1",
        title: "Task 1",
        description: "Description 1",
        completed: false,
      },
      {
        id: "task2",
        title: "Task 2",
        description: "Description 2",
        completed: false,
      },
      {
        id: "task3",
        title: "Task 3",
        description: "Description 3",
        completed: false,
      },
    ]));

    return Promise.resolve();
  },
)
  // add user.archived
  .step((schema) =>
    Schema.declare({
      ...schema.definition,
      users: {
        ...schema.tables.users.definition,
        archived: Column.boolean(),
      },
    })
  )(({ copyTable }) => {
    copyTable("users", "users", (r) => ({ ...r, archived: false }));
    copyTable("tasks", "tasks", (r) => r);
    copyTable("groups", "groups", (r) => r);
    copyTable("joinUsersTasks", "joinUsersTasks", (r) => r);

    return Promise.resolve();
  });

Deno.test("migration adds archived column and sets default value", async () => {
  // Run migration

  const resultDb = await migration.apply({
    currentDatabase: TestDatabase.create(),
    createTempDatabase: () => Promise.resolve(TestDatabase.create()),
    saveDatabase: (db) => Promise.resolve(db),
  });

  // Query users table
  const users = resultDb.exec(migration.schema.tables.users.query().all());
  assertEquals(users.length, 3);

  // Check that archived column exists and is false for all users
  for (const user of users) {
    assertEquals(user.archived, false);
  }
});

Deno.test("throw if userVersion is higher than max expected version", async () => {
  // Run migration

  const currentDatabase = TestDatabase.create();
  currentDatabase.exec(Database.setUserVersion(10));

  await expect(migration.apply({
    currentDatabase,
    createTempDatabase: () => Promise.resolve(TestDatabase.create()),
    saveDatabase: (db) => Promise.resolve(db),
  })).rejects.toThrow(/Invalid user version in migration: 10, max expected: 2/);
});
