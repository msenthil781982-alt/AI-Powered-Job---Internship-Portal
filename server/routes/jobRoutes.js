const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
  reportJob
} = require('../controllers/jobController');
const { authenticate, authorize } = require('../middleware/auth');

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'careermatch_ai_super_secret_jwt_key_2026_secure');
      req.user = await User.findById(decoded.id).select('-password');
    } catch (err) {
      // Continue unauthenticated if token invalid
      req.user = null;
    }
  }
  next();
};

router.get('/', optionalAuth, getJobs);
router.get('/:id', optionalAuth, getJobById);
router.post('/', authenticate, authorize('recruiter', 'admin'), createJob);
router.put('/:id', authenticate, authorize('recruiter', 'admin'), updateJob);
router.delete('/:id', authenticate, authorize('recruiter', 'admin'), deleteJob);
router.patch('/:id/status', authenticate, authorize('recruiter', 'admin'), toggleJobStatus);
router.post('/:id/report', authenticate, reportJob);

module.exports = router;
