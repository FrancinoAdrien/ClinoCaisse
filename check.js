
const fs = require('fs');
const migrations = fs.readFileSync('src/main/database/migrations.js', 'utf8');
const supabase = fs.readFileSync('supabase_schema.sql', 'utf8');

const regex = /\{\s*table:\s*'([^']+)',\s*col:\s*'([^']+)'/g;
let match;
let missing = [];

const tables = supabase.split('CREATE TABLE IF NOT EXISTS ').slice(1);
const schemaMap = {};
for (const t of tables) {
  const parts = t.split('(');
  const tableName = parts[0].trim();
  const def = parts.slice(1).join('(');
  schemaMap[tableName] = def;
}

while ((match = regex.exec(migrations)) !== null) {
  const table = match[1];
  const col = match[2];
  
  if (!schemaMap[table]) {
    missing.push('TABLE: ' + table);
  } else {
    if (!schemaMap[table].includes(col)) {
      missing.push(table + '.' + col);
    }
  }
}

console.log(JSON.stringify([...new Set(missing)], null, 2));

