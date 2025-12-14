const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const scrypt = util.promisify(crypto.scrypt);

// USE REAL DATABASE FOR PRODUCTION
const PickupDatabase = require('./database');
const { sendInviteEmail } = require('./email_service');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Ensure PORT is defined
const PORT = process.env.PORT || 3000;

let db;

// --- AUTH HELPER FUNCTIONS ---
async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await scrypt(password, salt, 64);
    return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, hash) {
    if (!hash.includes(':')) {
        // Fallback for mock/seed data (plain text) - Should be removed in strict production
        return password === hash;
    }
    const [salt, key] = hash.split(':');
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = await scrypt(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// In-memory session store
// NOTE: In a multi-instance production setup, this should be replaced by Redis or DB sessions.
const sessions = new Map();

// Session Middleware
app.use(express.static('public'));
app.use(express.json());

// DEBUG LOGGER
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST') console.log('Body:', JSON.stringify(req.body));
    next();
});

app.use((req, res, next) => {
    // Manually parse cookies
    const cookieHeader = req.headers.cookie;
    req.cookies = {};
    if (cookieHeader) {
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                req.cookies[parts.shift().trim()] = decodeURI(parts.join('='));
            }
        });
    }

    const sessionId = req.cookies.session_id;
    if (sessionId && sessions.has(sessionId)) {
        req.session = sessions.get(sessionId);
    } else {
        req.session = null;
    }
    next();
});

// Store active WebSocket connections by class
const classConnections = new Map();

// --- SECURITY MIDDLEWARE ---
const requireAdmin = (req, res, next) => {
    if (!req.session || req.session.role !== 'admin') {
        console.log(`[SECURITY] Blocked unauthorized access to ${req.method} ${req.url} from ${req.ip}`);
        return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    next();
};

// Apply to all /api/admin routes
app.use('/api/admin', requireAdmin);

// WebSocket connection handler
const WS_TOKEN = process.env.WS_TOKEN || 'STAFF_WX_TOKEN_2025';

wss.on('connection', (ws, req) => {
    // Basic Token Auth
    const url = req.url; // e.g., /?token=XYZ
    if (!url.includes(`token=${WS_TOKEN}`)) {
        console.log('[SECURITY] Blocked unauthorized WebSocket connection');
        ws.close();
        return;
    }

    console.log('New Authorized WebSocket connection');

    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'subscribe') {
                // Subscribe to a specific class
                const { year, className } = data;
                const classKey = `year${year}-${className}`;

                if (!classConnections.has(classKey)) {
                    classConnections.set(classKey, new Set());
                }
                classConnections.get(classKey).add(ws);

                ws.classKey = classKey;
                console.log(`Client subscribed to ${classKey}`);

                // Send current pending pickups for this class
                const pendingPickups = await db.getPendingPickupsByClass(year, className);
                ws.send(JSON.stringify({
                    type: 'initial',
                    pickups: pendingPickups
                }));
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });

    ws.on('close', () => {
        // Remove connection from class subscriptions
        if (ws.classKey && classConnections.has(ws.classKey)) {
            classConnections.get(ws.classKey).delete(ws);
            console.log(`Client unsubscribed from ${ws.classKey}`);
        }
    });

    // Send heartbeat to keep connection alive
    const heartbeat = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'heartbeat' }));
        }
    }, 30000);

    ws.on('close', () => clearInterval(heartbeat));
});

// Broadcast pickup to specific class (and to host if merged)
async function broadcastToClass(year, className, data) {
    const classKey = `year${year}-${className}`;
    const connections = classConnections.get(classKey);

    if (connections) {
        const message = JSON.stringify(data);
        connections.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
        console.log(`Broadcasted to ${classKey}: ${connections.size} clients`);
    }

    // If this class is merged into a host, also broadcast there
    const merge = await db.getMergeForSource(year, className);
    if (merge) {
        const hostKey = `year${merge.host_year}-${merge.host_class}`;
        const hostConnections = classConnections.get(hostKey);
        if (hostConnections) {
            // Add merge info to pickup data for badge display
            const mergedData = {
                ...data,
                pickup: data.pickup ? {
                    ...data.pickup,
                    merged_from: { year, class: className }
                } : undefined
            };
            const message = JSON.stringify(mergedData);
            hostConnections.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
            console.log(`Broadcasted to host ${hostKey} (merged): ${hostConnections.size} clients`);
        }
    }
}

