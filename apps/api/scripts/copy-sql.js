const { copyFileSync, mkdirSync, readdirSync } = require('fs');
const { join } = require('path');

// tsc ne copie pas les .sql : ils sont requis au runtime par migrate/harden.
const from = join(__dirname, '..', 'src', 'db');
const to = join(__dirname, '..', 'dist', 'db');

mkdirSync(to, { recursive: true });
for (const file of readdirSync(from).filter((f) => f.endsWith('.sql'))) {
  copyFileSync(join(from, file), join(to, file));
}
