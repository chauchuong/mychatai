import OpenAI from "openai";
import { NextResponse } from "next/server";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const client = new OpenAI({
  apiKey: process.env.GPTGE_API_KEY,
  baseURL: "https://api.gpt.ge/v1",
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: Request) {
  try {
    if (!process.env.GPTGE_API_KEY) {
      return NextResponse.json(
        { error: "Thiếu GPTGE_API_KEY trong .env.local" },
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

    // Đổi các model này theo model bạn thấy trong dashboard api.gpt.ge
    const modelsToTry = [
      "gpt-4o-mini",
      "gpt-4.1-mini",
      "gpt-4o",
    ];

    const retryDelays = [0, 1200, 2500];
    let lastError = "Không gọi được api.gpt.ge";

    for (const model of modelsToTry) {
      for (const delay of retryDelays) {
        if (delay > 0) await sleep(delay);

        try {
          const completion = await client.chat.completions.create({
            model,
            messages: [
              {
                role: "system",
                content:
                  "Bạn là AI Thông Thái, trả lời bằng tiếng Việt, thân thiện, dễ hiểu, gọn gàng.",
              },
              ...messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            ],
          });

          const reply =
            completion.choices[0]?.message?.content?.trim() ||
            "Mình chưa có câu trả lời phù hợp.";

          return NextResponse.json({
            reply,
            provider: "api.gpt.ge",
            model,
          });
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          console.error("api.gpt.ge error:", model, lastError);
        }
      }
    }

    return NextResponse.json(
      {
        error: `Tất cả model đều lỗi. Lỗi cuối: ${lastError}`,
      },
      { status: 500 }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Lỗi máy chủ không xác định.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
