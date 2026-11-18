"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award, BookOpenCheck, CheckCircle2, ChevronLeft, ChevronRight,
  CircleHelp, Clock3, FileQuestion, GraduationCap, Play, RotateCcw,
  ShieldCheck, Timer, Trophy, XCircle
} from "lucide-react";
import { createClient as createSupabaseClient } from "../lib/supabase/client";

function formatTime(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getSubjectName(quiz) {
  if (Array.isArray(quiz.subject)) return quiz.subject[0]?.name || "Общий тест";
  return quiz.subject?.name || "Общий тест";
}

export default function QuizPage({ assessmentType, authEnabled }) {
  const isFinal = assessmentType === "final";
  const [quizzes, setQuizzes] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [loadingQuizId, setLoadingQuizId] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [remaining, setRemaining] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [result, setResult] = useState(null);

  const loadData = useCallback(async () => {
    if (!authEnabled) {
      setLoading(false);
      setPageError("Чтобы проходить тесты и сохранять результаты, войди в аккаунт Bilim Hub.");
      return;
    }

    setLoading(true);
    setPageError("");
    const supabase = createSupabaseClient();
    const [quizResponse, attemptResponse] = await Promise.all([
      supabase
        .from("quizzes")
        .select("id, title, description, assessment_type, duration_minutes, created_at, subject:subjects(name)")
        .eq("assessment_type", assessmentType)
        .eq("is_published", true)
        .order("created_at", { ascending: true }),
      supabase
        .from("quiz_attempts")
        .select("id, quiz_id, correct_count, total_questions, score_percent, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(100),
    ]);

    if (quizResponse.error) {
      setPageError(`Не удалось загрузить тесты. Проверь, что выполнила файл supabase/quizzes.sql. Детали: ${quizResponse.error.message}`);
      setQuizzes([]);
    } else {
      setQuizzes(quizResponse.data || []);
    }

    if (attemptResponse.error) {
      setPageError((current) => current || `Не удалось загрузить историю результатов: ${attemptResponse.error.message}`);
    } else {
      setAttempts(attemptResponse.data || []);
    }
    setLoading(false);
  }, [assessmentType, authEnabled]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const submitQuiz = useCallback(async () => {
    if (!currentQuiz || submitting || result || questions.length === 0) return;

    setSubmitting(true);
    setSubmissionError("");
    const payload = Object.fromEntries(
      questions.map((question) => [
        question.id,
        Number.isInteger(answers[question.id]) ? answers[question.id] : -1,
      ])
    );

    const { data, error } = await createSupabaseClient().rpc("submit_quiz_attempt", {
      p_quiz_id: currentQuiz.id,
      p_answers: payload,
    });

    if (error) {
      setSubmissionError(`Не удалось сохранить результат: ${error.message}`);
      setSubmitting(false);
      return;
    }

    const completed = {
      ...data,
      quiz_title: currentQuiz.title,
      submitted_at: new Date().toISOString(),
    };
    setResult(completed);
    setAttempts((items) => [
      {
        id: data.attempt_id,
        quiz_id: currentQuiz.id,
        correct_count: data.correct_count,
        total_questions: data.total_questions,
        score_percent: data.score_percent,
        submitted_at: completed.submitted_at,
      },
      ...items,
    ]);
    setSubmitting(false);
  }, [answers, currentQuiz, questions, result, submitting]);

  useEffect(() => {
    if (!currentQuiz || result || submitting || remaining <= 0) return undefined;
    const timerId = window.setInterval(() => {
      setRemaining((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [currentQuiz, remaining, result, submitting]);

  useEffect(() => {
    if (currentQuiz && remaining === 0 && !result && !submitting && !submissionError) {
      submitQuiz();
    }
  }, [currentQuiz, remaining, result, submitting, submissionError, submitQuiz]);

  const startQuiz = async (quiz) => {
    setLoadingQuizId(quiz.id);
    setPageError("");
    const { data, error } = await createSupabaseClient()
      .from("quiz_questions")
      .select("id, quiz_id, prompt, options, explanation, position")
      .eq("quiz_id", quiz.id)
      .order("position", { ascending: true });

    if (error || !data?.length) {
      setPageError(error ? `Не удалось загрузить вопросы: ${error.message}` : "В этом тесте пока нет вопросов.");
      setLoadingQuizId(null);
      return;
    }

    setCurrentQuiz(quiz);
    setQuestions(data);
    setQuestionIndex(0);
    setAnswers({});
    setRemaining((quiz.duration_minutes || 10) * 60);
    setResult(null);
    setSubmissionError("");
    setLoadingQuizId(null);
  };

  const leaveQuiz = () => {
    setCurrentQuiz(null);
    setQuestions([]);
    setQuestionIndex(0);
    setAnswers({});
    setRemaining(0);
    setResult(null);
    setSubmissionError("");
    setSubmitting(false);
  };

  const currentQuestion = questions[questionIndex];
  const answeredCount = useMemo(
    () => questions.filter((question) => Number.isInteger(answers[question.id])).length,
    [answers, questions]
  );
  const progressPercent = questions.length ? (answeredCount / questions.length) * 100 : 0;

  if (currentQuiz && result) {
    const passed = result.score_percent >= 50;
    return (
      <section className="quiz-page panel">
        <div className="quiz-result-screen">
          <div className={`quiz-result-icon ${passed ? "passed" : "needs-work"}`}>
            {passed ? <Trophy size={34} /> : <Award size={34} />}
          </div>
          <span className="quiz-eyebrow">ТЕСТ ЗАВЕРШЁН</span>
          <h1>{passed ? "Отличная работа!" : "Хорошая попытка!"}</h1>
          <p className="quiz-result-subtitle">{currentQuiz.title}</p>
          <div className="quiz-score-ring" style={{ "--score": `${result.score_percent}%` }}>
            <div><strong>{result.score_percent}%</strong><span>результат</span></div>
          </div>
          <div className="quiz-result-stats">
            <div><CheckCircle2 size={18}/><strong>{result.correct_count}</strong><span>Правильных</span></div>
            <div><CircleHelp size={18}/><strong>{result.total_questions}</strong><span>Всего вопросов</span></div>
            <div><ShieldCheck size={18}/><strong>{result.total_questions - result.correct_count}</strong><span>Ошибок / пропусков</span></div>
          </div>
          <div className="quiz-result-note">
            {passed ? "Результат сохранён в твоём аккаунте. Продолжай в том же духе!" : "Результат сохранён. Повтори материал и попробуй снова — прогресс приходит с практикой."}
          </div>
          <div className="quiz-result-actions">
            <button className="quiz-primary-button" onClick={leaveQuiz}>Вернуться к тестам</button>
            <button className="quiz-secondary-button" onClick={() => startQuiz(currentQuiz)}><RotateCcw size={16}/> Пройти ещё раз</button>
          </div>
        </div>
      </section>
    );
  }

  if (currentQuiz && currentQuestion) {
    return (
      <section className="quiz-page panel">
        <div className="quiz-run-top">
          <button className="quiz-back-button" onClick={leaveQuiz}><ChevronLeft size={17}/> К списку тестов</button>
          <div className={`quiz-timer ${remaining <= 60 ? "urgent" : ""}`}><Timer size={17}/><span>{formatTime(remaining)}</span></div>
        </div>
        <div className="quiz-run-heading">
          <div><span className="quiz-eyebrow">{isFinal ? "ПРОБНАЯ СЕССИЯ" : "РУБЕЖНЫЙ КОНТРОЛЬ"}</span><h1>{currentQuiz.title}</h1><p>{currentQuiz.description}</p></div>
          <div className="quiz-question-count">Вопрос <b>{questionIndex + 1}</b> из {questions.length}</div>
        </div>
        <div className="quiz-progress"><span style={{ width: `${((questionIndex + 1) / questions.length) * 100}%` }}/></div>
        <div className="quiz-question-nav" aria-label="Навигация по вопросам">
          {questions.map((question, index) => (
            <button
              key={question.id}
              className={`${index === questionIndex ? "active" : ""} ${Number.isInteger(answers[question.id]) ? "answered" : ""}`}
              onClick={() => setQuestionIndex(index)}
              aria-label={`Перейти к вопросу ${index + 1}`}
            >{index + 1}</button>
          ))}
        </div>
        <article className="quiz-question-card">
          <div className="quiz-question-label"><FileQuestion size={17}/> ВОПРОС {questionIndex + 1}</div>
          <h2>{currentQuestion.prompt}</h2>
          <div className="quiz-options">
            {(currentQuestion.options || []).map((option, index) => {
              const selected = answers[currentQuestion.id] === index;
              return (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  className={`quiz-option ${selected ? "selected" : ""}`}
                  onClick={() => setAnswers((old) => ({ ...old, [currentQuestion.id]: index }))}
                >
                  <span className="quiz-option-letter">{String.fromCharCode(65 + index)}</span>
                  <span>{option}</span>
                  {selected && <CheckCircle2 size={18} className="quiz-option-check"/>}
                </button>
              );
            })}
          </div>
        </article>
        <div className="quiz-run-bottom">
          <span className="quiz-answered-label">Отвечено: {answeredCount} из {questions.length}</span>
          <div className="quiz-run-actions">
            <button className="quiz-secondary-button" onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} disabled={questionIndex === 0}><ChevronLeft size={16}/> Назад</button>
            {questionIndex < questions.length - 1 ? (
              <button className="quiz-primary-button" onClick={() => setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))}>Далее <ChevronRight size={16}/></button>
            ) : (
              <button className="quiz-primary-button" onClick={submitQuiz} disabled={submitting}>{submitting ? "Сохраняем..." : "Завершить тест"} <CheckCircle2 size={16}/></button>
            )}
          </div>
        </div>
        {submissionError && <div className="quiz-error"><XCircle size={16}/>{submissionError}<button onClick={submitQuiz}>Повторить</button></div>}
      </section>
    );
  }

  return (
    <section className="quiz-page panel">
      <div className="quiz-page-heading">
        <div className="quiz-heading-icon"><BookOpenCheck size={25}/></div>
        <div><span className="quiz-eyebrow">BILIM HUB · {isFinal ? "ЭКЗАМЕНАЦИОННАЯ ПОДГОТОВКА" : "ПРОВЕРКА ЗНАНИЙ"}</span><h1>{isFinal ? "Подготовка к сессии" : "Рубежный контроль"}</h1><p>{isFinal ? "Тренируйся перед экзаменами и отслеживай свои результаты." : "Проверь знания по каждому предмету в удобном темпе."}</p></div>
      </div>

      {!authEnabled && <div className="quiz-info-banner">Войди в аккаунт, чтобы проходить тесты и сохранять результаты.</div>}
      {pageError && <div className="quiz-error"><XCircle size={16}/>{pageError}</div>}

      {loading ? (
        <div className="quiz-empty-state"><span className="quiz-loader"/><b>Загружаем тесты...</b></div>
      ) : quizzes.length === 0 ? (
        <div className="quiz-empty-state">
          <div className="quiz-empty-icon"><GraduationCap size={30}/></div>
          <b>{authEnabled ? "Пока нет доступных тестов" : "Войди, чтобы начать обучение"}</b>
          <span>{authEnabled ? "Проверь, что выполнила supabase/quizzes.sql в SQL Editor. После этого тесты появятся здесь." : "После входа в Bilim Hub здесь будут твои рубежки и экзаменационные тренировки."}</span>
        </div>
      ) : (
        <>
          <div className="quiz-summary-row">
            <div><strong>{quizzes.length}</strong><span>{isFinal ? "экзаменационных теста" : "тестов по предметам"}</span></div>
            <div><strong>{attempts.filter((attempt) => quizzes.some((quiz) => quiz.id === attempt.quiz_id)).length}</strong><span>попыток завершено</span></div>
            <div><strong>{attempts.filter((attempt) => quizzes.some((quiz) => quiz.id === attempt.quiz_id)).length ? `${Math.round(attempts.filter((attempt) => quizzes.some((quiz) => quiz.id === attempt.quiz_id)).reduce((sum, attempt) => sum + attempt.score_percent, 0) / attempts.filter((attempt) => quizzes.some((quiz) => quiz.id === attempt.quiz_id)).length)}%` : "—"}</strong><span>средний результат</span></div>
          </div>

          <div className="quiz-card-grid">
            {quizzes.map((quiz) => {
              const latestAttempt = attempts.find((attempt) => attempt.quiz_id === quiz.id);
              return (
                <article className="quiz-list-card" key={quiz.id}>
                  <div className="quiz-card-top"><span className="quiz-card-icon"><FileQuestion size={22}/></span><span className="quiz-type-pill">{isFinal ? "Сессия" : "Рубежка"}</span></div>
                  <span className="quiz-subject-name">{getSubjectName(quiz)}</span>
                  <h2>{quiz.title}</h2>
                  <p>{quiz.description}</p>
                  <div className="quiz-card-meta"><span><Clock3 size={14}/>{quiz.duration_minutes} мин.</span><span><CircleHelp size={14}/>Вопросы с выбором ответа</span></div>
                  {latestAttempt && <div className="quiz-last-result"><span>Последняя попытка</span><b>{latestAttempt.score_percent}%</b></div>}
                  <button className="quiz-primary-button quiz-start-button" onClick={() => startQuiz(quiz)} disabled={loadingQuizId === quiz.id}>
                    {loadingQuizId === quiz.id ? "Загружаем..." : latestAttempt ? "Пройти снова" : "Начать тест"} <Play size={15}/>
                  </button>
                </article>
              );
            })}
          </div>

          {attempts.length > 0 && (
            <div className="quiz-history panel-inset">
              <div className="quiz-history-heading"><h2>Последние результаты</h2><span>{attempts.length} попыток</span></div>
              <div className="quiz-history-list">
                {attempts.filter((attempt) => quizzes.some((quiz) => quiz.id === attempt.quiz_id)).slice(0, 5).map((attempt) => {
                  const quiz = quizzes.find((item) => item.id === attempt.quiz_id);
                  return <div className="quiz-history-row" key={attempt.id}><div><b>{quiz?.title || "Тест"}</b><span>{new Date(attempt.submitted_at).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" })}</span></div><strong>{attempt.score_percent}%</strong></div>;
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
