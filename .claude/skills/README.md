# Skills

Doctrine an agent reads before editing code. One directory per skill:

```
.claude/skills/<tier>-<topic>/SKILL.md
```

**Tiers, by what outlives what:** `core-*` portable · `platform-*` target-runtime · `stack-*` this repo's wiring.

**The authoring rules live in a skill, not here** — read
[`core-skill-authoring`](core-skill-authoring/SKILL.md) before adding or
editing one. It is auto-loadable, so an agent gets it without being told;
duplicating it here would just create a second copy to drift.

Validate any change:

```bash
python3 .claude/scripts/check-skills.py && python3 .claude/scripts/test-hooks.py
```

Both run in CI (`ci.yml` → `skills-guard`).
