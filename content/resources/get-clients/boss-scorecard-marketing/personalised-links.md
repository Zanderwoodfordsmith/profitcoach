*You can now s**end the BOSS Score and BOSS Pro Score straight from your CRM.*

In your platform you have two assessment links that are yours to use. Both are tied to your own coach URL slug, so every score and lead that comes through them lands with you, not in a shared pool. And because they pull your contact's details in automatically, you can send them personalised from inside your CRM. No copying, no manual typing, no asking people to fill in fields they have already given you.

### Quick 1 min setup

In order to use this you MUST update your Coach Slug custom value field in the crm by copying it from the community platform.

**Step 1:** [Click here](https://theprofitcoach.com/coach/settings?tab=funnel) and copy your coach slug

![](/resources/img/boss-marketing/send-personalised-links-with-crm-kix-ba6wipn1mll9.png)

**Step 2: Log in to your crm and in the bottom left click settings then Custom values and** Copy that slug from step 1 into the empty Coach Slug url Custom value field.

![](/resources/img/boss-marketing/send-personalised-links-with-crm-kix-6gyj48iw9ubk.png)

![](/resources/img/boss-marketing/send-personalised-links-with-crm-kix-wgjsk2lmlsky.png)

 

![](/resources/img/boss-marketing/send-personalised-links-with-crm-kix-5kpq7cq7hstb.png)

### There are two ways you can use these.

1. **Hyperlinks** - Just copy and paste the links into emails as raw links or better as hyperlinks (so highlight text and copy these as links)
2. **Triggerlinks** - These are links that have already been added to your account. So when sending a mass email or a single email or text  you can just select the trigger link icon and select either Boss Score Assessment, or Boss Pro Assessment.

![](/resources/img/boss-marketing/send-personalised-links-with-crm-kix-c5e2ujvqgc7l.png)

## The two links

**1. BOSS Score** — the standard diagnostic. This is your everyday assessment. Use it for new leads, nurture sequences, and anyone you want to start a conversation with about how their business is really running.

https://www.theprofitcoach.com/assessment/{{custom_values.coach_url_slug }}?first_name={{contact.first_name}}&last_name={{contact.last_name}}&email={{contact.email}}&business={{business.name}}

**2. BOSS Pro Score** — the deeper version. Use this for further along the pipeline or people who are already a client. Ideally you run through theBoss Pro with prospects you don’t have them do this assessment on their own.

https://www.theprofitcoach.com/assessment-pro/{{custom_values.coach_url_slug }}?first_name={{contact.first_name}}&last_name={{contact.last_name}}&email={{contact.email}}&business={{business.name}}

The only difference between the two links is /assessment/ versus /assessment-pro/. Everything after that stays the same.

## How the personalisation works

The bits inside the curly brackets are merge fields. When you drop a link into an email, SMS, or workflow in your CRM, your system swaps them for the real contact's information before it sends. So your contact never sees the brackets — they see a link that already knows who they are.

- coach_url_slug — your unique coach identifier, so the result is attributed to you.
- first_name and last_name — their name, carried into the assessment.
- email — so their score is tied back to the right person.
- business.name — their company, so the experience feels tailored from the first click.
Because those fields are pre-filled, your contact lands on the assessment with most of the work already done. Less friction means more people actually finish it — which means more scores, more conversations, and more pipeline for you.

## How to use them

- Hyperlink text or Paste the relevant link into any email, text, or automated workflow in your CRM.
- Use the BOSS Score for general outreach and the BOSS Pro Score for sales/ new clients.
- Keep the merge fields exactly as written — the brackets and spelling have to match what your CRM expects, or the personalisation will not fire.
- Send it, and let the personalisation do the work.

**Quick tip:** send yourself a test first. Run the link through your own CRM to one of your own contact records and check that the name, email, and business all carry through correctly before you send it out widely.

**Pam’s Email Example:**

Hi {{firstName}},

I’ve created a free BOSS Scorecard for business owners who want more profit, better team performance and better control of the business.

It only takes around 3 minutes to complete, and once you’ve finished, you’ll get an instant score out of 100 plus a personalised report highlighting the key areas to focus on.

The report is designed to show:

- where profit may be leaking
- where the business may be over-relying on you
- what could be slowing growth down
- where team, systems or processes could work better
- what to prioritise first to create more control and better results
Most business owners are already good at what they do. The challenge is often that the business has grown through hard work, reputation and graft, but the structure, team and systems haven’t always kept pace.

That’s where the BOSS Scorecard is useful.

It gives you a quick snapshot of what’s working well, what could work even better, and where your attention could make the biggest difference.

Once you receive your report, you’ll also have the option to book a 30-minute deeper dive review if you’d like to go through the results properly.

You can complete the free BOSS Scorecard here:

[https://www.theprofitcoach.com/score/](https://www.theprofitcoach.com/assessment/{{ custom_values.coach_url_slug }}?first_name={{contact.first_name}}&last_name={{contact.last_name}}&email={{contact.email}}&business={{business.name}})add-your-slug-url-here

It’s quick, practical and will give you some useful insight straight away.

Best wishes, Pam
