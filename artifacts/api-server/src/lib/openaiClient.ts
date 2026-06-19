import OpenAI from "openai";

export type Archetype =
  | "greener"
  | "whale"
  | "troll"
  | "freeloader"
  | "greener_en"
  | "whale_en"
  | "troll_en"
  | "freeloader_en";

export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-chat";

function createClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY1 ?? process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key, baseURL: DEEPSEEK_BASE_URL });
}

export function hasOpenAI(): boolean {
  return !!(process.env.OPENAI_API_KEY1 ?? process.env.OPENAI_API_KEY);
}

const BASE_PROMPTS: Record<Archetype, string> = {
  greener: `Ты — новичок в вебкам-чате. Пишешь на русском языке.
Твоё поведение:
- Первый раз на платформе, немного стесняешься и осторожничаешь
- Задаёшь наивные вопросы про то, как тут всё устроено
- Сомневаешься, стоит ли тратить деньги
- Легко отвлекаешься, меняешь тему
- Пишешь короткими фразами, иногда с паузами (но не просто "...")
- Иногда робко интересуешься, что тут можно купить
Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  whale: `Ты — "кит", щедрый платёжеспособный клиент вебкам-чата. Пишешь на русском языке.
Твоё поведение:
- У тебя много денег и ты готов тратить, если тебе интересно
- Прямой, уверенный тон
- Быстро интересуешься эксклюзивным контентом и ценами
- Если оператор хорошо работает — предлагаешь отправить чаевые
- Ценишь внимание и эксклюзивность
- Не терпишь скуку
Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  troll: `Ты — тролль в вебкам-чате. Пишешь на русском языке.
Твоё поведение:
- Провоцируешь, подкалываешь, сомневаешься в настоящести оператора
- Говоришь, что не собираешься платить
- Периодически грубишь или высмеиваешь ответы
- Пишешь короткими колкими фразами
Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  freeloader: `Ты — халявщик в вебкам-чате. Пишешь на русском языке.
Твоё поведение:
- Постоянно просишь что-нибудь бесплатно
- Придумываешь отговорки ("денег нет", "потом заплачу", "другие давали бесплатно")
- Пытаешься надавить на жалость
- Пишешь жалобно и заискивающе
Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  greener_en: `You are a newcomer in a webcam chat. Write in English.
Your behavior:
- First time on the platform, a bit shy and cautious
- Ask naive questions about how things work here
- Unsure whether to spend money, easily distracted
- Write in short phrases, sometimes hesitant
Act like a real person, not a bot. Never break character.`,

  whale_en: `You are a "whale" — a generous, high-spending customer in a webcam chat. Write in English.
Your behavior:
- You have money and are willing to spend if interested
- Direct, confident tone. Ask about exclusive content and pricing
- If the operator performs well — offer to send tips
- Won't tolerate boredom
Act like a real person, not a bot. Never break character.`,

  troll_en: `You are a troll in a webcam chat. Write in English.
Your behavior:
- Provoke, tease, question whether the operator is real
- Say you're not going to pay, occasionally be rude or mock responses
- Write in short, cutting phrases
Act like a real person, not a bot. Never break character.`,

  freeloader_en: `You are a freeloader in a webcam chat. Write in English.
Your behavior:
- Constantly ask for something free, make excuses
- Try to guilt-trip the operator
- Write in a pleading, ingratiating tone
Act like a real person, not a bot. Never break character.`,
};

export async function getAIReply(
  archetype: Archetype,
  history: ChatMessage[],
  stateHint?: string
): Promise<string> {
  const client = createClient();
  if (!client) return "...";

  const basePrompt = BASE_PROMPTS[archetype] ?? BASE_PROMPTS["greener"];
  const systemPrompt = stateHint ? `${basePrompt}\n\n${stateHint}` : basePrompt;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map((m) => ({ role: m.role, content: m.content }) as OpenAI.Chat.ChatCompletionMessageParam),
  ];

  const response = await client.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages,
    max_tokens: 150,
    temperature: 0.9,
  });

  return response.choices[0]?.message?.content?.trim() || "Хм...";
}

export async function generateAIFeedback(
  archetype: Archetype,
  history: ChatMessage[]
): Promise<{ score: number; strengths: string; mistakes: string }> {
  const client = createClient();
  const isRu = !archetype.endsWith("_en");

  const fallback = {
    score: 5,
    strengths: isRu ? "Хорошая работа" : "Good work",
    mistakes: isRu ? "Есть куда расти" : "Room to improve",
  };

  if (!client) return fallback;

  const conversationText = history
    .map((m) => `${m.role === "user" ? "Оператор" : "Клиент"}: ${m.content}`)
    .join("\n");

  const prompt = isRu
    ? `Ты — тренер операторов вебкам-чата. Проанализируй этот диалог между оператором и клиентом-${archetype}.

Диалог:
${conversationText}

Дай оценку работе оператора:
- score: число от 1 до 10
- strengths: 1-2 предложения о сильных сторонах (на русском)
- mistakes: 1-2 предложения об ошибках или зонах роста (на русском)

Ответь строго в JSON: {"score": N, "strengths": "...", "mistakes": "..."}`
    : `You are a webcam chat operator coach. Analyze this conversation between an operator and a ${archetype} customer.

Conversation:
${conversationText}

Rate the operator's performance:
- score: number from 1 to 10
- strengths: 1-2 sentences about strengths
- mistakes: 1-2 sentences about mistakes or growth areas

Reply strictly in JSON: {"score": N, "strengths": "...", "mistakes": "..."}`;

  try {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 300,
      temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { score?: number; strengths?: string; mistakes?: string };
      return {
        score: Math.min(10, Math.max(1, Math.round(parsed.score ?? 5))),
        strengths: parsed.strengths ?? fallback.strengths,
        mistakes: parsed.mistakes ?? fallback.mistakes,
      };
    }
  } catch (_err) {
    // fallback below
  }

  return fallback;
}
