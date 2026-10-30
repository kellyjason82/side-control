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
  const APP_VERSION = "11"; // shown on the page as "Demo v11": keep in step with app.js?v=11 in index.html
  const DATA_VERSION = 3;// bump when the saved shape changes, so old data is replaced by fresh sample data

  // Coach settings, and what "Reset sample data" puts back
  const DEFAULT_SETTINGS = { feeMode: "flagged", feePct: 75, windowHours: 24, nudgeThreshold: 2, payUpfront: true, pack10Price: 720, pack20Price: 1360 };
  const PACK_SIZES = [10, 20];
  const PACK_WARN_AT = 2; // warn the coach and student when this many sessions (or fewer) are left
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
  const money = (n) => "€" + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); // €1,360

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
  const isUnpaid = (b) => isEnded(b) && !b.paid && !b.packId; // pack sessions are already paid for by the pack
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
    // extra can add homework ("Practise this") and a video link. Sample links go to example.com.
    const notes = (techniques, text, start, extra) => Object.assign({ techniques, text, homework: "", video: "", sampleLink: false, at: start + 2 * HOUR }, extra);
    const hw = (homework, slug) => ({ homework, video: slug ? "https://example.com/sample/" + slug : "", sampleLink: !!slug });
    let t;

    // Tomás bought a 10-session pack and has used 8 of them, so 2 are left (the warning shows on first load)
    t = at(-60, 20);
    const packs = [{ id: "p1", studentId: "s4", size: 10, price: 720, boughtAt: t, paid: "Revolut", paidAt: t }];
    const packLog = [
      [-58, ["Guard retention"], "Hips square. Feet on the hips, not the floor."],
      [-51, ["Single leg"], "Head on the inside. Drive the shoulder, don't pull."],
      [-44, ["Kimura"], "Trap the wrist first, then climb the hips."],
      [-37, ["Toreando pass"], "Grip the knees, push down, step wide."],
      [-30, ["Half guard sweep"], "Underhook or nothing."],
      [-23, ["Mount escape"], "Trap the arm and foot on the same side, then bridge."],
      [-16, ["Armbar from guard"], "Pinch the knees. Thumb up."]
    ];
    packLog.forEach((l) => {
      t = at(l[0], 19);
      add("s4", t, { packId: "p1", price: 72, confirmed: true, notes: notes(l[1], l[2], t) });
    });

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
    add("s1", t, { confirmed: true, paid: "Revolut", paidAt: t + HOUR, notes: notes(["Knee cut pass", "Guard retention"], "Win the underhook before you cut. 3 x 10 each side.", t,
      hw("20 knee cut entries each side before Thursday. Slow, then at speed.", "knee-cut-pass")) });
    // Tomás's 8th pack session, with notes and homework
    t = at(-9, 19);
    add("s4", t, { packId: "p1", price: 72, confirmed: true, notes: notes(["Side control escape", "Mount escape"], "Frame on the hip first, then shrimp. Stop pushing the chest.", t,
      hw("Shrimp drill down the mat and back, 5 lengths before each class.", "side-control-escape")) });
    t = at(-7, 10);
    add("s3", t, { confirmed: true, paid: "Revolut", paidAt: t + HOUR, notes: notes(["Back take", "Rear naked choke"], "Seatbelt before hooks. Hide the choking hand.", t,
      hw("Seatbelt to hooks from turtle, 10 reps a side, slow.", "back-take")) });

    // Past and unpaid, notes logged
    t = at(-5, 19);
    add("s2", t, { confirmed: true, notes: notes(["Scissor sweep", "Hip bump sweep"], "If they post, hip bump. If they sit back, scissor.", t,
      hw("Shadow the hip bump 3 x 10 at home. Post the hand, then the hips.", "")) });

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
    add("s7", later[2], { createdAt: now() - 3 * DAY });
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
      students, availability, bookings, notifications, packs
    };
  }

  // ---------- Load / save ----------
  const isValid = (s) => s && s.version === DATA_VERSION && s.coach && s.settings &&
    ["students", "bookings", "availability", "notifications", "packs"].every((k) => Array.isArray(s[k]));

  let state = readJSON(STORE_KEY);
  if (!isValid(state)) state = makeSeed();
  state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings);
  const save = () => writeJSON(STORE_KEY, state);
  save();

  // Re-read the saved data, so a change made in another tab is never missed or overwritten.
  // If storage is blocked, the copy in memory carries on.
  function reloadFromStorage() {
    const s = readJSON(STORE_KEY);
    if (!isValid(s)) return false;
    s.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings);
    state = s;
    return true;
  }

  // ---------- Lookups ----------
  const student = (id) => state.students.find((s) => s.id === id);
  const booking = (id) => state.bookings.find((b) => b.id === id);
  const first = (s) => s.name.split(" ")[0];
  const coachFirst = () => state.coach.name.split(" ")[0];
  const isTaken = (t) => state.bookings.some((b) => isBooked(b) && b.start === t);
  const openSlots = () => windowSlots(state.availability, 0, 6).filter((t) => !isTaken(t));
  const unpaid = () => state.bookings.filter(isUnpaid);
  const unpaidFees = () => state.bookings.filter(isFeeUnpaid);
  const unpaidPacks = () => state.packs.filter((p) => !p.paid);
  const owedFor = (list) => list.reduce((sum, b) => sum + (isUnpaid(b) ? b.price : 0) + (isFeeUnpaid(b) ? b.fee.amount : 0), 0);
  const packsOwed = (list) => list.reduce((sum, p) => sum + (p.paid ? 0 : p.price), 0);
  const owedTotal = () => owedFor(state.bookings) + packsOwed(state.packs);
  const owedBy = (sid) => owedFor(state.bookings.filter((b) => b.studentId === sid)) +
    packsOwed(state.packs.filter((p) => p.studentId === sid));

  // ---------- Packs of 10 or 20 sessions: all counted from the bookings ----------
  const pack = (id) => state.packs.find((p) => p.id === id);
  // Used: pack sessions that have finished, plus late cancels where the fee was taken as a pack session
  const packUsed = (p) => state.bookings.filter((b) => b.packId === p.id &&
    (isEnded(b) || (b.status === "cancelled" && b.packUsed))).length;
  const packReserved = (p) => state.bookings.filter((b) => b.packId === p.id && (isUpcoming(b) || isInProgress(b))).length;
  const packLeft = (p) => Math.max(0, p.size - packUsed(p));                    // counts down as sessions finish
  const packFree = (p) => Math.max(0, p.size - packUsed(p) - packReserved(p));  // still free to book
  const packsOf = (sid) => state.packs.filter((p) => p.studentId === sid).sort((a, b) => a.boughtAt - b.boughtAt);
  // The pack a new booking comes out of (oldest first), or none: then it's the student's normal rate
  const bookingPack = (sid) => packsOf(sid).filter((p) => packFree(p) > 0)[0] || null;
  // The pack to show: the oldest with sessions left, otherwise the latest one
  const shownPack = (sid) => { const ps = packsOf(sid); return ps.filter((p) => packLeft(p) > 0)[0] || ps[ps.length - 1] || null; };
  const perSession = (p) => Math.round(p.price / p.size);
  const sessionsText = (n) => `${n} session${n === 1 ? "" : "s"}`;
  const packPrice = (size) => size === 20 ? state.settings.pack20Price : state.settings.pack10Price;
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
    reloadFromStorage(); // last-second check against the latest saved data
    const s = student(studentId);
    if (!s || !openSlots().includes(start)) return null; // taken, past or not an open time
    const p = bookingPack(studentId);
    const b = {
      id: uid("b"), studentId, start, price: s.rate, // price locked to the booking
      status: "booked", confirmed: false, cancelledAt: null, cancelledBy: null,
      paid: null, paidAt: null, notes: null, createdAt: now()
    };
    if (p) { b.packId = p.id; b.price = perSession(p); } // one session from the pack, nothing owed
    state.bookings.push(b);
    notify(p
      ? `New booking: ${first(s)}, ${shortSlot(start)}, from pack (${packFree(p)} left)`
      : `New booking: ${first(s)}, ${shortSlot(start)}, ${money(b.price)}`);
    save();
    return b;
  }

  // Coach sells a pack. The price is locked to the pack when it's bought.
  function sellPack(studentId, size) {
    if (!student(studentId) || PACK_SIZES.indexOf(size) < 0) return null;
    const p = { id: uid("p"), studentId, size, price: packPrice(size), boughtAt: now(), paid: null, paidAt: null };
    state.packs.push(p);
    save();
    return p;
  }

  // Only a pack nobody has booked from yet can be removed (e.g. sold by mistake)
  function removePack(id) {
    const p = pack(id);
    if (!p || p.paid || state.bookings.some((b) => b.packId === id)) return false;
    state.packs = state.packs.filter((x) => x.id !== id);
    save();
    return true;
  }

  function markPackPaid(id, method) {
    const p = pack(id);
    if (!p || (method !== "Cash" && method !== "Revolut")) return;
    p.paid = method;
    p.paidAt = now();
    save();
  }

  function undoPackPaid(id) {
    const p = pack(id);
    if (!p) return;
    p.paid = null;
    p.paidAt = null;
    save();
  }

  // Returns the booking, null if it can't be confirmed, or "taken" if someone else got the slot first
  function confirmBooking(id, by) {
    reloadFromStorage(); // last-second check against the latest saved data
    const b = booking(id);
    if (!b || !isUpcoming(b) || b.confirmed) return null;
    // If another booking holds the same slot and was made first, this one loses the slot
    const beaten = state.bookings.some((o) => o.id !== b.id && isBooked(o) && o.start === b.start &&
      (o.createdAt < b.createdAt || (o.createdAt === b.createdAt && o.id < b.id)));
    if (beaten) {
      state.bookings = state.bookings.filter((o) => o.id !== b.id);
      save();
      return "taken";
    }
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
    // Locked too: changing the settings later doesn't change this fee.
    // On a pack booking, the fee is one session from the pack instead of money.
    if (fee > 0 && b.packId) b.packUsed = true;
    else if (fee > 0) b.fee = { amount: fee, pct: state.settings.feePct, paid: null, paidAt: null };
    if (by === "student") {
      const who = `${first(student(b.studentId))}, ${shortSlot(b.start)}`;
      if (b.packUsed) notify(`Late cancel: ${who}, 1 pack session used as the fee`);
      else notify(fee > 0 ? `Late-cancel fee: ${who}, ${money(fee)}` : `${isLateCancel(b) ? "Late cancel" : "Cancelled"}: ${who}`);
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
    if (!whole(next.pack10Price, 1, 10000)) return "10-session pack price: a whole number of euro from 1 to 10,000.";
    if (!whole(next.pack20Price, 1, 10000)) return "20-session pack price: a whole number of euro from 1 to 10,000.";
    state.settings = {
      feeMode: next.feeMode, feePct: next.feePct, windowHours: next.windowHours,
      nudgeThreshold: next.nudgeThreshold, payUpfront: !!next.payUpfront,
      pack10Price: next.pack10Price, pack20Price: next.pack20Price
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

  // Only plain web links are kept; nothing is uploaded, the link just opens in a new tab
  const isWebLink = (u) => /^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/i.test(u);

  function saveNotes(id, d) {
    const b = booking(id);
    if (!b || !isEnded(b)) return;
    const video = d.video.trim();
    b.notes = {
      techniques: d.techniques.slice(), text: d.text.trim(), homework: d.homework.trim(),
      video: isWebLink(video) ? video : "", sampleLink: false, at: now()
    };
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
    return `Open times for 1-to-1 sessions with Coach ${coachFirst()}, next 7 days:\n\n${lines.join("\n")}\n\n1 hour each, first come first served. Book here: ${bookingLink()}`;
  }

  // The coach's booking link: this page, opened at the demo
  function bookingLink() {
    const href = String(window.location.href).split("#")[0].split("?")[0];
    return /^https?:/.test(href) ? href + "#demo" : "https://kellyjason82.github.io/side-control/#demo";
  }

  // Shown when a slot went to someone else at the last second, with the next free times
  function takenMessage() {
    const next = openSlots().slice(0, 3).map(shortSlot);
    return "Sorry, that slot was just taken. " +
      (next.length ? `Next free times: ${next.join(", ")}.` : "No other free times in the next 7 days.");
  }

  // ---------- HTML helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Status icons, so no status relies on colour alone (each tag also has its text label)
  const ICON_PATHS = {
    tomorrow: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    late: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/><path d="M4 4l16 16"/>',
    unpaid: '<circle cx="12" cy="12" r="8.5"/><path d="M15 8.6a4 4 0 1 0 0 6.8M7.5 11h6M7.5 13.4h6"/>',
    notes: '<path d="M4.5 19.5h4l10-10-4-4-10 10z"/><path d="M13 7l4 4"/>',
    nudge: '<path d="M6 21V4M6 4.5h11l-2.5 4 2.5 4H6"/>',
    upfront: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3"/>',
    pack: '<rect x="3.5" y="8" width="13" height="12" rx="1.5"/><path d="M7.5 8V5.5a1.5 1.5 0 0 1 1.5-1.5h10a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-2.5"/>',
    now: '<circle cx="12" cy="12" r="4.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="8.5"/>'
  };
  const icon = (kind) => ICON_PATHS[kind]
    ? `<svg class="tag__icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICON_PATHS[kind]}</svg>`
    : "";
  const tag = (text, kind) => `<span class="tag tag--${kind}">${icon(kind)}${esc(text)}</span>`;

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
    if (fee > 0 && b.packId) text = `<strong>Tapping out now uses 1 session from your pack as the late-cancel fee.</strong> Still tap out?`;
    else if (fee > 0) text = `<strong>Tapping out now means a late-cancel fee of ${money(fee)}.</strong> Still tap out?`;
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
    if (b.packUsed) tags.push(tag("Fee: 1 pack session used", "pack"));
    return tags;
  };

  const hostOf = (u) => (String(u).match(/^https?:\/\/([^\/?#]+)/i) || [])[1] || "";

  function notesBody(b) {
    if (!b.notes) return "";
    const n = b.notes;
    const techniques = n.techniques && n.techniques.length
      ? `<ul class="chips chips--static">${n.techniques.map((t) => `<li class="chip">${esc(t)}</li>`).join("")}</ul>` : "";
    const homework = n.homework
      ? `<div class="hw"><p class="hw__label">Practise this</p><p class="hw__text">${esc(n.homework)}</p></div>` : "";
    const video = n.video && isWebLink(n.video)
      ? `<p class="video"><a href="${esc(n.video)}" target="_blank" rel="noopener noreferrer">Watch the video<span class="sr-only"> (opens in a new tab)</span> ↗</a>
          <span class="video__host">${esc(hostOf(n.video))}</span>${n.sampleLink ? ` <span class="tag tag--invented">Sample link</span>` : ""}</p>` : "";
    return techniques + (n.text ? `<p class="note-text">${esc(n.text)}</p>` : "") + homework + video;
  }

  // Belt badge: a small belt in the student's real belt colour, next to the belt name
  function beltLabel(belt) {
    const key = (String(belt).toLowerCase().match(/white|blue|purple|brown|black/) || ["none"])[0];
    return `<span class="belt belt--${key}" aria-hidden="true"></span>${esc(belt)}`;
  }

  // Small badges shown next to a student's name in the coach's lists (coach view only)
  function nameBadges(sid) {
    const p = shownPack(sid);
    const left = p ? packLeft(p) : 0;
    const badges = (p && left > 0 ? tag(`Pack: ${left} left`, "pack") : "") + (needsNudge(sid) ? tag("Needs a nudge", "nudge") : "");
    return badges ? `<span class="namebadges">${badges}</span>` : "";
  }

  // Pack status for one student, worked out from the bookings
  function packWarning(p) {
    if (!p) return "";
    const left = packLeft(p);
    if (left === 0) return tag("Pack used up", "pack");
    if (left <= PACK_WARN_AT) return tag(`${sessionsText(left)} left in pack`, "pack");
    return "";
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
    notesDraft: { techniques: [], text: "", homework: "", video: "" },
    moneyMonth: 0,       // 0 = this month, -1 = last month, ...
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
        <p class="remind__text">Your private is tomorrow at ${fmtTime(b.start)}, ${b.packId ? "1 session from your pack" : money(b.price)}.</p>
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
        return item({ when: whenLabel(b.start), price: b.packId ? "Pack" : money(b.price), tags: cancelTags(b), cls: "item--cancelled" });
      }
      if (isInProgress(b)) tags.push(tag("On the mat now", "now"));
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
      return item({ when: whenLabel(b.start), price: b.packId ? "Pack<span>1 session</span>" : `${money(b.price)}<span>locked</span>`, tags, body, actions });
    }).join("");

    // Book a session: open slots for the next 7 days, grouped by day.
    // With a pack that has sessions free, a booking uses one of them instead of costing money.
    const bp = bookingPack(s.id);
    const slotPrice = bp ? "Pack" : money(s.rate);
    const groups = groupByDay(openSlots());
    const slotHTML = groups.map((g) => {
      const label = daysFromToday(g.key) <= 1 ? `${dayLabel(g.key)}, ${fmtDate(g.key)}` : fmtDate(g.key);
      const picked = g.slots.includes(ui.selectedSlot) ? ui.selectedSlot : null;
      const buttons = g.slots.map((t) => `<button type="button" class="slot" data-action="pick-slot" data-start="${t}" aria-pressed="${t === picked}">
          <span class="slot__time">${fmtTime(t)}</span><span class="slot__price">${slotPrice}</span>
        </button>`).join("");
      const sheet = picked ? `<div class="sheet" role="group" aria-label="Book this slot">
          <p class="sheet__when">${fmtDate(picked)}, ${fmtTime(picked)}–${fmtTime(picked + SESSION)}</p>
          <p class="sheet__meta">1-to-1 with Coach ${esc(coachFirst())} · 60 minutes</p>
          ${bp
            ? `<p class="sheet__price sheet__price--pack">1 session from your pack (${packFree(bp)} left)</p>`
            : `<p class="sheet__price">${money(s.rate)} <span>your price, locked when you book</span></p>`}
          <div class="item__actions">
            <button type="button" class="btn btn--primary" data-action="book" data-start="${picked}">${bp ? "Book with my pack" : "Book for " + money(s.rate)}</button>
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
        const tags = [b.packId ? tag("From your pack", "ok") : b.paid ? tag(`Paid · ${b.paid}`, "ok") : tag("To pay", "unpaid")];
        const body = b.notes ? notesBody(b) : `<p class="item__sub">Coach ${esc(coachFirst())} hasn't logged notes for this one yet.</p>`;
        return item({ when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, price: b.packId ? "Pack" : money(b.price), tags, body });
      }).join("");

    // Your pack, if you have one
    const sp = shownPack(s.id);
    let packHTML = "";
    if (sp) {
      const left = packLeft(sp), booked = packReserved(sp);
      packHTML = `<div class="packbox${left <= PACK_WARN_AT ? " packbox--warn" : ""}">
          <p class="packbox__title">Your ${sp.size}-session pack</p>
          <p class="packbox__left">${left === 0 ? "All used" : `${sessionsText(left)} left`}${booked ? ` <span>(${booked} booked)</span>` : ""}</p>
          ${packWarning(sp) ? `<p class="item__tags">${packWarning(sp)}</p>` : ""}
          <p class="item__sub">${left === 0
            ? `New bookings are back at your rate of ${money(s.rate)}. Ask Coach ${esc(coachFirst())} about another pack.`
            : `Each booking uses 1 session. ${money(sp.price)} for ${sp.size}, ${sp.paid ? "paid" : "not paid yet"}.`}</p>
        </div>`;
    }

    return `
      <div class="vhead">
        <div>
          <p class="vhead__eyebrow">Next Stripe</p>
          <p class="vhead__name">${esc(s.name)}</p>
          <p class="vhead__meta">${beltLabel(s.belt)} · Your price with Coach ${esc(coachFirst())}: <strong>${money(s.rate)}</strong> per session</p>
        </div>
      </div>
      <div class="stats stats--two">
        <div class="stat"><span class="stat__label">Private lessons completed</span><span class="stat__value">${completedBy(s.id)}</span></div>
        <div class="stat"><span class="stat__label">Hours on the mat</span><span class="stat__value">${hoursBy(s.id)}</span></div>
      </div>
      ${packHTML}
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

    const counts = { money: unpaid().length + unpaidFees().length + unpaidPacks().length, notes: toLog };
    const tabs = `<div class="tabs" role="tablist" aria-label="Coach screens">${TABS.map((t) =>
      `<button type="button" class="tab" role="tab" id="tab-${t.id}" data-action="tab" data-tab="${t.id}" aria-selected="${ui.coachTab === t.id}" aria-controls="coach-panel">${t.label}${counts[t.id] ? `<span class="tab__count">${counts[t.id]}</span>` : ""}</button>`).join("")}</div>`;

    const screens = { diary: coachDiary, money: coachMoney, notes: coachNotes, students: coachStudents, times: coachTimes, settings: coachSettings };

    return `
      <div class="vhead">
        <div>
          <p class="vhead__eyebrow">Coach</p>
          <p class="vhead__name">Coach ${esc(state.coach.name)}</p>
          <p class="vhead__meta">${beltLabel(state.coach.belt)} · ${esc(state.coach.academy)} (invented)</p>
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
    if (isInProgress(b)) tags.push(tag("On the mat now", "now"));
    if (isTomorrow(b)) tags.push(tag("Tomorrow", "tomorrow"));
    tags.push(b.confirmed ? tag("Confirmed", "ok") : tag("Not confirmed yet", "muted"));
    const nudge = isUpcoming(b) && needsNudge(s.id);
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
      when: whenLabel(b.start), who: `${esc(s.name)} · ${beltLabel(s.belt)}${nameBadges(s.id)}`, price: b.packId ? "Pack<span>1 session</span>" : money(b.price),
      tags, body, actions, cls: isTomorrow(b) ? "item--tomorrow" : ""
    });
  }

  // Packs on the coach's home screen: every student with a pack in use, with the low-sessions warning
  function packsOverview() {
    const rows = state.students.map((s) => ({ s, p: shownPack(s.id) })).filter((x) => x.p && packLeft(x.p) > 0);
    const body = rows.length ? `<ul class="packs-ov">${rows.map(({ s, p }) => {
      const left = packLeft(p);
      return `<li class="packs-ov__row${left <= PACK_WARN_AT ? " packs-ov__row--warn" : ""}">
          <div><p class="packs-ov__name">${esc(s.name)}</p><p class="packs-ov__meta">${p.size}-session pack · ${sessionsText(left)} left${p.paid ? "" : " · not paid yet"}</p>
          ${packWarning(p) ? `<p class="item__tags">${packWarning(p)}</p>` : ""}</div>
          <button type="button" class="btn btn--small btn--quiet" data-action="open-card" data-sid="${s.id}" aria-label="Open ${esc(s.name)}'s card">Card</button>
        </li>`;
    }).join("")}</ul>` : `<p class="dm-empty">No packs in use. Sell one from a student's card in the Students tab.</p>`;
    return `<h4 class="dm-sub">Packs</h4>${body}`;
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
        when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(s.name) + nameBadges(s.id), price: b.packId ? "Pack" : money(b.price),
        tags: cancelTags(b),
        body: `<p class="item__sub">Cancelled by ${b.cancelledBy === "coach" ? "you" : "the student"}, ${Math.max(0, Math.round((b.start - b.cancelledAt) / HOUR))} hours before the start.</p>`,
        cls: "item--cancelled"
      });
    }).join("")}</ul>` : "";

    return packsOverview() + (today.length ? group("Today", today, "") : "") +
      group("Tomorrow", tomorrow, "Nothing booked for tomorrow.") +
      group("Coming up", later, "Nothing else booked yet. Share your open times to fill the week.") +
      cancelHTML;
  }

  // ---------- Monthly money summary: every figure counted from the data ----------
  const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Start and end of a month (offset 0 = this month, -1 = last month), built from numbers
  function monthRange(offset) {
    const d = new Date(now());
    const from = new Date(d.getFullYear(), d.getMonth() + offset, 1, 0, 0, 0, 0);
    const to = new Date(d.getFullYear(), d.getMonth() + offset + 1, 1, 0, 0, 0, 0);
    return { from: from.getTime(), to: to.getTime(), label: `${MONTH_NAMES[from.getMonth()]} ${from.getFullYear()}`, year: from.getFullYear(), month: from.getMonth() + 1 };
  }

  // Every money record that belongs to a month:
  // payments by the day they were marked paid; losses and amounts owed by the session (or pack) date.
  function monthRecords(offset) {
    const r = monthRange(offset);
    const inMonth = (t) => t != null && t >= r.from && t < r.to;
    const name = (sid) => student(sid).name;
    const out = [];
    state.bookings.forEach((b) => {
      if (b.paid && !b.packId && inMonth(b.paidAt)) out.push({ at: b.paidAt, who: name(b.studentId), item: `Session payment (${fmtDate(b.start)}, ${fmtTime(b.start)})`, amount: b.price, kind: "taken", method: b.paid });
      if (b.fee && b.fee.paid && inMonth(b.fee.paidAt)) out.push({ at: b.fee.paidAt, who: name(b.studentId), item: `Late-cancel fee (${fmtDate(b.start)}, ${fmtTime(b.start)})`, amount: b.fee.amount, kind: "taken", method: b.fee.paid, fee: true });
      if (b.cancelledBy === "student" && isLateCancel(b) && !b.fee && !b.packUsed && inMonth(b.start)) out.push({ at: b.start, who: name(b.studentId), item: "Late cancel, no fee charged", amount: b.price, kind: "lost", method: "" });
      if (isUnpaid(b) && inMonth(b.start)) out.push({ at: b.start, who: name(b.studentId), item: "Session, not paid yet", amount: b.price, kind: "owed", method: "" });
      if (isFeeUnpaid(b) && inMonth(b.start)) out.push({ at: b.start, who: name(b.studentId), item: "Late-cancel fee, not paid yet", amount: b.fee.amount, kind: "owed", method: "" });
    });
    state.packs.forEach((p) => {
      if (p.paid && inMonth(p.paidAt)) out.push({ at: p.paidAt, who: name(p.studentId), item: `${p.size}-session pack payment`, amount: p.price, kind: "taken", method: p.paid });
      if (!p.paid && inMonth(p.boughtAt)) out.push({ at: p.boughtAt, who: name(p.studentId), item: `${p.size}-session pack, not paid yet`, amount: p.price, kind: "owed", method: "" });
    });
    return out.sort((a, b) => a.at - b.at);
  }

  function monthSummary(offset) {
    const recs = monthRecords(offset);
    const sum = (f) => recs.filter(f).reduce((t, x) => t + x.amount, 0);
    return {
      range: monthRange(offset), records: recs,
      taken: sum((x) => x.kind === "taken"),
      cash: sum((x) => x.kind === "taken" && x.method === "Cash"),
      revolut: sum((x) => x.kind === "taken" && x.method === "Revolut"),
      fees: sum((x) => x.kind === "taken" && x.fee),
      lost: sum((x) => x.kind === "lost"),
      owed: sum((x) => x.kind === "owed")
    };
  }

  // CSV of one month's records. Cells are quoted, and cells starting with = + - @ are made safe for spreadsheets.
  function monthCSV(offset) {
    const m = monthSummary(offset);
    const cell = (v) => { let s = String(v); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const STATUS = { taken: "Taken", lost: "Lost to cancellation", owed: "Still owed" };
    const lines = [["Date", "Time", "Student", "Item", "Amount (EUR)", "Status", "Paid by"].map(cell).join(",")];
    m.records.forEach((x) => {
      const d = new Date(x.at);
      lines.push([`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, fmtTime(x.at), x.who, x.item, x.amount, STATUS[x.kind], x.method].map(cell).join(","));
    });
    lines.push("");
    [["Taken", m.taken], ["Taken in cash", m.cash], ["Taken by Revolut", m.revolut], ["Late-cancel fees recovered", m.fees], ["Lost to cancellations", m.lost], ["Still owed", m.owed]]
      .forEach((row) => lines.push([row[0], row[1]].map(cell).join(",")));
    return { text: lines.join("\r\n"), name: `side-control-${m.range.year}-${pad(m.range.month)}.csv` };
  }

  // Saves the file to this device. Nothing is sent anywhere.
  function downloadCSV(offset) {
    const f = monthCSV(offset);
    const blob = new Blob(["﻿" + f.text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return f.name;
  }

  function moneySummaryHTML() {
    const m = monthSummary(ui.moneyMonth);
    const title = ui.moneyMonth === 0 ? "This month" : m.range.label;
    return `<section class="month" aria-labelledby="month-title">
        <div class="month__nav">
          <button type="button" class="btn btn--quiet month__arrow" data-action="month-prev" aria-label="Previous month">‹</button>
          <div class="month__label"><h4 class="dm-h" id="month-title">${title}</h4>${ui.moneyMonth === 0 ? `<p>${m.range.label}</p>` : ""}</div>
          <button type="button" class="btn btn--quiet month__arrow" data-action="month-next" aria-label="Next month"${ui.moneyMonth >= 0 ? " disabled" : ""}>›</button>
        </div>
        <dl class="month__grid">
          <div class="month__cell month__cell--wide"><dt>Taken</dt><dd>${money(m.taken)}</dd><p>Cash ${money(m.cash)} · Revolut ${money(m.revolut)}</p></div>
          <div class="month__cell"><dt>Late-cancel fees recovered</dt><dd>${money(m.fees)}</dd></div>
          <div class="month__cell"><dt>Lost to cancellations</dt><dd>${money(m.lost)}</dd></div>
          <div class="month__cell month__cell--wide"><dt>Still owed</dt><dd>${money(m.owed)}</dd><p>Sessions, fees and packs dated in ${m.range.label}, not paid yet.</p></div>
        </dl>
        <p class="item__sub">Taken counts session payments, pack payments and paid fees, by the day you marked them paid. Lost means late cancels where no fee was charged. All counted from your bookings.</p>
        <div class="item__actions">
          <button type="button" class="btn btn--quiet" data-action="download-csv">Download CSV (${m.records.length} record${m.records.length === 1 ? "" : "s"})</button>
        </div>
        <p class="wa-note">Saves a file to this device. Nothing is sent anywhere.</p>
      </section>`;
  }

  function coachMoney() {
    // Things owed: finished sessions not paid, late-cancel fees not paid, and packs not paid
    const owing = unpaid().map((b) => ({ b, fee: false }))
      .concat(unpaidFees().map((b) => ({ b, fee: true })))
      .sort((x, y) => x.b.start - y.b.start);
    const owed = owedTotal();
    const recent = (b) => b.start > now() - 21 * DAY;
    const paid = state.bookings.filter((b) => isEnded(b) && b.paid && recent(b)).map((b) => ({ b, fee: false, at: b.paidAt }))
      .concat(state.bookings.filter((b) => b.fee && b.fee.paid && recent(b)).map((b) => ({ b, fee: true, at: b.fee.paidAt })))
      .sort((x, y) => y.b.start - x.b.start);
    const packsDue = unpaidPacks().sort((a, b) => a.boughtAt - b.boughtAt);
    const packsPaid = state.packs.filter((p) => p.paid && p.paidAt > now() - 21 * DAY).sort((a, b) => b.paidAt - a.paidAt);
    const packItem = (p, isPaid) => item({
      when: `${p.size}-session pack`, who: `${esc(student(p.studentId).name)} · bought ${fmtDate(p.boughtAt)}${nameBadges(p.studentId)}`, price: money(p.price),
      tags: isPaid ? [tag(`Paid · ${p.paid}`, "ok")] : [tag("Unpaid", "unpaid")], cls: isPaid ? "" : "item--unpaid",
      actions: isPaid
        ? `<button type="button" class="btn btn--small btn--quiet" data-action="undo-pack-paid" data-pack="${p.id}">Undo</button>`
        : ["Cash", "Revolut"].map((m) => `<button type="button" class="btn btn--quiet" data-action="pack-paid" data-method="${m}" data-pack="${p.id}">Paid: ${m}</button>`).join("")
    });

    const payButtons = (b, fee) => ["Cash", "Revolut"].map((m) =>
      `<button type="button" class="btn btn--quiet" data-action="${fee ? "fee-paid" : "paid"}" data-method="${m}" data-id="${b.id}">Paid: ${m}</button>`).join("");

    const owingHTML = owing.map(({ b, fee }) => {
      const s = student(b.studentId);
      return item({
        when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(s.name) + nameBadges(s.id), price: money(fee ? b.fee.amount : b.price),
        tags: fee ? [tag("Late-cancel fee", "unpaid"), tag("Unpaid", "unpaid")] : [tag("Unpaid", "unpaid")],
        body: fee ? `<p class="item__sub">${b.fee.pct}% of the ${money(b.price)} session. Locked when ${esc(first(s))} tapped out.</p>` : "",
        cls: "item--unpaid", actions: payButtons(b, fee)
      });
    }).join("");

    const paidHTML = paid.map(({ b, fee }) => item({
      when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(student(b.studentId).name) + nameBadges(b.studentId), price: money(fee ? b.fee.amount : b.price),
      tags: fee ? [tag("Late-cancel fee", "muted"), tag(`Paid · ${b.fee.paid}`, "ok")] : [tag(`Paid · ${b.paid}`, "ok")],
      actions: `<button type="button" class="btn btn--small btn--quiet" data-action="${fee ? "undo-fee-paid" : "undo-paid"}" data-id="${b.id}">Undo</button>`
    })).join("");

    const nSessions = owing.filter((o) => !o.fee).length;
    const nFees = owing.length - nSessions;
    const parts = [];
    if (nSessions) parts.push(`${nSessions} finished session${nSessions > 1 ? "s" : ""}`);
    if (nFees) parts.push(`${nFees} late-cancel fee${nFees > 1 ? "s" : ""}`);
    if (packsDue.length) parts.push(`${packsDue.length} pack${packsDue.length > 1 ? "s" : ""}`);
    const allOwing = owingHTML + packsDue.map((p) => packItem(p, false)).join("");
    const allPaid = paidHTML + packsPaid.map((p) => packItem(p, true)).join("");

    // This month's summary first, with Download CSV under it
    return `${moneySummaryHTML()}
      <div class="owed${owed ? "" : " owed--clear"}" style="margin-top:16px">
        <p class="owed__label">Owed to you, all time</p>
        <p class="owed__value">${money(owed)}</p>
        <p>${parts.length ? `${parts.join(", ")} not marked paid yet.` : "All square. Nobody owes you anything."}</p>
      </div>
      <h4 class="dm-sub">Unpaid</h4>
      ${allOwing ? `<ul class="list">${allOwing}</ul>` : `<p class="dm-empty">Nothing unpaid.</p>`}
      <h4 class="dm-sub">Paid, last 3 weeks</h4>
      ${allPaid ? `<ul class="list">${allPaid}</ul>` : `<p class="dm-empty">No payments marked yet.</p>`}`;
  }

  function notesEditor(b) {
    const d = ui.notesDraft;
    return `<div class="editor">
      <p class="editor__hint">Tap what you covered. Add a line if you want.</p>
      <div class="chips" role="group" aria-label="Techniques covered">${TECHNIQUES.map((t) =>
        `<button type="button" class="chip" data-action="chip" data-tech="${esc(t)}" aria-pressed="${d.techniques.includes(t)}">${esc(t)}</button>`).join("")}</div>
      <label class="editor__label" for="notes-text">Anything else? (optional)</label>
      <textarea id="notes-text" class="editor__text" rows="3" maxlength="400" placeholder="e.g. Keep the elbow tight on the cut">${esc(d.text)}</textarea>
      <label class="editor__label" for="notes-homework">Practise this (optional)</label>
      <textarea id="notes-homework" class="editor__text" rows="2" maxlength="300" placeholder="e.g. 20 knee cut entries each side before Thursday">${esc(d.homework)}</textarea>
      <label class="editor__label" for="notes-video">Video link (optional)</label>
      <input id="notes-video" class="editor__text" type="url" inputmode="url" autocomplete="off" maxlength="500" placeholder="https://…" value="${esc(d.video)}" aria-describedby="notes-video-hint">
      <p class="editor__hint" id="notes-video-hint">A link to a video you've found or filmed. It opens in a new tab. Nothing is uploaded.</p>
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
      const tags = isTodo ? [tag("Needs notes", "notes")] : [];
      if (isUnpaid(b)) tags.push(tag("Unpaid", "unpaid"));
      return item({
        when: `${fmtDate(b.start)}, ${fmtTime(b.start)}`, who: esc(s.name) + " · " + beltLabel(s.belt) + nameBadges(s.id), tags,
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
        ${packPanel(s)}
      </div>`;
  }

  // Packs on the coach's student card: what they have, and selling a new one
  function packPanel(s) {
    const ps = packsOf(s.id);
    const rows = ps.slice().reverse().map((p) => {
      const left = packLeft(p), booked = packReserved(p);
      const canRemove = !p.paid && !state.bookings.some((b) => b.packId === p.id);
      return `<div class="packrow">
          <p class="packrow__head"><strong>${p.size}-session pack</strong> · ${money(p.price)} · bought ${fmtDate(p.boughtAt)}</p>
          <p class="packrow__left">${left === 0 ? "All used" : `${sessionsText(left)} left`}${booked ? ` (${booked} booked)` : ""}</p>
          <p class="item__tags">${p.paid ? tag(`Paid · ${p.paid}`, "ok") : tag("Unpaid", "unpaid")} ${packWarning(p)}</p>
          ${p.paid ? "" : `<div class="item__actions">${["Cash", "Revolut"].map((m) =>
            `<button type="button" class="btn btn--quiet" data-action="pack-paid" data-method="${m}" data-pack="${p.id}">Paid: ${m}</button>`).join("")}
            ${canRemove ? `<button type="button" class="btn btn--quiet" data-action="remove-pack" data-pack="${p.id}">Remove</button>` : ""}</div>`}
        </div>`;
    }).join("");
    return `<div class="packs">
        <p class="packs__title">Packs</p>
        ${rows || `<p class="item__sub">No pack yet. ${esc(first(s))} pays per session at ${money(s.rate)}.</p>`}
        <div class="item__actions">${PACK_SIZES.map((n) =>
          `<button type="button" class="btn btn--quiet" data-action="sell-pack" data-sid="${s.id}" data-size="${n}">Sell ${n} for ${money(packPrice(n))}</button>`).join("")}</div>
        <p class="item__sub">Pack prices are set in Settings (sample figures). The price is locked when the pack is sold. Each booking uses 1 session, counted off when the session ends.</p>
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
            <p class="item__who">${beltLabel(s.belt)}${s.rate !== state.standardRate ? " · own rate" : ""}</p>
            ${needsNudge(s.id) || packWarning(shownPack(s.id)) ? `<p class="item__tags">${needsNudge(s.id) ? tag("Needs a nudge", "nudge") : ""}${packWarning(shownPack(s.id))}</p>` : ""}
          </div>
          <div class="rate-edit">
            <label class="sr-only" for="rate-${s.id}">Rate for ${esc(s.name)} in euro</label>
            <span class="rate-edit__euro" aria-hidden="true">€</span>
            <input id="rate-${s.id}" type="number" inputmode="numeric" min="0" max="500" step="5" value="${s.rate}">
            <button type="button" class="btn btn--small btn--quiet" data-action="save-rate" data-sid="${s.id}">Save</button>
          </div>
        </div>
        ${next ? `<p class="item__sub">Next booked: ${fmtDate(next.start)}, ${fmtTime(next.start)} ${next.packId ? "from their pack" : `at ${money(next.price)} (locked)`}</p>` : ""}
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
        <p class="dm-intro" style="margin-top:16px">Your rules for late cancels and your pack prices. Saved on this device.</p>
        <fieldset class="set-group">
          <legend>Late-cancel fee</legend>
          <div class="opts">${FEE_MODES.map((m) => `<label class="opt"><input type="radio" name="feeMode" value="${m.id}"${st.feeMode === m.id ? " checked" : ""}> ${m.label}</label>`).join("")}</div>
        </fieldset>
        ${num("set-pct", "Fee amount (% of the session price)", st.feePct, 0, 100, 5, "%")}
        ${num("set-window", "Late-cancel window (hours before the start)", st.windowHours, 1, 72, 1, "hours")}
        ${num("set-threshold", "“Needs a nudge” after this many late cancels in the last 90 days", st.nudgeThreshold, 1, 10, 1, "late cancels")}
        <label class="opt opt--check"><input type="checkbox" id="set-upfront"${st.payUpfront ? " checked" : ""}> Pay upfront for “Needs a nudge” students</label>
        <p class="item__sub">Their bookings show “Pay upfront required”. Taking the payment in the app is <span class="tag tag--planned">Planned</span></p>
        <h4 class="dm-sub">Pack prices</h4>
        ${num("set-pack10", "Pack of 10 sessions (sample figure)", st.pack10Price, 1, 10000, 10, "euro")}
        ${num("set-pack20", "Pack of 20 sessions (sample figure)", st.pack20Price, 1, 10000, 10, "euro")}
        <p class="item__sub">A pack keeps the price it was sold at, even if you change these later.</p>
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
      payUpfront: f.querySelector("#set-upfront").checked,
      pack10Price: Number(f.querySelector("#set-pack10").value),
      pack20Price: Number(f.querySelector("#set-pack20").value)
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
      case "sell-pack": {
        const p = sellPack(el.dataset.sid, Number(el.dataset.size));
        if (p) flash(`${first(student(p.studentId))} has a ${p.size}-session pack for ${money(p.price)}. Mark it paid when the money comes in. Their next bookings use the pack.`);
        ui.focus = ".dm-flash";
        return true;
      }
      case "remove-pack":
        if (removePack(el.dataset.pack)) flash("Pack removed.");
        return true;
      case "pack-paid": {
        const p = pack(el.dataset.pack);
        markPackPaid(el.dataset.pack, el.dataset.method);
        if (p) flash(`${first(student(p.studentId))}'s ${p.size}-session pack: paid by ${el.dataset.method}. Owed to you is now ${money(owedTotal())}.`);
        return true;
      }
      case "undo-pack-paid":
        undoPackPaid(el.dataset.pack);
        flash(`Pack back to unpaid. Owed to you is now ${money(owedTotal())}.`);
        return true;
      case "month-prev":
        ui.moneyMonth -= 1;
        ui.focus = '[data-action="month-prev"]';
        return true;
      case "month-next":
        if (ui.moneyMonth < 0) ui.moneyMonth += 1;
        ui.focus = ui.moneyMonth < 0 ? '[data-action="month-next"]' : '[data-action="month-prev"]';
        return true;
      case "download-csv":
        try {
          const name = downloadCSV(ui.moneyMonth);
          flash(`Downloaded ${name} to this device. Nothing was sent anywhere.`);
        } catch (e) {
          flash("This browser couldn't save the file. Try another browser.", "warn");
        }
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
      case "open-card": // from the Packs block on the Diary: jump to that student's card
        ui.coachTab = "students";
        ui.cardFor = el.dataset.sid;
        ui.focus = `[data-action="student-card"][data-sid="${el.dataset.sid}"]`;
        saveUI();
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
        { const r = confirmBooking(id, "coach"); if (r === "taken") flash(takenMessage(), "warn"); else if (r) flash("Marked as confirmed."); }
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
        const n = b && b.notes ? b.notes : null;
        ui.notesDraft = { techniques: n ? n.techniques.slice() : [], text: n ? n.text : "", homework: n && n.homework ? n.homework : "", video: n && n.video ? n.video : "", error: "" };
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
        if (d.video.trim() && !isWebLink(d.video.trim())) {
          d.error = "The video link needs to start with http:// or https://";
          return true;
        }
        if (!d.techniques.length && !d.text.trim() && !d.homework.trim()) {
          d.error = "Tap at least one technique, or write a line or something to practise.";
          return true;
        }
        const b = booking(id);
        saveNotes(id, d);
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
  // Show which version of the demo script this browser is running
  const versionEl = document.getElementById("demo-version");
  if (versionEl) versionEl.textContent = APP_VERSION;

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

    // "Sample students worth a look": each name jumps straight to that student
    const samples = document.querySelector(".samples");
    if (samples) samples.addEventListener("click", (event) => {
      const el = event.target.closest("[data-jump]");
      if (!el) return;
      const sid = el.dataset.sid;
      if (!student(sid)) return;
      reloadFromStorage();
      clearTransient();
      ui.flash = null;
      if (el.dataset.jump === "coach-card") {
        ui.view = "coach";
        ui.coachTab = "students";
        ui.cardFor = sid;
        ui.focus = `[data-action="student-card"][data-sid="${sid}"]`;
      } else {
        ui.view = "student";
        ui.studentId = sid;
      }
      saveUI();
      render();
      // Bring the student into view: the card for the coach, the top of the demo for Next Stripe
      const target = ui.view === "coach" ? app.querySelector("#card-" + sid) : document.querySelector(".demo__controls");
      if (target && target.scrollIntoView) target.scrollIntoView({ block: "start" });
      if (ui.view === "student") { app.setAttribute("tabindex", "-1"); app.focus({ preventScroll: true }); }
    });

    // Another tab on this device changed the data (a booking, a cancellation, a reset...): refresh this one
    window.addEventListener("storage", (event) => {
      if (event.key !== STORE_KEY || !reloadFromStorage()) return;
      if (ui.selectedSlot && !openSlots().includes(ui.selectedSlot)) {
        ui.selectedSlot = null;
        ui.flash = { text: takenMessage(), kind: "warn", view: ui.view }; // no focus jump in a background tab
      }
      if (ui.cancelAsk && !booking(ui.cancelAsk)) ui.cancelAsk = null;
      if (ui.notesFor && !booking(ui.notesFor)) ui.notesFor = null;
      if (ui.settingsDirty) return; // don't wipe settings the coach is still editing
      const active = document.activeElement;
      if (active && app.contains(active) && /INPUT|TEXTAREA|SELECT/.test(active.tagName)) return; // mid-typing
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
        // Reset wipes everything this demo saved on the device, so the tips come back too
        try { window.localStorage.removeItem(HINT_KEY); } catch (e) { storageOK = false; }
        const tips = document.getElementById("demo-hint");
        if (tips) tips.hidden = false;
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
      // Work from the latest saved data, in case another tab changed something
      reloadFromStorage();

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
          else flash(takenMessage(), "warn");
          break;
        }
        case "s-confirm":
          { const r = confirmBooking(id, "student"); if (r === "taken") flash(takenMessage(), "warn"); else if (r) flash(`Oss! Confirmed. Coach ${coachFirst()} can see it.`); }
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
      if (event.target.id === "notes-homework") ui.notesDraft.homework = event.target.value;
      if (event.target.id === "notes-video") ui.notesDraft.video = event.target.value;
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

  // ---------- "Try this" hint strip: dismissible, remembered on this device ----------
  const HINT_KEY = "sidecontrol.hint.v1";
  const hint = document.getElementById("demo-hint");
  if (hint) {
    const saved = readJSON(HINT_KEY);
    if (saved && saved.dismissed) hint.hidden = true;
    const close = document.getElementById("demo-hint-close");
    if (close) close.addEventListener("click", () => {
      hint.hidden = true;
      writeJSON(HINT_KEY, { dismissed: true });
      const bar = document.getElementById("reset-demo");
      if (bar) bar.focus(); // keep keyboard focus somewhere sensible
    });
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
