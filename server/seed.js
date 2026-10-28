const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const User = require('./models/User');
const Job = require('./models/Job');
const RecruiterProfile = require('./models/RecruiterProfile');
async function seedJobs() {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/careermatch_ai'
    );
    console.log('MongoDB connected');
    const email = 'demo.recruiter@careermatch.local';
    let recruiter = await User.findOne({ email });
    if (!recruiter) {
      recruiter = await User.create({
        name: 'CareerMatch Demo Recruiter',
        email,
        password: 'DemoRecruiter2026!',
        role: 'recruiter',
        location: 'Chennai, India'
      });
      console.log('Demo recruiter created');
    }
    let profile = await RecruiterProfile.findOne({
      userId: recruiter._id
    });
    if (!profile) {
      await RecruiterProfile.create({
        userId: recruiter._id,
        companyName: 'CareerMatch Demo Tech',
        companyDescription: 'Demo company for sample job listings.',
        location: 'Chennai, India'
      });
    }
    const sampleJobs = [
      {
        company: 'CareerMatch Demo Tech',
        title: 'Frontend Developer Intern',
        type: 'Internship',
        category: 'Software Development',
        description: 'Learn and build responsive web interfaces with our development team.',
        requiredSkills: ['HTML', 'CSS', 'JavaScript', 'React'],
        preferredSkills: ['Git', 'REST APIs'],
        location: 'Chennai, India',
        workMode: 'Hybrid',
        experience: 'Fresher / 0-1 Year',
        salary: '₹10,000 - ₹15,000 per month'
      },
      {
        company: 'CareerMatch Demo Tech',
        title: 'Junior Java Developer',
        type: 'Job',
        category: 'Software Development',
        description: 'Assist in developing and maintaining Java and Spring Boot applications.',
        requiredSkills: ['Java', 'Spring Boot', 'SQL', 'Git'],
        preferredSkills: ['MongoDB', 'REST APIs'],
        location: 'Bengaluru, India',
        workMode: 'On-site',
        experience: 'Fresher / 0-1 Year',
        salary: '₹3 - 5 LPA'
      },
      {
        company: 'CareerMatch Demo Tech',
        title: 'Python Developer Intern',
        type: 'Internship',
        category: 'AI / Machine Learning',
        description: 'Work on Python applications, APIs, and introductory data analysis tasks.',
        requiredSkills: ['Python', 'SQL', 'Git'],
        preferredSkills: ['Flask', 'Machine Learning'],
        location: 'Remote',
        workMode: 'Remote',
        experience: 'Fresher / 0-1 Year',
        salary: '₹8,000 - ₹12,000 per month'
      }
    ];
    let inserted = 0;
    for (const data of sampleJobs) {
      const exists = await Job.findOne({
        recruiterId: recruiter._id,
        title: data.title,
        company: data.company
      });
      if (exists) {
        console.log(`Already exists: ${data.title}`);
        continue;
      }
      await Job.create({
        ...data,
        recruiterId: recruiter._id,
        status: 'Active'
      });
      inserted++;
      console.log(`Added: ${data.title}`);
    }
    console.log(`Finished. New jobs added: ${inserted}`);
    console.log(`Total active jobs: ${await Job.countDocuments({ status: 'Active' })}`);
  } catch (error) {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
seedJobs();
