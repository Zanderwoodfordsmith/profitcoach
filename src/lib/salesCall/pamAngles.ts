/**
 * Pam's five worked examples from her workshop ("Turning the Profit System
 * Into a No-Brainer Pitch", Oct 2026), word for word apart from: "we" for
 * "we would", "you" where she says "the owner" (the coach is talking to the
 * owner), em dashes out, and Step 8 widened from Innovation and Management to
 * Infrastructure and Systems by adding processes, systems and automation to
 * her text. Her outcome line closes Bringing it together. The three phases
 * for each angle are ours, not Pam's: the shared phasedPitch with this
 * angle's own lines. angles.test.ts keeps the shape and the house rules.
 */

import type { PitchAngle } from "./angles";
import { phasedPitch, togetherLine } from "./script";

export const PAM_ANGLES: PitchAngle[] = [
  {
    id: "customers",
    title: "More customers",
    line: "I need more customers",
    steps: [
      "First, we identify exactly why new customer acquisition is currently inconsistent. We look at where the blockage is, whether that's your target market, your offer, your message, lead generation, follow-up or conversion. That gives us a clear starting point, so we're not just doing more marketing and hoping it works.",
      "Next, we build the longer-term growth strategy around the customers you actually want to win. We get clear on which markets and customers offer the best opportunity, what they value, why they should choose you, and what level of customer acquisition is needed to hit your growth goals. That gives you a clear route to growth, rather than relying on ad hoc opportunities.",
      "Then we turn that strategy into a focused 90-day plan. We decide exactly which customer-acquisition activities need to happen, who's responsible and how we'll measure progress. That means you're consistently doing the right things to generate new customers, rather than dipping in and out of marketing when things go quiet.",
      "Then we make sure the customers you're winning are actually profitable. We look at acquisition cost, margin, customer value and cash impact, so we know which customers are worth pursuing and which channels can be scaled profitably. That stops you growing turnover without growing profit.",
      "This is where we build the actual engine for attracting and converting more customers. We strengthen your targeting, messaging, lead generation, sales process, follow-up, conversion and repeat business. The aim is to create a more predictable flow of opportunities, and turn more of those opportunities into paying customers.",
      "Then we make sure the business can handle the extra customers properly. We strengthen the customer journey, delivery systems, capacity and processes, so growth doesn't create delays, mistakes or poor service. That means you can confidently bring in more customers without creating chaos behind the scenes.",
      "Then we put the right measures in place. We track the critical drivers behind customer growth, such as leads, conversion, acquisition cost, average customer value, pipeline and repeat business. That means you can see exactly what's producing customers and where improvement is needed.",
      "Then we make sure customer acquisition keeps improving. We put your follow-up and pipeline on proper systems and automate what we can. We review what's working, test new approaches, improve your offer and marketing, and make sure somebody is actually managing the process. That stops growth activity becoming stale or inconsistent.",
      "Finally, we make sure new customer acquisition doesn't depend entirely on you. We clarify who owns marketing, follow-up, sales, pipeline management and customer retention. That creates a business where winning customers becomes a team capability, rather than something that only happens when you personally drive it.",
    ],
    together: togetherLine("The result is a more predictable, profitable and scalable way of winning new customers."),
    ...phasedPitch({
      looksLike: "Right now new customers come in fits and starts.",
      find: "where customers are really being lost, whether that's the leads, the follow-up or the offer",
      quickWins: "often following up people who've already shown interest, because that's the quickest money there is",
      scoreboard: "Leads, conversions and what each customer is worth",
      change: "more of the right customers start coming in, and you can see exactly where they come from",
      check: "Can you see how that would bring in more of the right customers?",
      keep: "And we make sure your team owns the marketing and the follow-up, and that delivery keeps up with the extra work.",
      lasts: "a team that keeps the work coming in",
    }),
  },
  {
    id: "off-tools",
    title: "Off the tools",
    line: "I need to get off the tools",
    steps: [
      "First, we identify exactly where the business depends too heavily on you. We look at the tasks, decisions, customer issues and operational problems that keep dragging you back into the day-to-day. That gives us clarity on what needs to be removed from your plate first.",
      "Next, we define what your role should look like in the future. We build the business around a structure where you spend less time on the tools and more time leading, managing and growing. That means we're not just trying to delegate random jobs. We're deliberately redesigning your role.",
      "Then we create a 90-day transition plan. We identify which responsibilities can be handed over, which systems need to be built and which people need developing first. That gives you a practical route off the tools, rather than simply hoping the team starts taking more responsibility.",
      "Then we make sure the business can financially support that transition. We look at the real value of your time, the cost of keeping you tied up in delivery, and whether the margins and cash flow can support stronger team capacity. That helps move you from low-value operational work into higher-value owner activity.",
      "Then we make sure your time is redirected into growth. Instead of spending all week delivering the work, you have capacity to focus on winning better customers, strengthening relationships and building the future pipeline. That means stepping off the tools contributes directly to growth, rather than simply giving you more free time.",
      "This is where we systemise the way work gets done. We create clear processes, handovers, standards and job ownership, so work can continue without constantly needing your knowledge or intervention. That's one of the biggest keys to reducing owner dependence.",
      "Then we give you visibility without needing to physically be everywhere. We track the numbers that show whether jobs are on track, whether margins are healthy and where something needs attention. That means you can manage the business through information, rather than constantly checking everything yourself.",
      "Then we build stronger management capability and the systems behind it. We put the processes and tools in so work runs the same way every time, and develop people who can make decisions, solve problems and manage performance without automatically escalating everything to you. That gives you another layer between you and the daily operation.",
      "Finally, we build a team that takes ownership. We clarify roles, decision-making, accountability and leadership, so people know what they're responsible for and what good performance looks like. That means the business becomes less dependent on you, and more dependent on clear structure and capable people.",
    ],
    together: togetherLine("The result is less time on the tools, and more time leading, growing and owning the business."),
    ...phasedPitch({
      looksLike: "Right now too much still runs through you.",
      find: "exactly what still needs you: the jobs, the decisions and the fires",
      quickWins: "often jobs someone else could take on straight away with a clear process",
      scoreboard: "A handful of numbers",
      change: "hours start coming back to you, week by week, without things slipping",
      check: "Can you see how that would take some of the load off you?",
      keep: "And we shape the roles and help your managers grow into them, so the business runs on structure instead of on you.",
      lasts: "roles that don't need you in every job",
    }),
  },
  {
    id: "profit",
    title: "More profit",
    line: "We're busy but there's not enough profit",
    steps: [
      "First, we identify where profit is leaking. We look at which customers, products, jobs or activities are genuinely profitable, and which ones are consuming time and resources without producing enough return. That gives us clarity on where the biggest profit opportunities sit.",
      "Next, we build the longer-term strategy around profitable growth, rather than turnover for the sake of turnover. We decide which customers, markets, products and services the business should focus on to improve margin and profitability. That helps you grow in the right direction.",
      "Then we turn that into a 90-day profit improvement plan. We prioritise the actions most likely to improve pricing, margin, efficiency, cost control and revenue quality. That means profit improvement becomes a deliberate process, rather than something you hope will happen at year end.",
      "This is where we directly improve the financial engine. We look at margins, pricing, cash flow, costs, overheads and working capital. The aim is to make sure more of the money coming into the business actually turns into profit and cash.",
      "Then we improve the quality of the revenue. We focus on attracting more profitable customers, selling higher-value work, improving pricing, increasing average sale and generating more repeat business. That means revenue growth actually improves the bottom line.",
      "Then we improve operational efficiency. We reduce waste, rework, delays, poor handovers, unnecessary overtime and inefficient delivery. That helps protect the margin on every piece of work.",
      "Then we put the right profit drivers in place. We track the numbers that show exactly where profit is being won and lost. That could include gross margin, labour efficiency, cost per job, conversion, average sale and productivity. That gives you early visibility, rather than waiting for the accounts to tell you what went wrong.",
      "Then we look at how the business can improve what it sells and how it runs. We put better systems and ways of working in, automate what we can, review new offers and cost-saving ideas, and build stronger management disciplines. That helps the business continuously improve profitability, rather than relying on one-off fixes.",
      "Finally, we make sure the team understands its impact on profit. We create clearer accountability around margin, waste, productivity, customer value and cost control. That means profitability becomes everybody's responsibility, not just yours.",
    ],
    together: togetherLine("The result is more profit from the work, customers and resources the business already has."),
    ...phasedPitch({
      looksLike: "Right now you're working flat out, but not enough of it turns into profit.",
      find: "exactly where the money leaks, whether that's pricing, certain customers or time lost on jobs",
      quickWins: "often pricing, costs and cash, because that's money you've already earned",
      scoreboard: "Margin, cost per job and cash",
      change: "more of what you earn starts to stay in the business",
      check: "Can you see how that would start to lift your profit?",
      keep: "And we get your team protecting the margin too, so it isn't just you watching every pound.",
      lasts: "a team that protects the margin",
    }),
  },
  {
    id: "systems",
    title: "Better systems",
    line: "We need better systems",
    steps: [
      "First, we identify where lack of systems is causing the biggest problems. We look at where work gets stuck, where mistakes happen, where information is lost, and where you or key people are constantly being dragged in. That shows us which systems will make the biggest difference first.",
      "Next, we design the systems around the business you're trying to build. We don't just document the current way of working. We decide what the future business needs to look like, and what processes are required to support that.",
      "Then we turn system-building into a 90-day implementation plan. We prioritise the most important systems and assign clear ownership for creating, testing and embedding them. That stops systems becoming a project that everybody knows is needed but nobody gets around to.",
      "Then we look at where weak systems are costing money. Poor processes often create waste, duplication, errors, rework, overtime and missed billing. By improving those systems, we directly improve profit and cash.",
      "Then we create repeatable systems for attracting, following up and converting customers. That means new business is no longer dependent on memory, random activity or you personally chasing every opportunity.",
      "This is where we build the core operating systems. We standardise how work moves through the business, how handovers happen, how quality is maintained and how customers are served. That creates consistency and reduces dependence on individual people.",
      "Then we put measures around the systems. We track whether the processes are working and where performance is slipping. That means the systems aren't just documented. They're managed.",
      "Then we create a process for continuously improving the systems. We automate what we can, and make managers responsible for reviewing what's working, fixing what isn't and updating processes as the business changes. That keeps the systems useful, rather than letting them become outdated.",
      "Finally, we make sure people actually follow and own the systems. We clarify responsibilities, standards, accountability and leadership expectations. That means the systems become part of how the business operates, not just documents sitting in a folder.",
    ],
    together: togetherLine("The result is a business that runs consistently, because the systems are clear, measurable and owned by the team."),
    ...phasedPitch({
      looksLike: "Right now too much lives in people's heads, and too often in yours.",
      find: "where missing systems cost you most: the mistakes, the handovers and the interruptions",
      quickWins: "often the handovers and the work that never gets billed",
      scoreboard: "A handful of numbers",
      change: "the systems actually go in, and fewer things land back on you",
      check: "Can you see how that would stop things landing back on you?",
      keep: "And we get your managers reviewing the systems and your team owning them, so nothing depends on you remembering it.",
      lasts: "a team that owns the systems",
    }),
  },
  {
    id: "team",
    title: "Team stepping up",
    line: "My team doesn't step up",
    steps: [
      "First, we identify where the team is currently falling short, and why. We look at whether the issue is unclear roles, weak standards, poor communication, lack of training, weak management, or you stepping in too quickly. That gives us clarity on what needs fixing, rather than just blaming the team.",
      "Next, we define the team structure the business actually needs. We clarify what roles, responsibilities and management capability are required as the business grows. That gives the team a clear structure to grow into.",
      "Then we create a 90-day people plan. We identify which responsibilities need transferring, who needs developing and what expectations need tightening up first. That means improvement happens systematically, rather than through occasional conversations.",
      "Then we connect team performance to financial performance. We look at how poor accountability, mistakes, low productivity or overdependence on you are affecting profit and cash. That makes the commercial impact of team performance visible.",
      "Then we make sure the team understands its role in winning and retaining customers. Whether they're in sales, delivery or customer service, their performance affects revenue and customer value. That means growth becomes a team responsibility, rather than only your job.",
      "Then we give people clear processes and standards to work within. If roles and workflows are vague, people will constantly ask you what to do. Clear systems give the team the confidence and structure to take more ownership.",
      "Then we define what good performance looks like. We give people clear measures and targets, so accountability becomes objective rather than based on opinion. That makes performance conversations much easier and more constructive.",
      "Then we strengthen management and the systems behind it. We make sure managers are actually managing: reviewing performance, coaching people, solving problems and improving the way the business works, with the tools to do it. That reduces the number of issues that come straight back to you.",
      "Finally, we build the culture of accountability. We clarify expectations, decision-making, leadership behaviours and ownership. That means people stop waiting to be told what to do, and start taking responsibility for results.",
    ],
    together: togetherLine("The result is a stronger, more capable team that takes ownership, and lets you lead rather than constantly manage every detail."),
    ...phasedPitch({
      looksLike: "Right now too much lands back on you, because the team isn't taking ownership.",
      find: "what's really holding the team back, whether that's roles, standards, training or how often you step in",
      quickWins: "often making clear who owns what",
      scoreboard: "A handful of numbers the team owns",
      change: "people start owning their work, and fewer things come back to you",
      check: "Can you see how that would get the team taking more on?",
      keep: "And I help your managers learn to coach, solve problems and review the work, so fewer issues reach you.",
      lasts: "managers who handle more without you",
    }),
  },
];
