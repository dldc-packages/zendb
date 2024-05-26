import { Database } from "@db/sqlite";

const db = new Database(":memory:");

const stmt = db.prepare(`SELECT json('{"hey": 42}') as a`);

const res = stmt.get();

console.log(res);
