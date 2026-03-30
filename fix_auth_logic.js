const fs = require('fs');
const path = 'public/admin.html';
let content = fs.readFileSync(path, 'utf8');

const anchor = 'let editingStudentId = null;';
const index = content.indexOf(anchor);

if (index !== -1) {
    const authLogic = `

        // --- AUTH & INIT LOGIC ---
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log("Authenticated as:", user.email);
                
                try {
                    // Fetch user profile to get schoolId
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    if (userDoc.exists) {
                        const userData = userDoc.data();
                        
                        // Enforce Admin Role
                        if (userData.role !== 'admin' && userData.role !== 'superAdmin') {
                            alert("Access Denied: Admins Only");
                            await auth.signOut();
                            window.location.href = 'login.html';
                            return;
                        }

                        // Store SchoolID
                        sessionStorage.setItem('schoolId', userData.schoolId || '');
                        
                        // Update UI
                        document.querySelectorAll('#headerName').forEach(el => el.textContent = userData.displayName || user.email);
                        document.querySelectorAll('#headerRole').forEach(el => el.textContent = userData.role === 'superAdmin' ? 'Super Admin' : 'Administrator');
                        document.querySelectorAll('#headerAvatar').forEach(el => el.textContent = (userData.displayName || 'A').charAt(0));
                        
                        // Initialize Dashboard (load default tab)
                        // Trigger the active sidebar item if exists, else default to students
                        const activeItem = document.querySelector('.nav-item.active');
                        if (activeItem) {
                             activeItem.click();
                        } else {
                             switchTab('students');
                        }
                        
                        // Load Stat Counts (if functions exist within scope or global)
                        if(typeof loadPendingCount === 'function') loadPendingCount();
                        if(typeof loadClassCount === 'function') loadClassCount();
                        
                    } else {
                        console.error("User profile not found");
                        alert("Account not configured.");
                        await auth.signOut();
                        window.location.href = 'login.html';
                    }
                } catch(err) {
                    console.error("Auth init error:", err);
                    alert("Authentication error: " + err.message);
                }
            } else {
                // Not logged in
                console.log("User not logged in, redirecting...");
                window.location.href = 'login.html';
            }
        });
    `;

    content = content.substring(0, index + anchor.length) + authLogic + content.substring(index + anchor.length);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Injected auth listener logic.');
} else {
    console.log('Anchor not found');
}
