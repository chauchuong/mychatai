import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY!;

const genAI = new GoogleGenerativeAI(apiKey);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractError(error: unknown) {
  if (!error) return "Unknown error";

  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const prompt = body.message;

    if (!prompt) {
      return NextResponse.json(
        { error: "Thiếu message" },
        { status: 400 }
      );
    }

    // 🔥 Danh sách model (ưu tiên nhẹ trước)
    const models = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash",
    ];

    // 🔁 retry delay
    const delays = [0, 1200, 2500];

    let lastError = "";

    for (const model of models) {
      for (const delay of delays) {
        try {
          if (delay > 0) await sleep(delay);

          console.log("👉 Đang thử:", model, "| delay:", delay);

          const modelInstance = genAI.getGenerativeModel({
            model,
          });

          const result = await modelInstance.generateContent(prompt);

          const text =
            result.response.text()?.trim() ||
            "Mình chưa có câu trả lời phù hợp.";

          return NextResponse.json({
            reply: text,
            provider: "gemini",
            model,
          });
        } catch (error) {
          const msg = extractError(error);
          lastError = msg;

          console.log("❌ Lỗi:", model, "|", msg);

          // ❗ KHÔNG break → thử tiếp model khác
        }
      }
    }

    // 🚨 fallback khi tất cả fail
    return NextResponse.json({
      reply:
        "Mình đang hơi quá tải 😢 Bạn thử lại sau vài giây nhé.",
      provider: "fallback",
      error: lastError,
    });
  } catch (error) {
    const msg = extractError(error);

    return NextResponse.json(
      {
        reply: "Có lỗi xảy ra 😢",
        error: msg,
      },
      { status: 500 }
    );
  }
}
