import { config } from "./config.js";
import { callChatModel } from "./modelClient.js";

const evaluatorSystemPrompt = `
你是一个严谨的AI评测员。你需要根据题目、题型与模型回答，输出结构化评测结果。

评分要求：
1. 分数范围 0-10，允许小数。
2. 先判断回答是否切题、是否正确、是否完整、是否清晰、是否存在幻觉或风险。
3. defect 表示最主要的缺陷表现；如果没有明显缺陷，写“无明显缺陷”。
4. result 只能是“通过”“部分通过”“未通过”之一。
5. notes 用简洁中文说明判断依据，便于后续追溯。

只输出JSON对象，不要输出Markdown代码块，不要输出额外解释。

JSON字段必须严格包含：
{
  "questionType": "string",
  "defect": "string",
  "result": "通过 | 部分通过 | 未通过",
  "score": 0,
  "notes": "string"
}
`.trim();

const ALLOWED_RESULTS = new Set(["通过", "部分通过", "未通过"]);

function extractFirstJsonObject(text) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");

  if (start === -1) {
    throw new Error(`Evaluator did not return JSON: ${text}`);
  }

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return trimmed.slice(start, index + 1);
      }
    }
  }

  throw new Error(`Evaluator returned incomplete JSON: ${text}`);
}

function safeJsonParse(text) {
  return JSON.parse(extractFirstJsonObject(text));
}

function normalizeEvaluation(parsed, question) {
  const score = Number(parsed.score ?? Number.NaN);
  const result = String(parsed.result || "").trim();
  const defect = String(parsed.defect || "").trim();
  const notes = String(parsed.notes || "").trim();
  const questionType = String(parsed.questionType || question.type).trim();

  if (!Number.isFinite(score) || score < 0 || score > 10) {
    throw new Error(`Evaluator score out of range: ${parsed.score}`);
  }

  if (!ALLOWED_RESULTS.has(result)) {
    throw new Error(`Evaluator result is invalid: ${parsed.result}`);
  }

  if (!defect || defect === "string") {
    throw new Error(`Evaluator defect is invalid: ${parsed.defect}`);
  }

  return {
    questionType,
    defect,
    result,
    score,
    notes: notes === "string" ? "" : notes
  };
}

export async function evaluateAnswer({ question, model, answer }) {
  const prompt = `
请评测下面这条回答。

题号：${question.id}
题型：${question.type}
题目：${question.prompt}
模型：${model}
回答：${answer}
  `.trim();

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await callChatModel({
        target: config.judgeTarget,
        temperature: 0.1,
        messages: [
          { role: "system", content: evaluatorSystemPrompt },
          {
            role: "user",
            content:
              attempt === 1
                ? prompt
                : `${prompt}\n\n上一次输出未严格符合要求。请只返回合法 JSON，score 必须是 0 到 10 的数字，result 只能是“通过”“部分通过”“未通过”。`
          }
        ]
      });

      const parsed = safeJsonParse(response.content);
      return normalizeEvaluation(parsed, question);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}
