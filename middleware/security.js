// middleware/security.js - Security middleware for the application
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const AuthService = require('../services/auth-service');

const authService = new AuthService();

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Login rate limiting (stricter)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    message: 'Too many login attempts from this IP, please try again later.'
  },
  skipSuccessfulRequests: true, // Don't count successful logins towards the limit
});

// CORS middleware
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  // Get token from header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  // Verify token
  const decoded = authService.verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  // Attach user info to request
  req.user = decoded;
  next();
};

// Authorization middleware (role-based)
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

const cookieParser = require('cookie-parser');

// Apply helmet security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      "default-src": ["'self'"],
      // FIX: Added 'unsafe-eval' so Alpine.js can read its own directives
      "script-src": [
        "'self'", 
        "'unsafe-inline'", 
        "'unsafe-eval'", 
        "https://cdn.tailwindcss.com", 
        "https://cdn.jsdelivr.net", 
        "https://unpkg.com"
      ],
      "style-src": [
        "'self'", 
        "'unsafe-inline'", 
        "https://cdn.tailwindcss.com", 
        "https://fonts.googleapis.com"
      ],
      "img-src": [
        "'self'", 
        "data:", 
        "https://images.unsplash.com", 
        "https://openweathermap.org"
      ],
      // FIX: Added unpkg.com and cdn.jsdelivr.net so browser can download the libraries
      "connect-src": [
        "'self'", 
        "https://api.openweathermap.org", 
        "https://opensky-network.org", 
        "https://api.reliefweb.int",
        "https://unpkg.com",
        "https://cdn.jsdelivr.net"
      ],
      "font-src": ["'self'", "https://fonts.gstatic.com"],
      "object-src": ["'none'"],
      "upgrade-insecure-requests": [],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
});

module.exports = {
  limiter,
  loginLimiter,
  corsOptions,
  authenticateToken,
  authorizeRoles,
  securityHeaders,
  cookieParser
};