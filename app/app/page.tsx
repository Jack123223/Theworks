"use client";
import { useState, useRef, useEffect } from "react";


const API = "/api/claude";
const MODEL = "claude-sonnet-4-6";

async function callClaude(messages: any[], system = "", max_tokens = 1000) {
  const body: any = { model: MODEL, max_tokens, messages };
  if (system) body.system = system;
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  // Surface real API errors instead of silently returning empty string
  if (!res.ok) {
    const errMsg = data?.error?.message || data?.message || `API error ${res.status}`;
    console.error("Anthropic API error:", res.status, errMsg);
    throw new Error(`API ${res.status}: ${errMsg}`);
  }
  const text = data.content?.map(b => b.text || "").join("") || "";
  if (!text) throw new Error("Empty response from API");
  return text;
}

// ── ROBUST JSON PARSER ────────────────────────────────────────────────────────
// Used by every AI feature. Handles Claude wrapping JSON in markdown,
// adding explanation text, or using slightly malformed output.
function parseJSON(raw) {
  if (!raw) throw new Error("Empty response from AI");
  let clean = raw.replace(/```json\s*/gi,"").replace(/```\s*/g,"").trim();
  // Try direct parse first
  try { return JSON.parse(clean); } catch {}
  // Extract array first (since scholarships return arrays)
  const arrMatch = clean.match(/(\[[\s\S]*\])/);
  if (arrMatch) { try { return JSON.parse(arrMatch[1]); } catch {} }
  // Then try object
  const objMatch = clean.match(/(\{[\s\S]*\})/);
  if (objMatch) { try { return JSON.parse(objMatch[1]); } catch {} }
  // Last resort — find first [ or { and parse from there
  const firstArr = clean.indexOf("[");
  const firstObj = clean.indexOf("{");
  if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
    const sub = clean.slice(firstArr);
    try { return JSON.parse(sub); } catch {}
  }
  if (firstObj !== -1) {
    const sub = clean.slice(firstObj);
    try { return JSON.parse(sub); } catch {}
  }
  throw new Error("Could not parse AI response as JSON");
}

// ── REGULATED AI SYSTEM PROMPT ───────────────────────────────────────────────
const AI_SYSTEM = `You are an academic planning assistant inside "TheWorks," an educational platform for high school students. Your role is strictly academic guidance.

YOU MAY ONLY HELP WITH:
- Academic planning (courses, GPA improvement, study habits, test prep like SAT/ACT/ASVAB/trade exams)
- School & program research (colleges, trade schools, apprenticeship programs, military academies, bootcamps)
- Scholarship and financial aid information (FAFSA, publicly known scholarships — factual only)
- Career pathway exploration tied to education (what degree/certification/training a career needs)
- Goal setting related to academics and applications
- Application strategies (essays, portfolios, interviews — general best practices only)
- Extracurricular recommendations relevant to a student's chosen path

HARD LIMITS — NEVER cross these lines:
- No legal advice of any kind (immigration status, contracts, rights disputes, lawsuits)
- No medical or mental health advice — always refer to a school counselor, doctor, or trusted adult
- No financial investment advice (stocks, crypto, anything beyond FAFSA/scholarships)
- No political opinions or endorsements of any political position
- No relationship or personal life advice unrelated to academics
- Never guarantee admissions outcomes ("you will definitely get in")
- Nothing inappropriate for a student under 18
- No specific salary negotiation or employment contract advice

If a question is outside scope, say: "That's outside what I can help with on this platform. For [topic], please speak with [appropriate resource — school counselor, doctor, parent/guardian, financial advisor, etc.]."

Tone rules:
- Honest and encouraging — don't overpromise, don't discourage
- Balanced — always show multiple options, especially across all paths (college is not the only valid choice)
- Factual — cite real program names, real test names, real timelines when known
- Specific — give concrete next steps, not vague advice
- Concise — under 250 words per response, use bullet points for steps

Student profile context is injected automatically. Use it to personalize every response.`;

// ── ALL-PATH SCHOLARSHIPS WITH REAL LINKS ────────────────────────────────────
const SCHOLARSHIPS = [
  // COLLEGE
  { id:1,  name:"Gates Scholarship",                        amount:"$10,000",     type:"Academic",       gpa:3.0, path:["College"],                          deadline:"Sep 15",  fit:92, desc:"For outstanding Pell-eligible minority high school seniors.",                    link:"https://www.thegatesscholarship.org/scholarship" },
  { id:2,  name:"Coca-Cola Scholars Program",               amount:"$20,000",     type:"Merit",          gpa:3.5, path:["College"],                          deadline:"Oct 31",  fit:88, desc:"Recognizes exceptional leaders who serve their communities.",                    link:"https://www.coca-colascholarsfoundation.org" },
  { id:3,  name:"Hispanic Scholarship Fund",                amount:"$5,000",      type:"Cultural",       gpa:2.5, path:["College"],                          deadline:"Feb 15",  fit:85, desc:"Supporting Hispanic students pursuing a college degree.",                         link:"https://www.hsf.net/scholarship" },
  { id:4,  name:"Elks National Foundation",                 amount:"$4,000",      type:"Community",      gpa:2.5, path:["College","Trade School"],            deadline:"Nov 15",  fit:78, desc:"For students who demonstrate community service and leadership.",                  link:"https://www.elks.org/scholars" },
  { id:5,  name:"Jack Kent Cooke Foundation Scholarship",   amount:"$55,000",     type:"Academic",       gpa:3.5, path:["College"],                          deadline:"Nov 20",  fit:80, desc:"For high-achieving students with demonstrated financial need.",                   link:"https://www.jkcf.org/our-scholarships/" },
  { id:6,  name:"QuestBridge National College Match",       amount:"Full ride",   type:"Need-Based",     gpa:3.5, path:["College"],                          deadline:"Sep 26",  fit:86, desc:"Matches high-achieving low-income students with top colleges.",                  link:"https://www.questbridge.org/national-college-match" },
  // TRADE / APPRENTICESHIP
  { id:7,  name:"NCCER Scholarship",                        amount:"$3,000",      type:"Trade",          gpa:2.0, path:["Trade School","Apprenticeship"],     deadline:"Mar 1",   fit:94, desc:"For students pursuing careers in construction and skilled trades.",               link:"https://www.nccer.org/workforce-development/student-recognition" },
  { id:8,  name:"SkillsUSA Alumni & Friends Scholarship",   amount:"$2,500",      type:"Trade",          gpa:2.0, path:["Trade School"],                      deadline:"Apr 15",  fit:90, desc:"Supporting career and technical education students across the US.",              link:"https://www.skillsusa.org/programs/scholarships/" },
  { id:9,  name:"mikeroweWORKS Foundation Scholarship",     amount:"$15,000",     type:"Trade",          gpa:2.0, path:["Trade School","Apprenticeship"],     deadline:"Mar 31",  fit:92, desc:"For students who work hard and pursue a career in the skilled trades.",          link:"https://www.mikeroweworks.org/scholarship/" },
  { id:10, name:"ABC Diversity & Inclusion Scholarship",    amount:"$5,000",      type:"Trade",          gpa:2.0, path:["Trade School","Apprenticeship"],     deadline:"May 1",   fit:87, desc:"For students in construction management or craft training programs.",            link:"https://abc.org/education-training/scholarships/" },
  { id:11, name:"PHCC Educational Foundation Scholarship",  amount:"$2,500",      type:"Trade",          gpa:2.0, path:["Trade School","Apprenticeship"],     deadline:"May 1",   fit:88, desc:"For students entering the plumbing-heating-cooling industry.",                    link:"https://www.phccef.org/scholarships" },
  // MILITARY
  { id:12, name:"Army ROTC 4-Year Scholarship",             amount:"Full tuition", type:"Military",      gpa:2.5, path:["Military"],                          deadline:"Jan 10",  fit:91, desc:"Full tuition plus monthly stipend for students committing to Army service.",      link:"https://www.goarmy.com/rotc/scholarships.html" },
  { id:13, name:"AFCEA STEM Scholarship",                   amount:"$5,000",      type:"Military/STEM",  gpa:3.0, path:["Military","College"],                deadline:"Jan 31",  fit:82, desc:"For students pursuing STEM degrees with a national security interest.",           link:"https://www.afcea.org/education/scholarships" },
  { id:14, name:"Navy-Marine Corps ROTC Scholarship",       amount:"Full tuition", type:"Military",      gpa:3.0, path:["Military"],                          deadline:"Jan 31",  fit:89, desc:"Full scholarship for students on the Navy or Marine Corps officer path.",         link:"https://www.nrotc.navy.mil" },
  { id:15, name:"Air Force ROTC Scholarship",               amount:"Full tuition", type:"Military",      gpa:3.0, path:["Military"],                          deadline:"Dec 1",   fit:88, desc:"Full tuition plus monthly stipend for future Air Force officers.",               link:"https://www.afrotc.com/scholarships/" },
  // ENTREPRENEURSHIP
  { id:16, name:"NASE Future Entrepreneur Scholarship",     amount:"$4,000",      type:"Entrepreneur",   gpa:2.5, path:["Entrepreneurship"],                  deadline:"Apr 15",  fit:93, desc:"For students who plan to start or grow a small business.",                       link:"https://www.nase.org/benefits/scholarships" },
  { id:17, name:"DECA Scholarships",                        amount:"$1,500",      type:"Business",       gpa:2.5, path:["Entrepreneurship","College"],         deadline:"Mar 15",  fit:85, desc:"For DECA members pursuing business or entrepreneurship education.",               link:"https://www.deca.org/programs/scholarships/" },
  { id:18, name:"Franchise Education Foundation",           amount:"$3,000",      type:"Entrepreneur",   gpa:2.0, path:["Entrepreneurship"],                  deadline:"May 31",  fit:90, desc:"For students interested in franchising and small business ownership.",           link:"https://www.franchiseeducation.org" },
  // WORKFORCE / GENERAL
  { id:19, name:"CareerOneStop Scholarship Finder",         amount:"Varies",      type:"Workforce",      gpa:0,   path:["Workforce","Trade School","Apprenticeship"], deadline:"Rolling", fit:88, desc:"Federal database matching students to scholarships for workforce entry.", link:"https://www.careeronestop.org/toolkit/training/find-scholarships.aspx" },
  { id:20, name:"Workforce Development Scholarship (DOL)",  amount:"Up to $5,000", type:"Workforce",     gpa:0,   path:["Workforce","Apprenticeship"],          deadline:"Rolling", fit:84, desc:"Department of Labor grants for students entering registered apprenticeships.",  link:"https://www.apprenticeship.gov/investments-tax-credits-and-tuition-support" },
];

// ── FIT SCORE CALCULATOR ─────────────────────────────────────────────────────
// Replaces the hardcoded fit numbers with a real calculation against
// the student's actual profile: path match, GPA eligibility, deadline urgency,
// and keyword overlap from their transcript analysis.
function calcFit(scholarship, profile) {
  let score = 40; // baseline — every scholarship starts at 40

  const studentGpa  = parseFloat(profile.gpa) || 0;
  const studentPath = profile.path || "";
  const keywords    = (profile.scholarshipKeywords || []).map(k => k.toLowerCase());
  const now         = new Date();

  // 1. PATH MATCH — biggest signal (up to +35)
  if (scholarship.path && scholarship.path.length > 0) {
    if (studentPath && scholarship.path.includes(studentPath)) {
      score += 35; // exact path match
    } else if (scholarship.path.includes("College") && studentPath === "College") {
      score += 35;
    } else if (scholarship.path.length >= 3) {
      score += 10; // broad scholarship, partial credit
    }
  } else {
    score += 15; // no path restriction = open to everyone
  }

  // 2. GPA ELIGIBILITY — hard gate then bonus (up to +15)
  const minGpa = scholarship.gpa_min || scholarship.gpa || 0;
  if (minGpa === 0) {
    score += 15; // no GPA minimum is actually good — more accessible
  } else if (studentGpa > 0) {
    if (studentGpa >= minGpa + 0.5) score += 15; // comfortably above threshold
    else if (studentGpa >= minGpa)  score += 8;  // just meets threshold
    else                             score -= 20; // below threshold — penalise
  }

  // 3. KEYWORD MATCH — transcript-to-scholarship relevance (up to +10)
  const schText = `${scholarship.name} ${scholarship.desc} ${scholarship.type}`.toLowerCase();
  const matches = keywords.filter(k => schText.includes(k)).length;
  score += Math.min(matches * 4, 10);

  // 4. DEADLINE URGENCY BONUS — upcoming deadlines are more actionable (+0 to +5)
  if (scholarship.deadline && scholarship.deadline !== "Rolling") {
    try {
      const parts    = scholarship.deadline.split(" ");
      const deadline = new Date(`${parts[0]} ${parts[1]} ${now.getFullYear()}`);
      const daysLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysLeft > 0 && daysLeft < 60)  score += 5; // coming up soon
      else if (daysLeft > 60 && daysLeft < 180) score += 2;
    } catch {}
  }

  // 5. PENALTY — if student has GPA data and clearly doesn't meet minimum
  if (studentGpa > 0 && minGpa > 0 && studentGpa < minGpa - 0.5) score -= 15;

  return Math.max(10, Math.min(99, Math.round(score)));
}

const PATHS = [
  {
    id:"College", icon:"🎓", desc:"4-year university",
    goalTemplates:["Get into my target college","Raise my GPA to qualify for honors","Write a strong personal statement","Research college programs that match my interests"],
    quickSearches:["MIT","Howard University","UCLA","University of Texas Austin","Community College"],
    researchPrompt:(school) => `You are a college admissions research assistant. Research the college or university "${school}" and provide accurate, specific information for a high school student applicant.

Use your knowledge to fill in real data about "${school}". If you are not certain about exact numbers, provide realistic ranges based on the type of institution.

Return ONLY a valid JSON object. No markdown, no backticks, no text before or after the JSON:
{
  "name": "full official name of ${school}",
  "location": "City, State",
  "acceptance_rate": "XX%",
  "avg_gpa": "X.X unweighted",
  "avg_sat": "XXXX–XXXX",
  "avg_act": "XX–XX",
  "top_programs": ["program 1", "program 2", "program 3", "program 4"],
  "application_deadline": "Early Action: Month DD / Regular: Month DD",
  "tuition": "$XX,XXX per year (in-state) / $XX,XXX (out-of-state)",
  "financial_aid": "specific financial aid info — average package, % receiving aid",
  "notable_facts": "1-2 sentences about what makes this school distinctive",
  "tips": [
    "specific tip about what this school looks for in applicants",
    "specific tip about how to strengthen your application to this school",
    "specific tip about scholarships, financial aid, or programs at this school"
  ],
  "official_url": "https://correct-official-website.edu",
  "apply_url": "https://admissions page or Common App url"
}`,
  },
  {
    id:"Trade School", icon:"🔧", desc:"Skilled trades",
    goalTemplates:["Find the best trade program for my skill set","Research apprenticeship requirements in my trade","Prepare for trade certification exams","Build a hands-on project portfolio"],
    quickSearches:["Lincoln Tech","Universal Technical Institute","Tulsa Welding School","Electrical trade school"],
    researchPrompt:(school) => `Research the trade school or program "${school}" for a prospective student. Return ONLY a JSON object (no markdown):
{"name":"...","location":"...","programs":["prog1","prog2"],"program_length":"... months/years","tuition":"$...","certifications_offered":["cert1","cert2"],"admission_requirements":"...","job_placement_rate":"...%","tips":["specific tip to get accepted and succeed 1","tip 2","tip 3"],"official_url":"https://...","apply_url":"https://..."}`,
  },
  {
    id:"Apprenticeship", icon:"🏗️", desc:"Learn while earning",
    goalTemplates:["Find a registered apprenticeship in my area","Meet the eligibility requirements to apply","Research union vs non-union apprenticeship paths","Build trade skills before applying"],
    quickSearches:["IBEW Electrician","UA Plumbers","Carpenters Union","Sheet Metal Workers","Ironworkers"],
    researchPrompt:(program) => `Research the apprenticeship program "${program}". Return ONLY a JSON object (no markdown):
{"name":"...","location":"nationwide or region","trade":"...","duration":"... years","wage_while_training":"$... per hour starting","certifications_earned":["cert1","cert2"],"eligibility":"...","sponsoring_union_or_employer":"...","tips":["specific tip to get accepted 1","tip 2","tip 3"],"official_url":"https://...","apply_url":"https://apprenticeship.gov"}`,
  },
  {
    id:"Workforce", icon:"💼", desc:"Direct career entry",
    goalTemplates:["Build a strong first resume","Find entry-level roles in my target field","Earn a relevant industry certification","Prepare for job interviews"],
    quickSearches:["Amazon","Local hospital entry level","Salesforce","Target","Walmart management"],
    researchPrompt:(employer) => `Research "${employer}" as an entry-level employer or workforce program. Return ONLY a JSON object (no markdown):
{"name":"...","industry":"...","entry_level_roles":["role1","role2"],"avg_starting_salary":"$... per year","certifications_valued":["cert1","cert2"],"application_tips":["tip1","tip2"],"career_growth":"brief summary","tips":["specific tip to get hired 1","tip 2","tip 3"],"official_url":"https://...","apply_url":"https://..."}`,
  },
  {
    id:"Military", icon:"🎖️", desc:"Serve & advance",
    goalTemplates:["Research military branches and MOS career fields","Prepare for the ASVAB exam","Meet physical fitness standards","Understand officer vs enlisted paths"],
    quickSearches:["US Army","US Navy","US Air Force","US Marine Corps","US Coast Guard"],
    researchPrompt:(branch) => `Research the military branch or program "${branch}" for a high school student considering enlistment or officer candidacy. Return ONLY a JSON object (no markdown):
{"name":"...","branch":"...","enlistment_requirements":"...","officer_requirements":"...","asvab_min_score":"...","benefits":["GI Bill education","housing allowance","healthcare"],"service_commitment":"... years","top_career_fields":["field1","field2","field3"],"tips":["specific tip to prepare for this branch 1","tip 2","tip 3"],"official_url":"https://...","apply_url":"https://..."}`,
  },
  {
    id:"Entrepreneurship", icon:"🚀", desc:"Build something",
    goalTemplates:["Validate my business idea with real users","Build a first MVP or prototype","Find a youth entrepreneurship program or mentor","Learn business and finance fundamentals"],
    quickSearches:["NFTE","YC Startup School","DECA","Junior Achievement","local business incubator"],
    researchPrompt:(program) => `Research the entrepreneurship program or incubator "${program}" for high school or college students. Return ONLY a JSON object (no markdown):
{"name":"...","type":"incubator or competition or program","focus":"...","eligibility":"...","cost":"free or $...","benefits":["benefit1","benefit2"],"notable_alumni_or_companies":"...","application_process":"...","tips":["specific tip to get accepted or succeed 1","tip 2","tip 3"],"official_url":"https://...","apply_url":"https://..."}`,
  },
];

