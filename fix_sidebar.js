const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// New sidebar with HTML entities instead of raw emojis
const newSidebar = `        <!-- Sidebar Navigation -->
        <nav class="sidebar" id="sidebar">
            <div class="sidebar-brand">
                &#x1F3EB; Admin Panel
            </div>
            
            <div class="nav-scroller">
                <div class="nav-group-label">OVERVIEW</div>
                <div class="nav-item active" onclick="switchTab('students')" id="nav-students">
                    &#x1F465; Students
                </div>

                <div class="nav-group-label">PEOPLE</div>
                <div class="nav-item" onclick="switchTab('families')" id="nav-families">
                    &#x1F46A; Families
                </div>
                <div class="nav-item" onclick="switchTab('users')" id="nav-users">
                    &#x1F464; Users
                </div>

                <div class="nav-group-label">OPERATIONS</div>
                <div class="nav-item" onclick="switchTab('classes')" id="nav-classes">
                    &#x1F4DA; Classes
                </div>
                <div class="nav-item" onclick="switchTab('history')" id="nav-history">
                    &#x1F552; History
                </div>
                <div class="nav-item" onclick="switchTab('session')" id="nav-session">
                    &#x1F393; Session
                </div>

                <div class="nav-group-label">SYSTEM</div>
                <div class="nav-item" onclick="switchTab('displays')" id="nav-displays">
                    &#x1F4FA; Displays
                </div>
                <div class="nav-item" onclick="switchTab('announcements')" id="nav-announcements">
                    &#x1F4E2; Announcements
                </div>
                <div class="nav-item" onclick="switchTab('settings')" id="nav-settings">
                    &#x2699; Settings
                </div>
            </div>

            <div class="sidebar-footer">
                <button class="logout-btn" onclick="logout()">
                    &#x1F6AA; Sign Out
                </button>
            </div>
        </nav>`;

// Find and replace sidebar section
const sidebarStart = content.indexOf('<!-- Sidebar Navigation -->');
const sidebarEnd = content.indexOf('</nav>', sidebarStart) + 6;

if (sidebarStart !== -1 && sidebarEnd > sidebarStart) {
    content = content.substring(0, sidebarStart) + newSidebar + content.substring(sidebarEnd);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Sidebar replaced successfully');
} else {
    console.log('Could not find sidebar section');
}
