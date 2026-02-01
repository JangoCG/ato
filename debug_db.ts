
import { Database } from "bun:sqlite";
import { join } from "path";
import { homedir } from "os";

const dbPath = join(homedir(), ".cache", "qmd", "index.sqlite");
const db = new Database(dbPath);

const rows = db.prepare("SELECT collection, COUNT(*) as count FROM documents GROUP BY collection").all();
console.log("Documents per collection:");
console.table(rows);

const activeRows = db.prepare("SELECT collection, COUNT(*) as count FROM documents WHERE active = 1 GROUP BY collection").all();
console.log("\nActive documents per collection:");
console.table(activeRows);

// Check FTS content
const ftsCount = db.prepare("SELECT COUNT(*) as count FROM documents_fts").get();
console.log("\nFTS total count:", ftsCount);

db.close();
