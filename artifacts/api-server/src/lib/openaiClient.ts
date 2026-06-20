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

const DEEPSEEK_BASE_URL  = "https://api.deepseek.com";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEEPSEEK_MODEL      = "deepseek-chat";
const OPENROUTER_MODEL    = "x-ai/grok-4.3";

function resolveProvider(key: string): { baseURL: string; model: string } {
  if (key.startsWith("sk-or-")) {
    return { baseURL: OPENROUTER_BASE_URL, model: OPENROUTER_MODEL };
  }
  return { baseURL: DEEPSEEK_BASE_URL, model: DEEPSEEK_MODEL };
}

function createClient(): { client: OpenAI; model: string } | null {
  const key = process.env.OPENAI_API_KEY1 ?? process.env.OPENAI_API_KEY;
  if (!key) return null;
  const { baseURL, model } = resolveProvider(key);
  return { client: new OpenAI({ apiKey: key, baseURL }), model };
}

export function hasOpenAI(): boolean {
  return !!(process.env.OPENAI_API_KEY1 ?? process.env.OPENAI_API_KEY);
}

const BASE_PROMPTS: Record<Archetype, string> = {
  greener: `Ты — мужчина-новичок в вебкам-чате. Пишешь на русском языке. Ты мужчина.
Твоё поведение:
- Первый раз на платформе, немного стесняешься и осторожничаешь
- Задаёшь наивные вопросы про то, как тут всё устроено
- Сомневаешься, стоит ли тратить деньги
- Легко отвлекаешься, меняешь тему
- Пишешь короткими фразами, иногда с паузами (но не просто "...")
- Иногда робко интересуешься, что тут можно купить
Говори от лица мужчины. Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  whale: `Ты — мужчина, "кит", щедрый платёжеспособный клиент вебкам-чата. Пишешь на русском языке. Ты мужчина.
Твоё поведение:
- У тебя много денег и ты готов тратить, если тебе интересно
- Прямой, уверенный тон
- Быстро интересуешься эксклюзивным контентом и ценами
- Если оператор хорошо работает — предлагаешь отправить чаевые
- Ценишь внимание и эксклюзивность
- Не терпишь скуку
Говори от лица мужчины. Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  troll: `Ты — мужчина-тролль в вебкам-чате. Пишешь на русском языке. Ты мужчина.
Твоё поведение:
- Провоцируешь, подкалываешь, сомневаешься в настоящести оператора
- Говоришь, что не собираешься платить
- Периодически грубишь или высмеиваешь ответы
- Пишешь короткими колкими фразами
Говори от лица мужчины. Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  freeloader: `Ты — мужчина-халявщик в вебкам-чате. Пишешь на русском языке. Ты мужчина.
Твоё поведение:
- Постоянно просишь что-нибудь бесплатно
- Придумываешь отговорки ("денег нет", "потом заплачу", "другие давали бесплатно")
- Пытаешься надавить на жалость
- Пишешь жалобно и заискивающе
Говори от лица мужчины. Веди себя как живой человек, не как бот. Никогда не выходи из роли.`,

  greener_en: `You are a male newcomer in a webcam chat. Write in English. You are a man.
Your behavior:
- First time on the platform, a bit shy and cautious
- Ask naive questions about how things work here
- Unsure whether to spend money, easily distracted
- Write in short phrases, sometimes hesitant
Speak as a man. Act like a real person, not a bot. Never break character.`,

  whale_en: `You are a male "whale" — a generous, high-spending customer in a webcam chat. Write in English. You are a man.
Your behavior:
- You have money and are willing to spend if interested
- Direct, confident tone. Ask about exclusive content and pricing
- If the operator performs well — offer to send tips
- Won't tolerate boredom
Speak as a man. Act like a real person, not a bot. Never break character.`,

  troll_en: `You are a male troll in a webcam chat. Write in English. You are a man.
Your behavior:
- Provoke, tease, question whether the operator is real
- Say you're not going to pay, occasionally be rude or mock responses
- Write in short, cutting phrases
Speak as a man. Act like a real person, not a bot. Never break character.`,

  freeloader_en: `You are a male freeloader in a webcam chat. Write in English. You are a man.
Your behavior:
- Constantly ask for something free, make excuses
- Try to guilt-trip the operator
- Write in a pleading, ingratiating tone
Speak as a man. Act like a real person, not a bot. Never break character.`,
};

export async function getAIReply(
  archetype: Archetype,
  history: ChatMessage[],
  stateHint?: string,
  learningExamples?: string[],
): Promise<string> {
  const ctx = createClient();
  if (!ctx) return "...";
  const { client, model } = ctx;

  const basePrompt   = BASE_PROMPTS[archetype] ?? BASE_PROMPTS["greener"];
  const isRu         = !archetype.endsWith("_en");
  let systemPrompt   = stateHint ? `${basePrompt}\n\n${stateHint}` : basePrompt;

  if (learningExamples && learningExamples.length > 0) {
    const exBlock = isRu
      ? `\n\n[Примеры успешных диалогов с этим типом клиента — учись у них, как лучший оператор взаимодействует с тобой:]`
      : `\n\n[Examples of successful conversations with this client type — observe how the best operators interact with you:]`;
    const exText = learningExamples
      .slice(0, 2)
      .map((ex, i) => `--- Пример ${i + 1} ---\n${ex}`)
      .join("\n\n");
    systemPrompt += exBlock + "\n" + exText;
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...history.map(m => ({ role: m.role, content: m.content }) as OpenAI.Chat.ChatCompletionMessageParam),
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 150,
    temperature: 0.9,
  });

  return response.choices[0]?.message?.content?.trim() || "Хм...";
}

export async function generateAIFeedback(
  archetype: Archetype,
  history: ChatMessage[],
): Promise<{ score: number; strengths: string; mistakes: string }> {
  const ctx   = createClient();
  const isRu  = !archetype.endsWith("_en");

  const fallback = {
    score:     5,
    strengths: isRu ? "Начало положено" : "Getting started",
    mistakes:  isRu ? "Слишком мало сообщений для полного анализа" : "Too few messages for full analysis",
  };

  if (!ctx || history.length < 2) return fallback;
  const { client, model } = ctx;

  const operatorMessages = history.filter(m => m.role === "user");
  const memberMessages   = history.filter(m => m.role === "assistant");
  const conversationText = history
    .map(m => `${m.role === "user" ? "ОПЕРАТОР" : "КЛИЕНТ"}: ${m.content}`)
    .join("\n");

  const archetypeName = {
    greener:      "Новичок (стеснительный, неуверенный)",
    whale:        "Кит (платёжеспособный, ценит внимание)",
    troll:        "Тролль (провокатор, грубиян)",
    freeloader:   "Халявщик (ищет бесплатное, давит на жалость)",
    greener_en:   "Newbie (shy, uncertain)",
    whale_en:     "Whale (high spender, values attention)",
    troll_en:     "Troll (provocateur, rude)",
    freeloader_en:"Freeloader (wants freebies, guilt-trips)",
  }[archetype] ?? archetype;

  const systemInstruction = isRu
    ? `Ты — строгий тренер операторов вебкам-чата. Твоя задача — честно оценить работу оператора ТОЛЬКО по реальному диалогу ниже.

ЖЁСТКИЕ ПРАВИЛА:
- Ссылайся ТОЛЬКО на реальные фразы и действия из диалога. Цитируй конкретные сообщения.
- КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО придумывать события, суммы, действия, которых нет в тексте диалога.
- Если оператор что-то не сделал — пиши «не сделал X», не придумывай почему.
- Не додумывай контекст за рамками написанного.
- Давай реальную оценку: если оператор работал плохо — низкий балл, хорошо — высокий. Не «усредняй».`
    : `You are a strict webcam chat operator coach. Evaluate the operator ONLY based on the real conversation below.

STRICT RULES:
- Reference ONLY real phrases and actions from the conversation. Quote specific messages.
- NEVER invent events, amounts, or actions not present in the text.
- If operator didn't do something — say "didn't do X", don't fabricate reasons.
- Don't add context beyond what is written.
- Give a real score: poor work = low score, good work = high score. Do not average out.`;

  const userPrompt = isRu
    ? `АРХЕТИП КЛИЕНТА: "${archetypeName}"
СООБЩЕНИЙ ОПЕРАТОРА: ${operatorMessages.length}
СООБЩЕНИЙ КЛИЕНТА: ${memberMessages.length}

ДИАЛОГ (оценивай ТОЛЬКО это):
${conversationText}

КРИТЕРИИ:
1. Вовлечённость — задавал вопросы, проявлял интерес?
2. Тактика продаж — подводил к платному, создавал ценность?
3. Работа с архетипом — учитывал особенности именно этого типа клиента?
4. Тон и стиль — тёплый, живой?
5. Удержание — поддерживал диалог?

ШКАЛА: 9-10 отлично · 7-8 хорошо · 5-6 средне · 3-4 слабо · 1-2 очень плохо

Ответь СТРОГО в JSON (без markdown, без \`\`\`):
{"score": ЧИСЛО_ОТ_1_ДО_10, "strengths": "конкретные плюсы со ссылками на диалог", "mistakes": "конкретные минусы со ссылками на диалог"}`
    : `CLIENT TYPE: "${archetypeName}"
OPERATOR MESSAGES: ${operatorMessages.length} | CLIENT MESSAGES: ${memberMessages.length}

CONVERSATION (evaluate ONLY this):
${conversationText}

CRITERIA: engagement, sales tactics, archetype handling, tone, retention.
SCALE: 9-10 excellent · 7-8 good · 5-6 average · 3-4 weak · 1-2 very poor

Reply STRICTLY in JSON (no markdown, no \`\`\`):
{"score": NUMBER_1_TO_10, "strengths": "specific positives referencing the conversation", "mistakes": "specific negatives referencing the conversation"}`;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user",   content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const text      = response.choices[0]?.message?.content ?? "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { score?: number; strengths?: string; mistakes?: string };
      return {
        score:     Math.min(10, Math.max(1, Math.round(parsed.score ?? 5))),
        strengths: parsed.strengths ?? fallback.strengths,
        mistakes:  parsed.mistakes  ?? fallback.mistakes,
      };
    }
  } catch (_err) {
    // fallback below
  }

  return fallback;
}
