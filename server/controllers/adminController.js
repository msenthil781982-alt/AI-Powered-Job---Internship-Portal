const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const RecruiterProfile = require('../models/RecruiterProfile');
const Job = require('../models/Job');
const Application = require('../models/Application');

// @desc    Get comprehensive admin platform statistics
// @route   GET /api/admin/stats
// @access  Private (Admin)
const getStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await User.countDocuments({ role: 'student' });
    const totalRecruiters = await User.countDocuments({ role: 'recruiter' });

    const totalJobs = await Job.countDocuments();
    const totalRegularJobs = await Job.countDocuments({ type: 'Job' });
    const totalInternships = await Job.countDocuments({ type: 'Internship' });
    const activeJobs = await Job.countDocuments({ status: 'Active' });
    const reportedJobs = await Job.countDocuments({ isReported: true });

    const totalApplications = await Application.countDocuments();
    const successfulPlacements = await Application.countDocuments({ status: 'Selected' });
    const inInterview = await Application.countDocuments({ status: 'Interview' });
    const shortlisted = await Application.countDocuments({ status: 'Shortlisted' });

    // Recent activity
    const recentApplications = await Application.find()
      .populate('studentId', 'name email avatar')
      .populate('jobId', 'title company')
      .sort({ appliedAt: -1 })
      .limit(6)
      .lean();

    const recentUsers = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean();

    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalRecruiters,
        totalUsers,
        totalJobs,
        totalRegularJobs,
        totalInternships,
        activeJobs,
        reportedJobs,
        totalApplications,
        successfulPlacements,
        inInterview,
        shortlisted
      },
      recentApplications,
      recentUsers
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all users with role filtering and search
// @route   GET /api/admin/users
// @access  Private (Admin)
const getUsers = async (req, res, next) => {
  try {
    const { role, q, page = 1, limit = 15 } = req.query;
    const query = {};

    if (role && role !== 'All') {
      query.role = role;
    }

    if (q && q.trim()) {
      const keyword = q.trim();
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
        { location: { $regex: keyword, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      users
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Admin)
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user.role === 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot delete primary admin account.' });
    }

    // Clean up corresponding profiles and records
    if (user.role === 'student') {
      await StudentProfile.deleteOne({ userId: user._id });
      await Application.deleteMany({ studentId: user._id });
    } else if (user.role === 'recruiter') {
      await RecruiterProfile.deleteOne({ userId: user._id });
      const recruiterJobs = await Job.find({ recruiterId: user._id }).select('_id');
      const jobIds = recruiterJobs.map(j => j._id);
      await Application.deleteMany({ jobId: { $in: jobIds } });
      await Job.deleteMany({ recruiterId: user._id });
    }

    await User.findByIdAndDelete(user._id);

    res.status(200).json({
      success: true,
      message: `User ${user.name} and related records removed.`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all jobs across platform
// @route   GET /api/admin/jobs
// @access  Private (Admin)
const getJobs = async (req, res, next) => {
  try {
    const { status, isReported, q, page = 1, limit = 15 } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    if (isReported === 'true') {
      query.isReported = true;
    }

    if (q && q.trim()) {
      const keyword = q.trim();
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { company: { $regex: keyword, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 15;
    const skip = (pageNum - 1) * limitNum;

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('recruiterId', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      count: jobs.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      jobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Moderate job (clear report or close)
// @route   PATCH /api/admin/jobs/:id/moderate
// @access  Private (Admin)
const moderateJob = async (req, res, next) => {
  try {
    const { action } = req.body; // 'dismiss_report' or 'close_job'
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (action === 'dismiss_report') {
      job.isReported = false;
      job.reportReason = '';
    } else if (action === 'close_job') {
      job.status = 'Closed';
    }

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job status updated by admin.',
      job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all applications platform-wide
// @route   GET /api/admin/applications
// @access  Private (Admin)
const getApplications = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'All') {
      query.status = status;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .populate('studentId', 'name email phone avatar')
      .populate('jobId', 'title company location type')
      .sort({ appliedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    res.status(200).json({
      success: true,
      count: applications.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      applications
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getStats,
  getUsers,
  deleteUser,
  getJobs,
  moderateJob,
  getApplications
};
