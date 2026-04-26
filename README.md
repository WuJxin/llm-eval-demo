# AI Evaluate for 豆包 / 讯飞星火 / 千问

这个项目会批量调用豆包、讯飞星火、千问三个大模型回答 10 道测试题，再调用一个可配置的评测模型做结构化评测，最后输出到飞书多维表格，并生成折线图。

- 飞书多维表格明细表
- 飞书多维表格折线图数据表
- 统一归档的明细 `output/evaluation-details.json`
- 可统计的表格 `output/evaluation-records.csv`
- 汇总数据 `output/summary.json`
- 折线图页面 `output/chart.html`

## 1. 配置

复制环境变量模板并填写：

```bash
cp .env.example .env
```

至少需要配置：

- `DOUBAO_API_KEY`
- `SPARK_API_KEY`
- `QWEN_API_KEY`
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_BITABLE_APP_TOKEN`

可选配置：

- `EVAL_PROVIDERS`
  默认是 `doubao,spark,qwen`
- `JUDGE_PROVIDER`
  默认优先用 `qwen`
- `JUDGE_MODEL`
  默认使用对应评测供应商自己的模型名

## 2. 运行

```bash
npm run run
```

## 3. 输出字段

飞书明细表包含这些字段：

- 测试题号
- 提问内容
- 模型版本
- 回答内容
- 问题类型
- 缺陷表现
- 评测结果
- 评分及备注

飞书折线图数据表包含：

- `测试题号`
- 每个模型一列分数

这样可以直接在飞书多维表格里基于这张表做折线图。

## 4. 默认接口

- 豆包默认使用火山引擎 Ark：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- 讯飞星火默认使用：`https://maas-api.cn-huabei-1.xf-yun.com/v2/chat/completions`
- 千问默认使用阿里云百炼兼容模式：`https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`

注意：
- 豆包的 `DOUBAO_MODEL` 通常需要填写你在火山方舟里创建的推理接入点 ID，例如 `ep-xxxxxx`。
- 讯飞星火和千问需要填写可用模型名，例如你自己在控制台可调用的星火模型标识、`qwen-plus`。

如果你使用别的地域或模型版本，直接修改 `.env` 中的 `*_BASE_URL` 和 `*_MODEL` 即可。
