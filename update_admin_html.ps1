$path = "public/admin.html"
$lines = Get-Content $path

function Get-LineIndex($str, $startIdx = 0) {
    for ($i = $startIdx; $i -lt $lines.Count; $i++) { if ($lines[$i] -match $str) { return $i } }
    return -1
}

$startHeader = Get-LineIndex '<div class="admin-container">'
$endHeader = Get-LineIndex '<div class="stats-grid">' $startHeader

$startTabs = Get-LineIndex '<div class="tabs"' $endHeader
$endTabs = Get-LineIndex '</div>' $startTabs

$modalsTag = Get-LineIndex '<!-- Add/Edit Student Modal -->' $endTabs

$newHeader = '    <div class="admin-wrapper">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="sidebar-brand">
                <span style="font-size:1.5rem">🏫</span>
                <span>Admin Panel</span>
            </div>
            
            <div class="nav-scroller">
                <div class="nav-group-label">Dashboard</div>
                <div class="nav-item active" onclick="switchTab(''dashboard'')" id="nav-dashboard">
                    <span>📊</span> Dashboard
                </div>

                <div class="nav-group-label">People</div>
                <div class="nav-item" onclick="switchTab(''students'')" id="nav-students">
                    <span>👥</span> Students
                </div>
                <div class="nav-item" onclick="switchTab(''families'')" id="nav-families">
                    <span>👨‍👩‍👧‍👦</span> Families
                </div>
                <div class="nav-item" onclick="switchTab(''users'')" id="nav-users">
                    <span>👤</span> Users
                </div>

                <div class="nav-group-label">Operations</div>
                <div class="nav-item" onclick="switchTab(''classes'')" id="nav-classes">
                    <span>📚</span> Classes
                </div>
                <div class="nav-item" onclick="switchTab(''history'')" id="nav-history">
                    <span>🕒</span> History
                </div>
                <div class="nav-item" onclick="switchTab(''session'')" id="nav-session">
                    <span>🎓</span> Session
                </div>

                <div class="nav-group-label">System</div>
                <div class="nav-item" onclick="switchTab(''displays'')" id="nav-displays">
                    <span>📺</span> Displays
                </div>
                <div class="nav-item" onclick="switchTab(''announcements'')" id="nav-announcements">
                    <span>📢</span> Announcements
                </div>
                <div class="nav-item" onclick="switchTab(''settings'')" id="nav-settings">
                    <span>⚙️</span> Settings
                </div>
            </div>

            <div class="sidebar-footer">
                <button class="logout-btn" onclick="logout()">
                    <span>🚪</span> Sign Out
                </button>
            </div>
        </nav>

        <!-- Main Content -->
        <main class="main-content">
            <div class="top-bar">
                <button class="toggle-menu" onclick="document.querySelector(''.sidebar'').classList.toggle(''open'')">☰</button>
                <div style="flex:1"></div>
                <div class="header-right">
                    <a href="reception.html" target="_blank" class="btn btn-success" style="text-decoration:none; display:flex; gap:0.5rem; align-items:center;">
                        <span>📋</span> Reception
                    </a>
                    <div class="user-profile">
                        <div class="avatar" id="headerAvatar">A</div>
                        <div class="user-info">
                            <div class="name" id="headerName">Loading...</div>
                            <div class="role" id="headerUserRole">Administrator</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="page-scroll-container">
           <!-- Dashboard Tab -->
           <div id="dashboard" class="tab-content active">'

$part1 = $lines[0..($startHeader - 1)]
$part3 = $lines[$endHeader..($startTabs - 1)]
$part5 = $lines[($endTabs + 1)..($modalsTag - 3)]
$part7 = $lines[$modalsTag..($lines.Count - 1)]

$final = $part1 + $newHeader + $part3 + $part5 + '            </div><!-- End PageScroll -->' + '        </main>' + '    </div><!-- End Wrapper -->' + $part7
$final | Set-Content $path -Encoding UTF8