const NAV = [
  { id:"home",         label:"Home",             icon:"🏠" },
  { id:"discover",     label:"Career Discovery",  icon:"🧭" },
  { id:"path",         label:"My Path",           icon:"🗺️" },
  { id:"transcript",   label:"Transcript",        icon:"📄" },
  { id:"scholarships", label:"Scholarships",      icon:"🏅" },
  { id:"goals",        label:"Goals",             icon:"🎯" },
  { id:"research",     label:"School Research",   icon:"🔍" },
  { id:"compare",      label:"Compare Programs",  icon:"⚖️" },
  { id:"applications", label:"Applications",      icon:"📬" },
  { id:"ai",           label:"AI Assistant",      icon:"✨" },
];

// ── SHARED ────────────────────────────────────────────────────────────────────
function Spinner() {
  return <span style={{ display:"inline-block", width:14, height:14, border:"2px solid #E2E8F0", borderTopColor:"#1A56DB", borderRadius:"50%", animation:"spin 0.7s linear infinite", verticalAlign:"middle", marginRight:6 }} />;
}
function ProgressBar({ pct, color="#1A56DB" }) {
  return (
    <div style={{ height:4, background:"#F1F5F9", borderRadius:4, overflow:"hidden", margin:"8px 0" }}>
      <div style={{ height:"100%", width:`${Math.min(pct,100)}%`, background:color, borderRadius:4, transition:"width 0.5s ease" }} />
    </div>
  );
}
function Card({ children, style={} }) {
  return <div style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:12, padding:24, marginBottom:16, ...style }}>{children}</div>;
}
function PageHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom:28 }}>
      <h1 style={{ fontSize:28, fontWeight:800, color:"#0F172A", letterSpacing:"-0.5px", margin:0, lineHeight:1.2 }}>{title}</h1>
      {subtitle && <p style={{ fontSize:15, color:"#6B7280", margin:"6px 0 0", fontWeight:400 }}>{subtitle}</p>}
    </div>
  );
}
function Badge({ children, color="#1A56DB", bg="#EFF6FF" }) {
  return <span style={{ fontSize:12, fontWeight:600, padding:"4px 12px", borderRadius:20, background:bg, color, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:5 }}>{children}</span>;
}
function SectionTitle({ children }) {
  return <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", marginBottom:12, textTransform:"uppercase", letterSpacing:"0.09em" }}>{children}</div>;
}
const S = {
  input: { width:"100%", padding:"11px 14px", border:"1.5px solid #E5E7EB", borderRadius:10, fontSize:14, color:"#111827", background:"#fff", outline:"none", boxSizing:"border-box", fontFamily:"inherit" },
  prim:  { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 22px", background:"#1A56DB", color:"#fff", border:"none", borderRadius:9, fontSize:14, fontWeight:600, cursor:"pointer" },
  sec:   { display:"inline-flex", alignItems:"center", justifyContent:"center", gap:6, padding:"10px 22px", background:"#fff", color:"#374151", border:"1.5px solid #E5E7EB", borderRadius:9, fontSize:14, cursor:"pointer" },
  chip:  { fontSize:13, padding:"6px 14px", border:"1.5px solid #DBEAFE", borderRadius:20, background:"#EFF6FF", color:"#1A56DB", cursor:"pointer", fontWeight:600, display:"inline-block" },
};

// ── CAREER DISCOVERY SURVEY ───────────────────────────────────────────────────
// 20 research-backed questions across 5 dimensions.
// Answers are mapped to career clusters, then Claude web-searches real BLS /
// O*NET / industry sources and returns factual career profiles — no AI opinions.

const SURVEY_QUESTIONS = [
  // DIMENSION 1 — How you like to work
  { id:"w1", dim:"Work Style",    q:"When you have a big project, you usually…",
    opts:["Break it into steps and follow a plan","Jump in and figure it out as you go","Talk it through with others first","Research everything before starting"] },
  { id:"w2", dim:"Work Style",    q:"A perfect work day looks like…",
    opts:["Solving a hands-on problem with my hands","Helping someone figure something out","Creating or building something new","Analyzing data or information"] },
  { id:"w3", dim:"Work Style",    q:"You work best when…",
    opts:["There's a clear structure and routine","Every day is different and unpredictable","You're collaborating with a team","You can work independently and focus"] },
  { id:"w4", dim:"Work Style",    q:"When something breaks or goes wrong, you…",
    opts:["Want to fix it yourself right away","Look for who can help or lead the fix","Find the root cause before doing anything","Document it and find a systematic solution"] },

  // DIMENSION 2 — Subjects & skills
  { id:"s1", dim:"Subjects",      q:"Which class do you actually enjoy?",
    opts:["Math or science","English or writing","Art, music, or design","Health, PE, or biology"] },
  { id:"s2", dim:"Subjects",      q:"If you had a free period every day, you'd spend it…",
    opts:["Building or making something","Reading or writing","Drawing, designing, or creating","Talking to people or organizing something"] },
  { id:"s3", dim:"Subjects",      q:"Friends come to you when they need…",
    opts:["Help fixing or figuring out how something works","Advice or someone to listen","Creative ideas or a fresh perspective","Someone to organize or plan something"] },
  { id:"s4", dim:"Subjects",      q:"Technology to you is…",
    opts:["Something I love to understand and build with","A tool I use but don't think much about","Something I use to create or express myself","Something I use to connect with people"] },

  // DIMENSION 3 — Values & motivation
  { id:"v1", dim:"Values",        q:"What matters most to you in a future job?",
    opts:["Good pay and financial stability","Making a difference in people's lives","Creative freedom and expression","Constant learning and new challenges"] },
  { id:"v2", dim:"Values",        q:"You'd feel most proud if your work…",
    opts:["Built or fixed something real","Changed someone's life for the better","Was recognized as original or creative","Solved a complex problem no one else could"] },
  { id:"v3", dim:"Values",        q:"How important is helping others in your work?",
    opts:["It's the main reason I'd go to work","Important but not the only thing","Less important — I want to build or create","I prefer working with data or systems over people"] },
  { id:"v4", dim:"Values",        q:"Earning more money vs. loving your work?",
    opts:["I need both — I won't sacrifice either","I'd take less pay for work I believe in","I'd rather earn well even if the work is just okay","I haven't really thought about this yet"] },

  // DIMENSION 4 — Environment preference
  { id:"e1", dim:"Environment",   q:"Where would you rather spend 8 hours?",
    opts:["Outdoors or in a physical workspace","In a school, hospital, or community setting","In a studio, lab, or creative space","At a desk or in an office"] },
  { id:"e2", dim:"Environment",   q:"How do you feel about physical or hands-on work?",
    opts:["I love it — I need to be moving and doing","I'm open to it if it's meaningful","I prefer mental or creative work","I'd rather avoid physical labor"] },
  { id:"e3", dim:"Environment",   q:"How do you feel about working with people all day?",
    opts:["Love it — I get energy from people","It's fine in doses but I need alone time","I prefer small focused teams","I'd rather work mostly alone"] },
  { id:"e4", dim:"Environment",   q:"Travel and varied locations for work?",
    opts:["Yes — I want variety and to see new places","Sometimes — occasional travel is fine","No — I want to be close to home","I haven't thought about this"] },

  // DIMENSION 5 — Future vision
  { id:"f1", dim:"Future Vision", q:"In 10 years, what's most important to you?",
    opts:["Own a business or be my own boss","Have a stable career with good benefits","Be known as an expert in something","Be doing work that changes the world"] },
  { id:"f2", dim:"Future Vision", q:"How do you feel about more school after high school?",
    opts:["I want to keep learning — college or grad school","I'd do a short program or certification","I'd rather learn on the job — apprenticeship or work","I'm not sure yet"] },
  { id:"f3", dim:"Future Vision", q:"Which sentence sounds most like you?",
    opts:["I want to build things people use every day","I want to take care of people","I want to create things that didn't exist before","I want to understand how systems and the world work"] },
  { id:"f4", dim:"Future Vision", q:"If you could shadow someone for a week, you'd pick…",
    opts:["A nurse, doctor, or social worker","An engineer, electrician, or contractor","A designer, filmmaker, or musician","A business owner, lawyer, or data scientist"] },
];

const DIM_COLORS = {
  "Work Style":    { bg:"#EBF5FF", color:"#1A56DB" },
  "Subjects":      { bg:"#DBEAFE", color:"#1A56DB" },
  "Values":        { bg:"#D1FAE5", color:"#065F46" },
  "Environment":   { bg:"#FEF3C7", color:"#92400E" },
  "Future Vision": { bg:"#FCE7F3", color:"#9D174D" },
};

function CareerDiscoveryPage({ profile, setProfile }) {
  const [step,      setStep]      = useState("intro");   // intro | survey | loading | results
  const [answers,   setAnswers]   = useState({});
  const [current,   setCurrent]   = useState(0);
  const [results,   setResults]   = useState(null);
  const [loadMsg,   setLoadMsg]   = useState("Mapping your answers to career clusters…");

  const total   = SURVEY_QUESTIONS.length;
  const q       = SURVEY_QUESTIONS[current];
  const answered = Object.keys(answers).length;

  const pick = (val) => {
    const next = { ...answers, [q.id]: val };
    setAnswers(next);
    if (current < total - 1) {
      setCurrent(c => c + 1);
    } else {
      runResearch(next);
    }
  };

  const goBack = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const runResearch = async (ans) => {
    setStep("loading");

    // Rotate loading messages so the student sees progress
    const msgs = [
      "Mapping your answers to career clusters…",
      "Searching Bureau of Labor Statistics data…",
      "Pulling O*NET career research…",
      "Finding salary and outlook data from real sources…",
      "Matching career profiles to your survey pattern…",
      "Compiling research — almost done…",
    ];
    let mi = 0;
    const interval = setInterval(() => { mi++; if (msgs[mi]) setLoadMsg(msgs[mi]); }, 3500);

    // Build a profile summary from answers for the prompt
    const summary = SURVEY_QUESTIONS.map(q => `${q.dim} — "${q.q}": "${ans[q.id] || "skipped"}"`).join("\n");

    const prompt = `You are a career research assistant. A student completed a career interest survey. Your job is NOT to tell them what career to pick — instead, research and present factual information about 4-5 matching career fields so they can make their own informed decision.

SURVEY ANSWERS:
${summary}

INSTRUCTIONS:
1. Analyze the answers to identify 2-3 career cluster themes (e.g. Healthcare, Skilled Trades, Creative Arts, Technology, Business, Education, Science, Public Service, Entrepreneurship)
2. For each of 4-5 specific careers that match the survey pattern, provide ONLY factual, sourced information — no opinions, no "you should"
3. Base salary data on BLS.gov Occupational Outlook Handbook figures
4. Base job outlook on BLS 10-year projections
5. Include what education/training is actually required — be honest if college is NOT required
6. Do NOT say "based on your answers you should be a ___" — instead say "Here is what research shows about this field"

Return ONLY a JSON object (no markdown):
{
  "clusters": ["cluster1", "cluster2"],
  "careers": [
    {
      "title": "Career Title",
      "cluster": "Healthcare",
      "what_they_do": "2-sentence factual description of the day-to-day work",
      "median_salary": "$XX,XXX per year",
      "salary_source": "BLS Occupational Outlook Handbook 2024-25",
      "job_outlook": "+X% growth over 10 years (faster/slower/average than average)",
      "outlook_source": "BLS 2024-2034 projections",
      "education_required": "What is actually required — be specific",
      "college_required": true or false,
      "paths_to_enter": ["path1 e.g. 4-year degree", "path2 e.g. apprenticeship", "path3 e.g. certification"],
      "why_it_matches": "1 sentence connecting survey answers to this career — factual, not prescriptive",
      "bls_url": "https://www.bls.gov/ooh/...",
      "learn_more": ["https://www.onetonline.org/...", "https://real-url.org"]
    }
  ],
  "survey_pattern": "2-sentence neutral summary of what the survey answers reveal about this student's work preferences — no career recommendations, just patterns"
}`;

    try {
      const raw    = await callClaude(
        [{ role:"user", content:prompt }],
        `You are a neutral career research assistant. You present factual data from BLS, O*NET, and industry sources. You NEVER tell students what they should do. You present options with evidence and let students decide. Always cite your data sources. Return ONLY valid JSON with no markdown or explanation.`,
        1400
      );
      clearInterval(interval);
      const parsed = parseJSON(raw);
      setResults(parsed);
      setProfile(p => ({ ...p, careerSurvey: { answers: ans, results: parsed, completedAt: new Date().toLocaleDateString() } }));
      setStep("results");
    } catch(err) {
      clearInterval(interval);
      console.error("Career survey error:", err.message);
      setResults({ _error: true, clusters:[], careers:[], survey_pattern: "The career research could not load. Make sure your API key is set (green pill, bottom right) and try retaking the survey." });
      setStep("results");
    }
  };

  const restart = () => { setStep("intro"); setAnswers({}); setCurrent(0); setResults(null); };

  // ── INTRO ──
  if (step === "intro") return (
    <div>
      <Card style={{ textAlign:"center", padding:"32px 24px" }}>
        <div style={{ fontSize:40, marginBottom:12 }}>🧭</div>
        <div style={{ fontSize:18, fontWeight:700, color:"#1F2937", marginBottom:8 }}>Career Discovery Survey</div>
        <div style={{ fontSize:14, color:"#6B7280", lineHeight:1.7, maxWidth:480, margin:"0 auto 20px" }}>
          Not sure what you want to do? This survey asks about how you work, what you enjoy, and what matters to you — then researches real career data from the Bureau of Labor Statistics and O*NET so <strong>you</strong> can decide what fits.
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, maxWidth:400, margin:"0 auto 24px", textAlign:"left" }}>
          {[
            ["📋","20 questions","Takes about 5–8 minutes"],
            ["🔍","Real research","BLS & O*NET data, not AI opinions"],
            ["🚫","No pressure","We don't tell you what to do"],
            ["🔄","Retake anytime","Change your answers any time"],
          ].map(([icon,title,sub])=>(
            <div key={title} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px" }}>
              <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{title}</div>
              <div style={{ fontSize:11, color:"#9CA3AF" }}>{sub}</div>
            </div>
          ))}
        </div>
        {profile.careerSurvey && (
          <div style={{ fontSize:12, color:"#1A56DB", marginBottom:12 }}>
            ✅ Last completed {profile.careerSurvey.completedAt} — <button onClick={()=>{ setResults(profile.careerSurvey.results); setStep("results"); }} style={{ background:"none", border:"none", color:"#1A56DB", cursor:"pointer", fontWeight:600, fontSize:12 }}>view results</button>
          </div>
        )}
        <button onClick={()=>setStep("survey")} style={{ ...S.prim, fontSize:14, padding:"10px 28px" }}>Start the survey →</button>
      </Card>

      <Card style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
        <div style={{ fontSize:12, fontWeight:700, color:"#1A56DB", marginBottom:6 }}>What this survey does NOT do</div>
        <div style={{ fontSize:13, color:"#374151", lineHeight:1.7 }}>
          It does not tell you what career to pick. It does not say "you should be a nurse" or "you'd make a great engineer." Instead it pulls factual data — salaries, job growth, required education, and realistic entry paths — for careers that match your answer patterns. <strong>You make the call.</strong>
        </div>
      </Card>
    </div>
  );

  if (step === "survey") {
    const dim = q.dim;
    const dc  = DIM_COLORS[dim];
    return (
      <div style={{ maxWidth:740, margin:"0 auto" }}>
        {/* Header row */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase" }}>Career Discovery Survey</div>
          <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase" }}>Question {current+1} of {total}</div>
        </div>

        {/* Progress bar */}
        <div style={{ height:4, background:"#E5E7EB", borderRadius:4, overflow:"hidden", marginBottom:36 }}>
          <div style={{ height:"100%", width:`${((current+1)/total)*100}%`, background:"#1A56DB", borderRadius:4, transition:"width 0.3s" }} />
        </div>

        {/* Big bold question */}
        <h2 style={{ fontSize:26, fontWeight:800, color:"#0F172A", letterSpacing:"-0.3px", lineHeight:1.3, marginBottom:28 }}>
          {q.q}
        </h2>

        {/* Answer cards - tall, full width */}
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {q.opts.map((opt, i) => (
            <button key={i} onClick={() => pick(opt)}
              style={{ textAlign:"left", padding:"18px 22px", border:`1.5px solid ${answers[q.id]===opt?"#1A56DB":"#E5E7EB"}`, borderRadius:12, background:answers[q.id]===opt?"#F0F5FF":"#fff", fontSize:15, fontWeight:600, color:answers[q.id]===opt?"#1A56DB":"#1F2937", cursor:"pointer", transition:"all 0.12s", boxShadow:answers[q.id]===opt?"0 0 0 3px rgba(26,86,219,0.1)":"none" }}>
              {opt}
            </button>
          ))}
        </div>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:24 }}>
          <button onClick={goBack} disabled={current===0} style={{ ...S.sec, opacity:current===0?0.35:1, fontSize:13 }}>← Back</button>
          <span style={{ fontSize:12, color:"#9CA3AF", fontStyle:"italic" }}>Answers are stored locally for comparison</span>
          {answers[q.id] && current < total-1 && (
            <button onClick={()=>setCurrent(c=>c+1)} style={{ ...S.prim, fontSize:13 }}>Next →</button>
          )}
        </div>
      </div>
    );
  }

  // ── LOADING ──
  if (step === "loading") return (
    <div style={{ textAlign:"center", padding:"60px 20px" }}>
      <div style={{ fontSize:36, marginBottom:16 }}>🔍</div>
      <div style={{ fontSize:15, fontWeight:600, color:"#1F2937", marginBottom:8 }}>Researching career data…</div>
      <div style={{ fontSize:13, color:"#6B7280", marginBottom:24 }}>{loadMsg}</div>
      <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
        {[0,1,2].map((i: any) =>(
          <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"#1A56DB", animation:`bounce 1s ease-in-out ${i*0.2}s infinite` }} />
        ))}
      </div>
      <div style={{ marginTop:32, fontSize:12, color:"#9CA3AF", maxWidth:360, margin:"32px auto 0" }}>
        Pulling salary data from the Bureau of Labor Statistics Occupational Outlook Handbook and career profiles from O*NET — this takes 15–30 seconds.
      </div>
    </div>
  );

  // ── RESULTS ──
  if (step === "results") {
    if (!results) return (
      <Card style={{ textAlign:"center", padding:32 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>⚠️</div>
        <div style={{ fontSize:14, color:"#374151", marginBottom:16 }}>Research couldn't load. Please try again.</div>
        <button onClick={restart} style={S.prim}>Retake survey</button>
      </Card>
    );

    return (
      <div>
        {/* Header */}
        <Card style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#1F2937", marginBottom:6 }}>🧭 Your survey pattern</div>
          <div style={{ fontSize:13, color:"#374151", lineHeight:1.6, marginBottom:12 }}>{results.survey_pattern}</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {results.clusters?.map((c: any,i: number)=>(
              <span key={i} style={{ fontSize:12, fontWeight:600, padding:"3px 10px", borderRadius:10, background:"#EBF5FF", color:"#1A56DB" }}>{c}</span>
            ))}
          </div>
        </Card>

        {/* Disclaimer */}
        <div style={{ background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#92400E", lineHeight:1.5 }}>
          <strong>📌 How to read these results:</strong> The careers below are shown because they match patterns in your answers. This is not a recommendation. Read the facts, explore the links, and decide for yourself what sounds interesting. No one should choose your career but you.
        </div>

        {/* Career cards */}
        {results.careers?.map((career, i) => (
          <Card key={i}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:700, color:"#1F2937" }}>{career.title}</div>
                <div style={{ fontSize:12, color:"#1A56DB", fontWeight:600, marginTop:2 }}>{career.cluster}</div>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:14, fontWeight:700, color:"#059669" }}>{career.median_salary}</div>
                <div style={{ fontSize:10, color:"#9CA3AF" }}>median salary</div>
              </div>
            </div>

            {/* What they do */}
            <div style={{ fontSize:13, color:"#374151", lineHeight:1.6, marginBottom:12 }}>{career.what_they_do}</div>

            {/* Key facts grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
              <div style={{ background:"#F9FAFB", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"#9CA3AF", marginBottom:3 }}>JOB OUTLOOK (10-year)</div>
                <div style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{career.job_outlook}</div>
                <div style={{ fontSize:10, color:"#9CA3AF", marginTop:2 }}>{career.outlook_source}</div>
              </div>
              <div style={{ background:"#F9FAFB", borderRadius:8, padding:"8px 10px" }}>
                <div style={{ fontSize:10, color:"#9CA3AF", marginBottom:3 }}>COLLEGE REQUIRED?</div>
                <div style={{ fontSize:13, fontWeight:600, color: career.college_required?"#1E40AF":"#065F46" }}>
                  {career.college_required ? "Yes, typically" : "No — multiple paths exist"}
                </div>
              </div>
            </div>

            {/* Education */}
            <div style={{ marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:4, textTransform:"uppercase", letterSpacing:"0.04em" }}>Education / Training Required</div>
              <div style={{ fontSize:13, color:"#374151", lineHeight:1.5 }}>{career.education_required}</div>
            </div>

            {/* Entry paths */}
            {career.paths_to_enter?.length > 0 && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.04em" }}>Ways to enter this field</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {career.paths_to_enter.map((p: any, j: number) =>(
                    <span key={j} style={{ fontSize:12, padding:"3px 10px", borderRadius:10, background:"#EBF5FF", color:"#1A56DB", fontWeight:500 }}>{p}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Why it matched — neutral framing */}
            {career.why_it_matches && (
              <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:8, padding:"8px 12px", marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#065F46", marginBottom:3 }}>WHY THIS APPEARED IN YOUR RESULTS</div>
                <div style={{ fontSize:12, color:"#374151" }}>{career.why_it_matches}</div>
              </div>
            )}

            {/* Salary source */}
            <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:10 }}>
              Salary data: {career.salary_source}
            </div>

            {/* Research links */}
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {career.bls_url && (
                <a href={career.bls_url} target="_blank" rel="noreferrer"
                  style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:"#1A56DB", textDecoration:"none", border:"1px solid #BFDBFE", borderRadius:6, padding:"5px 12px", background:"#EFF6FF" }}>
                  📊 BLS.gov data ↗
                </a>
              )}
              {career.learn_more?.filter((u: any) =>u&&u.startsWith("http")).slice(0,2).map((url: any, j: number) =>(
                <a key={j} href={url} target="_blank" rel="noreferrer"
                  style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:12, fontWeight:600, color:"#1A56DB", textDecoration:"none", border:"1px solid #BFDBFE", borderRadius:6, padding:"5px 12px", background:"#EFF6FF" }}>
                  Learn more ↗
                </a>
              ))}
            </div>
          </Card>
        ))}

        {/* Bottom CTA */}
        <Card style={{ background:"#F9FAFB" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"#374151", marginBottom:8 }}>What to do next</div>
          <div style={{ fontSize:13, color:"#6B7280", lineHeight:1.7, marginBottom:12 }}>
            Read through these career profiles. Click the BLS and O*NET links to go deeper on any that caught your attention. Then use <strong>School Research</strong> to look up programs that lead to those fields, or <strong>AI Assistant</strong> to ask specific questions about any career above — the AI will give you factual information, not push you toward any option.
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <button onClick={restart} style={S.sec}>🔄 Retake survey</button>
          </div>
        </Card>
      </div>
    );
  }

  return null;
}

