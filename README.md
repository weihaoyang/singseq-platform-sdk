# @singseq/platform-sdk

唯一的新平台 TypeScript 客户端。HTTP 请求、空响应和序列化使用 MIT 开源的 `openapi-fetch`；请求及核心响应类型由 `openapi-typescript` 从后端 OpenAPI 生成。没有单例、自动跳转、自动重试付款或独立商务状态机。

```ts
import { createPlatformClient } from '@singseq/platform-sdk';

const api = createPlatformClient({
  baseUrl: 'https://platform.example.com',
  auth: { type: 'bearer', token: () => accessToken },
});
const result = await api.POST('/api/v1/usage/reservations', {
  body: { product_code: 'analysis', metric: 'runs', quantity: 1, idempotency_key: crypto.randomUUID() },
});
```

产品使用平台 OAuth 签发的 Bearer 凭据，范围受主体、产品和 scope 限制；产品后端服务凭据也使用同一个客户端工厂。所有请求沿用后端合同，不包含 `auth/me`、旧 checkout、旧支付回跳等接口。

平台自身的同源前端使用 `auth: { type: 'session', csrf: () => csrfToken }`。先调用 `/api/v1/auth/session` 取得 CSRF token；刷新会话后重新读取该值。Cookie 写操作由 SDK 填入 `X-CSRF-Token`，Bearer 客户端使用 `credentials: omit`。SDK 不在 localStorage 存储令牌。

`openapi.json` 是后端合同的发布快照，`src/schema.d.ts` 是生成文件。更新流程：

```powershell
# 在平台 API 仓导出，无需连接数据库或提供生产凭据
apps/platform-api/.venv/Scripts/python.exe -m singseq.cli export-openapi --output D:/singseq-sdk/packages/platform-sdk/openapi.json
# 在 SDK 仓
npx --yes pnpm@9.12.0 --filter @singseq/platform-sdk generate
npx --yes pnpm@9.12.0 --filter @singseq/platform-sdk build
npx --yes pnpm@9.12.0 --filter @singseq/platform-sdk test
```

`dist/index.js` / `index.cjs` 和声明文件由 tsup 构建。旧 `SingSeq.init()` / 手写 Auth、Commerce、HttpClient 已删除，不提供并行兼容实现。产品 OAuth 流程辅助、授权确认页及所有业务域的客户端验收仍待完成。
