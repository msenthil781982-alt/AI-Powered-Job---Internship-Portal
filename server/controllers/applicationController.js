const Application = require('../models/Application');
const Job = require('../models/Job');
const StudentProfile = require('../models/StudentProfile');
const aiService = require('../services/aiService');

// @desc    Apply for a job
// @route   POST /api/applications
// @access  Private (Student)
const applyForJob = async (req, res, next) => {
  try {
    const { jobId, coverLetter, resumeUrl, resumeName } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: 'Job ID is required to submit an application.'
      });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found.'
      });
    }

    if (job.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'This job posting is closed for applications.'
      });
    }

    // Check duplicate application
    const existing = await Application.findOne({
      studentId: req.user._id,
      jobId
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'You have already applied for this position. Check your applications dashboard.'
      });
    }

    // Fetch student profile for resume & skill matching
    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    const studentSkills = studentProfile ? studentProfile.skills : [];

    // Calculate AI match score
    const matchAnalysis = await aiService.calculateMatch(
      studentSkills,
      job.requiredSkills || [],
      job.preferredSkills || [],
      studentProfile?.resume?.extractedText || ''
    );

    const application = await Application.create({
      studentId: req.user._id,
      jobId,
      resume: {
        filename: resumeName || studentProfile?.resume?.filename || 'profile-resume.pdf',
        url: resumeUrl || studentProfile?.resume?.url || '',
        originalName: studentProfile?.resume?.originalName || 'Resume.pdf'
      },
      coverLetter: coverLetter || '',
      matchScore: matchAnalysis.matchScore,
      matchedSkills: matchAnalysis.matchedSkills,
      missingSkills: matchAnalysis.missingSkills,
      recommendations: matchAnalysis.recommendations,
      status: 'Applied',
      statusHistory: [
        {
          status: 'Applied',
          updatedBy: req.user._id,
          updatedAt: new Date(),
          note: 'Application submitted by candidate.'
        }
      ]
    });

    // Increment applicants counter
    await Job.findByIdAndUpdate(jobId, { $inc: { applicantsCount: 1 } });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully!',
      application
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current student's applications with tracking timeline
// @route   GET /api/applications/my
// @access  Private (Student)
const getMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.find({ studentId: req.user._id })
      .populate({
        path: 'jobId',
        select: 'title company location type workMode salary deadline status'
      })
      .sort({ appliedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: applications.length,
      applications
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get application details by ID
// @route   GET /api/applications/:id
// @access  Private (Student owner, Recruiter owner, Admin)
const getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id)
      .populate('studentId', 'name email phone location avatar')
      .populate('jobId')
      .populate('statusHistory.updatedBy', 'name role')
      .lean();

    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    // Check authorization
    const isStudentOwner = application.studentId._id.toString() === req.user._id.toString();
    const isRecruiterOwner = application.jobId.recruiterId.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isStudentOwner && !isRecruiterOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to view this application.'
      });
    }

    // Attach student profile if recruiter is viewing
    let studentProfile = null;
    if (isRecruiterOwner || isAdmin) {
      studentProfile = await StudentProfile.findOne({ userId: application.studentId._id }).lean();
    }

    res.status(200).json({
      success: true,
      application,
      studentProfile
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update application status (Shortlist, Interview, Select, Reject, etc.)
// @route   PATCH /api/applications/:id/status
// @access  Private (Recruiter owner or Admin)
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Valid values: ${validStatuses.join(', ')}`
      });
    }

    const application = await Application.findById(req.params.id).populate('jobId');
    if (!application) {
      return res.status(404).json({
        success: false,
        message: 'Application not found.'
      });
    }

    // Check recruiter authorization
    if (application.jobId.recruiterId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update status for this application.'
      });
    }

    application.status = status;
    application.statusHistory.push({
      status,
      updatedBy: req.user._id,
      updatedAt: new Date(),
      note: note || `Status transitioned to ${status}`
    });

    await application.save();

    res.status(200).json({
      success: true,
      message: `Candidate application updated to ${status}.`,
      application
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  applyForJob,
  getMyApplications,
  getApplicationById,
  updateApplicationStatus
};
