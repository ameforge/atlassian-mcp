# Hướng dẫn Release

| Thư mục               | Tên npm                 | Tag                     | Mirror                  |
| --------------------- | ----------------------- | ----------------------- | ----------------------- |
| `packages/jira`       | `g-jira-mcp`            | `jira-v${version}`      | `pnam16/jira-mcp`       |
| `packages/confluence` | `conf-mcp`              | `conf-v${version}`      | `pnam16/confluence-mcp` |
| `packages/bitbucket`  | `@pnam16/bitbucket-mcp` | `bitbucket-v${version}` | `pnam16/bitbucket-mcp`  |
| `packages/atlassian`  | `@pnam16/atlassian-mcp` | `atlassian-v${version}` | không có                |

Yêu cầu: `pnpm install` ở thư mục gốc (cũng bật hook pre-push), quyền push SSH (`git@github.com`) lên `pnam16/atlassian-mcp` và ba repo mirror.

## Release

Commit hết thay đổi, rồi chạy ở thư mục gốc:

```bash
pnpm release:jira    # hoặc release:conf, release:bitbucket, release:atlassian, release:all
```

Lệnh không hỏi gì. Với mỗi package, release-it:

1. Chạy `pnpm -w run check`, `pnpm test`, `pnpm build`. Lỗi format thì chạy `pnpm lint`, commit, chạy lại.
2. Chọn version từ commit chạm vào thư mục package kể từ tag trước của nó: breaking change là major, `feat` là minor, `fix`/`perf`/`revert` là patch. Chỉ có `chore`, `ci`, `refactor`, `docs`, `test` thì không release ("No new version to release").
3. Commit `chore(<package>): release v${version}`, tạo tag, push. Với jira, confluence và bitbucket, `scripts/mirror.js` đẩy code sang repo mirror kèm tag `v${version}`.

`release:jira`, `release:conf` và `release:bitbucket` chạy tiếp `release:atlassian`, vì `@pnam16/atlassian-mcp` đóng gói sẵn ba package kia; version của nó tính cả commit trong `packages/jira`, `packages/confluence` và `packages/bitbucket`.

Xem trước version: `pnpm -C packages/jira exec release-it --release-version`.

Ép một mức: `pnpm -C packages/jira release minor`, rồi `pnpm release:atlassian patch`. Không dùng `pnpm release:jira minor`, vì `minor` được chuyển cho bước atlassian.

Không sửa code trong repo mirror: lần release sau ghi đè.

## Publish

Tag `atlassian-v*` kích hoạt `.github/workflows/publish.yml`, một lần cho mỗi lệnh release. Workflow publish mọi package có version chưa có trên npm (qua `pnpm pack` và npm trusted publishing, không cần token) và tạo GitHub release với danh sách commit của package. Package đã release mà chưa publish sẽ được publish ở lần release atlassian tiếp theo.

Workflow lỗi thì publish tay: `pnpm publish:<jira|conf|bitbucket|atlassian> --otp=<mã>`. Không chạy lệnh này sau một release thành công.

Không có workflow CI: hook `.githooks/pre-push` chạy check và test trước khi push lên `origin` (bỏ qua bằng `git push --no-verify`).

## Cấu hình trusted publishing (một lần cho mỗi package)

Trên npmjs.com, Settings, Trusted Publisher, GitHub Actions:

- Organization or user: `pnam16`
- Repository: `atlassian-mcp`
- Workflow filename: `publish.yml`
- Environment name: để trống
- Tích `Allow npm publish`

Không sửa được sau khi tạo; muốn đổi thì xóa và tạo lại.

Mục Trusted Publisher nằm trong trang settings của một package đã có trên npm, nên package mới (ví dụ `@pnam16/bitbucket-mcp`) cần publish tay lần đầu bằng `pnpm publish:bitbucket --otp=<mã>`, rồi mới cấu hình như trên. Nếu chưa làm bước này, workflow sẽ dừng ở package đó và các package sau nó trong vòng lặp cũng không được publish.
