interface MockMessage {
  role: "assistant";
  content: string;
  action?: { type: "send_tips"; amount: number };
}

type Archetype = "greener" | "whale" | "troll" | "freeloader" | "greener_en" | "whale_en" | "troll_en" | "freeloader_en";
export type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

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

// ─── Analyse real conversation history and produce a realistic score ─────────

const WARM_RX     = /привет|хай|как дела|интерес|расскаж|нравит|хорош|класс|супер|отлич|люб|скуч|понима|поддерж|спрос|помог|hello|hi there|how are|nice|great|love|miss|awesome|tell me|curious|sounds|enjoy|wonder/i;
const COLD_RX     = /^.{1,4}$|^(ок|да|нет|ну|ok|yes|no|k|yep|nope|sure|lol|хм|мм)\.?$/i;
const QUESTION_RX = /\?/;
const UPSELL_RX   = /купи|прем|эксклюзив|контент|стоит|цена|тариф|подписк|buy|premium|exclusive|content|price|plan|subscri|special|offer/i;

export function generateFeedback(
  sessionId: string,
  history?: ChatMessage[],
): { score: number; strengths: string; mistakes: string } {
  const state = sessionState.get(sessionId);
  const arch  = (state?.archetype ?? "greener") as Archetype;
  const isRu  = !arch.endsWith("_en");
  const base  = arch.replace("_en", "") as "greener" | "whale" | "troll" | "freeloader";

  if (!history || history.length < 2) {
    const step  = state?.step ?? 0;
    const score = Math.min(10, Math.max(1, 4 + Math.floor(step * 0.8)));
    return {
      score,
      strengths: isRu ? "Начало положено" : "Getting started",
      mistakes:  isRu ? "Слишком мало сообщений для оценки" : "Too few messages to evaluate",
    };
  }

  const opMsgs     = history.filter(m => m.role === "user");
  const clientMsgs = history.filter(m => m.role === "assistant");

  if (opMsgs.length === 0) {
    return {
      score: 1,
      strengths: isRu ? "—" : "—",
      mistakes:  isRu ? "Оператор не написал ни одного сообщения" : "Operator sent no messages",
    };
  }

  const avgLen        = opMsgs.reduce((s, m) => s + m.content.length, 0) / opMsgs.length;
  const warmCount     = opMsgs.filter(m => WARM_RX.test(m.content)).length;
  const coldCount     = opMsgs.filter(m => COLD_RX.test(m.content.trim())).length;
  const questionCount = opMsgs.filter(m => QUESTION_RX.test(m.content)).length;
  const upsellCount   = opMsgs.filter(m => UPSELL_RX.test(m.content)).length;
  const total         = opMsgs.length;
  const warmRatio     = warmCount / total;
  const coldRatio     = coldCount / total;
  const questionRatio = questionCount / total;

  let pts = 5;

  if (avgLen >= 60)        pts += 1.5;
  else if (avgLen >= 30)   pts += 0.5;
  else if (avgLen < 12)    pts -= 1.5;

  if (warmRatio >= 0.5)        pts += 1.5;
  else if (warmRatio >= 0.25)  pts += 0.5;

  if (coldRatio >= 0.4)        pts -= 2;
  else if (coldRatio >= 0.2)   pts -= 0.75;

  if (questionRatio >= 0.4)    pts += 1;
  else if (questionRatio === 0 && total >= 3) pts -= 1;

  if (base === "whale") {
    if (upsellCount >= 2)                     pts += 1.5;
    else if (upsellCount === 0 && total >= 3) pts -= 1;
  }
  if (base === "troll") {
    if (coldRatio < 0.2 && warmRatio >= 0.3)  pts += 1;
    if (coldRatio >= 0.5)                     pts -= 1.5;
  }
  if (base === "freeloader") { if (upsellCount >= 1) pts += 1; }
  if (base === "greener")    { if (questionRatio >= 0.3) pts += 0.5; }
  if (total >= 6)              pts += 0.5;
  if (clientMsgs.length >= 5)  pts += 0.25;

  const score = Math.min(10, Math.max(1, Math.round(pts)));

  const goods: string[] = [];
  const bads:  string[] = [];

  if (isRu) {
    if (warmRatio >= 0.4)                       goods.push("тёплый и вовлекающий тон");
    if (questionRatio >= 0.35)                  goods.push("активно задавал(а) вопросы");
    if (avgLen >= 40)                           goods.push("содержательные сообщения");
    if (upsellCount >= 2 && base === "whale")   goods.push("грамотно подводил(а) к покупке");
    if (total >= 6)                             goods.push("удержал(а) диалог");
    if (coldRatio >= 0.35)                      bads.push("слишком много коротких/холодных ответов");
    if (questionRatio < 0.15 && total >= 3)     bads.push("мало вопросов — клиент не чувствовал интереса");
    if (avgLen < 15)                            bads.push("очень короткие сообщения, нет глубины");
    if (upsellCount === 0 && base === "whale")  bads.push("не предложил(а) платный контент");
    if (goods.length === 0) goods.push("присутствие в диалоге");
    if (bads.length === 0)  bads.push("стоит поработать над удержанием клиента");
  } else {
    if (warmRatio >= 0.4)                       goods.push("warm and engaging tone");
    if (questionRatio >= 0.35)                  goods.push("actively asked questions");
    if (avgLen >= 40)                           goods.push("substantive messages");
    if (upsellCount >= 2 && base === "whale")   goods.push("effectively guided client toward purchase");
    if (total >= 6)                             goods.push("maintained the conversation");
    if (coldRatio >= 0.35)                      bads.push("too many short/cold replies");
    if (questionRatio < 0.15 && total >= 3)     bads.push("too few questions — client didn't feel engaged");
    if (avgLen < 15)                            bads.push("very short messages, no depth");
    if (upsellCount === 0 && base === "whale")  bads.push("didn't offer paid content");
    if (goods.length === 0) goods.push("maintained dialogue presence");
    if (bads.length === 0)  bads.push("work on keeping the client engaged longer");
  }

  return { score, strengths: goods.join(", "), mistakes: bads.join(", ") };
}

export function cleanupSession(sessionId: string) {
  sessionState.delete(sessionId);
}
