const fs = require('fs');
const content = fs.readFileSync('public/admin.html', 'utf8');
const lines = content.split('\n');

let depth = 0;
let divStack = []; // Store line numbers of opening divs

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Count opening divs
    const matchesOpen = (line.match(/<div/g) || []).length;
    // Count closing divs
    const matchesClose = (line.match(/<\/div>/g) || []).length;

    // Adjust depth
    if (matchesOpen > 0 || matchesClose > 0) {
        let diff = matchesOpen - matchesClose;
        depth += diff;
        console.log(`Line ${i + 1}: Depth ${depth} (Delta ${diff}) | ${line.trim()}`);

        if (depth < 0) {
            console.error(`ERROR: Negative depth at line ${i + 1}`);
            break;
        }
    }
}
console.log(`Final depth: ${depth}`);
