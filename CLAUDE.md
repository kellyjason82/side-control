# Side Control: project brief

Every session working in this folder must follow this brief. If a change would break one of the rules below, stop and ask first. Treat this as a real pre-launch product page for a concept product.

## What this is
ONE public landing page on GitHub Pages for Side Control, a concept product, with a WORKING DEMO BUILT INTO THE PAGE (a `#demo` section, reachable in one tap from a "Try the demo" button in the hero). The page must make clear that Side Control is a concept product and the demo runs on invented sample data.

- Plain HTML, CSS and vanilla JavaScript only: no frameworks, no build step, no backend, no external APIs.
- Files: `index.html`, `styles.css`, `app.js` (split further only if it helps).
- Phone first (design at 375px wide), and it must also look good on a laptop.

## Product
- Name: **Side Control**
- Positioning line: "Your side hustle, under control."
- Secondary line: "Book privates without the back-and-forth."

A private-lesson book for BJJ coaches. Two views in the demo:
- **Coach view**: set open times, see bookings, confirm/cancel, set each student's rate, mark paid (Cash or Revolut), log techniques covered.
- **Student view, called "Next Stripe"**: see the coach's open slots, book one, confirm the day before, see their price up front, and see their own technique log of what was covered in each private.

## Segment (who the page speaks to)
- **Who:** Black and brown belt coaches in Ireland who teach paid one-to-one privates on their club's mats as their own side business (part-owners, or coaches on someone else's timetable).
- **Pays and decides:** the coach, from their own pocket. It's their tool, not the club's.
- **Uses it daily:** the coach, and their private students (mostly adults fitting training around a job).
- **Not the buyer:** the club owner (a club-wide version is "planned").
- **Pitch angle:** independence. "Your privates are your business: your diary, your rates, your students' notes, in your pocket, not in the club's system." Never frame it as hiding income from the club.

## The problem
Quotes are INVENTED and must be labelled "Illustrative quotes, invented".
- Student: "Every time I ask for a private it turns into 'when suits you?' / 'whenever suits you' for two days."
- Student: "I thought it was one price, he said another, and then there's that awkward moment at the end of the session."
- Student: "Three days later I can't remember the sweep we drilled."
- Coach: "My privates live in twenty WhatsApp chats I can't search."

How they cope today: the coach posts a reminder in the club WhatsApp group; students DM or ask after class; times ping-pong back and forth; occasionally a check-in text the day before; the price is agreed verbally and paid in cash or Revolut after; students rely on memory or a phone note for what was covered.

## Requirements
Each must be visibly met in the demo or honestly marked "Planned".
1. The student sees the coach's real open slots for the next 7 days and books one in 3 taps or fewer, with no messaging.
2. A booked slot disappears for everyone else, so there's no double booking.
3. The day before, a session is flagged "Tomorrow" with a one-tap confirm. A cancellation less than 24 hours before the start is flagged "Late cancel" automatically.
4. The price is shown before booking, using the rate the coach has set for that student, and it is locked to the booking (changing the student's rate later doesn't change existing bookings).
5. After the session ends, it shows as unpaid until the coach marks it paid as Cash or Revolut. Unpaid sessions stand out, with a running "owed to you" total.
6. After the session, the coach logs techniques covered in under a minute (quick-pick chips plus free text), and the student sees it in their Next Stripe log.

## Rules must work by themselves
- All flags (Tomorrow, Late cancel, Unpaid, Needs notes, past slots hidden) are calculated from dates and times relative to NOW, never typed in.
- Sample data is generated RELATIVE TO TODAY on first load (e.g. "yesterday at 18:00", "tomorrow at 12:00") so the demo always looks live whenever it's opened.
- Save everything in localStorage. Wrap every read/write in try/catch, and the page must still work if storage is blocked.
- Provide a visible "Reset sample data" button.

