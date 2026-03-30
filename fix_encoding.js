const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// Fix corrupted characters
const replacements = [
    // Export CSV button
    ['â¬‡ï¸ Export CSV', 'Export CSV'],
    ['âœ" Apply', 'Apply'],
    // Other common corrupted sequences
    ['âœ"', ''],
    ['â', ''],
    ['ï¸', ''],
    ['â†', '←'],
    ['âŒ', ''],
    ['✓', ''],
    // Clean up any remaining weird sequences in buttons
];

for (const [from, to] of replacements) {
    if (content.includes(from)) {
        content = content.split(from).join(to);
        console.log(`Replaced: "${from}" -> "${to}"`);
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Character cleanup complete');
