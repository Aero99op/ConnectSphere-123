---
name: openrouter_glm
description: Skill to consult GLM-4.5 via OpenRouter for complex reasoning or specific tasks.
---

# OpenRouter GLM-4.5 Skill

This skill allows Antigravity to use OpenRouter's GLM-4.5 model.

## When to use
- Use this when the user explicitly asks to use GLM 4.5 or "openrouter".
- Use this for deep reasoning or tasks where GLM 4.5 excels.

## How to use
Run the following command via `run_command`:
`node .agent/skills/openrouter/scripts/call_glm.js "Your prompt here"`

## Prerequisites
- `OPENROUTER_API_KEY` must be present in the root `.env` file.
- `axios` and `dotenv` must be installed: `npm install axios dotenv`
