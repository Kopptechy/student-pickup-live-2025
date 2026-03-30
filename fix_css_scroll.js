const fs = require('fs');
const path = 'public/admin-layout.css';
let content = fs.readFileSync(path, 'utf8');

// 1. Update Body
content = content.replace(
    /body \{[\s\S]*?overflow: hidden;.*?\}/,
    `body {
    margin: 0;
    font-family: 'DM Sans', sans-serif;
    background: var(--bg-body);
    color: var(--text-primary);
    min-height: 100vh;
    overflow-y: auto; /* Enable body scroll */
    overflow-x: hidden;
}`
);

// 2. Update Admin Wrapper
content = content.replace(
    /.admin-wrapper \{[\s\S]*?position: relative;.*?\}/,
    `.admin-wrapper {
    display: flex;
    min-height: 100vh;
    width: 100%;
    position: relative;
}`
);

// 3. Update Sidebar (Sticky)
content = content.replace(
    /.sidebar \{[\s\S]*?z-index: 100;.*?\}/,
    `.sidebar {
    width: 260px;
    background: var(--sidebar-bg);
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #1e293b;
    z-index: 100;
    
    /* Sticky Sidebar for Desktop */
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto; /* Internal scroll for sidebar items */
}`
);

// 4. Update Main Content (Visible overflow)
content = content.replace(
    /.main-content \{[\s\S]*?position: relative;[\s\S]*?\}/,
    `.main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: visible; /* Let body scroll */
    min-height: 100vh;
}`
);

// 5. Update Page Scroll Container (Visible overflow)
content = content.replace(
    /.page-scroll-container \{[\s\S]*?padding-bottom: 80px;.*?\}/,
    `.page-scroll-container {
    flex: 1;
    overflow: visible; /* Let body scroll */
    padding: 2rem;
    background: var(--bg-body);
    padding-bottom: 80px;
}`
);

fs.writeFileSync(path, content, 'utf8');
console.log('CSS updated for window scrolling');
