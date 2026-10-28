const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    companyDescription: {
      type: String,
      default: ''
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['Job', 'Internship'],
      default: 'Job',
      required: true
    },
    category: {
      type: String,
      default: 'Software Development',
      trim: true
    },
    description: {
      type: String,
      required: [true, 'Job description is required']
    },
    responsibilities: {
      type: [String],
      default: []
    },
    requiredSkills: {
      type: [String],
      required: [true, 'At least one required skill is needed'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'Job must specify at least one required skill'
      }
    },
    preferredSkills: {
      type: [String],
      default: []
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true
    },
    workMode: {
      type: String,
      enum: ['Remote', 'On-site', 'Hybrid'],
      default: 'Hybrid'
    },
    experience: {
      type: String,
      default: 'Fresher / 0-1 Year'
    },
    salary: {
      type: String,
      default: 'Competitive'
    },
    deadline: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    status: {
      type: String,
      enum: ['Active', 'Closed'],
      default: 'Active'
    },
    isReported: {
      type: Boolean,
      default: false
    },
    reportReason: {
      type: String,
      default: ''
    },
    applicantsCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Text index for search
jobSchema.index({
  title: 'text',
  company: 'text',
  description: 'text',
  requiredSkills: 'text',
  location: 'text'
});

module.exports = mongoose.model('Job', jobSchema);
