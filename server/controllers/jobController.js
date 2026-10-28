const Job = require('../models/Job');
const Application = require('../models/Application');
const StudentProfile = require('../models/StudentProfile');
const aiService = require('../services/aiService');

// @desc    Get jobs and internships with filters, search, sort, pagination
// @route   GET /api/jobs
// @access  Public (Optional auth for match percentage)
const getJobs = async (req, res, next) => {
  try {
    const {
      q,
      type,
      workMode,
      location,
      experience,
      skills,
      category,
      status,
      sort,
      page = 1,
      limit = 10
    } = req.query;

    const query = {};

    // By default only show Active jobs for public listings
    if (status) {
      query.status = status;
    } else {
      query.status = 'Active';
    }

    if (type && type !== 'All') {
      query.type = type;
    }

    if (workMode && workMode !== 'All') {
      query.workMode = workMode;
    }

    if (category && category !== 'All') {
      query.category = category;
    }

    if (location && location.trim() !== '') {
      query.location = { $regex: location.trim(), $options: 'i' };
    }

    if (experience && experience !== 'All') {
      query.experience = { $regex: experience.trim(), $options: 'i' };
    }

    if (skills && skills.trim() !== '') {
      const skillList = skills.split(',').map(s => s.trim()).filter(Boolean);
      query.requiredSkills = { $in: skillList.map(s => new RegExp(s, 'i')) };
    }

    if (q && q.trim() !== '') {
      const keyword = q.trim();
      query.$or = [
        { title: { $regex: keyword, $options: 'i' } },
        { company: { $regex: keyword, $options: 'i' } },
        { description: { $regex: keyword, $options: 'i' } },
        { requiredSkills: { $regex: keyword, $options: 'i' } },
        { location: { $regex: keyword, $options: 'i' } }
      ];
    }

    // Sorting
    let sortOption = { createdAt: -1 }; // default newest
    if (sort === 'oldest') sortOption = { createdAt: 1 };
    if (sort === 'deadline') sortOption = { deadline: 1 };
    if (sort === 'popular') sortOption = { applicantsCount: -1 };

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate('recruiterId', 'name email')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // If student is logged in, attach AI match scores
    let studentSkills = [];
    if (req.user && req.user.role === 'student') {
      const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
      if (studentProfile && studentProfile.skills) {
        studentSkills = studentProfile.skills;
      }
    }

    const enhancedJobs = jobs.map(job => {
      let aiMatch = null;
      if (studentSkills.length > 0) {
        // Quick calculate match
        const matchResult = aiService.normalizeSkill 
          ? require('../services/aiService').fallbackMatch(studentSkills, job.requiredSkills || [], job.preferredSkills || [])
          : null;
        aiMatch = matchResult ? matchResult.matchScore : null;
      }
      return {
        ...job,
        aiMatchScore: aiMatch
      };
    });

    res.status(200).json({
      success: true,
      count: enhancedJobs.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      jobs: enhancedJobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single job by ID
// @route   GET /api/jobs/:id
// @access  Public (Optional auth for student match calculation)
const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id)
      .populate('recruiterId', 'name email phone location')
      .lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found.'
      });
    }

    let matchAnalysis = null;
    let hasApplied = false;

    if (req.user && req.user.role === 'student') {
      const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
      if (studentProfile) {
        matchAnalysis = await aiService.calculateMatch(
          studentProfile.skills || [],
          job.requiredSkills || [],
          job.preferredSkills || [],
          studentProfile.resume?.extractedText || ''
        );
      }

      const existingApp = await Application.findOne({
        studentId: req.user._id,
        jobId: job._id
      });
      hasApplied = !!existingApp;
    }

    res.status(200).json({
      success: true,
      job,
      matchAnalysis,
      hasApplied
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create job posting
// @route   POST /api/jobs
// @access  Private (Recruiter)
const createJob = async (req, res, next) => {
  try {
    const {
      title,
      type,
      category,
      company,
      companyDescription,
      description,
      responsibilities,
      requiredSkills,
      preferredSkills,
      location,
      workMode,
      experience,
      salary,
      deadline
    } = req.body;

    if (!title || !description || !location) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and location are required.'
      });
    }

    const skillsArray = Array.isArray(requiredSkills)
      ? requiredSkills
      : (requiredSkills || '').split(',').map(s => s.trim()).filter(Boolean);

    if (skillsArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one required skill.'
      });
    }

    const preferredArray = Array.isArray(preferredSkills)
      ? preferredSkills
      : (preferredSkills || '').split(',').map(s => s.trim()).filter(Boolean);

    const respArray = Array.isArray(responsibilities)
      ? responsibilities
      : (responsibilities || '').split('\n').map(s => s.trim()).filter(Boolean);

    const job = await Job.create({
      recruiterId: req.user._id,
      company: company || req.user.name,
      companyDescription: companyDescription || '',
      title,
      type: type || 'Job',
      category: category || 'Software Development',
      description,
      responsibilities: respArray,
      requiredSkills: skillsArray,
      preferredSkills: preferredArray,
      location,
      workMode: workMode || 'Hybrid',
      experience: experience || 'Fresher / 0-1 Year',
      salary: salary || 'Competitive',
      deadline: deadline ? new Date(deadline) : new Date(+new Date() + 30 * 24 * 60 * 60 * 1000)
    });

    res.status(201).json({
      success: true,
      message: 'Job posting published successfully.',
      job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update job posting
// @route   PUT /api/jobs/:id
// @access  Private (Recruiter owner or Admin)
const updateJob = async (req, res, next) => {
  try {
    let job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    // Verify ownership or admin
    if (job.recruiterId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to modify this job posting.'
      });
    }

    const {
      title,
      type,
      category,
      company,
      companyDescription,
      description,
      responsibilities,
      requiredSkills,
      preferredSkills,
      location,
      workMode,
      experience,
      salary,
      deadline,
      status
    } = req.body;

    if (title) job.title = title;
    if (type) job.type = type;
    if (category) job.category = category;
    if (company) job.company = company;
    if (companyDescription !== undefined) job.companyDescription = companyDescription;
    if (description) job.description = description;
    if (location) job.location = location;
    if (workMode) job.workMode = workMode;
    if (experience) job.experience = experience;
    if (salary) job.salary = salary;
    if (deadline) job.deadline = new Date(deadline);
    if (status) job.status = status;

    if (requiredSkills !== undefined) {
      job.requiredSkills = Array.isArray(requiredSkills)
        ? requiredSkills
        : requiredSkills.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (preferredSkills !== undefined) {
      job.preferredSkills = Array.isArray(preferredSkills)
        ? preferredSkills
        : preferredSkills.split(',').map(s => s.trim()).filter(Boolean);
    }

    if (responsibilities !== undefined) {
      job.responsibilities = Array.isArray(responsibilities)
        ? responsibilities
        : responsibilities.split('\n').map(s => s.trim()).filter(Boolean);
    }

    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job posting updated successfully.',
      job
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete job posting
// @route   DELETE /api/jobs/:id
// @access  Private (Recruiter owner or Admin)
const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.recruiterId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this job posting.'
      });
    }

    // Clean up applications and bookmarks
    await Application.deleteMany({ jobId: job._id });
    await Job.findByIdAndDelete(job._id);

    res.status(200).json({
      success: true,
      message: 'Job posting deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle job status (Active / Closed)
// @route   PATCH /api/jobs/:id/status
// @access  Private (Recruiter owner)
const toggleJobStatus = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    if (job.recruiterId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized.' });
    }

    job.status = job.status === 'Active' ? 'Closed' : 'Active';
    await job.save();

    res.status(200).json({
      success: true,
      message: `Job marked as ${job.status}.`,
      status: job.status
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Report job posting
// @route   POST /api/jobs/:id/report
// @access  Private
const reportJob = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    job.isReported = true;
    job.reportReason = reason || 'Flagged by community user for review.';
    await job.save();

    res.status(200).json({
      success: true,
      message: 'Job reported for admin review.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  toggleJobStatus,
  reportJob
};
