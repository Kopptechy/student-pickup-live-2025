const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// Add logout function after the auth listener
const logoutFunction = `
        // Logout function
        window.logout = async function() {
            try {
                await auth.signOut();
                sessionStorage.clear();
                window.location.href = 'login.html';
            } catch (error) {
                console.error('Logout error:', error);
                alert('Failed to logout. Please try again.');
            }
        };
`;

// Find a good spot to insert - after the auth listener closing
const insertAfter = 'window.location.href = \'login.html\';';
const index = content.lastIndexOf(insertAfter);

if (index !== -1) {
    // Find the end of that block (look for closing braces)
    const afterIndex = content.indexOf('});', index);
    if (afterIndex !== -1) {
        content = content.substring(0, afterIndex + 4) + logoutFunction + content.substring(afterIndex + 4);
        console.log('Added logout function');
    }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done');