// API Routes

// Get all students (Extended with Family Info)
app.get('/api/students', async (req, res) => {
    try {
        const students = await db.getAllStudents();
        // Join with Family info for Admin display
        const enriched = await Promise.all(students.map(async s => {
            let familyName = null;
            if (s.family_id) {
                const fam = await db.getFamilyById(s.family_id);
                familyName = fam ? fam.name : 'Unknown';
            }
            return { ...s, family_name: familyName };
        }));
        res.json(enriched);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all students in a year
app.get('/api/students/year/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const students = await db.getStudentsByYear(parseInt(year));
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get students by class
app.get('/api/students/:year/:class', async (req, res) => {
    try {
        const { year, class: className } = req.params;
        const students = await db.getStudentsByClass(parseInt(year), className);
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all years
app.get('/api/years', async (req, res) => {
    try {
        const years = await db.getYears();
        res.json(years);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get classes for a year
app.get('/api/classes/:year', async (req, res) => {
    try {
        const { year } = req.params;
        const classes = await db.getClassesByYear(parseInt(year));
        res.json(classes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// Create a new pickup
app.post('/api/pickups', async (req, res) => {
    try {
        const { student_id, student_name, year, class: className } = req.body;

        const pickupData = {
            id: uuidv4(),
            student_id,
            student_name,
            year,
            class: className,
            timestamp: Date.now()
        };

        await db.addPickup(pickupData);

        // Broadcast to the specific class
        broadcastToClass(year, className, {
            type: 'new_pickup',
            pickup: pickupData
        });

        res.json({ success: true, pickup: pickupData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all pending pickups
app.get('/api/pickups/pending', async (req, res) => {
    try {
        const pickups = await db.getPendingPickups();
        res.json(pickups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get pending pickups for a class
app.get('/api/pickups/pending/:year/:class', async (req, res) => {
    try {
        const { year, class: className } = req.params;
        const pickups = await db.getPendingPickupsByClass(parseInt(year), className);
        res.json(pickups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Acknowledge a pickup
app.post('/api/pickups/:id/acknowledge', async (req, res) => {
    try {
        const { id } = req.params;

        // Get pickup details before acknowledging
        const allPickups = await db.getPendingPickups();
        const pickup = allPickups.find(p => p.id === id);

        if (!pickup) {
            return res.status(404).json({ error: 'Pickup not found' });
        }

        await db.acknowledgePickup(id);

        // Broadcast acknowledgment to the class
        broadcastToClass(pickup.year, pickup.class, {
            type: 'pickup_acknowledged',
            pickupId: id
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get pickup history
app.get('/api/pickups/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const history = await db.getPickupHistory(limit);
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a new student
app.post('/api/students', requireAdmin, async (req, res) => {
    try {
        const { name, year, class: className } = req.body;
        const result = await db.addStudent(name, year, className);
        res.json({ success: true, id: result.id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Batch add students
app.post('/api/students/batch', requireAdmin, async (req, res) => {
    try {
        const { names, year, class: className } = req.body;

        // Validate input
        if (!names || !Array.isArray(names) || names.length === 0) {
            return res.status(400).json({ error: 'Names array is required and must not be empty' });
        }

        if (!year || !className) {
            return res.status(400).json({ error: 'Year and class are required' });
        }

        // Prepare student objects
        const students = names
            .filter(name => name && name.trim()) // Filter out empty names
            .map(name => ({
                name: name.trim(),
                year: parseInt(year),
                class: className
            }));

        if (students.length === 0) {
            return res.status(400).json({ error: 'No valid student names provided' });
        }

        // Add students in batch
        const count = await db.addStudentsBatch(students);

        res.json({
            success: true,
            count: count,
            message: `Successfully added ${count} student${count !== 1 ? 's' : ''}`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a student
app.put('/api/students/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, year, class: className } = req.body;
        await db.updateStudent(id, name, year, className);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a student
app.delete('/api/students/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        // Workaround: Delete pickups first to avoid foreign key constraint
        // await db.pool.query('DELETE FROM pickups WHERE student_id = $1', [id]);
        await db.deleteStudent(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete all students
app.delete('/api/students', requireAdmin, async (req, res) => {
    try {
        const count = await db.deleteAllStudents();
        res.json({ success: true, count: count, message: `Deleted ${count} students` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear old pickups (run daily)
setInterval(async () => {
    try {
        await db.clearOldPickups();
        await db.deleteExpiredCodes();
        console.log('Cleared old acknowledged pickups and expired codes');
    } catch (error) {
        console.error('Error clearing old pickups:', error);
    }
}, 24 * 60 * 60 * 1000);

// --- PARENT PORTAL API ROUTES ---

// Auth: Signup
app.post('/api/auth/signup', async (req, res) => {
    try {
        const { email, password, familyCode } = req.body;

        if (!email || !password || !familyCode) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const family = await db.getFamilyByCode(familyCode);
        if (!family) return res.status(400).json({ error: 'Invalid family code' });

        const existingUser = await db.getUserByEmail(email);
        if (existingUser) return res.status(400).json({ error: 'Email already registered' });

        // Use native crypto hashing
        const hash = await hashPassword(password);
        await db.createUser(email, hash, family.id);

        res.json({ success: true, message: 'Account created. Please wait for admin approval.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
    console.log('Login attempt:', req.body.email);
    try {
        const { email, password } = req.body;
        const user = await db.getUserByEmail(email);

        console.log('User found:', user ? 'YES' : 'NO');
        if (user) {
            console.log('Stored Hash:', user.password_hash);
            console.log('Password Hash Match:', await verifyPassword(password, user.password_hash));
            console.log('Is Approved:', user.is_approved);
        }

        if (!user || !(await verifyPassword(password, user.password_hash))) {
            console.log('LOGIN FAILED: Invalid credentials');
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.is_approved && user.role !== 'admin') {
            console.log('LOGIN FAILED: Not approved');
            return res.status(403).json({ error: 'Account pending approval' });
        }

        if (user.must_change_password) {
            console.log('LOGIN: Force Password Change Required');
            return res.json({
                success: true,
                mustChangePassword: true,
                userId: user.id // Send ID so client can use it for change-password request
            });
        }

        // Create manual session
        const sessionId = uuidv4();
        const sessionData = { userId: user.id, role: user.role, familyId: user.family_id };
        sessions.set(sessionId, sessionData);

        // Set cookie manually
        // Set cookie manually
        res.setHeader('Set-Cookie', `session_id=${sessionId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`);

        console.log('LOGIN SUCCESS');
        res.json({ success: true, user: { email: user.email, role: user.role, familyId: user.family_id } });
    } catch (error) {
        console.error('Login Error catch:', error);
        res.status(500).json({ error: error.message });
    }
});

// Auth: Logout
app.post('/api/auth/logout', (req, res) => {
    // Clear session
    const sessionId = req.cookies.session_id;
    if (sessionId) {
        sessions.delete(sessionId);
    }
    // Expire cookie
    res.setHeader('Set-Cookie', 'session_id=; HttpOnly; Path=/; Max-Age=0');
    res.json({ success: true });
});

// --- PREMIUM ONBOARDING API ---

// Admin: Generate Batch Invites (Father/Mother/Guardian)
app.post('/api/admin/invite-batch', async (req, res) => {
    try {
        const { parents, studentIds, familyName } = req.body;
        // parents = [{ role: 'Father', name: '...', email: '...' }, ...]

        // 0. SAFEGUARD: Check if any student is already linked to a family
        // We only do this if we are creating a NEW family link (which this endpoint implies)
        const allStudents = await db.getAllStudents();
        for (let sid of studentIds) {
            const student = allStudents.find(s => s.id == sid);
            if (student && student.family_id) {
                const existingFamily = await db.getFamilyById(student.family_id);
                const familyName = existingFamily ? existingFamily.name : 'Unknown Family';
                return res.status(409).json({
                    error: `Student '${student.name}' is already linked to '${familyName}'. Please unlink them first if you wish to move them.`
                });
            }
        }

        // 1. Ensure a Family exists (or create one)
        // For simplicity, we use the familyName provided or generate one
        let familyId = null;
        if (familyName) {
            // Create a "Backend Family" to link them together
            // We reuse createFamily but we don't need the public "Family Code" anymore
            const code = uuidv4().substring(0, 6).toUpperCase();
            const family = await db.createFamily(familyName, code);
            familyId = family.id;

            // Link students to this family immediately?
            // Yes, mapping happens at onboarding creation.
            for (let sid of studentIds) {
                await db.addStudentToFamily(sid, familyId);
            }
        }

        const results = [];

        // 2. Generate Invite for each parent
        for (const p of parents) {
            if (p.name && p.role) { // Email is optional in some flows, but usually required
                const invite = await db.createParentInvite(
                    p.email || '',
                    p.name,
                    p.role,
                    studentIds,
                    familyId
                );

                // SEND REAL EMAIL
                const emailSent = await sendInviteEmail(
                    p.email,
                    invite.code,
                    p.name,
                    p.role
                );

                console.log(`[EMAIL] To: ${p.email} | Sent: ${emailSent}`);

                results.push({
                    role: p.role,
                    name: p.name,
                    email: p.email,
                    code: invite.code
                });
            }
        }

        res.json({ success: true, invites: results });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get all Pending Invites
app.get('/api/admin/pending-invites', async (req, res) => {
    try {
        const invites = await db.getPendingInvites();
        res.json(invites);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Delete Pending Invite (Revoke)
app.delete('/api/admin/invites/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const success = await db.deleteInvite(code);
        if (success) {
            console.log(`Deleted invite ${code}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Invite not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth: Validate Invite Code
app.post('/api/auth/validate-invite', async (req, res) => {
    try {
        const { code } = req.body;
        const invite = await db.getInviteByCode(code);

        if (!invite) return res.status(404).json({ error: 'Invalid invite code' });
        if (invite.is_used) return res.status(400).json({ error: 'This invite has already been used' });
        if (Date.now() > parseInt(invite.expires_at)) return res.status(400).json({ error: 'Invite expired' });

        // Get student details
        const studentIds = JSON.parse(invite.student_ids);
        const allStudents = await db.getAllStudents(); // Inefficient but simple for now
        const mappedStudents = allStudents.filter(s => studentIds.includes(s.id));

        res.json({
            success: true,
            email: invite.email,
            name: invite.name,
            role: invite.role,
            students: mappedStudents
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth: Complete Signup (Exchange Invite for User)
app.post('/api/auth/complete-signup', async (req, res) => {
    try {
        const { code, password, confirmedStudentIds } = req.body;

        const invite = await db.getInviteByCode(code);
        if (!invite || invite.is_used) return res.status(400).json({ error: 'Invalid or used invite' });

        // Create User
        const hash = await hashPassword(password);

        // We link them to the family_id stored in the invite
        // If confirmedStudentIds differs from invite, we might update DB, 
        // but for now we assume the Family linkage is the source of truth.

        const user = await db.createUser(invite.email, hash, invite.family_id);

        // Approve them immediately (Trusted Invite) OR keep pending?
        // User implied "Validated" -> "Sign in". So Auto-Approve.
        await db.approveUser(user.id);

        // Update User Name (Mock DB doesn't have raw query, must use methods)
        // await db.pool.query('UPDATE users SET name = $1, role = $2 WHERE id = $3', [invite.name, 'parent', user.id]);
        // Mock specific fix:
        const u = await db.getUserByEmail(user.email);
        if (u) {
            u.name = invite.name;
            u.role = 'parent';
        }

        // Mark code used
        await db.markInviteUsed(code);

        res.json({ success: true, message: 'Account set up successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Create Family (Legacy) -> Kept for backward compat or manual override
app.post('/api/admin/families', async (req, res) => {
    // TODO: Add admin role check middleware
    try {
        const { name } = req.body;
        const code = uuidv4().substring(0, 6).toUpperCase();
        const family = await db.createFamily(name, code);
        res.json(family);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Add Student to Family
app.post('/api/admin/families/students', async (req, res) => {
    try {
        const { studentId, familyCode } = req.body; // Changed from familyId to familyCode

        // Find family by code first
        const family = await db.getFamilyByCode(familyCode);
        if (!family) {
            return res.status(404).json({ error: 'Family code not found' });
        }

        await db.addStudentToFamily(studentId, family.id);
        res.json({ success: true, familyName: family.name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get Pending Users
app.get('/api/admin/pending-users', async (req, res) => {
    try {
        const users = await db.getPendingUsers();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Get All Users
app.get('/api/admin/users', async (req, res) => {
    try {
        const users = await db.getUsers();
        // Return mostly clean data
        const safeUsers = users.map(u => ({
            id: u.id,
            email: u.email,
            role: u.role,
            family_id: u.family_id,
            must_change_password: u.must_change_password,
            created_at: u.created_at
        }));
        res.json(safeUsers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Approve User
app.post('/api/admin/users/:id/approve', async (req, res) => {
    try {
        const { id } = req.params;
        await db.approveUser(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Reset User Password
app.post('/api/admin/users/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        // In real app, generate random string. Here, use fixed for simplicity or random.
        const tempPassword = 'CDSS' + Math.floor(1000 + Math.random() * 9000);
        const hash = await hashPassword(tempPassword);

        await db.adminResetPassword(id, hash);

        res.json({ success: true, tempPassword });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auth: Change Password (Forced or Voluntary)
app.post('/api/auth/change-password', async (req, res) => {
    try {
        // This endpoint might be called without a session cookie if it's the specific "Forced Change" flow
        // so we accept userId in body if no session, relying on specific flow context
        // BUT ideally we should have a temporary session. 
        // For simplicity: We trust the userId passed from the Login response for this specific step.
        // (In production, use a temp token).

        const { userId, newPassword } = req.body;
        if (!userId || !newPassword) return res.status(400).json({ error: 'Missing userId or password' });

        const hash = await hashPassword(newPassword);
        await db.changePassword(userId, hash);

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin: Reject User
app.delete('/api/admin/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await db.deleteUser(id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Parent: Get Family Members
app.get('/api/parent/children', async (req, res) => {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const members = await db.getFamilyMembers(req.session.familyId);
        res.json(members);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Parent: Generate Pickup Code
app.post('/api/pickup-code', async (req, res) => {
    if (!req.session || !req.session.userId) return res.status(401).json({ error: 'Unauthorized' });

    if (!req.session.familyId) {
        return res.status(400).json({ error: 'No family linked to this account. Please contact admin.' });
    }

    try {
        const { studentIds } = req.body; // Array of IDs selected by parent

        // Retry loop to ensure unique code
        let attempts = 0;
        let result = null;

        while (!result && attempts < 5) {
            // Generate a 6-digit numeric code
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            result = await db.generateDailyCode(code, req.session.familyId, studentIds);
            attempts++;
        }

        if (!result) {
            return res.status(500).json({ error: 'Failed to generate unique code. Please try again.' });
        }

        res.json({ code: result.code, expiresAt: result.expires_at });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reception: Verify Code
app.get('/api/pickup-code/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const dailyCode = await db.getDailyCode(code);

        if (!dailyCode) return res.status(404).json({ error: 'Invalid or expired code' });

        // Get the specific students authorized for pickup
        const memberIds = JSON.parse(dailyCode.student_ids);

        // Fetch family members to get details
        const familyMembers = await db.getFamilyMembers(dailyCode.family_id);

        // Filter to only include the ones selected for this code
        // IMPORTANT: Ensure type consistency (string vs number) for IDs
        const selectedStudents = familyMembers.filter(s =>
            memberIds.includes(s.id) || memberIds.includes(s.id.toString()) || memberIds.includes(Number(s.id))
        );

        res.json({ family: dailyCode.family_name, students: selectedStudents });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unlink Student from Family
app.post('/api/students/:id/unlink', async (req, res) => {
    try {
        const { id } = req.params;
        const success = await db.unlinkStudent(id);
        if (success) {
            console.log(`Unlinked student ${id}`);
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Student not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- CLASS MERGE API ---

// Create a merge
app.post('/api/merge', async (req, res) => {
    try {
        const { sourceYear, sourceClass, hostYear, hostClass } = req.body;

        // Validate required fields
        if (!sourceYear || !sourceClass || !hostYear || !hostClass) {
            return res.status(400).json({ error: 'All fields required: sourceYear, sourceClass, hostYear, hostClass' });
        }

        // Can't merge a class into itself
        if (sourceYear === hostYear && sourceClass === hostClass) {
            return res.status(400).json({ error: 'Cannot merge a class into itself' });
        }

        const result = await db.createMerge(
            parseInt(sourceYear),
            sourceClass,
            parseInt(hostYear),
            hostClass
        );

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        // Broadcast merge event to host display
        const hostKey = `year${hostYear}-${hostClass}`;
        const hostConnections = classConnections.get(hostKey);
        if (hostConnections) {
            const message = JSON.stringify({
                type: 'merge_activated',
                merge: result
            });
            hostConnections.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        }

        console.log(`Merge created: Y${sourceYear} ${sourceClass} → Y${hostYear} ${hostClass}`);
        res.json({ success: true, merge: result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a merge
app.delete('/api/merge/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get merge details before deleting (for broadcast)
        const merges = await db.getActiveMerges();
        const merge = merges.find(m => m.id == id);

        const deleted = await db.deleteMerge(id);

        if (deleted > 0 && merge) {
            // Broadcast merge deactivation to host display
            const hostKey = `year${merge.host_year}-${merge.host_class}`;
            const hostConnections = classConnections.get(hostKey);
            if (hostConnections) {
                const message = JSON.stringify({
                    type: 'merge_deactivated',
                    mergeId: parseInt(id)
                });
                hostConnections.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
            console.log(`Merge removed: Y${merge.source_year} ${merge.source_class} → Y${merge.host_year} ${merge.host_class}`);
        }

        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all active merges
app.get('/api/merges', async (req, res) => {
    try {
        const merges = await db.getActiveMerges();
        res.json(merges);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get merges for a specific host class
app.get('/api/merges/host/:year/:class', async (req, res) => {
    try {
        const { year, class: className } = req.params;
        const merges = await db.getMergesForHost(parseInt(year), className);
        res.json(merges);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Auto-clear merges at 6 PM daily
setInterval(async () => {
    const now = new Date();
    if (now.getHours() === 18 && now.getMinutes() === 0) {
        const count = await db.clearAllMerges();
        if (count > 0) {
            console.log(`[6 PM Auto-Clear] Cleared ${count} active merges`);
        }
    }
}, 60 * 1000); // Check every minute

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        db = new PickupDatabase();
        await db.initializeTables();

        // --- PRODUCTION FIRST-RUN CHECK ---
        // If no users exist, create default Admin
        try {
            const users = await db.pool.query('SELECT COUNT(*) FROM users');
            if (parseInt(users.rows[0].count) === 0) {
                console.log('⚠️ No users found. Seeding initial ADMIN account...');
                const adminEmail = 'admin@school.com';
                const adminPass = 'admin123';
                const hash = await hashPassword(adminPass);

                // Create Admin User
                await db.pool.query(
                    `INSERT INTO users (email, password_hash, role, is_approved, name)
                     VALUES ($1, $2, 'admin', true, 'System Admin')`,
                    [adminEmail, hash]
                );

                // Create "Staff" Family (Optional, for token generation consistency if needed)
                await db.createFamily('School Staff', 'STAFF001');

                console.log(`✅ Created Admin: ${adminEmail} / ${adminPass}`);
                console.log(`👉 IMPORTANT: Change this password immediately after login!`);
            }
        } catch (seedErr) {
            console.error('Error during admin seeding:', seedErr);
        }

        // Start server
        server.listen(PORT, () => {
            console.log(`\n🚀 Production Server running on port ${PORT}`);
            console.log(`\n✅ Database initialized`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down gracefully...');
    await db.close();
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

// Start the application
startServer();
