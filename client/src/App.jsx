import React from "react";
export default function App() {
  return (
    <main className="page">
      <nav>
        <h2>CareerMatch <span>AI</span></h2>
        <button>Login / Register</button>
      </nav>
      <section className="hero">
        <p className="tag">AI-POWERED CAREER PLATFORM</p>
        <h1>Find Your Dream Job.<br /><span>Build Your Future.</span></h1>
        <p>Discover jobs and internships that match your skills.</p>
        <div className="search">
          <input placeholder="Job title or skills" />
          <input placeholder="Location" />
          <button>Search Jobs</button>
        </div>
      </section>
      <section className="jobs">
        <h2>Explore Opportunities</h2>
        <div className="cards">
          <article><h3>Software Developer</h3><p>Build applications and solve problems.</p></article>
          <article><h3>Web Development Intern</h3><p>Gain practical experience.</p></article>
          <article><h3>Data Analyst</h3><p>Turn data into useful insights.</p></article>
        </div>
      </section>
    </main>
  );
}
