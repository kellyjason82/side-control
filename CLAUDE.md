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
- **Coach view** (tabs: Diary, Money, Notes, Students, Times, Settings): set open times, see bookings, confirm/cancel, set each student's rate, mark paid (Cash or Revolut), log techniques covered, tap a student to see their card, and set late-cancel rules in Settings.
- **Student view, called "Next Stripe"**: see the coach's open slots, book one, "Oss" (confirm) or "Tap out" (cancel), see their price up front, see their own private lessons completed and hours, and see their own technique log of what was covered in each private.

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
2. A booked slot disappears for everyone else, and a last-second check stops two people taking the same slot. In this demo that works between tabs on one device; across different phones it needs the shared server (Planned). The coach gets an in-app notification instead of another WhatsApp.
3. The day before, the student gets a "Tomorrow" reminder with one-tap Oss (confirm) or Tap out (cancel), and the coach can also send a WhatsApp reminder. A tap-out inside 24 hours is flagged "Late cancel" automatically, with the coach's late-cancel fee applied if they've switched it on.
4. The price is shown before booking, using the rate the coach has set for that student, and it is locked to the booking (changing the student's rate later doesn't change existing bookings).
5. After the session ends, it shows as unpaid until the coach marks it paid as Cash or Revolut. Unpaid sessions stand out, with a running "owed to you" total.
6. After the session, the coach logs techniques covered in under a minute (quick-pick chips plus free text), and the student sees it in their Next Stripe log.

## Rules must work by themselves
- All flags (Tomorrow, Late cancel, Unpaid, Needs notes, Needs a nudge, Pay upfront required, past slots hidden) and all fees and student stats are calculated from dates and times relative to NOW, never typed in.
- Sample data is generated RELATIVE TO TODAY on first load (e.g. "yesterday at 18:00", "tomorrow at 12:00") so the demo always looks live whenever it's opened.
- Save everything in localStorage. Wrap every read/write in try/catch, and the page must still work if storage is blocked.
- Provide a visible "Reset sample data" button. Reset restores everything, including notifications and coach settings, and brings back the "Try this" hint strip.
- No double booking (found in testing): before saving any booking or confirmation, re-read the saved data and check the slot is still free (every tap in the demo re-reads first). If it's gone, don't book: show "Sorry, that slot was just taken" with the next free times. A later duplicate booking loses the slot when it tries to confirm. A "storage" event listener refreshes other open tabs on the same device. Different browsers or phones can't see each other until the shared server (Planned).
- The saved data has a version number (`DATA_VERSION` in `app.js`). Bump it when the saved shape changes, so old saved data is replaced by fresh sample data.

## Oss / Tap out (student view)
- The student's confirm button is "Oss" (confirm) and cancel is "Tap out" (cancel).
- In Next Stripe, a "Tomorrow" session appears at the top as an in-app reminder card: "Your private is tomorrow at [time], [price]." with Oss and Tap out buttons, labelled small: "In the full app this arrives as a push notification (Planned)."
- Next Stripe shows the student's own private lessons completed and hours. Never their late-cancel count or "Needs a nudge" flag.

## Coach settings (Settings tab, saved in localStorage)
- Late-cancel fee: Off / Flagged students only / Everyone. Default: Flagged students only.
- Fee amount: % of the session price, default 75%.
- Late-cancel window: hours before the start, default 24.
- "Needs a nudge" threshold: late cancels in the last 90 days, default 2.
- Pay upfront for "Needs a nudge" students: on/off, default on.

