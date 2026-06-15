/** BOSS Pro 50-question diagnostic — methodology v2 (outcome-based). */

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
      "Are you protecting your working hours, energy, and recovery so you can perform sustainably?",
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
      "Do your daily and weekly habits actually keep you performing at your best?",
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
      "Is your leadership delivering results, with clear communication, sound decisions, and a team that follows your direction?",
    scoringGuide: {
      red: "My team doesn't get clear direction and decisions stall",
      amber: "I'm leading but inconsistently: some areas work, others don't",
      green:
        "My leadership is effective and the business responds to how I lead",
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
      "Is your business giving you the lifestyle you designed: time, income, and freedom on your terms?",
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
      "Do you know exactly what you need from this business, financially and personally, and does that drive your decisions?",
    scoringGuide: {
      red: "I've never clearly defined this and I drift",
      amber:
        "I have a rough idea but it doesn't consistently guide what I do",
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
      "Are you actively hitting clear, measurable business goals, not just setting them?",
    scoringGuide: {
      red: "I don't have written goals or I ignore them",
      amber:
        "I have goals but I'm not tracking progress or adjusting course",
      green:
        "I have clear goals with numbers and deadlines and I review progress regularly",
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
      "Does your team know where the business is heading in the next three years and is that vision shaping what they do?",
    scoringGuide: {
      red: "There is no shared direction and work feels disconnected",
      amber:
        "We have a rough picture but it doesn't guide day-to-day decisions",
      green:
        "We have a vivid vision and my team can articulate where we're heading",
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
      "Does your strategic target actually filter what you say yes and no to?",
    scoringGuide: {
      red: "I take on too much because direction is still vague",
      amber:
        "I have a general direction but it's not specific enough to say no",
      green:
        "I have a strategic intent specific enough to guide every major decision",
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
      "Does your company have a mission beyond profit that your team and customers actually feel in how you operate?",
    scoringGuide: {
      red: "The business is just about making money",
      amber:
        "We have a sense of purpose but it's not embedded in how we work",
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
    playbook: "Ideal Customer",
    page: 3,
    questionNumberOnPage: 1,
    question:
      "Do you have a clearly defined ideal customer, and does your marketing and sales focus on winning them?",
    scoringGuide: {
      red: "I'm not clear about who my target customer is",
      amber:
        "I have a general idea but I'm not focused or consistent in who I target",
      green:
        "I have a clear ideal customer based on real results and I know their pain in their own words",
    },
  },
  {
    ref: "2.2",
    level: 2,
    area: "Defined Strategy",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Core Offer",
    page: 3,
    questionNumberOnPage: 2,
    question:
      "Do you have one clear core offer for that customer that wins sales, not just a list of things you could do?",
    scoringGuide: {
      red: "I offer too many things and buyers are confused about what they're getting",
      amber:
        "I have a main offer but it's not sharp or consistently winning work",
      green:
        "I have a clear offer for a clear market and I know why people buy it",
    },
  },
  {
    ref: "3.2",
    level: 3,
    area: "Defined Strategy",
    areaCode: "D",
    pillar: "Clarify Vision",
    playbook: "Business Model",
    page: 3,
    questionNumberOnPage: 3,
    question:
      "Is your business model producing healthy profit, and do you know how you make money on each sale?",
    scoringGuide: {
      red: "I'm busy but I don't know if the model actually works",
      amber:
        "I know roughly how we make money but margins are unclear or inconsistent",
      green:
        "I have a clear business model with defined revenue streams and healthy unit economics",
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
      "Is your growth focused on the right opportunities, and do you know where to invest and where to stop?",
    scoringGuide: {
      red: "I chase whatever comes and spread resources too thin",
      amber: "I have growth ideas but no clear priorities or allocation",
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
      "Are you actively building toward your exit, whether that's selling, succession, or stepping back?",
    scoringGuide: {
      red: "I've never thought about it and the business depends on me",
      amber:
        "I've thought about it but I'm not building toward a concrete outcome",
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
      "Do you consistently finish what you commit to, and does your planning actually turn into completed work?",
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
      "Can you see how work flows through your business, from first contact to delivery to cash, and spot where it breaks?",
    scoringGuide: {
      red: "Work gets stuck and I can't see where or why",
      amber:
        "I understand parts of the flow but bottlenecks still surprise me",
      green:
        "I can trace the full path and I know where to fix delays and handoffs",
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
      "Are your annual, quarterly, and 90-day plans driving real projects with milestones you hit?",
    scoringGuide: {
      red: "I don't plan beyond the next few weeks",
      amber:
        "I have some planning but projects slip or lack clear milestones",
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
      "Do your regular meetings and reviews actually move the business forward, with clear outcomes and accountability?",
    scoringGuide: {
      red: "Meetings are ad hoc or a waste of time",
      amber:
        "We meet but decisions and follow-through are inconsistent",
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
      "Could your business continue and thrive without you, and do you have people and structures in place?",
    scoringGuide: {
      red: "The business depends entirely on me",
      amber:
        "I've started building depth but there's no real continuity plan",
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
      "Do you know whether you can pay your bills over the coming months, and do you review cash often enough to catch problems early?",
    scoringGuide: {
      red: "I check my bank balance and hope for the best",
      amber:
        "I have a rough idea but I don't review cash regularly enough",
      green:
        "I know I can pay my bills, I review cash weekly, and I act before crises hit",
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
      "Are your costs under control, and do you know where money goes and cut waste deliberately?",
    scoringGuide: {
      red: "I don't really know where all my money goes",
      amber: "I've looked at it but not systematically or regularly",
      green:
        "I've audited expenses, eliminated waste, and I review costs regularly",
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
      "Are you making healthy profit on what you sell, and are your prices and margins working?",
    scoringGuide: {
      red: "I guessed my prices or just matched competitors",
      amber:
        "I've thought about pricing but margins aren't consistently healthy",
      green:
        "My pricing is strategic, I know my margins, and profits are healthy",
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
      "Do you deliberately allocate profit for owner pay, tax, reserves, and reinvestment, rather than taking whatever is left?",
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
      "Are you building personal wealth beyond the business, with tax efficiency and assets outside the company?",
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
    playbook: "Customer Acquisition",
    page: 6,
    questionNumberOnPage: 1,
    question:
      "Do you have a reliable, repeatable way to bring in new leads, customers, and/or clients, not just hope they find you?",
    scoringGuide: {
      red: "I rely on word of mouth or hope",
      amber:
        "I do some marketing but it's inconsistent and I don't know what works",
      green:
        "I have at least one proven channel that consistently brings in qualified interest",
    },
  },
  {
    ref: "2.5",
    level: 2,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Sales & Conversion",
    page: 6,
    questionNumberOnPage: 2,
    question:
      "Do you have a repeatable system for acquiring and converting new leads, customers, and/or clients?",
    scoringGuide: {
      red: "It's very tactical or relies on me personally",
      amber:
        "I have a process but conversion is inconsistent or not transferable",
      green:
        "I have a structured, repeatable sales process that converts reliably",
    },
  },
  {
    ref: "3.5",
    level: 3,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Positioning",
    page: 6,
    questionNumberOnPage: 3,
    question:
      "Do customers choose you for a clear reason, not just price or convenience?",
    scoringGuide: {
      red: "We look like everyone else and compete on price",
      amber:
        "We have some differentiation but it's not consistent in the market",
      green:
        "Customers know exactly why we're different and choose us deliberately",
    },
  },
  {
    ref: "4.5",
    level: 4,
    area: "Revenue & Marketing",
    areaCode: "R",
    pillar: "Control Velocity",
    playbook: "Follow-up & Nurture",
    page: 6,
    questionNumberOnPage: 4,
    question:
      "Do you stay in touch with customers and prospects who aren't ready to buy, so interest turns into sales over time?",
    scoringGuide: {
      red: "If they don't buy straight away, I lose them",
      amber:
        "I do some follow-up but it's manual and inconsistent",
      green:
        "I have nurture systems that keep customers and prospects warm until they're ready to buy",
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
      "Is your business visible and credible in your market, and do the right people know who you are and what you stand for?",
    scoringGuide: {
      red: "Hardly anyone knows who we are",
      amber:
        "We have some presence but we're not consistently recognised",
      green:
        "We're known in our market, our message is clear, and prospects recognise us",
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
      "Do you deliver what you promise consistently, with reliable outcomes for customers?",
    scoringGuide: {
      red: "Every job feels like reinventing the wheel",
      amber:
        "Delivery works sometimes but quality and timing vary",
      green:
        "We deliver consistently with a reliable process and predictable results",
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
      "Does your customer experience produce the outcomes you intend, from first contact through to completion?",
    scoringGuide: {
      red: "Customers get an inconsistent or accidental experience",
      amber:
        "Some touchpoints are good but the overall experience isn't reliable",
      green:
        "Every touchpoint is intentional and customers get a consistent great experience",
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
      "Are you keeping customers coming back, and do you know your retention rate and actively reduce churn?",
    scoringGuide: {
      red: "I don't track retention or have systems for it",
      amber: "I do some things but retention isn't systematically managed",
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
      "Are you growing what each customer is worth through upsells, cross-sells, and repeat business?",
    scoringGuide: {
      red: "I focus on new customers, not growing existing ones",
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
      "Are you evolving what you offer in response to customer needs, with new products or services that land?",
    scoringGuide: {
      red: "We've been selling the same thing for years with no evolution",
      amber:
        "We develop new things but it's reactive not strategic",
      green:
        "We have a structured approach and a roadmap for product/service evolution",
    },
  },
  // Page 8: Financials & Metrics (F), Create Value
  {
    ref: "1.7",
    level: 1,
    area: "Financials & Metrics",
    areaCode: "F",
    pillar: "Create Value",
    playbook: "Bookkeeping",
    page: 8,
    questionNumberOnPage: 1,
    question:
      "Are your books clean and up to date, reviewed weekly so you can trust the numbers?",
    scoringGuide: {
      red: "My books are a mess or months behind",
      amber:
        "They're mostly up to date but I don't review them weekly",
      green:
        "My books are clean, current, and I review them weekly to stay on track",
    },
  },
  {
    ref: "2.7",
    level: 2,
    area: "Financials & Metrics",
    areaCode: "F",
    pillar: "Create Value",
    playbook: "Finance Fundamentals",
    page: 8,
    questionNumberOnPage: 2,
    question:
      "Are you using your business numbers to make decisions: P&L, balance sheet, and monthly management accounts?",
    scoringGuide: {
      red: "I leave finance to my accountant and don't use numbers to decide",
      amber:
        "I look at some numbers but they don't consistently drive decisions",
      green:
        "I review P&L, balance sheet, and management accounts monthly and act on what they show",
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
      "Do the KPIs you track actually drive decisions, and are you reviewing the right numbers regularly?",
    scoringGuide: {
      red: "I don't measure what matters or I don't review metrics",
      amber:
        "I track some numbers but they don't consistently change what we do",
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
      "Do your dashboards and reports give you a clear picture of performance, and does your team act on them?",
    scoringGuide: {
      red: "I have no reporting system or I don't use it",
      amber:
        "I have some reports but they're incomplete or inconsistently reviewed",
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
      "Are you actively increasing what your business is worth, and do you know the drivers and manage them?",
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
      "Do your key processes run reliably, so work gets done the same way with consistent outputs?",
    scoringGuide: {
      red: "Work depends on who's doing it and results vary",
      amber:
        "Some processes work but they're inconsistent or only in people's heads",
      green:
        "Key processes run reliably and produce consistent outputs every time",
    },
  },
  {
    ref: "2.8",
    level: 2,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "Systems",
    page: 9,
    questionNumberOnPage: 2,
    question:
      "Are your business systems connected, with marketing, sales, delivery, and finance working together without manual gaps?",
    scoringGuide: {
      red: "Everything is disconnected or manual",
      amber:
        "I have some systems but they're not connected or complete",
      green:
        "I have integrated systems across all key business functions",
    },
  },
  {
    ref: "3.8",
    level: 3,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "Management",
    page: 9,
    questionNumberOnPage: 3,
    question:
      "Does your management system produce accountability, with clear expectations, cadence, and recognition?",
    scoringGuide: {
      red: "I manage people ad hoc with no structure",
      amber:
        "I have some management practices but outcomes are inconsistent",
      green:
        "I have a structured management system with clear practices that my managers follow",
    },
  },
  {
    ref: "4.8",
    level: 4,
    area: "Infrastructure & Systems",
    areaCode: "I",
    pillar: "Create Value",
    playbook: "AI & Automation",
    page: 9,
    questionNumberOnPage: 4,
    question:
      "Are AI and automation removing repetitive work and freeing your team for higher-value output?",
    scoringGuide: {
      red: "We're still doing low-value work manually",
      amber:
        "We use some tools but there's much more we could automate",
      green:
        "We've systematically automated low-value tasks using AI and automation",
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
      "Do you have a continuous improvement process that maps what's not working, innovates, and refines your systems?",
    scoringGuide: {
      red: "Once something is built, I rarely revisit it",
      amber:
        "I improve things when they break but I don't have a formal process",
      green:
        "I map gaps, innovate on systems, and run structured continuous improvement",
    },
  },
  // Page 10: Team & Leadership (T), Create Value
  {
    ref: "1.9",
    level: 1,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Team Output",
    page: 10,
    questionNumberOnPage: 1,
    question:
      "Is your team delivering the outputs you expect, performing at the level you need?",
    scoringGuide: {
      red: "People overlap, drop things, or underperform without clear consequences",
      amber:
        "Most people perform OK but outputs aren't consistently at the level I want",
      green:
        "Everyone delivers clear outputs and performs at the level the business needs",
    },
  },
  {
    ref: "2.9",
    level: 2,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Team Performance",
    page: 10,
    questionNumberOnPage: 2,
    question:
      "Are you getting the best from your team, with training, accountability, feedback, and reviews that change performance?",
    scoringGuide: {
      red: "I don't have formal performance management that improves results",
      amber: "I do some of this but performance doesn't consistently improve",
      green:
        "Regular reviews, accountability, and feedback actively improve team performance",
    },
  },
  {
    ref: "3.9",
    level: 3,
    area: "Team & Leadership",
    areaCode: "T",
    pillar: "Create Value",
    playbook: "Recruitment",
    page: 10,
    questionNumberOnPage: 3,
    question:
      "Are you hiring the right people reliably, with a process that produces good hires and onboarding?",
    scoringGuide: {
      red: "I hire reactively and often get the wrong fit",
      amber:
        "I have some process but hiring outcomes are inconsistent",
      green:
        "I have a repeatable recruitment process that consistently brings in the right people",
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
      "Are leaders in your business running parts of the operation without needing you?",
    scoringGuide: {
      red: "No one else can lead without me",
      amber:
        "I have capable people but they still depend on me for key decisions",
      green:
        "I'm developing leaders who make decisions and run things independently",
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
      "Does your culture produce the behaviours you want, with values lived daily, not just on the wall?",
    scoringGuide: {
      red: "Culture is accidental and behaviours vary wildly",
      amber:
        "We have values but they're not consistently enforced or embedded",
      green:
        "Culture is a system with defined values, expected behaviours, and recognition",
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
