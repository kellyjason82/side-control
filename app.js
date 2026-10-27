/* Side Control: page behaviour and the built-in demo.
   Plain JavaScript, no libraries. Every flag is worked out from the current time,
   and everything is saved in this browser only (localStorage). Nothing is sent anywhere. */

(() => {
  "use strict";

  // ---------- Constants ----------
  const STORE_KEY = "sidecontrol.data.v1";
  const UI_KEY = "sidecontrol.ui.v1";
  const MIN = 60 * 1000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const SESSION = HOUR; // every private lesson is 60 minutes
  const DATA_VERSION = 2; // bump when the saved shape changes, so old data is replaced by fresh sample data

  // Coach settings, and what "Reset sample data" puts back
  const DEFAULT_SETTINGS = { feeMode: "flagged", feePct: 75, windowHours: 24, nudgeThreshold: 2, payUpfront: true };
  const FEE_MODES = [
    { id: "off", label: "Off" },
    { id: "flagged", label: "Flagged students only" },
    { id: "everyone", label: "Everyone" }
  ];
  const NUDGE_DAYS = 90;

  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first

  const TECHNIQUES = [
    "Knee cut pass", "Toreando pass", "Guard retention", "Scissor sweep", "Hip bump sweep",
    "Half guard sweep", "Armbar from guard", "Triangle", "Kimura", "Cross collar choke",
    "Side control escape", "Mount escape", "Back take", "Rear naked choke", "Single leg"
  ];

  // ---------- Storage (every read and write is wrapped) ----------
  let storageOK = true;

  function readJSON(key) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      storageOK = false;
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      storageOK = false;
      return false;
    }
  }

  // ---------- Time helpers ----------
  const now = () => Date.now();

  function dayStart(t) {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // A time relative to today, e.g. at(-1, 18) = yesterday at 18:00
  function at(offsetDays, hour) {
    const d = dayStart(now());
    d.setDate(d.getDate() + offsetDays);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  }

  // Calendar days between today and t (0 = today, 1 = tomorrow, -1 = yesterday)
  const daysFromToday = (t) => Math.round((dayStart(t) - dayStart(now())) / DAY);

  const pad = (n) => (n < 10 ? "0" : "") + n;
  const fmtTime = (t) => { const d = new Date(t); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const fmtDate = (t) => { const d = new Date(t); return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const shortSlot = (t) => `${DAY_SHORT[new Date(t).getDay()]} ${fmtTime(t)}`;
  const money = (n) => "€" + n;

  function dayLabel(t) {
    const o = daysFromToday(t);
    if (o === 0) return "Today";
    if (o === 1) return "Tomorrow";
    if (o === -1) return "Yesterday";
    return fmtDate(t);
  }

  const whenLabel = (t) => `${dayLabel(t)}, ${fmtTime(t)}–${fmtTime(t + SESSION)}`;

  function ago(t) {
    const diff = now() - t;
    if (diff < HOUR) return Math.max(1, Math.round(diff / MIN)) + " min ago";
    if (daysFromToday(t) === 0) return Math.round(diff / HOUR) + " h ago";
    return `${dayLabel(t)}, ${fmtTime(t)}`;
  }

  // ---------- Rules: all worked out from NOW, never typed in ----------
  const endOf = (b) => b.start + SESSION;
  const isBooked = (b) => b.status === "booked";
  const isUpcoming = (b) => isBooked(b) && b.start > now();
  const isInProgress = (b) => isBooked(b) && b.start <= now() && endOf(b) > now();
  const isEnded = (b) => isBooked(b) && endOf(b) <= now();
  const isTomorrow = (b) => isUpcoming(b) && daysFromToday(b.start) === 1;
  // The late-cancel window is locked to the booking when it's cancelled, so changing the setting later
  // doesn't re-flag old cancellations.
  const windowOf = (b) => (b.lateWindow != null ? b.lateWindow : 24) * HOUR;
  const isLateCancel = (b) => b.status === "cancelled" && b.cancelledAt != null && b.start - b.cancelledAt < windowOf(b);
  const isUnpaid = (b) => isEnded(b) && !b.paid;
  const isFeeUnpaid = (b) => !!b.fee && !b.fee.paid;
  const needsNotes = (b) => isEnded(b) && !b.notes;
  const byStart = (a, b) => a.start - b.start;
  const byStartDesc = (a, b) => b.start - a.start;

  // Every 60-minute slot inside the weekly windows, from day `fromDay` to `toDay` (0 = today).
  // Past slots are dropped automatically.
  function windowSlots(availability, fromDay, toDay) {
    const out = [];
    for (let d = fromDay; d <= toDay; d++) {
      const base = dayStart(now());
      base.setDate(base.getDate() + d);
      availability
        .filter((w) => w.day === base.getDay())
        .forEach((w) => {
          for (let h = w.start; h < w.end; h++) {
            // Built from numbers (year, month, day, hour), never from a date string
            out.push(new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, 0, 0, 0).getTime());
          }
        });
    }
    return out.filter((t) => t > now()).sort((a, b) => a - b);
  }

  // ---------- Sample data, generated relative to today ----------
  function makeSeed() {
    const students = [
      { id: "s1", name: "Aoife Brennan", belt: "Blue belt", rate: 80 },
      { id: "s2", name: "Conor Doyle", belt: "White belt", rate: 80 },
      { id: "s3", name: "Niamh Kavanagh", belt: "Purple belt", rate: 70 },
      { id: "s4", name: "Tomás Ruane", belt: "Blue belt", rate: 80 },
      { id: "s5", name: "Sinéad Lowry", belt: "White belt", rate: 80 },
      { id: "s6", name: "Rory Gilligan", belt: "Brown belt", rate: 90 },
      { id: "s7", name: "Eoin Fahy", belt: "Purple belt", rate: 80 }
    ];
    const availability = [
      { day: 1, start: 12, end: 14 }, // Mon
      { day: 3, start: 12, end: 14 }, // Wed
      { day: 2, start: 19, end: 21 }, // Tue
      { day: 4, start: 19, end: 21 }, // Thu
      { day: 6, start: 10, end: 13 }  // Sat
    ];
    const rateOf = (id) => students.find((s) => s.id === id).rate;
    const bookings = [];
    let n = 0;

    function add(studentId, start, extra) {
      const b = Object.assign({
        id: "b" + (++n), studentId, start, price: rateOf(studentId),
        status: "booked", confirmed: false, cancelledAt: null, cancelledBy: null,
        paid: null, paidAt: null, notes: null, createdAt: start - 3 * DAY
      }, extra);
      bookings.push(b);
      return b;
    }
    const notes = (techniques, text, start) => ({ techniques, text, at: start + 2 * HOUR });
    let t;

    // Loyal student: Aoife has a long run of paid sessions (with these and the two below, 11 completed)
    const loyal = [
      [-75, ["Guard retention"], "Knees and elbows connected. Frame, then hip out."],
      [-68, ["Scissor sweep"], "Grip the collar deep before you chop the legs."],
      [-61, ["Armbar from guard"], "Pinch the knees. Hips up before you fall back."],
      [-54, ["Triangle"], "Cut the angle first. Pull the head down, then lock."],
      [-47, ["Half guard sweep"], "Get the underhook or get flat. Nothing in between."],
      [-40, ["Kimura"], "Hand to wrist, then climb the hips over."],
      [-33, ["Cross collar choke"], "First grip deep, palm up. Second grip palm down."],
      [-26, ["Toreando pass"], "Push the knees to the mat, step wide, don't chase."],
      [-19, ["Back take", "Rear naked choke"], "Seatbelt first, hooks second. Chest glued to the back."]
    ];
    loyal.forEach((l, i) => {
      t = at(l[0], 10);
      add("s1", t, { confirmed: true, paid: i % 2 ? "Cash" : "Revolut", paidAt: t + HOUR, notes: notes(l[1], l[2], t) });
    });

    // Past and paid, with notes
    t = at(-12, 12);
    add("s1", t, { confirmed: true, paid: "Revolut", paidAt: t + HOUR, notes: notes(["Knee cut pass", "Guard retention"], "Win the underhook before you cut. 3 x 10 each side.", t) });
    t = at(-9, 19);
    add("s4", t, { confirmed: true, paid: "Cash", paidAt: t + HOUR, notes: notes(["Side control escape", "Mount escape"], "Frame on the hip first, then shrimp. Stop pushing the chest.", t) });
    t = at(-7, 10);
    add("s3", t, { confirmed: true, paid: "Revolut", paidAt: t + HOUR, notes: notes(["Back take", "Rear naked choke"], "Seatbelt before hooks. Hide the choking hand.", t) });

    // Past and unpaid, notes logged
    t = at(-5, 19);
    add("s2", t, { confirmed: true, notes: notes(["Scissor sweep", "Hip bump sweep"], "If they post, hip bump. If they sit back, scissor.", t) });

    // Past, unpaid, needs notes
    t = at(-3, 12);
    add("s5", t, { confirmed: true });

    // Past, paid, needs notes
    t = at(-2, 19);
    add("s1", t, { confirmed: true, paid: "Cash", paidAt: t + HOUR });

    // "Needs a nudge": Conor has 2 late cancels in the last 90 days.
    // The first one came before he was flagged, so no fee (setting: flagged students only).
    t = at(-34, 19);
    add("s2", t, { status: "cancelled", cancelledAt: t - 6 * HOUR, cancelledBy: "student", lateWindow: 24, createdAt: t - 5 * DAY });
    // The second one reached the threshold, so it carries a late-cancel fee (75% of €80), still unpaid
    t = at(-1, 19);
    const late = add("s2", t, {
      status: "cancelled", cancelledAt: t - 10 * HOUR, cancelledBy: "student", lateWindow: 24, createdAt: t - 4 * DAY,
      fee: { amount: 60, pct: 75, paid: null, paidAt: null }
    });

    // An ordinary cancellation, well ahead of time: not late, no fee
    t = at(-6, 12);
    add("s6", t, { status: "cancelled", cancelledAt: t - 3 * DAY, cancelledBy: "student", lateWindow: 24, createdAt: t - 6 * DAY });

    // Past, unpaid, needs notes
    t = at(-1, 12);
    add("s7", t, { confirmed: true });

    // Tomorrow, not confirmed yet
    const tomorrowStart = windowSlots(availability, 1, 1)[0] || at(1, 18);
    const tmr = add("s2", tomorrowStart, { createdAt: now() - 4 * DAY });

    // Upcoming, in real open-time slots (so they block those slots)
    const later = windowSlots(availability, 2, 6);
    const up1 = add("s3", later[0], { createdAt: now() - 26 * HOUR });
    add("s4", later[2], { createdAt: now() - 3 * DAY });
    const up3 = add("s1", later[4], { createdAt: now() - 2 * HOUR });

    const notifications = [
      { id: "n1", text: `New booking: Aoife, ${shortSlot(up3.start)}, ${money(up3.price)}`, at: up3.createdAt, read: false },
      { id: "n2", text: `New booking: Niamh, ${shortSlot(up1.start)}, ${money(up1.price)}`, at: up1.createdAt, read: false },
      { id: "n3", text: `Late-cancel fee: Conor, ${shortSlot(late.start)}, ${money(late.fee.amount)}`, at: late.cancelledAt, read: false },
      { id: "n4", text: `New booking: Conor, ${shortSlot(tmr.start)}, ${money(tmr.price)}`, at: tmr.createdAt, read: true }
    ];

    return {
      version: DATA_VERSION,
      seededAt: now(),
      coach: { name: "Dara Quinn", belt: "Black belt", academy: "Slate Lane Academy" },
      standardRate: 80,
      settings: Object.assign({}, DEFAULT_SETTINGS),
      students, availability, bookings, notifications
    };
  }

  // ---------- Load / save ----------
  const isValid = (s) => s && s.version === DATA_VERSION && s.coach && s.settings &&
    ["students", "bookings", "availability", "notifications"].every((k) => Array.isArray(s[k]));

  let state = readJSON(STORE_KEY);
  if (!isValid(state)) state = makeSeed();
  state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings);
  const save = () => writeJSON(STORE_KEY, state);
  save();

  // ---------- Lookups ----------
  const student = (id) => state.students.find((s) => s.id === id);
  const booking = (id) => state.bookings.find((b) => b.id === id);
  const first = (s) => s.name.split(" ")[0];
  const coachFirst = () => state.coach.name.split(" ")[0];
  const isTaken = (t) => state.bookings.some((b) => isBooked(b) && b.start === t);
  const openSlots = () => windowSlots(state.availability, 0, 6).filter((t) => !isTaken(t));
  const unpaid = () => state.bookings.filter(isUnpaid);
  const unpaidFees = () => state.bookings.filter(isFeeUnpaid);
  const owedFor = (list) => list.reduce((sum, b) => sum + (isUnpaid(b) ? b.price : 0) + (isFeeUnpaid(b) ? b.fee.amount : 0), 0);
  const owedTotal = () => owedFor(state.bookings);
  const owedBy = (sid) => owedFor(state.bookings.filter((b) => b.studentId === sid));
  const completedBy = (sid) => state.bookings.filter((b) => b.studentId === sid && isEnded(b)).length;
  const hoursBy = (sid) => completedBy(sid) * (SESSION / HOUR);

  // Late cancels by the student in the last 90 days (coach cancellations never count against a student)
  const lateCancelsBy = (sid) => state.bookings.filter((b) => b.studentId === sid && b.cancelledBy === "student" &&
    isLateCancel(b) && b.cancelledAt > now() - NUDGE_DAYS * DAY).length;
  // "Needs a nudge" is worked out from the bookings every time. Coach view only.
  const needsNudge = (sid) => lateCancelsBy(sid) >= state.settings.nudgeThreshold;
  const payUpfrontFor = (sid) => state.settings.payUpfront && needsNudge(sid);
  const insideWindow = (b) => b.start - now() < state.settings.windowHours * HOUR;

  // The fee a student would owe if they tapped out of this booking right now (0 = no fee).
  // On "Flagged students only", the tap-out that reaches the threshold counts.
  function feeIfTapOut(b) {
    const st = state.settings;
    if (!isUpcoming(b) || !insideWindow(b) || st.feeMode === "off") return 0;
    if (st.feeMode === "flagged" && lateCancelsBy(b.studentId) + 1 < st.nudgeThreshold) return 0;
    return Math.round(b.price * st.feePct / 100);
  }
  const unreadCount = () => state.notifications.filter((n) => !n.read).length;
  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function groupByDay(times) {
    const groups = [];
    times.forEach((t) => {
      const key = dayStart(t).getTime();
      const last = groups[groups.length - 1];
      if (last && last.key === key) last.slots.push(t);
      else groups.push({ key, slots: [t] });
    });
    return groups;
  }

  // ---------- Actions ----------
  function notify(text) {
    state.notifications.push({ id: uid("n"), text, at: now(), read: false });
  }

  function bookSlot(studentId, start) {
    const s = student(studentId);
    if (!s || !openSlots().includes(start)) return null; // gone, past or not an open time
    const b = {
      id: uid("b"), studentId, start, price: s.rate, // price locked to the booking
      status: "booked", confirmed: false, cancelledAt: null, cancelledBy: null,
      paid: null, paidAt: null, notes: null, createdAt: now()
    };
    state.bookings.push(b);
    notify(`New booking: ${first(s)}, ${shortSlot(start)}, ${money(b.price)}`);
    save();
    return b;
  }

  function confirmBooking(id, by) {
    const b = booking(id);
    if (!b || !isUpcoming(b) || b.confirmed) return null;
    b.confirmed = true;
    b.confirmedBy = by;
    if (by === "student") notify(`Confirmed: ${first(student(b.studentId))}, ${shortSlot(b.start)}`);
    save();
    return b;
  }

  function cancelBooking(id, by) {
    const b = booking(id);
    if (!b || !isUpcoming(b)) return null;
    // Work the fee out before the booking changes. Only a student's tap-out can carry a fee.
    const fee = by === "student" ? feeIfTapOut(b) : 0;
    b.status = "cancelled";
    b.cancelledAt = now();
    b.cancelledBy = by;
    b.lateWindow = state.settings.windowHours; // locked to this cancellation
    // Locked too: changing the settings later doesn't change this fee
    if (fee > 0) b.fee = { amount: fee, pct: state.settings.feePct, paid: null, paidAt: null };
    if (by === "student") {
      const who = `${first(student(b.studentId))}, ${shortSlot(b.start)}`;
      notify(fee > 0 ? `Late-cancel fee: ${who}, ${money(fee)}` : `${isLateCancel(b) ? "Late cancel" : "Cancelled"}: ${who}`);
    }
    save();
    return b;
  }

  function markFeePaid(id, method) {
    const b = booking(id);
    if (!b || !b.fee || (method !== "Cash" && method !== "Revolut")) return;
    b.fee.paid = method;
    b.fee.paidAt = now();
    save();
  }

  function undoFeePaid(id) {
    const b = booking(id);
    if (!b || !b.fee) return;
    b.fee.paid = null;
    b.fee.paidAt = null;
    save();
  }

  // Checks the numbers and saves them. Returns an error message, or null if it saved.
  function saveSettings(next) {
    const whole = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
    if (!FEE_MODES.some((m) => m.id === next.feeMode)) return "Pick who the late-cancel fee applies to.";
    if (!whole(next.feePct, 0, 100)) return "Fee amount: a whole number from 0 to 100 (%).";
    if (!whole(next.windowHours, 1, 72)) return "Late-cancel window: a whole number of hours from 1 to 72.";
    if (!whole(next.nudgeThreshold, 1, 10)) return "“Needs a nudge” threshold: a whole number from 1 to 10.";
    state.settings = {
      feeMode: next.feeMode, feePct: next.feePct, windowHours: next.windowHours,
      nudgeThreshold: next.nudgeThreshold, payUpfront: !!next.payUpfront
    };
    save();
    return null;
  }

  function markPaid(id, method) {
    const b = booking(id);
    if (!b || !isEnded(b) || (method !== "Cash" && method !== "Revolut")) return;
    b.paid = method;
    b.paidAt = now();
    save();
  }

  function undoPaid(id) {
    const b = booking(id);
    if (!b) return;
    b.paid = null;
    b.paidAt = null;
    save();
  }

  function saveNotes(id, techniques, text) {
    const b = booking(id);
    if (!b || !isEnded(b)) return;
    b.notes = { techniques: techniques.slice(), text: text.trim(), at: now() };
    save();
  }

  function setRate(studentId, rate) {
    const s = student(studentId);
    if (!s) return;
    s.rate = rate; // existing bookings keep their own locked price
    save();
  }

  function addWindow(day, start, end) {
    if (!(end > start)) return "The end time has to be after the start time.";
    const clash = state.availability.some((w) => w.day === day && start < w.end && end > w.start);
    if (clash) return `That overlaps a window you already have on ${DAY_NAMES[day]}.`;
    state.availability.push({ day, start, end });
    save();
    return null;
  }

  function removeWindow(index) {
    state.availability.splice(index, 1);
    save();
  }

  function markAllRead() {
    state.notifications.forEach((n) => { n.read = true; });
    save();
  }

  // ---------- WhatsApp click-to-chat (no phone number: the coach picks the chat) ----------
  const waLink = (text) => "https://wa.me/?text=" + encodeURIComponent(text);

  function reminderMessage(b) {
    const s = student(b.studentId);
    return `Hi ${first(s)}, reminder of your private tomorrow (${DAY_NAMES[new Date(b.start).getDay()]}) at ${fmtTime(b.start)}. ${money(b.price)}, as agreed. Reply Oss to confirm 👊`;
  }

  // Extra reminder for "Needs a nudge" students, sent earlier than the day before
  function extraReminderMessage(b) {
    const s = student(b.studentId);
    return `Hi ${first(s)}, just checking in about your private on ${DAY_NAMES[new Date(b.start).getDay()]} ${fmtDate(b.start).split(" ").slice(1).join(" ")} at ${fmtTime(b.start)}. ${money(b.price)}, as agreed. Reply Oss to confirm, or let me know early if you can't make it 👊`;
  }

  function openTimesMessage() {
    const slots = openSlots();
    if (!slots.length) return `No open times for 1-to-1 sessions with Coach ${coachFirst()} in the next 7 days. More soon.`;
    const lines = groupByDay(slots).map((g) => `${fmtDate(g.key)}: ${g.slots.map(fmtTime).join(", ")}`);
    return `Open times for 1-to-1 sessions with Coach ${coachFirst()}, next 7 days:\n\n${lines.join("\n")}\n\n1 hour each. Book in Side Control, first come first served.`;
  }

  // ---------- HTML helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tag = (text, kind) => `<span class="tag tag--${kind}">${esc(text)}</span>`;

  function item({ when, who = "", price = "", tags = [], body = "", actions = "", cls = "" }) {
    return `<li class="item ${cls}">
      <div class="item__top">
        <div><p class="item__when">${when}</p>${who ? `<p class="item__who">${who}</p>` : ""}</div>
        ${price ? `<p class="item__price">${price}</p>` : ""}
      </div>
      ${tags.length ? `<p class="item__tags">${tags.join(" ")}</p>` : ""}
      ${body}
      ${actions ? `<div class="item__actions">${actions}</div>` : ""}
    </li>`;
  }

  const hoursText = (h) => `${h} hour${h === 1 ? "" : "s"}`;

  // Coach cancelling: flagged late if inside the window, but the student is never charged for it
  function cancelAsk(b) {
    const late = insideWindow(b);
    return `<div class="ask" role="group" aria-label="Cancel this session?">
      <p>${late
        ? `<strong>Less than ${hoursText(state.settings.windowHours)} to go.</strong> This will be flagged as a late cancel. No fee is charged when you cancel.`
        : "Cancel this session? The slot opens up again for others."}</p>
      <div class="item__actions">
        <button type="button" class="btn btn--danger" data-action="c-cancel-yes" data-id="${b.id}">Yes, cancel</button>
        <button type="button" class="btn btn--quiet" data-action="cancel-no">Keep it</button>
      </div>
    </div>`;
  }

  // Student tapping out: any fee is shown honestly before they commit
  function tapOutAsk(b) {
    const fee = feeIfTapOut(b);
    let text = "Tap out of this session? The slot opens up again for others.";
    if (fee > 0) text = `<strong>Tapping out now means a late-cancel fee of ${money(fee)}.</strong> Still tap out?`;
    else if (insideWindow(b)) text = `<strong>Less than ${hoursText(state.settings.windowHours)} to go.</strong> This will be flagged as a late cancel. Still tap out?`;
    return `<div class="ask" role="group" aria-label="Tap out of this session?">
      <p>${text}</p>
      <div class="item__actions">
        <button type="button" class="btn btn--danger" data-action="s-cancel-yes" data-id="${b.id}">Yes, tap out</button>
        <button type="button" class="btn btn--quiet" data-action="cancel-no">Keep it</button>
      </div>
    </div>`;
  }

  const OSS_LABEL = `Oss <span class="btn__hint">(confirm)</span>`;
  const TAPOUT_LABEL = `Tap out <span class="btn__hint">(cancel)</span>`;

  // Tag showing a late-cancel fee and whether it's been paid
  const feeTag = (b) => b.fee ? tag(`Late-cancel fee ${money(b.fee.amount)} · ${b.fee.paid ? "Paid · " + b.fee.paid : "To pay"}`, b.fee.paid ? "ok" : "unpaid") : "";

  const cancelTags = (b) => {
    const tags = [isLateCancel(b) ? tag("Late cancel", "late") : tag("Cancelled", "muted")];
    if (b.fee) tags.push(feeTag(b));
    return tags;
  };

  function notesBody(b) {
    if (!b.notes) return "";
    return `<ul class="chips chips--static">${b.notes.techniques.map((t) => `<li class="chip">${esc(t)}</li>`).join("")}</ul>
      ${b.notes.text ? `<p class="note-text">${esc(b.notes.text)}</p>` : ""}`;
  }

  // ---------- UI state ----------
  const savedUI = readJSON(UI_KEY) || {};
  const ui = {
    view: savedUI.view === "coach" ? "coach" : "student",
    studentId: savedUI.studentId || "s1",
    coachTab: savedUI.coachTab === "rates" ? "students" : (savedUI.coachTab || "diary"),
    selectedSlot: null,
    cancelAsk: null,
    cancelAskAt: "list", // where the tap-out question shows: the reminder "card" or the "list"
    cardFor: null,       // which student's card is open in the coach's Students tab
    settingsDirty: false,
    settingsError: "",
    settingsSaved: false,
    notesFor: null,
    notesDraft: { techniques: [], text: "" },
    winDraft: { day: 5, start: 18, end: 20 },
    winError: "",
    bellOpen: false,
    bellWasUnread: [],
    flash: null,
    focus: null
  };
  const saveUI = () => writeJSON(UI_KEY, { view: ui.view, studentId: ui.studentId, coachTab: ui.coachTab });

  function clearTransient() {
    ui.selectedSlot = null;
    ui.cancelAsk = null;
    ui.notesFor = null;
    ui.bellOpen = false;
    ui.winError = "";
    ui.settingsDirty = false;
    ui.settingsError = "";
    ui.settingsSaved = false;
  }

  function flash(text, kind) {
    ui.flash = { text, kind: kind || "ok", view: ui.view };
    ui.focus = ".dm-flash";
  }

  // ---------- Views ----------
  // Next Stripe: the student's view
  function renderStudent() {
    const s = student(ui.studentId);
    const mine = state.bookings.filter((b) => b.studentId === s.id);

    // Your sessions: booked ones still to come (or happening now), plus upcoming ones that were cancelled
    const coming = mine.filter((b) => isUpcoming(b) || isInProgress(b) ||
      (b.status === "cancelled" && b.start > now())).sort(byStart);

    const ossBtn = (b) => `<button type="button" class="btn btn--primary" data-action="s-confirm" data-id="${b.id}" aria-label="Oss, confirm I'm coming">${OSS_LABEL}</button>`;
    const tapOutBtn = (b, where) => `<button type="button" class="btn btn--quiet" data-action="ask-cancel" data-where="${where}" data-id="${b.id}" aria-label="Tap out, cancel this session">${TAPOUT_LABEL}</button>`;

    // In-app reminder card for tomorrow's session(s), at the top
    const reminders = mine.filter(isTomorrow).sort(byStart).map((b) => {
      const asking = ui.cancelAsk === b.id && ui.cancelAskAt === "card";
      return `<div class="remind" role="group" aria-label="Reminder for tomorrow">
        <p class="remind__eyebrow">Reminder</p>
        <p class="remind__text">Your private is tomorrow at ${fmtTime(b.start)}, ${money(b.price)}.</p>
        ${b.confirmed ? `<p class="remind__ok">${tag("Confirmed", "ok")} Oss! Coach ${esc(coachFirst())} knows you're coming.</p>` : ""}
        ${asking ? tapOutAsk(b) : `<div class="item__actions">${b.confirmed ? "" : ossBtn(b)}${tapOutBtn(b, "card")}</div>`}
        <p class="remind__note">In the full app this arrives as a push notification <span class="tag tag--planned">Planned</span></p>
      </div>`;
    }).join("");

    const sessions = coming.map((b) => {
      const tags = [];
      let actions = "";
      let body = "";
      if (b.status === "cancelled") {
        return item({ when: whenLabel(b.start), price: money(b.price), tags: cancelTags(b), cls: "item--cancelled" });
      }
      if (isInProgress(b)) tags.push(tag("On the mat now", "live"));
      if (isTomorrow(b)) tags.push(tag("Tomorrow", "tomorrow"));
      if (b.confirmed) tags.push(tag("Confirmed", "ok"));

      if (isTomorrow(b) && !b.confirmed) {
        actions += ossBtn(b);
      } else if (!b.confirmed && isUpcoming(b)) {
        body = `<p class="item__sub">You'll be asked to Oss (confirm) the day before.</p>`;
      }
      if (isUpcoming(b)) actions += tapOutBtn(b, "list");
      if (ui.cancelAsk === b.id && ui.cancelAskAt === "list") {
        actions = "";
        body += tapOutAsk(b);
      }
      return item({ when: whenLabel(b.start), price: `${money(b.price)}<span>locked</span>`, tags, body, actions });
    }).join("");

    // Book a session: open slots for the next 7 days, grouped by day
    const groups = groupByDay(openSlots());
    const slotHTML = groups.map((g) => {
      const label = daysFromToday(g.key) <= 1 ? `${dayLabel(g.key)}, ${fmtDate(g.key)}` : fmtDate(g.key);
      const picked = g.slots.includes(ui.selectedSlot) ? ui.selectedSlot : null;
      const buttons = g.slots.map((t) => `<button type="button" class="slot" data-action="pick-slot" data-start="${t}" aria-pressed="${t === picked}">
          <span class="slot__time">${fmtTime(t)}</span><span class="slot__price">${money(s.rate)}</span>
        </button>`).join("");
      const sheet = picked ? `<div class="sheet" role="group" aria-label="Book this slot">
          <p class="sheet__when">${fmtDate(picked)}, ${fmtTime(picked)}–${fmtTime(picked + SESSION)}</p>
          <p class="sheet__meta">1-to-1 with Coach ${esc(coachFirst())} · 60 minutes</p>
          <p class="sheet__price">${money(s.rate)} <span>your price, locked when you book</span></p>
          <div class="item__actions">
            <button type="button" class="btn btn--primary" data-action="book" data-start="${picked}">Book for ${money(s.rate)}</button>
            <button type="button" class="btn btn--quiet" data-action="unpick">Back</button>
          </div>
        </div>` : "";
      return `<div class="slot-day"><h5 class="slot-day__label">${label}</h5><div class="slots">${buttons}</div>${sheet}</div>`;
    }).join("");

    // Technique log: sessions that have ended, newest first
    const log = mine.filter((b) => isEnded(b) || (b.status === "cancelled" && b.start <= now()))
      .sort(byStartDesc)
      .map((b) => {
        if (b.status === "cancelled") {
          return item({ when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, tags: cancelTags(b), cls: "item--cancelled" });
        }
        const tags = [b.paid ? tag(`Paid · ${b.paid}`, "ok") : tag("To pay", "unpaid")];
        const body = b.notes ? notesBody(b) : `<p class="item__sub">Coach ${esc(coachFirst())} hasn't logged notes for this one yet.</p>`;
        return item({ when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, price: money(b.price), tags, body });
      }).join("");

    return `
      <div class="vhead">
        <div>
          <p class="vhead__eyebrow">Next Stripe</p>
          <p class="vhead__name">${esc(s.name)}</p>
          <p class="vhead__meta">${esc(s.belt)} · Your price with Coach ${esc(coachFirst())}: <strong>${money(s.rate)}</strong> per session</p>
        </div>
      </div>
      <div class="stats stats--two">
        <div class="stat"><span class="stat__label">Private lessons completed</span><span class="stat__value">${completedBy(s.id)}</span></div>
        <div class="stat"><span class="stat__label">Hours on the mat</span><span class="stat__value">${hoursBy(s.id)}</span></div>
      </div>
      ${reminders}

      <section class="dm-section" aria-labelledby="st-sessions">
        <h4 class="dm-h" id="st-sessions">Your sessions</h4>
        ${sessions ? `<ul class="list">${sessions}</ul>` : `<p class="dm-empty">Nothing booked. Pick a slot below.</p>`}
      </section>

      <section class="dm-section" aria-labelledby="st-book">
        <h4 class="dm-h" id="st-book">Book a session</h4>
        <p class="dm-intro">Coach ${esc(coachFirst())}'s open times for the next 7 days. Tap a time to see your price and book.</p>
        ${slotHTML || `<p class="dm-empty">No open times in the next 7 days.</p>`}
      </section>

      <section class="dm-section" aria-labelledby="st-log">
        <h4 class="dm-h" id="st-log">Your technique log</h4>
        ${log ? `<ul class="list">${log}</ul>` : `<p class="dm-empty">Your sessions and what you covered will show up here.</p>`}
      </section>`;
  }

  // Coach view
  const BELL_SVG = `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2.5a6.5 6.5 0 0 0-6.5 6.5v3.7l-1.7 2.6A1 1 0 0 0 4.6 17h14.8a1 1 0 0 0 .8-1.7l-1.7-2.6V9A6.5 6.5 0 0 0 12 2.5Zm0 19.5a3 3 0 0 0 2.8-2H9.2a3 3 0 0 0 2.8 2Z"/></svg>`;
  const TABS = [
    { id: "diary", label: "Diary" },
    { id: "money", label: "Money" },
    { id: "notes", label: "Notes" },
    { id: "students", label: "Students" },
    { id: "times", label: "Times" },
    { id: "settings", label: "Settings" }
  ];

  function renderCoach() {
    const unread = unreadCount();
    const owed = owedTotal();
    const toLog = state.bookings.filter(needsNotes).length;
    const nextWeek = state.bookings.filter((b) => isUpcoming(b) && b.start < now() + 7 * DAY).length;

    const bell = `<button type="button" class="bell" data-action="bell" aria-expanded="${ui.bellOpen}"
        aria-label="Notifications${unread ? `, ${unread} unread` : ""}">${BELL_SVG}${unread ? `<span class="bell__badge">${unread}</span>` : ""}</button>`;

    const panel = ui.bellOpen ? `<div class="notif-panel" id="notif-panel">
        <h4 class="dm-h">Notifications</h4>
        ${state.notifications.length ? `<ul class="list">${state.notifications.slice().sort((a, b) => b.at - a.at).map((n) =>
          `<li class="notif${ui.bellWasUnread.includes(n.id) ? " notif--new" : ""}"><p class="notif__text">${esc(n.text)}</p><p class="notif__time">${ago(n.at)}</p></li>`).join("")}</ul>`
          : `<p class="dm-empty">Nothing yet. Student bookings, confirmations and cancellations show up here.</p>`}
      </div>` : "";

    const counts = { money: unpaid().length + unpaidFees().length, notes: toLog };
    const tabs = `<div class="tabs" role="tablist" aria-label="Coach screens">${TABS.map((t) =>
      `<button type="button" class="tab" role="tab" id="tab-${t.id}" data-action="tab" data-tab="${t.id}" aria-selected="${ui.coachTab === t.id}" aria-controls="coach-panel">${t.label}${counts[t.id] ? `<span class="tab__count">${counts[t.id]}</span>` : ""}</button>`).join("")}</div>`;

    const screens = { diary: coachDiary, money: coachMoney, notes: coachNotes, students: coachStudents, times: coachTimes, settings: coachSettings };

    return `
      <div class="vhead">
        <div>
          <p class="vhead__eyebrow">Coach</p>
          <p class="vhead__name">Coach ${esc(state.coach.name)}</p>
          <p class="vhead__meta">${esc(state.coach.belt)} · ${esc(state.coach.academy)} (invented)</p>
        </div>
        ${bell}
      </div>
      ${panel}
      <div class="stats">
        <div class="stat${owed ? " stat--owed" : ""}"><span class="stat__label">Owed to you</span><span class="stat__value">${money(owed)}</span></div>
        <div class="stat"><span class="stat__label">Notes to log</span><span class="stat__value">${toLog}</span></div>
        <div class="stat"><span class="stat__label">Booked, next 7 days</span><span class="stat__value">${nextWeek}</span></div>
      </div>
      ${tabs}
      <div class="tabpanel" id="coach-panel" role="tabpanel" aria-labelledby="tab-${ui.coachTab}">
        ${(screens[ui.coachTab] || coachDiary)()}
      </div>`;
  }

  function coachSessionItem(b) {
    const s = student(b.studentId);
    const tags = [];
    let body = "";
    let actions = "";
    if (isInProgress(b)) tags.push(tag("On the mat now", "live"));
    if (isTomorrow(b)) tags.push(tag("Tomorrow", "tomorrow"));
    tags.push(b.confirmed ? tag("Confirmed", "ok") : tag("Not confirmed yet", "muted"));
    const nudge = isUpcoming(b) && needsNudge(s.id);
    if (nudge) tags.push(tag("Needs a nudge", "nudge"));
    if (isUpcoming(b) && payUpfrontFor(s.id)) {
      tags.push(tag("Pay upfront required", "upfront"));
      body += `<p class="item__sub">Taking the payment in the app is <span class="tag tag--planned">Planned</span>. For now, collect it before the session.</p>`;
    }

    if (nudge && !isTomorrow(b)) {
      body += `<div class="wa">
          <p class="nudge-line">${lateCancelsBy(s.id)} late cancels in the last ${NUDGE_DAYS} days. Worth an extra reminder.</p>
          <a class="btn btn--wa" href="${esc(waLink(extraReminderMessage(b)))}" target="_blank" rel="noopener noreferrer" data-wa="extra" data-id="${b.id}">Send an extra reminder on WhatsApp</a>
          <p class="wa-note">Opens WhatsApp with the message written. You press send.</p>
        </div>`;
    }
    if (isTomorrow(b)) {
      if (nudge) body += `<p class="nudge-line">${lateCancelsBy(s.id)} late cancels in the last ${NUDGE_DAYS} days. Don't skip this reminder.</p>`;
      body += `<div class="wa">
          <a class="btn btn--wa" href="${esc(waLink(reminderMessage(b)))}" target="_blank" rel="noopener noreferrer" data-wa="reminder" data-id="${b.id}">Send reminder on WhatsApp</a>
          <p class="wa-note">Opens WhatsApp with the message written. You press send.</p>
        </div>`;
    }
    if (isUpcoming(b)) {
      if (!b.confirmed) actions += `<button type="button" class="btn btn--quiet" data-action="c-confirm" data-id="${b.id}">Mark confirmed</button>`;
      actions += `<button type="button" class="btn btn--quiet" data-action="ask-cancel" data-id="${b.id}">Cancel</button>`;
    }
    if (ui.cancelAsk === b.id) {
      actions = "";
      body += cancelAsk(b);
    }
    return item({
      when: whenLabel(b.start), who: `${esc(s.name)} · ${esc(s.belt)}`, price: money(b.price),
      tags, body, actions, cls: isTomorrow(b) ? "item--tomorrow" : ""
    });
  }

  function coachDiary() {
    const live = state.bookings.filter((b) => isUpcoming(b) || isInProgress(b)).sort(byStart);
    const today = live.filter((b) => daysFromToday(b.start) === 0);
    const tomorrow = live.filter((b) => daysFromToday(b.start) === 1);
    const later = live.filter((b) => daysFromToday(b.start) >= 2);
    const cancelled = state.bookings
      .filter((b) => b.status === "cancelled" && b.start > now() - 7 * DAY).sort(byStartDesc);

    const group = (title, list, empty) => `<h4 class="dm-sub">${title}</h4>${list.length
      ? `<ul class="list">${list.map(coachSessionItem).join("")}</ul>` : `<p class="dm-empty">${empty}</p>`}`;

    const cancelHTML = cancelled.length ? `<h4 class="dm-sub">Recent cancellations</h4><ul class="list">${cancelled.map((b) => {
      const s = student(b.studentId);
      return item({
        when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(s.name), price: money(b.price),
        tags: cancelTags(b),
        body: `<p class="item__sub">Cancelled by ${b.cancelledBy === "coach" ? "you" : "the student"}, ${Math.max(0, Math.round((b.start - b.cancelledAt) / HOUR))} hours before the start.</p>`,
        cls: "item--cancelled"
      });
    }).join("")}</ul>` : "";

    return (today.length ? group("Today", today, "") : "") +
      group("Tomorrow", tomorrow, "Nothing booked for tomorrow.") +
      group("Coming up", later, "Nothing else booked yet. Share your open times to fill the week.") +
      cancelHTML;
  }

  function coachMoney() {
    // Things owed: finished sessions not paid, plus late-cancel fees not paid
    const owing = unpaid().map((b) => ({ b, fee: false }))
      .concat(unpaidFees().map((b) => ({ b, fee: true })))
      .sort((x, y) => x.b.start - y.b.start);
    const owed = owedTotal();
    const recent = (b) => b.start > now() - 21 * DAY;
    const paid = state.bookings.filter((b) => isEnded(b) && b.paid && recent(b)).map((b) => ({ b, fee: false, at: b.paidAt }))
      .concat(state.bookings.filter((b) => b.fee && b.fee.paid && recent(b)).map((b) => ({ b, fee: true, at: b.fee.paidAt })))
      .sort((x, y) => y.b.start - x.b.start);

    const payButtons = (b, fee) => ["Cash", "Revolut"].map((m) =>
      `<button type="button" class="btn btn--quiet" data-action="${fee ? "fee-paid" : "paid"}" data-method="${m}" data-id="${b.id}">Paid: ${m}</button>`).join("");

    const owingHTML = owing.map(({ b, fee }) => {
      const s = student(b.studentId);
      return item({
        when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(s.name), price: money(fee ? b.fee.amount : b.price),
        tags: fee ? [tag("Late-cancel fee", "unpaid"), tag("Unpaid", "unpaid")] : [tag("Unpaid", "unpaid")],
        body: fee ? `<p class="item__sub">${b.fee.pct}% of the ${money(b.price)} session. Locked when ${esc(first(s))} tapped out.</p>` : "",
        cls: "item--unpaid", actions: payButtons(b, fee)
      });
    }).join("");

    const paidHTML = paid.map(({ b, fee }) => item({
      when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(student(b.studentId).name), price: money(fee ? b.fee.amount : b.price),
      tags: fee ? [tag("Late-cancel fee", "muted"), tag(`Paid · ${b.fee.paid}`, "ok")] : [tag(`Paid · ${b.paid}`, "ok")],
      actions: `<button type="button" class="btn btn--small btn--quiet" data-action="${fee ? "undo-fee-paid" : "undo-paid"}" data-id="${b.id}">Undo</button>`
    })).join("");

    const nSessions = owing.filter((o) => !o.fee).length;
    const nFees = owing.length - nSessions;
    const parts = [];
    if (nSessions) parts.push(`${nSessions} finished session${nSessions > 1 ? "s" : ""}`);
    if (nFees) parts.push(`${nFees} late-cancel fee${nFees > 1 ? "s" : ""}`);

    return `<div class="owed${owed ? "" : " owed--clear"}" style="margin-top:16px">
        <p class="owed__label">Owed to you</p>
        <p class="owed__value">${money(owed)}</p>
        <p>${parts.length ? `${parts.join(" and ")} not marked paid yet.` : "All square. Nobody owes you anything."}</p>
      </div>
      <h4 class="dm-sub">Unpaid</h4>
      ${owingHTML ? `<ul class="list">${owingHTML}</ul>` : `<p class="dm-empty">Nothing unpaid.</p>`}
      <h4 class="dm-sub">Paid, last 3 weeks</h4>
      ${paidHTML ? `<ul class="list">${paidHTML}</ul>` : `<p class="dm-empty">No payments marked yet.</p>`}`;
  }

  function notesEditor(b) {
    const d = ui.notesDraft;
    return `<div class="editor">
      <p class="editor__hint">Tap what you covered. Add a line if you want.</p>
      <div class="chips" role="group" aria-label="Techniques covered">${TECHNIQUES.map((t) =>
        `<button type="button" class="chip" data-action="chip" data-tech="${esc(t)}" aria-pressed="${d.techniques.includes(t)}">${esc(t)}</button>`).join("")}</div>
      <label class="editor__label" for="notes-text">Anything else? (optional)</label>
      <textarea id="notes-text" class="editor__text" rows="3" maxlength="400" placeholder="e.g. Keep the elbow tight on the cut">${esc(d.text)}</textarea>
      ${d.error ? `<p class="dm-error" role="alert">${esc(d.error)}</p>` : ""}
      <div class="item__actions">
        <button type="button" class="btn btn--primary" data-action="save-notes" data-id="${b.id}">Save notes</button>
        <button type="button" class="btn btn--quiet" data-action="close-notes">Cancel</button>
      </div>
    </div>`;
  }

  function coachNotes() {
    const todo = state.bookings.filter(needsNotes).sort(byStartDesc);
    const done = state.bookings.filter((b) => isEnded(b) && b.notes).sort(byStartDesc).slice(0, 5);

    const row = (b, isTodo) => {
      const s = student(b.studentId);
      const editing = ui.notesFor === b.id;
      const tags = isTodo ? [tag("Needs notes", "unpaid")] : [];
      if (isUnpaid(b)) tags.push(tag("Unpaid", "unpaid"));
      return item({
        when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(s.name) + " · " + esc(s.belt), tags,
        body: editing ? notesEditor(b) : (isTodo ? "" : notesBody(b)),
        actions: editing ? "" : `<button type="button" class="btn ${isTodo ? "btn--primary" : "btn--small btn--quiet"}" data-action="open-notes" data-id="${b.id}">${isTodo ? "Log notes" : "Edit"}</button>`
      });
    };

    return `<p class="dm-intro" style="margin-top:16px">What you log here shows up in that student's Next Stripe log.</p>
      <h4 class="dm-sub">Needs notes</h4>
      ${todo.length ? `<ul class="list">${todo.map((b) => row(b, true)).join("")}</ul>` : `<p class="dm-empty">All caught up.</p>`}
      <h4 class="dm-sub">Logged recently</h4>
      ${done.length ? `<ul class="list">${done.map((b) => row(b, false)).join("")}</ul>` : `<p class="dm-empty">Nothing logged yet.</p>`}`;
  }

  // The coach's card for one student: everything counted from the bookings
  function studentCard(s) {
    const late = lateCancelsBy(s.id);
    const owed = owedBy(s.id);
    return `<div class="scard" id="card-${s.id}">
        ${needsNudge(s.id) ? `<p class="scard__flag">${tag("Needs a nudge", "nudge")} ${late} late cancels in ${NUDGE_DAYS} days (your threshold is ${state.settings.nudgeThreshold}). Only you see this.</p>` : ""}
        <div class="stats stats--card">
          <div class="stat"><span class="stat__label">Private lessons completed</span><span class="stat__value">${completedBy(s.id)}</span></div>
          <div class="stat"><span class="stat__label">Total hours</span><span class="stat__value">${hoursBy(s.id)}</span></div>
          <div class="stat${late ? " stat--owed" : ""}"><span class="stat__label">Late cancels, last ${NUDGE_DAYS} days</span><span class="stat__value">${late}</span></div>
          <div class="stat${owed ? " stat--owed" : ""}"><span class="stat__label">Owed</span><span class="stat__value">${money(owed)}</span></div>
        </div>
      </div>`;
  }

  function coachStudents() {
    const rows = state.students.map((s) => {
      const next = state.bookings.filter((b) => b.studentId === s.id && isUpcoming(b)).sort(byStart)[0];
      const open = ui.cardFor === s.id;
      return `<li class="item">
        <div class="rate-row">
          <div>
            <button type="button" class="namebtn" data-action="student-card" data-sid="${s.id}" aria-expanded="${open}" aria-controls="card-${s.id}">${esc(s.name)}<span aria-hidden="true">${open ? "▴" : "▾"}</span></button>
            <p class="item__who">${esc(s.belt)}${s.rate !== state.standardRate ? " · own rate" : ""}</p>
            ${needsNudge(s.id) ? `<p class="item__tags">${tag("Needs a nudge", "nudge")}</p>` : ""}
          </div>
          <div class="rate-edit">
            <label class="sr-only" for="rate-${s.id}">Rate for ${esc(s.name)} in euro</label>
            <span class="rate-edit__euro" aria-hidden="true">€</span>
            <input id="rate-${s.id}" type="number" inputmode="numeric" min="0" max="500" step="5" value="${s.rate}">
            <button type="button" class="btn btn--small btn--quiet" data-action="save-rate" data-sid="${s.id}">Save</button>
          </div>
        </div>
        ${next ? `<p class="item__sub">Next booked: ${fmtDate(next.start)}, ${fmtTime(next.start)} at ${money(next.price)} (locked)</p>` : ""}
        ${open ? studentCard(s) : ""}
      </li>`;
    }).join("");
    return `<p class="dm-intro" style="margin-top:16px">Tap a name to see their card. Standard rate: ${money(state.standardRate)} per 1-hour session. Sample figures.</p>
      <p class="rate-note">A new rate applies to new bookings only. Sessions already booked keep the price they were booked at.</p>
      <ul class="list">${rows}</ul>`;
  }

  function coachTimes() {
    const open = openSlots();
    const msg = openTimesMessage();
    const windows = state.availability
      .map((w, i) => ({ w, i }))
      .sort((a, b) => WEEK_ORDER.indexOf(a.w.day) - WEEK_ORDER.indexOf(b.w.day) || a.w.start - b.w.start);
    const hourOpt = (from, to, sel) => {
      let o = "";
      for (let h = from; h <= to; h++) o += `<option value="${h}"${h === sel ? " selected" : ""}>${pad(h)}:00</option>`;
      return o;
    };
    const wd = ui.winDraft;

    return `<h4 class="dm-sub">Next 7 days</h4>
      <p>${open.length} open slot${open.length === 1 ? "" : "s"} right now.</p>
      <div class="wa">
        <a class="btn btn--wa" href="${esc(waLink(msg))}" target="_blank" rel="noopener noreferrer" data-wa="open-times">Share my open times on WhatsApp</a>
        <p class="wa-note">Opens WhatsApp with the message written. You press send.</p>
      </div>
      <details class="preview"><summary>Preview the message</summary><pre>${esc(msg)}</pre></details>

      <h4 class="dm-sub">Weekly open times</h4>
      ${windows.length ? `<ul class="list">${windows.map(({ w, i }) => `<li class="item"><div class="win-row">
          <div><p class="item__when">${DAY_NAMES[w.day]}</p><p class="item__who">${pad(w.start)}:00–${pad(w.end)}:00 · ${w.end - w.start} slot${w.end - w.start === 1 ? "" : "s"}</p></div>
          <button type="button" class="btn btn--small btn--quiet" data-action="remove-window" data-index="${i}" aria-label="Remove ${DAY_NAMES[w.day]} ${pad(w.start)}:00 to ${pad(w.end)}:00">Remove</button>
        </div></li>`).join("")}</ul>` : `<p class="dm-empty">No weekly open times. Add one below.</p>`}

      <h4 class="dm-sub">Add open time</h4>
      <div class="addwin">
        <label>Day<select id="win-day" data-draft="day">${WEEK_ORDER.map((d) => `<option value="${d}"${d === wd.day ? " selected" : ""}>${DAY_SHORT[d]}</option>`).join("")}</select></label>
        <label>From<select id="win-start" data-draft="start">${hourOpt(6, 22, wd.start)}</select></label>
        <label>To<select id="win-end" data-draft="end">${hourOpt(7, 23, wd.end)}</select></label>
        <button type="button" class="btn btn--primary" data-action="add-window">Add open time</button>
      </div>
      ${ui.winError ? `<p class="dm-error" role="alert">${esc(ui.winError)}</p>` : ""}`;
  }

  function coachSettings() {
    const st = state.settings;
    const num = (id, label, value, min, max, step, unit) => `<div class="set-field">
        <label for="${id}">${label}</label>
        <div class="set-input"><input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" step="${step}" value="${value}"><span>${unit}</span></div>
      </div>`;
    return `<form class="settings" id="settings-form" novalidate>
        <p class="dm-intro" style="margin-top:16px">Your rules for late cancels. Saved on this device.</p>
        <fieldset class="set-group">
          <legend>Late-cancel fee</legend>
          <div class="opts">${FEE_MODES.map((m) => `<label class="opt"><input type="radio" name="feeMode" value="${m.id}"${st.feeMode === m.id ? " checked" : ""}> ${m.label}</label>`).join("")}</div>
        </fieldset>
        ${num("set-pct", "Fee amount (% of the session price)", st.feePct, 0, 100, 5, "%")}
        ${num("set-window", "Late-cancel window (hours before the start)", st.windowHours, 1, 72, 1, "hours")}
        ${num("set-threshold", "“Needs a nudge” after this many late cancels in the last 90 days", st.nudgeThreshold, 1, 10, 1, "late cancels")}
        <label class="opt opt--check"><input type="checkbox" id="set-upfront"${st.payUpfront ? " checked" : ""}> Pay upfront for “Needs a nudge” students</label>
        <p class="item__sub">Their bookings show “Pay upfront required”. Taking the payment in the app is <span class="tag tag--planned">Planned</span></p>
        ${ui.settingsError ? `<p class="dm-error" role="alert">${esc(ui.settingsError)}</p>` : ""}
        <div class="item__actions">
          <button type="button" class="btn btn--primary" data-action="save-settings">Save settings</button>
        </div>
        ${ui.settingsSaved ? `<p class="dm-saved" role="status">Saved. New cancellations use these settings.</p>` : ""}
        <p class="rate-note" style="margin-top:16px">Fees already created keep their amount. Changing these settings only affects new cancellations.</p>
      </form>`;
  }

  function readSettingsForm() {
    const f = app.querySelector("#settings-form");
    const picked = f.querySelector('input[name="feeMode"]:checked');
    return {
      feeMode: picked ? picked.value : "",
      feePct: Number(f.querySelector("#set-pct").value),
      windowHours: Number(f.querySelector("#set-window").value),
      nudgeThreshold: Number(f.querySelector("#set-threshold").value),
      payUpfront: f.querySelector("#set-upfront").checked
    };
  }

  // Coach button handling. Returns false if the action isn't a coach one.
  function handleCoachAction(action, el, id) {
    switch (action) {
      case "bell":
        ui.bellOpen = !ui.bellOpen;
        if (ui.bellOpen) {
          ui.bellWasUnread = state.notifications.filter((n) => !n.read).map((n) => n.id);
          markAllRead(); // opening the list marks everything as read
        }
        ui.focus = '[data-action="bell"]';
        return true;
      case "tab":
        ui.coachTab = el.dataset.tab;
        ui.cancelAsk = null;
        ui.notesFor = null;
        ui.winError = "";
        ui.settingsDirty = false;
        ui.settingsError = "";
        ui.settingsSaved = false;
        ui.focus = `#tab-${ui.coachTab}`;
        saveUI();
        return true;
      case "fee-paid": {
        const b = booking(id);
        markFeePaid(id, el.dataset.method);
        if (b) flash(`${first(student(b.studentId))}'s late-cancel fee: paid by ${el.dataset.method}. Owed to you is now ${money(owedTotal())}.`);
        return true;
      }
      case "undo-fee-paid":
        undoFeePaid(id);
        flash(`Fee back to unpaid. Owed to you is now ${money(owedTotal())}.`);
        return true;
      case "student-card": {
        const sid = el.dataset.sid;
        ui.cardFor = ui.cardFor === sid ? null : sid;
        ui.focus = `[data-action="student-card"][data-sid="${sid}"]`;
        return true;
      }
      case "save-settings": {
        const err = saveSettings(readSettingsForm());
        ui.settingsError = err || "";
        ui.settingsSaved = !err;
        ui.settingsDirty = !!err;
        ui.focus = err ? ".dm-error" : ".dm-saved";
        return true;
      }
      case "c-confirm":
        if (confirmBooking(id, "coach")) flash("Marked as confirmed.");
        return true;
      case "paid": {
        const b = booking(id);
        markPaid(id, el.dataset.method);
        if (b) flash(`${first(student(b.studentId))}, ${fmtDate(b.start)}: paid by ${el.dataset.method}. Owed to you is now ${money(owedTotal())}.`);
        return true;
      }
      case "undo-paid":
        undoPaid(id);
        flash(`Back to unpaid. Owed to you is now ${money(owedTotal())}.`);
        return true;
      case "open-notes": {
        const b = booking(id);
        ui.notesFor = id;
        ui.notesDraft = { techniques: b && b.notes ? b.notes.techniques.slice() : [], text: b && b.notes ? b.notes.text : "", error: "" };
        ui.focus = ".editor .chip";
        return true;
      }
      case "chip": {
        const t = el.dataset.tech;
        const list = ui.notesDraft.techniques;
        const at = list.indexOf(t);
        if (at >= 0) list.splice(at, 1); else list.push(t);
        ui.notesDraft.error = "";
        ui.focus = `.chip[data-tech="${t.replace(/["\\]/g, "\\$&")}"]`;
        return true;
      }
      case "save-notes": {
        const d = ui.notesDraft;
        if (!d.techniques.length && !d.text.trim()) {
          d.error = "Tap at least one technique or write a line.";
          return true;
        }
        const b = booking(id);
        saveNotes(id, d.techniques, d.text);
        ui.notesFor = null;
        if (b) flash(`Notes saved. ${first(student(b.studentId))} can see them in Next Stripe.`);
        return true;
      }
      case "close-notes":
        ui.notesFor = null;
        return true;
      case "save-rate": {
        const sid = el.dataset.sid;
        const input = app.querySelector(`#rate-${sid}`);
        const value = Number(input && input.value);
        if (!Number.isInteger(value) || value < 0 || value > 500) {
          flash("Enter a whole number of euro between 0 and 500.", "warn");
          return true;
        }
        setRate(sid, value);
        flash(`${first(student(sid))}'s rate is now ${money(value)} for new bookings. Booked sessions keep their price.`);
        return true;
      }
      case "remove-window":
        removeWindow(Number(el.dataset.index));
        flash("Open time removed. Existing bookings are unchanged.");
        return true;
      case "add-window": {
        const err = addWindow(ui.winDraft.day, ui.winDraft.start, ui.winDraft.end);
        ui.winError = err || "";
        if (!err) flash(`Added ${DAY_NAMES[ui.winDraft.day]} ${pad(ui.winDraft.start)}:00–${pad(ui.winDraft.end)}:00.`);
        return true;
      }
      default:
        return false;
    }
  }

  // ---------- Render ----------
  const app = document.getElementById("demo-app");
  const toggleBtns = document.querySelectorAll(".toggle__btn");
  const pickerWrap = document.getElementById("student-picker-wrap");
  const picker = document.getElementById("student-picker");
  const resetBtn = document.getElementById("reset-demo");

  function syncControls() {
    toggleBtns.forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.view === ui.view)));
    pickerWrap.hidden = ui.view !== "student";
    picker.innerHTML = state.students
      .map((s) => `<option value="${s.id}"${s.id === ui.studentId ? " selected" : ""}>${esc(s.name)} (${esc(s.belt)})</option>`)
      .join("");
  }

  // Safety net: show the error inside the demo panel instead of a blank space
  function showError(err) {
    if (!app) return;
    const msg = err && err.message ? err.message : String(err);
    app.innerHTML = `<p class="demo__empty demo__error">The demo hit an error: ${esc(msg)}</p>`;
  }

  function render() {
    if (!app) return;
    try {
      if (!student(ui.studentId)) ui.studentId = state.students[0].id;
      syncControls();
      const warn = storageOK ? "" :
        `<p class="dm-warn">Your browser is blocking storage, so changes won't survive a refresh.</p>`;
      const f = ui.flash && ui.flash.view === ui.view
        ? `<p class="dm-flash dm-flash--${ui.flash.kind}" role="status" tabindex="-1">${esc(ui.flash.text)}</p>` : "";
      app.innerHTML = warn + f + (ui.view === "coach" ? renderCoach() : renderStudent());
      app.setAttribute("data-ready", "1");
      if (ui.focus) {
        const el = app.querySelector(ui.focus);
        if (el) el.focus();
        ui.focus = null;
      }
    } catch (err) {
      showError(err);
    }
  }

  // ---------- Events ----------
  if (app) try {
    toggleBtns.forEach((btn) => btn.addEventListener("click", () => {
      ui.view = btn.dataset.view;
      ui.flash = null;
      clearTransient();
      saveUI();
      render();
    }));

    picker.addEventListener("change", () => {
      ui.studentId = picker.value;
      ui.flash = null;
      clearTransient();
      saveUI();
      render();
    });

    // Reset needs two taps, so it can't happen by accident
    let resetTimer = null;
    resetBtn.addEventListener("click", () => {
      if (resetBtn.dataset.armed === "1") {
        clearTimeout(resetTimer);
        resetBtn.dataset.armed = "";
        resetBtn.textContent = "Reset sample data";
        state = makeSeed();
        save();
        clearTransient();
        flash("Sample data reset. Everything is back to the start.");
        render();
        return;
      }
      resetBtn.dataset.armed = "1";
      resetBtn.textContent = "Tap again to reset";
      resetTimer = setTimeout(() => {
        resetBtn.dataset.armed = "";
        resetBtn.textContent = "Reset sample data";
      }, 4000);
    });

    // Every button inside the demo carries a data-action
    app.addEventListener("click", (event) => {
      const el = event.target.closest("[data-action]");
      if (!el || !app.contains(el)) return;
      const action = el.dataset.action;
      const id = el.dataset.id;
      ui.flash = null;

      switch (action) {
        // ----- Student -----
        case "pick-slot": {
          const t = Number(el.dataset.start);
          ui.selectedSlot = ui.selectedSlot === t ? null : t;
          ui.cancelAsk = null;
          if (ui.selectedSlot) ui.focus = '[data-action="book"]';
          break;
        }
        case "unpick":
          ui.selectedSlot = null;
          break;
        case "book": {
          const b = bookSlot(ui.studentId, Number(el.dataset.start));
          ui.selectedSlot = null;
          if (b) flash(`Booked: ${fmtDate(b.start)}, ${fmtTime(b.start)} for ${money(b.price)}. It's in your sessions.`);
          else flash("Sorry, that slot has just gone. Pick another time.", "warn");
          break;
        }
        case "s-confirm":
          if (confirmBooking(id, "student")) flash(`Oss! Confirmed. Coach ${coachFirst()} can see it.`);
          break;
        case "ask-cancel":
          ui.cancelAsk = id;
          ui.cancelAskAt = el.dataset.where || "list";
          ui.selectedSlot = null;
          ui.focus = '[data-action$="-cancel-yes"]';
          break;
        case "cancel-no":
          ui.cancelAsk = null;
          break;
        case "s-cancel-yes":
        case "c-cancel-yes": {
          const isStudent = action === "s-cancel-yes";
          const b = cancelBooking(id, isStudent ? "student" : "coach");
          ui.cancelAsk = null;
          if (b) {
            const verb = isStudent ? "Tapped out of" : "Cancelled";
            const notice = `Less than ${hoursText(b.lateWindow)}' notice, so it's flagged as a late cancel`;
            if (b.fee) flash(`${verb} ${shortSlot(b.start)}. ${notice}, with a ${money(b.fee.amount)} late-cancel fee.`, "warn");
            else if (isLateCancel(b)) flash(`${verb} ${shortSlot(b.start)}. ${notice}.`, "warn");
            else flash(`${verb} ${shortSlot(b.start)}. The slot is open again.`);
          }
          break;
        }
        default:
          if (!handleCoachAction(action, el, id)) return;
      }
      render();
    });

    // Typing in the notes box, and the open-time pickers, update the draft without a re-render
    const inSettings = (el) => !!(el && el.closest && el.closest("#settings-form"));
    app.addEventListener("input", (event) => {
      if (event.target.id === "notes-text") ui.notesDraft.text = event.target.value;
      if (inSettings(event.target)) { ui.settingsDirty = true; ui.settingsSaved = false; }
    });
    app.addEventListener("change", (event) => {
      const key = event.target.dataset && event.target.dataset.draft;
      if (key) ui.winDraft[key] = Number(event.target.value);
      if (inSettings(event.target)) { ui.settingsDirty = true; ui.settingsSaved = false; }
    });
    // Pressing Enter in a settings box saves, instead of reloading the page
    app.addEventListener("submit", (event) => {
      event.preventDefault();
      const btn = app.querySelector('[data-action="save-settings"]');
      if (btn) btn.click();
    });

    // Keep the time-based flags live while the page is open (but never wipe unsaved settings or notes)
    setInterval(() => {
      if (document.hidden || ui.notesFor || ui.settingsDirty) return;
      const active = document.activeElement;
      if (active && app.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
      render();
    }, MIN);

    render();
  } catch (err) {
    showError(err);
  }

  // ---------- Waiting list: shows a thank-you, never sends or saves anything ----------
  const form = document.getElementById("waitlist-form");
  const thanks = document.getElementById("waitlist-thanks");
  const thanksName = document.getElementById("thanks-name");
  const errorBox = document.getElementById("wl-error");

  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const name = form.elements.name;
      const email = form.elements.email;
      const problems = [];

      name.removeAttribute("aria-invalid");
      email.removeAttribute("aria-invalid");

      if (!name.value.trim()) {
        problems.push("your name");
        name.setAttribute("aria-invalid", "true");
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
        problems.push("a valid email");
        email.setAttribute("aria-invalid", "true");
      }

      if (problems.length) {
        errorBox.textContent = "Please add " + problems.join(" and ") + ".";
        errorBox.hidden = false;
        (name.getAttribute("aria-invalid") ? name : email).focus();
        return;
      }

      errorBox.hidden = true;
      thanksName.textContent = ", " + name.value.trim().split(/\s+/)[0];
      form.reset();
      form.hidden = true;
      thanks.hidden = false;
      thanks.focus();
    });
  }
})();
