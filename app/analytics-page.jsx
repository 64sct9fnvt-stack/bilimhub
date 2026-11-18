
"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
import {
  Trophy,
  Target,
  ClipboardList,
  TrendingUp
} from "lucide-react";

export default function AnalyticsPage({ authEnabled, userId }) {
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authEnabled || !userId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadAnalytics() {
      const { data, error } = await createClient()
        .from("quiz_attempts")
        .select("id, score_percent, submitted_at")
        .eq("user_id", userId)
        .order("submitted_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        setError(error.message);
      } else {
        setAttempts(data || []);
      }

      setLoading(false);
    }

    loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [authEnabled, userId]);

  if (!authEnabled) return <p>Войди в аккаунт, чтобы увидеть статистику.</p>;
  if (loading) return <p>Загружаем статистику...</p>;
  if (error) return <p>Ошибка загрузки: {error}</p>;

  const scores = attempts.map(item => Number(item.score_percent || 0));
  const average = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;
  const best = scores.length ? Math.max(...scores) : 0;

  const cards = [
    { title: "Средний результат", value: `${average}%`, icon: Target },
    { title: "Пройдено тестов", value: attempts.length, icon: ClipboardList },
    { title: "Лучший результат", value: `${best}%`, icon: Trophy },
  ];

  return (
    <section style={{ padding: "12px 0" }}>
      <h1>Моя статистика</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>
        Анализ твоих учебных результатов
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 16,
        marginTop: 24
      }}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.title} style={{
              background: "#211b38",
              border: "1px solid #3c315b",
              borderRadius: 18,
              padding: 22
            }}>
              <Icon size={24} color="#a78bfa" />
              <p style={{ opacity: 0.7, marginTop: 14 }}>{card.title}</p>
              <h2 style={{ fontSize: 30, marginTop: 6 }}>{card.value}</h2>
            </article>
          );
        })}
      </div>

      <article style={{
        background: "#211b38",
        border: "1px solid #3c315b",
        borderRadius: 18,
        padding: 22,
        marginTop: 24
      }}>
        <h2 style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <TrendingUp size={22} color="#a78bfa" />
          Динамика результатов
        </h2>

        {attempts.length === 0 ? (
          <p style={{ marginTop: 18, opacity: 0.7 }}>
            Пройди первый тест, чтобы появилась статистика.
          </p>
        ) : (
          <div style={{
            display: "flex",
            alignItems: "end",
            gap: 12,
            height: 180,
            marginTop: 24,
            overflowX: "auto"
          }}>
            {attempts.map((item, index) => {
              const score = Math.max(0, Math.min(100, Number(item.score_percent || 0)));

              return (
                <div key={item.id} style={{
                  minWidth: 38,
                  flex: 1,
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "end",
                  alignItems: "center",
                  gap: 8
                }}>
                  <span style={{ fontSize: 12 }}>{score}%</span>
                  <div style={{
                    width: "100%",
                    height: `${Math.max(score, 3)}%`,
                    background: "linear-gradient(180deg, #a78bfa, #7045bd)",
                    borderRadius: "8px 8px 2px 2px"
                  }} />
                  <span style={{ fontSize: 11, opacity: 0.6 }}>
                    {index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
