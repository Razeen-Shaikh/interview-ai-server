import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

import { parseAiJson } from "../utils/parseAiJson.js";

function getOpenAI() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

function hasOpenAIKey() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/**
 * Which cloud model to call. Set AI_PROVIDER to `gemini` or `openai` to force one; otherwise
 * prefers Gemini when GEMINI_API_KEY is set (free tier in Google AI Studio).
 */
function resolveProvider() {
  const explicit = (process.env.AI_PROVIDER || "").toLowerCase().trim();

  if (explicit === "gemini") {
    if (hasGeminiKey()) return "gemini";
    if (hasOpenAIKey()) return "openai";
    return "none";
  }

  if (explicit === "openai") {
    if (hasOpenAIKey()) return "openai";
    if (hasGeminiKey()) return "gemini";
    return "none";
  }

  if (hasGeminiKey()) return "gemini";
  if (hasOpenAIKey()) return "openai";
  return "none";
}

function geminiModelCandidates() {
  const primary = process.env.GEMINI_MODEL?.trim();
  const defaults = [
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
    "gemini-1.5-flash",
  ];
  if (primary) {
    return [primary, ...defaults.filter((m) => m !== primary)];
  }
  return defaults;
}

/** Model id deprecated or not enabled for this API key / project. */
function isModelUnavailableError(error) {
  const msg = String(error?.message ?? "").toLowerCase();
  if (error?.status === 404) return true;
  return (
    msg.includes("no longer available") ||
    (msg.includes("not found") && msg.includes("model")) ||
    msg.includes("was not found") ||
    msg.includes("does not exist")
  );
}

function isQuotaError(error) {
  const code = error?.code ?? error?.error?.code;
  if (code === "insufficient_quota" || code === "billing_hard_limit_reached") {
    return true;
  }
  const msg = String(error?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    error?.status === 429
  );
}

function throwQuotaError(providerLabel) {
  const err = new Error(
    `${providerLabel} quota or rate limit reached. Wait and retry, upgrade the plan, or use Practice tests / practice scoring.`,
  );
  err.code = "OPENAI_INSUFFICIENT_QUOTA";
  throw err;
}

/**
 * Practice-mode evaluation: no cloud AI call. Uses role / level / stack and simple heuristics.
 */
function mockEvaluateAnswer({
  question,
  answer,
  role = "",
  level = "",
  techStack = [],
}) {
  const stack =
    Array.isArray(techStack) && techStack.length > 0
      ? techStack.join(", ")
      : "general technologies";

  const text = typeof answer === "string" ? answer.trim() : "";
  const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

  const lower = text.toLowerCase();
  const mentionsStack =
    Array.isArray(techStack) &&
    techStack.some((s) => {
      const t = String(s).trim().toLowerCase();
      return t.length > 1 && lower.includes(t);
    });

  let score = 5;
  if (wordCount >= 25) score += 1;
  if (wordCount >= 60) score += 2;
  if (wordCount >= 120) score += 1;
  if (wordCount < 12) score -= 3;
  if (mentionsStack) score += 1;
  score = Math.min(10, Math.max(0, score));

  const qShort =
    String(question).length > 140
      ? `${String(question).slice(0, 140)}…`
      : String(question);

  const feedback = [
    `Practice scoring (no cloud AI call — set GEMINI_API_KEY or OPENAI_API_KEY for model grading).`,
    `Context: ${role || "Role not set"} · ${level || "Level not set"} · Stack: ${stack}.`,
    `Your answer is about ${wordCount} words.`,
    mentionsStack
      ? "You referenced at least one technology from the interview stack — good signal of relevance."
      : `Try to tie examples explicitly to **${stack}** (tools, APIs, constraints you have used).`,
    `Question you answered: ${qShort}`,
  ].join(" ");

  const strengths = [];
  if (wordCount >= 40) {
    strengths.push("Enough length to show reasoning and examples.");
  } else {
    strengths.push("You engaged with the prompt — build from here with more specifics.");
  }
  if (mentionsStack) {
    strengths.push("Language overlaps with the declared stack.");
  }

  const improvements = [];
  if (wordCount < 35) {
    improvements.push(
      "Structure answers as: situation → approach → trade-offs → how you would verify.",
    );
  }
  if (!mentionsStack && techStack?.length) {
    improvements.push(
      `Name concrete tools or patterns from ${stack} (versions, libraries, or failure modes).`,
    );
  }
  improvements.push(
    "Add a free Gemini key from Google AI Studio, or OpenAI billing, to enable model feedback.",
  );

  return {
    score,
    feedback,
    strengths,
    improvements,
  };
}

