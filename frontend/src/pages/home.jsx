import { Link } from 'react-router-dom';
import ThreeHero from '../components/ThreeHero.jsx';
import '../styles/home.css';
export default function Home() {
  return (
    <div className="home-page">

      {/* NAVBAR */}
      <nav className="home-navbar">
        <div className="home-brand">
          Civic Issue Reporter
        </div>

        <div className="home-nav-links">
          <a href="#about">About</a>
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <Link to="/admin/login" className="admin-nav-link">
            Admin Login
          </Link>
          <Link to="/login" className="nav-login">
            Log in
          </Link>
          <Link to="/register" className="nav-register">
            Get Started
          </Link>
        </div>
      </nav>


      {/* HERO SECTION */}
      <section className="home-hero">

        <div className="hero-content">

          <div className="hero-badge">
            Smart Civic Issue Reporting Platform
          </div>

          <h1>
            Make your community
            <span> better, one report at a time.</span>
          </h1>

          <p className="hero-description">
            Report potholes, drainage problems, garbage, streetlight issues
            and other civic problems directly from your location.
            Our platform helps verify, track and route every issue
            to the appropriate administration.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="hero-primary-btn">
              Report an Issue
              <span>→</span>
            </Link>

            <Link to="/login" className="hero-secondary-btn">
              Login to Track
            </Link>
          </div>

          <div className="hero-stats">
            <div>
              <strong>01</strong>
              <span>Capture</span>
            </div>

            <div className="stat-line"></div>

            <div>
              <strong>02</strong>
              <span>Verify</span>
            </div>

            <div className="stat-line"></div>

            <div>
              <strong>03</strong>
              <span>Resolve</span>
            </div>
          </div>

        </div>


        {/* 3D VISUAL */}
        <div className="hero-visual">
          <div className="hero-glow"></div>

          <ThreeHero height={430} />

          <div className="floating-card floating-card-one">
            <div className="floating-icon">📍</div>
            <div>
              <strong>Location Verified</strong>
              <small>Precise issue location</small>
            </div>
          </div>

          <div className="floating-card floating-card-two">
            <div className="floating-icon">✓</div>
            <div>
              <strong>AI Verification</strong>
              <small>Issue checked automatically</small>
            </div>
          </div>
        </div>

      </section>


      {/* ABOUT SECTION */}
      <section id="about" className="home-about">

        <div className="section-label">
          ABOUT THE PLATFORM
        </div>

        <h2>
          Turning citizen reports into
          <span> actionable civic issues.</span>
        </h2>

        <p>
          Civic Issue Reporter provides a structured way for citizens to
          report problems in their surroundings. Instead of a complaint
          disappearing into a system, every report can be captured,
          verified, routed and tracked until a resolution is recorded.
        </p>

      </section>


      {/* HOW IT WORKS */}
      <section id="how-it-works" className="how-section">

        <div className="section-heading">
          <div className="section-label">
            HOW IT WORKS
          </div>

          <h2>
            From reporting to resolution
          </h2>

          <p>
            A simple workflow designed to make civic issue reporting
            transparent and organized.
          </p>
        </div>


        <div className="steps-container">

          <div className="step-card">
            <div className="step-number">01</div>

            <div className="step-icon">📷</div>

            <h3>Capture the Issue</h3>

            <p>
              Capture the civic problem using your device camera and
              provide the required details about the issue.
            </p>
          </div>


          <div className="step-card">
            <div className="step-number">02</div>

            <div className="step-icon">🤖</div>

            <h3>AI Verification</h3>

            <p>
              The submitted image is checked by the AI system to determine
              whether it matches the selected civic issue category.
            </p>
          </div>


          <div className="step-card">
            <div className="step-number">03</div>

            <div className="step-icon">📍</div>

            <h3>Smart Routing</h3>

            <p>
              The verified report is associated with its location and
              routed toward the appropriate administrative area.
            </p>
          </div>


          <div className="step-card">
            <div className="step-number">04</div>

            <div className="step-icon">✓</div>

            <h3>Track Resolution</h3>

            <p>
              Citizens can follow the status of their submitted issues
              while administrators manage and update them.
            </p>
          </div>

        </div>

      </section>


      {/* FEATURES */}
      <section id="features" className="features-section">

        <div className="section-heading">
          <div className="section-label">
            PLATFORM FEATURES
          </div>

          <h2>
            Built for smarter civic reporting
          </h2>
        </div>


        <div className="features-grid">

          <div className="feature-card">
            <span>01</span>
            <h3>Camera-based Reporting</h3>
            <p>
              Capture the actual civic issue directly through the application.
            </p>
          </div>

          <div className="feature-card">
            <span>02</span>
            <h3>GPS Location</h3>
            <p>
              Associate reports with their real-world location for accurate
              routing and administration.
            </p>
          </div>

          <div className="feature-card">
            <span>03</span>
            <h3>AI Image Verification</h3>
            <p>
              Automatically check whether the submitted image corresponds
              to the selected issue category.
            </p>
          </div>

          <div className="feature-card">
            <span>04</span>
            <h3>Issue Tracking</h3>
            <p>
              Track submitted complaints and monitor their progress toward
              resolution.
            </p>
          </div>

          <div className="feature-card">
            <span>05</span>
            <h3>Administrative Dashboard</h3>
            <p>
              Administrators can view, manage and update civic reports
              according to their assigned areas.
            </p>
          </div>

          <div className="feature-card">
            <span>06</span>
            <h3>Transparent Status</h3>
            <p>
              Reports can move through statuses such as pending,
              completed or unable to take up.
            </p>
          </div>

        </div>

      </section>


      {/* CTA */}
      <section className="home-cta">

        <div>
          <div className="section-label">
            START MAKING A DIFFERENCE
          </div>

          <h2>
            See an issue?
            <br />
            Report it.
          </h2>

          <p>
            Help create cleaner, safer and better-managed communities
            by reporting civic problems around you.
          </p>
        </div>

        <Link to="/register" className="cta-button">
          Get Started →
        </Link>

      </section>


      {/* FOOTER */}
      <footer className="home-footer">

        <div>
          <strong>Civic Issue Reporter</strong>
          <p>
            A civic issue reporting & routing platform.
          </p>
        </div>

        <div className="footer-links">
          <Link to="/login">Citizen Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/admin/login">Admin Login</Link>
        </div>

        <div className="footer-copy">
          © 2026 Civic Issue Reporter
        </div>

      </footer>

    </div>
  );
}