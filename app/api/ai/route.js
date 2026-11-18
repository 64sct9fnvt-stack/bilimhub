
import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Не найден API-ключ Gemini. Проверь .env.local." },
        { status: 500 }
      );
    }

    const { message } = await request.json();

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "Напиши вопрос для Bilim AI." },
        { status: 400 }
      );
    }

    if (message.length > 4000) {
      return NextResponse.json(
        { error: "Сообщение слишком длинное. Максимум 4000 символов." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Ты — Bilim AI, дружелюбный учебный помощник образовательной платформы Bilim Hub.
Объясняй сложные темы простым языком, помогай студентам учиться, решать задачи пошагово.
Отвечай на русском или казахском языке в зависимости от языка вопроса.
Если вопрос не связан с учёбой, всё равно отвечай вежливо.

Вопрос студента: ${message.trim()}`
    });

    return NextResponse.json({
      answer: response.text || "Не удалось получить ответ. Попробуй ещё раз."
    });

  } catch (error) {
    console.error("Bilim AI error:", error);

    return NextResponse.json(
      { error: "Не удалось получить ответ от Bilim AI. Попробуй позже." },
      { status: 500 }
    );
  }
}