// ── HOME ──────────────────────────────────────────────────────────────────────
function HomePage({ profile, goals, setPage }) {
  const score = Math.min(100, Math.round(
    (profile.path ? 15 : 0) + (profile.gpa ? 10 : 0) +
    (profile.transcriptAnalysis ? 25 : 0) +
    (goals.filter((g: any) =>g.progress>0).length * 10) +
    (profile.researched?.length > 0 ? 15 : 0)
  ));
  const pathObj   = PATHS.find(p => p.id === profile.path);
  const timeOfDay = new Date().getHours();
  const timeGreet = timeOfDay < 12 ? "Good Morning" : timeOfDay < 17 ? "Good Afternoon" : "Good Evening";
  const subtitle  = profile.path
    ? "Your post-grad plan is coming together."
    : "Let's figure out your path and build your plan.";

  const statCards = [
    { label:"Readiness",    value:`${score}%`,           icon:"📈", iconBg:"#EFF6FF" },
    { label:"Chosen Path",  value:profile.path||"—",     icon:pathObj?.icon||"🗺️", iconBg:"#F0FDF4" },
    { label:"GPA",          value:profile.gpa||"--",     icon:"🎓", iconBg:"#FAF5FF" },
    { label:"Active Goals", value:goals.length,          icon:"🎯", iconBg:"#FFF7ED" },
  ];

  const quickActions = [
    { label:"Choose my path",     id:"path",         done:!!profile.path,              icon:"🗺️" },
    { label:"Analyze transcript", id:"transcript",   done:!!profile.transcriptAnalysis, icon:"📄" },
    { label:"Find scholarships",  id:"scholarships", done:false,                        icon:"💰" },
    { label:"Discover careers",   id:"discover",     done:false,                        icon:"🔍" },
  ];

  const insights = [
    profile.path ? `You're on the ${profile.path} track. Scholarships, goals & AI are all tailored to this path.` : "Start by choosing your path — college, trade, military, and more are all valid.",
    profile.gpa ? `GPA ${profile.gpa} on record.${!profile.transcriptAnalysis?" Upload your transcript for a deeper AI analysis.":""}` : "Add your GPA and transcripts to unlock personalized scholarship recommendations.",
    goals.length > 0 ? `${goals.length} active goal${goals.length>1?"s":""} — ${goals.filter((g: any) =>g.progress===100).length} completed. Keep going!` : "Set your first goal and get an AI-built step-by-step roadmap.",
  ].filter(Boolean);

  return (
    <div style={{ maxWidth:960 }}>
      {/* Greeting + progress */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:28 }}>
        <div>
          <h1 style={{ fontSize:32, fontWeight:800, color:"#0F172A", letterSpacing:"-0.5px", margin:0 }}>
            {timeGreet}{profile.name?`, ${profile.name}`:""}.</h1>
          <p style={{ fontSize:15, color:"#6B7280", marginTop:6, fontWeight:400 }}>{subtitle}</p>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:6 }}>Setup progress {score}%</div>
          <div style={{ width:200, height:4, background:"#E5E7EB", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${score}%`, background:"#1A56DB", borderRadius:4, transition:"width 0.5s" }}/>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
        {statCards.map((s: any) =>(
          <div key={s.label} style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:14, padding:"20px 20px 18px" }}>
            <div style={{ width:38, height:38, borderRadius:10, background:s.iconBg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, marginBottom:14 }}>
              {s.icon}
            </div>
            <div style={{ fontSize:12, color:"#9CA3AF", fontWeight:500, marginBottom:4 }}>{s.label}</div>
            <div style={{ fontSize:22, fontWeight:800, color:"#0F172A", letterSpacing:"-0.5px" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Bottom two columns */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>

        {/* Personalized insights */}
        <div style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:14, padding:24 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#0F172A", marginBottom:16, display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>⚡</span> Personalized Insights
          </div>
          {insights.map((ins: any, i: number) =>(
            <div key={i} style={{ display:"flex", gap:12, padding:"12px 0", borderBottom:i<insights.length-1?"1px solid #F3F4F6":"none", alignItems:"flex-start" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#1A56DB", marginTop:6, flexShrink:0 }}/>
              <div style={{ fontSize:14, color:"#374151", lineHeight:1.6 }}>{ins}</div>
            </div>
          ))}
          {!profile.gpa && (
            <button onClick={()=>setPage("transcript")} style={{ marginTop:14, background:"none", border:"none", color:"#1A56DB", fontSize:13, fontWeight:600, cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:5 }}>
              Add GPA →
            </button>
          )}
        </div>

        {/* Quick Actions */}
        <div style={{ background:"#fff", border:"1px solid #EAECF0", borderRadius:14, padding:24 }}>
          <div style={{ fontSize:15, fontWeight:700, color:"#0F172A", marginBottom:16 }}>Quick Actions</div>
          {quickActions.map((a: any,i: number)=>(
            <button key={a.id} onClick={()=>setPage(a.id)} style={{
              display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%",
              padding:"13px 0",
              background:"none", border:"none", borderBottom:i<quickActions.length-1?"1px solid #F9FAFB":"none",
              cursor:"pointer", textAlign:"left",
            }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:"#F8FAFC", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>{a.icon}</div>
                <span style={{ fontSize:14, fontWeight:500, color:a.done?"#9CA3AF":"#1F2937", textDecoration:a.done?"line-through":"none" }}>{a.label}</span>
              </div>
              {a.done
                ? <span style={{ color:"#10B981", fontSize:18 }}>✓</span>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function PathPage({ profile, setProfile }) {
  const PATH_ICONS_BG = {
    "College":        "#3B82F6",
    "Trade School":   "#94A3B8",
    "Apprenticeship": "#F59E0B",
    "Workforce":      "#8B5CF6",
    "Military":       "#EF4444",
    "Entrepreneurship":"#10B981",
  };
  return (
    <div style={{ maxWidth:900 }}>
      <PageHeader title="Choose Your Post-Grad Path" subtitle="Every path is valid and supported. You can change this anytime." />
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16 }}>
        {PATHS.map((p: any) =>{
          const active = profile.path===p.id;
          return (
            <div key={p.id} onClick={()=>setProfile(pr=>({...pr,path:p.id}))}
              style={{ background:"#fff", border:`2px solid ${active?"#1A56DB":"#EAECF0"}`, borderRadius:16, padding:"28px 24px", cursor:"pointer", position:"relative", transition:"border-color 0.15s, box-shadow 0.15s", boxShadow:active?"0 0 0 4px rgba(26,86,219,0.08)":"none" }}>
              {active && <div style={{ position:"absolute", top:14, right:14, width:12, height:12, borderRadius:"50%", background:"#1A56DB" }}/>}
              <div style={{ width:52, height:52, borderRadius:14, background:active?"#1A56DB":PATH_ICONS_BG[p.id]||"#E5E7EB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:26, marginBottom:16, opacity:active?1:0.85 }}>
                {p.icon}
              </div>
              <div style={{ fontSize:17, fontWeight:700, color:active?"#1A56DB":"#0F172A", marginBottom:6 }}>{p.id}</div>
              <div style={{ fontSize:13, color:"#6B7280", lineHeight:1.5 }}>{p.desc}</div>
            </div>
          );
        })}
      </div>
      {profile.path && (
        <div style={{ marginTop:24, background:"#fff", border:"1px solid #EAECF0", borderRadius:14, padding:24 }}>
          <div style={{ fontSize:14, fontWeight:700, color:"#0F172A", marginBottom:12 }}>
            Suggested first steps for {profile.path}
          </div>
          {PATHS.find((p: any) =>p.id===profile.path)?.goalTemplates.map((g: any,i: number)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:i<(PATHS.find((p: any) =>p.id===profile.path)?.goalTemplates.length-1)?"1px solid #F9FAFB":"none" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#1A56DB", flexShrink:0 }}/>
              <div style={{ fontSize:14, color:"#374151" }}>{g}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TRANSCRIPT ────────────────────────────────────────────────────────────────
const SAMPLE_TRANSCRIPT = `GPA: 3.2
Semester: Fall 2024

Courses:
- AP English Literature: A-
- Pre-Calculus: C+
- US History: B+
- Biology: B
- Marketing & Entrepreneurship: A
- Physical Education: A

Activities: DECA Business Club, School Newspaper (Editor), Volunteer Tutor
Test Scores: SAT 1240 (Math 580, Reading 660)
Awards: Honor Roll Spring 2024`;

function TranscriptPage({ profile, setProfile }) {
  const [text,     setText]     = useState("");
  const [gpa,      setGpa]      = useState(profile.gpa||"");
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(profile.transcriptAnalysis||null);
  const [dragging, setDragging] = useState(false);
  const [mode,     setMode]     = useState("upload"); // "upload" | "paste" | "manual"
  const [fileErr,  setFileErr]  = useState("");
  const [fileName, setFileName] = useState("");
  const [courses,  setCourses]  = useState([{name:"",grade:""},{name:"",grade:""},{name:"",grade:""}]);
  const fileRef = useRef<any>(null);

  // ── Real FileReader — reads .txt / .csv locally in-browser ──
  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileErr("");
    setFileName(file.name);
    const ext = file.name.split(".").pop().toLowerCase();

    // ── Plain text files ──────────────────────────────────────────────────
    if (["txt","csv","rtf","text"].includes(ext) || file.type.startsWith("text/")) {
      const reader = new FileReader();
      reader.onload  = (ev) => { setText(ev.target.result); setFileErr(""); };
      reader.onerror = ()   => setFileErr("Could not read this file. Try the Paste Text tab instead.");
      reader.readAsText(file);
      return;
    }

    // ── PDF — use PDF.js for proper text extraction ───────────────────────
    if (ext === "pdf" || file.type === "application/pdf") {
      setFileErr("");
      setFileName(file.name);
      setText(""); // clear while loading

      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          // PDF.js loaded via layout Script tag
          const pdfjsLib = (window as any).pdfjsLib;
          if (!pdfjsLib) {
            setFileErr("PDF reader not available. Switch to Paste Text tab and copy your grades.");
            return;
          }
          // Set worker source if not already set
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc =
              "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          }
          const typedArray = new Uint8Array(ev.target.result as ArrayBuffer);
          const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
          const allText = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(" ");
            if (pageText.trim()) allText.push(pageText.trim());
          }
          const extracted = allText.join("\n").trim();
          if (extracted.length > 20) {
            setText(extracted);
            setFileErr("");
          } else {
            setFileErr("This PDF appears to be a scanned image with no readable text. Switch to the Paste Text tab and copy your grades from your school portal, or use Enter Courses to type them manually.");
          }
        } catch (err) {
          console.error("PDF error:", err);
          setFileErr("Could not read this PDF. Switch to Paste Text and copy your grades from your school portal instead.");
        }
      };
      reader.onerror = () => setFileErr("Could not open this file. Try Paste Text tab.");
      reader.readAsArrayBuffer(file);
      return;
    }

    // ── Word docs (.docx, .doc) ───────────────────────────────────────────
    if (["doc","docx"].includes(ext) || file.type.includes("word") || file.type.includes("officedocument")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const bytes = new Uint8Array(ev.target.result);
          let raw = "";
          for (let i = 0; i < bytes.length; i++) {
            const c = bytes[i];
            if (c >= 32 && c < 127) raw += String.fromCharCode(c);
            else if (c === 10 || c === 13) raw += "\n";
          }
          const wtRe = /<w:t[^>]*>([^<]+)<\/w:t>/g;
          const chunks = [];
          let m;
          while ((m = wtRe.exec(raw)) !== null) {
            if (m[1].trim()) chunks.push(m[1].trim());
          }
          const extracted = chunks.join(" ").trim();
          if (extracted.length > 20) {
            setText(extracted);
            setFileErr("");
          } else {
            setFileErr("Could not extract text from this Word file. Try copying from the document and using the Paste Text tab.");
          }
        } catch {
          setFileErr("Could not read this Word file. Try copying your grades and pasting them in the Paste Text tab.");
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // ── Images ───────────────────────────────────────────────────────────
    if (file.type.startsWith("image/") || ["png","jpg","jpeg","gif","webp","heic"].includes(ext)) {
      setFileErr("Image files can't be read as text. Switch to the Enter Courses tab and type your grades in manually — it only takes a minute.");
      setText("");
      return;
    }

    // ── Anything else — try reading as plain text ─────────────────────────
    const reader = new FileReader();
    reader.onload  = (ev) => { setText(ev.target.result); setFileErr(""); };
    reader.onerror = ()   => setFileErr("Could not read this file type. Try the Paste Text or Enter Courses tabs.");
    reader.readAsText(file);
  };

  // Drag-and-drop zone — handles both file drops AND text drops
  const onDragOver  = (e: any) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = ()  => setDragging(false);
  const onDrop      = (e) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      // treat exactly like file input
      const fakeEvt = { target: { files: [file] } };
      handleFileChange(fakeEvt);
      return;
    }
    const dropped = e.dataTransfer.getData("text");
    if (dropped) setText(t => t ? t + "\n" + dropped : dropped);
  };

  const buildTextFromCourses = () => {
    const lines = courses.filter((c: any) =>c.name.trim()).map((c: any) =>`- ${c.name}: ${c.grade||"N/A"}`);
    return `GPA: ${gpa}\n\nCourses:\n${lines.join("\n")}`;
  };

  const analyze = async () => {
    const src = mode === "manual" ? buildTextFromCourses() : text;
    if (!src.trim() && !gpa) return;
    setLoading(true);
    const prompt = `You are a school academic advisor analyzing a student's transcript or grade information.

Student information:
- Raw input: "${src || "No transcript text provided"}"
- GPA entered: ${gpa || "not provided"}
- Path / goal: ${profile.path || "undecided"}

Your job is to analyze this and return a DETAILED, SPECIFIC academic profile.

IMPORTANT RULES:
1. Extract every course name and grade you can find in the text
2. Write recommendations that are SPECIFIC to what you see — not generic advice
3. If the GPA is provided, use it. If not, estimate from grades
4. Identify real strengths and real weaknesses based on actual grades
5. pathReadiness should reflect how ready this student is for their path (0-100)
6. Write 4-6 recommendations that a real counselor would give THIS specific student

Return ONLY valid JSON (absolutely no markdown, no backticks, no explanation before or after):
{
  "gpa": "${gpa || "estimated from grades"}",
  "strengths": ["specific subject or skill showing strength"],
  "weaknesses": ["specific subject or area needing improvement"],
  "courses": [
    {"name": "exact course name from input", "grade": "letter grade", "trend": "improving or stable or declining"}
  ],
  "summary": "3-4 sentences describing THIS student specifically — mention actual courses and grades",
  "recommendations": [
    "Specific recommendation 1 — mention actual course or subject",
    "Specific recommendation 2",
    "Specific recommendation 3",
    "Specific recommendation 4",
    "Specific recommendation 5"
  ],
  "pathReadiness": 65,
  "pathReadinessLabel": "${profile.path || "General"} Readiness",
  "scholarshipKeywords": ["keyword1", "keyword2", "keyword3"]
}`;

    try {
      const raw    = await callClaude([{role:"user",content:prompt}],"",2000);
      // Robust JSON extraction — find the JSON block even if Claude adds text around it
      const clean  = raw.replace(/```json/g,"").replace(/```/g,"").trim();
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      const parsed = JSON.parse(jsonMatch[0]);
      // Ensure required fields exist
      if (!parsed.recommendations || parsed.recommendations.length === 0) {
        parsed.recommendations = ["Review your course list with your school counselor for personalized advice."];
      }
      if (!parsed.summary) parsed.summary = `Analysis complete for ${profile.path || "general"} path.`;
      setResult(parsed);
      setProfile(p=>({...p, transcriptAnalysis:parsed, gpa:parsed.gpa||gpa, scholarshipKeywords:parsed.scholarshipKeywords}));
    } catch(err) {
      // Show the actual error so we can debug, not a silent fallback
      setResult({
        _error: true,
        gpa: gpa || "unknown",
        summary: "Analysis failed — the AI response could not be parsed. This usually means the API key is not set or the input was too short. Please check your API key (green pill bottom right) and try again with more course information.",
        strengths: [],
        weaknesses: [],
        courses: [],
        recommendations: [
          "Make sure your API key is set — click the green/yellow pill in the bottom right corner",
          "Try entering more information — at least 3 courses with grades",
          "If using the Upload tab, try switching to Paste Text and copying your grades manually",
        ],
        pathReadiness: 0,
        pathReadinessLabel: "Setup needed",
        scholarshipKeywords: []
      });
    }
    setLoading(false);
  };

  const addCourse    = () => setCourses(c=>[...c,{name:"",grade:""}]);
  const updateCourse = (i,field,val) => setCourses(c=>c.map((r: any, idx: number) =>idx===i?{...r,[field]:val}:r));
  const clearAll     = () => { setText(""); setFileName(""); setFileErr(""); setResult(null); setCourses([{name:"",grade:""},{name:"",grade:""},{name:"",grade:""}]); if(fileRef.current) fileRef.current.value=""; };

  return (
    <div style={{ maxWidth:800 }}>
      <PageHeader title="Transcript & Analysis" subtitle="AI reads your grades to find keywords for scholarship matching." />
      <Card>

        {/* Mode toggle — matches screenshot pill style */}
        <div style={{ display:"flex", gap:0, marginBottom:20, border:"1.5px solid #E5E7EB", borderRadius:10, overflow:"hidden", width:"fit-content" }}>
          {[["upload","Upload"],["paste","Paste"],["manual","Manual"]].map(([id,label])=>(
            <button key={id} onClick={()=>setMode(id)}
              style={{ padding:"8px 20px", fontSize:13, fontWeight:600, border:"none", borderRight:id!=="manual"?"1.5px solid #E5E7EB":"none", cursor:"pointer", background:mode===id?"#1A56DB":"#fff", color:mode===id?"#fff":"#6B7280" }}>
              {label}
            </button>
          ))}
        </div>

        {/* GPA row */}
        <div style={{ marginBottom:18 }}>
          <label style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", display:"block", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.06em" }}>Your Current GPA</label>
          <input value={gpa} onChange={e=>setGpa(e.target.value)} placeholder="e.g. 3.8" style={{ ...S.input, width:200 }} />
        </div>

        {/* ── UPLOAD MODE ── */}
        {mode === "upload" && (
          <div>
            <input ref={fileRef} type="file" accept=".txt,.csv,.pdf,.doc,.docx,.rtf,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{ display:"none" }} onChange={handleFileChange} />

            {/* Drop zone — matches screenshot exactly */}
            <div
              onClick={()=>fileRef.current.click()}
              onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
              style={{ border:`2px dashed ${dragging?"#1A56DB":"#D1D5DB"}`, borderRadius:12, padding:"52px 32px", textAlign:"center", cursor:"pointer", background:dragging?"#EFF6FF":"#FAFAFA", transition:"all 0.15s", marginBottom:12 }}>
              {fileName?(
                <>
                  <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#0F172A", marginBottom:4 }}>{fileName}</div>
                  <div style={{ fontSize:13, color:"#6B7280" }}>File loaded — click Analyze below</div>
                </>
              ):(
                <>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5" style={{ marginBottom:14, display:"block", margin:"0 auto 14px" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
                  </svg>
                  <div style={{ fontSize:16, fontWeight:700, color:"#0F172A", marginBottom:6 }}>Drop transcript or click to upload</div>
                  <div style={{ fontSize:13, color:"#6B7280" }}>Support PDF, TXT, or CSV from school portals</div>
                </>
              )}
            </div>

            {fileErr && <div style={{ fontSize:13, color:"#DC2626", marginBottom:10, background:"#FEF2F2", padding:"10px 14px", borderRadius:8 }}>⚠️ {fileErr}</div>}

            {text && !fileErr && (
              <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:10, padding:12, marginBottom:10, maxHeight:120, overflowY:"auto" }}>
                <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:4 }}>Preview — {text.split("\n").length} lines loaded</div>
                <pre style={{ fontSize:11, color:"#374151", margin:0, whiteSpace:"pre-wrap", fontFamily:"monospace" }}>{text.slice(0,600)}{text.length>600?"…":""}</pre>
              </div>
            )}
          </div>
        )}

        {/* ── PASTE MODE ── */}
        {mode === "paste" && (
          <>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:6, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span>Copy from your school portal and paste below</span>
              <button onClick={()=>setText(SAMPLE_TRANSCRIPT)} style={{ fontSize:11, color:"#1A56DB", background:"none", border:"1px solid #BFDBFE", borderRadius:5, padding:"2px 8px", cursor:"pointer" }}>
                Load sample ↓
              </button>
            </div>
            <textarea value={text} onChange={e=>setText(e.target.value)}
              placeholder={"Paste your grades here, e.g.:\n\nAP English: A-\nPre-Calculus: C+\nUS History: B+\nBiology: B\n\nAny format works — the AI will parse it."}
              style={{ ...S.input, height:160, resize:"vertical", fontFamily:"'Courier New',monospace", fontSize:12 }} />
          </>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === "manual" && (
          <div>
            <div style={{ fontSize:12, color:"#6B7280", marginBottom:10 }}>Type each course name and your current grade</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 72px", gap:"6px 8px", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:11, fontWeight:600, color:"#9CA3AF" }}>Course name</div>
              <div style={{ fontSize:11, fontWeight:600, color:"#9CA3AF" }}>Grade</div>
              {courses.map((c: any,i: number)=>(
                <>
                  <input key={`n${i}`} value={c.name} onChange={e=>updateCourse(i,"name",e.target.value)} placeholder="e.g. AP English" style={S.input} />
                  <input key={`g${i}`} value={c.grade} onChange={e=>updateCourse(i,"grade",e.target.value)} placeholder="A-" style={S.input} />
                </>
              ))}
            </div>
            <button onClick={addCourse} style={{ ...S.sec, fontSize:12, padding:"5px 12px" }}>+ Add course</button>
          </div>
        )}

        <div style={{ display:"flex", gap:8, marginTop:14 }}>
          <button onClick={analyze} disabled={loading} style={S.prim}>
            {loading?<><Spinner/>Analyzing…</>:"✨ Analyze with AI"}
          </button>
          <button onClick={clearAll} style={S.sec}>Clear</button>
        </div>
      </Card>

      {result && (
        <>
          <Card>
            <SectionTitle>📊 Academic overview</SectionTitle>
            <div style={{ fontSize:13, color:"#374151", lineHeight:1.6, marginBottom:12 }}>{result.summary}</div>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#6B7280", marginBottom:2 }}>
              <span>{result.pathReadinessLabel||"Readiness"}</span>
              <span style={{ fontWeight:600, color:"#1A56DB" }}>{result.pathReadiness}%</span>
            </div>
            <ProgressBar pct={result.pathReadiness} />
          </Card>
          {result.courses?.length>0 && (
            <Card>
              <SectionTitle>📚 Course breakdown</SectionTitle>
              {result.courses.map((c: any,i: number)=>(
                <div key={i} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 0", borderBottom:i<result.courses.length-1?"1px solid #F3F4F6":"none" }}>
                  <span style={{ fontSize:13, color:"#374151" }}>{c.name}</span>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    <Badge bg={c.grade?.startsWith("A")?"#D1FAE5":c.grade?.startsWith("B")?"#DBEAFE":"#FEF3C7"} color={c.grade?.startsWith("A")?"#065F46":c.grade?.startsWith("B")?"#1E40AF":"#92400E"}>{c.grade}</Badge>
                    <span style={{ fontSize:11, color:"#9CA3AF" }}>{c.trend==="improving"?"↑":c.trend==="declining"?"↓":"→"} {c.trend}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}
          <Card>
            <SectionTitle>💡 AI recommendations</SectionTitle>
            {result.recommendations?.map((r: any,i: number)=>(
              <div key={i} style={{ display:"flex", gap:10, padding:"7px 0", borderBottom:i<result.recommendations.length-1?"1px solid #F3F4F6":"none" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#1A56DB", marginTop:5, flexShrink:0 }} />
                <div style={{ fontSize:13, color:"#374151", lineHeight:1.5 }}>{r}</div>
              </div>
            ))}
          </Card>
          {(result.strengths?.length>0||result.weaknesses?.length>0) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
              <Card>
                <div style={{ fontSize:12, fontWeight:700, color:"#065F46", marginBottom:8 }}>✅ Strengths</div>
                {result.strengths?.map((s: any, i: number) =><div key={i} style={{ fontSize:13, color:"#374151", padding:"3px 0" }}>• {s}</div>)}
              </Card>
              <Card>
                <div style={{ fontSize:12, fontWeight:700, color:"#92400E", marginBottom:8 }}>⚠️ Needs improvement</div>
                {result.weaknesses?.map((s: any, i: number) =><div key={i} style={{ fontSize:13, color:"#374151", padding:"3px 0" }}>• {s}</div>)}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
// ── SCHOLARSHIPS ──────────────────────────────────────────────────────────────
function ScholarshipsPage({ profile }) {
  const [liveScholarships, setLiveScholarships] = useState([]);
  const [liveLoading,      setLiveLoading]      = useState(false);
  const [searchLoading,    setSearchLoading]    = useState(false);
  const [lastUpdated,      setLastUpdated]       = useState(null);
  const [typeFilter,       setTypeFilter]        = useState("All");
  const [qualFilter,       setQualFilter]        = useState("All");
  const [search,           setSearch]            = useState("");
  const [searchQuery,      setSearchQuery]        = useState("");
  const [savedIds,         setSavedIds]          = useState([]);
  const [aiSearchResults,  setAiSearchResults]   = useState(null);
  const hasFetched = useRef(false);

  const gpa  = parseFloat(profile.gpa)||0;
  const path = profile.path||"";

  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; fetchLive(); }
  }, []);

  const fetchLive = async () => {
    setLiveLoading(true);
    const pathLabel = path || "general";
    const pathContext = {
      College: "college scholarships, university scholarships, academic merit scholarships",
      "Trade School": "trade school scholarships, vocational scholarships, skilled trades grants",
      Apprenticeship: "apprenticeship grants, union scholarships, trades training funding",
      Workforce: "workforce training grants, career development scholarships, job training funding",
      Military: "ROTC scholarships, military service scholarships, veteran family scholarships",
      Entrepreneurship: "entrepreneurship scholarships, business startup grants, young entrepreneur awards",
    }[path] || "high school student scholarships";

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1500,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: "You are a scholarship search expert. Search the web for real scholarships. For each one, use only the main homepage or official top-level scholarship page URL — never deep links with long paths that might 404. If unsure of the exact URL, link to the organization homepage. Always include a working URL.",
          messages: [{ role: "user", content: `Search the web and find 6 real current scholarships for a ${pathLabel} path student. Focus on: ${pathContext}. GPA: ${gpa||"any"}. List each with name, amount, who qualifies, deadline, and apply link.` }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `API ${res.status}`);
      const text = (data.content||[]).filter((b: any) =>b.type==="text").map((b: any) =>b.text).join("").trim();
      if (text) setSearchText(text);
      setLastUpdated(new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}));
    } catch(err) {
      console.error("Scholarship fetch error:", err.message);
    }
    setLiveLoading(false);
  };

  const [searchText, setSearchText] = useState("");

  const runAiSearch = async () => {
    if (!search.trim()) { setAiSearchResults(null); setSearchQuery(""); setSearchText(""); return; }
    setSearchQuery(search);
    setSearchLoading(true);
    setAiSearchResults(null);
    setSearchText("");

    // Expand short search terms into specific scholarship queries
    const termMap = {
      asian:            "Asian American scholarships APIA JACL KASF OCA",
      "asian american": "Asian American scholarships APIA JACL KASF OCA",
      aapi:             "AAPI Asian American Pacific Islander scholarships",
      black:            "Black African American scholarships UNCF NAACP United Negro College Fund",
      "african american":"African American scholarships UNCF NAACP Thurgood Marshall",
      hispanic:         "Hispanic Latino scholarships HSF Hispanic Scholarship Fund",
      latino:           "Latino Hispanic scholarships Hispanic Heritage Foundation HSF",
      latina:           "Latina Hispanic scholarships Hispanic Heritage Foundation",
      native:           "Native American Indigenous scholarships American Indian College Fund",
      "native american":"Native American Indigenous scholarships American Indian College Fund",
      "first gen":      "first generation college student scholarships QuestBridge",
      "first generation":"first generation college student scholarships",
      "no essay":       "no essay required scholarships high school students",
      stem:             "STEM scholarships science technology engineering math students",
      nursing:          "nursing healthcare scholarships pre-med students",
      military:         "military ROTC veteran family scholarships",
      lgbtq:            "LGBTQ scholarships gay lesbian transgender students",
      women:            "women girls scholarships female students",
      "community service":"community service volunteer scholarships",
    };
    const key = search.trim().toLowerCase();
    const expandedQuery = termMap[key] || `${search} scholarships high school students`;

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1500,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: "You are a scholarship search expert. Use the web_search tool to find REAL current scholarships. Always search and return specific named scholarships with real organizations and working URLs.",
          messages: [{ role: "user", content: `Search the web for: "${expandedQuery}"

Find 5-8 REAL specific scholarships. For each one list:
**[Full Scholarship Name]** — $Amount
Organization: [exact org name]
Who qualifies: [one specific sentence]
Deadline: [deadline or Rolling]
Apply: [working URL to the scholarship page]

Be specific — use real scholarship names like "APIA Scholars Program", "JACL National Scholarship", "Gates Scholarship", etc. not generic descriptions.` }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `API error ${res.status}`);
      const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
      if (text) setSearchText(text);
      setAiSearchResults([]);
    } catch(err) {
      console.error("Search error:", err.message);
      setSearchText("Search failed. Check your API key and try again.");
      setAiSearchResults([]);
    }
    setSearchLoading(false);
  };


  const clearSearch = () => { setSearch(""); setSearchQuery(""); setAiSearchResults(null); setSearchText(""); };

  const QUAL_FILTERS = [
    { id:"All",         label:"All" },
    { id:"qualify-gpa", label:`My GPA (${gpa||"?"})`, check: s => !s.gpa_min || !gpa || gpa >= (s.gpa_min||s.gpa||0) },
    { id:"no-gpa",      label:"No GPA req",            check: s => !s.gpa_min && !s.gpa },
    { id:"no-essay",    label:"No essay",              check: s => s.tags?.includes("no-essay")||s.requirements?.toLowerCase().includes("no essay") },
    { id:"first-gen",   label:"First gen",             check: s => s.tags?.includes("first-gen")||s.desc?.toLowerCase().includes("first gen")||s.requirements?.toLowerCase().includes("first gen") },
    { id:"need-based",  label:"Need-based",            check: s => s.type==="Need-Based"||s.tags?.includes("need-based") },
    { id:"my-path",     label:`${path||"My"} path`,   check: s => !path||!s.path?.length||s.path.includes(path) },
    { id:"rolling",     label:"Rolling",               check: s => s.deadline?.toLowerCase().includes("rolling") },
    { id:"saved",       label:`Saved (${savedIds.length})`, check: s => savedIds.includes(s.id) },
  ];

  const allScholarships = [
    ...SCHOLARSHIPS.map((s: any) =>({...s, new:false, fit:calcFit(s,profile), tags:s.tags||[]})),
    ...liveScholarships.map((s: any, i: number) =>({...s, id:`live-${i}`, fit:calcFit(s,profile)})),
  ];
  const types = ["All",...new Set(allScholarships.map((s: any) =>s.type).filter(Boolean))];

  const displayList = aiSearchResults
    ? aiSearchResults.map((s: any, i: number) =>({...s, id:`search-${i}`, fit:calcFit(s,profile)||s.fit||75}))
    : allScholarships.filter(s => {
        if (typeFilter!=="All"&&s.type!==typeFilter) return false;
        if (qualFilter!=="All") { const qf=QUAL_FILTERS.find((f: any) =>f.id===qualFilter); if(qf?.check&&!qf.check(s)) return false; }
        return true;
      }).sort((a,b)=>b.fit-a.fit);

  const toggleSave = (id) => setSavedIds(ids=>ids.includes(id)?ids.filter((x: any) =>x!==id):[...ids,id]);

  const ScholarCard = ({s}) => {
    const saved = savedIds.includes(s.id);
    return (
      <Card style={{ position:"relative", borderLeft:s.new?"3px solid #059669":"3px solid #E2E8F0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
          <div style={{ flex:1, paddingRight:8 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>{s.name}</div>
            {s.org&&<div style={{ fontSize:11, color:"#6B7280", marginTop:1 }}>{s.org}</div>}
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
            {s.new&&<span style={{ fontSize:10, fontWeight:700, color:"#065F46", background:"#D1FAE5", padding:"2px 7px", borderRadius:10 }}>LIVE</span>}
            <Badge bg={s.fit>=88?"#D1FAE5":"#FEF3C7"} color={s.fit>=88?"#065F46":"#92400E"}>{s.fit||75}% match</Badge>
          </div>
        </div>
        {s.whyMatch&&(
          <div style={{ fontSize:12, color:"#1A56DB", background:"#EFF6FF", borderRadius:6, padding:"5px 10px", marginBottom:8, fontStyle:"italic" }}>
            ✓ {s.whyMatch}
          </div>
        )}
        <div style={{ display:"flex", gap:6, marginBottom:8, flexWrap:"wrap" }}>
          <span style={{ fontSize:13, fontWeight:700, color:"#1A56DB" }}>{s.amount}</span>
          <Badge bg="#F1F5F9" color="#475569">{s.type}</Badge>
          <Badge bg="#FEF9C3" color="#854D0E">📅 {s.deadline}</Badge>
          {(s.gpa_min>0||s.gpa>0)&&<Badge bg="#EFF6FF" color="#1E40AF">GPA {s.gpa_min||s.gpa}+</Badge>}
          {s.tags?.includes("first-gen")&&<Badge bg="#F3E8FF" color="#6B21A8">First Gen</Badge>}
          {s.tags?.includes("no-essay")&&<Badge bg="#DCFCE7" color="#166534">No Essay</Badge>}
          {s.tags?.includes("need-based")&&<Badge bg="#FEF3C7" color="#92400E">Need-Based</Badge>}
        </div>
        <div style={{ fontSize:13, color:"#475569", lineHeight:1.55, marginBottom:6 }}>{s.desc}</div>
        {s.requirements&&<div style={{ fontSize:12, color:"#6B7280", marginBottom:10 }}>Requires: {s.requirements}</div>}
        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
          {s.link&&s.link!=="https://..."&&(
            <a href={s.link} target="_blank" rel="noreferrer"
              style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:"#1A56DB", textDecoration:"none", border:"1px solid #BFDBFE", borderRadius:6, padding:"6px 14px", background:"#EFF6FF" }}>
              Apply / Learn more ↗
            </a>
          )}
          <button onClick={()=>toggleSave(s.id)}
            style={{ fontSize:12, padding:"6px 12px", border:"1px solid #E2E8F0", borderRadius:6, background:saved?"#FEF9C3":"#fff", color:saved?"#854D0E":"#64748B", cursor:"pointer", fontWeight:500 }}>
            {saved?"★ Saved":"☆ Save"}
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div style={{ maxWidth:900 }}>
      <PageHeader title="Scholarships" subtitle="Find funding for your path — live web search for real scholarships." />
      <Card style={{ padding:"16px 20px" }}>
        <div style={{ fontSize:13, fontWeight:600, color:"#0F172A", marginBottom:10 }}>
          🔍 Search scholarships — try "first gen", "no essay", "Hispanic", "STEM", "military", "nursing"…
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") runAiSearch(); }}
            placeholder="Search by trait, background, field, or requirement…"
            style={{ ...S.input, flex:1 }} />
          <button onClick={runAiSearch} disabled={searchLoading||!search.trim()} style={{ ...S.prim, flexShrink:0, fontSize:12, padding:"8px 14px" }}>
            {searchLoading?<><Spinner/>Searching…</>:"Search"}
          </button>
          {aiSearchResults&&<button onClick={clearSearch} style={{ ...S.sec, flexShrink:0, fontSize:12, padding:"8px 12px" }}>✕ Clear</button>}
        </div>

        {aiSearchResults&&(
          <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"8px 12px", marginBottom:8, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ fontSize:12, color:"#1A56DB" }}><strong>AI results for "{searchQuery}"</strong> — {aiSearchResults.length} found</div>
            <button onClick={clearSearch} style={{ fontSize:11, color:"#6B7280", background:"none", border:"none", cursor:"pointer" }}>Browse all →</button>
          </div>
        )}

        {!aiSearchResults&&(
          <>
            <div style={{ fontSize:11, fontWeight:600, color:"#6B7280", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>What you qualify for</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
              {QUAL_FILTERS.map((f: any) =>(
                <button key={f.id} onClick={()=>setQualFilter(f.id)}
                  style={{ fontSize:11, padding:"4px 10px", borderRadius:20, border:`1px solid ${qualFilter===f.id?"#1A56DB":"#E2E8F0"}`, background:qualFilter===f.id?"#1A56DB":"#fff", color:qualFilter===f.id?"#fff":"#475569", cursor:"pointer", fontWeight:qualFilter===f.id?700:400 }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, fontWeight:600, color:"#6B7280", marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em" }}>Scholarship type</div>
            <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:8 }}>
              {types.map((t: any) =>(
                <button key={t} onClick={()=>setTypeFilter(t)}
                  style={{ ...S.chip, background:typeFilter===t?"#0F172A":"#F8FAFC", color:typeFilter===t?"#fff":"#1A56DB", fontWeight:typeFilter===t?700:500, fontSize:11 }}>
                  {t}
                </button>
              ))}
            </div>
          </>
        )}

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontSize:12, color:"#6B7280" }}>
            {aiSearchResults
              ? `${aiSearchResults.length} AI matches for "${searchQuery}"`
              : <>{path?`${path} path`:"All paths"}{gpa?` · GPA ${gpa}`:""}
                  {" · "}<strong style={{ color:"#0F172A" }}>{displayList.length} scholarships</strong>
                  {liveScholarships.length>0&&<span style={{ color:"#059669" }}>{" · "}{liveScholarships.length} live</span>}</>
            }
          </div>
          {!aiSearchResults&&<button onClick={fetchLive} disabled={liveLoading} style={{ ...S.sec, fontSize:11, padding:"4px 10px" }}>{liveLoading?<><Spinner/>…</>:"⟳ Refresh"}</button>}
          {lastUpdated&&<div style={{ fontSize:11, color:"#6B7280" }}>Updated {lastUpdated}</div>}
        </div>
      </Card>

      {(liveLoading||searchLoading)&&(
        <Card style={{ textAlign:"center", padding:20 }}>
          <Spinner/>
          <span style={{ fontSize:13, color:"#6B7280" }}>{searchLoading?` Searching for "${search}"…`:" Finding scholarships for your profile…"}</span>
        </Card>
      )}

      {displayList.length===0&&!liveLoading&&!searchLoading&&!searchText&&!aiSearchResults?.length&&(
        <Card style={{ textAlign:"center", padding:32 }}>
          <div style={{ fontSize:28, marginBottom:8 }}>🔍</div>
          <div style={{ fontSize:14, color:"#374151", marginBottom:6 }}>
            {aiSearchResults!=null ? `No results for "${searchQuery}".` : "No scholarships match your filters."}
          </div>
          {aiSearchResults!=null&&(
            <button onClick={clearSearch} style={{ ...S.sec, fontSize:12 }}>← Browse all scholarships</button>
          )}
        </Card>
      )}

      {/* Search results as clean cards */}
      {aiSearchResults?.length>0&&(
        <div>
          <div style={{ fontSize:12, color:"#6B7280", margin:"4px 0 8px", paddingLeft:2 }}>
            {aiSearchResults.length} scholarships found for "<strong>{searchQuery}</strong>" — powered by live web search
          </div>
          {aiSearchResults.map((s: any, i: number) =>(
            <Card key={i} style={{ borderLeft:"3px solid #1A56DB" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6 }}>
                <div style={{ flex:1, paddingRight:8 }}>
                  <div style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>{s.name}</div>
                  {s.org&&<div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>{s.org}</div>}
                </div>
                {s.amount&&(
                  <div style={{ fontSize:15, fontWeight:800, color:"#1A56DB", whiteSpace:"nowrap" }}>{s.amount}</div>
                )}
              </div>
              {s.desc&&(
                <div style={{ fontSize:13, color:"#475569", lineHeight:1.55, marginBottom:8 }}>{s.desc}</div>
              )}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                {s.deadline&&(
                  <span style={{ fontSize:12, color:"#92400E", background:"#FEF3C7", borderRadius:20, padding:"3px 10px", fontWeight:500 }}>
                    📅 {s.deadline}
                  </span>
                )}
                {s.link&&s.link.startsWith("http")&&(
                  <a href={s.link} target="_blank" rel="noreferrer"
                    style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:700, color:"#fff", background:"#1A56DB", textDecoration:"none", borderRadius:6, padding:"6px 14px" }}>
                    Apply / Learn more ↗
                  </a>
                )}
              </div>
            </Card>
          ))}
          <div style={{ textAlign:"center", padding:"8px 0 4px" }}>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(searchQuery+" scholarship 2025")}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize:12, color:"#1A56DB", textDecoration:"none", fontWeight:600 }}>
              🔎 Find more "{searchQuery}" scholarships on Google ↗
            </a>
          </div>
        </div>
      )}

      {/* Search results — render with clickable links */}
      {searchText&&!liveLoading&&!searchLoading&&(
        <Card>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#0F172A" }}>
              🌐 {searchQuery ? `Results for "${searchQuery}"` : `${path||"General"} scholarships — live results`}
            </div>
            {searchQuery&&<button onClick={clearSearch} style={{ ...S.sec, fontSize:12, padding:"4px 10px" }}>← Back</button>}
          </div>
          <div style={{ fontSize:13, color:"#374151", lineHeight:1.9 }}>
            {searchText.split("\n").map((line, i) => {
              const urlRegex = /(https?:\/\/[^\s]+)/g;
              const parts = line.split(urlRegex);
              return (
                <div key={i} style={{ marginBottom: line.trim() === "" ? 10 : 2 }}>
                  {parts.map((part, j) => {
                    if (urlRegex.test(part)) {
                      const url = part.replace(/[.,;!?)]+$/, "");
                      // Extract scholarship name from nearby bold text for Google fallback
                      const scholarshipName = line.replace(/\*\*/g,"").replace(urlRegex,"").replace(/Apply:|Link:|URL:/gi,"").trim().slice(0,60);
                      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(scholarshipName+" scholarship apply")}`;
                      return (
                        <span key={j} style={{ display:"inline-flex", gap:6, flexWrap:"wrap" }}>
                          <a href={url} target="_blank" rel="noreferrer"
                            style={{ color:"#fff", fontWeight:700, textDecoration:"none", background:"#1A56DB", padding:"3px 10px", borderRadius:5, fontSize:12 }}>
                            Apply ↗
                          </a>
                          <a href={googleUrl} target="_blank" rel="noreferrer"
                            style={{ color:"#1A56DB", fontWeight:600, textDecoration:"none", background:"#EFF6FF", padding:"3px 10px", borderRadius:5, fontSize:12, border:"1px solid #BFDBFE" }}>
                            🔎 Search Google
                          </a>
                        </span>
                      );
                    }
                    const boldParts = part.split(/\*\*(.*?)\*\*/g);
                    return boldParts.map((bp, k) =>
                      k % 2 === 1
                        ? <strong key={k} style={{ color:"#0F172A", fontSize:14 }}>{bp}</strong>
                        : <span key={k}>{bp}</span>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop:14, paddingTop:12, borderTop:"1px solid #E2E8F0" }}>
            <a href={`https://www.google.com/search?q=${encodeURIComponent((searchQuery||path||"high school")+" scholarship 2025")}`}
              target="_blank" rel="noreferrer"
              style={{ fontSize:12, color:"#1A56DB", textDecoration:"none", fontWeight:600 }}>
              🔎 Find more on Google ↗
            </a>
          </div>
        </Card>
      )}

      {!searchText&&!aiSearchResults?.length&&displayList.map((s: any, i: number) =><ScholarCard key={s.id||i} s={s}/>)}

      {!aiSearchResults&&(
        <div style={{ textAlign:"center", padding:"8px 0 16px" }}>
          <button onClick={fetchLive} disabled={liveLoading} style={{ ...S.sec, fontSize:13 }}>
            {liveLoading?<><Spinner/>Searching…</>:"⟳ Find more scholarships"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── GOALS ─────────────────────────────────────────────────────────────────────
function GoalsPage({ profile, goals, setGoals }) {
  const [adding,  setAdding]  = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const pathObj = PATHS.find((p: any) =>p.id===profile.path);

  const createGoal = async () => {
    if (!newGoal.trim()) return;
    setLoading(true);
    const prompt = `Create a realistic, path-specific student goal roadmap.

Goal: "${newGoal}"
Student path: ${profile.path||"undecided"}
GPA: ${profile.gpa||"unknown"}

Make every step SPECIFIC to the "${profile.path||"general"}" path. Include concrete actions like researching specific schools/programs, preparing for relevant exams (SAT/ASVAB/trade certs), reaching out to counselors, applying to specific opportunities, etc.

Return ONLY JSON (no markdown):
{
  "title": "concise goal title under 8 words",
  "emoji": "single relevant emoji",
  "steps": [
    {"text":"very specific concrete step relevant to the path","horizon":"week","done":false},
    {"text":"specific step 2","horizon":"week","done":false},
    {"text":"specific step","horizon":"month","done":false},
    {"text":"specific step","horizon":"month","done":false},
    {"text":"specific step","horizon":"month","done":false},
    {"text":"specific step","horizon":"year","done":false},
    {"text":"specific step","horizon":"year","done":false}
  ],
  "skills": ["relevant skill 1","skill 2","skill 3"],
  "tip": "one specific, honest, encouraging sentence relevant to the ${profile.path||"chosen"} path"
}`;
    try {
      const raw    = await callClaude([{role:"user",content:prompt}],"Return ONLY valid JSON with no markdown, no explanation, no backticks.",900);
      const parsed = parseJSON(raw);
      if (!parsed.steps || parsed.steps.length === 0) throw new Error("No steps returned");
      setGoals(g=>[...g,{...parsed,id:Date.now(),progress:0}]);
    } catch(err) {
      console.error("Goal generation error:", err.message);
      setGoals(g=>[...g,{
        id:Date.now(), title:newGoal, emoji:"⚠️", progress:0,
        tip:`Error: ${err.message}`,
        steps:[{text:`Failed: ${err.message} — check you have billing credit at console.anthropic.com/settings/billing`, horizon:"week", done:false}],
        skills:[]
      }]);
    }
    setNewGoal(""); setAdding(false); setLoading(false);
  };

  const toggleStep = (goalId, stepIdx) => {
    setGoals(gs=>gs.map((g: any) =>{
      if (g.id!==goalId) return g;
      const steps    = g.steps.map((s: any, i: number) =>i===stepIdx?{...s,done:!s.done}:s);
      const progress = Math.round((steps.filter((s: any) =>s.done).length/steps.length)*100);
      return {...g,steps,progress};
    }));
  };

  return (
    <div style={{ maxWidth:900 }}>
      <PageHeader title="Your Goal Tracker" subtitle="Set goals and generate AI-powered roadmaps to achieve them." />
      <div style={{ display:"grid", gridTemplateColumns:"1fr 280px", gap:16, alignItems:"start" }}>
        <div>
          <Card>
            <div style={{ display:"flex", gap:10 }}>
              <input value={newGoal} onChange={e=>setNewGoal(e.target.value)}
                onKeyDown={e=>{ if(e.key==="Enter"&&newGoal.trim()) createGoal(); }}
                placeholder="What do you want to achieve?"
                style={{ ...S.input, flex:1 }} />
              <button onClick={()=>{ if(newGoal.trim()) createGoal(); }}
                disabled={loading} style={{ ...S.prim, flexShrink:0 }}>
                {loading?<><Spinner/>Building…</>:"Add"}
              </button>
            </div>
            {pathObj&&(
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Suggested for your path</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {pathObj.goalTemplates.slice(0,4).map((t: any,i: number)=>(
                    <button key={i} onClick={()=>setNewGoal(t)}
                      style={{ fontSize:12, padding:"5px 12px", border:"1.5px solid #DBEAFE", borderRadius:20, background:"#EFF6FF", color:"#1A56DB", cursor:"pointer", fontWeight:600 }}>
                      + {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
          {goals.length===0&&!loading&&(
            <div style={{ textAlign:"center", padding:"32px 20px", color:"#9CA3AF" }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🎯</div>
              <div style={{ fontSize:14 }}>Add your first goal above to get an AI roadmap.</div>
            </div>
          )}
          {goals.map((g: any) =>(
            <Card key={g.id}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                <div style={{ fontSize:15, fontWeight:700, color:"#0F172A" }}>{g.emoji} {g.title}</div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ fontSize:18, fontWeight:800, color:g.progress===100?"#059669":"#1A56DB" }}>{g.progress}%</div>
                  <button onClick={()=>setGoals(gs=>gs.filter((x: any) =>x.id!==g.id))} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:18, lineHeight:1 }}>×</button>
                </div>
              </div>
              <ProgressBar pct={g.progress} color={g.progress===100?"#059669":"#1A56DB"} />
              {g.tip&&<div style={{ fontSize:12, color:"#6B7280", fontStyle:"italic", margin:"8px 0 12px" }}>{g.tip}</div>}
              {["week","month","year"].map((horizon: any) =>{
                const hs = g.steps?.filter((s: any) =>s.horizon===horizon);
                if (!hs?.length) return null;
                return (
                  <div key={horizon} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:horizon==="week"?"#065F46":horizon==="month"?"#92400E":"#1E40AF", marginBottom:6, textTransform:"uppercase", letterSpacing:"0.07em" }}>
                      {horizon==="week"?"⚡ This week":horizon==="month"?"📅 This month":"🏆 This year"}
                    </div>
                    {hs.map((s: any, i: number) =>{
                      const idx = g.steps.indexOf(s);
                      return (
                        <div key={i} onClick={()=>toggleStep(g.id,idx)}
                          style={{ display:"flex", gap:10, alignItems:"flex-start", cursor:"pointer", padding:"7px 0", borderBottom:"1px solid #F9FAFB" }}>
                          <div style={{ width:18, height:18, borderRadius:"50%", border:`2px solid ${s.done?"#1A56DB":"#D1D5DB"}`, background:s.done?"#1A56DB":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                            {s.done&&<span style={{ color:"#fff", fontSize:10 }}>✓</span>}
                          </div>
                          <div style={{ fontSize:14, color:s.done?"#9CA3AF":"#374151", textDecoration:s.done?"line-through":"none", lineHeight:1.45 }}>{s.text}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </Card>
          ))}
        </div>
        <div style={{ background:"#0F172A", borderRadius:16, padding:24, color:"#fff", position:"sticky", top:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
            <span style={{ fontSize:18 }}>⚡</span>
            <span style={{ fontSize:14, fontWeight:700, color:"#F1F5F9" }}>Path Progress</span>
          </div>
          <div style={{ fontSize:42, fontWeight:900, color:"#fff", letterSpacing:"-1px", lineHeight:1 }}>
            {goals.length===0?0:Math.round(goals.filter((g: any) =>g.progress===100).length/goals.length*100)}%
          </div>
          <div style={{ fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", marginTop:4, marginBottom:20 }}>Goals completed</div>
          <div style={{ height:3, background:"rgba(255,255,255,0.1)", borderRadius:3, overflow:"hidden", marginBottom:16 }}>
            <div style={{ height:"100%", width:`${goals.length===0?0:Math.round(goals.filter((g: any) =>g.progress===100).length/goals.length*100)}%`, background:"#3B82F6", borderRadius:3 }}/>
          </div>
          <div style={{ fontSize:13, color:"#475569" }}>
            {goals.length===0?"Add your first goal to get started.":`${goals.filter((g: any) =>g.progress===100).length} of ${goals.length} goal${goals.length!==1?"s":""} complete`}
          </div>
          {profile.path&&(
            <div style={{ marginTop:20, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#475569", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:8 }}>Current path</div>
              <div style={{ fontSize:14, fontWeight:600, color:"#93C5FD" }}>{PATHS.find((p: any) =>p.id===profile.path)?.icon} {profile.path}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── SCHOOL / PROGRAM RESEARCH ─────────────────────────────────────────────────
function ResearchPage({ profile, setProfile }) {
  const [query,      setQuery]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [result,     setResult]     = useState(null);
  const [history,    setHistory]    = useState(profile.searchHistory||[]);
  const [autoSearch, setAutoSearch] = useState(null);
  const [view,       setView]       = useState("search"); // "search" | "history"
  const pathObj = PATHS.find((p: any) =>p.id===profile.path);

  useEffect(() => {
    if (autoSearch) { setAutoSearch(null); research(autoSearch); }
  }, [autoSearch]);

  const research = async (overrideQuery) => {
    const q = (overrideQuery || query).trim();
    if (!q) return;
    setLoading(true); setResult(null); setView("search");
    const promptFn = pathObj?.researchPrompt || PATHS[0].researchPrompt;
    try {
      const raw    = await callClaude([{role:"user",content:promptFn(q)}],"",1200);
      const parsed = parseJSON(raw);
      if (!parsed.name) parsed.name = q;
      setResult(parsed);
      // Auto-save every successful search to history
      const entry = { ...parsed, searchedAt: new Date().toLocaleDateString(), pathLabel: profile.path, query: q };
      const updated = [entry, ...(profile.searchHistory||[]).filter((h: any) =>h.query!==q)].slice(0,20);
      setHistory(updated);
      setProfile(p=>({...p, searchHistory:updated, researched:updated}));
    } catch(err) {
      setResult({ name:q, _error:true, tips:[`Error: ${err.message}. Try again or check your API key.`], official_url:null, apply_url:null });
    }
    setLoading(false);
  };

  // Click a history item — reload all its data without making a new API call
  const loadFromHistory = (entry) => {
    setResult(entry);
    setQuery(entry.query || entry.name);
    setView("search");
    window.scrollTo(0,0);
  };

  const deleteHistory = (q) => {
    const updated = history.filter((h: any) =>h.query!==q);
    setHistory(updated);
    setProfile(p=>({...p, searchHistory:updated, researched:updated}));
  };

  const DISPLAY_FIELDS = {
    location:"📍 Location", acceptance_rate:"Acceptance rate", avg_gpa:"Avg. GPA",
    avg_sat:"Avg. SAT", avg_act:"Avg. ACT",
    application_deadline:"App. deadline", tuition:"Tuition", financial_aid:"Financial aid",
    notable_facts:"About this school",
    top_programs:"Top programs", programs:"Programs", program_length:"Program length",
    certifications_offered:"Certifications", job_placement_rate:"Job placement",
    admission_requirements:"Requirements", trade:"Trade", duration:"Duration",
    wage_while_training:"Pay while training", certifications_earned:"Certs earned",
    eligibility:"Eligibility", sponsoring_union_or_employer:"Sponsor",
    industry:"Industry", entry_level_roles:"Entry-level roles",
    avg_starting_salary:"Starting salary", certifications_valued:"Valued certs",
    career_growth:"Career growth", enlistment_requirements:"Enlist req.",
    officer_requirements:"Officer req.", asvab_min_score:"Min ASVAB",
    benefits:"Benefits", service_commitment:"Commitment", top_career_fields:"Career fields",
    type:"Type", focus:"Focus", cost:"Cost", notable_alumni_or_companies:"Alumni",
    application_process:"How to apply", branch:"Branch",
  };

  const placeholders = {
    College:"e.g. Howard University, UT Austin, UCLA, Harvard",
    "Trade School":"e.g. Lincoln Tech, UTI, local welding school",
    Apprenticeship:"e.g. IBEW electrician, UA plumbers union",
    Workforce:"e.g. Amazon, local hospital, Salesforce",
    Military:"e.g. US Army, US Navy, US Air Force, West Point",
    Entrepreneurship:"e.g. NFTE, YC Startup School, DECA",
  };

  const ResultCard = ({ data }) => (
    <Card style={{ borderLeft:"3px solid #1A56DB" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:"#1F2937" }}>{data.name}</div>
          {data.location&&<div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>📍 {data.location}</div>}
        </div>
        <Badge bg="#D1FAE5" color="#065F46">{data.pathLabel||profile.path||"General"}</Badge>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(155px,1fr))", gap:8, marginBottom:14 }}>
        {Object.entries(DISPLAY_FIELDS).map(([key,label])=>{
          const val = data[key];
          if (!val||key==="location") return null;
          const display = Array.isArray(val)?val.join(", "):val;
          return (
            <div key={key} style={{ background:"#F9FAFB", borderRadius:8, padding:"8px 10px" }}>
              <div style={{ fontSize:11, color:"#9CA3AF", marginBottom:2 }}>{label}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#374151" }}>{display}</div>
            </div>
          );
        })}
      </div>

      {data.tips?.length>0&&!data._error&&(
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#1A56DB", marginBottom:8 }}>✨ AI tips to boost your chances</div>
          {data.tips.map((t: any,i: number)=>(
            <div key={i} style={{ display:"flex", gap:10, padding:"6px 0", borderBottom:i<data.tips.length-1?"1px solid #F3F4F6":"none" }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:"#1A56DB", marginTop:5, flexShrink:0 }} />
              <div style={{ fontSize:13, color:"#374151", lineHeight:1.5 }}>{t}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {data.official_url&&data.official_url!=="https://..."&&(
          <a href={data.official_url} target="_blank" rel="noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:"#1A56DB", textDecoration:"none", border:"1px solid #BFDBFE", borderRadius:6, padding:"5px 12px", background:"#EFF6FF" }}>
            Official site ↗
          </a>
        )}
        {data.apply_url&&data.apply_url!=="https://..."&&(
          <a href={data.apply_url} target="_blank" rel="noreferrer"
            style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12, fontWeight:600, color:"#fff", textDecoration:"none", borderRadius:6, padding:"5px 12px", background:"#1A56DB", border:"none" }}>
            Apply now ↗
          </a>
        )}
        {data.searchedAt&&<div style={{ fontSize:11, color:"#9CA3AF", alignSelf:"center" }}>Searched {data.searchedAt}</div>}
      </div>
    </Card>
  );

  return (
    <div style={{ maxWidth:900 }}>
      <PageHeader title="School Research" subtitle="Research any school, program, or opportunity and get AI insights." />
      {/* Search bar + history toggle */}
      <Card>
        <SectionTitle>🔍 Research {profile.path||"schools"} &amp; programs</SectionTitle>
        <div style={{ fontSize:13, color:"#6B7280", marginBottom:12 }}>
          {pathObj?`Search any ${pathObj.id} school, program, or branch. Results are saved automatically — find them in Search History.`:"Choose your path first to get tailored research."}
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <input value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&research()}
            placeholder={placeholders[profile.path]||"Enter a school, program, branch, or employer"}
            style={{ ...S.input, flex:1 }} />
          <button onClick={()=>research()} disabled={loading} style={S.prim}>
            {loading?<><Spinner/>Researching…</>:"Research"}
          </button>
        </div>

        {/* Quick search chips */}
        {pathObj&&(
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
            {pathObj.quickSearches.map((s: any) =>(
              <button key={s} onClick={()=>{ setQuery(s); setAutoSearch(s); }} style={S.chip}>{s}</button>
            ))}
          </div>
        )}

        {/* History toggle */}
        {history.length>0&&(
          <div style={{ display:"flex", gap:8, borderTop:"1px solid #F3F4F6", paddingTop:10 }}>
            <button onClick={()=>setView(v=>v==="history"?"search":"history")}
              style={{ ...S.sec, fontSize:12 }}>
              {view==="history"?"← Back to search":`🕐 Search history (${history.length})`}
            </button>
          </div>
        )}
      </Card>

      {/* Loading */}
      {loading&&<Card style={{ textAlign:"center", padding:28 }}><Spinner/><span style={{ fontSize:14, color:"#6B7280" }}> Researching {query}…</span></Card>}

      {/* Current result */}
      {result&&!loading&&view==="search"&&<ResultCard data={result}/>}

      {/* Search history — full data, click to reload */}
      {view==="history"&&(
        <Card>
          <SectionTitle>🕐 Search history ({history.length})</SectionTitle>
          <div style={{ fontSize:12, color:"#6B7280", marginBottom:12 }}>Click any search to reload the full results without searching again.</div>
          {history.map((h: any,i: number)=>(
            <div key={i} style={{ borderBottom:i<history.length-1?"1px solid #F3F4F6":"none", padding:"10px 0" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#1F2937" }}>{h.name}</div>
                  <div style={{ fontSize:11, color:"#9CA3AF" }}>
                    {h.pathLabel} · Searched {h.searchedAt}
                    {h.acceptance_rate&&` · ${h.acceptance_rate} acceptance`}
                    {h.avg_gpa&&` · GPA ${h.avg_gpa}`}
                  </div>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>loadFromHistory(h)}
                    style={{ fontSize:12, padding:"4px 10px", border:"1px solid #BFDBFE", borderRadius:6, background:"#EFF6FF", color:"#1A56DB", cursor:"pointer", fontWeight:600 }}>
                    View ↗
                  </button>
                  <button onClick={()=>deleteHistory(h.query||h.name)}
                    style={{ fontSize:12, padding:"4px 8px", border:"1px solid #E2E8F0", borderRadius:6, background:"#fff", color:"#9CA3AF", cursor:"pointer" }}>
                    ✕
                  </button>
                </div>
              </div>
              {/* Mini preview of key data */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {h.acceptance_rate&&<Badge bg="#EFF6FF" color="#1E40AF">{h.acceptance_rate} acceptance</Badge>}
                {h.tuition&&<Badge bg="#F3F4F6" color="#374151">{h.tuition.split("(")[0].trim()}</Badge>}
                {h.avg_gpa&&<Badge bg="#D1FAE5" color="#065F46">GPA {h.avg_gpa}</Badge>}
                {h.job_placement_rate&&<Badge bg="#D1FAE5" color="#065F46">{h.job_placement_rate} placement</Badge>}
                {h.asvab_min_score&&<Badge bg="#FEF3C7" color="#92400E">ASVAB {h.asvab_min_score}</Badge>}
              </div>
            </div>
          ))}
          {history.length>0&&(
            <button onClick={()=>{ setHistory([]); setProfile(p=>({...p,searchHistory:[],researched:[]})); }}
              style={{ marginTop:12, fontSize:11, color:"#9CA3AF", background:"none", border:"none", cursor:"pointer" }}>
              Clear all history
            </button>
          )}
        </Card>
      )}

      {/* Local Partners / Armed Forces section */}
      <Card style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", marginTop:4 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#1A56DB", marginBottom:4 }}>🤝 Coming soon — Local Opportunities</div>
        <div style={{ fontSize:12, color:"#1A56DB", lineHeight:1.65, marginBottom:10 }}>
          TheWorks is building a verified partner network connecting students directly to local opportunities — no generic job boards, no national listings that don't apply to you.
        </div>
        {[
          { icon:"🎖️", label:"Armed Forces", desc:"Army, Navy, Air Force, Marines, Coast Guard, National Guard — direct recruiter connections, ASVAB prep resources, and ROTC program details for your area." },
          { icon:"🔧", label:"Trade & Union Programs", desc:"IBEW, UA plumbers, carpenters, sheet metal workers — local apprenticeship openings, age requirements, and application windows." },
          { icon:"🏗️", label:"Construction Companies", desc:"Local general contractors and specialty firms offering job shadowing, summer internships, and pre-apprenticeship programs for students 16+." },
          { icon:"🏥", label:"Healthcare & Hospitals", desc:"CNA certification programs, hospital volunteer pipelines, and healthcare internships connecting students to local providers." },
          { icon:"🚒", label:"Public Service", desc:"Fire cadet programs, police explorer posts, and EMS volunteering — local departments recruiting the next generation." },
        ].map((p: any,i: number)=>(
          <div key={i} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:i<4?"1px solid #BFDBFE":"none" }}>
            <div style={{ fontSize:18, flexShrink:0 }}>{p.icon}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:"#1A56DB" }}>{p.label}</div>
              <div style={{ fontSize:12, color:"#3B82F6" }}>{p.desc}</div>
            </div>
          </div>
        ))}
        <div style={{ marginTop:12, fontSize:12, color:"#1A56DB", fontStyle:"italic" }}>
          Are you a local employer, recruiter, or organization? <strong>Contact us to list your opportunity</strong> — student-facing, verified, age-appropriate.
        </div>
      </Card>
    </div>
  );
}

// ── COMPARE PROGRAMS ──────────────────────────────────────────────────────────
function ComparePage({ profile }) {
  const [items,   setItems]   = useState(["", "", ""]);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState("");

  const updateItem = (i, v) => { const n=[...items]; n[i]=v; setItems(n); };

  const QUICK_PAIRS = [
    { label:"College vs Trade School",        values:["University of Texas Austin", "Lincoln Tech HVAC", ""] },
    { label:"Army vs Navy",                   values:["US Army enlisted", "US Navy enlisted", ""] },
    { label:"College vs Apprenticeship",      values:["Community College 2-year", "IBEW Electrician Apprenticeship", ""] },
    { label:"Trade School vs Workforce",      values:["UTI Automotive Technology", "Toyota entry-level technician", ""] },
    { label:"College / Trade / Military",     values:["UCLA", "Tulsa Welding School", "US Air Force"] },
    { label:"Entrepreneur programs",          values:["NFTE Youth Program", "YC Startup School", "DECA"] },
    { label:"Military branches",              values:["US Army", "US Navy", "US Marine Corps"] },
    { label:"Apprenticeship programs",        values:["IBEW Electrician", "UA Plumbers Union", "Carpenters Union"] },
  ];

  const compare = async () => {
    const filled = items.filter((x: any) => x.trim());
    if (filled.length < 2) { setError("Enter at least 2 options to compare."); return; }
    setError(""); setLoading(true); setResult(null); setCompareText("");

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 1000,
          system: "You are a student planning expert. Give honest, brief comparisons. Treat all paths equally.",
          messages: [{ role: "user", content: `Compare for a high school student: ${filled.join(" vs ")}. For each: cost, duration, starting salary, requirements, 2 pros, 2 cons. End with a 2-sentence verdict.` }],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `API ${res.status}`);
      const text = (data.content||[]).filter((b: any)=>b.type==="text").map((b: any)=>b.text).join("").trim();
      if (!text) throw new Error("No response returned");
      setCompareText(text);
    } catch(err: any) {
      setError(`Compare failed: ${err.message}. Try again.`);
    }
    setLoading(false);
  };

  const PROS_BG="#D1FAE5", PROS_COLOR="#065F46", CONS_BG="#FEE2E2", CONS_COLOR="#991B1B";
  const TYPE_COLORS = {
    "University":"#1A56DB","College":"#1A56DB","Community College":"#3B82F6",
    "Trade School":"#D97706","Apprenticeship":"#059669",
    "Military":"#DC2626","Workforce":"#7C3AED",
    "Entrepreneurship":"#DB2777","Certification":"#0891B2",
  };

  const placeholders = [
    profile.path==="Military" ? "e.g. US Army enlisted" :
    profile.path==="Trade School" ? "e.g. Lincoln Tech HVAC" :
    profile.path==="Apprenticeship" ? "e.g. IBEW Electrician Apprenticeship" :
    profile.path==="Workforce" ? "e.g. Amazon warehouse program" :
    profile.path==="Entrepreneurship" ? "e.g. NFTE Youth Entrepreneurship" :
    "e.g. University of Texas Austin",
    profile.path==="Military" ? "e.g. US Navy enlisted" :
    profile.path==="Trade School" ? "e.g. UTI Automotive Technology" :
    profile.path==="Apprenticeship" ? "e.g. UA Plumbers Union" :
    "e.g. IBEW Electrician Apprenticeship",
    "e.g. US Air Force (optional third option)",
  ];

  return (
    <div style={{ maxWidth:960 }}>
      <PageHeader title="Compare Programs" subtitle="Make an informed decision with a side-by-side AI breakdown." />

      <Card>
        {/* Inputs row — matches screenshot */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:16 }}>
          {[0,1,2].map((i: any) =>(
            <div key={i}>
              <div style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>
                {i===2?"Option 3 (optional)":`Option ${i+1}`}
              </div>
              {i===2&&!items[2]?(
                <button onClick={()=>updateItem(2," ")}
                  style={{ width:"100%", padding:"11px 14px", border:"1.5px dashed #D1D5DB", borderRadius:10, background:"transparent", color:"#9CA3AF", fontSize:14, cursor:"pointer", textAlign:"center" }}>
                  + Add Option
                </button>
              ):(
                <div style={{ display:"flex", gap:6 }}>
                  <input value={items[i]} onChange={e=>updateItem(i,e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter") compare(); }}
                    placeholder={placeholders[i]}
                    style={{ ...S.input, flex:1 }} />
                  {i===2&&<button onClick={()=>updateItem(2,"")} style={{ background:"none", border:"none", color:"#9CA3AF", cursor:"pointer", fontSize:16, flexShrink:0 }}>×</button>}
                </div>
              )}
            </div>
          ))}
        </div>

        {error&&<div style={{ fontSize:13, color:"#DC2626", marginBottom:12, background:"#FEF2F2", padding:"10px 14px", borderRadius:8, border:"1px solid #FECACA" }}>⚠️ {error}</div>}

        {/* Big generate button — matches screenshot */}
        <button onClick={compare}
          disabled={loading||items.filter((x: any) =>x.trim()).length<2}
          style={{ width:"100%", padding:"15px", background:items.filter((x: any) =>x.trim()).length<2||loading?"#94A3B8":"#374151", color:"#fff", border:"none", borderRadius:10, fontSize:15, fontWeight:700, cursor:items.filter((x: any) =>x.trim()).length<2?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:14 }}>
          {loading?<><Spinner/>Comparing…</>:<>⚖️ Generate Comparison</>}
        </button>

        {/* Quick compare chips — matches screenshot */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
          {QUICK_PAIRS.slice(0,6).map((pair: any, i: number) =>(
            <button key={i} onClick={()=>{ setItems([...pair.values]); setResult(null); setError(""); }}
              style={{ fontSize:12, padding:"6px 14px", border:"1.5px solid #E5E7EB", borderRadius:20, background:"#fff", color:"#374151", cursor:"pointer", fontWeight:500 }}>
              {pair.label}
            </button>
          ))}
        </div>
      </Card>

      {loading&&(
        <Card style={{ textAlign:"center", padding:32 }}>
          <Spinner/>
          <div style={{ fontSize:14, color:"#6B7280", marginTop:8 }}>Researching {items.filter((x: any) =>x.trim()).join(" vs ")}…</div>
          <div style={{ fontSize:12, color:"#6B7280", marginTop:4 }}>Getting real data — about 15 seconds</div>
        </Card>
      )}

      {result&&!loading&&(
        <>
          <Card style={{ background:"#EFF6FF", border:"1px solid #BFDBFE" }}>
            <div style={{ fontSize:13, fontWeight:700, color:"#1A56DB", marginBottom:8 }}>📋 The honest comparison</div>
            <div style={{ fontSize:13, color:"#1A56DB", lineHeight:1.7 }}>{result.verdict}</div>
          </Card>

          <div style={{ display:"grid", gridTemplateColumns:`repeat(${result.programs.length},1fr)`, gap:10 }}>
            {result.programs.map((prog, pi) => (
              <div key={pi} style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:12, overflow:"hidden" }}>
                <div style={{ background:"#0F172A", padding:"14px 16px" }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#fff", marginBottom:4, lineHeight:1.3 }}>{prog.name}</div>
                  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:10, background:TYPE_COLORS[prog.type]||"#374151", color:"#fff" }}>{prog.type}</span>
                </div>
                <div style={{ padding:"14px 16px" }}>
                  <div style={{ fontSize:12, color:"#475569", lineHeight:1.6, marginBottom:12 }}>{prog.overview}</div>
                  {prog.keyStats&&(
                    <div style={{ marginBottom:12 }}>
                      {Object.entries(prog.keyStats).map(([k,v])=>(
                        <div key={k} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #F3F4F6", fontSize:12 }}>
                          <span style={{ color:"#6B7280", fontWeight:600, flexShrink:0, marginRight:8 }}>{k}</span>
                          <span style={{ color:"#374151", textAlign:"right" }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:PROS_COLOR, marginBottom:4, textTransform:"uppercase" }}>✓ Pros</div>
                    {prog.pros?.map((p: any,i: number)=><div key={i} style={{ fontSize:12, color:PROS_COLOR, background:PROS_BG, borderRadius:5, padding:"4px 8px", marginBottom:3, lineHeight:1.4 }}>{p}</div>)}
                  </div>
                  <div style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:CONS_COLOR, marginBottom:4, textTransform:"uppercase" }}>✗ Cons</div>
                    {prog.cons?.map((c: any,i: number)=><div key={i} style={{ fontSize:12, color:CONS_COLOR, background:CONS_BG, borderRadius:5, padding:"4px 8px", marginBottom:3, lineHeight:1.4 }}>{c}</div>)}
                  </div>
                  {prog.bestFor&&<div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:6, padding:"7px 10px", marginBottom:5 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#065F46", marginBottom:2 }}>BEST FOR</div>
                    <div style={{ fontSize:12, color:"#065F46" }}>{prog.bestFor}</div>
                  </div>}
                  {prog.notFor&&<div style={{ background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:6, padding:"7px 10px" }}>
                    <div style={{ fontSize:10, fontWeight:700, color:"#92400E", marginBottom:2 }}>NOT IDEAL IF</div>
                    <div style={{ fontSize:12, color:"#92400E" }}>{prog.notFor}</div>
                  </div>}
                </div>
              </div>
            ))}
          </div>

          {result.questions?.length>0&&(
            <Card>
              <SectionTitle>❓ Questions to ask yourself before deciding</SectionTitle>
              {result.questions.map((q: any,i: number)=>(
                <div key={i} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:i<result.questions.length-1?"1px solid #F3F4F6":"none" }}>
                  <div style={{ width:22, height:22, borderRadius:"50%", background:"#EFF6FF", color:"#1A56DB", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{i+1}</div>
                  <div style={{ fontSize:13, color:"#374151", lineHeight:1.5 }}>{q}</div>
                </div>
              ))}
            </Card>
          )}
          <div style={{ textAlign:"center", padding:"4px 0 16px" }}>
            <button onClick={()=>{ setResult(null); setItems(["","",""]); setError(""); }} style={S.sec}>⚖️ Compare something else</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── APPLICATIONS TRACKER ─────────────────────────────────────────────────────
const PATH_PORTALS = {
  College: [
    { name:"Common App",   url:"https://www.commonapp.org",           desc:"Apply to 1,000+ colleges in one application",        icon:"🎓" },
    { name:"Coalition App",url:"https://www.mycoalition.org", desc:"Alternative to Common App, accepted by 150+ schools", icon:"🏛️" },
    { name:"FAFSA",        url:"https://studentaid.gov/apply-for-aid/fafsa/", desc:"Required for all federal financial aid",        icon:"💰" },
    { name:"CSS Profile",  url:"https://cssprofile.collegeboard.org", desc:"Institutional aid form required by many private colleges", icon:"📋" },
    { name:"Naviance",     url:"https://www.naviance.com",            desc:"Request transcripts & letters of rec through your school", icon:"📤" },
    { name:"Scoir",        url:"https://www.scoir.com",               desc:"College planning & transcript sending platform",       icon:"📨" },
  ],
  "Trade School": [
    { name:"CareerOneStop", url:"https://www.careeronestop.org/toolkit/training/find-training.aspx", desc:"Find trade programs and vocational schools near you", icon:"🔧" },
    { name:"FAFSA",         url:"https://studentaid.gov/apply-for-aid/fafsa/", desc:"Trade school students qualify for federal aid",   icon:"💰" },
    { name:"SkillsUSA",     url:"https://www.skillsusa.org",          desc:"Competitions, networking and career resources",         icon:"🏆" },
  ],
  Apprenticeship: [
    { name:"Apprenticeship.gov", url:"https://www.apprenticeship.gov/apprentices", desc:"Official federal database of registered apprenticeships", icon:"🏗️" },
    { name:"RAPIDS",        url:"https://www.apprenticeship.gov/employers", desc:"Register completed apprenticeship credentials",    icon:"📜" },
    { name:"Union Finder",  url:"https://www.unionplus.org",          desc:"Find union apprenticeship programs by trade",            icon:"⚙️" },
    { name:"Mike Rowe Works", url:"https://www.mikeroweworks.org/scholarship/", desc:"Scholarships and resources for skilled trades",       icon:"🔨" },
  ],
  Workforce: [
    { name:"USAJobs",       url:"https://www.usajobs.gov",            desc:"Federal government job applications",                    icon:"🇺🇸" },
    { name:"CareerOneStop", url:"https://www.careeronestop.org",      desc:"Job search, resume tools, and local resources",          icon:"💼" },
    { name:"LinkedIn",      url:"https://www.linkedin.com/jobs",      desc:"Professional networking and job applications",           icon:"🔗" },
    { name:"Indeed",        url:"https://www.indeed.com",             desc:"Search and apply to entry-level jobs",                   icon:"🔍" },
    { name:"CareerOneStop", url:"https://www.careeronestop.org",      desc:"Find local training and workforce resources",            icon:"🎓" },
  ],
  Military: [
    { name:"GoArmy.com",    url:"https://www.goarmy.com",             desc:"Army enlistment and officer applications",               icon:"🎖️" },
    { name:"Navy.com",      url:"https://www.navy.com",               desc:"Navy enlistment and NROTC information",                  icon:"⚓" },
    { name:"AirForce.com",  url:"https://www.airforce.com",           desc:"Air Force enlistment and ROTC applications",             icon:"✈️" },
    { name:"Marines.com",   url:"https://www.marines.com",            desc:"Marine Corps enlistment information",                    icon:"🦅" },
    { name:"CoastGuard.com", url:"https://www.gocoastguard.com",      desc:"Coast Guard enlistment information",                     icon:"⛵" },
    { name:"SpaceForce.com", url:"https://www.spaceforce.com",        desc:"Space Force enlistment and officer programs",            icon:"🛸" },
    { name:"ASVAB Practice",url:"https://www.asvabprogram.com",       desc:"Official ASVAB practice tests and career exploration",   icon:"📝" },
  ],
  Entrepreneurship: [
    { name:"NFTE",          url:"https://www.nfte.com",               desc:"Apply to Network for Teaching Entrepreneurship programs", icon:"🚀" },
    { name:"SBA.gov",       url:"https://www.sba.gov/business-guide/10-steps-start-your-business", desc:"Official small business startup guide", icon:"🏢" },
    { name:"YC Startup School", url:"https://www.startupschool.org",  desc:"Free Startup School by Y Combinator",                   icon:"💡" },
    { name:"DECA",          url:"https://www.deca.org",               desc:"Join DECA for business competitions and scholarships",    icon:"📊" },
  ],
};

const STATUS_OPTIONS = ["Not started","In progress","Submitted","Interview","Accepted","Rejected","Waitlisted"];
const STATUS_COLORS  = {
  "Not started": { bg:"#F3F4F6", color:"#6B7280" },
  "In progress":  { bg:"#FEF3C7", color:"#92400E" },
  "Submitted":    { bg:"#DBEAFE", color:"#1A56DB" },
  "Interview":    { bg:"#EBF5FF", color:"#1A56DB" },
  "Accepted":     { bg:"#D1FAE5", color:"#065F46" },
  "Rejected":     { bg:"#FEE2E2", color:"#991B1B" },
  "Waitlisted":   { bg:"#FEF3C7", color:"#92400E" },
};

function ApplicationsPage({ profile }) {
  const [apps,     setApps]     = useState([]);
  const [adding,   setAdding]   = useState(false);
  const [newName,  setNewName]  = useState("");
  const [newDead,  setNewDead]  = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [checklist,  setChecklist]  = useState(null);

  const portals = PATH_PORTALS[profile.path] || PATH_PORTALS.College;

  const addApp = () => {
    if (!newName.trim()) return;
    setApps(a => [...a, { id:Date.now(), name:newName, deadline:newDead, notes:newNotes, status:"Not started", steps:[] }]);
    setNewName(""); setNewDead(""); setNewNotes(""); setAdding(false);
  };

  const updateStatus = (id, status) => setApps(a => a.map(x => x.id===id ? {...x, status} : x));
  const deleteApp    = (id) => setApps(a => a.filter(x => x.id!==id));

  const generateChecklist = async () => {
    if (!profile.path) return;
    setGenLoading(true);
    const prompt = `Generate a concise application checklist for a student on the "${profile.path}" path with GPA ${profile.gpa||"unknown"}.
Return ONLY a JSON array of steps (no markdown):
[{"category":"Documents","item":"Official transcript","tip":"Request from your school counselor at least 2 weeks early"},{"category":"...","item":"...","tip":"..."}]
Include 8-10 realistic, specific steps relevant to the ${profile.path} path. Categories: Documents, Tests, Essays, Recommendations, Financial, Deadlines, Follow-up.`;
    try {
      const raw    = await callClaude([{role:"user",content:prompt}],"Return ONLY a valid JSON array. No markdown, no backticks, no explanation.",800);
      const parsed = parseJSON(raw);
      setChecklist(Array.isArray(parsed) ? parsed.map((s: any) =>({...s,done:false})) : []);
    } catch(err) {
      console.error("Checklist error:", err.message);
      setChecklist([]);
    }
    setGenLoading(false);
  };

  const toggleCheck = (i) => setChecklist(c => c.map((s: any, idx: number) =>idx===i?{...s,done:!s.done}:s));

  const cats = checklist ? [...new Set(checklist.map((s: any) =>s.category))] : [];

  return (
    <div style={{ maxWidth:1100 }}>
      <PageHeader title="Application Hub" subtitle="Manage your deadlines and checklists in one place." />

      <div style={{ display:"grid", gridTemplateColumns:"1fr 320px", gap:16, alignItems:"start" }}>

        {/* LEFT column */}
        <div>
          {/* Application Tracker card */}
          <Card>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ fontSize:16, fontWeight:700, color:"#0F172A" }}>Application Tracker</div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Program name"
                  style={{ ...S.input, width:180, fontSize:13 }} />
                <input value={newDead} onChange={e=>setNewDead(e.target.value)} type="date"
                  style={{ ...S.input, width:150, fontSize:13 }} />
                <button onClick={addApp}
                  style={{ width:36, height:38, background:"#1A56DB", color:"#fff", border:"none", borderRadius:9, fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>+</button>
              </div>
            </div>

            {/* Table header */}
            <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1.2fr 80px", gap:8, padding:"8px 12px", borderBottom:"1.5px solid #F1F5F9" }}>
              {["PROGRAM","DEADLINE","STATUS","ACTION"].map((h: any) =>(
                <div key={h} style={{ fontSize:11, fontWeight:700, color:"#9CA3AF", letterSpacing:"0.07em" }}>{h}</div>
              ))}
            </div>

            {apps.length===0?(
              <div style={{ textAlign:"center", padding:"28px 0", color:"#9CA3AF", fontSize:13, fontStyle:"italic" }}>No applications added yet.</div>
            ):(
              apps.map((app: any) =>(
                <div key={app.id} style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1.2fr 80px", gap:8, padding:"12px 12px", borderBottom:"1px solid #F9FAFB", alignItems:"center" }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#0F172A" }}>{app.name}</div>
                  <div style={{ fontSize:13, color:"#6B7280" }}>{app.deadline||"—"}</div>
                  <select value={app.status} onChange={e=>updateStatus(app.id,e.target.value)}
                    style={{ fontSize:12, fontWeight:600, padding:"4px 8px", borderRadius:20, border:"none", background:STATUS_COLORS[app.status]?.bg||"#F3F4F6", color:STATUS_COLORS[app.status]?.color||"#374151", cursor:"pointer", width:"100%" }}>
                    {STATUS_OPTIONS.map((s: any) =><option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={()=>deleteApp(app.id)} style={{ background:"none", border:"none", color:"#D1D5DB", cursor:"pointer", fontSize:16 }}>×</button>
                </div>
              ))
            )}
          </Card>

          {/* Path-Specific Checklist */}
          <Card>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom: checklist?16:0 }}>
              <div style={{ fontSize:16, fontWeight:700, color:"#0F172A" }}>Path-Specific Checklist</div>
              <button onClick={generateChecklist} disabled={genLoading}
                style={{ ...S.sec, fontSize:13, padding:"7px 16px" }}>
                {genLoading?<><Spinner/>Generating…</>:"Generate Checklist"}
              </button>
            </div>
            {!checklist&&!genLoading&&(
              <div style={{ fontSize:14, color:"#9CA3AF", marginTop:8 }}>
                Generate a personalized checklist for the {profile.path||"selected"} path.
              </div>
            )}
            {checklist&&cats.map((cat: any) =>(
              <div key={cat} style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#1A56DB", textTransform:"uppercase", letterSpacing:"0.07em", marginBottom:8 }}>{cat}</div>
                {checklist.filter((s: any) =>s.category===cat).map((s: any, i: number) =>{
                  const idx = checklist.indexOf(s);
                  return (
                    <div key={i} onClick={()=>toggleCheck(idx)}
                      style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"8px 0", borderBottom:"1px solid #F9FAFB", cursor:"pointer" }}>
                      <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${s.done?"#1A56DB":"#D1D5DB"}`, background:s.done?"#1A56DB":"#fff", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginTop:2 }}>
                        {s.done&&<span style={{ color:"#fff", fontSize:10 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontSize:14, color:s.done?"#9CA3AF":"#374151", textDecoration:s.done?"line-through":"none" }}>{s.item}</div>
                        {s.tip&&<div style={{ fontSize:12, color:"#9CA3AF", marginTop:2 }}>{s.tip}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </Card>
        </div>

        {/* RIGHT column — dark portals card matching screenshot */}
        <div>
          <div style={{ background:"#0F172A", borderRadius:16, padding:24, marginBottom:16 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:18 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              <span style={{ fontSize:15, fontWeight:700, color:"#F1F5F9" }}>Quick Portals</span>
            </div>
            {portals.slice(0,6).map((p: any,i: number)=>(
              <a key={i} href={p.url} target="_blank" rel="noreferrer"
                style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"13px 14px", background:"rgba(255,255,255,0.07)", borderRadius:10, marginBottom:8, textDecoration:"none", color:"#F1F5F9", fontSize:14, fontWeight:600 }}>
                {p.name}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              </a>
            ))}
          </div>

          {/* Transcript Sending Guide */}
          <div style={{ background:"#EFF6FF", border:"1px solid #DBEAFE", borderRadius:14, padding:20 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A56DB" strokeWidth="2"><path strokeLinecap="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
              <span style={{ fontSize:14, fontWeight:700, color:"#1E40AF" }}>Transcript Sending Guide</span>
            </div>
            {[
              "Log into your school portal",
              `Find "Registrar" or "Transcript Request"`,
              "Enter the destination program email or ID",
              "Pay any fees (usually free for students)",
              "Confirm delivery within 3–5 business days",
            ].map((step: any, i: number) =>(
              <div key={i} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"5px 0", fontSize:13, color:"#1E40AF" }}>
                <span style={{ fontWeight:700, flexShrink:0 }}>{i+1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── AI ASSISTANT (REGULATED) ──────────────────────────────────────────────────
function AIPage({ profile, goals }) {
  const welcome = `Hi! I'm your academic planning assistant for the ${profile.path||"path you choose"} track.

I can help you with:
• School & program research for ${profile.path||"your path"}
• Study strategies and GPA improvement
• Application tips and scholarship guidance
• Career pathway exploration

I'm focused on academic topics only. For anything outside that — medical, legal, personal — I'll point you to the right resource. What would you like to work on?`;

  const [msgs,    setMsgs]    = useState([{role:"assistant",text:welcome}]);
  const [input,   setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef();

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);

  const send = async (text) => {
    const msg = text||input;
    if (!msg.trim()||loading) return;
    setInput("");
    setMsgs(m=>[...m,{role:"user",text:msg}]);
    setLoading(true);
    const context = `Student profile: Path: ${profile.path||"undecided"} | GPA: ${profile.gpa||"not provided"} | Goals: ${goals.map((g: any) =>g.title).join(", ")||"none"} | Researched: ${profile.researched?.map((r: any) =>r.name).join(", ")||"none"}`;
    const history = msgs.map((m: any) =>({role:m.role==="assistant"?"assistant":"user",content:m.text}));
    try {
      const reply = await callClaude([...history,{role:"user",content:`${context}\n\nStudent: ${msg}`}],AI_SYSTEM,600);
      setMsgs(m=>[...m,{role:"assistant",text:reply}]);
    } catch(err) {
      console.error("AI chat error:", err.message);
      setMsgs(m=>[...m,{role:"assistant",text:`Error: ${err.message}\n\nMake sure you have billing credit at console.anthropic.com/settings/billing`}]);
    }
    setLoading(false);
  };

  const pathChips = {
    College:         ["What GPA do I need for a top school?","How do I write a strong personal statement?","What extracurriculars help college apps?","How do I compare schools?"],
    "Trade School":  ["What trade matches my interests?","How do I find a local trade school?","What certifications should I get first?","How do I prep for trade certification exams?"],
    Apprenticeship:  ["How do I find registered apprenticeships?","What's union vs non-union?","How do I apply to an apprenticeship?","What do apprenticeship programs look for?"],
    Workforce:       ["How do I build a resume with no experience?","What entry-level certifications are worth it?","How do I prep for job interviews?","What in-demand skills should I develop?"],
    Military:        ["How do I study for the ASVAB?","What's the difference between enlisted and officer?","Which branch fits my goals?","How does military experience help my future?"],
    Entrepreneurship:["How do I validate a business idea?","What programs support student entrepreneurs?","How do I find a startup mentor?","What business skills should I learn first?"],
  };
  const chips = pathChips[profile.path]||["How do I choose the right path?","What scholarships can I apply for?","How do I improve my GPA?","What should I focus on this year?"];

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
      <div style={{ background:"#FEF3C7", border:"1px solid #FDE68A", borderRadius:8, padding:"8px 12px", marginBottom:12, fontSize:12, color:"#92400E" }}>
        ⚠️ <strong>Academic guidance only.</strong> This AI does not provide legal, medical, financial investment, or personal life advice. For those topics, speak with a qualified professional or trusted adult.
      </div>
      <div style={{ flex:1, overflowY:"auto", paddingBottom:12 }}>
        {msgs.map((m: any,i: number)=>(
          <div key={i} style={{ display:"flex", justifyContent:m.role==="user"?"flex-end":"flex-start", marginBottom:10 }}>
            <div style={{ maxWidth:"87%", padding:"10px 14px", borderRadius:m.role==="user"?"18px 18px 4px 18px":"18px 18px 18px 4px", background:m.role==="user"?"#1A56DB":"#F1F5F9", color:m.role==="user"?"#fff":"#1F2937", fontSize:13, lineHeight:1.6, whiteSpace:"pre-wrap" }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading&&<div style={{ display:"flex", marginBottom:10 }}><div style={{ padding:"10px 14px", borderRadius:"18px 18px 18px 4px", background:"#EFF6FF", color:"#1A56DB", fontSize:13 }}><Spinner/>thinking…</div></div>}
        <div ref={bottomRef} />
      </div>
      {msgs.length<=2&&(
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
          {chips.map((c: any) =><button key={c} onClick={()=>send(c)} style={S.chip}>{c}</button>)}
        </div>
      )}
      <div style={{ display:"flex", gap:8 }}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder={`Ask about your ${profile.path||"academic"} path…`}
          style={{ ...S.input, flex:1 }} />
        <button onClick={()=>send()} disabled={loading} style={{ ...S.prim, flexShrink:0 }}>Send</button>
      </div>
    </div>
  );
}

// ── PERSISTENCE HOOK ─────────────────────────────────────────────────────────
// Reads from localStorage on mount, writes on every change.
// Falls back gracefully if localStorage is unavailable (private browsing, etc.)
function usePersistedState(key, defaultValue) {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch { return defaultValue; }
  });

  const setPersistedState = (value) => {
    setState(prev => {
      const next = typeof value === "function" ? value(prev) : value;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return [state, setPersistedState];
}

// ── ONBOARDING FLOW ──────────────────────────────────────────────────────────
// First-time visitors see a 3-step welcome instead of an empty dashboard.
// Disappears permanently once complete (stored in localStorage).
function OnboardingFlow({ onComplete }) {
  const [step, setStep]   = useState(0);
  const [name, setName]   = useState("");
  const [grade, setGrade] = useState("");

  const steps = [
    {
      emoji:"🎯",
      title:"Welcome to TheWorks",
      body:"Your personal academic and career planning platform. We'll help you figure out where you're going — and exactly how to get there.",
      action:"Get started →",
    },
    {
      emoji:"🗺️",
      title:"Every path is valid here",
      body:"College, trade school, military, apprenticeship, workforce, entrepreneurship — TheWorks supports all of them equally. No one path is better than another.",
      action:"Understood →",
    },
    {
      emoji:"🔒",
      title:"Your data stays yours",
      body:"Everything you enter is saved in your browser. We don't sell your data, share it with advertisers, or send it anywhere you don't approve.",
      action:"Let's go →",
    },
  ];

  const current = steps[step];
  const isLast  = step === steps.length - 1;

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:20 }}>
      <div style={{ background:"#fff", borderRadius:16, padding:"36px 32px", maxWidth:440, width:"100%", textAlign:"center", boxShadow:"0 24px 48px rgba(0,0,0,0.15)" }}>
        {/* Step dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:6, marginBottom:28 }}>
          {steps.map((_: any, i: number) =>(
            <div key={i} style={{ width: i===step?20:6, height:6, borderRadius:3, background: i===step?"#1A56DB": i<step?"#93C5FD":"#E2E8F0", transition:"all 0.25s" }} />
          ))}
        </div>

        <div style={{ fontSize:44, marginBottom:16 }}>{current.emoji}</div>
        <div style={{ fontSize:20, fontWeight:700, color:"#0F172A", marginBottom:10 }}>{current.title}</div>
        <div style={{ fontSize:14, color:"#6B7280", lineHeight:1.7, marginBottom:28 }}>{current.body}</div>

        {/* Optional name/grade on step 0 */}
        {step===0 && (
          <div style={{ display:"flex", gap:8, marginBottom:20 }}>
            <input value={name} onChange={e=>setName(e.target.value)}
              placeholder="Your first name (optional)"
              style={{ ...S.input, flex:1 }} />
            <input value={grade} onChange={e=>setGrade(e.target.value)}
              placeholder="Grade"
              style={{ ...S.input, width:80 }} />
          </div>
        )}

        <button onClick={()=>{ if(isLast){ onComplete({ name, grade }); } else setStep(s=>s+1); }}
          style={{ ...S.prim, width:"100%", justifyContent:"center", padding:"12px 24px", fontSize:14 }}>
          {current.action}
        </button>

        {step>0&&<button onClick={()=>setStep(s=>s-1)} style={{ marginTop:12, background:"none", border:"none", color:"#6B7280", fontSize:12, cursor:"pointer" }}>← Back</button>}
      </div>
    </div>
  );
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function App() {
  // ── All state persisted to localStorage ──
  const [profile,  setProfile]  = usePersistedState("tw_profile",  { path:"", gpa:"", name:"", grade:"", transcriptAnalysis:null, scholarshipKeywords:[], researched:[], searchHistory:[] });
  const [goals,    setGoals]    = usePersistedState("tw_goals",    []);
  const [page,     setPage]     = usePersistedState("tw_page",     "home");
  const [onboarded,setOnboarded]= usePersistedState("tw_onboarded",false);
  const [sideOpen, setSideOpen] = useState(true);

  const handleOnboardingComplete = ({ name, grade }) => {
    setProfile(p => ({ ...p, name: name||p.name, grade: grade||p.grade }));
    setOnboarded(true);
  };

  // Clear all saved data (for development / reset)
  const clearData = () => {
    if (!window.confirm("Reset all your TheWorks data? This cannot be undone.")) return;
    ["tw_profile","tw_goals","tw_page","tw_onboarded"].forEach((k: any) =>localStorage.removeItem(k));
    window.location.reload();
  };

  const labels = {
    home:"Home", discover:"Career Discovery", path:"My Path",
    transcript:"Transcript & Analysis", scholarships:"Scholarships",
    goals:"Goals", research:"School Research", compare:"Compare Programs",
    applications:"Applications", ai:"AI Assistant",
  };

  // Simplified nav — group into logical clusters
  const NAV_GROUPED = [
    { section:"Plan", items: NAV.filter((n: any) =>["home","discover","path"].includes(n.id)) },
    { section:"Academics", items: NAV.filter((n: any) =>["transcript","goals","research"].includes(n.id)) },
    { section:"Opportunities", items: NAV.filter((n: any) =>["scholarships","compare","applications"].includes(n.id)) },
    { section:"Tools", items: NAV.filter((n: any) =>["ai"].includes(n.id)) },
  ];

  // SVG icons matching the screenshots
  const NavIcon = ({ id }) => {
    const icons = {
      home:         <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>,
      discover:     <><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" d="M21 21l-4.35-4.35"/></>,
      path:         <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>,
      transcript:   <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>,
      goals:        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>,
      research:     <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>,
      scholarships: <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>,
      compare:      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"/>,
      applications: <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>,
      ai:           <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>,
    };
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {icons[id]}
      </svg>
    );
  };

  return (
    <div style={{ fontFamily:"'DM Sans',system-ui,sans-serif", minHeight:"100vh", background:"#F8FAFC", display:"flex", color:"#1F2937" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap');
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:4px;}
        button{transition:opacity 0.1s,transform 0.1s;font-family:inherit;}
        button:hover{opacity:0.85;}
        a:hover{opacity:0.78;}
        input:focus,textarea:focus{border-color:#1A56DB!important;box-shadow:0 0 0 3px rgba(26,86,219,0.1)!important;outline:none!important;}
        select{background:#fff;color:#1F2937;border:1.5px solid #E5E7EB;border-radius:9px;padding:8px 12px;font-size:14px;font-family:inherit;}
        h1,h2,h3{margin:0;}
      `}</style>

      {!onboarded && <OnboardingFlow onComplete={handleOnboardingComplete} />}

      {/* ── SIDEBAR ── */}
      <div style={{ width:sideOpen?240:0, minWidth:sideOpen?240:0, background:"#0F172A", display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden", transition:"width 0.22s ease, min-width 0.22s ease" }}>

        {/* Logo */}
        <div style={{ padding:"22px 20px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, background:"#0F172A", border:"2px solid #1E293B", borderRadius:9, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <span style={{ fontSize:19, fontWeight:900, color:"#1A56DB", lineHeight:1, fontFamily:"Arial Black,Arial,sans-serif" }}>W</span>
            </div>
            <div style={{ fontSize:17, fontWeight:800, color:"#F8FAFC", letterSpacing:"-0.5px" }}>
              The<span style={{ color:"#3B82F6" }}>Works</span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:"12px 0", overflowY:"auto" }}>
          {NAV_GROUPED.map((group: any) =>(
            <div key={group.section} style={{ marginBottom:8 }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#475569", padding:"10px 20px 5px", textTransform:"uppercase", letterSpacing:"0.1em" }}>{group.section}</div>
              {group.items.map((n: any) =>(
                <button key={n.id} onClick={()=>setPage(n.id)} style={{
                  display:"flex", alignItems:"center", gap:10, width:"100%",
                  padding:"9px 20px", margin:"1px 0",
                  background:page===n.id?"rgba(59,130,246,0.12)":"transparent",
                  color:page===n.id?"#3B82F6":"#94A3B8",
                  border:"none", textAlign:"left", fontSize:13.5,
                  fontWeight:page===n.id?600:400, cursor:"pointer",
                  borderLeft:`2px solid ${page===n.id?"#3B82F6":"transparent"}`,
                }}>
                  <NavIcon id={n.id} />
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding:"14px 20px 18px", borderTop:"1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={clearData} style={{ fontSize:12, color:"#475569", background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", gap:6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
            Reset data
          </button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", minWidth:0, overflow:"hidden" }}>

        {/* Topbar */}
        <div style={{ height:56, padding:"0 28px", background:"#fff", borderBottom:"1px solid #EAECF0", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <button onClick={()=>setSideOpen(o=>!o)} style={{ background:"none", border:"none", cursor:"pointer", color:"#9CA3AF", padding:"4px", display:"flex", alignItems:"center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <span style={{ fontSize:15, color:"#374151", fontWeight:500 }}>
              Welcome{profile.name?`, ${profile.name}`:""}
            </span>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            {profile.path && (
              <div style={{ display:"flex", alignItems:"center", gap:7, background:"#fff", border:"1.5px solid #E5E7EB", borderRadius:20, padding:"5px 14px 5px 10px", fontSize:13, fontWeight:600, color:"#374151" }}>
                <span style={{ fontSize:16 }}>{PATHS.find((p: any) =>p.id===profile.path)?.icon||"🎓"}</span>
                {profile.path}
              </div>
            )}
            <div style={{ width:34, height:34, borderRadius:"50%", background:"#E5E7EB", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ flex:1, overflowY:"auto", padding:"32px 36px", display:"flex", flexDirection:"column", animation:"fadeIn 0.18s ease" }}>
          {page==="home"         && <HomePage         profile={profile} goals={goals} setPage={setPage} />}
          {page==="discover"     && <CareerDiscoveryPage profile={profile} setProfile={setProfile} />}
          {page==="path"         && <PathPage          profile={profile} setProfile={setProfile} />}
          {page==="transcript"   && <TranscriptPage    profile={profile} setProfile={setProfile} />}
          {page==="scholarships" && <ScholarshipsPage  profile={profile} />}
          {page==="goals"        && <GoalsPage         profile={profile} goals={goals} setGoals={setGoals} />}
          {page==="research"     && <ResearchPage      profile={profile} setProfile={setProfile} />}
          {page==="compare"      && <ComparePage       profile={profile} />}
          {page==="applications" && <ApplicationsPage  profile={profile} />}
          {page==="ai"           && <AIPage            profile={profile} goals={goals} />}
        </div>
      </div>
    </div>
  );
}

