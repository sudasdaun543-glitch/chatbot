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
    strengths: isRu ? "Начало положено" : "Getting started",
    mistakes: isRu ? "Слишком мало сообщений для полного анализа" : "Too few messages for full analysis",
  };

  if (!client || history.length < 2) return fallback;

  const operatorMessages = history.filter((m) => m.role === "user");
  const memberMessages = history.filter((m) => m.role === "assistant");

  const conversationText = history
    .map((m) => `${m.role === "user" ? "ОПЕРАТОР" : "КЛИЕНТ"}: ${m.content}`)
    .join("\n");

  const archetypeName = {
    greener: "Новичок (стеснительный, неуверенный)",
    whale: "Кит (платёжеспособный, ценит внимание)",
    troll: "Тролль (провокатор, грубиян)",
    freeloader: "Халявщик (ищет бесплатное, давит на жалость)",
    greener_en: "Newbie (shy, uncertain)",
    whale_en: "Whale (high spender, values attention)",
    troll_en: "Troll (provocateur, rude)",
    freeloader_en: "Freeloader (wants freebies, guilt-trips)",
  }[archetype] ?? archetype;

  const prompt = isRu
    ? `Ты — строгий и честный тренер операторов вебкам-чата. Твоя задача — объективно оценить работу оператора по реальному диалогу.

ТЕМА ДИАЛОГА: оператор общается с клиентом типа "${archetypeName}"
СООБЩЕНИЙ ОПЕРАТОРА: ${operatorMessages.length}
СООБЩЕНИЙ КЛИЕНТА: ${memberMessages.length}

ДИАЛОГ:
${conversationText}

КРИТЕРИИ ОЦЕНКИ (оцени каждый пункт мысленно):
1. Вовлечённость — задавал ли оператор вопросы, проявлял ли искренний интерес?
2. Тактика продаж — подводил ли к платному контенту, создавал ли ценность?
3. Работа с типом клиента — учитывал ли поведение именно этого архетипа?
4. Тон и стиль — был ли тёплым, живым, не роботизированным?
5. Удержание — не давал ли клиенту уйти, поддерживал ли диалог?

ШКАЛА ОЦЕНОК:
9-10 — отличная работа: тёплый тон, правильная тактика, клиент вовлечён и доволен
7-8  — хорошая работа: большинство критериев выполнено, мелкие промахи
5-6  — средне: оператор общается, но без стратегии, упускает возможности
3-4  — слабо: короткие ответы, нет вовлечённости, клиент не чувствует интереса
1-2  — очень плохо: грубость, игнор, провоцирование ухода

ВАЖНО: Не давай среднюю оценку "на всякий случай". Оценивай строго по тому, что видишь в диалоге. Если диалог короткий и слабый — ставь 3-4. Если оператор отлично работает — ставь 8-9. Будь конкретным.

Ответь СТРОГО в JSON без лишнего текста:
{"score": ЧИСЛО_ОТ_1_ДО_10, "strengths": "конкретное что сделано хорошо со ссылкой на диалог", "mistakes": "конкретные ошибки или что упущено"}`
    : `You are a strict and honest webcam chat operator coach. Your task is to objectively evaluate the operator based on the real conversation.

CLIENT TYPE: "${archetypeName}"
OPERATOR MESSAGES: ${operatorMessages.length}
CLIENT MESSAGES: ${memberMessages.length}

CONVERSATION:
${conversationText}

SCORING CRITERIA (evaluate each mentally):
1. Engagement — did the operator ask questions, show genuine interest?
2. Sales tactics — did they guide toward paid content, create value?
3. Archetype handling — did they adapt to this specific client type?
4. Tone & style — warm, natural, not robotic?
5. Retention — kept the client engaged, prevented dropout?

SCORING SCALE:
9-10 — excellent: warm tone, right tactics, client engaged and pleased
7-8  — good: most criteria met, minor slips
5-6  — average: communicating but no strategy, missing opportunities
3-4  — weak: short replies, no engagement, client doesn't feel interest
1-2  — very poor: rudeness, ignoring, driving the client away

IMPORTANT: Do NOT default to a middle score. Score strictly based on what you see. Short weak dialogue = 3-4. Excellent work = 8-9. Be specific.

Reply STRICTLY in JSON, no extra text:
{"score": NUMBER_1_TO_10, "strengths": "specific good things with reference to the conversation", "mistakes": "specific mistakes or missed opportunities"}`;

  try {
    const response = await client.chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400,
      temperature: 0.4,
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
