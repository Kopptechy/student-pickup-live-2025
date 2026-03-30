const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

// New sidebar with simple text icons (no emojis or entities - guaranteed to work)
const newSidebar = `        <!-- Sidebar Navigation -->
        <nav class="sidebar" id="sidebar">
            <div class="sidebar-brand">
                <span style="font-size:1.25rem; margin-right:8px;">SP</span> Admin Panel
            </div>
            
            <div class="nav-scroller">
                <div class="nav-group-label">OVERVIEW</div>
                <div class="nav-item active" onclick="switchTab('students')" id="nav-students">
                    <span class="nav-icon">S</span> Students
                </div>

                <div class="nav-group-label">PEOPLE</div>
                <div class="nav-item" onclick="switchTab('families')" id="nav-families">
                    <span class="nav-icon">F</span> Families
                </div>
                <div class="nav-item" onclick="switchTab('users')" id="nav-users">
                    <span class="nav-icon">U</span> Users
                </div>

                <div class="nav-group-label">OPERATIONS</div>
                <div class="nav-item" onclick="switchTab('classes')" id="nav-classes">
                    <span class="nav-icon">C</span> Classes
                </div>
                <div class="nav-item" onclick="switchTab('history')" id="nav-history">
                    <span class="nav-icon">H</span> History
                </div>
                <div class="nav-item" onclick="switchTab('session')" id="nav-session">
                    <span class="nav-icon">Y</span> Session
                </div>

                <div class="nav-group-label">SYSTEM</div>
                <div class="nav-item" onclick="switchTab('displays')" id="nav-displays">
                    <span class="nav-icon">D</span> Displays
                </div>
                <div class="nav-item" onclick="switchTab('announcements')" id="nav-announcements">
                    <span class="nav-icon">A</span> Announcements
                </div>
                <div class="nav-item" onclick="switchTab('settings')" id="nav-settings">
                    <span class="nav-icon">*</span> Settings
                </div>
            </div>

            <div class="sidebar-footer">
                <button class="logout-btn" onclick="logout()">
                    <span class="nav-icon">X</span> Sign Out
                </button>
            </div>
        </nav>`;

// Find and replace sidebar section
const sidebarStart = content.indexOf('<!-- Sidebar Navigation -->');
const sidebarEnd = content.indexOf('</nav>', sidebarStart) + 6;

if (sidebarStart !== -1 && sidebarEnd > sidebarStart) {
    content = content.substring(0, sidebarStart) + newSidebar + content.substring(sidebarEnd);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Sidebar replaced with text icons');
} else {
    console.log('Could not find sidebar section');
}
