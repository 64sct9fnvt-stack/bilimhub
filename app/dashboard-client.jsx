"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "../lib/supabase/client";
import QuizPage from "./quiz-page";
import ResultsHistory from "./results-history";
import AnalyticsPage from "./analytics-page";
import TasksPage from "./tasks-page";
import {
  GraduationCap, Home, BookOpen, CalendarCheck, CalendarDays, Sparkles,
  CheckSquare, ChartNoAxesColumn, Settings, Search, Bell, ChevronDown,
  Flame, Star, ArrowRight, Send, Calculator, Code2, Landmark, Globe2,
  Plus, Clock3, Menu, X, TrendingUp, FileText, CircleCheck, BookMarked,
  Trash2, CheckCircle2
} from "lucide-react";

const initialSubjects = [
  { name: "Математика", progress: 72, icon: Calculator, color: "violet", due: "До рубежки: 12 дней" },
  { name: "Информатика", progress: 68, icon: Code2, color: "blue", due: "Прогресс: 68%" },
  { name: "История Казахстана", progress: 85, icon: Landmark, color: "pink", due: "До сессии: 45 дней" },
  { name: "Английский язык", progress: 54, icon: Globe2, color: "cyan", due: "Следующий урок: завтра" },
];

const navItems = [
  { label: "Главная", icon: Home },
  { label: "Мои предметы", icon: BookOpen },
  { label: "Рубежка", icon: CalendarCheck },
  { label: "Сессия", icon: CalendarDays },
  { label: "Конспект генератор", icon: Sparkles },
  { label: "Bilim AI", icon: Sparkles },
  { label: "Задачи", icon: CheckSquare },
  { label: "Статистика", icon: ChartNoAxesColumn },
  { label: "История результатов", icon: FileText },
  { label: "Настройки", icon: Settings },
  
];

function ProgressBar({ value }) {
  return <div className="progress-track"><div className="progress-fill" style={{ width: `${value}%` }} /></div>;
}

function CapIllustration() {
  return (
    <div className="cap-art" aria-hidden="true">
      <div className="orbit orbit-one" /><div className="orbit orbit-two" />
      <div className="book book-back" /><div className="book book-front" />
      <div className="cap-top"><span /></div><div className="cap-base" />
      <div className="cap-tassel" />
      <span className="art-star star-a">✦</span><span className="art-star star-b">✧</span><span className="art-star star-c">✦</span>
    </div>
  );
}

