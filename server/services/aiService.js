const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Normalizes skill string for comparison (e.g., 'React.js' -> 'react', 'Node JS' -> 'node')
 */
const normalizeSkill = (skill) => {
  if (!skill || typeof skill !== 'string') return '';
  return skill
    .toLowerCase()
    .trim()
    .replace(/\.js$/, '')
    .replace(/js$/, '')
    .replace(/[\s\-_.]+/g, '');
};

/**
 * Fallback skill matcher if Python FastAPI service is offline
 */
const fallbackMatch = (studentSkills = [], requiredSkills = [], preferredSkills = []) => {
  const normStudentSkills = studentSkills.map(s => ({
    original: s,
    norm: normalizeSkill(s)
  }));

  const matchedSkills = [];
  const missingSkills = [];

  requiredSkills.forEach(reqSkill => {
    const normReq = normalizeSkill(reqSkill);
    const found = normStudentSkills.some(st => 
      st.norm === normReq || 
      st.norm.includes(normReq) || 
      normReq.includes(st.norm)
    );

    if (found) {
      matchedSkills.push(reqSkill);
    } else {
      missingSkills.push(reqSkill);
    }
  });

  const totalRequired = requiredSkills.length;
  let matchScore = totalRequired > 0 
    ? Math.round((matchedSkills.length / totalRequired) * 100)
    : 0;

  // Check preferred skills bonus (up to 5% bonus capped at 100)
  const matchedPreferred = [];
  preferredSkills.forEach(prefSkill => {
    const normPref = normalizeSkill(prefSkill);
    const found = normStudentSkills.some(st => 
      st.norm === normPref || 
      st.norm.includes(normPref) || 
      normPref.includes(st.norm)
    );
    if (found) matchedPreferred.push(prefSkill);
  });

  if (matchedPreferred.length > 0 && matchScore < 100) {
    matchScore = Math.min(100, matchScore + Math.min(10, matchedPreferred.length * 3));
  }

  // Generate actionable recommendations
  const recommendations = [];
  if (missingSkills.length > 0) {
    const topMissing = missingSkills.slice(0, 3);
    recommendations.push(`Prioritize learning ${topMissing.join(', ')} to bridge key skill gaps for this role.`);
  }
  if (matchScore >= 80) {
    recommendations.push('High match! Highlight your matched skills prominently in your resume and portfolio.');
  } else if (matchScore >= 50) {
    recommendations.push('Moderate match. Build a mini project showcasing 1 or 2 missing skills before interviewing.');
  } else {
    recommendations.push('Foundational gaps detected. Consider relevant certifications and hands-on tutorials first.');
  }

  const explanation = totalRequired > 0
    ? `Candidate matches ${matchedSkills.length} of ${totalRequired} required skills (${matchScore}%).`
    : 'No specific required skills listed for this job.';

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    matchedPreferredSkills: matchedPreferred,
    recommendations,
    explanation,
    provider: 'local-engine-fallback'
  };
};

/**
 * Call Python FastAPI AI matching service
 */
const calculateMatch = async (studentSkills = [], requiredSkills = [], preferredSkills = [], resumeText = '') => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/match`, {
      studentSkills,
      requiredSkills,
      preferredSkills,
      resumeText
    }, { timeout: 3500 });

    if (response.data) {
      return {
        ...response.data,
        provider: 'fastapi-ai-service'
      };
    }
  } catch (err) {
    console.warn(`[AI Service] FastAPI service unreachable at ${AI_SERVICE_URL}. Using internal matching engine. (${err.message})`);
  }

  return fallbackMatch(studentSkills, requiredSkills, preferredSkills);
};

/**
 * Rank multiple jobs for a student profile
 */
const getJobRecommendations = async (studentSkills = [], jobs = []) => {
  try {
    const response = await axios.post(`${AI_SERVICE_URL}/recommendations`, {
      studentSkills,
      jobs: jobs.map(j => ({
        id: j._id.toString(),
        title: j.title,
        company: j.company,
        requiredSkills: j.requiredSkills || [],
        preferredSkills: j.preferredSkills || []
      }))
    }, { timeout: 3500 });

    if (response.data && response.data.recommendations) {
      return response.data.recommendations;
    }
  } catch (err) {
    console.warn(`[AI Service] FastApi recommendations failed. Using local engine. (${err.message})`);
  }

  // Local fallback ranking
  const ranked = jobs.map(job => {
    const match = fallbackMatch(studentSkills, job.requiredSkills || [], job.preferredSkills || []);
    return {
      jobId: job._id.toString(),
      matchScore: match.matchScore,
      matchedSkills: match.matchedSkills,
      missingSkills: match.missingSkills,
      recommendations: match.recommendations
    };
  });

  return ranked.sort((a, b) => b.matchScore - a.matchScore);
};

module.exports = {
  calculateMatch,
  getJobRecommendations,
  normalizeSkill
};
