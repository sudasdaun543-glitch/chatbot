interface MockMessage {
  role: "assistant";
  content: string;
  action?: { type: "send_tips"; amount: number };
}

type Archetype = "greener" | "whale" | "troll" | "freeloader" | "greener_en" | "whale_en" | "troll_en" | "freeloader_en";

const SCRIPTS: Record<Archetype, string[]> = {
  greener: [
    "привет... я тут первый раз",
    "а ты чем занимаешься?",
    "ясно.. а это платно или нет?",
    "хм, не знаю стоит ли...",
    "окей, может попробую что-нибудь",
    "а ты всегда тут?",
    "ладно, пока наверное",
  ],
  whale: [
    "привет. я готов тратить, если будет интересно",
    "покажи что умеешь",
    "мне нравится. сколько стоит премиум?",
    "окей беру, кидай реквизиты",
    "хочу эксклюзив, готов платить хорошо",
    "ты меня не разочаровываешь. продолжай",
    "ладно, давай ещё что-нибудь",
  ],
  troll: [
    "хахаха что за чушь",
    "ты реальная вообще?",
    "давай бесплатно или уйду",
    "скучно. ты не умеешь общаться",
    "всё равно ничего не куплю",
    "провокация провокация провокация",
    "ты проиграла, я ухожу",
  ],
  freeloader: [
    "привет, дай что-нибудь бесплатно",
    "у меня нет денег сейчас, потом заплачу",
    "а скидку можешь сделать?",
    "другие давали бесплатно",
    "ну пожалуйста, хоть чуть-чуть",
    "если не дашь — найду другую",
    "ладно ладно, может в следующий раз",
  ],
  greener_en: [
    "hi... first time here",
    "what do you do here?",
    "is this free or paid?",
    "not sure if i should...",
    "maybe i'll try something",
    "are you always online?",
    "okay, bye for now i guess",
  ],
  whale_en: [
    "hey. ready to spend if it's worth it",
    "show me what you've got",
    "i like this. how much for premium?",
    "alright, i'll take it",
    "i want exclusive content, good money",
    "you don't disappoint. keep going",
    "okay, give me more",
  ],
  troll_en: [
    "lmao what is this",
    "are you even real?",
    "make it free or i'm leaving",
    "boring. you can't talk",
    "i'm not buying anything anyway",
    "just trolling lol",
    "you lost, i'm out",
  ],
  freeloader_en: [
    "hi, give me something free",
    "i have no money right now, will pay later",
    "can you give a discount?",
    "others gave it for free",
    "come on, just a little",
    "if you won't — i'll find someone else",
    "okay okay, maybe next time",
  ],
};

const sessionState = new Map<string, { archetype: Archetype; step: number }>();

export function getNextReply(sessionId: string, archetype: string): MockMessage | null {
  const arch = archetype as Archetype;
  if (!SCRIPTS[arch]) return null;

  if (!sessionState.has(sessionId)) {
    sessionState.set(sessionId, { archetype: arch, step: 0 });
  }

  const state = sessionState.get(sessionId)!;
  const lines = SCRIPTS[arch];

  if (state.step >= lines.length) {
    return { role: "assistant", content: "Наверное, пока всё..." };
  }

  const content = lines[state.step];
  state.step++;

  if ((arch === "whale" || arch === "whale_en") && state.step === 4) {
    return { role: "assistant", content, action: { type: "send_tips", amount: 50 } };
  }

  return { role: "assistant", content };
}

export function generateFeedback(sessionId: string): { score: number; strengths: string; mistakes: string } {
  const state = sessionState.get(sessionId);
  const arch = state?.archetype ?? "greener";
  const step = state?.step ?? 0;

  const score = Math.min(10, Math.max(1, 4 + Math.floor(step * 0.8)));

  const strengthsMap: Record<Archetype, string> = {
    greener: "Хороший старт, мягко вводила в атмосферу",
    whale: "Быстро распознала платёжеспособного клиента",
    troll: "Сохраняла спокойствие под давлением",
    freeloader: "Вежливый тон без агрессии",
    greener_en: "Good start, gently set the mood",
    whale_en: "Quickly identified a paying customer",
    troll_en: "Stayed calm under pressure",
    freeloader_en: "Maintained polite tone",
  };

  const mistakesMap: Record<Archetype, string> = {
    greener: "Медленно вела к покупке, стоит добавить больше призывов к действию",
    whale: "Можно было предложить эксклюзив раньше",
    troll: "Иногда реагировала на провокации — лучше игнорировать",
    freeloader: "Слишком быстро шла на уступки",
    greener_en: "Slow to upsell, add more calls to action",
    whale_en: "Could have offered exclusives earlier",
    troll_en: "Reacted to provocations — better to ignore",
    freeloader_en: "Too quick to make concessions",
  };

  return {
    score,
    strengths: strengthsMap[arch] ?? "Хорошая работа",
    mistakes: mistakesMap[arch] ?? "Есть куда расти",
  };
}

export function cleanupSession(sessionId: string) {
  sessionState.delete(sessionId);
}
