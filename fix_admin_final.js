const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove the misplaced code from the Firebase script tag
const startMarker = '// Expose load functions globally for sidebar navigation';
const endMarker = 'if (typeof loadAnnouncementsTab === \'function\') window.loadAnnouncementsTab = loadAnnouncementsTab;';

const startIndex = content.indexOf(startMarker);
if (startIndex !== -1) {
    // Find the end of this block. It's likely adjacent lines.
    // The previous view showed it went from line 12 to... let's check content length
    // Easier: regex replace the whole block if possible, or just exact string matching for safety

    // Let's just remove the specific lines we saw
    const lines = content.split('\n');
    const newLines = lines.filter(line => {
        return !line.includes('if (typeof loadStudents === \'function\') window.loadStudents') &&
            !line.includes('// Expose load functions globally') &&
            !line.includes('window.loadHistory = loadHistory') &&
            !line.includes('window.loadPendingInvites') &&
            !line.includes('window.initLinkTab') &&
            !line.includes('window.loadRegisteredUsers') &&
            !line.includes('window.loadSessionInfo') &&
            !line.includes('window.loadArchivedStudents') &&
            !line.includes('window.loadSettings') &&
            !line.includes('window.loadClasses') &&
            !line.includes('window.loadAnnouncementsTab');
    });
    content = newLines.join('\n');
    console.log('Removed misplaced global exports');
}

// 2. Fix the syntax error
// alert("Invite Link copied to clipboard!  + link); -> alert("Invite Link copied to clipboard! " + link);
content = content.replace(
    'alert("Invite Link copied to clipboard!  + link);',
    'alert("Invite Link copied to clipboard! " + link);'
);
console.log('Fixed syntax error');

// 3. Clean up corrupted characters
content = content.replace(/â °/g, '⏰');
content = content.replace(/âš ï¸/g, '⚠️');
content = content.replace(/â Œ/g, '❌');
content = content.replace(/â†/g, '←');
// Fix the "Back to Home" arrow specifically if it persisted as box
content = content.replace(/← □/g, '←');

// 4. Append global exports to the END of the main script
// Find the last </script> tag
const lastScriptIndex = content.lastIndexOf('</script>');
if (lastScriptIndex !== -1) {
    const exports = `
    // Expose functions globally for sidebar navigation
    window.loadStudents = loadStudents;
    window.loadHistory = loadHistory; 
    window.loadPendingInvites = loadPendingInvites;
    window.initLinkTab = initLinkTab;
    window.loadRegisteredUsers = loadRegisteredUsers;
    window.loadSessionInfo = loadSessionInfo;
    window.loadArchivedStudents = loadArchivedStudents;
    window.loadSettings = loadSettings;
    window.loadClasses = loadClasses;
    window.loadAnnouncementsTab = loadAnnouncementsTab;
    `;

    content = content.substring(0, lastScriptIndex) + exports + content.substring(lastScriptIndex);
    console.log('Appended global exports correctly');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Final fix applied');
