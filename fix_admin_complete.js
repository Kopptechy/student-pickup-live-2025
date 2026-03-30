const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// Step 1: Remove the early switchTab script (from </nav> to <!-- Main Content Area -->)
const navEnd = content.indexOf('</nav>');
const mainContentComment = content.indexOf('<!-- Main Content Area -->');

if (navEnd !== -1 && mainContentComment !== -1 && mainContentComment > navEnd) {
    // Keep the </nav> and <!-- Main Content Area --> but remove everything in between
    content = content.substring(0, navEnd + 6) + '\n\n        ' + content.substring(mainContentComment);
    console.log('Removed early switchTab script');
}

// Step 2: Find the main switchTab function and make it global by adding window.switchTab = switchTab after its closing brace
// The main switchTab is defined as "function switchTab(tabName) {" and we need to find its end

const switchTabDef = 'function switchTab(tabName) {';
const switchTabIndex = content.indexOf(switchTabDef);

if (switchTabIndex !== -1) {
    // Find where this function ends by counting braces
    let braceCount = 0;
    let inFunction = false;
    let endIndex = -1;

    for (let i = switchTabIndex; i < content.length; i++) {
        if (content[i] === '{') {
            braceCount++;
            inFunction = true;
        } else if (content[i] === '}') {
            braceCount--;
            if (inFunction && braceCount === 0) {
                endIndex = i + 1;
                break;
            }
        }
    }

    if (endIndex !== -1) {
        // Insert window.switchTab = switchTab; after the function
        const addition = '\n        window.switchTab = switchTab; // Expose to global scope for sidebar\n';
        content = content.substring(0, endIndex) + addition + content.substring(endIndex);
        console.log('Made switchTab globally accessible');
    }
}

// Step 3: Also expose all the load functions to window
const loadFunctionsToExpose = [
    'loadStudents',
    'loadHistory',
    'loadPendingInvites',
    'initLinkTab',
    'loadRegisteredUsers',
    'loadSessionInfo',
    'loadArchivedStudents',
    'loadSettings',
    'loadClasses',
    'loadAnnouncementsTab'
];

// Find the closing </script> tag of the main script and add the global exports before it
const mainScriptStart = content.indexOf('<script>', content.indexOf('<!-- Main Content Area -->') || 0);
if (mainScriptStart === -1) {
    // Try to find it after the nav
    const altScriptStart = content.indexOf('<script>', content.indexOf('</nav>'));
}

// Find the last </script> before </body>
const bodyEnd = content.indexOf('</body>');
const lastScriptEnd = content.lastIndexOf('</script>', bodyEnd);

if (lastScriptEnd !== -1) {
    const globalExports = loadFunctionsToExpose.map(fn =>
        `        if (typeof ${fn} === 'function') window.${fn} = ${fn};`
    ).join('\n');

    const insertCode = '\n        // Expose load functions globally for sidebar navigation\n' + globalExports + '\n    ';
    content = content.substring(0, lastScriptEnd) + insertCode + content.substring(lastScriptEnd);
    console.log('Added global exports for load functions');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fix complete!');
