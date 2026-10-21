/**
 * Pam's five worked examples from her workshop ("Turning the Profit System
 * Into a No-Brainer Pitch", Oct 2026), word for word apart from: "we" for
 * "we would", "you" where she says "the owner" (the coach is talking to the
 * owner), em dashes out, and Step 8 widened from Innovation and Management to
 * Infrastructure and Systems by adding processes, systems and automation to
 * her text. Her outcome line closes Bringing it together. The three phases for each angle are ours (Alex's
 * structure), not Pam's. angles.test.ts keeps the shape and the house rules.
 */

import type { PitchAngle } from "./angles";
import { togetherLine } from "./script";

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
    bridge: "So, {name}, you want help with {problem}. Right now new customers come in fits and starts, and you want to get to {result}. Here's what we'll do. There are three phases: we get clear, we fix what matters, then we make it last. Three things stay with you, because only you can do them. Turn up and be honest about what's really going on. Make the decisions. And do what we agree, or get it done through your team. My job is to make sure you always know the next move, and that it happens.",
    phases: [
      { text: "In the first month we meet every week. You said the work comes in fits and starts, so we score the business across every area and find where customers are really being lost. It might be the leads, the follow-up or the offer. We agree who you want to win and how many, then build a 90-day plan: what, who, when, and how we'll know. Which means you stop guessing and know your first move towards {result}.", check: "Does that make sense so far?" },
      { text: "In months two and three we work the plan, starting with the gaps where customers slip away. Quick wins first, often following up people who have already shown interest. We set up a weekly scoreboard of leads, conversions and value that your team fills in and you read in under a minute. Every session asks what got done, what's stuck and what's next. Which means more of the right work starts coming in, not another list of ideas.", check: "Can you see how that would bring in more of the right customers?" },
      { text: "From month four we meet twice a month. Every 90 days we score the business again, see what's moved, and set the next plan. We make sure the team owns the marketing and follow-up, and that delivery keeps up. Which means winning customers becomes predictable, and it doesn't depend on you chasing every lead.", check: "Want me to show you how it all fits together?" },
    ],
    recap: "So, in the first month we find where customers are being lost and you have a 90-day plan. In months two and three we fix what matters, starting with {problem}. From month four we make it last, with a new plan every 90 days and a team that keeps the work coming in. Your part is to be honest, make the decisions, and do what we agree. My job is to make sure you always know the next move. That's how we get you to {result}.",
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
    bridge: "So, {name}, you want help with {problem}. Too much still runs through you, and you want to get to {result}. Here's what we'll do. There are three phases: we get clear, we fix what matters, then we make it last. Three things stay with you, because only you can do them. Turn up and be honest about what's really going on. Make the decisions. And do what we agree, or get it done through your team. My job is to make sure you always know the next move, and that it happens.",
    phases: [
      { text: "In the first month we meet every week. You said everything comes back to you, so we score the business across every area and list exactly what still needs you: the jobs, the decisions, the fires. We agree what your role should become, then build a 90-day handover plan: what moves, to whom, when, and how we'll know. Which means you know the first thing to let go of.", check: "Does that make sense so far?" },
      { text: "In months two and three we work the plan, starting with the jobs that eat most of your time. Quick wins first, often things someone else could do straight away with a clear process. We set up a weekly scoreboard your team fills in, so you can see how things are going in under a minute without checking up. Every session asks what got done, what's stuck and what's next. Which means hours start coming back to you, not another list of ideas.", check: "Can you see how that would take some of the load off you?" },
      { text: "From month four we meet twice a month. Every 90 days we score the business again, see what's moved, and set the next plan. We build the roles, the managers and the systems, so the business runs on structure rather than on you. Which means you're leading the business, not stuck in it.", check: "Want me to show you how it all fits together?" },
    ],
    recap: "So, in the first month we find what still depends on you and you have a 90-day handover plan. In months two and three we fix what matters, starting with {problem}. From month four we make it last, with a new plan every 90 days and roles that don't need you in every job. Your part is to be honest, make the decisions, and do what we agree. My job is to make sure you always know the next move. That's how we get you to {result}.",
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
    bridge: "So, {name}, you want help with {problem}. You're working flat out, but not enough of it turns into profit, and you want to get to {result}. Here's what we'll do. There are three phases: we get clear, we fix what matters, then we make it last. Three things stay with you, because only you can do them. Turn up and be honest about what's really going on. Make the decisions. And do what we agree, or get it done through your team. My job is to make sure you always know the next move, and that it happens.",
    phases: [
      { text: "In the first month we meet every week. You said the business is busy but the profit isn't there, so we score the business across every area and find exactly where the money leaks. It might be pricing, certain customers, or time lost on jobs. We agree what profitable growth looks like for you, then build a 90-day plan: what, who, when, and how we'll know. Which means you stop guessing and know your first move towards {result}.", check: "Does that make sense so far?" },
      { text: "In months two and three we work the plan, starting with the biggest leaks. Quick wins first, often pricing, costs and cash. We set up a weekly scoreboard of a few numbers like margin and cost per job, which your team fills in and you read in under a minute. Every session asks what got done, what's stuck and what's next. Which means more of what you earn starts to stay in the business, not another list of ideas.", check: "Can you see how that would start to lift your profit?" },
      { text: "From month four we meet twice a month. Every 90 days we score the business again, see what's moved, and set the next plan. We work on the numbers, the systems and the team, so everyone helps protect the margin, not just you. Which means the extra profit sticks, rather than leaking away again.", check: "Want me to show you how it all fits together?" },
    ],
    recap: "So, in the first month we find where the profit leaks and you have a 90-day plan. In months two and three we fix what matters, starting with {problem}. From month four we make it last, with a new plan every 90 days and a team that protects the margin. Your part is to be honest, make the decisions, and do what we agree. My job is to make sure you always know the next move. That's how we get you to {result}.",
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
    bridge: "So, {name}, you want help with {problem}. Too much lives in people's heads, and too often in yours, and you want to get to {result}. Here's what we'll do. There are three phases: we get clear, we fix what matters, then we make it last. Three things stay with you, because only you can do them. Turn up and be honest about what's really going on. Make the decisions. And do what we agree, or get it done through your team. My job is to make sure you always know the next move, and that it happens.",
    phases: [
      { text: "In the first month we meet every week. You said things get stuck and come back to you, so we score the business across every area and find where missing systems cost you most. We agree what the business needs to run like, then build a 90-day plan: which systems first, who owns each one, when, and how we'll know. Which means you stop guessing and know your first move towards {result}.", check: "Does that make sense so far?" },
      { text: "In months two and three we work the plan, starting with the gaps that cause the most mistakes and interruptions. Quick wins first, often the handovers and the work that never gets billed. We set up a weekly scoreboard your team fills in, so you can see in under a minute whether the new ways of working are holding. Every session asks what got done, what's stuck and what's next. Which means the systems actually go in, not another list of ideas.", check: "Can you see how that would stop things landing back on you?" },
      { text: "From month four we meet twice a month. Every 90 days we score the business again, see what's moved, and set the next plan. We get your managers reviewing and updating the systems, and the team owning them, so the business doesn't depend on you remembering everything. Which means the business runs the same way every time, even when you're not there.", check: "Want me to show you how it all fits together?" },
    ],
    recap: "So, in the first month we find where missing systems hurt most and you have a 90-day plan. In months two and three we fix what matters, starting with {problem}. From month four we make it last, with a new plan every 90 days and a team that owns the systems. Your part is to be honest, make the decisions, and do what we agree. My job is to make sure you always know the next move. That's how we get you to {result}.",
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
    bridge: "So, {name}, you want help with {problem}. Too much still lands back on you because the team isn't taking ownership, and you want to get to {result}. Here's what we'll do. There are three phases: we get clear, we fix what matters, then we make it last. Three things stay with you, because only you can do them. Turn up and be honest about what's really going on. Make the decisions. And do what we agree, or get it done through your team. My job is to make sure you always know the next move, and that it happens.",
    phases: [
      { text: "In the first month we meet every week. You said the team won't step up, so we score the business across every area and find what's really holding them back. It might be roles, standards, training, or how often you step in. We agree the structure the business needs, then build a 90-day people plan: what moves, to whom, when, and how we'll know. Which means you stop guessing and know your first move towards {result}.", check: "Does that make sense so far?" },
      { text: "In months two and three we work the plan, starting with the roles and standards that cause the most confusion. Quick wins first, often making clear who owns what. We set up a weekly scoreboard the team fills in themselves, so you can read in under a minute whether they're delivering. Every session asks what got done, what's stuck and what's next. Which means people start owning their work, not another list of ideas.", check: "Can you see how that would get the team taking more on?" },
      { text: "From month four we meet twice a month. Every 90 days we score the business again, see what's moved, and set the next plan. We develop your managers to coach, solve and review, so fewer issues reach you and the business doesn't depend on you for everything. Which means you lead and the team owns the work.", check: "Want me to show you how it all fits together?" },
    ],
    recap: "So, in the first month we find what's holding the team back and you have a 90-day people plan. In months two and three we fix what matters, starting with {problem}. From month four we make it last, with a new plan every 90 days and managers who handle more without you. Your part is to be honest, make the decisions, and do what we agree. My job is to make sure you always know the next move. That's how we get you to {result}.",
  },
];
