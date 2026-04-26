import { config, hasFeishuConfig } from "./config.js";
import { questions } from "./questions.js";
import { callChatModel } from "./modelClient.js";
import { evaluateAnswer } from "./evaluator.js";
import { writeEvaluationArtifacts } from "./archive.js";
import { writeChart } from "./chart.js";
import { syncToFeishuBitable } from "./feishu.js";

async function askQuestion(target, question) {
  let lastError;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await callChatModel({
        target,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: "你是一个认真、清晰、尽量准确的AI助手。请直接给出答案，不要输出思维链标签或额外控制标记。"
          },
          {
            role: "user",
            content: question.prompt
          }
        ]
      });

      return response.content;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function run() {
  const allRecords = [];

  console.log(`Starting evaluation for ${config.targets.length} models and ${questions.length} questions...`);

  for (const target of config.targets) {
    console.log(`\nModel: ${target.displayName}`);

    for (const question of questions) {
      console.log(`  Asking ${question.id}...`);

      try {
        const answer = await askQuestion(target, question);
        const evaluation = await evaluateAnswer({ question, model: target.displayName, answer });

        allRecords.push({
          testQuestionId: question.id,
          promptContent: question.prompt,
          modelVersion: target.displayName,
          answerContent: answer,
          questionType: evaluation.questionType || question.type,
          defect: evaluation.defect,
          evaluationResult: evaluation.result,
          score: Number(Number(evaluation.score).toFixed(2)),
          notes: evaluation.notes
        });

        console.log(
          `    Score: ${Number(Number(evaluation.score).toFixed(2))} | Result: ${evaluation.result} | Defect: ${evaluation.defect}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        allRecords.push({
          testQuestionId: question.id,
          promptContent: question.prompt,
          modelVersion: target.displayName,
          answerContent: "",
          questionType: question.type,
          defect: "接口调用失败或解析失败",
          evaluationResult: "未通过",
          score: 0,
          notes: message
        });
        console.error(`    Failed: ${message}`);
      }
    }
  }

  const { outputDir, summaryByModel } = writeEvaluationArtifacts(allRecords);
  writeChart(allRecords, outputDir);

  if (hasFeishuConfig()) {
    console.log("\nSyncing results to Feishu Bitable...");
    try {
      const feishuInfo = await syncToFeishuBitable(
        allRecords,
        config.targets.map((target) => target.displayName)
      );
      console.log(
        `Feishu synced: app=${feishuInfo.appToken}, detailTable=${feishuInfo.detailTableId}, trendTable=${feishuInfo.trendTableId}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Feishu sync failed: ${message}`);
    }
  } else {
    console.log(
      "\nSkipping Feishu sync because FEISHU_APP_ID / FEISHU_APP_SECRET / FEISHU_BITABLE_APP_TOKEN are not fully configured."
    );
  }

  console.log("\nSummary:");
  for (const item of summaryByModel) {
    console.log(
      `  ${item.modelVersion} | avg=${item.averageScore} | pass=${item.passCount} | partial=${item.partialPassCount} | fail=${item.failCount}`
    );
  }

  console.log(`\nArtifacts written to: ${outputDir}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
