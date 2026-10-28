const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const RecruiterProfile = require('../models/RecruiterProfile');

// Helper to generate JWT token
const signToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'careermatch_ai_super_secret_jwt_key_2026_secure',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// @desc    Register a new user (Student or Recruiter)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, location, companyName, college, degree, graduationYear } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.'
      });
    }

    const assignedRole = role === 'recruiter' ? 'recruiter' : 'student';

    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password,
      role: assignedRole,
      phone: phone || '',
      location: location || ''
    });

    // Create corresponding profile
    if (assignedRole === 'student') {
      await StudentProfile.create({
        userId: user._id,
        degree: degree || 'B.Tech / B.E. Computer Science',
        college: college || 'National Institute of Technology',
        graduationYear: graduationYear || new Date().getFullYear(),
        skills: ['JavaScript', 'React', 'HTML5', 'CSS3', 'Git'],
        careerInterests: ['Full Stack Development', 'Frontend Engineering']
      });
    } else if (assignedRole === 'recruiter') {
      await RecruiterProfile.create({
        userId: user._id,
        companyName: companyName || `${name}'s Tech Corp`,
        companyDescription: 'Innovating software solutions and hiring top talent.',
        industry: 'Information Technology',
        location: location || 'Bangalore, India',
        website: 'https://example.com'
      });
    }

    const token = signToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password.'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    const token = signToken(user._id);

    // Fetch profile info for instant frontend hydration
    let profileData = null;
    if (user.role === 'student') {
      profileData = await StudentProfile.findOne({ userId: user._id });
    } else if (user.role === 'recruiter') {
      profileData = await RecruiterProfile.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
        avatar: user.avatar,
        profile: profileData
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
const logout = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Logged out successfully.'
  });
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    let profile = null;

    if (user.role === 'student') {
      profile = await StudentProfile.findOne({ userId: user._id });
    } else if (user.role === 'recruiter') {
      profile = await RecruiterProfile.findOne({ userId: user._id });
    }

    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        location: user.location,
        avatar: user.avatar,
        profile
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe
};
