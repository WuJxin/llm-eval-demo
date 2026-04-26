import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env");

const PROVIDER_DEFS = {
  doubao: {
    provider: "doubao",
    providerLabel: "豆包",
    apiKeyEnv: "DOUBAO_API_KEY",
    modelEnv: "DOUBAO_MODEL",
    baseUrlEnv: "DOUBAO_BASE_URL",
    defaultBaseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    defaultModel: ""
  },
  spark: {
    provider: "spark",
    providerLabel: "讯飞星火",
    apiKeyEnv: "SPARK_API_KEY",
    modelEnv: "SPARK_MODEL",
    baseUrlEnv: "SPARK_BASE_URL",
    defaultBaseUrl: "https://maas-api.cn-huabei-1.xf-yun.com/v2",
    defaultModel: ""
  },
  qwen: {
    provider: "qwen",
    providerLabel: "千问",
    apiKeyEnv: "QWEN_API_KEY",
    modelEnv: "QWEN_MODEL",
    baseUrlEnv: "QWEN_BASE_URL",
    defaultBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    defaultModel: "qwen-plus"
  }
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildProviderConfig(providerId) {
  const providerDef = PROVIDER_DEFS[providerId];
  if (!providerDef) {
    throw new Error(`Unsupported provider: ${providerId}`);
  }

  return {
    provider: providerDef.provider,
    providerLabel: providerDef.providerLabel,
    apiKey: process.env[providerDef.apiKeyEnv] || "",
    model: process.env[providerDef.modelEnv] || providerDef.defaultModel,
    baseUrl: process.env[providerDef.baseUrlEnv] || providerDef.defaultBaseUrl
  };
}

function resolveTargets(providerIds) {
  return providerIds.map((providerId) => {
    const target = buildProviderConfig(providerId);

    if (!target.apiKey) {
      throw new Error(
        `Missing required environment variable for ${target.providerLabel}: ${PROVIDER_DEFS[providerId].apiKeyEnv}`
      );
    }

    if (!target.model) {
      throw new Error(`Missing model configuration for ${target.providerLabel}`);
    }

    return {
      ...target,
      displayName: `${target.providerLabel}(${target.model})`
    };
  });
}

loadEnvFile(ENV_PATH);

const enabledProviders = parseCsv(process.env.EVAL_PROVIDERS || "doubao,spark,qwen");
const targets = resolveTargets(enabledProviders);
const judgeProvider = process.env.JUDGE_PROVIDER || (enabledProviders.includes("qwen") ? "qwen" : enabledProviders[0]);
const judgeBase = buildProviderConfig(judgeProvider);

if (!judgeBase.apiKey) {
  throw new Error(`Missing required environment variable for judge provider ${judgeBase.providerLabel}`);
}

export const config = {
  targets,
  judgeTarget: {
    ...judgeBase,
    model: process.env.JUDGE_MODEL || judgeBase.model,
    displayName: `${judgeBase.providerLabel}(${process.env.JUDGE_MODEL || judgeBase.model})`
  },
  feishu: {
    appId: process.env.FEISHU_APP_ID || "",
    appSecret: process.env.FEISHU_APP_SECRET || "",
    bitableAppToken: process.env.FEISHU_BITABLE_APP_TOKEN || "",
    detailTableName: process.env.FEISHU_DETAIL_TABLE_NAME || "AI评测明细",
    trendTableName: process.env.FEISHU_TREND_TABLE_NAME || "AI评测折线图数据"
  }
};

export function hasFeishuConfig() {
  return Boolean(
    config.feishu.appId &&
      config.feishu.appSecret &&
      config.feishu.bitableAppToken
  );
}