function Chart() {
  return (
    <div className="chart-wrap">
      <div className="chart-tooltip">+18% <TrendingUp size={13} /></div>
      <svg viewBox="0 0 440 150" className="chart-svg" role="img" aria-label="График активности за неделю">
        <defs>
          <linearGradient id="chartGlow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#9b70ff" stopOpacity=".24" />
            <stop offset="1" stopColor="#9b70ff" stopOpacity="0" />
          </linearGradient>
          <filter id="lineGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path d="M10 112 C35 105 48 82 80 78 S132 91 158 78 S202 48 225 54 S273 78 298 61 S340 28 367 32 S400 17 430 9 L430 145 L10 145Z" fill="url(#chartGlow)" />
        <path d="M10 112 C35 105 48 82 80 78 S132 91 158 78 S202 48 225 54 S273 78 298 61 S340 28 367 32 S400 17 430 9" fill="none" stroke="#a47bff" strokeWidth="3" strokeLinecap="round" filter="url(#lineGlow)" />
        {[[10,112],[80,78],[158,78],[225,54],[298,61],[367,32],[430,9]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4.5" fill="#d9c8ff" stroke="#9b70ff" strokeWidth="2" />)}
      </svg>
      <div className="chart-days"><span>Пн</span><span>Вт</span><span>Ср</span><span>Чт</span><span>Пт</span><span>Сб</span><span>Вс</span></div>
    </div>
  );
}

function Sidebar({ active, setActive, mobileOpen, setMobileOpen, subjects }) {
  return (
    <>
      {mobileOpen && <button className="mobile-scrim" aria-label="Закрыть меню" onClick={() => setMobileOpen(false)} />}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><GraduationCap size={34} strokeWidth={1.8}/></div><span>Bilim Hub</span><button className="close-sidebar" onClick={() => setMobileOpen(false)} aria-label="Закрыть"><X size={20}/></button></div>
        <nav className="main-nav" aria-label="Главная навигация">
          {navItems.map(({label,icon:Icon}) => (
            <button key={label} className={`nav-item ${active === label ? "active" : ""}`} onClick={() => {setActive(label);setMobileOpen(false);}}>
              <Icon size={20} strokeWidth={1.8}/><span>{label}</span>{label === "Конспект генератор" && <span className="nav-spark">✦</span>}
            </button>
          ))}
        </nav>
        <div className="side-divider" />
        <div className="quick-head"><span>Быстрый доступ</span><Sparkles size={17}/></div>
        <div className="quick-list">
          {(subjects || []).slice(0,3).map(({id,name,icon:Icon,due,color})=>(
            <button key={id || name} className="quick-item" onClick={()=>setActive("Мои предметы")}>
              <span className={`quick-icon ${color || "violet"}`}><Icon size={19}/></span><span className="quick-copy"><b>{name}</b><small>{due || "В учебном плане"}</small></span>
            </button>
          ))}
          {(!subjects || subjects.length === 0) && <p className="quick-empty">Добавь первый предмет</p>}
        </div>
       
      </aside>
    </>
  );
}

function Header({ search, setSearch, setMobileOpen, userName, authEnabled }) {
  const [noticeOpen,setNoticeOpen] = useState(false);
  const [profileOpen,setProfileOpen] = useState(false);
  const [signingOut,setSigningOut] = useState(false);
  const router = useRouter();
  const signOut = async () => {
    if (!authEnabled || signingOut) return;
    setSigningOut(true);
    const { error } = await createSupabaseClient().auth.signOut();
    if (error) { setSigningOut(false); return; }
    router.replace("/login");
    router.refresh();
  };
  return (
    <header className="topbar">
      <button className="mobile-menu" onClick={()=>setMobileOpen(true)} aria-label="Открыть меню"><Menu size={22}/></button>
      <div className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по предметам, темам, заметкам..."/><kbd>⌘ K</kbd></div>
      <div className="top-actions">
        <div className="action-wrap"><button className="icon-button" onClick={()=>setNoticeOpen(!noticeOpen)} aria-label="Уведомления"><Bell size={20}/><i/></button>{noticeOpen && <div className="floating-popover"><b>Уведомления</b><p>Пока всё спокойно. Новые напоминания появятся здесь.</p></div>}</div>
        <div className="action-wrap"><button className="profile-button" onClick={()=>setProfileOpen(!profileOpen)}><span className="avatar">{(userName || "С").trim().charAt(0).toUpperCase()}</span><span className="profile-name">{userName || "Студент"}</span><ChevronDown size={15}/></button>{profileOpen && <div className="floating-popover profile-pop"><b>{userName || "Студент"}</b><p>{authEnabled ? "Аккаунт Bilim Hub" : "Демонстрационный режим"}</p>{authEnabled ? <button onClick={signOut} disabled={signingOut}>{signingOut ? "Выходим..." : "Выйти из аккаунта"}</button> : <button onClick={()=>setProfileOpen(false)}>Закрыть</button>}</div>}</div>
      </div>
    </header>
  );
}

function Dashboard({ subjects, setActive, query, userName, onOpenAdd, subjectsLoading, subjectsError }) {
  const [topic,setTopic] = useState("");
  const [generated,setGenerated] = useState(false);
  const visibleSubjects = useMemo(()=>subjects.filter(s=>s.name.toLowerCase().includes(query.toLowerCase())),[subjects,query]);
  const generate = () => { if(topic.trim()) setGenerated(true); };
  return (
    <>
      <section className="welcome-row">
        <div><h1>Привет, {userName || "студент"}! <span className="hello-spark">✦</span></h1><p>Большие цели начинаются<br className="desktop-break"/> с маленьких шагов</p></div>
        <CapIllustration />
      </section>
      <section className="stats-grid">
        <div className="stat-card"><div className="stat-icon"><ChartNoAxesColumn size={26}/></div><div className="stat-copy"><strong>78%</strong><span>Общий прогресс</span><ProgressBar value={78}/></div></div>
        <div className="stat-card"><div className="stat-icon"><CalendarCheck size={25}/></div><div className="stat-copy"><strong>12 дней</strong><span>До рубежки</span></div></div>
        <div className="stat-card"><div className="stat-icon"><CalendarDays size={25}/></div><div className="stat-copy"><strong>45 дней</strong><span>До сессии</span></div></div>
        <div className="stat-card"><div className="stat-icon fire"><Flame size={27}/></div><div className="stat-copy"><strong>7 дней</strong><span>Текущая серия</span></div></div>
      </section>
      <section className="main-grid">
        <div className="prep-panel panel">
          <div className="section-title"><h2><Star size={19} fill="currentColor"/> Подготовка</h2></div>
          <div className="prep-cards">
            <article className="prep-card">
              <div className="prep-illustration calendar-illus"><CalendarCheck size={53}/><span className="check-bubble"><CircleCheck size={33} fill="currentColor"/></span></div>
              <div className="prep-content"><h3>Рубежка</h3><p>Проверь свои знания<br/>и подготовься к рубежке</p><button onClick={()=>setActive("Рубежка")} className="primary-button">Начать подготовку <ArrowRight size={16}/></button></div>
            </article>
            <article className="prep-card">
              <div className="prep-illustration exam-illus"><GraduationCap size={67}/><div className="mini-books"><i/><i/><i/></div></div>
              <div className="prep-content"><h3>Сессия</h3><p>Системная подготовка<br/>к экзаменам</p><button onClick={()=>setActive("Сессия")} className="primary-button">Начать подготовку <ArrowRight size={16}/></button></div>
            </article>
          </div>
        </div>
        <div className="ai-panel panel">
          <div className="ai-heading"><h2>Конспект генератор <Sparkles size={17}/></h2><span className="beta">Beta</span></div>
          <p className="ai-description">Создай конспект по любой теме<br/>быстро и удобно</p>
          <div className="ai-mini-art"><FileText size={55}/><Sparkles size={19}/></div>
          <form className="generator-form" onSubmit={e=>{e.preventDefault();generate();}}><input value={topic} onChange={e=>{setTopic(e.target.value);setGenerated(false);}} placeholder="Например: Тригонометрия..."/><button type="submit" aria-label="Создать конспект"><Send size={17}/></button></form>
          {generated ? <div className="demo-result"><b>Тема: {topic}</b><p>Генератор будет подключён на следующем этапе. Пока это демонстрация интерфейса.</p></div> : <><span className="popular-label">Популярные темы:</span><div className="topic-tags"><button onClick={()=>setTopic("Интегралы")}>Интегралы</button><button onClick={()=>setTopic("Логарифмы")}>Логарифмы</button><button onClick={()=>setTopic("Python")}>Python</button></div></>}
        </div>
      </section>
      <section className="bottom-grid">
        <div className="subjects-panel panel">
          <div className="panel-heading"><h2>Мои предметы</h2><button className="text-link" onClick={()=>setActive("Мои предметы")}>Все предметы <ArrowRight size={14}/></button></div>
          <div className="subject-grid">
            {subjectsLoading ? <div className="empty-search">Загружаем твои предметы...</div> : visibleSubjects.map(({id,name,progress,icon:Icon,color})=>(<button className="subject-card" key={id || name} onClick={()=>setActive("Мои предметы")}><Icon className={`subject-icon ${color}`} size={27}/><b>{name}</b><span className="subject-percent">{progress}%</span><ProgressBar value={progress}/></button>))}
            <button className="add-subject" onClick={onOpenAdd}><Plus size={29}/><span>Добавить<br/>предмет</span></button>
          </div>
          {subjectsError && <div className="subject-error">{subjectsError}</div>}
          {query && !subjectsLoading && visibleSubjects.length===0 && <div className="empty-search">По запросу «{query}» предметы не найдены.</div>}
        </div>
        <div className="analytics-panel panel">
          <div className="panel-heading"><h2>Статистика обучения</h2><button className="week-select" onClick={()=>setActive("Статистика")}>Неделя <ChevronDown size={14}/></button></div>
          <Chart />
        </div>
      </section>
    </>
  );
}

function SubjectsPage({ subjects, isLoading, error, onOpenAdd, onDeleteSubject, onUpdateProgress, busySubjectId }) {
  return (
    <section className="subject-manager panel">
      <div className="subject-manager-heading">
        <div>
          <span className="eyebrow">ТВОЙ УЧЕБНЫЙ ПЛАН</span>
          <h1>Мои предметы</h1>
          <p>Управляй дисциплинами и отмечай свой учебный прогресс.</p>
        </div>
        <button className="primary-button subject-add-button" onClick={onOpenAdd}><Plus size={16}/> Добавить предмет</button>
      </div>
      {error && <div className="subject-error">{error}</div>}
      {isLoading ? (
        <div className="subject-manager-empty">Загружаем предметы из твоего аккаунта...</div>
      ) : subjects.length === 0 ? (
        <div className="subject-manager-empty">
          <BookMarked size={34}/>
          <b>Пока нет предметов</b>
          <span>Добавь первую дисциплину — она сохранится в твоём аккаунте.</span>
          <button className="primary-button" onClick={onOpenAdd}><Plus size={16}/> Добавить предмет</button>
        </div>
      ) : (
        <div className="subject-manager-grid">
          {subjects.map((subject) => {
            const Icon = subject.icon || BookMarked;
            const progress = Math.max(0, Math.min(100, Number(subject.progress) || 0));
            const busy = busySubjectId === subject.id;
            return (
              <article className="subject-manage-card" key={subject.id || subject.name}>
                <div className="subject-manage-top">
                  <span className={`subject-manage-icon ${subject.color || "violet"}`}><Icon size={24}/></span>
                  <button className="subject-delete" onClick={() => onDeleteSubject(subject)} disabled={busy} aria-label={`Удалить предмет ${subject.name}`} title="Удалить предмет"><Trash2 size={17}/></button>
                </div>
                <h2>{subject.name}</h2>
                <div className="subject-manage-progress"><span>Мой прогресс</span><b>{progress}%</b></div>
                <ProgressBar value={progress}/>
                <label className="progress-select-label" htmlFor={`progress-${subject.id || subject.name}`}>Изменить прогресс</label>
                <select id={`progress-${subject.id || subject.name}`} value={progress} disabled={busy} onChange={(event) => onUpdateProgress(subject, Number(event.target.value))}>
                  {[0, 25, 50, 75, 100].map((value) => <option key={value} value={value}>{value}%</option>)}
                </select>
                {busy && <span className="subject-saving"><CheckCircle2 size={13}/> Сохраняем...</span>}
              </article>
            );
          })}
        </div>
      )}
      <p className="subject-privacy-note">Предметы и прогресс доступны только в твоём аккаунте.</p>
    </section>
  );
}

function decorateSubject(row) {
  const preset = initialSubjects.find((subject) => subject.name.toLowerCase() === String(row.name || "").toLowerCase());
  return {
    ...(preset || {}),
    ...row,
    icon: preset?.icon || BookMarked,
    color: preset?.color || "violet",
    due: preset?.due || "В учебном плане",
    progress: Number(row.progress) || 0,
  };
}

function OtherPage({ active, setActive }) {
  const details = {
    "Мои предметы": ["Твои учебные дисциплины", "Здесь будут материалы, темы, заметки и прогресс по каждому предмету."],
    "Рубежка": ["Подготовка к рубежному контролю", "Здесь появятся тесты, тренировочные задания и результаты рубежек."],
    "Сессия": ["Подготовка к сессии", "Здесь будут экзаменационные билеты, календарь и план подготовки."],
    "Конспект генератор": ["ИИ-генератор конспектов", "Здесь будет полноценная генерация конспектов по учебным темам."],
    "Задачи": ["Твои задачи", "Планируй занятия, отмечай выполненное и следи за дедлайнами."],
    "Статистика": ["Статистика обучения", "Подробная аналитика занятий, результатов и динамики прогресса."],
    "Настройки": ["Настройки профиля", "Управление аккаунтом, уведомлениями и учебными предпочтениями."],
  };
  const [title,description] = details[active] || [active,"Раздел Bilim Hub"];
  return <div className="coming-panel panel"><div className="coming-icon"><Sparkles size={31}/></div><span className="eyebrow">BILIM HUB</span><h1>{title}</h1><p>{description}</p><div className="coming-note"><Clock3 size={17}/> Этот раздел добавим на следующих этапах разработки.</div><button className="primary-button" onClick={()=>setActive("Главная")}>Вернуться на главную <ArrowRight size={16}/></button></div>;
}

export default function DashboardClient({ userName = "Аружан", authEnabled = false, userId = null }) {
  console.log("TasksPage check:", TasksPage, typeof TasksPage);
  const [active,setActive] = useState("Главная");
  const [search,setSearch] = useState("");
  const [subjects,setSubjects] = useState(authEnabled ? [] : initialSubjects);
  const [subjectsLoading,setSubjectsLoading] = useState(authEnabled);
  const [subjectsError,setSubjectsError] = useState("");
  const [mobileOpen,setMobileOpen] = useState(false);
  const [showAddSubject,setShowAddSubject] = useState(false);
  const [newSubjectName,setNewSubjectName] = useState("");
  const [subjectSaving,setSubjectSaving] = useState(false);
  const [busySubjectId,setBusySubjectId] = useState(null);

  useEffect(() => {
    if (!authEnabled || !userId) {
      setSubjectsLoading(false);
      return;
    }

    let cancelled = false;
    async function loadSubjects() {
      setSubjectsLoading(true);
      setSubjectsError("");
      const { data, error } = await createSupabaseClient()
        .from("subjects")
        .select("id, name, progress, created_at")
        .order("created_at", { ascending: true });

      if (cancelled) return;
      if (error) {
        setSubjects([]);
        setSubjectsError(`Не удалось загрузить предметы. Проверь, что выполнила файл supabase/subjects.sql. Детали: ${error.message}`);
      } else {
        setSubjects((data || []).map(decorateSubject));
      }
      setSubjectsLoading(false);
    }

    loadSubjects();
    return () => { cancelled = true; };
  }, [authEnabled, userId]);

  async function saveNewSubject() {
    const name = newSubjectName.trim().replace(/\s+/g, " ");
    if (!name || subjectSaving) return;
    if (subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase())) {
      setSubjectsError("Этот предмет уже есть в твоём списке.");
      return;
    }

    setSubjectSaving(true);
    setSubjectsError("");
    if (authEnabled) {
      const { data, error } = await createSupabaseClient()
        .from("subjects")
        .insert({ name })
        .select("id, name, progress, created_at")
        .single();
      if (error) {
        setSubjectsError(error.code === "23505" ? "Этот предмет уже добавлен." : `Не удалось сохранить предмет: ${error.message}`);
        setSubjectSaving(false);
        return;
      }
      setSubjects((current) => [...current, decorateSubject(data)]);
    } else {
      setSubjects((current) => [...current, decorateSubject({ id: `demo-${Date.now()}`, name, progress: 0 })]);
    }

    setNewSubjectName("");
    setShowAddSubject(false);
    setSubjectSaving(false);
  }

  async function deleteSubject(subject) {
    if (!subject?.id || busySubjectId) return;
    setBusySubjectId(subject.id);
    setSubjectsError("");
    if (authEnabled) {
      const { error } = await createSupabaseClient().from("subjects").delete().eq("id", subject.id);
      if (error) {
        setSubjectsError(`Не удалось удалить предмет: ${error.message}`);
        setBusySubjectId(null);
        return;
      }
    }
    setSubjects((current) => current.filter((item) => item.id !== subject.id));
    setBusySubjectId(null);
  }

  async function updateSubjectProgress(subject, progress) {
    if (!subject?.id || busySubjectId) return;
    setBusySubjectId(subject.id);
    setSubjectsError("");
    if (authEnabled) {
      const { error } = await createSupabaseClient()
        .from("subjects")
        .update({ progress })
        .eq("id", subject.id);
      if (error) {
        setSubjectsError(`Не удалось обновить прогресс: ${error.message}`);
        setBusySubjectId(null);
        return;
      }
    }
    setSubjects((current) => current.map((item) => item.id === subject.id ? { ...item, progress } : item));
    setBusySubjectId(null);
  }

  return (
    <main className="app-shell">
      <Sidebar active={active} setActive={setActive} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} subjects={subjects}/>
      <div className="workspace">
        <Header search={search} setSearch={setSearch} setMobileOpen={setMobileOpen} userName={userName} authEnabled={authEnabled}/>
        <div className="page-content">
          {!authEnabled && <div className="demo-banner"><span><b>Демо-режим.</b> Чтобы включить аккаунты студентов, подключи Supabase.</span><a href="/login">Настроить вход <ArrowRight size={14}/></a></div>}
          {active === "Главная" ? (
            <Dashboard subjects={subjects} setActive={setActive} query={search} userName={userName} onOpenAdd={() => setShowAddSubject(true)} subjectsLoading={subjectsLoading} subjectsError={subjectsError}/>
          ) : active === "Мои предметы" ? (
            <SubjectsPage subjects={subjects} isLoading={subjectsLoading} error={subjectsError} onOpenAdd={() => setShowAddSubject(true)} onDeleteSubject={deleteSubject} onUpdateProgress={updateSubjectProgress} busySubjectId={busySubjectId}/>
          ) : active === "Рубежка" ? (
            <QuizPage assessmentType="midterm" authEnabled={authEnabled}/>
          ) : active === "Сессия" ? (
            <QuizPage assessmentType="final" authEnabled={authEnabled}/>
        ) : active === "История результатов" ? (
  <ResultsHistory authEnabled={authEnabled} userId={userId}/>
) : active === "Статистика" ? (
  <AnalyticsPage authEnabled={authEnabled} userId={userId}/>
 
) 
: active === "Задачи" ? (
  <TasksPage userId={userId} />
): 
(
  <OtherPage active={active} setActive={setActive}/>
)}
          <footer className="footer-note">© 2026 Bilim Hub <span>Учись в своём ритме ✦</span></footer>
        </div>
      </div>
      {showAddSubject && (
        <div className="modal-backdrop" onClick={() => !subjectSaving && setShowAddSubject(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-subject-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowAddSubject(false)} disabled={subjectSaving} aria-label="Закрыть"><X size={18}/></button>
            <h2 id="add-subject-title">Новый предмет</h2>
            <p>Добавь дисциплину в свой учебный план. Она будет сохранена в твоём аккаунте.</p>
            <input autoFocus maxLength={80} value={newSubjectName} onChange={(event) => { setNewSubjectName(event.target.value); setSubjectsError(""); }} onKeyDown={(event) => { if (event.key === "Enter") saveNewSubject(); }} placeholder="Например: Физика"/>
            {subjectsError && <div className="subject-error">{subjectsError}</div>}
            <button className="primary-button modal-submit" disabled={!newSubjectName.trim() || subjectSaving} onClick={saveNewSubject}>{subjectSaving ? "Сохраняем..." : "Добавить предмет"} <Plus size={16}/></button>
          </div>
        </div>
      )}
    </main>
  );
}
