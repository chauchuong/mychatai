import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shuffle(array: string[]) {
  return [...array].sort(() => Math.random() - 0.5);
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
      return NextResponse.json({ error: "Thiếu message" }, { status: 400 });
    }

    // 🔥 LIST MODEL (lọc chỉ text model)
    const models = [
      "gemini-1.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-3-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.1-pro",
    ];

    // 🔀 random thứ tự mỗi request
    const randomizedModels = shuffle(models);

    // 🔁 retry delay
    const delays = [0, 1000, 2000];

    let lastError = "";

    for (const model of randomizedModels) {
      for (const delay of delays) {
        try {
          if (delay) await sleep(delay);

          console.log("🚀 thử:", model);

          const modelInstance = genAI.getGenerativeModel({ model });

          const result = await modelInstance.generateContent(prompt);

          const text =
            result.response.text()?.trim() ||
            "Mình chưa có câu trả lời phù hợp.";

          return NextResponse.json({
            reply: text,
            provider: "gemini",
            model,
          });
        } catch (err) {
          const msg = extractError(err);
          lastError = msg;

          console.log("❌ lỗi:", model, msg);

          // ❗ không break → thử model khác
        }
      }
    }

    // 💀 fallback cuối
    return NextResponse.json({
      reply:
        "AI đang quá tải 😢 thử lại sau vài giây hoặc đổi câu hỏi nhé.",
      provider: "fallback",
      error: lastError,
    });
  } catch (err) {
    return NextResponse.json(
      {
        reply: "Server lỗi 😢",
        error: extractError(err),
      },
      { status: 500 }
    );
  }
}
