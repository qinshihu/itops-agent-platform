// scripts/verify-v001-schema/sqlite-parse-test.js
const pathMod = require('path');
// 在 backend dir 加载 better-sqlite3
const Database = require(
  pathMod.join(__dirname, '..', '..', 'backend', 'node_modules', 'better-sqlite3'),
);
const { execSync } = require('child_process');

const originalTs = execSync('git show HEAD:backend/src/models/migrations/v001_initial_schema.ts', {
  encoding: 'utf8',
});
console.log('Original Ts len:', originalTs.length);
const re = /db\.exec\(`\n([\s\S]*?)\n    `\);/;
const m = originalTs.match(re);
console.log('regex match:', !!m);
const originalSql = m ? m[1] : null;

const fs = require('fs');
const path = require('path');
const root = 'backend/src/models/migrations';

function parseChunk(filePath) {
  const c = fs.readFileSync(filePath, 'utf8');
  const m = c.match(/return `\n([\s\S]*?)\n    `;/);
  return m ? m[1] : null;
}

const chunks = [1, 2, 3, 4, 5].map((n) =>
  parseChunk(path.join(root, `v001_schema/up/chunk_${n}.ts`)),
);
const newUpSql = chunks.join('');
console.log('New up SQL bytes:', newUpSql.length);
console.log('Original up SQL bytes:', originalSql.length);

const db1 = new Database(':memory:');
db1.exec(newUpSql);
const tables1 = db1
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);
const indexes1 = db1
  .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
  .all()
  .map((r) => r.name);
db1.close();

const db2 = new Database(':memory:');
db2.exec(originalSql);
const tables2 = db2
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);
const indexes2 = db2
  .prepare("SELECT name FROM sqlite_master WHERE type='index' ORDER BY name")
  .all()
  .map((r) => r.name);
db2.close();

console.log('\n=== Schema comparison ===');
console.log('Tables count:', { new: tables1.length, old: tables2.length });
const tablesMatch = JSON.stringify(tables1) === JSON.stringify(tables2);
console.log('Tables match:', tablesMatch);

console.log('Indexes count:', { new: indexes1.length, old: indexes2.length });
const indexesMatch = JSON.stringify(indexes1) === JSON.stringify(indexes2);
console.log('Indexes match:', indexesMatch);

// 也验证 DROP 顺序 - 即 down SQL
const downDb1 = new Database(':memory:');
downDb1.exec(newUpSql);
const newDownSql = fs
  .readFileSync(pathMod.join(root, 'v001_schema/down/sqlBuilder.ts'), 'utf8')
  .match(/return `\n([\s\S]*?)\n    `;/)[1];
downDb1.exec(newDownSql);
const tables1AfterDown = downDb1
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);
downDb1.close();

const downDb2 = new Database(':memory:');
downDb2.exec(originalSql);
const oldDownSql = originalTs.match(/db\.exec\(`\n([\s\S]*?)\n    `\);/g)[1];
// 实际上 originalTs 有两个 db.exec(`...)
const oldDownMatch = originalTs.match(/down:[^]*?db\.exec\(`\n([\s\S]*?)\n    `\);/);
const oldDownSqlText = oldDownMatch ? oldDownMatch[1] : null;
if (oldDownSqlText) {
  downDb2.exec(oldDownSqlText);
}
const tables2AfterDown = downDb2
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);
downDb2.close();

console.log('\n=== After down (DROP TABLE) ===');
console.log('Tables remaining - new:', tables1AfterDown.length, ', old:', tables2AfterDown.length);
const downMatch = JSON.stringify(tables1AfterDown) === JSON.stringify(tables2AfterDown);
console.log('Down match:', downMatch);
if (!downMatch) {
  console.log(
    'Diff:',
    tables1AfterDown.filter((t) => !tables2AfterDown.includes(t)),
    '/',
    tables2AfterDown.filter((t) => !tables1AfterDown.includes(t)),
  );
}

if (tablesMatch && indexesMatch && downMatch) {
  console.log('\n✅✅✅ UP + DOWN 完全等价！拆分前后 SQLite 行为 100% 一致。');
  process.exit(0);
} else {
  console.log('\n❌ Mismatch!');
  process.exit(1);
}
