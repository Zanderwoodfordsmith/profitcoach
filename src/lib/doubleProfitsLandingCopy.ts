export type DoubleProfitsTestimonial = {
  quote: string;
  body: string;
  author: string;
  authorUrl?: string;
};

export type DoubleProfitsLandingCopy = {
  eyebrow: string;
  headline: string;
  intro: string;
  sessionPitch: string;
  benefits: string[];
  whyHeading: string;
  whyLead: string;
  whyBody: string;
  audienceLabel: string;
  audienceHeading: string;
  audienceBullets: string[];
  meetLabel: string;
  meetHeading: string;
  bioParagraphs: string[];
  testimonial: DoubleProfitsTestimonial;
  ctaLabel: string;
};

export const PAM_DOUBLE_PROFITS_FALLBACK_AVATAR =
  "https://assets.cdn.filesafe.space/c3cmUrbBhdgs54adfIYP/media/666136581848ae65069c5b9f.jpeg";

export const PAM_CALENDAR_EMBED_CODE =
  '<iframe src="https://link.procoachplatform.com/widget/booking/YBxvoiQH6HcHjHYrOWkU" style="width: 100%;border:none;overflow: hidden;" scrolling="no" id="8gGuCLQODMv5nY2iZQB9_1779293123369"></iframe><br><script src="https://link.procoachplatform.com/js/form_embed.js" type="text/javascript"></script>';

export function getDoubleProfitsLandingCopy(
  coachName = "Pam Woodford"
): DoubleProfitsLandingCopy {
  return {
    eyebrow: "Double your Profits within 6 months",
    headline:
      "Double your profit - without more hours, hires, hassle or spend.",
    intro:
      'Are you working flat out but still wondering, "Where\'s the profit?" You\'re not alone and you don\'t need to work harder to fix it. You need clarity, strategy, and a proven path to increase net profit… fast.',
    sessionPitch: `That's what this FREE 30-minute session on How to Double Your Profits within 6 Months delivers with ${coachName}, Global #1 Business Profit Coach.`,
    benefits: [
      "Uncover hidden profit already sitting in your business.",
      "Learn the 5 simple levers to increase net profit by +61 %",
      "Get one powerful, personalised move to increase profit instantly - no extra hours, hires, or spend.",
      "Walk away with a laser-focused How to Double Your Profits within 6 Months. A strategy plan tailored for you.",
    ],
    whyHeading: "Why This Call Is Different?",
    whyLead:
      "This isn't theory. It's a fast, practical, high-impact session with one goal: Get you more cash with less effort - now!",
    whyBody:
      "Just 30 minutes of straight-talking, no-nonsense strategy from someone who's helped thousands of business owners double their profits and claw back 10-15 hours a week and build businesses that can work without them.",
    audienceLabel: "WHO IS THIS FOR?",
    audienceHeading: "Entrepreneurs and Driven Business Owners:",
    audienceBullets: [
      "Who feel overwhelmed, strapped for time, and stuck daily firefighting.",
      "Who are working hard but not seeing matching profits.",
      "Who have a business that is reliant on them for every decision so need systems & Improved team capabilities to be able to grow.",
      "Who want to double profit within 6 months and regain 10-15 hours per week immediately.",
    ],
    meetLabel: `MEET ${coachName.split(" ")[0] ?? coachName}`,
    meetHeading:
      "Global Award Winning Profit Coach, with 45 Years Business Experience",
    bioParagraphs: [
      "After overcoming a life-threatening spinal infection in 2000, she rebuilt her business, sold it and retired at the age of 46. But retirement didn't stick. She returned with even more purpose, co-founding the Business Coach Academy with her son, Zander Woodford-Smith, and guiding over 250 coaches globally to deliver real results.",
      "Clients describe Pam as straight-talking yet caring, with a focus on profit, high-performing teams, and practical systems that create real freedom. She's walked the path herself and brings both strategic clarity and genuine empathy to every session.",
      "Her mission? To guide business owners from chaos to control so that business and life are fun again. Because financial freedom & time freedom aren't just possible… they're the point!",
    ],
    testimonial: {
      quote: "The session we had fundamentally changed the way I do business",
      body: "I believe that Pam is the best coach I have ever, ever had. She's professional and insightful and the sessions that we've had fundamentally changed the way I do business; specifically I can point to huge amounts of profit in my various companies that Pam and only Pam recognised. I could absolutely recommend you arrange a coaching session with Pam.",
      author: "John Davy",
      authorUrl: "https://www.johndavy.co.uk/",
    },
    ctaLabel: "Yes! Claim My Free Place Now",
  };
}
