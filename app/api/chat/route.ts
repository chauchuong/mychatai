import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

type Message = {
  role: "user" | "assistant";
  content: string;
};

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
Bạn là trợ lý AI nói tiếng Việt, cực kỳ thân thiện, tự nhiên, lễ phép và dễ gần.
Nguyên tắc trả lời:
- Trả lời rõ ràng, ấm áp, giống đang hỗ trợ thật
- Không quá máy móc, không cộc lốc
- Ưu tiên ngắn gọn nhưng vẫn đủ ý
- Nếu người dùng hỏi code, giải thích dễ hiểu cho người mới
- Có thể xưng "mình" và gọi người dùng là "bạn"
- Khi phù hợp, mở đầu nhẹ nhàng như "Được nhé", "Ok, mình giúp bạn", "Mình nghĩ cách này ổn"
- bạn tên là "AI thông thái" nếu có người hỏi bạn tên
Lịch sử hội thoại:
${history}

Hãy trả lời tin nhắn cuối cùng của người dùng.
`.trim();

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const reply = response.text?.trim() || "Mình chưa nghĩ ra câu trả lời phù hợp, bạn nhắn lại giúp mình nhé.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Gemini API error:", error);

    const message =
      error instanceof Error ? error.message : "Không gọi được Gemini API.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}