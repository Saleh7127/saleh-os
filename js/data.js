// Story content for the open world. Map positions live in src/maps.js (matched by id).
// Hangout texts are short placeholders — replace them with your own stories.
window.PORTFOLIO = {
  name: "Abu Saleh",
  now: 2026.86,
  home: { place: "Kachua, Chandpur", country: "Bangladesh", lat: 23.35, lon: 90.9 },
  contact: {
    email: "abusalehjunior@gmail.com",
    github: "https://github.com/Saleh7127",
    linkedin: "https://www.linkedin.com/in/abu-saleh-shaon",
  },

  places: {
    home: { title: "Home", years: "1999", text: "Born here, in a village in Kachua, Chandpur. Tin roofs, rice fields, a tube well in the yard." },
    kg: { title: "Tamijuddin Kindergarten", years: "2005 – 2007", text: "First school bag, first classroom." },
    tulpai: { title: "Tulpai Darashahi High School", years: "2008 – 2010", text: "Village high school days in Kachua." },
    alamin: { title: "Al Amin Academy School & College", years: "2011 – 2015", text: "Moved to Chandpur town for school.", bullets: ["SSC — Cumilla Board scholarship"] },
    ghat: { title: "Chandpur Launch Ghat", years: "2011 – 2015", text: "Where the Meghna meets the Padma — launches leaving for Dhaka every evening." },
    notredame: { title: "Notre Dame College", years: "2015 – 2017", text: "HSC in Dhaka.", bullets: ["HSC — Dhaka Board scholarship"] },
    kamalapur: { title: "Kamalapur", years: "2015 – 2017", text: "Hanging out with friends around Kamalapur station. They're still here — say hi, or give them a friendly bonk with F." },
    coaching: { title: "Admission Battle — Round 2", years: "2018", text: "A second attempt at public-university admission. Extra life used — continue." },
    bau: { title: "Bangladesh Agricultural University", years: "2019", text: "The first four months of university life, in Mymensingh." },
    diu: { title: "Daffodil International University", years: "May 2019 – Dec 2023", role: "B.Sc. in Computer Science & Engineering", where: "Ashulia, Dhaka", text: "Four years of algorithms, contests and teaching.", bullets: ["GPA 3.95/4.0 — Highest Distinction, merit-based scholarship", "Teaching Assistant and Programming Trainer", "ICPC Dhaka Regional 2019–2023 — best 31st of 1600 teams", "Google Kickstart — 29th in Bangladesh, 932nd globally", "3,000+ problems solved; top 5 nationally on CodeChef (peak 2049), top 15 on Codeforces (peak 1607); 15 problems authored", "Judging Director, DIU Take-OFF 2023 (2,400+ participants) · Problem Setter, NGPC 2022 · VP, ACM Task Force 2022", "Coursework: Data Structures, Algorithms, Data Mining, Software Engineering, Computer Architecture"], skills: ["C/C++", "Algorithms", "Graphs", "DP", "Competitive programming"] },
    dhanmondi: { title: "Dhanmondi Lake", years: "2019 – 2023", text: "Evenings around Dhanmondi Lake with friends and tea. The gang is still at the stall — bonk them with F, they'll get back up." },
    mirpur: { title: "Mirpur", years: "2019 – 2023", text: "Hangouts with friends in Mirpur, near the cricket stadium. Friendly bonks allowed (F)." },
    appscode: { title: "AppsCode", years: "May – Aug 2023", role: "Software Engineer", where: "Dhaka", text: "First industry job, at a company building Kubernetes-native tools — learning how production software is shipped." },
    enosis: { title: "Enosis Solutions", years: "Sep 2023 – Apr 2024", role: "Software Engineer", where: "Dhaka", text: "Full-stack work on data-driven products.", bullets: ["Built backend APIs and data-driven dashboards supporting analytical workflows and business reporting", "Designed task-management features using DFS topological sort", "Implemented Role-Based Access Control"], skills: ["Django REST Framework", "React.js", "SQLAlchemy", "PostgreSQL", "Data visualization"] },
    airport_dac: { title: "Hazrat Shahjalal Airport", years: "2024", text: "Erasmus Mundus scholarship — off to Finland." },

    abo: { title: "Åbo Akademi University", years: "Aug 2024 – 2025", role: "Erasmus Mundus Master's (EDISS) — Year 1", where: "Turku, Finland", text: "Master of Science (Technology): foundations in data-intensive systems and core machine learning.", bullets: ["Erasmus Mundus Joint Master scholarship", "Focus: Machine Learning, LLMs and SLMs, Multi-Agent Systems, Software Architectures", "Project — TinyTest: small language models (Llama, Mistral) for automated unit-test generation, with an agentic repair loop that feeds error logs back into context"], skills: ["Python", "PyTorch", "LLMs/SLMs", "Test automation", "Mutation testing"] },
    elisa: { title: "Elisa", years: "Oct 2024 – May 2025", role: "Research Intern — Time-Series Sequence Modeling", where: "Turku, Finland", text: "Forecasting highly volatile energy-market prices.", bullets: ["Built and evaluated forecasting models (LightGBM, Temporal Fusion Transformer) — MAE of 17–21", "Designed end-to-end ML pipelines with 90+ engineered temporal features and sliding-window backtesting", "Improved model transparency with SHAP-based explainability", "Published: Forecasting Finnish aFRR Energy Reserve Market Prices — Elsevier Energy & AI"], skills: ["LightGBM", "TFT", "SHAP", "Optuna", "Time-series forecasting"] },
    huawei: { title: "Huawei Technologies", years: "May – Aug 2025", role: "Audio Junior Researcher (Intern)", where: "Tampere, Finland", text: "Acoustic scene classification for edge devices.", bullets: ["Optimised VGG-based CNNs for acoustic scene classification — +8% accuracy via FFT tuning", "Refactored legacy workflows into modular Python pipelines for systematic ablation studies", "Translated VGGish model layers to C for low-latency edge inference with no loss in performance"], skills: ["PyTorch", "CNNs", "Audio DSP", "FFT", "C", "MLflow"] },
    montel: { title: "Montel", years: "Mar – Oct 2026", role: "Data Scientist Intern (part-time)", where: "Sweden · remote from Tampere", text: "Energy-market forecasting in production.", bullets: ["Built mFRR capacity-price forecasting pipelines (LightGBM, Darts) for Finland and Sweden — 72-hour UP/DOWN forecasts across 5 bidding zones, −7% forecast error", "Developed a regime-switch model for Swedish prices that detected 82% of price spikes (37/45) in historical replays", "Productionised Airflow pipelines for multi-source energy data, including forecast correction across 22 European bidding zones", "Wrote ~15 product data specifications for the EnAppSys platform"], skills: ["Python", "LightGBM", "Darts", "Airflow", "pytest"] },
    ublox: { title: "u-blox", years: "Jun 2026 – present", role: "AI Engineer — Test Automation (part-time)", where: "Tampere, Finland", text: "Now I literally work with satellites — using LLM agents to modernise GNSS testing.", bullets: ["Designed a multi-agent LLM pipeline (orchestrator, migration, verification and reporting agents) that ports GNSS performance KPIs from a legacy Perl framework to Python / Robot Framework", "Built 2 MCP servers in Python (21 tools) giving agents access to a test-results database, a log archive and SharePoint Excel, with guardrails: host allow-lists, read-only SQL, certificate auth", "Migrated ~40 KPI algorithms and 70+ automated analysis tests — 64/64 values matched across 8 devices on real receiver logs", "Cut MCP query latency ~10× (83 s → ~7 s) and data transfer ~1000× (276 MB → 273 KB), reducing token usage by 13%", "Paper: The Illusion of Agentic Complexity in README.md Generation — ICSME 2026"], skills: ["LLM agents", "MCP", "Tool calling", "Prompt engineering", "httpx", "Robot Framework"] },
    next: { title: "Next waypoint", years: "Now", text: "Exploring Small Language Models and agentic AI to automate engineering pipelines. Looking for my next adventure in foundational AI / LLMs.", links: true },
    airport_fi: { title: "Tampere-Pirkkala Airport", years: "", text: "Fly to Dhaka or L'Aquila." },

    laquila: { title: "University of L'Aquila", years: "Sep 2025 – Feb 2026", role: "Erasmus Mundus Master's (EDISS) — Year 2", where: "L'Aquila, Italy", text: "Master of Science in Software Engineering, specialising in Model-Driven Machine Learning.", bullets: ["Model-Driven Engineering and Software Engineering for Autonomous Systems", "Software Architectures and Multi-Agent Systems"], skills: ["MDE", "ML", "Multi-agent systems"] },
    collemaggio: { title: "Basilica di Collemaggio", years: "2025", text: "Pink-and-white stone under the Gran Sasso." },
    airport_it: { title: "L'Aquila Airfield", years: "", text: "Fly back to Finland or Dhaka." },
  },

  // Collectibles float near places (id = place id).
  achievements: [
    { place: "alamin", icon: "medal", title: "SSC Scholarship", text: "Cumilla Education Board" },
    { place: "notredame", icon: "medal", title: "HSC Scholarship", text: "Dhaka Education Board" },
    { place: "coaching", icon: "heart", title: "Extra Life", text: "Second attempt at admission" },
    { place: "diu", icon: "trophy", title: "ICPC Dhaka Regional", text: "2019–2023 · best 31st of 1600" },
    { place: "diu", icon: "code", title: "3,000+ Problems", text: "CodeChef 2049 · Codeforces 1607", offset: [8, 0] },
    { place: "diu", icon: "cap", title: "B.Sc. — Highest Distinction", text: "GPA 3.95 / 4.0", offset: [-8, 0] },
    { place: "airport_dac", icon: "medal", title: "Erasmus Mundus Scholarship", text: "EMJMD — EDISS" },
    { place: "elisa", icon: "paper", title: "Energy & AI Paper", text: "Forecasting Finnish aFRR prices" },
    { place: "ublox", icon: "paper", title: "ICSME 2026 Paper", text: "Single- vs multi-agent RAG" },
    { place: "laquila", icon: "cap", title: "M.Sc. Graduation", text: "EDISS — Åbo Akademi & L'Aquila" },
  ],
};
