"use client";
import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  };

  return (
    <main style={{ fontFamily: "'DM Sans', -apple-system, sans-serif", background: "#fff", color: "#0F172A", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; }
        a:hover { opacity: 0.85; }
        input::placeholder { color: #94A3B8; }
        input:focus { outline: none; border-color: #1A56DB !important; box-shadow: 0 0 0 3px rgba(26,86,219,0.1); }
      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 48px", height: 64, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #EAECF0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, background: "#0F172A", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 19, fontWeight: 900, color: "#1A56DB", fontFamily: "Arial Black, Arial, sans-serif", lineHeight: 1 }}>W</span>
          </div>
          <span style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.5px" }}>The<span style={{ color: "#1A56DB" }}>Works</span></span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <a href="#paths" style={{ fontSize: 14, color: "#6B7280", fontWeight: 500 }}>Paths</a>
          <a href="#features" style={{ fontSize: 14, color: "#6B7280", fontWeight: 500 }}>Features</a>
          <a href="#how" style={{ fontSize: 14, color: "#6B7280", fontWeight: 500 }}>How it works</a>
          <a href="#waitlist" style={{ fontSize: 14, fontWeight: 700, color: "#fff", background: "#1A56DB", padding: "9px 20px", borderRadius: 8 }}>Get early access</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ paddingTop: 128, paddingBottom: 96, paddingLeft: 24, paddingRight: 24, maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 100, padding: "6px 16px", fontSize: 13, color: "#1A56DB", marginBottom: 28, fontWeight: 600 }}>
          🚀 Now in early access — free for students
        </div>

        <h1 style={{ fontSize: "clamp(40px, 6vw, 72px)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-2px", maxWidth: 820, marginBottom: 24, color: "#0F172A" }}>
          Your future,{" "}
          <span style={{ color: "#1A56DB" }}>all six paths.</span>
        </h1>

        <p style={{ fontSize: "clamp(16px, 2vw, 20px)", color: "#6B7280", maxWidth: 540, lineHeight: 1.7, marginBottom: 40 }}>
          TheWorks is the AI planning platform built for every student — college, trade school, apprenticeship, workforce, military, or entrepreneurship. No path left behind.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", marginBottom: 72 }}>
          <a href="#waitlist" style={{ fontSize: 15, fontWeight: 700, color: "#fff", background: "#1A56DB", padding: "13px 28px", borderRadius: 9, display: "inline-block" }}>
            Get early access — it's free →
          </a>
          <a href="#how" style={{ fontSize: 15, fontWeight: 600, color: "#374151", padding: "13px 24px", borderRadius: 9, border: "1.5px solid #E5E7EB", display: "inline-block" }}>
            See how it works
          </a>
        </div>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 0, border: "1.5px solid #EAECF0", borderRadius: 14, overflow: "hidden", width: "fit-content" }}>
          {[
            { n: "6", label: "Equal paths" },
            { n: "40%", label: "Skip college" },
            { n: "$0", label: "To get started" },
            { n: "AI", label: "Powered research" },
          ].map((s, i) => (
            <div key={s.label} style={{ padding: "20px 36px", textAlign: "center", borderRight: i < 3 ? "1.5px solid #EAECF0" : "none" }}>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#0F172A", letterSpacing: "-1px" }}>{s.n}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 3, fontWeight: 500 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ background: "#F8FAFC", padding: "80px 24px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1A56DB", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>The problem</div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1px", lineHeight: 1.2, marginBottom: 20 }}>
            Every planning tool assumes you're going to college.
          </h2>
          <p style={{ fontSize: 17, color: "#6B7280", lineHeight: 1.75 }}>
            Naviance, Xello, Scoir — all built for 4-year college applications. If you want to be an electrician, join the Army, start a business, or learn a trade, you're invisible to the tools your school paid for. <strong style={{ color: "#0F172A" }}>TheWorks was built for everyone.</strong>
          </p>
        </div>
      </section>

      {/* 6 PATHS */}
      <section id="paths" style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1A56DB", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>All 6 paths</div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1px" }}>No path is better than another.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {[
            { icon: "🎓", title: "College", desc: "4-year universities, community college, FAFSA, scholarships, applications.", color: "#1A56DB", bg: "#EFF6FF" },
            { icon: "🔧", title: "Trade School", desc: "Electrician, plumber, HVAC, culinary — real skills, real pay, no debt.", color: "#B45309", bg: "#FEF3C7" },
            { icon: "🏗️", title: "Apprenticeship", desc: "Earn while you learn. Union programs, federal apprenticeships, certifications.", color: "#065F46", bg: "#D1FAE5" },
            { icon: "💼", title: "Workforce", desc: "Jump straight into a career. Resume help, job search, local opportunities.", color: "#5B21B6", bg: "#EDE9FE" },
            { icon: "🎖️", title: "Military", desc: "Army, Navy, Air Force, Marines, Coast Guard, Space Force. ROTC, ASVAB, benefits.", color: "#991B1B", bg: "#FEE2E2" },
            { icon: "🚀", title: "Entrepreneurship", desc: "Start a business now. Startup programs, grants, DECA, SBA resources.", color: "#92400E", bg: "#FFF7ED" },
          ].map((p) => (
            <div key={p.title} style={{ background: "#fff", border: "1.5px solid #EAECF0", borderRadius: 14, padding: "24px 22px" }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: p.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>{p.icon}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: p.color, marginBottom: 6 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{p.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ background: "#F8FAFC", padding: "80px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 48 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1A56DB", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Features</div>
            <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1px" }}>Everything you need in one place.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {[
              { icon: "🔍", title: "Career Discovery", desc: "20-question survey built on real BLS & O*NET data. Get matched to careers that actually fit you." },
              { icon: "📄", title: "Transcript Analysis", desc: "Upload your transcript. AI reads your real grades and gives specific recommendations — not generic advice." },
              { icon: "💰", title: "Scholarship Search", desc: "Live web search for real scholarships. Asian American, first-gen, STEM, no-essay, military — anything." },
              { icon: "🎯", title: "Goal Roadmaps", desc: "Set a goal and get a week-by-week, month-by-month AI action plan tailored to your exact path." },
              { icon: "⚖️", title: "Compare Programs", desc: "Side-by-side AI breakdown of any two or three options. College vs trade. Army vs Navy. You decide." },
              { icon: "📬", title: "Application Tracker", desc: "Portal links, checklists, and a tracker for every path — college apps, military, apprenticeships, all of it." },
              { icon: "🤖", title: "AI Research Assistant", desc: "Ask anything. The AI searches the web and does the research for you — schools, programs, careers, scholarships." },
              { icon: "🏢", title: "Local Opportunities", desc: "Coming soon — local employer job postings and apprenticeships matched to your path and location." },
            ].map((f) => (
              <div key={f.title} style={{ background: "#fff", border: "1.5px solid #EAECF0", borderRadius: 14, padding: "22px 20px" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>{f.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" style={{ padding: "80px 24px", maxWidth: 800, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1A56DB", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>How it works</div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 800, letterSpacing: "-1px" }}>Up and running in minutes.</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { n: "01", title: "Choose your path", desc: "Pick from 6 equal paths — or take the career discovery survey to find the right one." },
            { n: "02", title: "Upload your transcript", desc: "Add your GPA and transcript. AI analyzes your real grades and tailors everything to you." },
            { n: "03", title: "Search scholarships", desc: "Type anything — your background, ethnicity, field, GPA — and get live web search results." },
            { n: "04", title: "Build your roadmap", desc: "Set goals and get a step-by-step AI plan with weekly, monthly, and yearly milestones." },
            { n: "05", title: "Track everything", desc: "Compare programs, track applications, and use the AI assistant to research anything." },
          ].map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 20, alignItems: "flex-start", background: "#fff", border: "1.5px solid #EAECF0", borderRadius: 12, padding: "20px 22px" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#1A56DB", letterSpacing: "0.05em", minWidth: 24, paddingTop: 2 }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* COMPETITIVE QUOTE */}
      <section style={{ background: "#0F172A", padding: "72px 24px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 700, lineHeight: 1.5, color: "#F1F5F9", marginBottom: 20 }}>
            "Every competitor requires a school to buy it. TheWorks is the only platform a student can find on their own, sign up, and use today — without their school doing anything."
          </div>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            {["Naviance — college only", "Xello — school contract", "Scoir — school contract", "TheWorks — student direct ✓"].map((c, i) => (
              <span key={c} style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 20, background: i === 3 ? "#1A56DB" : "rgba(255,255,255,0.08)", color: i === 3 ? "#fff" : "#94A3B8" }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* WAITLIST */}
      <section id="waitlist" style={{ padding: "96px 24px", maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#1A56DB", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Free early access</div>
        <h2 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 900, letterSpacing: "-1px", marginBottom: 12 }}>Be the first to use it.</h2>
        <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.7, marginBottom: 32 }}>
          Join the waitlist and get free access when we launch. No spam, just your invite.
        </p>

        {submitted ? (
          <div style={{ background: "#F0FDF4", border: "1.5px solid #BBF7D0", borderRadius: 12, padding: "24px" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#065F46" }}>You're on the list!</div>
            <div style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>We'll email you when TheWorks goes live.</div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{ width: "100%", padding: "13px 16px", borderRadius: 9, border: "1.5px solid #E5E7EB", background: "#fff", color: "#0F172A", fontSize: 14, transition: "border-color 0.15s" }}
            />
            <button type="submit" style={{ width: "100%", padding: "13px", background: "#1A56DB", color: "#fff", border: "none", borderRadius: 9, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              Get early access →
            </button>
          </form>
        )}
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 14 }}>Free forever for students. No credit card needed.</p>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1.5px solid #EAECF0", padding: "28px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{ width: 30, height: 30, background: "#0F172A", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: "#1A56DB", fontFamily: "Arial Black, Arial, sans-serif" }}>W</span>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", letterSpacing: "-0.3px" }}>The<span style={{ color: "#1A56DB" }}>Works</span></span>
        </div>
        <div style={{ fontSize: 13, color: "#9CA3AF" }}>© 2026 TheWorks. Built for every student.</div>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="#paths" style={{ fontSize: 13, color: "#9CA3AF" }}>Paths</a>
          <a href="#features" style={{ fontSize: 13, color: "#9CA3AF" }}>Features</a>
          <a href="#waitlist" style={{ fontSize: 13, color: "#9CA3AF" }}>Early access</a>
        </div>
      </footer>
    </main>
  );
}
