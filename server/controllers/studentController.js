const fs = require('fs');
const path = require('path');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');
const Job = require('../models/Job');
const SavedJob = require('../models/SavedJob');
const aiService = require('../services/aiService');

// @desc    Get student profile
// @route   GET /api/students/profile
// @access  Private (Student)
const getProfile = async (req, res, next) => {
  try {
    let profile = await StudentProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = await StudentProfile.create({
        userId: req.user._id,
        skills: ['JavaScript', 'React', 'HTML5', 'CSS3', 'Git']
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

// @desc    Update student profile
// @route   PUT /api/students/profile
// @access  Private (Student)
const updateProfile = async (req, res, next) => {
  try {
    const {
      name,
      phone,
      location,
      degree,
      college,
      graduationYear,
      education,
      skills,
      certifications,
      projects,
      experience,
      careerInterests,
      preferredJobType,
      preferredLocation
    } = req.body;

    // Update base user details if provided
    if (name || phone !== undefined || location !== undefined) {
      await User.findByIdAndUpdate(req.user._id, {
        ...(name && { name }),
        ...(phone !== undefined && { phone }),
        ...(location !== undefined && { location })
      });
    }

    // Update profile
    let profile = await StudentProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new StudentProfile({ userId: req.user._id });
    }

    if (degree !== undefined) profile.degree = degree;
    if (college !== undefined) profile.college = college;
    if (graduationYear !== undefined) profile.graduationYear = graduationYear;
    if (education !== undefined) profile.education = education;
    if (skills !== undefined) profile.skills = Array.isArray(skills) ? skills : skills.split(',').map(s => s.trim()).filter(Boolean);
    if (certifications !== undefined) profile.certifications = certifications;
    if (projects !== undefined) profile.projects = projects;
    if (experience !== undefined) profile.experience = experience;
    if (careerInterests !== undefined) profile.careerInterests = careerInterests;
    if (preferredJobType !== undefined) profile.preferredJobType = preferredJobType;
    if (preferredLocation !== undefined) profile.preferredLocation = preferredLocation;

    await profile.save();

    const updatedUser = await User.findById(req.user._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      profile,
      user: updatedUser
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload student resume PDF
// @route   POST /api/students/resume
// @access  Private (Student)
const uploadResume = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a PDF resume file.'
      });
    }

    let profile = await StudentProfile.findOne({ userId: req.user._id });
    if (!profile) {
      profile = new StudentProfile({ userId: req.user._id });
    }

    // Clean up old resume file if one already exists
    if (profile.resume && profile.resume.path && fs.existsSync(profile.resume.path)) {
      try {
        fs.unlinkSync(profile.resume.path);
      } catch (err) {
        console.warn('Could not delete old resume file:', err.message);
      }
    }

    const relativeUrl = `/uploads/${req.file.filename}`;
    const simulatedExtractedText = `Extracted candidate profile text from uploaded resume (${req.file.originalname}). Identified core competencies: ${profile.skills.join(', ')}. Candidate demonstrates practical projects and education background in computer science and software development.`;

    profile.resume = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      url: relativeUrl,
      size: req.file.size,
      uploadDate: new Date(),
      extractedText: simulatedExtractedText
    };

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Resume uploaded successfully.',
      resume: profile.resume
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete student resume
// @route   DELETE /api/students/resume
// @access  Private (Student)
const deleteResume = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user._id });
    if (!profile || !profile.resume || !profile.resume.filename) {
      return res.status(400).json({
        success: false,
        message: 'No resume found to delete.'
      });
    }

    if (profile.resume.path && fs.existsSync(profile.resume.path)) {
      try {
        fs.unlinkSync(profile.resume.path);
      } catch (err) {
        console.warn('Could not delete physical resume file:', err.message);
      }
    }

    profile.resume = {
      filename: '',
      originalName: '',
      path: '',
      url: '',
      size: 0,
      uploadDate: null,
      extractedText: ''
    };

    await profile.save();

    res.status(200).json({
      success: true,
      message: 'Resume removed successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get AI recommended jobs for student
// @route   GET /api/students/recommendations
// @access  Private (Student)
const getRecommendations = async (req, res, next) => {
  try {
    const profile = await StudentProfile.findOne({ userId: req.user._id });
    const studentSkills = profile ? profile.skills : [];

    const activeJobs = await Job.find({ status: 'Active' })
      .populate('recruiterId', 'name email company')
      .lean();

    if (!activeJobs.length) {
      return res.status(200).json({
        success: true,
        recommendations: []
      });
    }

    // Call AI service to rank recommendations
    const rankedRecommendations = await aiService.getJobRecommendations(studentSkills, activeJobs);

    // Merge job details with AI rankings
    const jobMap = new Map(activeJobs.map(j => [j._id.toString(), j]));
    const results = rankedRecommendations
      .map(rec => {
        const job = jobMap.get(rec.jobId);
        if (!job) return null;
        return {
          ...job,
          matchScore: rec.matchScore,
          matchedSkills: rec.matchedSkills,
          missingSkills: rec.missingSkills,
          recommendations: rec.recommendations
        };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      count: results.length,
      recommendations: results
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get saved jobs
// @route   GET /api/students/saved-jobs
// @access  Private (Student)
const getSavedJobs = async (req, res, next) => {
  try {
    const saved = await SavedJob.find({ studentId: req.user._id })
      .populate('jobId')
      .sort({ createdAt: -1 });

    const jobs = saved.map(s => s.jobId).filter(Boolean);

    res.status(200).json({
      success: true,
      savedJobs: jobs
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Save a job
// @route   POST /api/students/saved-jobs/:jobId
// @access  Private (Student)
const saveJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const existing = await SavedJob.findOne({ studentId: req.user._id, jobId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Job is already saved.' });
    }

    await SavedJob.create({ studentId: req.user._id, jobId });

    res.status(201).json({
      success: true,
      message: 'Job bookmarked successfully.'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove a saved job
// @route   DELETE /api/students/saved-jobs/:jobId
// @access  Private (Student)
const removeSavedJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    await SavedJob.findOneAndDelete({ studentId: req.user._id, jobId });

    res.status(200).json({
      success: true,
      message: 'Job removed from bookmarks.'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  uploadResume,
  deleteResume,
  getRecommendations,
  getSavedJobs,
  saveJob,
  removeSavedJob
};
