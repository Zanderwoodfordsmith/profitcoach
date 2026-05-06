export type AssessmentQuestion = {
  ref: string;
  level: number;
  area: string;
  areaCode: string;
  pillar: string;
  playbook: string;
  page: number;
  questionNumberOnPage: number;
  question: string;
  scoringGuide: {
    red: string;
    amber: string;
    green: string;
  };
};

export const ASSESSMENT_QUESTIONS: AssessmentQuestion[] = [
  // Page 1: Owner Performance (+), Foundation
  {
    ref: "1.0",
    level: 1,
    area: "Owner Performance",
    areaCode: "+",
    pillar: "Foundation",
    playbook: "Focus",
    page: 1,
    questionNumberOnPage: 1,
    question:
      "Do you have a clear daily system for deciding what to work on, so you're not just reacting to whatever comes at you?",
    scoringGuide: {
      red: "I firefight and react to whatever is loudest",
      amber: "I have good days but often get pulled off track",
      green:
        "I have a clear daily method for prioritising and I stick to it",
    },
  },
  {
    ref: "2.0",
    level: 2,
    area: "Owner Performance",
    areaCode: "+",
    pillar: "Foundation",
    playbook: "Time & Energy",
    page: 1,
    questionNumberOnPage: 2,
    question:
      "Do you have clear boundaries around your working hours, energy, and recovery, and do you protect them?",
    scoringGuide: {
      red: "I work all hours and I'm burning out",
      amber: "I've tried but I regularly break my own rules",
      green: "I have sustainable working patterns and protect my energy",
    },
  },
  {
    ref: "3.0",
    level: 3,
    area: "Owner Performance",
    areaCode: "+",
    pillar: "Foundation",
    playbook: "Mindset & Habits",
    page: 1,
    questionNumberOnPage: 3,
    question:
      "Do you have consistent daily/weekly habits and routines that keep you performing at your best?",
    scoringGuide: {
      red: "Every day is different and unstructured",
      amber: "I have some habits but they're inconsistent",
      green:
        "I have a personal operating system that I follow consistently",
    },
  },
  {
    ref: "4.0",
    level: 4,
    area: "Owner Performance",
    areaCode: "+",
    pillar: "Foundation",
    playbook: "Leadership",
    page: 1,
    questionNumberOnPage: 4,
    question:
      "Are you actively developing your leadership skills, communication, decision-making, and emotional intelligence?",
    scoringGuide: {
      red: "I haven't focused on this",
      amber: "I'm aware of my gaps but not actively developing",
      green:
        "I invest in my leadership development and see the results",
    },
  },
  {
    ref: "5.0",
    level: 5,
    area: "Owner Performance",
    areaCode: "+",
    pillar: "Foundation",
    playbook: "Life Design",
    page: 1,
    questionNumberOnPage: 5,
    question:
      "Have you designed your life so the business serves the lifestyle you want, not the other way round?",
    scoringGuide: {
      red: "My business runs my life",
      amber: "I've made some progress but I'm not there yet",
      green:
        "I choose my involvement and my life is designed around what I want",
    },
  },
  // Page 2: Aligned Vision (A), Clarify Vision
  {
    ref: "1.1",
    level: 1,
    area: "Aligned Vision",
    areaCode: "A",
    pillar: "Clarify Vision",
    playbook: "Purpose",
    page: 2,
    questionNumberOnPage: 1,
    question:
      "Do you know exactly what you need from your business, financially and personally, and why you're doing this?",
    scoringGuide: {
      red: "I've never clearly defined this",
      amber:
        "I have a rough idea but it's not written down or clear",
      green:
        "I know my number, my lifestyle needs, and why this business exists for me",
    },
  },
  {
    ref: "2.1",
    level: 2,
    area: "Aligned Vision",
    areaCode: "A",
    pillar: "Clarify Vision",
    playbook: "Goals",
    page: 2,
    questionNumberOnPage: 2,
    question:
      "Do you have clear, measurable business goals that you're actively working towards?",
    scoringGuide: {
      red: "I don't have written goals",
      amber:
        "I have goals in my head but they're not specific or tracked",
      green:
        "I have clear goals with numbers and deadlines and I review them regularly",
    },
  },
  {
    ref: "3.1",
    level: 3,
    area: "Aligned Vision",
    areaCode: "A",
    pillar: "Clarify Vision",
    playbook: "Vision",
    page: 2,
    questionNumberOnPage: 3,
    question:
      "Do you have a clear, compelling 3-year vision for your business that your team knows and buys into?",
    scoringGuide: {
      red: "I haven't created one",
      amber:
        "I have a rough picture but it's not communicated well",
      green:
        "I have a vivid vision and my team can articulate where we're heading",
    },
  },
  {
    ref: "4.1",
    level: 4,
    area: "Aligned Vision",
    areaCode: "A",
    pillar: "Clarify Vision",
    playbook: "Strategic Intent",
    page: 2,
    questionNumberOnPage: 4,
    question:
      "Have you turned your vision into a specific, measurable, time-bound strategic target that drives your decisions?",
    scoringGuide: {
      red: "My direction is still vague",
      amber:
        "I have a general direction but it's not specific enough to say no to things",
      green:
        "I have a strategic intent that is specific enough to guide every major decision",
    },
  },
  {
    ref: "5.1",
    level: 5,
    area: "Aligned Vision",
    areaCode: "A",
    pillar: "Clarify Vision",
    playbook: "Mission",
    page: 2,
    questionNumberOnPage: 5,
    question:
      "Does your company have a clear mission, a purpose beyond profit, that would outlast you as the founder?",
    scoringGuide: {
      red: "The business is just about making money",
      amber:
        "I have a sense of purpose but it's not articulated or embedded",
      green:
        "We have a clear mission that the team and customers connect with",
    },
  },
  // Page 3: Defined Strategy (D), Clarify Vision
  {
    ref: "1.2",
    level: 1,
    area: "Defined Strategy",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Core Offer",
    page: 3,
    questionNumberOnPage: 1,
    question:
      "Do you have one clear core offer, for a defined target market, that you can explain in one sentence?",
    scoringGuide: {
      red: "I offer too many things to too many people",
      amber:
        "I have an offer but it's not sharp or clearly differentiated",
      green:
        "I have a clear offer, for a clear market, and I know why people buy it",
    },
  },
  {
    ref: "2.2",
    level: 2,
    area: "Defined Strategy",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Business Model",
    page: 3,
    questionNumberOnPage: 2,
    question:
      "Do you understand how money flows through your business, your revenue streams, pricing model, and how you make profit?",
    scoringGuide: {
      red: "I've never mapped this out",
      amber:
        "I know roughly but I haven't structured it properly",
      green:
        "I have a clear business model with defined revenue streams and I understand my unit economics",
    },
  },
  {
    ref: "3.2",
    level: 3,
    area: "Defined Strategy",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Positioning",
    page: 3,
    questionNumberOnPage: 3,
    question:
      "Are you clearly positioned against your competitors, do customers know why they should choose you?",
    scoringGuide: {
      red: "I look like everyone else in my market",
      amber:
        "I have some differentiation but it's not clear or consistent",
      green:
        "I have a clear unique position and my market knows exactly what makes me different",
    },
  },
  {
    ref: "4.2",
    level: 4,
    area: "Defined Strategy",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Growth Strategy",
    page: 3,
    questionNumberOnPage: 4,
    question:
      "Do you have a deliberate growth strategy, you know where to grow next and where NOT to invest?",
    scoringGuide: {
      red: "I chase opportunities as they come",
      amber: "I have ideas about growth but no structured plan",
      green:
        "I have a clear growth strategy with defined priorities and resource allocation",
    },
  },
  {
    ref: "5.2",
    level: 5,
    area: "Defined Strategy",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Exit Strategy",
    page: 3,
    questionNumberOnPage: 5,
    question:
      "Do you have a plan for your eventual exit, whether that's selling, succession, or another path?",
    scoringGuide: {
      red: "I've never thought about it",
      amber:
        "I've thought about it but have no concrete plan",
      green:
        "I know my exit path, I'm building towards it, and I know what drives my valuation",
    },
  },
  // Page 4: Disciplined Planning (D), Clarify Vision
  {
    ref: "1.3",
    level: 1,
    area: "Disciplined Planning",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Execution",
    page: 4,
    questionNumberOnPage: 1,
    question:
      "Do you consistently finish what you start, do you have a system to prioritise, plan your week, and get things done?",
    scoringGuide: {
      red: "I start lots of things and finish few",
      amber: "I plan sometimes but execution is inconsistent",
      green:
        "I have a reliable weekly planning system and I finish what I commit to",
    },
  },
  {
    ref: "2.3",
    level: 2,
    area: "Disciplined Planning",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Business Mapping",
    page: 4,
    questionNumberOnPage: 2,
    question:
      "Have you mapped out how your business actually works, the key processes from lead to delivery to cash?",
    scoringGuide: {
      red: "It's all in my head",
      amber:
        "I've mapped some of it but not the full picture",
      green:
        "I have a clear visual map of how the whole business operates",
    },
  },
  {
    ref: "3.3",
    level: 3,
    area: "Disciplined Planning",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Projects & Planning",
    page: 4,
    questionNumberOnPage: 3,
    question:
      "Do you plan in structured time horizons, annual goals, quarterly plans, and 90-day sprints with clear projects?",
    scoringGuide: {
      red: "I don't plan beyond the next few weeks",
      amber:
        "I have some planning but it's not structured across time horizons",
      green:
        "I have annual, quarterly, and 90-day plans with clear projects and milestones",
    },
  },
  {
    ref: "4.3",
    level: 4,
    area: "Disciplined Planning",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Meetings & Reviews",
    page: 4,
    questionNumberOnPage: 4,
    question:
      "Do you have a regular meeting rhythm, weekly huddles, monthly reviews, and quarterly planning sessions, with clear agendas?",
    scoringGuide: {
      red: "Meetings are ad hoc or non-existent",
      amber:
        "I have some regular meetings but they lack structure or rhythm",
      green:
        "I have a full meeting cadence that runs the business with clear agendas and accountability",
    },
  },
  {
    ref: "5.3",
    level: 5,
    area: "Disciplined Planning",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Succession Planning",
    page: 4,
    questionNumberOnPage: 5,
    question:
      "Do you have a succession plan so the business can continue and thrive without you?",
    scoringGuide: {
      red: "The business depends entirely on me",
      amber:
        "I've started thinking about it but there's no formal plan",
      green:
        "I have key people, governance structures, and the business can run independently",
    },
  },
  // Page 5: Profit & Cash Flow (P), Control Velocity
  {
    ref: "1.4",
    level: 1,
    area: "Profit & Cash Flow",
    areaCode: "P",
    pillar: "Control Velocity",
    playbook: "Cash Flow",
    page: 5,
    questionNumberOnPage: 1,
    question:
      "Do you know exactly how much cash you have, what's coming in, and whether you can pay your bills for the next 13 weeks?",
    scoringGuide: {
      red: "I check my bank balance and hope for the best",
      amber:
        "I have a rough idea but no rolling forecast",
      green:
        "I have a cash flow forecast and I review it weekly",
    },
  },
  {
    ref: "2.4",
    level: 2,
    area: "Profit & Cash Flow",
    areaCode: "P",
    pillar: "Control Velocity",
    playbook: "Cost Control",
    page: 5,
    questionNumberOnPage: 2,
    question:
      "Have you audited your costs, cut unnecessary spending, and got your overheads under control?",
    scoringGuide: {
      red: "I don't really know where all my money goes",
      amber: "I've looked at it but not systematically",
      green:
        "I've done a full expense audit, eliminated waste, and I review costs regularly",
    },
  },
  {
    ref: "3.4",
    level: 3,
    area: "Profit & Cash Flow",
    areaCode: "P",
    pillar: "Control Velocity",
    playbook: "Profit & Pricing",
    page: 5,
    questionNumberOnPage: 3,
    question:
      "Are your prices set deliberately for profit, do you know your margins on every product/service and are they healthy?",
    scoringGuide: {
      red: "I guessed my prices or just matched competitors",
      amber:
        "I've thought about pricing but I'm not confident my margins are right",
      green:
        "I've done proper margin analysis, my pricing is strategic, and my profits are healthy",
    },
  },
  {
    ref: "4.4",
    level: 4,
    area: "Profit & Cash Flow",
    areaCode: "P",
    pillar: "Control Velocity",
    playbook: "Profit Allocation",
    page: 5,
    questionNumberOnPage: 4,
    question:
      "Do you deliberately allocate your profit into buckets, owner pay, tax, profit reserve, and reinvestment?",
    scoringGuide: {
      red: 'Whatever\'s left at the end is "profit"',
      amber:
        "I take owner drawings but don't have a structured allocation system",
      green:
        "I use a profit allocation method and my money has clear jobs",
    },
  },
  {
    ref: "5.4",
    level: 5,
    area: "Profit & Cash Flow",
    areaCode: "P",
    pillar: "Control Velocity",
    playbook: "Wealth Building",
    page: 5,
    questionNumberOnPage: 5,
    question:
      "Are you building personal wealth beyond the business, optimising tax, investing, and creating financial independence?",
    scoringGuide: {
      red: "All my wealth is tied up in the business",
      amber:
        "I've started but I don't have a clear personal wealth strategy",
      green:
        "I have a wealth strategy, my tax is optimised, and I'm building assets outside the business",
    },
  },
  // Page 6: Revenue & Marketing (R), Control Velocity
  {
    ref: "1.5",
    level: 1,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Ideal Customer",
    page: 6,
    questionNumberOnPage: 1,
    question:
      "Have you clearly defined your ideal customer, who they are, what they need, and what problem you solve for them?",
    scoringGuide: {
      red: "I'll work with anyone who'll pay",
      amber:
        "I have a general idea but it's not researched or documented",
      green:
        "I have a clear ideal customer profile based on real research and I know their pain in their own words",
    },
  },
  {
    ref: "2.5",
    level: 2,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Lead Generation",
    page: 6,
    questionNumberOnPage: 2,
    question:
      "Do you have a reliable, consistent system for generating new leads and getting attention?",
    scoringGuide: {
      red: "I rely on word of mouth or hope",
      amber:
        "I do some marketing but it's inconsistent and I don't know what works",
      green:
        "I have at least one proven lead generation channel that consistently brings in qualified leads",
    },
  },
  {
    ref: "3.5",
    level: 3,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Lead Nurture",
    page: 6,
    questionNumberOnPage: 3,
    question:
      "Do you have systems to warm up leads who aren't ready to buy yet, email sequences, follow-ups, content?",
    scoringGuide: {
      red: "If they don't buy straight away, I lose them",
      amber:
        "I do some follow-up but it's manual and inconsistent",
      green:
        "I have automated nurture sequences and a system for staying in touch with prospects",
    },
  },
  {
    ref: "4.5",
    level: 4,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Sales & Conversion",
    page: 6,
    questionNumberOnPage: 4,
    question:
      "Do you have a structured sales process that converts leads into customers, and does it work without you personally?",
    scoringGuide: {
      red: "Sales is ad hoc and depends entirely on me",
      amber:
        "I have a process but it's not documented or transferable",
      green:
        "I have a structured, repeatable sales process that others can run",
    },
  },
  {
    ref: "5.5",
    level: 5,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Branding",
    page: 6,
    questionNumberOnPage: 5,
    question:
      "Is your business becoming the recognised go-to brand in your market, where customers come to you?",
    scoringGuide: {
      red: "Nobody knows who we are",
      amber:
        "We have some reputation but we're not a clear authority",
      green:
        "We're known as the go-to in our space, customers seek us out, and our brand is a real asset",
    },
  },
  // Page 7: Operations & Delivery (O), Control Velocity
  {
    ref: "1.6",
    level: 1,
    area: "Operations & Delivery",
    areaCode: "O",
    pillar: "Control Velocity",
    playbook: "Fulfilment",
    page: 7,
    questionNumberOnPage: 1,
    question:
      "Do you have a reliable, repeatable process for delivering what you promise to customers?",
    scoringGuide: {
      red: "Every job feels like reinventing the wheel",
      amber:
        "I have a rough process but it's inconsistent or in my head",
      green:
        "I have a clear, documented delivery process that produces consistent results",
    },
  },
  {
    ref: "2.6",
    level: 2,
    area: "Operations & Delivery",
    areaCode: "O",
    pillar: "Control Velocity",
    playbook: "Customer Experience",
    page: 7,
    questionNumberOnPage: 2,
    question:
      "Have you deliberately designed the customer experience, every touchpoint from first contact to completion?",
    scoringGuide: {
      red: "I've never thought about it as a designed experience",
      amber:
        "Some touchpoints are good but it's not designed end-to-end",
      green:
        "I've mapped the customer journey and every touchpoint is intentional",
    },
  },
  {
    ref: "3.6",
    level: 3,
    area: "Operations & Delivery",
    areaCode: "O",
    pillar: "Control Velocity",
    playbook: "Customer Retention",
    page: 7,
    questionNumberOnPage: 3,
    question:
      "Do you have systems in place to keep customers coming back and reduce churn?",
    scoringGuide: {
      red: "I don't track retention or have systems for it",
      amber: "I do some things but it's not systematic",
      green:
        "I track retention, I know why people leave, and I have active systems to keep customers",
    },
  },
  {
    ref: "4.6",
    level: 4,
    area: "Operations & Delivery",
    areaCode: "O",
    pillar: "Control Velocity",
    playbook: "Lifetime Value",
    page: 7,
    questionNumberOnPage: 4,
    question:
      "Do you actively work to grow what each customer is worth, through upsells, cross-sells, and increased frequency?",
    scoringGuide: {
      red: "I focus on getting new customers, not growing existing ones",
      amber:
        "I do some upselling but it's not structured",
      green:
        "I know my customer lifetime value and I have deliberate strategies to increase it",
    },
  },
  {
    ref: "5.6",
    level: 5,
    area: "Operations & Delivery",
    areaCode: "O",
    pillar: "Control Velocity",
    playbook: "Product Development",
    page: 7,
    questionNumberOnPage: 5,
    question:
      "Do you have a structured approach to evolving what you offer, new products, services, or innovations?",
    scoringGuide: {
      red: "We've been selling the same thing for years with no evolution",
      amber:
        "I develop new things but it's reactive not strategic",
      green:
        "I have a structured R&D process and a roadmap for product/service evolution",
    },
  },
  // Page 8: Financials & Metrics (F), Create Value
  {
    ref: "1.7",
    level: 1,
    area: "Financials & Metrics",
    areaCode: "F",
    pillar: "Create Value",
    playbook: "Finance Fundamentals",
    page: 8,
    questionNumberOnPage: 1,
    question:
      "Do you understand your basic financial statements, can you read a P&L and know what the numbers mean?",
    scoringGuide: {
      red: "I leave all finance to my accountant and don't really understand it",
      amber:
        "I understand some basics but I'm not confident reading my own numbers",
      green:
        "I can read my P&L, understand my margins, and know what my numbers are telling me",
    },
  },
  {
    ref: "2.7",
    level: 2,
    area: "Financials & Metrics",
    areaCode: "F",
    pillar: "Create Value",
    playbook: "Bookkeeping",
    page: 8,
    questionNumberOnPage: 2,
    question:
      "Are your books clean, up to date, and managed by a competent bookkeeper or system?",
    scoringGuide: {
      red: "My books are a mess or months behind",
      amber:
        "They're mostly up to date but I don't fully trust the numbers",
      green:
        "My books are clean, current, and I have a reliable bookkeeper/system",
    },
  },
  {
    ref: "3.7",
    level: 3,
    area: "Financials & Metrics",
    areaCode: "F",
    pillar: "Create Value",
    playbook: "KPIs",
    page: 8,
    questionNumberOnPage: 3,
    question:
      "Do you track the right key performance indicators, and do you review them regularly to make decisions?",
    scoringGuide: {
      red: "I don't know what to measure or I don't measure anything",
      amber:
        "I track some numbers but I'm not sure they're the right ones",
      green:
        "I have clear lead and lag KPIs, I review them weekly/monthly, and they drive my decisions",
    },
  },
  {
    ref: "4.7",
    level: 4,
    area: "Financials & Metrics",
    areaCode: "F",
    pillar: "Create Value",
    playbook: "Dashboards & Reporting",
    page: 8,
    questionNumberOnPage: 4,
    question:
      "Do you have dashboards, scorecards, or management reports that give you a clear picture of business performance?",
    scoringGuide: {
      red: "I have no reporting system",
      amber:
        "I have some reports but they're incomplete or I don't review them consistently",
      green:
        "I have visual dashboards/scorecards that I review regularly with my team",
    },
  },
  {
    ref: "5.7",
    level: 5,
    area: "Financials & Metrics",
    areaCode: "F",
    pillar: "Create Value",
    playbook: "Business Valuation",
    page: 8,
    questionNumberOnPage: 5,
    question:
      "Do you know what your business is worth, what drives its value, and are you actively building enterprise value?",
    scoringGuide: {
      red: "I have no idea what the business is worth",
      amber:
        "I've had a rough valuation but I'm not actively managing the drivers",
      green:
        "I know my valuation, I understand the drivers, and I'm deliberately increasing them",
    },
  },
  // Page 9: Infrastructure & Systems (I), Create Value
  {
    ref: "1.8",
    level: 1,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "Processes",
    page: 9,
    questionNumberOnPage: 1,
    question:
      "Have you identified and listed all the key processes in your business, do you know what needs to happen and in what order?",
    scoringGuide: {
      red: "It's all in people's heads",
      amber:
        "I've listed some but not all, and they're not documented",
      green:
        "I've identified all key processes and I know the critical path from lead to cash",
    },
  },
  {
    ref: "2.8",
    level: 2,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "AI & Automation",
    page: 9,
    questionNumberOnPage: 2,
    question:
      "Are you using AI and automation tools to take repetitive, low-value work off your plate?",
    scoringGuide: {
      red: "I haven't explored AI or automation for my business",
      amber:
        "I use some tools but I know there's much more I could automate",
      green:
        "I've systematically identified and automated low-value tasks using AI and automation",
    },
  },
  {
    ref: "3.8",
    level: 3,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "Systems",
    page: 9,
    questionNumberOnPage: 3,
    question:
      "Do you have proper connected systems across your business, marketing, sales, delivery, and finance all joined up?",
    scoringGuide: {
      red: "Everything is disconnected or manual",
      amber:
        "I have some systems but they're not connected or complete",
      green:
        "I have integrated systems across all key business functions",
    },
  },
  {
    ref: "4.8",
    level: 4,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "Management",
    page: 9,
    questionNumberOnPage: 4,
    question:
      "Do you have a management system for running your people, with clear expectations, accountability, cadence, and recognition?",
    scoringGuide: {
      red: "I manage people ad hoc with no structure",
      amber:
        "I have some management practices but they're inconsistent",
      green:
        "I have a structured management system with clear practices that my managers follow",
    },
  },
  {
    ref: "5.8",
    level: 5,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "Optimisation",
    page: 9,
    questionNumberOnPage: 5,
    question:
      "Do you have a continuous improvement process, regularly reviewing and refining your systems to make them better?",
    scoringGuide: {
      red: "Once something is built, I rarely revisit it",
      amber:
        "I improve things when they break but I don't have a formal process",
      green:
        "I have a structured approach to continuous improvement with feedback loops",
    },
  },
  // Page 10: Team & Leadership (T), Create Value
  {
    ref: "1.9",
    level: 1,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Team Foundations",
    page: 10,
    questionNumberOnPage: 1,
    question:
      "Does everyone in your business know their role, who they report to, and what's expected of them?",
    scoringGuide: {
      red: "Roles are unclear and people overlap or drop things",
      amber:
        "Most people know their role but it's not documented or crystal clear",
      green:
        "I have a clear org chart, defined roles, and everyone knows what's expected",
    },
  },
  {
    ref: "2.9",
    level: 2,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Recruitment",
    page: 10,
    questionNumberOnPage: 2,
    question:
      "Do you have a structured process for finding, hiring, and onboarding the right people?",
    scoringGuide: {
      red: "I hire reactively and hope for the best",
      amber:
        "I have some process but it's not consistent or thorough",
      green:
        "I have a repeatable recruitment process with clear criteria, interviews, and structured onboarding",
    },
  },
  {
    ref: "3.9",
    level: 3,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Team Performance",
    page: 10,
    questionNumberOnPage: 3,
    question:
      "Do you have systems for getting the best out of your team, training, accountability, feedback, and performance reviews?",
    scoringGuide: {
      red: "I don't have formal performance management",
      amber: "I do some of this but it's inconsistent",
      green:
        "I have regular reviews, clear accountability, training plans, and feedback systems",
    },
  },
  {
    ref: "4.9",
    level: 4,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Developing Leaders",
    page: 10,
    questionNumberOnPage: 4,
    question:
      "Are you developing people into leaders who can run parts of the business without you?",
    scoringGuide: {
      red: "No one else can lead without me",
      amber:
        "I have some capable people but I haven't invested in their leadership development",
      green:
        "I'm actively coaching and developing leaders who make decisions and run things independently",
    },
  },
  {
    ref: "5.9",
    level: 5,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Company Culture",
    page: 10,
    questionNumberOnPage: 5,
    question:
      "Do you have culture built as a deliberate system, with clear values, behaviours, enforcement, and recognition?",
    scoringGuide: {
      red: "Culture is accidental, not designed",
      amber:
        "We have values on the wall but they're not enforced or embedded in how we operate",
      green:
        "Culture is a system with defined values, expected behaviours, enforcement, and recognition",
    },
  },
];

export const QUESTIONS_BY_PAGE: Record<number, AssessmentQuestion[]> =
  ASSESSMENT_QUESTIONS.reduce((acc, q) => {
    if (!acc[q.page]) acc[q.page] = [];
    acc[q.page].push(q);
    return acc;
  }, {} as Record<number, AssessmentQuestion[]>);

Object.values(QUESTIONS_BY_PAGE).forEach((list) =>
  list.sort((a, b) => a.level - b.level)
);

export const QUESTIONS_BY_LEVEL: Record<number, AssessmentQuestion[]> =
  ASSESSMENT_QUESTIONS.reduce((acc, q) => {
    if (!acc[q.level]) acc[q.level] = [];
    acc[q.level].push(q);
    return acc;
  }, {} as Record<number, AssessmentQuestion[]>);

Object.values(QUESTIONS_BY_LEVEL).forEach((list) =>
  list.sort((a, b) => a.page - b.page)
);