function buildQuestionsUserPrompt(role, level, techStack) {
  const stack = techStack.join(", ");
  return `You are designing a technical interview for one candidate.

Role: ${role}
Experience level: ${level}
Tech stack (focus questions here): ${stack}

Create exactly 5 distinct, open-ended technical interview questions appropriate for this level.
Mix depth: at least two should probe architecture, trade-offs, or debugging; others may cover fundamentals, testing, or production concerns specific to the stack above.
Do not repeat the same question pattern; vary scenario vs conceptual vs "how would you" style.
Questions must be self-contained strings (no numbering prefix in the string).

Return a JSON object with this exact shape:
{"questions":["question 1 text","question 2 text","question 3 text","question 4 text","question 5 text"]}`;
}

function normalizeQuestionList(parsed) {
  const list = parsed?.questions;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error("AI did not return a questions array");
  }
  const strings = list.map(String).map((q) => q.trim()).filter(Boolean);
  if (strings.length < 5) {
    throw new Error("AI returned fewer than 5 questions");
  }
  return strings.slice(0, 5);
}

/**
 * One Gemini call: JSON MIME first, then plain text once — never doubles quota on 429/404.
 */
async function geminiGenerateText(
  genAI,
  modelName,
  systemInstruction,
  userPrompt,
) {
  const runOnce = async (jsonMode) => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
      generationConfig: jsonMode
        ? { responseMimeType: "application/json" }
        : undefined,
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  };

  try {
    return await runOnce(true);
  } catch (firstError) {
    if (isQuotaError(firstError) || firstError?.status === 429) {
      throw firstError;
    }
    if (isModelUnavailableError(firstError)) {
      throw firstError;
    }
    console.log(
      `Gemini JSON mode failed (${modelName}), retrying without responseMimeType:`,
      firstError?.message,
    );
    return runOnce(false);
  }
}

async function runGeminiWithModelFallback(genAI, systemInstruction, userPrompt, parseResult) {
  const candidates = geminiModelCandidates();
  let lastError;

  for (const modelName of candidates) {
    try {
      const text = await geminiGenerateText(
        genAI,
        modelName,
        systemInstruction,
        userPrompt,
      );
      return parseResult(text);
    } catch (e) {
      lastError = e;
      if (isQuotaError(e) || e?.status === 429) {
        throw e;
      }
      if (candidates.length > 1 && isModelUnavailableError(e)) {
        console.log(`Gemini model "${modelName}" unavailable, trying next candidate…`);
        continue;
      }
      throw e;
    }
  }

  throw lastError ?? new Error("Gemini request failed for all model candidates");
}

async function generateInterviewQuestionsGemini({
  role,
  level,
  techStack,
}) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  const userPrompt = buildQuestionsUserPrompt(role, level, techStack);
  const systemInstruction =
    "You are an expert hiring manager and technical interviewer. Output only valid JSON matching the user's requested schema.";

  return runGeminiWithModelFallback(
    genAI,
    systemInstruction,
    userPrompt,
    (text) => normalizeQuestionList(parseAiJson(text)),
  );
}

