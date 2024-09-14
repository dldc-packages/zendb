import { Column, Table } from "../../mod.ts";

export const tasksDb = Table.declareMany({
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
