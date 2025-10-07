import { Database } from "@db/sqlite";
import { assertEquals } from "@std/assert";
import { expect } from "@std/expect";
import { Column, Migration, Schema, Utils } from "../mod.ts";
import { tasksDb } from "./utils/tasksDb.ts";
import { TestDriver } from "./utils/TestDriver.ts";

const migration = Migration.init(
  TestDriver,
  tasksDb,
  ({ database, schema }) => {
    // Insert some groups
    TestDriver.exec(
      database,
      schema.tables.groups.insertMany([
        { id: "group1", name: "Group 1" },
        { id: "group2", name: "Group 2" },
      ]),
    );

    // Insert some users
    TestDriver.exec(
      database,
      schema.tables.users.insertMany([
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
      ]),
    );

    // Insert some tasks
    TestDriver.exec(
      database,
      schema.tables.tasks.insertMany([
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
      ]),
    );

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

  const [resultDb, needsPersist] = await migration.apply(
    new Database(":memory:"),
  );
  assertEquals(needsPersist, true, "Should need to persist after migration");

  // Query users table
  const users = TestDriver.exec(
    resultDb,
    migration.schema.tables.users.query().all(),
  );
  assertEquals(users.length, 3);

  // Check that archived column exists and is false for all users
  for (const user of users) {
    assertEquals(user.archived, false);
  }
});

Deno.test("throw if userVersion is higher than max expected version", async () => {
  // Run migration

  const currentDatabase = new Database(":memory:");
  TestDriver.exec(currentDatabase, Utils.setUserVersion(10));

  await expect(migration.apply(currentDatabase)).rejects.toThrow(
    /Invalid user version in migration: 10, max expected: 2/,
  );
});

Deno.test("migration is idempotent - applying multiple times has same result", async () => {
  const db = new Database(":memory:");

  // Apply migration first time
  const [db1, needsPersist1] = await migration.apply(db);
  assertEquals(
    needsPersist1,
    true,
    "Should need to persist after first migration",
  );
  const users1 = TestDriver.exec(
    db1,
    migration.schema.tables.users.query().all(),
  );
  assertEquals(users1.length, 3);

  // Apply migration second time (should be no-op)
  const [db2, needsPersist2] = await migration.apply(db1);
  assertEquals(
    needsPersist2,
    false,
    "Should not need to persist when no migration runs",
  );
  const users2 = TestDriver.exec(
    db2,
    migration.schema.tables.users.query().all(),
  );
  assertEquals(users2.length, 3);

  // Verify user version is correct
  const version = TestDriver.exec(db2, Utils.userVersion());
  assertEquals(version, 2);
});

