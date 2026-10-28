const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true
    },
    resume: {
      filename: String,
      url: String,
      originalName: String
    },
    coverLetter: {
      type: String,
      default: ''
    },
    matchScore: {
      type: Number,
      default: 0
    },
    matchedSkills: {
      type: [String],
      default: []
    },
    missingSkills: {
      type: [String],
      default: []
    },
    recommendations: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected'],
      default: 'Applied'
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ['Applied', 'Under Review', 'Shortlisted', 'Interview', 'Selected', 'Rejected']
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        updatedAt: {
          type: Date,
          default: Date.now
        },
        note: {
          type: String,
          default: ''
        }
      }
    ],
    appliedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate applications by the same student to the same job
applicationSchema.index({ studentId: 1, jobId: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
