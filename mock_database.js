class PickupDatabase {
    constructor() {
        this.students = [];
        this.pickups = [];
        this.families = [];
        this.users = [];
        this.dailyCodes = [];
        this.parentInvites = [];
        this.merges = [];  // Class merge storage

        console.log("Initializing In-Memory Mock Database...");
        this.seedMockData();
    }

    async initializeTables() {
        // No-op for in-memory
        return Promise.resolve();
    }

    async seedMockData() {
        console.log('Seeding mock database...');
        const firstNames = ['James', 'Emma', 'Oliver', 'Sophia', 'William', 'Ava', 'Benjamin', 'Isabella', 'Lucas', 'Mia'];
        const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];

        let idCounter = 1;

        // Seed Students
        for (let year = 7; year <= 12; year++) {
            for (const color of ['blue', 'green', 'red']) {
                for (let i = 0; i < 5; i++) { // 5 students per class for testing
                    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
                    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
                    this.students.push({
                        id: idCounter++,
                        name: `${firstName} ${lastName}`,
                        year: year,
                        class: color,
                        family_id: null
                    });
                }
            }
        }

        // Seed Admin User
        this.users.push({
            id: idCounter++,
            email: 'admin@school.com',
            password_hash: 'admin123', // In real app, this would be hashed
            role: 'admin',
            is_approved: true,
            created_at: Date.now(),
            must_change_password: false
        });

        // Seed Test Family for User Testing
        const testFamily = {
            id: 1,
            name: 'The Smith Family',
            code: 'FAMILY123', // Legacy code
            created_at: Date.now()
        };
        this.families.push(testFamily);

        // Link first 3 students to this family
        for (let i = 0; i < 3; i++) {
            if (this.students[i]) {
                this.students[i].family_id = testFamily.id;
            }
        }

        // Seed Test Invite for "Invite Flow" (matches parent.html)
        this.parentInvites.push({
            code: 'INVITE1',
            email: 'test@parent.com',
            name: 'Test Parent',
            role: 'Father',
            student_ids: JSON.stringify([this.students[0].id, this.students[1].id]),
            family_id: testFamily.id,
            is_used: false,
            expires_at: Date.now() + 86400000,
            created_at: Date.now()
        });

        console.log(`Seeded ${this.students.length} students.`);
        console.log(`Seeded Test Family: Code '${testFamily.code}' with 3 students.`);
        console.log(`Seeded Test Invite: Code 'INVITE1' for test@parent.com`);
    }

    // --- Student Methods ---

    async getAllStudents() {
        return [...this.students].sort((a, b) => a.year - b.year || a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
    }

    async getStudentsByClass(year, className) {
        return this.students
            .filter(s => s.year === year && s.class === className)
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    async getYears() {
        const years = [...new Set(this.students.map(s => s.year))].sort((a, b) => a - b);
        return years.map(y => ({ year: y }));
    }

    async getStudentsByYear(year) {
        return this.students
            .filter(s => s.year === year)
            .sort((a, b) => a.class.localeCompare(b.class) || a.name.localeCompare(b.name));
    }

    async getClassesByYear(year) {
        const classes = [...new Set(this.students.filter(s => s.year === year).map(s => s.class))].sort();
        return classes.map(c => ({ class: c }));
    }

    async addStudent(name, year, className) {
        const newStudent = {
            id: this.students.length + 1,
            name,
            year,
            class: className,
            family_id: null
        };
        this.students.push(newStudent);
        return newStudent;
    }

    async addStudentsBatch(studentsList) {
        let count = 0;
        for (const s of studentsList) {
            this.students.push({
                id: this.students.length + 1,
                name: s.name,
                year: s.year,
                class: s.class,
                family_id: null
            });
            count++;
        }
        return count;
    }

    async updateStudent(id, name, year, className) {
        const student = this.students.find(s => s.id == id);
        if (student) {
            student.name = name;
            student.year = year;
            student.class = className;
        }
        return student;
    }

    async deleteStudent(id) {
        const initialLength = this.students.length;
        this.students = this.students.filter(s => s.id != id);
        // Also remove pickups
        this.pickups = this.pickups.filter(p => p.student_id != id);
        return initialLength - this.students.length;
    }

    async deleteAllStudents() {
        const count = this.students.length;
        this.students = [];
        return count;
    }

    // --- Pickup Methods ---

    async addPickup(pickupData) {
        const newPickup = {
            ...pickupData,
            status: 'pending',
            // Ensure types match
            student_id: Number(pickupData.student_id)
        };
        this.pickups.push(newPickup);
        return newPickup;
    }

    async getPendingPickups() {
        return this.pickups
            .filter(p => p.status === 'pending')
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async getPendingPickupsByClass(year, className) {
        return this.pickups
            .filter(p => p.status === 'pending' && p.year === year && p.class === className)
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    async acknowledgePickup(pickupId) {
        const pickup = this.pickups.find(p => p.id === pickupId);
        if (pickup) {
            pickup.status = 'acknowledged';
            pickup.acknowledged_at = Date.now();
        }
        return pickup;
    }

    async getPickupHistory(limit = 100) {
        return [...this.pickups]
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    async clearOldPickups() {
        const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
        const originalLen = this.pickups.length;
        this.pickups = this.pickups.filter(p => !(p.status === 'acknowledged' && p.acknowledged_at < oneDayAgo));
        return originalLen - this.pickups.length;
    }

    // --- Parent/Family Methods ---

    async createFamily(name, code) {
        const family = {
            id: this.families.length + 1,
            name,
            code,
            created_at: Date.now()
        };
        this.families.push(family);
        return family;
    }

    async createUser(email, passwordHash, familyId) {
        const user = {
            id: this.users.length + 1,
            email,
            password_hash: passwordHash,
            role: 'pending', // Pending approval
            family_id: familyId,
            is_approved: false,
            created_at: Date.now(),
            must_change_password: false
        };
        this.users.push(user);
        return user;
    }

    async getUserByEmail(email) {
        return this.users.find(u => u.email === email);
    }

    async getFamilyByCode(code) {
        return this.families.find(f => f.code === code);
    }

    async getFamilyById(id) {
        return this.families.find(f => f.id === id);
    }

    async addStudentToFamily(studentId, familyId) {
        const student = this.students.find(s => s.id == studentId);
        if (student) {
            student.family_id = familyId;
        }
        return student;
    }

    async unlinkStudent(studentId) {
        const student = this.students.find(s => s.id == studentId);
        if (student) {
            student.family_id = null;
            return true;
        }
        return false;
    }

    async getFamilyMembers(familyId) {
        if (!familyId) return []; // Security Fix: Prevent returning all null-family students
        return this.students.filter(s => s.family_id == familyId).sort((a, b) => a.name.localeCompare(b.name));
    }

    async getUsers() {
        return this.users;
    }

    async adminResetPassword(userId, newPasswordHash) {
        const user = this.users.find(u => u.id == userId);
        if (user) {
            user.password_hash = newPasswordHash;
            user.must_change_password = true; // FORCE CHANGE
            return true;
        }
        return false;
    }

    async changePassword(userId, newPasswordHash) {
        const user = this.users.find(u => u.id == userId);
        if (user) {
            user.password_hash = newPasswordHash;
            user.must_change_password = false; // Reset flag
            return true;
        }
        return false;
    }
    async getPendingUsers() {
        return this.users
            .filter(u => u.role === 'parent' && !u.is_approved)
            .map(u => {
                const family = this.families.find(f => f.id === u.family_id);
                return { ...u, family_name: family ? family.name : 'Unknown' };
            })
            .sort((a, b) => b.created_at - a.created_at);
    }

    async approveUser(userId) {
        const user = this.users.find(u => u.id == userId);
        if (user) user.is_approved = true;
        return user;
    }

    async deleteUser(userId) {
        const initialLen = this.users.length;
        this.users = this.users.filter(u => u.id != userId);
        return initialLen - this.users.length;
    }

    // --- Daily Code Methods ---

    async generateDailyCode(code, familyId, studentIds) {
        // Check collision
        if (this.dailyCodes.find(c => c.code === code)) return null;

        const now = new Date();
        const expiresAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        const newCode = {
            code,
            family_id: familyId,
            student_ids: JSON.stringify(studentIds),
            expires_at: expiresAt,
            created_at: Date.now()
        };
        this.dailyCodes.push(newCode);
        return newCode;
    }

    async getDailyCode(code) {
        const now = Date.now();
        const dailyCode = this.dailyCodes.find(c => c.code === code && c.expires_at > now);
        if (!dailyCode) return null;

        let familyName = 'Unknown Family';
        if (dailyCode.family_id) {
            const family = this.families.find(f => f.id === dailyCode.family_id);
            if (family) familyName = family.name;
        }

        return {
            ...dailyCode,
            family_name: familyName
        };
    }

    async deleteExpiredCodes() {
        const now = Date.now();
        this.dailyCodes = this.dailyCodes.filter(c => c.expires_at >= now);
    }

    // --- Invite Methods ---

    async createParentInvite(email, name, role, studentIds, familyId) {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

        const invite = {
            code,
            email,
            name,
            role,
            student_ids: JSON.stringify(studentIds),
            family_id: familyId,
            is_used: false,
            expires_at: Date.now() + (7 * 24 * 60 * 60 * 1000),
            created_at: Date.now()
        };
        this.parentInvites.push(invite);
        return invite;
    }

    async getInviteByCode(code) {
        return this.parentInvites.find(i => i.code === code);
    }

    async markInviteUsed(code) {
        const invite = this.parentInvites.find(i => i.code === code);
        if (invite) invite.is_used = true;
    }

    async deleteInvite(code) {
        const initialLen = this.parentInvites.length;
        this.parentInvites = this.parentInvites.filter(i => i.code !== code);
        return initialLen - this.parentInvites.length > 0;
    }

    async getPendingInvites() {
        return this.parentInvites.filter(i => !i.is_used).sort((a, b) => b.created_at - a.created_at);
    }

    // --- Class Merge Methods ---

    async createMerge(sourceYear, sourceClass, hostYear, hostClass) {
        // Check if source is already merged somewhere
        const existingSourceMerge = this.merges.find(
            m => m.source_year === sourceYear && m.source_class === sourceClass
        );
        if (existingSourceMerge) {
            return { error: 'Source class is already merged' };
        }

        const merge = {
            id: this.merges.length + 1,
            source_year: sourceYear,
            source_class: sourceClass,
            host_year: hostYear,
            host_class: hostClass,
            created_at: Date.now()
        };
        this.merges.push(merge);
        return merge;
    }

    async deleteMerge(mergeId) {
        const initialLen = this.merges.length;
        this.merges = this.merges.filter(m => m.id != mergeId);
        return initialLen - this.merges.length;
    }

    async getActiveMerges() {
        return [...this.merges].sort((a, b) => b.created_at - a.created_at);
    }

    async getMergesForHost(hostYear, hostClass) {
        return this.merges.filter(
            m => m.host_year === hostYear && m.host_class === hostClass
        );
    }

    async getMergeForSource(sourceYear, sourceClass) {
        return this.merges.find(
            m => m.source_year === sourceYear && m.source_class === sourceClass
        );
    }

    async clearAllMerges() {
        const count = this.merges.length;
        this.merges = [];
        return count;
    }

    async close() {
        console.log("Mock database closed.");
    }
}

module.exports = PickupDatabase;
