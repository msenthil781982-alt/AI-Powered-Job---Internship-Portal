const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  uploadResume,
  deleteResume,
  getRecommendations,
  getSavedJobs,
  saveJob,
  removeSavedJob
} = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All student routes require authentication and 'student' role
router.use(authenticate);
router.use(authorize('student'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/resume', upload.single('resume'), uploadResume);
router.delete('/resume', deleteResume);
router.get('/recommendations', getRecommendations);
router.get('/saved-jobs', getSavedJobs);
router.post('/saved-jobs/:jobId', saveJob);
router.delete('/saved-jobs/:jobId', removeSavedJob);

module.exports = router;
