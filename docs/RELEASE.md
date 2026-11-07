# Hướng dẫn Release

Monorepo có 3 package, mỗi package release riêng. Mọi lệnh dưới đây chạy ở thư mục gốc; script ở `package.json` gốc tự chạy trong thư mục package (`pnpm -C packages/<dir>`):

| Thư mục               | Tên npm                 | Tag                     | Mirror                  | Release                  | Publish                  |
| --------------------- | ----------------------- | ----------------------- | ----------------------- | ------------------------ | ------------------------ |
| `packages/jira`       | `g-jira-mcp`            | `jira-v${version}`      | `pnam16/jira-mcp`       | `pnpm release:jira`      | `pnpm publish:jira`      |
| `packages/confluence` | `conf-mcp`              | `conf-v${version}`      | `pnam16/confluence-mcp` | `pnpm release:conf`      | `pnpm publish:conf`      |
| `packages/atlassian`  | `@pnam16/atlassian-mcp` | `atlassian-v${version}` | không có                | `pnpm release:atlassian` | `pnpm publish:atlassian` |

Tên `jira-mcp` trên npm đã bị tài khoản khác chiếm, nên package Jira publish với tên `g-jira-mcp`.

## Yêu cầu

- Node.js 18+
- pnpm
- Đã cài dependencies: `pnpm install` ở thư mục gốc
- Quyền push lên `pnam16/atlassian-mcp` và hai repo mirror qua SSH alias `github-pnam16` (xem `scripts/mirror.js`)

## Quy trình release

1. Commit mọi thay đổi trước: `.release-it.json` đặt `requireCleanWorkingDir: true`, nên release-it dừng lại nếu working tree chưa sạch.

2. Chạy release ở thư mục gốc, ví dụ với Jira:

   ```bash
   pnpm release:jira
   ```

   release-it sẽ:
   - Chạy `pnpm -w run check` (biome check và tsc, chỉ kiểm tra, không sửa file), `pnpm test` và `pnpm build`
   - Hỏi phiên bản mới (patch/minor/major) và bump version trong `package.json`
   - Commit với message `chore(<package>): release v${version}`, tạo tag theo bảng trên, push commit và tag lên `pnam16/atlassian-mcp`
   - Không tạo GitHub release (`github.release: false`): workflow `publish.yml` tạo release khi nhận tag

   Nếu bước check báo lỗi format, chạy `pnpm lint` ở thư mục gốc để sửa, commit, rồi chạy lại `pnpm release:jira`.

3. Với `jira-mcp` và `confluence-mcp`, release-it chạy tiếp `scripts/mirror.js` (hook `after:release`):
   - Lấy nội dung `packages/<pkg>` tại HEAD, tạo một commit nối lên `main` của repo mirror
   - Push commit đó lên `main` và tag `v${version}` của mirror, cả hai cùng lúc (`--atomic`): nếu một bên bị từ chối thì không bên nào thay đổi

   Không sửa code trực tiếp trong repo mirror: lần release sau sẽ ghi đè nội dung đó.

4. Publish lên npm do GitHub Actions làm. Tag vừa push kích hoạt `.github/workflows/publish.yml`, workflow này:
   - Kiểm tra version trong tag khớp với `package.json` của package
   - Chạy `pnpm -w run check`, `pnpm test` và `pnpm build`
   - Đóng gói bằng `pnpm pack` (đổi `workspace:*` thành số version) rồi `npm publish` file tarball qua npm trusted publishing (OIDC), không cần token hay OTP
   - Tạo GitHub release cho tag, kèm release notes tính từ tag trước đó của cùng package

   Xem kết quả ở tab Actions của `pnam16/atlassian-mcp`. Field `files` trong `package.json` chỉ đóng gói `dist/`: `index.js`, `LICENSE` (build chép từ `LICENSE` ở thư mục gốc) và `THIRD_PARTY_LICENSES.txt`.

   Nếu workflow lỗi, có thể publish thủ công ở thư mục gốc, thêm mã OTP nếu tài khoản npm bật 2FA: `pnpm publish:jira --otp=<mã>`. Tham số phía sau được chuyển nguyên cho `pnpm publish` của package, ví dụ `--dry-run` để xem trước. Phải dùng `pnpm publish` chứ không dùng `npm publish` trong thư mục package: `@pnam16/atlassian-mcp` khai báo `workspace:*`, pnpm đổi thành số version khi publish, còn `npm publish` thì giữ nguyên.

5. Release lại `@pnam16/atlassian-mcp` bằng `pnpm release:atlassian`; workflow sẽ publish nó như bước 4. Package này đóng gói sẵn code của `jira-mcp` và `confluence-mcp` vào `dist/index.js`, nên bản mới của hai package kia chỉ đến tay người dùng `@pnam16/atlassian-mcp` sau khi nó được release và publish lại.

## Cấu hình một lần cho trusted publishing

Trên npmjs.com, với từng package `g-jira-mcp`, `conf-mcp` và `@pnam16/atlassian-mcp`, vào Settings, mục Trusted Publisher, chọn GitHub Actions và điền:

- Organization or user: `pnam16`
- Repository: `atlassian-mcp`
- Workflow filename: `publish.yml`
- Environment name: để trống (workflow không dùng GitHub environment)
- Allowed actions: tích `Allow npm publish`, vì workflow chạy `npm publish` trực tiếp; không tích thì chỉ được `npm stage publish`. Để trống `Allow npm dist-tag`

Các field này không sửa được sau khi tạo; muốn đổi thì xóa connection và tạo lại. Thiếu bước này thì bước `npm publish` trong workflow bị từ chối.

## Kiểm tra nhanh sau build

```bash
node packages/jira/dist/index.js
```

Server phải khởi động và log ra stderr (stdout chỉ dành cho giao thức MCP), không có lỗi.

## Checklist trước khi release

- [ ] `.env` không bị commit (đã có trong `.gitignore`)
- [ ] README/docs của package phản ánh đúng tools và params hiện tại
- [ ] Local branch đã cập nhật, mọi thay đổi đã commit
