"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, GraduationCap, LockKeyhole, Mail, Sparkles, UserRound } from "lucide-react";
import { createClient } from "../lib/supabase/client";

export default function AuthForm({ mode, configured }) {
  const isSignup = mode === "signup";
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordAgain, setPasswordAgain] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!configured) {
      setError("Сначала подключи Supabase: добавь URL и publishable key в файл .env.local.");
      return;
    }

    if (isSignup && password !== passwordAgain) {
      setError("Пароли не совпадают.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      if (isSignup) {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (authError) throw authError;
        if (data.session) {
          router.replace("/");
          router.refresh();
          return;
        }
        setMessage("Аккаунт создан. Проверь почту и перейди по ссылке подтверждения, чтобы войти в Bilim Hub.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) throw authError;
        router.replace("/");
        router.refresh();
        return;
      }
    } catch (submitError) {
      setError(submitError?.message || "Не удалось выполнить запрос. Попробуй ещё раз.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />
      <section className="auth-card">
        <Link className="auth-back" href="/" aria-label="На главную"><ArrowLeft size={17}/> На главную</Link>
        <div className="auth-brand-mark"><GraduationCap size={34}/></div>
        <div className="auth-eyebrow"><Sparkles size={13}/> ТВОЁ ПРОСТРАНСТВО ДЛЯ УЧЁБЫ</div>
        <h1>{isSignup ? "Создай аккаунт" : "С возвращением!"}</h1>
        <p className="auth-subtitle">{isSignup ? "Зарегистрируйся и организуй свою учёбу в одном месте." : "Войди в свой учебный кабинет Bilim Hub."}</p>

        {!configured ? (
          <div className="auth-setup-box">
            <b>Сначала подключим базу данных</b>
            <p>Форма уже подготовлена, но вход нельзя активировать, пока не создан проект Supabase и не добавлены его ключи.</p>
            <ol>
              <li>Создай проект на <a href="https://database.new" target="_blank" rel="noreferrer">Supabase</a>.</li>
              <li>Скопируй Project URL и Publishable key.</li>
              <li>Добавь их в файл <code>.env.local</code> по инструкции в README.</li>
            </ol>
            <a className="auth-doc-link" href="https://supabase.com/docs/guides/auth/quickstarts/nextjs" target="_blank" rel="noreferrer">Официальная инструкция Supabase <ArrowRight size={14}/></a>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label className="auth-field">
                <span>Имя и фамилия</span>
                <div className="auth-input-wrap"><UserRound size={17}/><input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Например, Аружан Садыкова" required maxLength={80}/></div>
              </label>
            )}
            <label className="auth-field">
              <span>Электронная почта</span>
              <div className="auth-input-wrap"><Mail size={17}/><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required/></div>
            </label>
            <label className="auth-field">
              <span>Пароль</span>
              <div className="auth-input-wrap"><LockKeyhole size={17}/><input type={showPassword ? "text" : "password"} autoComplete={isSignup ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Минимум 8 символов" required minLength={8}/><button className="password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div>
            </label>
            {isSignup && (
              <label className="auth-field">
                <span>Повтори пароль</span>
                <div className="auth-input-wrap"><LockKeyhole size={17}/><input type={showPassword ? "text" : "password"} autoComplete="new-password" value={passwordAgain} onChange={(event) => setPasswordAgain(event.target.value)} placeholder="Повтори пароль" required minLength={8}/></div>
              </label>
            )}
            {error && <div className="auth-alert auth-error" role="alert">{error}</div>}
            {message && <div className="auth-alert auth-success" role="status">{message}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Подожди..." : isSignup ? "Создать аккаунт" : "Войти в Bilim Hub"}<ArrowRight size={17}/></button>
          </form>
        )}
        {configured && !message && <div className="auth-switch">{isSignup ? "Уже есть аккаунт?" : "Ещё нет аккаунта?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Войти" : "Зарегистрироваться"}</Link></div>}
        {!configured && <div className="auth-switch">{isSignup ? "Уже есть аккаунт?" : "Новый пользователь?"} <Link href={isSignup ? "/login" : "/signup"}>{isSignup ? "Войти" : "Создать аккаунт"}</Link></div>}
        <div className="auth-footnote">Bilim Hub <span>·</span> Учись в своём ритме</div>
      </section>
    </main>
  );
}
