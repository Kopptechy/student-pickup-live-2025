const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// Script to add right after the sidebar
const earlyScript = `
        <script>
        // Early definition of switchTab for sidebar onclick handlers
        window.switchTab = function(tabName) {
            // Update sidebar nav items
            document.querySelectorAll('.nav-item').forEach(function(item) { item.classList.remove('active'); });
            var navItem = document.getElementById('nav-' + tabName);
            if (navItem) navItem.classList.add('active');

            // Hide all tab content and show the selected one
            document.querySelectorAll('.tab-content').forEach(function(content) { content.classList.remove('active'); });
            var tabContent = document.getElementById(tabName + 'Tab');
            if (tabContent) tabContent.classList.add('active');

            // Close mobile sidebar
            var sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('open');
            
            // Trigger data loading if the main script has defined the load functions
            if (tabName === 'students' && typeof loadStudents === 'function') loadStudents();
            if (tabName === 'history' && typeof loadHistory === 'function') loadHistory();
            if (tabName === 'families' && typeof initLinkTab === 'function') { initLinkTab(); loadPendingInvites(); }
            if (tabName === 'users' && typeof loadRegisteredUsers === 'function') loadRegisteredUsers();
            if (tabName === 'session' && typeof loadSessionInfo === 'function') { loadSessionInfo(); loadArchivedStudents(); }
            if (tabName === 'settings' && typeof loadSettings === 'function') loadSettings();
            if (tabName === 'classes' && typeof loadClasses === 'function') loadClasses();
            if (tabName === 'announcements' && typeof loadAnnouncementsTab === 'function') loadAnnouncementsTab();
        };
        </script>

`;

// Find the </nav> tag and insert the script after it
const navEndTag = '</nav>';
const navEndIndex = content.indexOf(navEndTag);

if (navEndIndex !== -1) {
    const insertPoint = navEndIndex + navEndTag.length;
    content = content.substring(0, insertPoint) + earlyScript + content.substring(insertPoint);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Early switchTab script injected successfully');
} else {
    console.log('Could not find </nav> tag');
}
