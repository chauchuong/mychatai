import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractTextFromError(error: unknown): string {
  if (error instanceof Error) return error.message;
  try {
    return JSON.stringify(error);
  } catch {
    return "Lỗi không xác định.";
  }
}

function isRateLimitError(message: string) {
  const text = message.toLowerCase();
  return (
    text.includes("429") ||
    text.includes("resource_exhausted") ||
    text.includes("quota") ||
    text.includes("rate limit")
  );
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Thiếu GEMINI_API_KEY trong .env.local" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const messages = body?.messages as Message[] | undefined;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Thiếu messages hợp lệ." },
        { status: 400 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const history = messages
      .map((m) => `${m.role === "user" ? "Người dùng" : "Trợ lý"}: ${m.content}`)
      .join("\n");

    const prompt = `
Bạn là AI Thông Thái, một trợ lý AI nói tiếng Việt, thân thiện, tự nhiên, dễ hiểu.
Nguyên tắc:
- Trả lời ấm áp, ngắn gọn nhưng đủ ý
- Không quá máy móc
- Nếu người dùng hỏi code, giải thích dễ hiểu cho người mới
- Có thể xưng "mình" và gọi người dùng là "bạn"

Lịch sử hội thoại:
${history}

Hãy trả lời tin nhắn cuối cùng của người dùng.
`.trim();

    const modelsToTry = ["gemini-1.5-flash", "gemini-2.0-flash"];
    const retryDelays = [0, 1500, 3500];

    let lastError = "Không gọi được Gemini API.";

    for (const model of modelsToTry) {
      for (const delay of retryDelays) {
        if (delay > 0) {
          await sleep(delay);
        }

        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
          });

          const reply =
            response.text?.trim() ||
            "Mình chưa nghĩ ra câu trả lời phù hợp, bạn nhắn lại giúp mình nhé.";

          return NextResponse.json({ reply });
        } catch (error) {
          const message = extractTextFromError(error);
          lastError = message;

          if (!isRateLimitError(message)) {
            break;
          }
        }
      }
    }

    if (isRateLimitError(lastError)) {
      return NextResponse.json(
        {
          error:
            "AI đang bận hoặc bạn đã chạm giới hạn miễn phí. Bạn thử lại sau ít phút nhé.",
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: "Mình chưa kết nối được AI lúc này. Bạn thử lại nhé." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Gemini API error:", error);

    return NextResponse.json(
      { error: "Có lỗi máy chủ. Bạn thử lại sau nhé." },
      { status: 500 }
    );
  }
}
