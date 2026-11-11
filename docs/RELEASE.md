# Hướng dẫn Release

| Thư mục               | Tên npm                   | Tag                     | Mirror                    |
| --------------------- | ------------------------- | ----------------------- | ------------------------- |
| `packages/jira`       | `g-jira-mcp`              | `jira-v${version}`      | `ameforge/jira-mcp`       |
| `packages/confluence` | `conf-mcp`                | `conf-v${version}`      | `ameforge/confluence-mcp` |
| `packages/bitbucket`  | `@ameforge/bitbucket-mcp` | `bitbucket-v${version}` | `ameforge/bitbucket-mcp`  |
| `packages/atlassian`  | `@ameforge/atlassian-mcp` | `atlassian-v${version}` | không có                  |

Yêu cầu: `pnpm install` ở thư mục gốc (cũng bật hook pre-push), quyền push SSH (`git@github.com`) lên `ameforge/atlassian-mcp` và ba repo mirror.

## Release

Commit hết thay đổi, rồi chạy ở thư mục gốc:

```bash
pnpm release:jira    # hoặc release:conf, release:bitbucket, release:atlassian, release:all
```

Lệnh không hỏi gì. Với mỗi package, release-it:

1. Chạy `pnpm -w run check`, `pnpm test`, `pnpm build`. Lỗi format thì chạy `pnpm lint`, commit, chạy lại.
2. Chọn version từ commit chạm vào thư mục package kể từ tag trước của nó: breaking change là major, `feat` là minor, `fix`/`perf`/`revert` là patch. Chỉ có `chore`, `ci`, `refactor`, `docs`, `test` thì không release ("No new version to release").
3. Commit `chore(<package>): release v${version}`, tạo tag, push. Với jira, confluence và bitbucket, `scripts/mirror.js` đẩy code sang repo mirror kèm tag `v${version}`.

`release:jira`, `release:conf` và `release:bitbucket` chạy tiếp `release:atlassian`, vì `@ameforge/atlassian-mcp` đóng gói sẵn ba package kia; version của nó tính cả commit trong `packages/jira`, `packages/confluence` và `packages/bitbucket`.

Xem trước version: `pnpm -C packages/jira exec release-it --release-version`.

Ép một mức: `pnpm -C packages/jira release minor`, rồi `pnpm release:atlassian patch`. Không dùng `pnpm release:jira minor`, vì `minor` được chuyển cho bước atlassian.

Không sửa code trong repo mirror: lần release sau ghi đè.

## Publish

Tag `atlassian-v*` kích hoạt `.github/workflows/publish.yml`, một lần cho mỗi lệnh release. Workflow publish mọi package có version chưa có trên npm (qua `pnpm pack` và npm trusted publishing, không cần token) và tạo GitHub release với danh sách commit của package. Package đã release mà chưa publish sẽ được publish ở lần release atlassian tiếp theo.

Workflow lỗi thì publish tay: `pnpm publish:<jira|conf|bitbucket|atlassian>`, xác thực như mục Publish tay bên dưới. Không chạy lệnh này sau một release thành công.

Không có workflow CI: hook `.githooks/pre-push` chạy check và test trước khi push lên `origin` (bỏ qua bằng `git push --no-verify`).

## Cấu hình trusted publishing (một lần cho mỗi package)

Trên npmjs.com, Settings, Trusted Publisher, GitHub Actions:

- Organization or user: `ameforge`
- Repository: `atlassian-mcp`
- Workflow filename: `publish.yml`
- Environment name: để trống
- Tích `Allow npm publish`

Không sửa được sau khi tạo; muốn đổi thì xóa và tạo lại.

Mục Trusted Publisher nằm trong trang settings của một package đã có trên npm, nên package mới (ví dụ `@ameforge/bitbucket-mcp`) cần publish tay lần đầu như mục dưới, rồi mới cấu hình như trên. Nếu chưa làm bước này, workflow sẽ dừng ở package đó và các package sau nó trong vòng lặp cũng không được publish.

## Publish tay

Dùng cho lần publish đầu của một package mới, hoặc khi workflow lỗi.

1. Kiểm tra tài khoản và scope:

   ```bash
   npm whoami              # tài khoản npm đang đăng nhập
   npm org ls ameforge     # phải có tài khoản đó với quyền owner hoặc admin
   ```

   `Scope not found` nghĩa là organization chưa có: tạo ở <https://www.npmjs.com/org/create> (gói free cho package public).

2. Publish theo thứ tự bitbucket trước, atlassian sau, vì `@ameforge/atlassian-mcp` phụ thuộc `@ameforge/bitbucket-mcp`:

   ```bash
   pnpm publish:bitbucket
   pnpm publish:atlassian
   ```

   Luôn dùng `pnpm publish:<package>`, không dùng `npm publish` trong thư mục package: chỉ pnpm thay `workspace:*` bằng version thật.

3. Xác thực 2FA:
   - Mã 6 số từ app authenticator: thêm `--otp=<mã>` vào lệnh.
   - Passkey: không có mã để nhập, nên chạy lệnh trong một terminal tương tác (PowerShell, Windows Terminal) và làm theo hướng dẫn xác thực của pnpm. Chạy từ nơi không có terminal tương tác (ví dụ lệnh `!` trong Claude Code) sẽ dừng với lỗi `ERR_PNPM_OTP_NON_INTERACTIVE` và không publish gì.

4. Kiểm tra:

   ```bash
   npm view @ameforge/bitbucket-mcp versions
   ```

   Danh sách phải có version trong `package.json`. Nếu chỉ thấy `0.0.0-stage` (mô tả "Temporary package placeholder for staged publishing") thì version thật chưa được publish: chạy lại bước 2 và 3.

5. Cấu hình trusted publishing cho package như mục trên, để các lần sau workflow tự publish.
