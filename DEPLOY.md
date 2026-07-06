# 部署到 Cloudflare Pages —— 早上 10 分钟搞定

> 本文档假设你已经有 Cloudflare 账号。如果还没有，去 https://dash.cloudflare.com/sign-up 注册一个，免费层就够用。

---

## 架构速览

```
浏览器
  │
  ├── 1. 纯函数算 GLIM / NRS2002 / 能量 / 蛋白    ← 免费层，永远在线
  │       (src/composables/useAssessment.js)
  │
  └── 2. 点击「AI 深度解读」→  POST /api/ai-assessment
                                  │
                                  ▼
              Cloudflare Pages Function (functions/api/ai-assessment.js)
                                  │
                                  ├─ 默认走 MiniMax（DEFAULT_PROVIDER）
                                  └─ 管理员可切到 GLM (header: x-admin-token + x-provider)
                                  │
                                  ▼
                       MiniMax 或 GLM API（密钥在 Cloudflare secrets 里，绝不暴露）
                                  │
                                  ▼
              ← 流式或一次性返回临床叙述报告 → 前端 Markdown 渲染
```

---

## 早上执行步骤（按顺序）

### Step 1：装 Wrangler（如未装）

```bash
cd /Users/bricony/Desktop/营养素计算器
npm install -D wrangler
```

### Step 2：登录 Cloudflare（会自动打开浏览器）

```bash
npx wrangler login
```

浏览器跳出来后授权 → 终端会显示 "Successfully logged in"。

### Step 3：创建 Pages 项目（只需第一次）

```bash
npx wrangler pages project create nutri-calc --production-branch main
```

> 如果项目已存在会报 409，可以跳过。

### Step 4：准备 API 密钥

去这两个地方申请密钥（如果还没有）：

| 供应商 | 注册入口 | 控制台获取密钥 |
| --- | --- | --- |
| MiniMax | https://platform.minimaxi.com | 「账号管理」→「接口密钥」 |
| GLM (智谱) | https://open.bigmodel.cn | 「API Keys」 |

### Step 5：把密钥写进 Cloudflare（非常重要！）

```bash
# MiniMax 密钥
npx wrangler pages secret put MINIMAX_API_KEY --project-name nutri-calc
# 粘贴 MiniMax 密钥，回车

# GLM 密钥
npx wrangler pages secret put GLM_API_KEY --project-name nutri-calc
# 粘贴 GLM 密钥，回车

# 管理员令牌（你自己设的，比如 32 位随机串）
npx wrangler pages secret put ADMIN_TOKEN --project-name nutri-calc
# 粘贴你的管理员令牌，回车
```

> 不会有任何回显，输入完粘贴就行。这些密钥**只存在 Cloudflare 服务器上**，前端看不到。

生成管理员令牌的快速方式：
```bash
openssl rand -hex 24
```

### Step 6：构建并部署

```bash
npm run build
npx wrangler pages deploy dist --project-name nutri-calc
```

终端最后一行会显示一个 `https://xxx.pages.dev` 的预览 URL —— **这就是你的线上地址**。

### Step 7：绑定自定义域名（可选）

如果你已经把域名托管到 Cloudflare：
1. Cloudflare Dashboard → Pages → `nutri-calc` → **Custom domains**
2. 添加你的域名，Cloudflare 会自动配 CNAME + SSL
3. 几分钟后生效

---

## 验证清单

部署完成后访问 `https://nutri-calc.pages.dev`（替换成你的实际域名）：

- [ ] 营养计算器、每日需求、FSMP 库、关于页 全部能打开
- [ ] 营养评估页面填表 → 生成报告 → **规则报告**正常显示（这是免费层）
- [ ] 报告底部出现「AI 深度解读」分区 → 点击「生成 AI 深度解读」
- [ ] 等 10–25 秒，AI 报告应该出现，下方有 `Powered by · minimax / MiniMax-Text-01` 字样
- [ ] 访问 `https://你的域名/#admin` → 显示管理员面板（普通访问者看不到）
- [ ] 在管理员面板输入 ADMIN_TOKEN，选「GLM」→ 保存 → 再次生成 AI 报告 → 这次应该显示 `glm` 的水印

---

## 管理员模式说明

- **入口**：URL 加 `#admin`，例如 `https://nutri-calc.pages.dev/#admin`
- **存储**：admin token 存在你浏览器的 localStorage 里，**不会上传到服务器**（仅作为请求 header 发出）
- **校验**：服务器端比对 `x-admin-token` header 与 Cloudflare 中的 `ADMIN_TOKEN` env，匹配才允许 `x-provider` 切换
- **普通用户**：即使他们看到 `#admin` 页面、即使他们填了任意 token，没有正确 ADMIN_TOKEN 就只能走默认 provider

如果想撤销管理员权限：在 Cloudflare 重新生成 ADMIN_TOKEN 即可。

---

## 本地预览功能（含 AI）

`vite dev` 不带 Pages Functions，AI 按钮会报错。要本地测全功能：

```bash
# 1. 准备本地密钥（.dev.vars 文件，已被 .gitignore 忽略）
cat > .dev.vars <<EOF
MINIMAX_API_KEY=你的minimax密钥
GLM_API_KEY=你的glm密钥
ADMIN_TOKEN=你的admin令牌
DEFAULT_PROVIDER=minimax
EOF

# 2. 构建
npm run build

# 3. 跑 wrangler pages dev（同时跑前端 + functions）
npx wrangler pages dev dist --port 8788

# 浏览器打开 http://127.0.0.1:8788
```

---

## 切换模型版本

不想改代码，只改环境变量即可：

```bash
# 比如切到 MiniMax 新版
npx wrangler pages secret put MINIMAX_MODEL --project-name nutri-calc
# 输入新的模型名，如 MiniMax-M1

# 比如切到 GLM 4.6
# 编辑 wrangler.toml 里的 GLM_MODEL 字段，重新部署
```

---

## 费用估算（参考）

| 项 | 单价 | 单次评估估算 |
| --- | --- | --- |
| Cloudflare Pages | 免费（10 万次 Function 调用/天） | 0 元 |
| MiniMax-Text-01 input | ¥1/百万 token | ~3000 token ≈ ¥0.003 |
| MiniMax-Text-01 output | ¥1/百万 token | ~2000 token ≈ ¥0.002 |
| GLM-4.5 | 类似量级 | 类似 |

> **单次 AI 深度解读 ≈ 1 分钱**，远低于 Claude API。

---

## 回滚

```bash
# 列出历史部署
npx wrangler pages deployment list --project-name nutri-calc

# 把某个旧版本设为生产
npx wrangler pages deployment tail --project-name nutri-calc  # 查 ID
# 然后在 Dashboard → Deployments → Rollback
```

---

## 出错排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| AI 按钮转圈后报 "Missing env: MINIMAX_API_KEY" | secret 没设 | 跑 Step 5 |
| AI 按钮报 502 Provider minimax | API 余额不足 / 密钥错 | 去 MiniMax 控制台看 |
| #admin 页面打不开 | router fallback 没配 | 确认 `public/_redirects` 存在 |
| 部署成功但页面 404 | base 路径问题 | 已配 `base: './'`，重新 build |

---

**总结**：早上跑 Step 1–6 大约 10 分钟（最大变数是申请密钥和等审批）。完事后这套架构能稳定服务到你"项目长大需要专门后端"那一天。
