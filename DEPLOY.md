# CAD FAI 报告生成器 - 部署与开发指南

## 项目概述
将 CAD 标注文本自动转换为 FAI（First Article Inspection）报告，支持：
- 线性尺寸、直径、半径自动识别
- 公差解析：对称（±）、非对称（+x/-y）
- 无公差按 ISO 2768-m 自动填充
- 随机生成"合格真实"的实测值并判定 OK/NG
- 导出中文表头的 CSV/Excel 兼容文件
- 支持 Cloudflare Workers 部署（完全无服务器）

## 快速开始（本地开发）

### 前置要求
- Node.js 16+（推荐 LTS）
- npm 或 yarn
- Wrangler CLI（用于 Cloudflare Workers）：`npm install -g wrangler`

### 本地运行

```powershell
# 1. 进入项目目录（如果还未进入）
cd "C:\Users\Administrator\Desktop\编程文件\CAD-FAI"

# 2. 安装依赖
npm install

# 3. 启动本地开发服务器（默认 http://localhost:8787）
npm run start
```

然后在浏览器打开 `http://localhost:8787`，粘贴标注文本（见下方示例），点击"生成 CSV 报告"即可下载。

### 部署到 Cloudflare Workers

```powershell
# 1. 登录 Cloudflare（首次需要）
wrangler login

# 2. 部署项目
npm run deploy
```

部署完成后，你会获得一个公网 URL（如 `https://your-worker.your-subdomain.workers.dev`）。

## 使用示例

### 输入格式
在文本框中粘贴如下格式的 CAD 标注（每行一条）：

```
Ø20 ±0.02
R5
10 +0.02/-0.01
50
```

### 输出格式
生成的 CSV 报告示例（中文表头）：

```csv
"序号","标注类型","标称尺寸","公差(+/-)","实测值","判定"
"1","直径","20","+0.0200/-0.0200","20.0095","OK"
"2","半径","5","+0.1000/-0.1000","4.9876","OK"
"3","线性","10","+0.0200/-0.0100","10.0005","OK"
"4","线性","50","+0.3000/-0.3000","49.8723","OK"
```

## 文件结构

```
CAD-FAI/
├── src/
│   ├── index.ts       # Cloudflare Worker 主入口（HTTP 处理）
│   └── parse.ts       # 标注解析与 CSV 生成核心逻辑
├── public/
│   └── index.html     # 前端 UI（备用）
├── package.json       # Node.js 项目配置
├── wrangler.toml      # Cloudflare Workers 配置
├── tsconfig.json      # TypeScript 编译配置
├── EXAMPLE_INPUT.txt  # 使用示例输入
├── (测试脚本已移除，仓库中不包含 test_run.ps1)
└── README.md          # 本文件
```

## 核心功能说明

### 1. 标注解析（`src/parse.ts`）
- **直径识别**：Ø 或 φ 符号（如 `Ø20 ±0.02`）
- **半径识别**：R 前缀（如 `R5`）
- **线性尺寸**：纯数字（如 `50`）
- **公差识别**：
  - 对称：`±0.02` 或 `± 0.02`
  - 非对称：`+0.02/-0.01` 或 `+0.02/-0.01`
  - 无公差：自动按 ISO 2768-m 填充近似值

### 2. ISO 2768-m 近似表
当标注无显式公差时，自动应用：

| 标称尺寸范围 | 公差（对称） |
|-------------|-----------|
| ≤ 6         | ±0.1      |
| 6 < ≤ 30    | ±0.2      |
| 30 < ≤ 120  | ±0.3      |
| > 120       | ±0.5      |

### 3. 随机实测值生成
- **合格概率**：90% 在公差带内（均匀分布）
- **超差概率**：10% 超出公差带 0~200%（模拟真实检验结果）

## 开发与测试

### 离线测试（PowerShell）
如果不想启动 Cloudflare Worker，可用 PowerShell 脚本快速验证：

测试脚本已从仓库中移除。如需验证，请使用 `npm run build` 或部署到 Cloudflare Workers 后检查工作流中的构建步骤。

会生成 `report.csv` 文件。

### 修改解析规则
编辑 `src/parse.ts` 中的正则表达式。例如，要支持更多公差格式：

```typescript
// 在 parseText 函数中添加新的正则模式
const customPattern = /自定义正则/g;
```

## 常见问题

### Q: CSV 打开时乱码
**A**: 本项目已包含 UTF8 BOM，Excel 应能自动识别。如仍有问题：
- 在 Excel 中用"数据" → "文本转换"手动选择 UTF-8 编码
- 或改用 Google Sheets（支持更好的 UTF-8）

### Q: 公差为什么总是对称的？
**A**: 如果你输入的是单个公差值（如 `10 ±0.02`），系统会同时应用 +0.02 和 -0.02。这符合大多数 CAD 标准。

### Q: 支持 DWG/DXF 文件上传吗？
**A**: 目前不支持。需要先将 CAD 文件导出为文本（例如从 AutoCAD 复制标注信息）。将来可接入三方 DXF 库。

### Q: 支持输出真正的 .xlsx 文件吗？
**A**: CSV 在 Excel 中可直接打开且兼容性最好。真正的 .xlsx 需要额外库（如 `exceljs`），会增加 Worker 体积和运行时间。如需要，可在服务器端（而非 Edge）实现。

## 进阶部署

### 自定义域名
在 `wrangler.toml` 中添加：

```toml
routes = [
  { pattern = "example.com/*", zone_name = "example.com" }
]
```

然后重新部署。

### 环境变量
在 `wrangler.toml` 中添加：

```toml
[env.production]
vars = { ENV = "production" }
```

在代码中访问：`env.ENV`

## 许可证
MIT

## 反馈与贡献
欢迎提出 Issue 和 Pull Request 以改进解析规则或添加新功能。
