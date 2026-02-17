// services/logging-service.js - Audit logging service for the ICRC platform
const fs = require('fs');
const path = require('path');

class LoggingService {
  constructor() {
    this.logsDir = path.join(__dirname, '..', 'logs');
    this.logFile = path.join(this.logsDir, 'audit.log');
    
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
    
    // Create log file if it doesn't exist
    if (!fs.existsSync(this.logFile)) {
      fs.writeFileSync(this.logFile, '');
    }
  }

  /**
   * Logs an event to the audit log
   * @param {string} userId - ID of the user performing the action
   * @param {string} userEmail - Email of the user performing the action
   * @param {string} action - Action performed
   * @param {string} details - Additional details about the action
   */
  logEvent(userId, userEmail, action, details = '') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] USER_ID: ${userId} | EMAIL: ${userEmail} | ACTION: ${action} | DETAILS: ${details}\n`;
    
    fs.appendFileSync(this.logFile, logEntry);
  }

  /**
   * Gets recent logs
   * @param {number} limit - Number of recent logs to return (default: 50)
   * @returns {Array} Array of log entries
   */
  getRecentLogs(limit = 50) {
    try {
      const data = fs.readFileSync(this.logFile, 'utf8');
      const lines = data.trim().split('\n').filter(line => line.trim() !== '');
      
      // Return the last 'limit' entries
      return lines.slice(-limit).reverse(); // Reverse to show newest first
    } catch (error) {
      console.error('Error reading logs:', error.message);
      return [];
    }
  }

  /**
   * Gets all logs (admin only)
   * @returns {string} Full log content
   */
  getAllLogs() {
    try {
      return fs.readFileSync(this.logFile, 'utf8');
    } catch (error) {
      console.error('Error reading logs:', error.message);
      return '';
    }
  }

  /**
   * Clears the log file (admin only)
   */
  clearLogs() {
    try {
      fs.writeFileSync(this.logFile, '');
      return { success: true, message: 'Logs cleared successfully' };
    } catch (error) {
      console.error('Error clearing logs:', error.message);
      return { success: false, message: 'Failed to clear logs' };
    }
  }
}

module.exports = LoggingService;