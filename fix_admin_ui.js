const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Close Button to Sidebar Brand
// Original: <span style="font-size:1.25rem; margin-right:8px;">SP</span> Admin Panel
const sidebarBrandEnd = '<span style="font-size:1.25rem; margin-right:8px;">SP</span> Admin Panel';
const closeBtn = `
                <span style="font-size:1.25rem; margin-right:8px;">SP</span> Admin Panel
                <button class="mobile-close-btn" onclick="toggleSidebar()">×</button>
`;
content = content.replace(sidebarBrandEnd, closeBtn);

// 2. Add Sidebar Overlay after </nav>
const navEnd = '</nav>';
const overlay = `
        </nav>
        <div id="sidebarOverlay" class="sidebar-overlay" onclick="toggleSidebar()"></div>
`;
content = content.replace(navEnd, overlay);

// 3. Update Hamburger Button to use toggleSidebar()
// Original: onclick="document.getElementById('sidebar').classList.toggle('open')"
content = content.replace(
    'onclick="document.getElementById(\'sidebar\').classList.toggle(\'open\')"',
    'onclick="toggleSidebar()"'
);

// 4. Add toggleSidebar logic to the global exports (or new function)
// We'll append it to the main script block
const mainScriptEnd = '</script>';
// We will look for the LAST script tag end to append our UI logic
const lastScriptIndex = content.lastIndexOf('</script>');

if (lastScriptIndex !== -1) {
    const uiLogic = `
        // UI Helpers
        window.toggleSidebar = function() {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        };
        
        // Ensure overlay is closed when switching tabs (updating switchTab logic)
        // We can't easily edit switchTab here without regex, but switchTab removes 'open' from sidebar
        // We should also ensure it removes 'active' from overlay.
        // Let's monkey-patch switchTab slightly or just add a listener?
        // Simplest: The overlay click calls toggleSidebar() which closes it.
        // But switchTab needs to close overlay too.
        
        const originalSwitchTab = window.switchTab;
        window.switchTab = function(tabName) {
            if (originalSwitchTab) originalSwitchTab(tabName);
            // Also close overlay
            const overlay = document.getElementById('sidebarOverlay');
            if (overlay) overlay.classList.remove('active');
        };
    `;

    // Insert before the last </script>
    content = content.substring(0, lastScriptIndex) + uiLogic + content.substring(lastScriptIndex);
}

fs.writeFileSync(path, content, 'utf8');
console.log('UI fixes applied');
