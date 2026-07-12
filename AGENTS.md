<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes: APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Repo Notes

- Keep public documentation in `README.md` and `README.zh-TW.md`.
- Use direct binaries for local verification when `pnpm` is blocked by ignored build scripts:
  - `node_modules\.bin\tsc.cmd --noEmit`
  - `node_modules\.bin\vitest.cmd run`
  - `node_modules\.bin\eslint.cmd .`
- For packaged Electron behavior, verify the packaged app surface rather than only the dev server.