## Late cancels, fees and "Needs a nudge" (all calculated, never typed in)
- A student's tap-out inside the window is flagged "Late cancel". The window is locked to the booking when it's cancelled.
- If the fee setting applies to that student, a late-cancel fee (rounded to the euro) is created automatically, e.g. "Late-cancel fee: Conor, Wed 12:00, €60", added to "owed to you", and marked paid as Cash or Revolut like any session. The fee is locked when the cancellation happens: changing settings later never changes it.
- On "Flagged students only", the tap-out that reaches the threshold carries the fee (so the 2nd late cancel with the default threshold of 2).
- Coach cancellations are flagged late if inside the window but never create a fee and never count towards "Needs a nudge".
- Before a student taps out inside the window, if a fee applies, show it honestly: "Tapping out now means a late-cancel fee of €60. Still tap out?"
- "Needs a nudge": the student's late cancels in the last 90 days reach the threshold. Coach view only, never shown to the student.
- For flagged students, the Coach view shows a "Send an extra reminder on WhatsApp" prompt on their upcoming sessions (on a Tomorrow session, a "don't skip this reminder" line above the normal reminder instead), and if "Pay upfront" is on, their bookings show "Pay upfront required". Actually taking the payment is Planned.

## Student cards (Coach view, Students tab)
- Tap a student's name to open their card: private lessons completed, total hours, late cancels (last 90 days), amount owed (sessions plus fees), and a "Needs a nudge" badge if flagged. All counted from the bookings data.

## WhatsApp (started by the coach only)
- Use click-to-chat links: `https://wa.me/?text=...` with URL-encoded text and NO phone number, so the coach picks the contact in WhatsApp. Never store or show phone numbers. Open in a new tab.
- Coach view, on any "Tomorrow" session: button "Send reminder on WhatsApp". Message: "Hi [first name], reminder of your private tomorrow ([day]) at [time]. [price], as agreed. Reply Oss to confirm 👊"
- Coach view, near the open times: button "Share my open times on WhatsApp". The message lists the open slots for the next 7 days, built from the live data, ready to paste into the club group.
- Under each button, a small line: "Opens WhatsApp with the message written. You press send."
- Students never send WhatsApps from the app.

## In-app notifications (coach)
- Bell icon in the Coach view header with an unread count badge.
- Every student booking, confirmation and cancellation creates a notification (e.g. "New booking: Aoife, Sat 10:00, €80", "Late cancel: Conor, Wed 12:00"), newest first, saved in localStorage.
- Opening the list marks them all as read.
- Seed data includes 2 or 3 unread sample notifications so the bell isn't empty on first load.

## Sample data (MADE UP, visibly labelled "Sample data")
- An invented coach (e.g. "Coach Dara Quinn, black belt") at an invented academy, labelled as sample data. No real people, clubs, affiliations or brands anywhere.
- The demo keeps a visible "Sample data" label at the top.
- At least 6 sample students with invented names and a belt each.
- At least 10 bookings covering: past and paid (with notes), past and unpaid, past needing notes, one late cancel, tomorrow unconfirmed, and upcoming.
- Standard rate EUR 80 per one-hour private, with one or two students on a different sample rate. All prices labelled as sample figures.
- One loyal student with 10+ completed private lessons (Aoife: 11).
- One student with 2 late cancels in the last 90 days, so they're flagged "Needs a nudge" on first load, with one of those late cancels carrying an unpaid fee (Conor: €60).
- Coach availability as weekly windows (e.g. Mon and Wed 12:00 to 14:00, Tue and Thu 19:00 to 21:00, Sat 10:00 to 13:00), split into 60-minute slots.

