const DAY = 86400000
const TEMPLATES = {
  standup: ['What did you finish?', 'What is next?'],
  wins: ['What went well this week?', 'Who helped you?'],
  retro: ['What should we keep doing?', 'What should we change?']
}
function localTime(now, zone) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(now).map(x => [x.type, x.value]))
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`,
    day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) }
}
function validTime(value) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) }
function validateConfig(c) {
  try { localTime(Date.now(), c.zone) } catch { throw new Error('Use an IANA time zone, such as Asia/Tokyo.') }
  if (!c.zone || !validTime(c.time) || !validTime(c.digestTime) || c.digestTime <= c.time)
    throw new Error('Use HH:MM times, with the digest later than the check-in.')
  if (!c.days?.length || c.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Error('Choose at least one weekday.')
  if (!c.members?.length || c.members.length > 50) throw new Error('Choose 1–50 participants.')
  if (!c.questions?.length || c.questions.length > 5 || c.questions.some(q => !q.trim() || q.length > 150))
    throw new Error('Provide 1–5 questions, each at most 150 characters.')
  if (![7, 30, 90].includes(c.retentionDays)) throw new Error('Retention must be 7, 30, or 90 days.')
  return c
}
function mayRemind(p = {}, now, zone) {
  if (p.disabled || p.snoozeUntil > now || p.leaveUntil >= localTime(now, p.zone || zone).date) return false
  const time = localTime(now, p.zone || zone).time
  const start = p.quietStart || '18:00', end = p.quietEnd || '09:00'
  const quiet = start === end ? false : start < end ? time >= start && time < end : time >= start || time < end
  return !quiet
}
function nextInRotation(members, history = [], excluded = []) {
  const eligible = [...new Set(members)].filter(u => !excluded.includes(u))
  if (!eligible.length) throw new Error('No eligible teammates remain.')
  const last = u => history.lastIndexOf(u)
  return eligible.sort((a, b) => last(a) - last(b) || a.localeCompare(b))[0]
}
function insights(runs, responses, blockers, now) {
  return [0, 1].map(week => {
    const end = now - week * 7 * DAY, start = end - 7 * DAY
    const selected = runs.filter(r => r.at >= start && r.at < end)
    const ids = new Set(selected.map(r => r.id))
    const expected = selected.reduce((n, r) => n + r.members.length, 0)
    const received = responses.filter(r => ids.has(r.run)).length
    const b = blockers.filter(b => b.at >= start && b.at < end)
    return { expected, received, participation: expected ? Math.round(received / expected * 100) : null,
      blockers: b.length, resolved: b.filter(b => b.resolvedAt).length }
  })
}
const escape = value => String(value || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
module.exports = { DAY, TEMPLATES, localTime, validTime, validateConfig, mayRemind, nextInRotation, insights, escape }