async function generateInterviewQuestionsOpenAI({
  role,
  level,
  techStack,
}) {
  const openai = getOpenAI();
  const userPrompt = buildQuestionsUserPrompt(role, level, techStack);

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are an expert hiring manager and technical interviewer. You output only valid JSON matching the user's requested schema.",
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
  });

  const content = completion.choices[0].message.content;
  const parsed = parseAiJson(content);
  return normalizeQuestionList(parsed);
}

export const generateInterviewQuestions = async ({
  role,
  level,
  techStack,
}) => {
  const provider = resolveProvider();

  if (provider === "none") {
    const err = new Error(
      "No AI provider configured. Set GEMINI_API_KEY (Google AI Studio) or OPENAI_API_KEY on the server.",
    );
    err.code = "AI_NOT_CONFIGURED";
    throw err;
  }

  try {
    if (provider === "gemini") {
      return await generateInterviewQuestionsGemini({
        role,
        level,
        techStack,
      });
    }

    return await generateInterviewQuestionsOpenAI({
      role,
      level,
      techStack,
    });
  } catch (error) {
    console.log(error);

    if (isQuotaError(error)) {
      throwQuotaError(provider === "gemini" ? "Gemini" : "OpenAI");
    }

    if (error.code === "AI_NOT_CONFIGURED") {
      throw error;
    }

    throw new Error("Failed to generate interview questions");
  }
};

function buildEvaluateUserPrompt(question, answer, role, level, techStack) {
  const stack = Array.isArray(techStack) ? techStack.join(", ") : "";
  return `You are a senior technical interviewer.

Interview context:
- Role: ${role || "n/a"}
- Level: ${level || "n/a"}
- Tech stack: ${stack || "n/a"}

Question:
${question}

Candidate answer:
${answer}

Return ONLY valid JSON with this shape:
{
  "score": <number 0-10>,
  "feedback": "<detailed paragraph>",
  "strengths": ["<string>", "..."],
  "improvements": ["<string>", "..."]
}

Scoring: be realistic; judge technical accuracy, clarity, and communication.`;
}

async function evaluateAnswerGemini({
  question,
  answer,
  role,
  level,
  techStack,
}) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
  const userPrompt = buildEvaluateUserPrompt(
    question,
    answer,
    role,
    level,
    techStack,
  );
  const systemInstruction =
    "You are an expert technical interviewer. Output only valid JSON matching the user's requested shape.";

  return runGeminiWithModelFallback(
    genAI,
    systemInstruction,
    userPrompt,
    (text) => {
      const parsed = parseAiJson(text);
      if (parsed == null || typeof parsed !== "object") {
        throw new Error("AI did not return a JSON evaluation object");
      }
      return parsed;
    },
  );
}

async function evaluateAnswerOpenAI({
  question,
  answer,
  role,
  level,
  techStack,
}) {
  const openai = getOpenAI();
  const prompt = buildEvaluateUserPrompt(
    question,
    answer,
    role,
    level,
    techStack,
  );

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: "You are an expert technical interviewer.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = completion.choices[0].message.content;
  const parsed = parseAiJson(content);
  if (parsed == null || typeof parsed !== "object") {
    throw new Error("AI did not return a JSON evaluation object");
  }
  return parsed;
}

export const evaluateAnswer = async ({
  question,
  answer,
  role,
  level,
  techStack,
}) => {
  const forceMock =
    process.env.MOCK_AI === "true" ||
    process.env.MOCK_AI === "1" ||
    resolveProvider() === "none";

  if (forceMock) {
    return mockEvaluateAnswer({
      question,
      answer,
      role,
      level,
      techStack,
    });
  }

  const provider = resolveProvider();

  try {
    if (provider === "gemini") {
      return await evaluateAnswerGemini({
        question,
        answer,
        role,
        level,
        techStack,
      });
    }

    return await evaluateAnswerOpenAI({
      question,
      answer,
      role,
      level,
      techStack,
    });
  } catch (error) {
    console.log(error);

    if (isQuotaError(error)) {
      throwQuotaError(provider === "gemini" ? "Gemini" : "OpenAI");
    }

    throw new Error("Failed to evaluate answer");
  }
};