## Sample data (MADE UP, visibly labelled "Sample data")
- An invented coach (e.g. "Coach Dara Quinn, black belt") at an invented academy, labelled as sample data. No real people, clubs, affiliations or brands anywhere.
- The demo keeps a visible "Sample data" label at the top.
- At least 6 sample students with invented names and a belt each.
- At least 10 bookings covering: past and paid (with notes), past and unpaid, past needing notes, one late cancel, tomorrow unconfirmed, and upcoming.
- Standard rate EUR 80 per one-hour private, with one or two students on a different sample rate. All prices labelled as sample figures.
- Coach availability as weekly windows (e.g. Mon and Wed 12:00 to 14:00, Tue and Thu 19:00 to 21:00, Sat 10:00 to 13:00), split into 60-minute slots.

## Landing page sections (in this order: think, build, sell, reflect)
1. **Hero:** one clear promise, a primary call to action (coach waiting list) and a "Try the demo" button that jumps to `#demo`. A small line: "Concept product. Demo runs on invented sample data."
2. **The problem:** who it's for (buyer vs user told apart) and the invented, labelled quotes.
3. **How coaches cope today**, and two real alternatives with links and "checked 27 Oct 2026":
   - Gymdesk (https://docs.gymdesk.com/en/help/docs/add-on-sessions): full gym-management software. It can run privates as bookable sessions with per-instructor calendars and packs, but inside the club's account, set up by the club.
   - BJJNote (https://apps.apple.com/us/app/bjjnote-bjj-training-journal/id6746068256): a student training journal that logs private lessons and each instructor's techniques, but the student types it all themselves and there is no booking.
   - Our view (label it "Our view"): one covers booking, the other covers notes; nothing we found joins the two from the coach's phone.
4. **The solution in three steps:** Coach shares open times; Student taps a slot and sees the price; After the session: paid and notes logged.
5. **Requirements table:** requirement, how Side Control meets it, "In the demo" or "Planned".
6. **The demo (`#demo`)** with a Coach / Next Stripe toggle and a student picker for the student view.
7. **"We tested it":** a placeholder block to fill in later (who tried it, what they tried, what broke or confused them, what we changed).
8. **How it's paid for:** ASSUMPTION, clearly labelled. EUR 9 per month per coach, first month free. Reasoning: one avoided no-show or one forgotten payment (EUR 80) covers about nine months. Planned: semi-private sessions for 2 or 3 people at a lower per-head rate, a Revolut payment link, text reminders, a club-wide plan.
9. **Waiting list form** for coaches (name, email, academy). It must NOT send data anywhere: on submit it only shows a thank-you message.
10. **Footer:** "Side Control is a concept product in development. The coach, academy, students, prices and bookings shown are invented sample data. Gymdesk and BJJNote are named for comparison only and are not affiliated with Side Control." Plus "Built with AI (Claude)".

## Honesty rules
- Never add wording that says or implies this is a student, school or class project.
- Every claim must be true of the demo or labelled "Planned".
- No testimonials, ratings, customer counts or statistics presented as real.
- No real brands or logos except naming Gymdesk and BJJNote as text in the alternatives section.
- No real personal data.

## Design
- Phone-first, one-handed use: tap targets at least 44px, readable 16px+ text, no horizontal scrolling.
- Clean and trustworthy: dark charcoal and off-white, with one accent colour (a belt blue), consistent spacing, and a Google Font pairing.
- Voice: coach-to-coach, plain, direct, a little BJJ flavour, never cheesy.
- Avoid using the word "privates" in a way that reads as a double meaning (prefer "private lessons" / "a private" where it could be misread).

## Working rules (from the parent AI Projects CLAUDE.md)
- Repo: `kellyjason82/side-control`, public, served on GitHub Pages from `main` at `/`.
- Commit after each meaningful step with a plain-English message, then `git push`. Commit before any big or risky change.
- Never commit passwords, API keys or personal details.
- Explain each Git/GitHub step in one short line. Windows + PowerShell; quote paths (they contain spaces).
