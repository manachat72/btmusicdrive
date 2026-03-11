const fs = require('fs');
let env = fs.readFileSync('.env', 'utf8');
const newUrl = 'postgresql://neondb_owner:npg_T7vINkiA1OEc@ep-cold-forest-a1ep8tyd.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
env = env.replace(/DATABASE_URL=".*?"/, `DATABASE_URL="${newUrl}"`);
fs.writeFileSync('.env', env);
console.log('.env updated successfully');
