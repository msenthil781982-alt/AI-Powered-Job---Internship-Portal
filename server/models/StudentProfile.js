const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    degree: {
      type: String,
      default: '',
      trim: true
    },
    college: {
      type: String,
      default: '',
      trim: true
    },
    graduationYear: {
      type: Number,
      default: new Date().getFullYear()
    },
    education: [
      {
        degree: String,
        college: String,
        graduationYear: Number,
        grade: String
      }
    ],
    skills: {
      type: [String],
      default: []
    },
    certifications: [
      {
        name: String,
        issuer: String,
        year: Number
      }
    ],
    projects: [
      {
        title: String,
        description: String,
        technologies: [String],
        link: String
      }
    ],
    experience: [
      {
        title: String,
        company: String,
        duration: String,
        description: String
      }
    ],
    careerInterests: {
      type: [String],
      default: []
    },
    preferredJobType: {
      type: String,
      enum: ['All', 'Full-time', 'Part-time', 'Internship', 'Contract'],
      default: 'All'
    },
    preferredLocation: {
      type: String,
      default: 'Any'
    },
    resume: {
      filename: { type: String, default: '' },
      originalName: { type: String, default: '' },
      path: { type: String, default: '' },
      url: { type: String, default: '' },
      size: { type: Number, default: 0 },
      uploadDate: { type: Date, default: null },
      extractedText: { type: String, default: '' }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('StudentProfile', studentProfileSchema);
