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
  const isLateCancel = (b) => b.status === "cancelled" && b.cancelledAt != null && b.start - b.cancelledAt < DAY;
  const isUnpaid = (b) => isEnded(b) && !b.paid;
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

    // Late cancel: cancelled 10 hours before the start
    t = at(-1, 19);
    const late = add("s6", t, { status: "cancelled", cancelledAt: t - 10 * HOUR, cancelledBy: "student", createdAt: t - 4 * DAY });

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
      { id: "n3", text: `Late cancel: Rory, ${shortSlot(late.start)}`, at: late.cancelledAt, read: false },
      { id: "n4", text: `New booking: Conor, ${shortSlot(tmr.start)}, ${money(tmr.price)}`, at: tmr.createdAt, read: true }
    ];

    return {
      version: 1,
      seededAt: now(),
      coach: { name: "Dara Quinn", belt: "Black belt", academy: "Slate Lane Academy" },
      standardRate: 80,
      students, availability, bookings, notifications
    };
  }

  // ---------- Load / save ----------
  const isValid = (s) => s && s.version === 1 && s.coach &&
    ["students", "bookings", "availability", "notifications"].every((k) => Array.isArray(s[k]));

  let state = readJSON(STORE_KEY);
  if (!isValid(state)) state = makeSeed();
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
  const owedTotal = () => unpaid().reduce((sum, b) => sum + b.price, 0);
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
    b.status = "cancelled";
    b.cancelledAt = now();
    b.cancelledBy = by;
    if (by === "student") {
      notify(`${isLateCancel(b) ? "Late cancel" : "Cancelled"}: ${first(student(b.studentId))}, ${shortSlot(b.start)}`);
    }
    save();
    return b;
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

  function cancelAsk(b, who) {
    const late = b.start - now() < DAY;
    return `<div class="ask" role="group" aria-label="Cancel this session?">
      <p>${late
        ? "<strong>Less than 24 hours to go.</strong> This will be flagged as a late cancel."
        : "Cancel this session? The slot opens up again for others."}</p>
      <div class="item__actions">
        <button type="button" class="btn btn--danger" data-action="${who}-cancel-yes" data-id="${b.id}">Yes, cancel</button>
        <button type="button" class="btn btn--quiet" data-action="cancel-no">Keep it</button>
      </div>
    </div>`;
  }

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
    coachTab: savedUI.coachTab || "diary",
    selectedSlot: null,
    cancelAsk: null,
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

    const sessions = coming.map((b) => {
      const tags = [];
      let actions = "";
      let body = "";
      if (b.status === "cancelled") {
        tags.push(isLateCancel(b) ? tag("Late cancel", "late") : tag("Cancelled", "muted"));
        return item({ when: whenLabel(b.start), price: money(b.price), tags, cls: "item--cancelled" });
      }
      if (isInProgress(b)) tags.push(tag("On the mat now", "live"));
      if (isTomorrow(b)) tags.push(tag("Tomorrow", "tomorrow"));
      if (b.confirmed) tags.push(tag("Confirmed", "ok"));

      if (isTomorrow(b) && !b.confirmed) {
        actions += `<button type="button" class="btn btn--primary" data-action="s-confirm" data-id="${b.id}">Confirm I'm coming</button>`;
      } else if (!b.confirmed && isUpcoming(b)) {
        body = `<p class="item__sub">You'll be asked to confirm the day before.</p>`;
      }
      if (isUpcoming(b)) {
        actions += `<button type="button" class="btn btn--quiet" data-action="ask-cancel" data-id="${b.id}">Cancel</button>`;
      }
      if (ui.cancelAsk === b.id) {
        actions = "";
        body += cancelAsk(b, "s");
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
          return item({ when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, tags: [isLateCancel(b) ? tag("Late cancel", "late") : tag("Cancelled", "muted")], cls: "item--cancelled" });
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
    { id: "rates", label: "Rates" },
    { id: "times", label: "Times" }
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

    const counts = { money: unpaid().length, notes: toLog };
    const tabs = `<div class="tabs" role="tablist" aria-label="Coach screens">${TABS.map((t) =>
      `<button type="button" class="tab" role="tab" id="tab-${t.id}" data-action="tab" data-tab="${t.id}" aria-selected="${ui.coachTab === t.id}" aria-controls="coach-panel">${t.label}${counts[t.id] ? `<span class="tab__count">${counts[t.id]}</span>` : ""}</button>`).join("")}</div>`;

    const screens = { diary: coachDiary, money: coachMoney, notes: coachNotes, rates: coachRates, times: coachTimes };

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

    if (isTomorrow(b)) {
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
      body += cancelAsk(b, "c");
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
        tags: [isLateCancel(b) ? tag("Late cancel", "late") : tag("Cancelled", "muted")],
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
    const owing = unpaid().sort(byStart);
    const owed = owedTotal();
    const paid = state.bookings.filter((b) => isEnded(b) && b.paid && b.start > now() - 21 * DAY).sort(byStartDesc);

    const owingHTML = owing.map((b) => {
      const s = student(b.studentId);
      return item({
        when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(s.name), price: money(b.price),
        tags: [tag("Unpaid", "unpaid")], cls: "item--unpaid",
        actions: `<button type="button" class="btn btn--quiet" data-action="paid" data-method="Cash" data-id="${b.id}">Paid: Cash</button>
          <button type="button" class="btn btn--quiet" data-action="paid" data-method="Revolut" data-id="${b.id}">Paid: Revolut</button>`
      });
    }).join("");

    const paidHTML = paid.map((b) => item({
      when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(student(b.studentId).name), price: money(b.price),
      tags: [tag(`Paid · ${b.paid}`, "ok")],
      actions: `<button type="button" class="btn btn--small btn--quiet" data-action="undo-paid" data-id="${b.id}">Undo</button>`
    })).join("");

    return `<div class="owed${owed ? "" : " owed--clear"}" style="margin-top:16px">
        <p class="owed__label">Owed to you</p>
        <p class="owed__value">${money(owed)}</p>
        <p>${owing.length ? `${owing.length} finished session${owing.length > 1 ? "s" : ""} not marked paid yet.` : "All square. Nobody owes you for a finished session."}</p>
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

  function coachRates() {
    const rows = state.students.map((s) => {
      const next = state.bookings.filter((b) => b.studentId === s.id && isUpcoming(b)).sort(byStart)[0];
      return `<li class="item">
        <div class="rate-row">
          <div><p class="item__when">${esc(s.name)}</p><p class="item__who">${esc(s.belt)}${s.rate !== state.standardRate ? " · own rate" : ""}</p></div>
          <div class="rate-edit">
            <label class="sr-only" for="rate-${s.id}">Rate for ${esc(s.name)} in euro</label>
            <span class="rate-edit__euro" aria-hidden="true">€</span>
            <input id="rate-${s.id}" type="number" inputmode="numeric" min="0" max="500" step="5" value="${s.rate}">
            <button type="button" class="btn btn--small btn--quiet" data-action="save-rate" data-sid="${s.id}">Save</button>
          </div>
        </div>
        ${next ? `<p class="item__sub">Next booked: ${fmtDate(next.start)}, ${fmtTime(next.start)} at ${money(next.price)} (locked)</p>` : ""}
      </li>`;
    }).join("");
    return `<p class="dm-intro" style="margin-top:16px">Standard rate: ${money(state.standardRate)} per 1-hour session. Sample figures.</p>
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
        ui.focus = `#tab-${ui.coachTab}`;
        saveUI();
        return true;
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
          if (confirmBooking(id, "student")) flash(`Confirmed. Coach ${coachFirst()} can see it.`);
          break;
        case "ask-cancel":
          ui.cancelAsk = id;
          ui.selectedSlot = null;
          ui.focus = '[data-action$="-cancel-yes"]';
          break;
        case "cancel-no":
          ui.cancelAsk = null;
          break;
        case "s-cancel-yes":
        case "c-cancel-yes": {
          const b = cancelBooking(id, action === "s-cancel-yes" ? "student" : "coach");
          ui.cancelAsk = null;
          if (b) flash(isLateCancel(b)
            ? `Cancelled ${shortSlot(b.start)}. Less than 24 hours' notice, so it's flagged as a late cancel.`
            : `Cancelled ${shortSlot(b.start)}. The slot is open again.`, isLateCancel(b) ? "warn" : "ok");
          break;
        }
        default:
          if (!handleCoachAction(action, el, id)) return;
      }
      render();
    });

    // Typing in the notes box, and the open-time pickers, update the draft without a re-render
    app.addEventListener("input", (event) => {
      if (event.target.id === "notes-text") ui.notesDraft.text = event.target.value;
    });
    app.addEventListener("change", (event) => {
      const key = event.target.dataset && event.target.dataset.draft;
      if (key) ui.winDraft[key] = Number(event.target.value);
    });

    // Keep the time-based flags live while the page is open
    setInterval(() => {
      if (document.hidden || ui.notesFor) return;
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
