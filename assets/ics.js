/* MovieTimelines — calendar (.ics) watch plans. Pure logic, no DOM; extends window.MT (core.js first). */
(function (global) {
  const MT = global.MT || (global.MT = {});
  const pad = (n) => String(n).padStart(2, '0');
  const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const utc = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  const esc = (s) => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[;,]/g, (m) => '\\' + m);

  // RFC 5545 §3.1: lines are folded at 75 octets (continuations start with one space, so 74 of content).
  function fold(line) {
    const enc = new TextEncoder();
    const parts = []; let cur = '', bytes = 0, limit = 75;
    for (const ch of line) {
      const b = enc.encode(ch).length;
      if (bytes + b > limit) { parts.push(cur); cur = ''; bytes = 0; limit = 74; }
      cur += ch; bytes += b;
    }
    parts.push(cur);
    return parts.join('\r\n ');
  }

  // events: [{ uid, start: Date, minutes, summary, description?, url? }]. Times are "floating" local
  // times (no zone), so they land at the same wall-clock hour wherever the calendar is opened.
  MT.buildIcs = (events, opts) => {
    const o = Object.assign({ calName: 'MovieTimelines watch plan', now: new Date() }, opts);
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MovieTimelines//Watch Plan//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(o.calName)}`];
    events.forEach((e) => {
      const end = new Date(e.start.getTime() + Math.max(1, e.minutes) * 60000);
      lines.push('BEGIN:VEVENT', `UID:${e.uid}@timelines.hackatoa.com`, `DTSTAMP:${utc(o.now)}`, `DTSTART:${local(e.start)}`, `DTEND:${local(end)}`, `SUMMARY:${esc(e.summary)}`);
      if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
      if (e.url) lines.push(`URL:${e.url}`);
      lines.push('END:VEVENT');
    });
    lines.push('END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  };

  // One event per selected franchise per day (its next unit(s) to watch), stacked from `hour:minute`.
  // entries: [{ data, done:Set, skip:Set, filters }]. UIDs are stable (franchise + episode), so
  // re-importing an updated plan replaces events instead of duplicating them.
  MT.buildPlan = (entries, opts) => {
    const o = Object.assign({ start: new Date(), hour: 19, minute: 0, days: 14, perDay: 1, gapMin: 10 }, opts);
    const queues = entries.map((en) => MT.watchQueue(en.data, en.done, en.skip, en.filters, o.days * o.perDay));
    const events = [];
    for (let d = 0; d < o.days; d++) {
      const cursor = new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate() + d, o.hour, o.minute, 0);
      entries.forEach((en, i) => {
        queues[i].slice(d * o.perDay, d * o.perDay + o.perDay).forEach((u) => {
          events.push({
            uid: `${en.data.id}-${u.id}`, start: new Date(cursor), minutes: u.min,
            summary: `\u{1F3AC} ${u.title}${u.title.startsWith(en.data.title) ? '' : ' \u2014 ' + en.data.title}`,
            description: `Next up in ${en.data.title}.`, url: `https://timelines.hackatoa.com/franchise.html?f=${encodeURIComponent(en.data.id)}`,
          });
          cursor.setMinutes(cursor.getMinutes() + u.min + o.gapMin);
        });
      });
    }
    return events;
  };
})(window);
