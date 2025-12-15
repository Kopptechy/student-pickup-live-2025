const { Pool } = require('pg');

class PickupDatabase {
  constructor() {
    // Use DATABASE_URL environment variable provided by Render
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    this.initializeTables();
  }

  async initializeTables() {
    const client = await this.pool.connect();
    try {
      // Students table
      await client.query(`
        CREATE TABLE IF NOT EXISTS students (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          year INTEGER NOT NULL,
          class TEXT NOT NULL
        )
      `);

      // Pickups table
      await client.query(`
        CREATE TABLE IF NOT EXISTS pickups (
          id TEXT PRIMARY KEY,
          student_id INTEGER NOT NULL,
          student_name TEXT NOT NULL,
          year INTEGER NOT NULL,
          class TEXT NOT NULL,
          timestamp BIGINT NOT NULL,
          status TEXT DEFAULT 'pending',
          acknowledged_at BIGINT,
          FOREIGN KEY (student_id) REFERENCES students(id)
        )
      `);

      // Create indexes for faster queries
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_pickups_status ON pickups(status);
        CREATE INDEX IF NOT EXISTS idx_pickups_class ON pickups(class);
        CREATE INDEX IF NOT EXISTS idx_students_class ON students(year, class);
      `);

      // Parent Portal Tables

      // Families table
      await client.query(`
        CREATE TABLE IF NOT EXISTS families (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          code TEXT UNIQUE NOT NULL,
          created_at BIGINT DEFAULT extract(epoch from now()) * 1000
        )
      `);

      // Add family_id to students if it doesn't exist
      await client.query(`
        ALTER TABLE students 
        ADD COLUMN IF NOT EXISTS family_id INTEGER REFERENCES families(id)
      `);

      // Users table (Parents/Admins)
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT DEFAULT 'parent',
          name TEXT, -- Added for "Welcome Mr. X"
          is_approved BOOLEAN DEFAULT false,
          family_id INTEGER REFERENCES families(id),
          created_at BIGINT DEFAULT extract(epoch from now()) * 1000
        )
      `);

      // Parent Invites Table (New)
      await client.query(`
        CREATE TABLE IF NOT EXISTS parent_invites (
          code TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL, -- 'Father', 'Mother', 'Guardian'
          student_ids TEXT NOT NULL, -- JSON string of IDs
          family_id INTEGER, -- Optional linkage
          is_used BOOLEAN DEFAULT FALSE,
          expires_at BIGINT NOT NULL,
          created_at BIGINT DEFAULT extract(epoch from now()) * 1000
        )
      `);

      // Daily Pickup Codes
      await client.query(`
        CREATE TABLE IF NOT EXISTS daily_codes (
          code TEXT PRIMARY KEY,
          family_id INTEGER REFERENCES families(id),
          student_ids TEXT NOT NULL,
          expires_at BIGINT NOT NULL,
          created_at BIGINT DEFAULT extract(epoch from now()) * 1000
        )
      `);

      // Class Merges Table
      await client.query(`
        CREATE TABLE IF NOT EXISTS class_merges (
          id SERIAL PRIMARY KEY,
          source_year INTEGER NOT NULL,
          source_class TEXT NOT NULL,
          host_year INTEGER NOT NULL,
          host_class TEXT NOT NULL,
          created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
          UNIQUE(source_year, source_class) -- A class can only be merged into one place at a time
        )
      `);

      // Mock data seeding disabled - add real students via admin interface
      console.log('Database ready. Add students through the admin interface.');
    } finally {
      client.release();
    }
  }

  async seedMockData(client) {
    console.log('Seeding database with mock student data...');

    const firstNames = [
      'James', 'Emma', 'Oliver', 'Sophia', 'William', 'Ava', 'Benjamin', 'Isabella',
      'Lucas', 'Mia', 'Henry', 'Charlotte', 'Alexander', 'Amelia', 'Michael', 'Harper',
      'Daniel', 'Evelyn', 'Matthew', 'Abigail', 'Joseph', 'Emily', 'David', 'Elizabeth',
      'Samuel', 'Sofia', 'Jackson', 'Avery', 'Sebastian', 'Ella', 'Gabriel', 'Scarlett',
      'Carter', 'Grace', 'Jayden', 'Chloe', 'John', 'Victoria', 'Dylan', 'Riley',
      'Luke', 'Aria', 'Anthony', 'Lily', 'Isaac', 'Aubrey', 'Grayson', 'Zoey',
      'Jack', 'Penelope', 'Julian', 'Lillian', 'Levi', 'Addison', 'Christopher', 'Layla',
      'Joshua', 'Natalie', 'Andrew', 'Camila', 'Lincoln', 'Hannah', 'Mateo', 'Brooklyn'
    ];

    const lastNames = [
      'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
      'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas',
      'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris',
      'Clark', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright'
    ];

    const students = [];
    let nameIndex = 0;

    // Year 7-11: Blue, Green, Red (15 classes)
    for (let year = 7; year <= 11; year++) {
      for (const color of ['blue', 'green', 'red']) {
        // 15-20 students per class
        const studentsPerClass = 15 + Math.floor(Math.random() * 6);
        for (let i = 0; i < studentsPerClass; i++) {
          const firstName = firstNames[nameIndex % firstNames.length];
          const lastName = lastNames[Math.floor(nameIndex / firstNames.length) % lastNames.length];
          students.push({
            name: `${firstName} ${lastName}`,
            year: year,
            class: color
          });
          nameIndex++;
        }
      }
    }

    // Year 12: Blue, Red (2 classes)
    for (const color of ['blue', 'red']) {
      const studentsPerClass = 12 + Math.floor(Math.random() * 6);
      for (let i = 0; i < studentsPerClass; i++) {
        const firstName = firstNames[nameIndex % firstNames.length];
        const lastName = lastNames[Math.floor(nameIndex / firstNames.length) % lastNames.length];
        students.push({
          name: `${firstName} ${lastName}`,
          year: 12,
          class: color
        });
        nameIndex++;
      }
    }

    // Batch insert students
    for (const student of students) {
      await client.query(
        'INSERT INTO students (name, year, class) VALUES ($1, $2, $3)',
        [student.name, student.year, student.class]
      );
    }

    console.log(`Seeded ${students.length} students across 17 classes`);
  }

  // Get all students
  async getAllStudents() {
    const result = await this.pool.query('SELECT * FROM students ORDER BY year, class, name');
    return result.rows;
  }

  // Get students by year and class
  async getStudentsByClass(year, className) {
    const result = await this.pool.query(
      'SELECT * FROM students WHERE year = $1 AND class = $2 ORDER BY name',
      [year, className]
    );
    return result.rows;
  }

  // Get all years
  async getYears() {
    const result = await this.pool.query('SELECT DISTINCT year FROM students ORDER BY year');
    return result.rows;
  }

  // Get all students in a year (regardless of class)
  async getStudentsByYear(year) {
    const result = await this.pool.query(
      'SELECT * FROM students WHERE year = $1 ORDER BY class, name',
      [year]
    );
    return result.rows;
  }

  // Get classes for a specific year
  async getClassesByYear(year) {
    const result = await this.pool.query(
      'SELECT DISTINCT class FROM students WHERE year = $1 ORDER BY class',
      [year]
    );
    return result.rows;
  }

  // Add a new pickup to the queue
  async addPickup(pickupData) {
    const result = await this.pool.query(
      `INSERT INTO pickups (id, student_id, student_name, year, class, timestamp, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        pickupData.id,
        pickupData.student_id,
        pickupData.student_name,
        pickupData.year,
        pickupData.class,
        pickupData.timestamp
      ]
    );
    return result.rows[0];
  }

  // Get all pending pickups
  async getPendingPickups() {
    const result = await this.pool.query(
      "SELECT * FROM pickups WHERE status = 'pending' ORDER BY timestamp"
    );
    return result.rows;
  }

  // Get pending pickups for a specific class
  async getPendingPickupsByClass(year, className) {
    const result = await this.pool.query(
      "SELECT * FROM pickups WHERE status = 'pending' AND year = $1 AND class = $2 ORDER BY timestamp",
      [year, className]
    );
    return result.rows;
  }

  // Acknowledge a pickup (mark as sent)
  async acknowledgePickup(pickupId) {
    const result = await this.pool.query(
      `UPDATE pickups 
       SET status = 'acknowledged', acknowledged_at = $1
       WHERE id = $2
       RETURNING *`,
      [Date.now(), pickupId]
    );
    return result.rows[0];
  }

  // Get pickup history
  async getPickupHistory(limit = 100) {
    const result = await this.pool.query(
      'SELECT * FROM pickups ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  }

  // Clear old acknowledged pickups (older than 24 hours)
  async clearOldPickups() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const result = await this.pool.query(
      "DELETE FROM pickups WHERE status = 'acknowledged' AND acknowledged_at < $1",
      [oneDayAgo]
    );
    return result.rowCount;
  }

  // Add a new student
  async addStudent(name, year, className) {
    const result = await this.pool.query(
      'INSERT INTO students (name, year, class) VALUES ($1, $2, $3) RETURNING *',
      [name, year, className]
    );
    return result.rows[0];
  }

  // Add multiple students in a batch
  async addStudentsBatch(students) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      for (const student of students) {
        await client.query(
          'INSERT INTO students (name, year, class) VALUES ($1, $2, $3)',
          [student.name, student.year, student.class]
        );
      }

      await client.query('COMMIT');
      return students.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete a student
  async deleteStudent(id) {
    // First delete any pickups associated with this student
    await this.pool.query('DELETE FROM pickups WHERE student_id = $1', [id]);

    // Then delete the student
    const result = await this.pool.query('DELETE FROM students WHERE id = $1', [id]);
    return result.rowCount;
  }

  // Update a student
  async updateStudent(id, name, year, className) {
    const result = await this.pool.query(
      'UPDATE students SET name = $1, year = $2, class = $3 WHERE id = $4 RETURNING *',
      [name, year, className, id]
    );
    return result.rows[0];
  }

  // Delete all students
  async deleteAllStudents() {
    const result = await this.pool.query('DELETE FROM students');
    return result.rowCount;
  }

  // --- Parent Portal Methods ---

  async createFamily(name, code) {
    const result = await this.pool.query(
      'INSERT INTO families (name, code) VALUES ($1, $2) RETURNING *',
      [name, code]
    );
    return result.rows[0];
  }

  async createUser(email, passwordHash, familyId) {
    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash, family_id, is_approved)
       VALUES ($1, $2, $3, false)
       RETURNING id, email, role, is_approved, family_id`,
      [email, passwordHash, familyId]
    );
    return result.rows[0];
  }

  async getUserByEmail(email) {
    const result = await this.pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0];
  }

  async getAllUsers() {
    const result = await this.pool.query('SELECT * FROM users ORDER BY created_at DESC');
    return result.rows;
  }

  async getFamilyByCode(code) {
    const result = await this.pool.query('SELECT * FROM families WHERE code = $1', [code]);
    return result.rows[0];
  }

  async addStudentToFamily(studentId, familyId) {
    const result = await this.pool.query(
      'UPDATE students SET family_id = $1 WHERE id = $2 RETURNING *',
      [familyId, studentId]
    );
    return result.rows[0];
  }

  async getFamilyMembers(familyId) {
    const result = await this.pool.query(
      'SELECT * FROM students WHERE family_id = $1 ORDER BY name',
      [familyId]
    );
    return result.rows;
  }

  async getPendingUsers() {
    const result = await this.pool.query(`
          SELECT u.id, u.email, u.created_at, f.name as family_name 
          FROM users u
          LEFT JOIN families f ON u.family_id = f.id
          WHERE u.is_approved = false AND u.role = 'parent'
          ORDER BY u.created_at DESC
      `);
    return result.rows;
  }

  async approveUser(userId) {
    const result = await this.pool.query(
      'UPDATE users SET is_approved = true WHERE id = $1 RETURNING *',
      [userId]
    );
    return result.rows[0];
  }

  async deleteUser(userId) {
    const result = await this.pool.query('DELETE FROM users WHERE id = $1', [userId]);
    return result.rowCount;
  }

  async generateDailyCode(code, familyId, studentIds) {
    // Expires at midnight (23:59:59) tonight
    const now = new Date();
    // Set to end of day in local time (server time)
    const expiresAt = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    const result = await this.pool.query(
      `INSERT INTO daily_codes (code, family_id, student_ids, expires_at)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (code) DO NOTHING
           RETURNING *`,
      [code, familyId, JSON.stringify(studentIds), expiresAt]
    );
    return result.rows[0]; // Returns undefined if code exists (collision)
  }

  async getDailyCode(code) {
    const now = Date.now();
    const result = await this.pool.query(
      `SELECT daily_codes.*, families.name as family_name 
           FROM daily_codes 
           JOIN families ON daily_codes.family_id = families.id
           WHERE code = $1 AND expires_at > $2`,
      [code, now]
    );
    return result.rows[0];
  }

  async deleteExpiredCodes() {
    const now = Date.now();
    await this.pool.query('DELETE FROM daily_codes WHERE expires_at < $1', [now]);
  }

  // --- PREMIUM ONBOARDING METHODS ---

  async createParentInvite(email, name, role, studentIds, familyId = null) {
    // Generate 6-char alpha-numeric code (avoid ambiguous chars)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days expiry

    const result = await this.pool.query(
      `INSERT INTO parent_invites (code, email, name, role, student_ids, family_id, is_used, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)
           RETURNING *`,
      [code, email, name, role, JSON.stringify(studentIds), familyId, expiresAt]
    );
    return result.rows[0];
  }

  async getInviteByCode(code) {
    const result = await this.pool.query('SELECT * FROM parent_invites WHERE code = $1', [code]);
    return result.rows[0];
  }

  async markInviteUsed(code) {
    await this.pool.query('UPDATE parent_invites SET is_used = TRUE WHERE code = $1', [code]);
  }

  async getPendingInvites() {
    // Return ACTIVE invites that haven't been used
    const result = await this.pool.query('SELECT * FROM parent_invites WHERE is_used = FALSE ORDER BY created_at DESC');
    return result.rows;
  }

  // --- CLASS MERGE METHODS ---

  async createMerge(sourceYear, sourceClass, hostYear, hostClass) {
    try {
      const result = await this.pool.query(
        `INSERT INTO class_merges (source_year, source_class, host_year, host_class)
             VALUES ($1, $2, $3, $4)
             RETURNING *`,
        [sourceYear, sourceClass, hostYear, hostClass]
      );
      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') { // Unique violation
        return { error: 'Source class is already merged' };
      }
      throw error;
    }
  }

  async deleteMerge(mergeId) {
    const result = await this.pool.query('DELETE FROM class_merges WHERE id = $1', [mergeId]);
    return result.rowCount;
  }

  async getActiveMerges() {
    const result = await this.pool.query('SELECT * FROM class_merges ORDER BY created_at DESC');
    return result.rows;
  }

  async getMergesForHost(hostYear, hostClass) {
    const result = await this.pool.query(
      'SELECT * FROM class_merges WHERE host_year = $1 AND host_class = $2',
      [hostYear, hostClass]
    );
    return result.rows;
  }

  async getMergeForSource(sourceYear, sourceClass) {
    const result = await this.pool.query(
      'SELECT * FROM class_merges WHERE source_year = $1 AND source_class = $2',
      [sourceYear, sourceClass]
    );
    return result.rows[0];
  }

  async clearAllMerges() {
    const result = await this.pool.query('DELETE FROM class_merges');
    return result.rowCount;
  }

  // --- PASSWORD RESET METHODS ---
  async adminResetPassword(userId, newPasswordHash) {
    const result = await this.pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2 RETURNING *',
      [newPasswordHash, userId]
    );
    return result.rowCount > 0;
  }

  async changePassword(userId, newPasswordHash) {
    const result = await this.pool.query(
      'UPDATE users SET password_hash = $1, must_change_password = FALSE WHERE id = $2 RETURNING *',
      [newPasswordHash, userId]
    );
    return result.rowCount > 0;
  }

  // --- UNLINK METHODS ---
  async unlinkStudent(studentId) {
    const result = await this.pool.query(
      'UPDATE students SET family_id = NULL WHERE id = $1',
      [studentId]
    );
    return result.rowCount > 0;
  }

  async deleteInvite(code) {
    const result = await this.pool.query('DELETE FROM parent_invites WHERE code = $1', [code]);
    return result.rowCount > 0;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PickupDatabase;