## Landing page sections (in this order: think, build, sell, reflect)
1. **Hero:** one clear promise, a primary call to action (coach waiting list) and a "Try the demo" button that jumps to `#demo`. A small line: "Concept product. Demo runs on invented sample data."
2. **The problem:** who it's for (buyer vs user told apart) and the invented, labelled quotes.
3. **How coaches cope today**, and two real alternatives with links and "checked 27 Oct 2026":
   - Gymdesk (https://docs.gymdesk.com/en/help/docs/add-on-sessions): full gym-management software. It can run privates as bookable sessions with per-instructor calendars and packs, but inside the club's account, set up by the club.
   - BJJNote (https://apps.apple.com/us/app/bjjnote-bjj-training-journal/id6746068256): a student training journal that logs private lessons and each instructor's techniques, but the student types it all themselves and there is no booking.
   - Our view (label it "Our view"): one covers booking, the other covers notes; nothing we found joins the two from the coach's phone.
4. **The solution in three steps:** Coach shares open times; Student taps a slot and sees the price; After the session: paid and notes logged. Under the steps: "Built for one thumb, between classes: big buttons, one screen per job, nothing to install. Bookings land in the app, not in another WhatsApp chat." Then a "How students get in" block: "You share your booking link (on WhatsApp, or in the club group). Students open it on their phone: no app to install, no account to create. They pick their name the first time." with "Sign-in by a one-tap link sent to the student" marked Planned. The "Share my open times" WhatsApp message ends with the booking link (this page at `#demo`).
5. **Requirements table:** exactly the six requirements above: requirement, how Side Control meets it, "In the demo" or "Planned". Planned extras live under "Coming later", not in this table. Lead line: "Each requirement below is shown in the demo. Where part of it depends on something we haven't built yet, the row says so."
6. **The demo (`#demo`)** with a dismissible "Try this" hint strip at the top ("New here? Try this: 1. As Aoife, book a slot. 2. Flip to Coach and open the bell. 3. Mark a session paid and log what you covered."; dismissal remembered on the device), a Coach / Next Stripe toggle, and a student picker for the student view labelled "Demo only: in the full app, the student's link opens straight to their own view. (Planned)"
7. **"We tested it":** filled in from real testing, brief and scannable: who tried it (a club owner who teaches private lessons, another coach, two students at the same time), what they tried, what broke (a double booking), what confused them, what we changed, and what was asked for and is now Planned. No tester names, no club names, no praise or testimonial-style quotes. Links to notes.html#testing.
8. **How it's paid for:** ASSUMPTION, clearly labelled. EUR 9 per month per coach, first month free. Reasoning: "One late-cancel fee at the sample setting of 75% (€60) covers more than six months. One avoided no-show at the sample rate of €80 covers about nine." "Coming later" (Planned): a shared server so bookings sync across every phone in real time, sign-in by a one-tap link sent to the student, shared private lessons for 2 or 3 students (requested by a coach in testing who currently coaches two students together), a Revolut payment link, automatic WhatsApp reminders that send themselves (needs WhatsApp Business), push notifications to the coach's phone, push notifications to students with Oss / Tap out on the lock screen, taking upfront payment in the app, loyalty rewards (for example a discount on every 10th private), uploading videos directly, a guided walkthrough, a Brazilian Portuguese version (requested in testing), tax and accountant reports, a club-wide plan. Remove anything from this list once it's built.
8b. **Your data** (right before the waiting list): "This demo" (In the demo): "Everything you do here is saved only on this device. Nothing is sent anywhere. Reset sample data wipes it." "When it launches" (Planned): the coach owns their students' data and Side Control stores it for them; EU servers; only what's needed (name, a contact, belt, rate, bookings, payment status, technique notes); no card details, because payment happens outside the app; a prompt reminding coaches not to record injuries or medical details in notes; inactive students deleted after 2 years unless the coach keeps records for tax; a privacy notice for students and a data processing agreement for coaches. Plus: "Not legal advice: we'll have this reviewed before launch."
9. **Waiting list form** for coaches (name, email, academy). It must NOT send data anywhere: on submit it only shows a thank-you message.
10. **Footer:** "Side Control is a concept product in development. The coach, academy, students, prices and bookings shown are invented sample data. Gymdesk, BJJNote, WhatsApp and Revolut are named for comparison or description only and are not affiliated with Side Control." The footer links to "Behind the build" (`notes.html`).

## Honesty rules
- Never add wording that says or implies this is a student, school or class project.
- Every claim must be true of the demo or labelled "Planned".
- No testimonials, ratings, customer counts or statistics presented as real.
- No real brands or logos, except naming Gymdesk and BJJNote as text in the alternatives section, and WhatsApp and Revolut as plain text where the product works with them (no logos). The footer says all four are not affiliated.
- No real personal data.

## Design
- Phone-first, one-handed use: tap targets at least 44px, readable 16px+ text, no horizontal scrolling.
- Clean and trustworthy: dark charcoal and off-white, with a BLACK BELT palette: black, the red bar (`--red`, the one brand accent) and white stripes. The red bar and white stripes are the brand motif (the small belt bar before each section eyebrow, list bullets). The logo mark is a black belt with the red bar and two white stripes on an OFF-WHITE ROUNDED CHIP (about 50 x 28px), so it reads on the dark header and footer; a bare black belt disappears on dark backgrounds (found on a real iPhone). No decorative belt strips on card edges. No blue belt in the BRAND anywhere (changed after a coach in testing called the blue-belt colour "a bit insulting" for an app aimed at black belt coaches). Consistent spacing and a Google Font pairing.
- Status colours are never the brand red: teal (`--ok`) for Tomorrow, confirmed, saved and "In the demo"; amber (`--warn`) for Late cancel, Unpaid, Needs notes and Needs a nudge. Every status has a text label AND an icon (`tag()` in `app.js` adds it), never colour alone, and all text passes WCAG AA contrast.
- Voice: coach-to-coach, plain, direct, a little BJJ flavour, never cheesy.
- Avoid using the word "privates" in a way that reads as a double meaning (prefer "private lessons" / "a private" where it could be misread).

## Browser safety (phones, iPhone Safari)
- Cache-busting: the CSS and JS links in `index.html` carry a version string (`styles.css?v=N`, `app.js?v=N`). Bump N on EVERY change to either file, so phones don't keep the old version.
- The demo shows "Page vN · Demo vN" under its disclaimer: "Page" is typed in `index.html`, "Demo" comes from `APP_VERSION` in `app.js`. Keep both equal to the `?v=N` number (and `notes.html`'s `styles.css?v=N`), so anyone can check their phone has the latest version.
- Never parse date strings like "2026-10-28 12:00". Build dates with `new Date(year, monthIndex, day, hour, minute)`, store times as millisecond numbers, or use full ISO strings with a "T".
- Avoid browser features older iPhone Safari lacks: no `?.`, `??`, regex lookbehind, `Array.prototype.at`, `replaceAll`, `structuredClone`, `CSS.escape`. Use `-webkit-` prefixes where Safari needs them (e.g. `backdrop-filter`).
- Every localStorage read/write stays inside try/catch.
- Keep the safety net: if the demo fails to start, the demo panel shows "The demo hit an error: [message]" instead of a blank space.

## Working rules (from the parent AI Projects CLAUDE.md)
- Repo: `kellyjason82/side-control`, public, served on GitHub Pages from `main` at `/`.
- Commit after each meaningful step with a plain-English message, then `git push`. Commit before any big or risky change.
- Never commit passwords, API keys or personal details.
- Explain each Git/GitHub step in one short line. Windows + PowerShell; quote paths (they contain spaces).

## Build log (private, outside the repo)
- The build log lives at `../build-log.md`, one level ABOVE this repo. It is private notes.
- Never copy it into `side-control`, never commit it, never link to it from the page. `build-log.md` is in `.gitignore` as a backstop.
- After EVERY change, append a dated entry to `../build-log.md` under the right day heading (e.g. `## Tuesday 27 October 2026`; add a new day heading if needed). Each entry says: what changed, why, who asked for it (Jay, Claude chat or Claude Code), and test results (what was tested and how; say plainly if something wasn't tested).
- Day entries go above the closing sections. Keep these sections at the end of the log, in this order: "Phone test notes", "Prompts that mattered", "Build timeline", "Honesty check".
- The only public version will be a polished "Behind the build" page made later, with private details removed. Don't build it until asked.

## Belt badges (student ranks)
- Next to each belt name, a small belt badge shows the student's REAL belt colour (white, blue, purple, brown, black), with the black rank bar (red on a black belt). This is rank data, not the brand: Aoife and Tomás stay blue belts. The brand itself never uses blue.

## Packs of 10 or 20 sessions (requested by a club owner in testing)
- The coach sells a pack from the student's card in the Students tab. Pack prices are set in Settings (sample: 10 for €720, 20 for €1,360). The price is locked to the pack when it's sold. The coach marks the pack paid as Cash or Revolut; an unpaid pack counts in "owed to you".
- A booking for a student with free pack sessions uses one from the pack (oldest pack first) instead of creating an amount owed. Before booking it says "1 session from your pack (X left)", where X is the sessions still free to book.
- Sessions left count down automatically when a pack session ends. A late cancel that would carry a fee uses one pack session instead of charging money.
- At 2 left or fewer, "2 sessions left in pack" (or 1) shows on the coach's student card, the Students list and in the student's Next Stripe view. At 0 ("Pack used up"), bookings go back to the student's normal rate.
- Seed: Tomás has a paid 10-pack with 8 used, so 2 are left on first load.

## Homework and a video link in the notes (requested by a club owner in testing)
- When logging notes, the coach can add "Practise this" (free text) and one optional video link (http/https only). Nothing is uploaded: the link opens in a new tab. Both show under that session in the student's Next Stripe log.
- Seed: 3 or 4 past sessions have homework; sample video links point to example.com and are labelled "Sample link".

## Monthly money summary (Money tab, requested by a club owner in testing)
- "This month" with arrows to step back through earlier months. All counted from the data:
  - Taken: session payments, pack payments and paid fees, by the day they were marked paid, split Cash and Revolut.
  - Late-cancel fees recovered: fees marked paid that month.
  - Lost to cancellations: student late cancels with no fee charged (and no pack session used), by session date.
  - Still owed: unpaid sessions, fees and packs dated that month.
- "Download CSV" saves that month's records and totals to the device (Blob download). Nothing is sent anywhere. Cells starting with = + - @ are made safe for spreadsheets.

## Behind the build page (notes.html)
- A separate public page, same design as the main page (shares `styles.css`), readable at 375px, linked from the main footer as "Behind the build".
- Sections: How it was built ("Prompts were drafted with Claude in a separate chat, then run and refined in Claude Code."), Key decisions (what changed, why, who drove it: Me, Claude chat or Claude Code, marking where AI suggestions were overruled), What testing found, Prompts that mattered (6 to 8, with time, trimmed excerpt and what it led to), Build timeline, Honesty check.
- Built from the private build log with everything private stripped: no college, course or assignment; no real academy, instructor or tester names; no file paths; no personal details. Excerpts from the Claude Code session logs are trimmed, with [brackets] for privacy edits.
- Keep the timeline (finish time, prompt and commit counts) and the honesty check up to date when the main page changes.

## Honesty audit labels
- Every claim on index.html is one of: true of the demo, labelled Planned, or labelled Assumption. "Who it's for" and "How coaches cope today" carry an Assumption label. Alternatives are sourced and dated; quotes are labelled invented.

## Find-ability (from the founder's iPhone test)
- Packs: a "Packs" block at the top of the coach's Diary lists every student with a pack in use, with the low-sessions warning and a "Card" button to their student card. Also on the student card (Students tab) and in that student's Next Stripe view (Tomás in the sample data).
- Money tab: the "This month" summary is at the very top, with Download CSV under it, then "Owed to you, all time".
- The "Try this" hint strip includes: "4. In Next Stripe, pick Tomás: his pack has 2 sessions left." and "5. In Coach › Money, see this month's takings and download a CSV."
