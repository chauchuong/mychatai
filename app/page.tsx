"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  PanelLeft,
  Sparkles,
  Trash2,
  Bot,
  User,
  Plus,
  MessageSquare,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const STORAGE_KEY = "ai-thong-thai-vip-chat";

function createMessage(
  role: "user" | "assistant",
  content: string
): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role,
    content,
  };
}

function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

function TypingMarkdown({
  text,
  speed = 16,
}: {
  text: string;
  speed?: number;
}) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    setDisplayed("");
    let i = 0;

    const timer = setInterval(() => {
      i += 1;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed]);

  return <MarkdownMessage text={displayed} />;
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1">
      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.2s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:-0.1s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400" />
    </div>
  );
}

export default function Page() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      "assistant",
      "Xin chào 👋 Mình là **AI Thông Thái**. Bạn cứ hỏi tự nhiên nhé, mình sẽ trả lời rõ ràng, thân thiện và dễ hiểu."
    ),
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lastAssistantId, setLastAssistantId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed);
        setLastAssistantId(null);
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "0px";
    textareaRef.current.style.height = `${Math.min(
      textareaRef.current.scrollHeight,
      180
    )}px`;
  }, [input]);

  async function sendMessage(prefilled?: string) {
    const raw = prefilled ?? input;
    const text = raw.trim();

    if (!text || loading || isComposing) return;

    setError("");

    const userMessage = createMessage("user", text);
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");

    try {
      setLoading(true);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const rawText = await res.text();
      let data: { reply?: string; error?: string } = {};

      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error("API trả về dữ liệu không hợp lệ.");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Có lỗi khi gọi AI.");
      }

      const assistantMessage = createMessage(
        "assistant",
        data.reply || "Mình chưa có câu trả lời phù hợp."
      );

      setMessages([...nextMessages, assistantMessage]);
      setLastAssistantId(assistantMessage.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không gửi được tin nhắn.";
      setError(message);

      const fallback = createMessage(
        "assistant",
        "Mình đang gặp lỗi kết nối một chút. Bạn thử lại giúp mình nhé."
      );

      setMessages((prev) => [...prev, fallback]);
      setLastAssistantId(fallback.id);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !isComposing) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearChat() {
    const reset = [
      createMessage(
        "assistant",
        "Mình là **AI Thông Thái** ✨ Cuộc trò chuyện đã được làm mới rồi. Bạn muốn hỏi gì tiếp?"
      ),
    ];
    setMessages(reset);
    setLastAssistantId(reset[0].id);
    setError("");
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reset));
  }

  const quickPrompts = [
    "Giải thích JavaScript cho người mới",
    "Viết landing page đẹp kiểu Apple",
    "Gợi ý app AI dễ làm",
    "Lên kế hoạch học code 30 ngày",
  ];

  return (
    <main className="min-h-screen text-white">
      <div className="mx-auto flex min-h-screen max-w-[1440px] gap-4 p-3 md:p-4">
        <aside
          className={`${
            sidebarOpen ? "w-[280px]" : "w-0 overflow-hidden"
          } hidden shrink-0 transition-all duration-300 lg:block`}
        >
          <div className="glass h-full rounded-[28px] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
            <button
              onClick={clearChat}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white transition hover:bg-white/[0.09]"
            >
              <Plus className="h-4 w-4" />
              Cuộc trò chuyện mới
            </button>

            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.08]">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="text-[16px] font-semibold">AI Thông Thái</div>
                <div className="text-sm text-zinc-300">VIP Pro Theme</div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                <MessageSquare className="h-4 w-4" />
                Gợi ý nhanh
              </div>

              <div className="space-y-2">
                {quickPrompts.map((item) => (
                  <button
                    key={item}
                    onClick={() => sendMessage(item)}
                    disabled={loading}
                    className="w-full rounded-2xl border border-white/10 bg-[#1d2129] px-4 py-3 text-left text-sm text-white transition hover:bg-[#272c36] disabled:opacity-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="glass flex min-h-[calc(100vh-24px)] flex-1 flex-col overflow-hidden rounded-[28px] shadow-[0_24px_90px_rgba(0,0,0,0.42)]">
          <header className="border-b border-white/10 bg-white/[0.03] px-4 py-4 md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen((v) => !v)}
                  className="hidden rounded-xl border border-white/10 bg-white/[0.05] p-2 text-white/80 hover:bg-white/[0.08] lg:flex"
                >
                  <PanelLeft className="h-4 w-4" />
                </button>

                <div>
                  <h1 className="text-[20px] font-semibold tracking-[-0.02em]">
                    AI Thông Thái
                  </h1>
                  <p className="mt-2 text-center text-xs text-zinc-500">
  Design by{" "}
  <a
    href="https://zalo.me/chauchuong"
    target="_blank"
    className="text-white/80 hover:text-white underline transition"
  >
    Châu Chương
  </a>
</p>
                </div>
              </div>

              <button
                onClick={clearChat}
                className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white transition hover:bg-white/[0.08]"
              >
                Xóa chat
              </button>
            </div>
          </header>

          <section className="flex-1 overflow-y-auto bg-[rgba(7,9,14,0.24)] px-4 py-6 md:px-6">
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
              {messages.map((m) => {
                const isUser = m.role === "user";
                const shouldType = !isUser && m.id === lastAssistantId;

                return (
                  <div
                    key={m.id}
                    className={`fade-in-up flex items-end gap-3 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!isUser && (
                      <div className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#1e222b] text-zinc-200 shadow-lg">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[84%] rounded-[26px] px-5 py-4 text-[16px] shadow-[0_14px_34px_rgba(0,0,0,0.2)] ${
                        isUser
                          ? "bg-white text-[#111113]"
                          : "glass-soft text-white"
                      }`}
                    >
                      {shouldType ? (
                        <TypingMarkdown text={m.content} speed={16} />
                      ) : (
                        <MarkdownMessage text={m.content} />
                      )}
                    </div>

                    {isUser && (
                      <div className="mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-lg">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div className="fade-in-up flex items-end gap-3">
                  <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-[#1e222b] text-zinc-200 shadow-lg">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="glass-soft rounded-[22px] px-4 py-3">
                    <LoadingDots />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </section>

          <footer className="border-t border-white/10 bg-white/[0.03] p-4 md:p-5">
            <div className="mx-auto max-w-4xl">
              <div className="glass-soft rounded-[28px] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-end gap-3">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onCompositionStart={() => setIsComposing(true)}
                    onCompositionEnd={() => setIsComposing(false)}
                    placeholder="Nhập tin nhắn cho AI Thông Thái..."
                    className="min-h-[56px] flex-1 resize-none bg-transparent px-3 py-3 text-[16px] text-white outline-none placeholder:text-zinc-400"
                  />

                  <button
                    onClick={() => sendMessage()}
                    disabled={loading || !input.trim()}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black transition duration-200 hover:scale-[1.03] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-zinc-400">
                AI có thể trả lời sai. Nội dung quan trọng nên kiểm tra lại.
              </p>
            <p className="mt-2 text-center text-xs text-zinc-500">
  Design by{" "}
  <a
    href="https://zalo.me/chauchuong"
    target="_blank"
    className="text-white font-medium hover:text-white hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.6)] transition"
  >
     Châu Chương
  </a>
</p>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}