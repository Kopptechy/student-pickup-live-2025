const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// Use a more generic search for the firestore script line
const firestoreScriptPart = 'firebase-firestore-compat.js';
const index = content.indexOf(firestoreScriptPart);

if (index !== -1) {
    // Find the end of this script tag
    const endTag = '</script>';
    const initEndIndex = content.indexOf(endTag, index);

    if (initEndIndex !== -1) {
        const insertionPoint = initEndIndex + endTag.length;
        // Inject the config script
        content = content.substring(0, insertionPoint) + '\n    <script src="firebase-config.js"></script>' + content.substring(insertionPoint);
        fs.writeFileSync(path, content, 'utf8');
        console.log('Injected firebase-config.js');
    } else {
        console.log('Could not find closing script tag');
    }
} else {
    console.log('Could not find firestore script');
}
