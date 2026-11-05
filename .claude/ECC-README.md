# ECC (Everything Claude Code)

Источник: https://github.com/affaan-m/ecc — v2.2.3, commit b38be6a7f6350964d59328b52f0624e1d1d552d1 (MIT, см. ECC-LICENSE).

Установлено вручную (копированием файлов), без хуков и MCP-конфигов:
- `skills/` — все скиллы ECC
- `agents/` — субагенты
- `commands/` — slash-команды
- `rules/` — общие правила (rules/common)

Обновление: заново скопировать эти папки из новой версии репозитория ECC.

## Дополнительные скиллы (не ECC)

| Скилл | Источник |
|---|---|
| find-skills | vercel-labs/skills@cabe072 (MIT) |
| tdd, diagnosing-bugs, improve-codebase-architecture, grill-me | mattpocock/skills@4ae2317 (MIT) |
| systematic-debugging | obra/superpowers@22f0b46 (MIT) |
| frontend-design | anthropics/skills@ca45fc4 (см. LICENSE.txt в папке скилла) |
| web-design-guidelines | vercel-labs/agent-skills@1a2c79d |
| supabase, supabase-postgres-best-practices | supabase/agent-skills@c9be0e9 (MIT) |
| context7-mcp + `.mcp.json` (MCP-сервер context7) | upstash/context7@76d68b5 (MIT) |
| graphify (+ references/) | Graphify-Labs/graphify v0.9.103 @16218bf (Apache-2.0); CLI `graphifyy` скилл ставит сам при первом запуске |
| roblox-* (29 скиллов) | TabooHarmony/roblox-brain @ceee4aa (MIT, см. ROBLOX-BRAIN-LICENSE) |
