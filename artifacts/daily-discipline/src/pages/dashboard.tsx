import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight, Clock3, Flame, Leaf, Minus, Pause, Pencil, Play, Plus, RotateCcw, Save, Trash2, X } from 'lucide-react';
import './dashboard.css';

type Activity = { id: string; title: string; time: string; note: string };
type StoredState = { activities: Activity[]; completed: Record<string, string[]> };
type Editor = Activity | 'new' | null;

const STORAGE_KEY = 'daily-discipline-v1';
const REFLECTION_KEY = 'daily-discipline-reflections-v1';
const starterActivities: Activity[] = [
  { id: 'wake', title: 'Wake up', time: '05:00', note: 'Start slow. Make the bed.' },
  { id: 'workout', title: 'Workout', time: '05:15', note: 'One hour to move with purpose' },
  { id: 'phone', title: 'Phone time', time: '06:20', note: 'A little space to catch up' },
  { id: 'bath', title: 'Bath & reset', time: '06:45', note: 'Get ready for the day' },
  { id: 'tech-am', title: 'Tech work', time: '07:30', note: 'Deep work, one thing at a time' },
  { id: 'walk', title: 'Go out for a walk', time: '12:30', note: 'Fresh air, clear head' },
  { id: 'dinner', title: 'Dinner', time: '18:00', note: 'Step away and recharge' },
  { id: 'tech-pm', title: 'Evening tech work', time: '19:00', note: 'A focused second session' },
  { id: 'wrap', title: 'Wrap up', time: '21:00', note: 'Close the day with intention' },
];

function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function shiftDate(key: string, amount: number) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function safeLoad(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { activities: starterActivities, completed: {} };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { activities: starterActivities, completed: {} };
    const candidate = value as Partial<StoredState>;
    const activities = Array.isArray(candidate.activities)
      ? candidate.activities.filter((item): item is Activity =>
          !!item && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string' &&
          typeof item.time === 'string' && typeof item.note === 'string')
      : starterActivities;
    const completed: Record<string, string[]> = {};
    if (candidate.completed && typeof candidate.completed === 'object' && !Array.isArray(candidate.completed)) {
      Object.entries(candidate.completed).forEach(([key, ids]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(ids)) {
          completed[key] = [...new Set(ids.filter((id): id is string => typeof id === 'string'))];
        }
      });
    }
    return { activities, completed };
  } catch {
    return { activities: starterActivities, completed: {} };
  }
}

function safeLoadReflections(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(REFLECTION_KEY) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([key, note]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && typeof note === 'string'));
  } catch {
    return {};
  }
}

function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

