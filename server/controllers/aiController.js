const aiService = require('../services/aiService');
const Job = require('../models/Job');
const StudentProfile = require('../models/StudentProfile');

// @desc    Calculate AI match score between student skills and job requirements
// @route   POST /api/ai/match
// @access  Public
const matchSkills = async (req, res, next) => {
  try {
    const { studentSkills, requiredSkills, preferredSkills = [], resumeText = '' } = req.body;

    if (!requiredSkills || !Array.isArray(requiredSkills)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide requiredSkills as an array of skills.'
      });
    }

    const skillsToMatch = Array.isArray(studentSkills) ? studentSkills : [];

    const result = await aiService.calculateMatch(
      skillsToMatch,
      requiredSkills,
      preferredSkills,
      resumeText
    );

    res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Analyze match for the current logged-in student against a job ID
// @route   POST /api/ai/analyze-job/:jobId
// @access  Private (Student)
const analyzeJobMatch = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job not found.' });
    }

    const studentProfile = await StudentProfile.findOne({ userId: req.user._id });
    const studentSkills = studentProfile ? studentProfile.skills : [];
    const resumeText = studentProfile?.resume?.extractedText || '';

    const matchResult = await aiService.calculateMatch(
      studentSkills,
      job.requiredSkills || [],
      job.preferredSkills || [],
      resumeText
    );

    res.status(200).json({
      success: true,
      jobId: job._id,
      jobTitle: job.title,
      company: job.company,
      studentSkills,
      requiredSkills: job.requiredSkills,
      preferredSkills: job.preferredSkills,
      ...matchResult
    });
  } catch (error) {
    next(error);
  }
};

// @desc    AI Recommendations endpoint
// @route   POST /api/ai/recommendations
// @access  Public
const getRecommendations = async (req, res, next) => {
  try {
    const { studentSkills = [], jobs = [] } = req.body;

    let jobList = jobs;
    if (!jobList || jobList.length === 0) {
      jobList = await Job.find({ status: 'Active' }).limit(30).lean();
    }

    const recommendations = await aiService.getJobRecommendations(studentSkills, jobList);

    res.status(200).json({
      success: true,
      recommendations
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  matchSkills,
  analyzeJobMatch,
  getRecommendations
};
