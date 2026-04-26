import fs from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function escapeCsv(value) {
  const stringValue = String(value ?? "");
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

export function writeEvaluationArtifacts(records) {
  ensureOutputDir();

  const timestamp = new Date().toISOString();

  const details = {
    generatedAt: timestamp,
    totalRecords: records.length,
    records
  };

  const summaryByModel = Object.values(
    records.reduce((accumulator, item) => {
      if (!accumulator[item.modelVersion]) {
        accumulator[item.modelVersion] = {
          modelVersion: item.modelVersion,
          questionCount: 0,
          totalScore: 0,
          passCount: 0,
          partialPassCount: 0,
          failCount: 0
        };
      }

      const current = accumulator[item.modelVersion];
      current.questionCount += 1;
      current.totalScore += item.score;

      if (item.evaluationResult === "通过") {
        current.passCount += 1;
      } else if (item.evaluationResult === "部分通过") {
        current.partialPassCount += 1;
      } else {
        current.failCount += 1;
      }

      return accumulator;
    }, {})
  ).map((item) => ({
    ...item,
    averageScore: Number((item.totalScore / item.questionCount).toFixed(2))
  }));

  const csvHeader = [
    "测试题号",
    "提问内容",
    "模型版本",
    "回答内容",
    "问题类型",
    "缺陷表现",
    "评测结果",
    "评分",
    "备注"
  ];

  const csvLines = [
    csvHeader.join(","),
    ...records.map((item) =>
      [
        item.testQuestionId,
        item.promptContent,
        item.modelVersion,
        item.answerContent,
        item.questionType,
        item.defect,
        item.evaluationResult,
        item.score,
        item.notes
      ]
        .map(escapeCsv)
        .join(",")
    )
  ];

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "evaluation-details.json"),
    `${JSON.stringify(details, null, 2)}\n`,
    "utf8"
  );

  fs.writeFileSync(path.join(OUTPUT_DIR, "evaluation-records.csv"), `${csvLines.join("\n")}\n`, "utf8");

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "summary.json"),
    `${JSON.stringify({ generatedAt: timestamp, summaryByModel }, null, 2)}\n`,
    "utf8"
  );

  return {
    outputDir: OUTPUT_DIR,
    summaryByModel
  };
}
