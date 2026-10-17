import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Clock3, Flame, Leaf, Minus, Plus, X, Pencil, Trash2 } from 'lucide-react';
import './_group.css';

type Activity = { id: string; title: string; time: string; note: string };
type StoredState = { activities: Activity[]; completed: Record<string, string[]> };

const STORAGE_KEY = 'daily-discipline-v1';
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
    if (!value || typeof value !== 'object') return { activities: starterActivities, completed: {} };
    const candidate = value as Partial<StoredState>;
    const activities = Array.isArray(candidate.activities)
      ? candidate.activities.filter((item): item is Activity =>
          !!item && typeof item.id === 'string' && typeof item.title === 'string' &&
          typeof item.time === 'string' && typeof item.note === 'string')
      : starterActivities;
    const completed: Record<string, string[]> = {};
    if (candidate.completed && typeof candidate.completed === 'object' && !Array.isArray(candidate.completed)) {
      Object.entries(candidate.completed).forEach(([key, ids]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(ids)) {
          completed[key] = ids.filter((id): id is string => typeof id === 'string');
        }
      });
    }
    return { activities, completed };
  } catch {
    return { activities: starterActivities, completed: {} };
  }
}

function formatTime(time: string) {
  const [hour, minute] = time.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function friendlyDate(key: string) {
  const date = new Date(`${key}T12:00:00`);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function Current() {
  const [stored, setStored] = useState<StoredState>(() => safeLoad());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [editor, setEditor] = useState<Activity | null | 'new'>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formTime, setFormTime] = useState('08:00');
  const [formNote, setFormNote] = useState('');
  const doneIds = stored.completed[selectedDate] ?? [];
  const doneCount = stored.activities.filter((activity) => doneIds.includes(activity.id)).length;
  const progress = stored.activities.length ? Math.round(doneCount / stored.activities.length * 100) : 0;

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* Storage may be unavailable. */ }
  }, [stored]);

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
      const completed = stored.activities.length > 0 && stored.activities.every((item) => ids.includes(item.id));
      if (!completed) break;
      count += 1;
      cursor = shiftDate(cursor, -1);
    }
    return count;
  }, [stored]);

  const nextActivity = stored.activities.find((activity) => !doneIds.includes(activity.id));

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
    if (!title) return;
    setStored((current) => {
      const activity: Activity = {
        id: editor === 'new' ? `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` : editor!.id,
        title,
        time: formTime,
        note: formNote.trim(),
      };
      return { ...current, activities: editor === 'new' ? [...current.activities, activity].sort((a, b) => a.time.localeCompare(b.time)) : current.activities.map((item) => item.id === activity.id ? activity : item).sort((a, b) => a.time.localeCompare(b.time)) };
    });
    setEditor(null);
  }

  function deleteActivity(id: string) {
    setStored((current) => ({
      activities: current.activities.filter((activity) => activity.id !== id),
      completed: Object.fromEntries(Object.entries(current.completed).map(([date, ids]) => [date, ids.filter((item) => item !== id)])),
    }));
  }

  const dateLabel = selectedDate === todayKey() ? 'TODAY · ' + friendlyDate(selectedDate) : friendlyDate(selectedDate);
  const currentDay = new Date(`${selectedDate}T12:00:00`);
  const dayGreeting = selectedDate === todayKey() ? 'A new day, ' : 'A day to ';

  return (
    <main className="app-shell">
      <div className="dashboard">
        <header className="topbar">
          <div className="brand" data-testid="text-app-name">
            <span className="brand-mark"><Leaf aria-hidden="true" /></span>
            <span>daily discipline</span>
          </div>
          <div className="top-meta"><span className="live-dot" /><span data-testid="status-local-save">YOUR SPACE, YOUR PACE</span></div>
        </header>

        <section className="hero">
          <div>
            <div className="eyebrow">A little structure. A lot of room to grow.</div>
            <h1>{dayGreeting}<em>your rhythm.</em></h1>
            <p className="hero-copy">Show up for the things that matter. The rest will follow.</p>
          </div>
          <div className="date-control" aria-label="Select a day">
            <button className="icon-button" type="button" aria-label="Previous day" data-testid="button-previous-day" onClick={() => setSelectedDate((date) => shiftDate(date, -1))}><ChevronLeft size={17} /></button>
            <label className="date-button" data-testid="control-date-picker">
              <Clock3 size={14} />
              <span>{dateLabel}</span>
              <input aria-label="Choose date" data-testid="input-select-date" type="date" value={selectedDate} onChange={(event) => event.target.value && setSelectedDate(event.target.value)} />
            </label>
            <button className="icon-button" type="button" aria-label="Next day" data-testid="button-next-day" onClick={() => setSelectedDate((date) => shiftDate(date, 1))}><ChevronRight size={17} /></button>
          </div>
        </section>

        <div className="layout">
          <section className="main-column" aria-label="Daily routine">
            <div className="summary-grid">
              <div className="summary-card progress-card" data-testid="status-day-progress">
                <div className="summary-label">Your day in motion</div>
                <div className="progress-line"><span className="progress-value">{progress}%</span><span className="progress-detail">{doneCount} of {stored.activities.length} moments complete</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
              </div>
              <div className="summary-card" data-testid="status-completed-count">
                <div className="summary-label">Little wins</div>
                <div className="stat-number">{String(doneCount).padStart(2, '0')}<span style={{ color: '#aaa6b0', fontSize: 16 }}> / {String(stored.activities.length).padStart(2, '0')}</span></div>
                <div className="stat-caption">checked off today</div>
              </div>
              <div className="summary-card" data-testid="status-current-streak">
                <div className="summary-label">Steady days</div>
                <div className="stat-number">{streak}<span style={{ fontSize: 15, marginLeft: 5, color: '#d77955' }}><Flame size={15} fill="currentColor" style={{ verticalAlign: '-2px' }} /></span></div>
                <div className="stat-caption">day streak</div>
              </div>
            </div>

            <section className="routine-card">
              <div className="routine-head">
                <div><div className="section-title">Today, by the hour</div><div className="section-sub">A gentle guide, not a set of rules</div></div>
                <button type="button" className="add-button" data-testid="button-add-activity" onClick={() => openEditor('new')}><Plus size={15} /> Add a moment</button>
              </div>
              {stored.activities.length ? (
                <div className="routine-list">
                  {stored.activities.map((activity, index) => {
                    const isDone = doneIds.includes(activity.id);
                    return (
                      <article className={`routine-row${isDone ? ' done' : ''}`} key={activity.id} data-testid={`row-activity-${activity.id}`} style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}>
                        <time className="time-text" data-testid={`text-time-${activity.id}`}>{formatTime(activity.time)}</time>
                        <button type="button" className={`check-button${isDone ? ' checked' : ''}`} aria-label={`${isDone ? 'Mark incomplete' : 'Mark complete'}: ${activity.title}`} aria-pressed={isDone} data-testid={`button-complete-${activity.id}`} onClick={() => toggleActivity(activity.id)}>{isDone && <Check size={13} strokeWidth={3} />}</button>
                        <div><div className="activity-title" data-testid={`text-activity-${activity.id}`}>{activity.title}</div>{activity.note && <div className="activity-note">{activity.note}</div>}</div>
                        <div className="activity-tools">
                          <button type="button" className="tool-button" aria-label={`Edit ${activity.title}`} data-testid={`button-edit-${activity.id}`} onClick={() => openEditor(activity)}><Pencil size={14} /></button>
                          <button type="button" className="tool-button delete" aria-label={`Delete ${activity.title}`} data-testid={`button-delete-${activity.id}`} onClick={() => deleteActivity(activity.id)}><Trash2 size={14} /></button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <div className="empty-state" data-testid="empty-routine"><strong>A little blank space.</strong>Add one small thing to begin.</div>}
            </section>
          </section>

          <aside className="sidebar" aria-label="Your consistency">
            <section className="side-card" data-testid="card-weekly-consistency">
              <div className="week-title-row"><div><div className="week-title">This week</div><div className="week-caption">A rhythm takes time</div></div><span style={{ color: '#286d5c' }}><Leaf size={17} /></span></div>
              <div className="week-dots">
                {week.map((day) => <div className="day-col" key={day.date} data-testid={`day-consistency-${day.date}`}><span className="day-label">{day.label}</span><span className={`day-dot${day.ratio >= 1 ? ' active' : day.ratio > 0 ? ' partial' : ''}`} title={`${day.date}: ${Math.round(day.ratio * 100)}%`}>{day.ratio >= 1 ? <Check size={12} strokeWidth={3} /> : day.ratio > 0 ? <Minus size={12} /> : day.isToday ? '·' : ''}</span></div>)}
              </div>
              <div className="week-foot"><span>Days with a little progress</span><strong data-testid="text-weekly-count">{week.filter((day) => day.ratio > 0).length} / 7</strong></div>
            </section>

            <section className="quote-card" data-testid="card-daily-note">
              <div className="quote-mark">“</div>
              <p className="quote-text">{progress === 100 && stored.activities.length ? 'You kept your word to yourself today.' : progress > 0 ? 'Look at you, already showing up.' : 'You don’t have to do it all. Just begin.'}</p>
              <div className="quote-by">A note for {currentDay.toLocaleDateString('en-US', { weekday: 'long' })}</div>
            </section>

            <section className="side-card next-card" data-testid="card-next-up">
              <div className="next-kicker">{nextActivity ? 'One thing at a time' : 'The day is yours'}</div>
              {nextActivity ? <><div className="next-name" data-testid="text-next-activity">{nextActivity.title}</div><div className="next-time">{formatTime(nextActivity.time)} · when you’re ready</div></> : <><div className="next-name" data-testid="text-next-activity">All moments complete</div><div className="next-time">Take a breath. You did enough.</div></>}
            </section>
          </aside>
        </div>
      </div>

      {editor !== null && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}>
          <form className="activity-modal" onSubmit={saveActivity} aria-label={editor === 'new' ? 'Add an activity' : 'Edit an activity'}>
            <div className="modal-top">
              <div><div className="modal-title">{editor === 'new' ? 'Add a moment' : 'Make it yours'}</div><div className="modal-copy">Plans are just a starting point.</div></div>
              <button type="button" className="close-button" aria-label="Close" data-testid="button-close-editor" onClick={() => setEditor(null)}><X size={17} /></button>
            </div>
            <div className="form-field"><label htmlFor="activity-title">Activity</label><input id="activity-title" autoFocus required maxLength={60} value={formTitle} onChange={(event) => setFormTitle(event.target.value)} placeholder="A little something..." data-testid="input-activity-title" /></div>
            <div className="form-row">
              <div className="form-field"><label htmlFor="activity-time">Approx. time</label><input id="activity-time" type="time" required value={formTime} onChange={(event) => setFormTime(event.target.value)} data-testid="input-activity-time" /></div>
              <div className="form-field"><label htmlFor="activity-note">A small reminder</label><input id="activity-note" maxLength={70} value={formNote} onChange={(event) => setFormNote(event.target.value)} placeholder="Optional" data-testid="input-activity-note" /></div>
            </div>
            <div className="modal-actions"><button type="button" className="cancel-button" data-testid="button-cancel-editor" onClick={() => setEditor(null)}>Cancel</button><button type="submit" className="save-button" data-testid="button-save-activity">{editor === 'new' ? 'Add moment' : 'Save changes'}</button></div>
          </form>
        </div>
      )}
    </main>
  );
}
