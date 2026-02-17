// services/auth-service.js - Authentication and user management service
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

class AuthService {
  constructor() {
    this.usersFilePath = path.join(__dirname, '..', 'data', 'users.json');
    this.secretKey = process.env.JWT_SECRET || 'icrc_secret_key_for_demo';
    this.saltRounds = 10;
    
    // Create data directory if it doesn't exist
    const dataDir = path.dirname(this.usersFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize users file if it doesn't exist
    if (!fs.existsSync(this.usersFilePath)) {
      fs.writeFileSync(this.usersFilePath, JSON.stringify([]), 'utf8');
    }
  }

  /**
   * Hashes a password using bcrypt
   * @param {string} password - Plain text password
   * @returns {Promise<string>} Hashed password
   */
  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  /**
   * Compares a plain text password with a hashed password
   * @param {string} plainPassword - Plain text password
   * @param {string} hashedPassword - Hashed password
   * @returns {Promise<boolean>} True if passwords match
   */
  async comparePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Generates a JWT token for a user
   * @param {Object} user - User object
   * @returns {string} JWT token
   */
  generateToken(user) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      this.secretKey,
      { expiresIn: '24h' }
    );
  }

  /**
   * Verifies a JWT token
   * @param {string} token - JWT token
   * @returns {Object|null} Decoded user data or null if invalid
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.secretKey);
    } catch (error) {
      return null;
    }
  }

  /**
   * Reads all users from the file
   * @returns {Array} Array of user objects
   */
  getUsers() {
    const data = fs.readFileSync(this.usersFilePath, 'utf8');
    return JSON.parse(data);
  }

  /**
   * Writes users to the file
   * @param {Array} users - Array of user objects
   */
  saveUsers(users) {
    fs.writeFileSync(this.usersFilePath, JSON.stringify(users, null, 2), 'utf8');
  }

  /**
   * Registers a new user
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @param {string} role - User's role ('admin' or 'user')
   * @returns {Object} Result object with success status and user data
   */
  async registerUser(email, password, role = 'user') {
    // Validate inputs
    if (!email || !password) {
      return { success: false, message: 'Email and password are required' };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: 'Invalid email format' };
    }

    // Validate password strength
    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters long' };
    }

    // Check if user already exists
    const users = this.getUsers();
    const existingUser = users.find(user => user.email === email);
    if (existingUser) {
      return { success: false, message: 'User with this email already exists' };
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(password);

    // Create new user
    const newUser = {
      id: Date.now().toString(), // Simple ID generation for demo
      email,
      password: hashedPassword,
      role,
      status: 'Pending', // New users start as pending approval
      createdAt: new Date().toISOString(),
      lastLogin: null
    };

    // Save the new user
    users.push(newUser);
    this.saveUsers(users);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = newUser;
    return { 
      success: true, 
      message: 'User registered successfully', 
      user: userWithoutPassword 
    };
  }

  /**
   * Authenticates a user
   * @param {string} email - User's email
   * @param {string} password - User's password
   * @returns {Object} Result object with success status and token
   */
  async authenticateUser(email, password) {
    // Validate inputs
    if (!email || !password) {
      return { success: false, message: 'Email and password are required' };
    }

    // Find user
    const users = this.getUsers();
    const user = users.find(user => user.email === email);
    
    if (!user) {
      return { success: false, message: 'Invalid email or password' };
    }

    // Compare password
    const isPasswordValid = await this.comparePassword(password, user.password);
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid email or password' };
    }

    // Check if user is approved
    if (user.status !== 'Approved') {
      return { 
        success: false, 
        message: 'Access denied: Account pending HQ approval' 
      };
    }

    // Update last login
    user.lastLogin = new Date().toISOString();
    this.saveUsers(users);

    // Generate token
    const token = this.generateToken(user);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    return { 
      success: true, 
      message: 'Authentication successful', 
      token,
      user: userWithoutPassword
    };
  }

  /**
   * Gets a user by ID
   * @param {string} userId - User ID
   * @returns {Object|null} User object or null if not found
   */
  getUserById(userId) {
    const users = this.getUsers();
    return users.find(user => user.id === userId);
  }

  /**
   * Updates user role (admin only)
   * @param {string} userId - ID of user to update
   * @param {string} newRole - New role ('admin' or 'user')
   * @param {string} adminUserId - ID of admin performing the action
   * @returns {Object} Result object
   */
  updateUserRole(userId, newRole, adminUserId) {
    // Verify admin user
    const adminUser = this.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return { success: false, message: 'Only admins can update user roles' };
    }

    // Validate new role
    if (!['admin', 'user'].includes(newRole)) {
      return { success: false, message: 'Invalid role specified' };
    }

    // Find and update user
    const users = this.getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'User not found' };
    }

    users[userIndex].role = newRole;
    this.saveUsers(users);

    return { success: true, message: 'User role updated successfully' };
  }

  /**
   * Deletes a user (admin only)
   * @param {string} userId - ID of user to delete
   * @param {string} adminUserId - ID of admin performing the action
   * @returns {Object} Result object
   */
  deleteUser(userId, adminUserId) {
    // Verify admin user
    const adminUser = this.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return { success: false, message: 'Only admins can delete users' };
    }

    // Prevent admin from deleting themselves
    if (userId === adminUserId) {
      return { success: false, message: 'Admin cannot delete their own account' };
    }

    // Find and remove user
    let users = this.getUsers();
    const initialLength = users.length;
    users = users.filter(user => user.id !== userId);
    
    if (users.length === initialLength) {
      return { success: false, message: 'User not found' };
    }

    this.saveUsers(users);
    return { success: true, message: 'User deleted successfully' };
  }

  /**
   * Approves a user (admin only)
   * @param {string} userId - ID of user to approve
   * @param {string} adminUserId - ID of admin performing the action
   * @param {string} newRole - New role to assign to the user
   * @returns {Object} Result object
   */
  approveUser(userId, adminUserId, newRole) {
    // Verify admin user
    const adminUser = this.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return { success: false, message: 'Only admins can approve users' };
    }

    // Find and update user
    const users = this.getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'User not found' };
    }

    users[userIndex].status = 'Approved';
    if (newRole) {
      users[userIndex].role = newRole;
    }

    this.saveUsers(users);
    return { success: true, message: 'User approved successfully' };
  }

  /**
   * Gets all pending users (admin only)
   * @param {string} adminUserId - ID of admin requesting the list
   * @returns {Array} Array of pending users
   */
  getPendingUsers(adminUserId) {
    // Verify admin user
    const adminUser = this.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return [];
    }

    const users = this.getUsers();
    return users.filter(user => user.status === 'Pending');
  }

  /**
   * Sets user status (admin only)
   * @param {string} userId - ID of user to update
   * @param {string} adminUserId - ID of admin performing the action
   * @param {string} status - New status ('Pending', 'Approved', 'Suspended')
   * @returns {Object} Result object
   */
  setUserStatus(userId, adminUserId, status) {
    // Verify admin user
    const adminUser = this.getUserById(adminUserId);
    if (!adminUser || adminUser.role !== 'admin') {
      return { success: false, message: 'Only admins can update user status' };
    }

    // Validate status
    if (!['Pending', 'Approved', 'Suspended'].includes(status)) {
      return { success: false, message: 'Invalid status specified' };
    }

    // Find and update user
    const users = this.getUsers();
    const userIndex = users.findIndex(user => user.id === userId);
    
    if (userIndex === -1) {
      return { success: false, message: 'User not found' };
    }

    users[userIndex].status = status;
    this.saveUsers(users);

    return { success: true, message: 'User status updated successfully' };
  }
}

module.exports = AuthService;