Deno.test("migration with multiple steps preserves data", async () => {
  const multiStepMigration = Migration.init(
    TestDriver,
    Schema.declare({
      items: {
        id: Column.text().primary(),
        name: Column.text(),
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.items.insertMany([
          { id: "1", name: "Item 1" },
          { id: "2", name: "Item 2" },
        ]),
      );
      return Promise.resolve();
    },
  )
    // Step 1: Add description column
    .step((schema) =>
      Schema.declare({
        items: {
          ...schema.tables.items.definition,
          description: Column.text(),
        },
      })
    )(({ copyTable }) => {
      copyTable("items", "items", (r) => ({
        ...r,
        description: `Description for ${r.name}`,
      }));
      return Promise.resolve();
    })
    // Step 2: Add price column
    .step((schema) =>
      Schema.declare({
        items: {
          ...schema.tables.items.definition,
          price: Column.integer(),
        },
      })
    )(({ copyTable }) => {
      copyTable("items", "items", (r) => ({
        ...r,
        price: 100,
      }));
      return Promise.resolve();
    });

  const [resultDb, needsPersist] = await multiStepMigration.apply(
    new Database(":memory:"),
  );
  assertEquals(needsPersist, true);

  const items = TestDriver.exec(
    resultDb,
    multiStepMigration.schema.tables.items.query().all(),
  );

  assertEquals(items.length, 2);
  assertEquals(items[0], {
    id: "1",
    name: "Item 1",
    description: "Description for Item 1",
    price: 100,
  });
  assertEquals(items[1], {
    id: "2",
    name: "Item 2",
    description: "Description for Item 2",
    price: 100,
  });

  // Verify user version
  const version = TestDriver.exec(resultDb, Utils.userVersion());
  assertEquals(version, 3);
});

Deno.test("migration can apply from intermediate version", async () => {
  const multiStepMigration = Migration.init(
    TestDriver,
    Schema.declare({
      products: {
        id: Column.text().primary(),
        title: Column.text(),
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.products.insertMany([
          { id: "p1", title: "Product 1" },
        ]),
      );
      return Promise.resolve();
    },
  )
    .step((schema) =>
      Schema.declare({
        products: {
          ...schema.tables.products.definition,
          category: Column.text(),
        },
      })
    )(({ copyTable }) => {
      copyTable("products", "products", (r) => ({ ...r, category: "default" }));
      return Promise.resolve();
    })
    .step((schema) =>
      Schema.declare({
        products: {
          ...schema.tables.products.definition,
          inStock: Column.boolean(),
        },
      })
    )(({ copyTable }) => {
      copyTable("products", "products", (r) => ({ ...r, inStock: true }));
      return Promise.resolve();
    });

  // First apply up to version 2
  const [db1] = await multiStepMigration.apply(new Database(":memory:"));
  const version1 = TestDriver.exec(db1, Utils.userVersion());
  assertEquals(version1, 3);

  // Create a new database at version 2 by running init + first step manually
  const partialMigration = Migration.init(
    TestDriver,
    Schema.declare({
      products: {
        id: Column.text().primary(),
        title: Column.text(),
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.products.insertMany([
          { id: "p1", title: "Product 1" },
        ]),
      );
      return Promise.resolve();
    },
  )
    .step((schema) =>
      Schema.declare({
        products: {
          ...schema.tables.products.definition,
          category: Column.text(),
        },
      })
    )(({ copyTable }) => {
      copyTable("products", "products", (r) => ({ ...r, category: "default" }));
      return Promise.resolve();
    });

  const [intermediateDb] = await partialMigration.apply(
    new Database(":memory:"),
  );
  const version2 = TestDriver.exec(intermediateDb, Utils.userVersion());
  assertEquals(version2, 2);

  // Now apply the full migration which should only run the last step
  const [resultDb, needsPersist] = await multiStepMigration.apply(
    intermediateDb,
  );
  assertEquals(
    needsPersist,
    true,
    "Should need to persist after applying remaining step",
  );

  const products = TestDriver.exec(
    resultDb,
    multiStepMigration.schema.tables.products.query().all(),
  );

  assertEquals(products.length, 1);
  assertEquals(products[0], {
    id: "p1",
    title: "Product 1",
    category: "default",
    inStock: true,
  });

  const version = TestDriver.exec(resultDb, Utils.userVersion());
  assertEquals(version, 3);
});

Deno.test("migration with table rename via copyTable", async () => {
  const renameMigration = Migration.init(
    TestDriver,
    Schema.declare({
      old_table: {
        id: Column.text().primary(),
        value: Column.text(),
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.old_table.insertMany([
          { id: "1", value: "data1" },
          { id: "2", value: "data2" },
        ]),
      );
      return Promise.resolve();
    },
  )
    .step(() =>
      Schema.declare({
        new_table: {
          id: Column.text().primary(),
          value: Column.text(),
        },
      })
    )(({ copyTable }) => {
      copyTable("old_table", "new_table", (r) => r);
      return Promise.resolve();
    });

  const [resultDb] = await renameMigration.apply(new Database(":memory:"));

  const rows = TestDriver.exec(
    resultDb,
    renameMigration.schema.tables.new_table.query().all(),
  );

  assertEquals(rows.length, 2);
  assertEquals(rows[0], { id: "1", value: "data1" });
  assertEquals(rows[1], { id: "2", value: "data2" });
});

Deno.test("migration with column removal", async () => {
  const removeColumnMigration = Migration.init(
    TestDriver,
    Schema.declare({
      records: {
        id: Column.text().primary(),
        name: Column.text(),
        deprecated: Column.text(),
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.records.insertMany([
          { id: "1", name: "Record 1", deprecated: "old data" },
        ]),
      );
      return Promise.resolve();
    },
  )
    .step(() =>
      Schema.declare({
        records: {
          id: Column.text().primary(),
          name: Column.text(),
        },
      })
    )(({ copyTable }) => {
      copyTable("records", "records", (r) => ({
        id: r.id,
        name: r.name,
      }));
      return Promise.resolve();
    });

  const [resultDb] = await removeColumnMigration.apply(
    new Database(":memory:"),
  );

  const records = TestDriver.exec(
    resultDb,
    removeColumnMigration.schema.tables.records.query().all(),
  );

  assertEquals(records.length, 1);
  assertEquals(records[0], { id: "1", name: "Record 1" });
  // Verify 'deprecated' column is not present
  assertEquals(Object.keys(records[0]), ["id", "name"]);
});

Deno.test("migration with data transformation", async () => {
  const transformMigration = Migration.init(
    TestDriver,
    Schema.declare({
      prices: {
        id: Column.text().primary(),
        amount: Column.text(), // Initially stored as text
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.prices.insertMany([
          { id: "1", amount: "10.50" },
          { id: "2", amount: "25.99" },
        ]),
      );
      return Promise.resolve();
    },
  )
    .step(() =>
      Schema.declare({
        prices: {
          id: Column.text().primary(),
          amount: Column.integer(), // Convert to integer (cents)
        },
      })
    )(({ copyTable }) => {
      copyTable("prices", "prices", (r) => ({
        id: r.id,
        amount: Math.round(parseFloat(r.amount) * 100),
      }));
      return Promise.resolve();
    });

  const [resultDb] = await transformMigration.apply(new Database(":memory:"));

  const prices = TestDriver.exec(
    resultDb,
    transformMigration.schema.tables.prices.query().all(),
  );

  assertEquals(prices.length, 2);
  assertEquals(prices[0], { id: "1", amount: 1050 }); // 10.50 * 100
  assertEquals(prices[1], { id: "2", amount: 2599 }); // 25.99 * 100
});

Deno.test("migration with new table added", async () => {
  const addTableMigration = Migration.init(
    TestDriver,
    Schema.declare({
      primary_table: {
        id: Column.text().primary(),
        data: Column.text(),
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.primary_table.insertMany([
          { id: "1", data: "test" },
        ]),
      );
      return Promise.resolve();
    },
  )
    .step((schema) =>
      Schema.declare({
        primary_table: schema.tables.primary_table.definition,
        secondary_table: {
          id: Column.text().primary(),
          foreignId: Column.text(),
          info: Column.text(),
        },
      })
    )(({ copyTable, database, schema }) => {
      copyTable("primary_table", "primary_table", (r) => r);

      // Populate new table based on existing data
      TestDriver.exec(
        database,
        schema.tables.secondary_table.insertMany([
          { id: "s1", foreignId: "1", info: "related data" },
        ]),
      );

      return Promise.resolve();
    });

  const [resultDb] = await addTableMigration.apply(new Database(":memory:"));

  const primaryData = TestDriver.exec(
    resultDb,
    addTableMigration.schema.tables.primary_table.query().all(),
  );
  const secondaryData = TestDriver.exec(
    resultDb,
    addTableMigration.schema.tables.secondary_table.query().all(),
  );

  assertEquals(primaryData.length, 1);
  assertEquals(primaryData[0], { id: "1", data: "test" });
  assertEquals(secondaryData.length, 1);
  assertEquals(secondaryData[0], {
    id: "s1",
    foreignId: "1",
    info: "related data",
  });
});

Deno.test("migration with nullable column becoming required", async () => {
  const nullableToRequiredMigration = Migration.init(
    TestDriver,
    Schema.declare({
      entries: {
        id: Column.text().primary(),
        title: Column.text(),
        optional_field: Column.text().nullable(),
      },
    }),
    ({ database, schema }) => {
      TestDriver.exec(
        database,
        schema.tables.entries.insertMany([
          { id: "1", title: "Entry 1", optional_field: "has value" },
          { id: "2", title: "Entry 2", optional_field: null },
        ]),
      );
      return Promise.resolve();
    },
  )
    .step(() =>
      Schema.declare({
        entries: {
          id: Column.text().primary(),
          title: Column.text(),
          optional_field: Column.text(), // No longer nullable
        },
      })
    )(({ copyTable }) => {
      copyTable("entries", "entries", (r) => ({
        id: r.id,
        title: r.title,
        optional_field: r.optional_field ?? "default value", // Provide default for nulls
      }));
      return Promise.resolve();
    });

  const [resultDb] = await nullableToRequiredMigration.apply(
    new Database(":memory:"),
  );

  const entries = TestDriver.exec(
    resultDb,
    nullableToRequiredMigration.schema.tables.entries.query().all(),
  );

  assertEquals(entries.length, 2);
  assertEquals(entries[0], {
    id: "1",
    title: "Entry 1",
    optional_field: "has value",
  });
  assertEquals(entries[1], {
    id: "2",
    title: "Entry 2",
    optional_field: "default value",
  });
});

Deno.test("migration with empty table", async () => {
  const emptyTableMigration = Migration.init(
    TestDriver,
    Schema.declare({
      empty: {
        id: Column.text().primary(),
        value: Column.text(),
      },
    }),
    () => {
      // Don't insert any data
      return Promise.resolve();
    },
  )
    .step((schema) =>
      Schema.declare({
        empty: {
          ...schema.tables.empty.definition,
          newField: Column.text(),
        },
      })
    )(({ copyTable }) => {
      copyTable("empty", "empty", (r) => ({
        ...r,
        newField: "default",
      }));
      return Promise.resolve();
    });

  const [resultDb] = await emptyTableMigration.apply(new Database(":memory:"));

  const rows = TestDriver.exec(
    resultDb,
    emptyTableMigration.schema.tables.empty.query().all(),
  );

  assertEquals(rows.length, 0);

  // Verify table structure by inserting a row
  TestDriver.exec(
    resultDb,
    emptyTableMigration.schema.tables.empty.insert({
      id: "1",
      value: "test",
      newField: "value",
    }),
  );

  const newRows = TestDriver.exec(
    resultDb,
    emptyTableMigration.schema.tables.empty.query().all(),
  );

  assertEquals(newRows.length, 1);
  assertEquals(newRows[0], { id: "1", value: "test", newField: "value" });
});

Deno.test("migration with disk-based database persists data across connections", async (t) => {
  // Create a temporary database file path
  const tempDir = await Deno.makeTempDir();
  const dbPath = `${tempDir}/test.db`;

  try {
    // Define a simple migration
    const diskMigration = Migration.init(
      TestDriver,
      Schema.declare({
        inventory: {
          id: Column.text().primary(),
          name: Column.text(),
          quantity: Column.integer(),
        },
      }),
      ({ database, schema }) => {
        TestDriver.exec(
          database,
          schema.tables.inventory.insertMany([
            { id: "item1", name: "Widget", quantity: 10 },
            { id: "item2", name: "Gadget", quantity: 5 },
          ]),
        );
        return Promise.resolve();
      },
    )
      .step((schema) =>
        Schema.declare({
          inventory: {
            ...schema.tables.inventory.definition,
            price: Column.integer(),
          },
        })
      )(({ copyTable }) => {
        copyTable("inventory", "inventory", (r) => ({
          ...r,
          price: 1000, // Default price
        }));
        return Promise.resolve();
      });

    await t.step("apply migration and save to disk", async () => {
      const initialDb = new Database(":memory:");
      const [migratedDb, needsPersist] = await diskMigration.apply(initialDb);
      assertEquals(
        needsPersist,
        true,
        "Should need to persist after migration",
      );

      const version1 = TestDriver.exec(migratedDb, Utils.userVersion());
      assertEquals(version1, 2, "Should be at version 2 after migration");

      const items1 = TestDriver.exec(
        migratedDb,
        diskMigration.schema.tables.inventory.query().all(),
      );
      assertEquals(items1.length, 2);
      assertEquals(items1[0], {
        id: "item1",
        name: "Widget",
        quantity: 10,
        price: 1000,
      });

      // Insert additional data
      TestDriver.exec(
        migratedDb,
        diskMigration.schema.tables.inventory.insert({
          id: "item3",
          name: "Doohickey",
          quantity: 15,
          price: 500,
        }),
      );

      // Verify insertion
      const itemsAfterInsert = TestDriver.exec(
        migratedDb,
        diskMigration.schema.tables.inventory.query().all(),
      );
      assertEquals(
        itemsAfterInsert.length,
        3,
        "Should have 3 items after insert",
      );

      // Save the migrated database to disk only if needed
      if (needsPersist) {
        const diskDb = new Database(dbPath);
        migratedDb.backup(diskDb, "main", -1);
        diskDb.close();
      }
      migratedDb.close();
    });

    await t.step("reopen database and verify persistence", () => {
      const db2 = new Database(dbPath);

      // Check version persists
      const version2 = TestDriver.exec(db2, Utils.userVersion());
      assertEquals(
        version2,
        2,
        "Version should persist from previous connection",
      );

      // Read data directly (without migration apply, since it's already migrated)
      const items2 = TestDriver.exec(
        db2,
        diskMigration.schema.tables.inventory.query().all(),
      );
      assertEquals(items2.length, 3, "All data should persist");
      assertEquals(items2[0], {
        id: "item1",
        name: "Widget",
        quantity: 10,
        price: 1000,
      });
      assertEquals(items2[2], {
        id: "item3",
        name: "Doohickey",
        quantity: 15,
        price: 500,
      });

      // Add more data
      TestDriver.exec(
        db2,
        diskMigration.schema.tables.inventory.insert({
          id: "item4",
          name: "Thingamajig",
          quantity: 20,
          price: 750,
        }),
      );

      db2.close();
    });

    await t.step("verify idempotent migration preserves data", async () => {
      const db3 = new Database(dbPath);

      // Apply migration again - should be no-op since version is already 2
      const [migratedDb3, needsPersist3] = await diskMigration.apply(db3);
      assertEquals(
        needsPersist3,
        false,
        "Should not need to persist when no migration runs",
      );

      const version3 = TestDriver.exec(migratedDb3, Utils.userVersion());
      assertEquals(version3, 2, "Version should remain at 2 (no re-migration)");

      const items3 = TestDriver.exec(
        migratedDb3,
        diskMigration.schema.tables.inventory.query().all(),
      );

      // When migration is idempotent and no steps need to run,
      // it returns the same database with existing data preserved
      assertEquals(
        items3.length,
        4,
        "All data should persist including new item",
      );
      assertEquals(items3[3], {
        id: "item4",
        name: "Thingamajig",
        quantity: 20,
        price: 750,
      });

      migratedDb3.close();
    });
  } finally {
    // Cleanup: Remove temporary directory and database file
    try {
      await Deno.remove(tempDir, { recursive: true });
    } catch {
      // Ignore cleanup errors
    }
  }
});
