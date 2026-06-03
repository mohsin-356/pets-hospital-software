const fs = require('fs');
const path = 'package.json';

let content = fs.readFileSync(path, 'utf8');

// Fix the double quote issue on line 18
content = content.replace(/main\.cjs\\"\\",/g, 'main.cjs\\",');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed package.json double quote error');
