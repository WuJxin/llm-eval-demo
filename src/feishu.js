import { config } from "./config.js";

const FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

const DETAIL_FIELD_DEFS = [
  { field_name: "测试题号", type: 1 },
  { field_name: "提问内容", type: 1 },
  { field_name: "模型版本", type: 1 },
  { field_name: "回答内容", type: 1 },
  { field_name: "问题类型", type: 1 },
  { field_name: "缺陷表现", type: 1 },
  { field_name: "评测结果", type: 1 },
  { field_name: "评分", type: 2 },
  { field_name: "备注", type: 1 }
];

async function feishuRequest(path, options = {}, accessToken) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${FEISHU_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const result = await response.json();

  if (!response.ok || result.code !== 0) {
    throw new Error(`Feishu API error (${response.status}): ${JSON.stringify(result)}`);
  }

  return result;
}

async function getTenantAccessToken() {
  const result = await feishuRequest("/auth/v3/tenant_access_token/internal", {
    method: "POST",
    body: {
      app_id: config.feishu.appId,
      app_secret: config.feishu.appSecret
    }
  });

  return result.tenant_access_token || result.data?.tenant_access_token;
}

async function listTables(accessToken) {
  const result = await feishuRequest(
    `/bitable/v1/apps/${config.feishu.bitableAppToken}/tables?page_size=100`,
    {},
    accessToken
  );

  return result.data?.items || [];
}

async function createTable(accessToken, tableName) {
  const result = await feishuRequest(
    `/bitable/v1/apps/${config.feishu.bitableAppToken}/tables`,
    {
      method: "POST",
      body: {
        table: {
          name: tableName
        }
      }
    },
    accessToken
  );

  return result.data?.table_id;
}

async function ensureTable(accessToken, tableName) {
  const tables = await listTables(accessToken);
  const existed = tables.find((item) => item.name === tableName);
  if (existed) {
    return existed.table_id;
  }
  return createTable(accessToken, tableName);
}

async function listFields(accessToken, tableId) {
  const result = await feishuRequest(
    `/bitable/v1/apps/${config.feishu.bitableAppToken}/tables/${tableId}/fields?page_size=100`,
    {},
    accessToken
  );

  return result.data?.items || [];
}

async function createField(accessToken, tableId, field) {
  await feishuRequest(
    `/bitable/v1/apps/${config.feishu.bitableAppToken}/tables/${tableId}/fields`,
    {
      method: "POST",
      body: field
    },
    accessToken
  );
}

async function ensureFields(accessToken, tableId, fieldDefs) {
  const fields = await listFields(accessToken, tableId);
  const fieldNames = new Set(fields.map((item) => item.field_name));

  for (const fieldDef of fieldDefs) {
    if (!fieldNames.has(fieldDef.field_name)) {
      await createField(accessToken, tableId, fieldDef);
    }
  }
}

async function batchCreateRecords(accessToken, tableId, rows) {
  for (let index = 0; index < rows.length; index += 200) {
    const chunk = rows.slice(index, index + 200);
    await feishuRequest(
      `/bitable/v1/apps/${config.feishu.bitableAppToken}/tables/${tableId}/records/batch_create`,
      {
        method: "POST",
        body: {
          records: chunk.map((fields) => ({ fields }))
        }
      },
      accessToken
    );
  }
}

function buildTrendRows(records) {
  const byQuestionId = new Map();

  for (const record of records) {
    if (!byQuestionId.has(record.testQuestionId)) {
      byQuestionId.set(record.testQuestionId, {
        测试题号: record.testQuestionId
      });
    }

    byQuestionId.get(record.testQuestionId)[record.modelVersion] = record.score;
  }

  return Array.from(byQuestionId.values()).sort((a, b) =>
    String(a["测试题号"]).localeCompare(String(b["测试题号"]))
  );
}

export async function syncToFeishuBitable(records, models) {
  const accessToken = await getTenantAccessToken();
  const detailTableId = await ensureTable(accessToken, config.feishu.detailTableName);
  const trendTableId = await ensureTable(accessToken, config.feishu.trendTableName);

  await ensureFields(accessToken, detailTableId, DETAIL_FIELD_DEFS);
  await ensureFields(accessToken, trendTableId, [
    { field_name: "测试题号", type: 1 },
    ...models.map((model) => ({ field_name: model, type: 2 }))
  ]);

  const detailRows = records.map((item) => ({
    测试题号: item.testQuestionId,
    提问内容: item.promptContent,
    模型版本: item.modelVersion,
    回答内容: item.answerContent,
    问题类型: item.questionType,
    缺陷表现: item.defect,
    评测结果: item.evaluationResult,
    评分: item.score,
    备注: item.notes
  }));

  const trendRows = buildTrendRows(records);

  await batchCreateRecords(accessToken, detailTableId, detailRows);
  await batchCreateRecords(accessToken, trendTableId, trendRows);

  return {
    appToken: config.feishu.bitableAppToken,
    detailTableId,
    trendTableId
  };
}
