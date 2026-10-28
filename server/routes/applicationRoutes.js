const express = require('express');
const router = express.Router();
const {
  applyForJob,
  getMyApplications,
  getApplicationById,
  updateApplicationStatus
} = require('../controllers/applicationController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', authorize('student'), applyForJob);
router.get('/my', authorize('student'), getMyApplications);
router.get('/:id', getApplicationById);
router.patch('/:id/status', authorize('recruiter', 'admin'), updateApplicationStatus);

module.exports = router;
