const RecruiterProfile = require('../models/RecruiterProfile');
const Job = require('../models/Job');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');

// @desc    Get recruiter company profile
// @route   GET /api/recruiter/profile
// @access  Private (Recruiter)
const getProfile = async (req, res, next) => {
  try {
    let profile = await RecruiterProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await RecruiterProfile.create({
        userId: req.user._id,
        companyName: `${req.user.name}'s Company`
      });
    }

    const user = await User.findById(req.user._id).select('-password');

    res.status(200).json({
      success: true,
      profile,
      user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update recruiter profile
// @route   PUT /api/recruiter/profile
// @access  Private (Recruiter)
const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      location,
      companyName,
      companyDescription,
      website,
      industry,
      companySize,
      logo
    } = req.body;

    if (name || phone !== undefined || location !== undefined) {
      await User.findByIdAndUpdate(req.user._id, {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location })
      });
    }

    let profile = await RecruiterProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new RecruiterProfile({ userId: req.user._id, companyName: companyName || req.user.name });
    }

    if (companyName) profile.companyName = companyName;
    if (companyDescription !== undefined) profile.companyDescription = companyDescription;
    if (website !== undefined) profile.website = website;
    if (industry !== undefined) profile.industry = industry;
    if (companySize !== undefined) profile.companySize = companySize;
    if (logo !== undefined) profile.logo = logo;
    if (location !== undefined) profile.location = location;

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Company profile updated successfully.',
      profile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all jobs posted by logged-in recruiter
// @route   GET /api/recruiter/jobs
// @access  Private (Recruiter)
const getMyJobs = async (req, res, next) => {
  try {
    const jobs = await Job.find({ recruiterId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    // Attach accurate live application count for each job
    const jobsWithCounts = await Promise.all(
      jobs.map(async (job) => {
        const count = await Application.countDocuments({ jobId: job._id });
        return {
          ...job,
          applicantsCount: count
        };
      })
    );

    res.status(200).json({
      success: true,
      count: jobsWithCounts.length,
      jobs: jobsWithCounts
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get applicants for a specific job, sorted by HIGHEST AI MATCH SCORE
// @route   GET /api/recruiter/jobs/:id/applicants
// @access  Private (Recruiter)
const getJobApplicants = async (req, res, next) => {
  try {
    const { id: jobId } = req.params;
    const { status, sortBy = 'matchScore' } = req.query;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.recruiterId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    const filter = { jobId };
    if (status && status !== 'All') {
      filter.status = status;
    }

    // Determine sort
    let sortField = { matchScore: -1 };
    if (sortBy === 'appliedAt') sortField = { appliedAt: -1 };
    if (sortBy === 'matchAsc') sortField = { matchScore: 1 };

    const applications = await Application.find(filter)
      .populate('studentId', 'name email phone location avatar')
      .sort(sortField)
      .lean();

    // Populate student profiles (education, skills) for candidate review
    const enhancedApplicants = await Promise.all(
      applications.map(async (app) => {
        const profile = await StudentProfile.findOne({ userId: app.studentId._id }).lean();
        return {
          ...app,
          studentProfile: profile
        };
      })
    );

    res.status(200).json({
      success: true,
      job: {
        id: job._id,
        title: job.title,
        company: job.company,
        type: job.type,
        requiredSkills: job.requiredSkills
      },
      count: enhancedApplicants.length,
      applicants: enhancedApplicants
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get recruiter analytics and dashboard metrics
// @route   GET /api/recruiter/dashboard
// @access  Private (Recruiter)
const getDashboardStats = async (req, res, next) => {
  try {
    const recruiterId = req.user._id;

    // Get all recruiter job IDs
    const jobs = await Job.find({ recruiterId }).select('_id status title createdAt');
    const jobIds = jobs.map(j => j._id);

    const totalJobs = jobs.length;
    const activeJobs = jobs.filter(j => j.status === 'Active').length;

    // Get all applications for recruiter jobs
    const applications = await Application.find({ jobId: { $in: jobIds } })
      .populate('jobId', 'title')
      .sort({ appliedAt: -1 });

    const totalApplications = applications.length;
    const shortlistedCount = applications.filter(a => a.status === 'Shortlisted').length;
    const interviewsCount = applications.filter(a => a.status === 'Interview').length;
    const selectedCount = applications.filter(a => a.status === 'Selected').length;
    const rejectedCount = applications.filter(a => a.status === 'Rejected').length;
    const underReviewCount = applications.filter(a => a.status === 'Under Review').length;
    const appliedCount = applications.filter(a => a.status === 'Applied').length;

    // Applications over time (last 7 days / weekly distribution)
    const now = new Date();
    const past7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - (6 - i));
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        dateStr: d.toISOString().split('T')[0],
        count: 0
      };
    });

    applications.forEach(app => {
      const appDateStr = new Date(app.appliedAt).toISOString().split('T')[0];
      const matchDay = past7Days.find(d => d.dateStr === appDateStr);
      if (matchDay) matchDay.count += 1;
    });

    // Match score distribution buckets
    const matchBuckets = [
      { range: '90-100%', count: 0 },
      { range: '75-89%', count: 0 },
      { range: '50-74%', count: 0 },
      { range: '<50%', count: 0 }
    ];

    applications.forEach(app => {
      const score = app.matchScore || 0;
      if (score >= 90) matchBuckets[0].count += 1;
      else if (score >= 75) matchBuckets[1].count += 1;
      else if (score >= 50) matchBuckets[2].count += 1;
      else matchBuckets[3].count += 1;
    });

    // Status breakdown chart data
    const statusData = [
      { name: 'Applied', value: appliedCount, color: '#3B82F6' },
      { name: 'Under Review', value: underReviewCount, color: '#6366F1' },
      { name: 'Shortlisted', value: shortlistedCount, color: '#10B981' },
      { name: 'Interview', value: interviewsCount, color: '#F59E0B' },
      { name: 'Selected', value: selectedCount, color: '#059669' },
      { name: 'Rejected', value: rejectedCount, color: '#EF4444' }
    ];

    // Recent 5 applicants
    const recentApplications = applications.slice(0, 6);

    res.status(200).json({
      success: true,
      stats: {
        totalJobs,
        activeJobs,
        totalApplications,
        shortlistedCount,
        interviewsCount,
        selectedCount,
        rejectedCount
      },
      charts: {
        applicationsOverTime: past7Days,
        statusDistribution: statusData,
        matchScoreBuckets: matchBuckets
      },
      recentApplications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    View candidate profile
// @route   GET /api/recruiter/candidates/:studentId
// @access  Private (Recruiter)
const getCandidateProfile = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const user = await User.findById(studentId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Candidate not found.' });
    }

    const profile = await StudentProfile.findOne({ userId: studentId }).lean();

    res.status(200).json({
      success: true,
      candidate: user,
      profile
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  getMyJobs,
  getJobApplicants,
  getDashboardStats,
  getCandidateProfile
};