function friendlyDate(key: string) {
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function isWork(activity: Activity) {
  return /tech|deep work|focus|build|code/i.test(`${activity.title} ${activity.id}`);
}

export default function Dashboard() {
  const reduceMotion = useReducedMotion();
  const [stored, setStored] = useState<StoredState>(() => safeLoad());
  const [reflections, setReflections] = useState<Record<string, string>>(() => safeLoadReflections());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [editor, setEditor] = useState<Editor>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formTime, setFormTime] = useState('08:00');
  const [formNote, setFormNote] = useState('');
  const [focusId, setFocusId] = useState(() => stored.activities.find(isWork)?.id ?? '');
  const [secondsLeft, setSecondsLeft] = useState(50 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerMessage, setTimerMessage] = useState('A clear stretch for one thing.');
  const doneIds = stored.completed[selectedDate] ?? [];
  const doneCount = stored.activities.filter((activity) => doneIds.includes(activity.id)).length;
  const progress = stored.activities.length ? Math.round(doneCount / stored.activities.length * 100) : 0;
  const workActivities = useMemo(() => stored.activities.filter(isWork), [stored.activities]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* Storage may be unavailable. */ }
  }, [stored]);

  useEffect(() => {
    try { localStorage.setItem(REFLECTION_KEY, JSON.stringify(reflections)); } catch { /* Storage may be unavailable. */ }
  }, [reflections]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    if (timerRunning && secondsLeft === 0) {
      setTimerRunning(false);
      setTimerMessage('Focus session complete. Take a breath.');
    }
  }, [secondsLeft, timerRunning]);

  useEffect(() => {
    if (workActivities.length && !workActivities.some((activity) => activity.id === focusId)) setFocusId(workActivities[0].id);
  }, [workActivities, focusId]);

  const week = useMemo(() => {
    const today = todayKey();
    const todayDate = new Date(`${today}T12:00:00`);
    const mondayOffset = (todayDate.getDay() + 6) % 7;
    const monday = shiftDate(today, -mondayOffset);
    return Array.from({ length: 7 }, (_, index) => {
      const date = shiftDate(monday, index);
      const completed = stored.completed[date] ?? [];
      const ratio = stored.activities.length ? completed.filter((id) => stored.activities.some((item) => item.id === id)).length / stored.activities.length : 0;
      return { date, label: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1), ratio, isToday: date === today };
    });
  }, [stored]);

  const streak = useMemo(() => {
    let count = 0;
    let cursor = todayKey();
    while (count < 365) {
      const ids = stored.completed[cursor] ?? [];
      if (!(stored.activities.length > 0 && stored.activities.every((item) => ids.includes(item.id)))) break;
      count += 1;
      cursor = shiftDate(cursor, -1);
    }
    return count;
  }, [stored]);

  const nextActivity = stored.activities.find((activity) => !doneIds.includes(activity.id));
  const currentDay = new Date(`${selectedDate}T12:00:00`);
  const dateLabel = selectedDate === todayKey() ? `TODAY · ${friendlyDate(selectedDate)}` : friendlyDate(selectedDate);
  const timerTotal = 50 * 60;
  const timerProgress = Math.max(0, Math.min(1, secondsLeft / timerTotal));
  const timerDisplay = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const entrance = reduceMotion ? {} : { initial: { opacity: 0, y: 13 }, animate: { opacity: 1, y: 0 }, transition: { duration: .42, ease: 'easeOut' as const } };
  const containerMotion = reduceMotion ? {} : { initial: 'hidden', animate: 'show', variants: { hidden: {}, show: { transition: { staggerChildren: .055 } } } };
  const childMotion = reduceMotion ? {} : { variants: { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: .34, ease: 'easeOut' as const } } } };

  function toggleActivity(id: string) {
    setStored((current) => {
      const currentDone = current.completed[selectedDate] ?? [];
      const next = currentDone.includes(id) ? currentDone.filter((item) => item !== id) : [...currentDone, id];
      return { ...current, completed: { ...current.completed, [selectedDate]: next } };
    });
  }

  function openEditor(activity: Activity | 'new') {
    setEditor(activity);
    setFormTitle(activity === 'new' ? '' : activity.title);
    setFormTime(activity === 'new' ? '08:00' : activity.time);
    setFormNote(activity === 'new' ? '' : activity.note);
  }

  function saveActivity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = formTitle.trim();
    if (!title || editor === null) return;
    setStored((current) => {
      const activity: Activity = {
        id: editor === 'new' ? `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : editor.id,
        title,
        time: formTime,
        note: formNote.trim(),
      };
      return {
        ...current,
        activities: editor === 'new'
          ? [...current.activities, activity].sort((a, b) => a.time.localeCompare(b.time))
          : current.activities.map((item) => item.id === activity.id ? activity : item).sort((a, b) => a.time.localeCompare(b.time)),
      };
    });
    setEditor(null);
  }

  function deleteActivity(id: string) {
    setStored((current) => ({
      activities: current.activities.filter((activity) => activity.id !== id),
      completed: Object.fromEntries(Object.entries(current.completed).map(([date, ids]) => [date, ids.filter((item) => item !== id)])),
    }));
    if (focusId === id) {
      const replacement = workActivities.find((activity) => activity.id !== id);
      setFocusId(replacement?.id ?? '');
      setTimerRunning(false);
      setSecondsLeft(timerTotal);
    }
  }

  function resetTimer() {
    setTimerRunning(false);
    setSecondsLeft(timerTotal);
    setTimerMessage('Fresh start. One thing at a time.');
  }

  return (
    <main className="momentum">
      <div className="momentum-wrap">
        <motion.header className="momentum-topbar" {...entrance}>
          <div className="momentum-brand" data-testid="text-app-name">
            <span className="momentum-brand-mark"><Leaf aria-hidden="true" /></span>
            <span>daily discipline</span>
          </div>
          <div className="momentum-status"><span className="momentum-live" /><span data-testid="status-local-save">YOUR SPACE, YOUR PACE</span></div>
        </motion.header>

        <motion.section className="momentum-hero" {...(reduceMotion ? {} : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { delay: .06, duration: .48 } })}>
          <div>
            <div className="momentum-kicker">A little structure. A lot of room to grow.</div>
            <h1>{selectedDate === todayKey() ? 'Make room for' : 'A day to'}<br /><em>your rhythm.</em></h1>
            <p className="momentum-hero-copy">Keep showing up. Leave space for being human.</p>
          </div>
          <div className="momentum-date" aria-label="Select a day">
            <button type="button" aria-label="Previous day" data-testid="button-previous-day" onClick={() => setSelectedDate((date) => shiftDate(date, -1))}><ChevronLeft size={17} /></button>
            <label className="momentum-date-control" data-testid="control-date-picker">
              <Clock3 size={14} /><span>{dateLabel}</span>
              <input aria-label="Choose date" data-testid="input-select-date" type="date" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} />
            </label>
            <button type="button" aria-label="Next day" data-testid="button-next-day" onClick={() => setSelectedDate((date) => shiftDate(date, 1))}><ChevronRight size={17} /></button>
          </div>
        </motion.section>

        <div className="momentum-grid">
          <section className="momentum-main" aria-label="Daily routine">
            <motion.div className="momentum-summary" {...containerMotion}>
              <motion.div className="momentum-stat momentum-stat-progress" data-testid="status-day-progress" {...childMotion}>
                <div className="momentum-stat-label">Your day in motion</div>
                <div className="momentum-progress-line"><span className="momentum-progress-number">{progress}%</span><span className="momentum-progress-detail">{doneCount} of {stored.activities.length} moments complete</span></div>
                <div className="momentum-progress-track"><motion.div className="momentum-progress-fill" animate={{ width: `${progress}%` }} transition={reduceMotion ? { duration: 0 } : { duration: .65, ease: [.2, .8, .2, 1] }} /></div>
              </motion.div>
              <motion.div className="momentum-stat" data-testid="status-completed-count" {...childMotion}>
                <div className="momentum-stat-label">Little wins</div>
                <div className="momentum-stat-value">{String(doneCount).padStart(2, '0')}<span> / {String(stored.activities.length).padStart(2, '0')}</span></div>
                <div className="momentum-stat-caption">checked off today</div>
              </motion.div>
              <motion.div className="momentum-stat" data-testid="status-current-streak" {...childMotion}>
                <div className="momentum-stat-label">Steady days</div>
                <div className="momentum-stat-value">{streak}<span style={{ color: 'var(--m-coral)', marginLeft: 6 }}><Flame size={15} fill="currentColor" style={{ verticalAlign: '-2px' }} /></span></div>
                <div className="momentum-stat-caption">day streak</div>
              </motion.div>
            </motion.div>

            <section className="momentum-routine">
              <div className="momentum-routine-head">
                <div><div className="momentum-section-title">Today, by the hour</div><div className="momentum-section-sub">A gentle guide, not a set of rules</div></div>
                <button type="button" className="momentum-add" data-testid="button-add-activity" onClick={() => openEditor('new')}><Plus size={15} /> Add a moment</button>
              </div>
              {stored.activities.length ? (
                <motion.div className="momentum-rows" {...containerMotion}>
                  <AnimatePresence initial={false}>
                    {stored.activities.map((activity, index) => {
                      const isDone = doneIds.includes(activity.id);
                      return (
                        <motion.article className={`momentum-row${isDone ? ' done' : ''}`} key={activity.id} data-testid={`row-activity-${activity.id}`}
                          layout={!reduceMotion} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, x: -14 }}
                          transition={reduceMotion ? { duration: 0 } : { duration: .28, delay: Math.min(index, 8) * .035 }}>
                          <time className="momentum-time" data-testid={`text-time-${activity.id}`}>{formatTime(activity.time)}</time>
                          <motion.button type="button" className={`momentum-check${isDone ? ' checked' : ''}`} aria-label={`${isDone ? 'Mark incomplete' : 'Mark complete'}: ${activity.title}`} aria-pressed={isDone} data-testid={`button-complete-${activity.id}`} onClick={() => toggleActivity(activity.id)} whileTap={reduceMotion ? undefined : { scale: .82 }}>
                            <AnimatePresence>{isDone && <motion.span key="check" initial={reduceMotion ? false : { scale: 0, rotate: -35 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}><Check size={13} strokeWidth={3} /></motion.span>}</AnimatePresence>
                          </motion.button>
                          <div><div className="momentum-activity-title" data-testid={`text-activity-${activity.id}`}>{activity.title}</div>{activity.note && <div className="momentum-activity-note">{activity.note}</div>}</div>
                          <div className="momentum-tools">
                            <button type="button" className="momentum-tool" aria-label={`Edit ${activity.title}`} data-testid={`button-edit-${activity.id}`} onClick={() => openEditor(activity)}><Pencil size={14} /></button>
                            <button type="button" className="momentum-tool delete" aria-label={`Delete ${activity.title}`} data-testid={`button-delete-${activity.id}`} onClick={() => deleteActivity(activity.id)}><Trash2 size={14} /></button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              ) : <div className="momentum-empty" data-testid="empty-routine"><strong>Room for a fresh start.</strong>Add one small thing to begin.</div>}
            </section>
          </section>

          <aside className="momentum-sidebar" aria-label="Your consistency and focus">
            <motion.section className="momentum-side-card" data-testid="card-weekly-consistency" {...entrance}>
              <div className="momentum-week-head"><div><div className="momentum-week-title">This week</div><div className="momentum-week-caption">A rhythm takes time</div></div><Leaf size={17} color="var(--m-green)" /></div>
              <div className="momentum-week-dots">
                {week.map((day) => <div className="momentum-day-col" key={day.date} data-testid={`day-consistency-${day.date}`}><span className="momentum-day-label">{day.label}</span><span className={`momentum-day-dot${day.ratio >= 1 ? ' active' : day.ratio > 0 ? ' partial' : ''}`} title={`${day.date}: ${Math.round(day.ratio * 100)}%`}>{day.ratio >= 1 ? <Check size={12} strokeWidth={3} /> : day.ratio > 0 ? <Minus size={12} /> : day.isToday ? '·' : ''}</span></div>)}
              </div>
              <div className="momentum-week-foot"><span>Days with a little progress</span><strong data-testid="text-weekly-count">{week.filter((day) => day.ratio > 0).length} / 7</strong></div>
            </motion.section>

            <motion.section className="momentum-focus" data-testid="card-focus-timer" {...entrance}>
              <div className="momentum-focus-head">
                <div><div className="momentum-micro">Make a little space</div><div className="momentum-focus-label">Focus session</div></div>
                <select className="momentum-focus-select" aria-label="Choose work block" data-testid="select-focus-activity" value={focusId} onChange={(event) => { setFocusId(event.target.value); setTimerRunning(false); setSecondsLeft(timerTotal); setTimerMessage('A clear stretch for one thing.'); }}>
                  {workActivities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}
                  {!workActivities.length && <option value="">No work block</option>}
                </select>
              </div>
              <div className="momentum-timer" aria-live="polite" data-testid="text-focus-timer">{timerDisplay}<small>MIN / SEC</small></div>
              <div className="momentum-timer-track"><motion.div className="momentum-timer-fill" animate={{ scaleX: timerProgress }} transition={{ duration: reduceMotion ? 0 : .4 }} /></div>
              <div className="momentum-timer-actions">
                <button type="button" className="momentum-timer-primary" data-testid="button-focus-start-pause" disabled={!focusId} onClick={() => { if (secondsLeft === 0) setSecondsLeft(timerTotal); setTimerRunning((running) => !running); setTimerMessage(timerRunning ? 'Paused. Pick it up when you’re ready.' : 'You’re here. Let’s begin.'); }}>
                  {timerRunning ? <><Pause size={13} /> Pause</> : <><Play size={13} fill="currentColor" /> Start focus</>}
                </button>
                <button type="button" className="momentum-timer-secondary" aria-label="Reset focus timer" data-testid="button-focus-reset" onClick={resetTimer}><RotateCcw size={13} /> Reset</button>
              </div>
              <div className="momentum-timer-status" data-testid="text-focus-status">{timerMessage}</div>
            </motion.section>

            <motion.section className="momentum-side-card momentum-reflection" data-testid="card-daily-reflection" {...entrance}>
              <div className="momentum-reflection-head">
                <div className="momentum-reflection-title">A note to yourself</div>
                <div className="momentum-save-state" data-testid="status-reflection-save"><Save size={12} /> Saved here</div>
              </div>
              <div className="momentum-reflection-prompt">What felt good today? What can wait?</div>
              <textarea aria-label="Daily reflection note" data-testid="input-daily-reflection" maxLength={600} placeholder="A few honest lines are enough…" value={reflections[selectedDate] ?? ''} onChange={(event) => setReflections((current) => ({ ...current, [selectedDate]: event.target.value }))} />
            </motion.section>

            <motion.section className="momentum-note-card" data-testid="card-daily-note" {...entrance}>
              <div className="momentum-micro">A thought for today</div>
              <p>{progress === 100 && stored.activities.length ? 'You kept your word to yourself today.' : progress > 0 ? 'Look at you, already showing up.' : 'You don’t have to do it all. Just begin.'}</p>
              <div className="momentum-note-by">{`${currentDay.toLocaleDateString('en-US', { weekday: 'long' })} · at your own pace`}</div>
            </motion.section>

            <motion.section className="momentum-side-card momentum-next" data-testid="card-next-up" {...entrance}>
              <div className="momentum-micro">{nextActivity ? 'One thing at a time' : 'The day is yours'}</div>
              {nextActivity ? <><div className="momentum-next-name" data-testid="text-next-activity">{nextActivity.title}</div><div className="momentum-next-time">{formatTime(nextActivity.time)} · when you’re ready</div></> : <><div className="momentum-next-name" data-testid="text-next-activity">All moments complete</div><div className="momentum-next-time">Take a breath. You did enough.</div></>}
            </motion.section>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {editor !== null && (
          <motion.div className="momentum-modal-backdrop" data-testid="modal-activity-editor" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
            <motion.form className="momentum-modal" onSubmit={saveActivity} aria-label={editor === 'new' ? 'Add an activity' : 'Edit an activity'}
              initial={reduceMotion ? false : { opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }} transition={{ duration: reduceMotion ? 0 : .2 }}>
              <div className="momentum-modal-top">
                <div><div className="momentum-modal-title">{editor === 'new' ? 'Add a moment' : 'Make it yours'}</div><div className="momentum-modal-copy">Plans are just a starting point.</div></div>
                <button type="button" className="momentum-close" aria-label="Close" data-testid="button-close-editor" onClick={() => setEditor(null)}><X size={17} /></button>
              </div>
              <div className="momentum-field"><label htmlFor="momentum-activity-title">Activity</label><input id="momentum-activity-title" autoFocus required maxLength={60} value={formTitle} onChange={(event) => setFormTitle(event.target.value)} placeholder="A little something…" data-testid="input-activity-title" /></div>
              <div className="momentum-form-row">
                <div className="momentum-field"><label htmlFor="momentum-activity-time">Approx. time</label><input id="momentum-activity-time" type="time" required value={formTime} onChange={(event) => setFormTime(event.target.value)} data-testid="input-activity-time" /></div>
                <div className="momentum-field"><label htmlFor="momentum-activity-note">A small reminder</label><input id="momentum-activity-note" maxLength={70} value={formNote} onChange={(event) => setFormNote(event.target.value)} placeholder="Optional" data-testid="input-activity-note" /></div>
              </div>
              <div className="momentum-modal-actions"><button type="button" className="momentum-cancel" data-testid="button-cancel-editor" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="momentum-save" data-testid="button-save-activity">{editor === 'new' ? 'Add moment' : 'Save changes'}</button></div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
