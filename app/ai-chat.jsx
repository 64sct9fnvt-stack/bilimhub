
"use client";

import { useState } from "react";
import { Sparkles, Send, Bot, User, Loader2 } from "lucide-react";

export default function AIChat() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Привет! 👋 Я Bilim AI — твой учебный помощник. Задавай вопросы по математике, программированию, истории и другим предметам!"
    }
  ]);
  const [loading, setLoading] = useState(false);

  async function sendMessage(event) {
    event.preventDefault();

    const question = message.trim();
    if (!question || loading) return;

    setMessages(current => [
      ...current,
      { role: "user", text: question }
    ]);
    setMessage("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка сервера");
      }

      setMessages(current => [
        ...current,
        { role: "assistant", text: data.answer }
      ]);
    } catch (error) {
      setMessages(current => [
        ...current,
        {
          role: "assistant",
          text: `Не удалось получить ответ: ${error.message}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Sparkles color="#a78bfa" />
          Bilim AI
        </h1>
        <p style={{ opacity: 0.65, marginTop: 8 }}>
          Твой персональный помощник в обучении
        </p>
      </div>

      <div style={{
        background: "#211b38",
        border: "1px solid #3c315b",
        borderRadius: 18,
        padding: 20,
        minHeight: 350,
        maxHeight: 500,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 16
      }}>
        {messages.map((item, index) => (
          <div key={index} style={{
            display: "flex",
            justifyContent: item.role === "user" ? "flex-end" : "flex-start",
            gap: 10
          }}>
            {item.role === "assistant" && <Bot color="#a78bfa" size={22} />}

            <div style={{
              background: item.role === "user" ? "#7045bd" : "#302746",
              borderRadius: 14,
              padding: 14,
              maxWidth: "80%",
              whiteSpace: "pre-wrap",
              lineHeight: 1.6
            }}>
              {item.text}
            </div>

            {item.role === "user" && <User color="#c4b5fd" size={22} />}
          </div>
        ))}

        {loading && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", opacity: 0.7 }}>
            <Loader2 size={20} />
            Bilim AI думает...
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} style={{
        display: "flex",
        gap: 10,
        marginTop: 16
      }}>
        <input
          value={message}
          onChange={event => setMessage(event.target.value)}
          placeholder="Задай вопрос Bilim AI..."
          disabled={loading}
          style={{
            flex: 1,
            minWidth: 0,
            padding: 16,
            borderRadius: 12,
            background: "#211b38",
            color: "white",
            border: "1px solid #3c315b"
          }}
        />

        <button
          type="submit"
          disabled={!message.trim() || loading}
          style={{
            padding: "0 20px",
            borderRadius: 12,
            border: "none",
            background: "#7045bd",
            color: "white",
            cursor: "pointer"
          }}
        >
          <Send size={20} />
        </button>
      </form>
    </section>
  );
}
