const express = require('express');
const { body, validationResult } = require('express-validator');
const { User } = require('../models');
const { authRateLimit, validateSession, logActivity } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', 
  authRateLimit,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists with this email',
        code: 'USER_EXISTS'
      });
    }

    // Create new user
    const user = await User.create({
      email,
      password_hash: password, // Will be hashed by model hook
      role: 'editor', // Default role
      first_name: firstName,
      last_name: lastName,
      is_active: true
    });

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;

    logger.info('New user registered', {
      userId: user.id,
      email: user.email,
      role: user.role,
      ip: req.ip
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.getFullName(),
        preferences: user.preferences,
        createdAt: user.created_at
      }
    });
  })
);

/**
 * POST /api/auth/login
 * Authenticate user and create session
 */
router.post('/login',
  authRateLimit,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Valid email is required'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user || !user.is_active) {
      // Log failed login attempt
      logger.warn('Failed login attempt', {
        email,
        reason: user ? 'inactive_user' : 'user_not_found',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      logger.warn('Failed login attempt', {
        userId: user.id,
        email: user.email,
        reason: 'invalid_password',
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        error: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Update last login
    await user.updateLastLogin();

    // Create session
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    req.session.userRole = user.role;

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
      lastLogin: user.last_login,
      ip: req.ip
    });

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.getFullName(),
        preferences: user.preferences,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  })
);

/**
 * POST /api/auth/logout
 * Destroy user session
 */
router.post('/logout',
  validateSession,
  logActivity('logout'),
  asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const userEmail = req.session.userEmail;

    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction error:', err);
        return res.status(500).json({
          error: 'Failed to logout',
          code: 'LOGOUT_ERROR'
        });
      }

      logger.info('User logged out', {
        userId,
        email: userEmail,
        ip: req.ip
      });

      res.json({
        message: 'Logout successful'
      });
    });
  })
);

/**
 * GET /api/auth/session
 * Probe the current session state. Always responds with HTTP 200 — the
 * absence of a session is a legitimate state, not an error. Clients
 * (frontend AuthContext) read `authenticated` to decide whether to
 * surface a logged-in UI or redirect to the login page.
 *
 * Returning 401 here would force the frontend to console.error on every
 * unauthenticated page load, polluting logs and dev tools without
 * carrying real information.
 */
router.get('/session',
  asyncHandler(async (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.json({ authenticated: false, user: null });
    }
    const user = await User.findByPk(req.session.userId);
    if (!user || !user.is_active) {
      return res.json({ authenticated: false, user: null });
    }
    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.getFullName(),
        preferences: user.preferences,
        lastLogin: user.last_login,
        createdAt: user.created_at
      }
    });
  })
);

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile',
  validateSession,
  [
    body('firstName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('First name must be between 1 and 50 characters'),
    body('lastName')
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage('Last name must be between 1 and 50 characters'),
    body('preferences')
      .optional()
      .isObject()
      .withMessage('Preferences must be an object')
  ],
  logActivity('profile_update'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { firstName, lastName, preferences } = req.body;
    const user = req.user;

    // Update user profile
    const updateData = {};
    if (firstName !== undefined) updateData.first_name = firstName;
    if (lastName !== undefined) updateData.last_name = lastName;
    if (preferences !== undefined) {
      updateData.preferences = { ...user.preferences, ...preferences };
    }

    if (Object.keys(updateData).length > 0) {
      await user.update(updateData);
    }

    logger.info('User profile updated', {
      userId: user.id,
      email: user.email,
      updatedFields: Object.keys(updateData)
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
        fullName: user.getFullName(),
        preferences: user.preferences,
        updatedAt: user.updated_at
      }
    });
  })
);

/**
 * PUT /api/auth/change-password
 * Change user password
 */
router.put('/change-password',
  validateSession,
  authRateLimit,
  [
    body('currentPassword')
      .notEmpty()
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
      .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
  ],
  logActivity('password_change'),
  asyncHandler(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;
    const user = req.user;

    // Validate current password
    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      logger.warn('Password change attempt with invalid current password', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });

      return res.status(401).json({
        error: 'Current password is incorrect',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }

    // Update password
    await user.update({
      password_hash: newPassword // Will be hashed by model hook
    });

    logger.info('User password changed', {
      userId: user.id,
      email: user.email,
      ip: req.ip
    });

    res.json({
      message: 'Password changed successfully'
    });
  })
);

module.exports = router;
