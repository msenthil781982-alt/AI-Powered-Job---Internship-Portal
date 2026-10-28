const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getMyJobs,
  getJobApplicants,
  getDashboardStats,
  getCandidateProfile
} = require('../controllers/recruiterController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.use(authorize('recruiter', 'admin'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.get('/jobs', getMyJobs);
router.get('/jobs/:id/applicants', getJobApplicants);
router.get('/dashboard', getDashboardStats);
router.get('/candidates/:studentId', getCandidateProfile);

module.exports = router;
