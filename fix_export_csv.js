const fs = require('fs');

let content = fs.readFileSync('public/admin.html', 'utf8');

// Find and replace the Export CSV button text - match anything before "Export CSV"
content = content.replace(/>([^<]*?)Export CSV<\/button>/g, '>📥 Export CSV</button>');

fs.writeFileSync('public/admin.html', content, 'utf8');
console.log('Fixed Export CSV button');
