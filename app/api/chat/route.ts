import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";

type Message = {
  role: "user" | "assistant";
  content: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLastUserMessage(messages: Message[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  return lastUser?.content?.trim() || "";
}

function buildFriendlyFallback(messages: Message[]) {
  const last = getLastUserMessage(messages).toLowerCase();

  if (!last) {
    return "Mình vẫn đang ở đây. Bạn nhắn lại câu hỏi giúp mình nhé.";
  }

  if (last.includes("hello") || last.includes("hi") || last.includes("chào")) {
    return "Chào bạn 👋 Mình vẫn hoạt động bình thường nè. Bạn cần mình giúp gì tiếp?";
  }

  if (last.includes("code") || last.includes("lập trình") || last.includes("javascript")) {
    return "Mình đang tạm bận kết nối AI chính, nhưng mình vẫn có thể hỗ trợ cơ bản. Bạn gửi rõ đoạn code hoặc yêu cầu cụ thể, mình sẽ giúp theo cách ngắn gọn và dễ hiểu.";
  }

  return `Mình đang gặp trục trặc kết nối AI chính, nhưng mình vẫn nhận được câu hỏi của bạn: "${getLastUserMessage(
    messages
  )}". Bạn thử gửi lại sau ít phút, hoặc nhắn rõ hơn để mình hỗ trợ theo cách đơn giản nhất nhé.`;
}

function normalizeMessages(messages: Message[]) {
  return messages
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.role,
      content: m.content.trim(),
    }));
}

async function tryGemini(messages: Message[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("NO_GEMINI_KEY");

  const ai = new GoogleGenAI({ apiKey });

  const history = messages
    .map((m) => `${m.role === "user" ? "Người dùng" : "Trợ lý"}: ${m.content}`)
    .join("\n");

  const prompt = `
Bạn là AI Thông Thái, trợ lý AI nói tiếng Việt, thân thiện, dễ hiểu, tự nhiên.
Nguyên tắc:
- Trả lời rõ ràng, ấm áp
- Không quá máy móc
- Ưu tiên ngắn gọn nhưng đủ ý
- Nếu hỏi code, giải thích dễ hiểu cho người mới

Lịch sử hội thoại:
${history}

Hãy trả lời tin nhắn cuối cùng của người dùng.
`.trim();

  const models = ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash"];
  const delays = [0, 1200, 2500];

  let lastError = "Gemini failed";

  for (const model of models) {
    for (const delay of delays) {
      if (delay) await sleep(delay);

      try {
        const res = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        const text = res.text?.trim();
        if (text) return text;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  throw new Error(`GEMINI_FAILED: ${lastError}`);
}

async function tryOpenAI(messages: Message[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("NO_OPENAI_KEY");

  const client = new OpenAI({ apiKey });

  const normalized = normalizeMessages(messages);

  const models = ["gpt-4.1-mini", "gpt-4.1"];
  const delays = [0, 1200];

  let lastError = "OpenAI failed";

  for (const model of models) {
    for (const delay of delays) {
      if (delay) await sleep(delay);

      try {
        const completion = await client.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content:
                "Bạn là AI Thông Thái, trợ lý AI nói tiếng Việt, thân thiện, rõ ràng, dễ hiểu.",
            },
            ...normalized.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          ],
        });

        const text = completion.choices[0]?.message?.content?.trim();
        if (text) return text;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
  }

  throw new Error(`OPENAI_FAILED: ${lastError}`);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages = body?.messages as Message[] | undefined;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Thiếu messages hợp lệ." },
        { status: 400 }
      );
    }

    try {
      const reply = await tryGemini(messages);
      return NextResponse.json({ reply, provider: "gemini" });
    } catch (geminiError) {
      console.error("Gemini error:", geminiError);
    }

    try {
      const reply = await tryOpenAI(messages);
      return NextResponse.json({ reply, provider: "openai" });
    } catch (openaiError) {
      console.error("OpenAI error:", openaiError);
    }

    const fallbackReply = buildFriendlyFallback(messages);
    return NextResponse.json({
      reply: fallbackReply,
      provider: "local-fallback",
    });
  } catch (error) {
    console.error("API fatal error:", error);

    return NextResponse.json(
      {
        reply: "Mình đang lỗi một chút nhưng vẫn ở đây. Bạn thử gửi lại sau ít phút nhé.",
        provider: "emergency-fallback",
      },
      { status: 200 }
    );
  }
}
