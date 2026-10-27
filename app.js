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

  const pad = (n) => String(n).padStart(2, "0");
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
            const s = new Date(base);
            s.setHours(h, 0, 0, 0);
            out.push(s.getTime());
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
  function renderStudent() {
    return `<p class="demo__empty">Next Stripe view coming in the next step.</p>`;
  }

  function renderCoach() {
    return `<p class="demo__empty">Coach view coming in the next step.</p>`;
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

  function render() {
    if (!app) return;
    if (!student(ui.studentId)) ui.studentId = state.students[0].id;
    syncControls();
    const warn = storageOK ? "" :
      `<p class="dm-warn">Your browser is blocking storage, so changes won't survive a refresh.</p>`;
    const f = ui.flash && ui.flash.view === ui.view
      ? `<p class="dm-flash dm-flash--${ui.flash.kind}" role="status" tabindex="-1">${esc(ui.flash.text)}</p>` : "";
    app.innerHTML = warn + f + (ui.view === "coach" ? renderCoach() : renderStudent());
    if (ui.focus) {
      const el = app.querySelector(ui.focus);
      if (el) el.focus();
      ui.focus = null;
    }
  }

  // ---------- Events ----------
  if (app) {
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

    // Keep the time-based flags live while the page is open
    setInterval(() => {
      if (document.hidden || ui.notesFor) return;
      const active = document.activeElement;
      if (active && app.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return;
      render();
    }, MIN);

    render();
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
