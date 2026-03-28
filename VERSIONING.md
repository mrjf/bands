# Bands Versioning: The Lobster Scale

Bands follows the **Lobster Scale** -- a versioning system modeled on the life
cycle of *Homarus americanus* (the American lobster), from fertilized egg to
lobster roll.

## The Stages

Each stage is a **major version**. Minor and patch versions work normally
within each stage. When the project is ready to molt into the next stage,
the major version increments.

| Stage | Version | Meaning |
|-------|---------|---------|
| Egg | `0.x.y` | Attached to the mother. Nothing swims on its own yet. APIs will break. Everything is yolk. |
| Stage I | `1.x.y` | First larval stage. Planktonic -- drifting, translucent, barely visible. Core runtime works but the shape keeps changing. |
| Stage II | `2.x.y` | Second larval stage. Still floating, but developing distinct features. Schemas, permissions, and execution targets are stabilizing. |
| Stage III | `3.x.y` | Third larval stage. Eyes work. Can sense direction. The skill contract is locked. Breaking changes require a molt. |
| Postlarva | `4.x.y` | Settles to the ocean floor. First time touching bottom. Production-grade execution with real isolation (lima, cloudflare). No more floating. |
| Juvenile | `5.x.y` | Hides in burrows, molts frequently. Rapid feature growth but stays close to home. Public API is stable but the internals churn. |
| Adolescent | `6.x.y` | Ventures out. Multi-skill composition, band inheritance, and the editor are battle-tested. Molts slow down. |
| Adult | `7.x.y` | Full size, hard shell. Reproductive -- other projects can safely depend on bands. Breaking changes are rare and loudly announced. |
| Trapped | `8.x.y` | Walked into the trap voluntarily. Enterprise features, compliance, audit logging. Can't easily walk back out. |
| Caught | `9.x.y` | Pulled from the ocean. Fully extracted from the development cycle. Maintenance-only. |
| Boiled | `10.x.y` | Cooked. Feature-frozen. Only security patches. The shell has turned red. |
| Lobster Roll | `11.x.y` | Served. Consumed by the masses. Bands is a commodity. Time to start a new crustacean. |

## Current Stage

**Egg** (`0.x.y`)

Everything is yolk. APIs will break between any two releases. There is no
shell yet -- just potential.

## Rules

1. **Stage transitions are one-way.** You cannot un-boil a lobster.
2. **Minor versions** (`0.x`) mark feature additions within a stage.
3. **Patch versions** (`0.0.y`) mark bug fixes and docs.
4. **Molts** (minor bumps) can include breaking changes through Stage III.
   After Postlarva, breaking changes require a new major version (next stage).
5. **The lobster tag** is appended to git tags: `v0.3.1-egg`, `v4.0.0-postlarva`, `v10.1.2-boiled`.

## Git Tags

```
v0.1.0-egg
v1.0.0-stage-i
v4.0.0-postlarva
v7.0.0-adult
v10.0.0-boiled
v11.0.0-lobster-roll
```

## FAQ

**Q: What if we need to go past lobster roll?**
A: Start over as a new egg. Lobsters are biologically immortal -- they never
stop growing. Neither do we.

**Q: What about the butter?**
A: Butter is a plugin.
