
import { useState } from "react";
import axios from "axios";
import "./style.css";

const API_URL = "http://localhost:5000/api/jobs";

export default function App() {
    const [keyword, setKeyword] = useState("");
    const [location, setLocation] = useState("");
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [searched, setSearched] = useState(false);

    async function searchJobs(event) {
        event.preventDefault();
        setLoading(true);
        setError("");
        setSearched(true);

        try {
            const response = await axios.get(API_URL, {
                params: {
                    q: keyword.trim(),
                    location: location.trim(),
                    limit: 20,
                },
            });

            setJobs(response.data.jobs || []);
        } catch (err) {
            setJobs([]);
            setError(
                err.response?.data?.message ||
                "Jobs load ஆகவில்லை. Backend மற்றும் database connection-ஐ சரிபார்."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="page">
            <nav className="navbar">
                <h2>CareerMatch <span>AI</span></h2>
                <button type="button" onClick={() => alert("Login/Register feature அடுத்ததாக இணைக்கப்படும்.")}>
                    Login / Register
                </button>
            </nav>

            <section className="hero">
                <p className="tag">AI-POWERED CAREER PLATFORM</p>
                <h1>
                    Find Your Dream Job.
                    <br />
                    <span>Build Your Future.</span>
                </h1>
                <p>Discover jobs and internships that match your skills.</p>

                <form className="search" onSubmit={searchJobs}>
                    <input
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Job title or skills"
                        aria-label="Job title or skills"
                    />
                    <input
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Location"
                        aria-label="Location"
                    />
                    <button type="submit" disabled={loading}>
                        {loading ? "Searching..." : "Search Jobs"}
                    </button>
                </form>
            </section>

            <section className="jobs" id="jobs">
                <h2>{searched ? "Search Results" : "Explore Opportunities"}</h2>

                {loading && <p>Jobs தேடிக்கொண்டிருக்கிறோம்...</p>}
                {error && <p role="alert">{error}</p>}

                {!loading && !error && searched && jobs.length === 0 && (
                    <p>Matching jobs கிடைக்கவில்லை. வேறு keyword அல்லது location முயற்சி செய்.</p>
                )}

                {!loading && !error && jobs.length > 0 && (
                    <p>{jobs.length} job(s) கிடைத்துள்ளன.</p>
                )}

                <div className="cards">
                    {jobs.map((job) => (
                        <article key={job._id}>
                            <h3>{job.title}</h3>
                            <p>{job.company || "Company not specified"}</p>
                            <p>{job.location}</p>
                            <p>{job.type || "Job"} · {job.workMode || "Not specified"}</p>
                            <p>{job.description}</p>
                            {job.requiredSkills?.length > 0 && (
                                <p><strong>Skills:</strong> {job.requiredSkills.join(", ")}</p>
                            )}
                            {job.salary && <p><strong>Salary:</strong> {job.salary}</p>}
                        </article>
                    ))}
                </div>
            </section>
        </main>
    );
}
