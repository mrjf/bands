# Bands Versioning: The Lobster Scale

Bands follows the **Lobster Scale** -- a versioning system modeled on the
life cycle of *Homarus americanus* (the American lobster), from fertilized
egg to lobster roll.

Based on the actual developmental biology described by Factor & Clemetson
(Sea Grant / SUNY, 2003).

## The Stages

Each stage is a **major version**. Minor and patch versions work normally
within each stage. When the project is ready to molt into the next stage,
the major version increments.

### Embryonic

| Stage | Version | Meaning |
|-------|---------|---------|
| **Egg** | `0.x.y` | Fertilized and attached to the mother's swimmerets. Carried for 9-10 months. Nothing swims on its own yet. APIs will break. Everything is yolk. |

### Larval (planktonic -- drifting at the surface)

Larvae are planktonic and free-swimming, heading up to the surface. They
feed on microscopic organisms, are translucent, and suffer heavy predation.
For every thousand larvae released, about one survives. Breaking changes
happen constantly -- you are food.

| Stage | Version | Meaning |
|-------|---------|---------|
| **Prezoea** | `1.x.y` | Newly hatched. Brief transitional form -- not yet a real larva, not still an egg. First proof of life. The runtime boots but barely holds together. |
| **Stage I** | `2.x.y` | First true larva. Planktonic, drifting, translucent. Core runtime works but the shape keeps changing with every molt. |
| **Stage II** | `3.x.y` | Developing distinct features. Claws are forming. Schemas, permissions, and execution targets are stabilizing. |
| **Stage III** | `4.x.y` | Final larval stage. Eyes work, can sense direction, about 1/2 inch long. The skill contract is locked. One more metamorphosis to go. |

### Settlement (benthic -- reaching the bottom)

After metamorphosis, the lobster sinks to the ocean floor for the first
time. No more drifting. This is where real life begins.

| Stage | Version | Meaning |
|-------|---------|---------|
| **Postlarva (Stage IV)** | `5.x.y` | Metamorphosis complete. Settles to the bottom, searches for suitable habitat. First time touching ground. Production-grade execution with real isolation (lima, cloudflare). |
| **Shelter-phase Juvenile** | `6.x.y` | Digs burrows in mud, hides under rocks. Molts frequently. Rarely ventures out. Rapid feature growth but stays close to home. Public API is stable but internals churn. |

### Growth (emerging -- building the shell)

The lobster ventures out of its shelter, grows through repeated molts,
and develops its characteristic hard shell and heavy claws.

| Stage | Version | Meaning |
|-------|---------|---------|
| **Adolescent** | `7.x.y` | Leaves the burrow. Explores the reef. Multi-skill composition, band inheritance, and the editor are battle-tested. Molts slow down. |
| **Pre-legal** | `8.x.y` | Carapace under the minimum size (~2-3 inches). Too small to keep. Functionally complete but not yet cleared for general use. Beta. Must be thrown back if caught. |
| **Legal** | `9.x.y` | Carapace meets minimum legal size (3.25 inches). Can be harvested. Production-ready. Other projects can safely depend on bands. First stable release. |
| **Berried Adult** | `10.x.y` | Full reproductive maturity. Egg-bearing. The project produces offspring -- frameworks, forks, and ecosystems built on top of bands. |

### Harvest

The lobster has lived a full life on the ocean floor. Now it meets
the lobster trap.

| Stage | Version | Meaning |
|-------|---------|---------|
| **Trapped** | `11.x.y` | Walked into the trap voluntarily. Enterprise adoption, compliance, audit logging. Can't easily walk back out. |
| **Landed** | `12.x.y` | Pulled from the ocean, banded, on ice. Fully extracted from the development cycle. Feature-frozen. Maintenance-only. |
| **Boiled** | `13.x.y` | Cooked. The shell has turned red. Only security patches. |
| **Lobster Roll** | `14.x.y` | Served. Consumed by the masses. Bands is a commodity. Time to start a new crustacean. |

## Current Stage

**Egg** (`0.x.y`)

Fertilized and attached. Nothing swims yet. APIs will break between
any two releases. There is no shell -- just potential.

## Rules

1. **Stage transitions are one-way.** You cannot un-boil a lobster.
2. **Minor versions** (`x.N.y`) mark feature additions within a stage.
3. **Patch versions** (`x.y.N`) mark bug fixes and docs.
4. **Molts** (minor bumps) can include breaking changes through Stage III (`4.x`).
   After Postlarva, breaking changes require a new major version (next stage).
5. **Pre-legal** (`8.x`) is beta. Functional but not guaranteed stable.
6. **Legal** (`9.x`) is the first stable release. Semver rules apply from here.
7. **The stage tag** is appended to git tags for clarity.

## Git Tags

```
v0.1.0-egg
v1.0.0-prezoea
v2.0.0-stage-i
v3.0.0-stage-ii
v4.0.0-stage-iii
v5.0.0-postlarva
v6.0.0-juvenile
v7.0.0-adolescent
v8.0.0-pre-legal
v9.0.0-legal
v10.0.0-berried
v11.0.0-trapped
v12.0.0-landed
v13.0.0-boiled
v14.0.0-lobster-roll
```

## FAQ

**Q: What if we need to go past lobster roll?**
A: Start over as a new egg. Lobsters are biologically immortal -- they
never stop growing. Neither do we.

**Q: Is pre-legal safe to use in production?**
A: Like an undersized lobster, it must be thrown back if it breaks. Use
at your own risk.

**Q: Why not semver?**
A: Semver tells you what changed. The Lobster Scale tells you what the
project *is*. Both are useful. After Legal (`9.x`), semver rules apply
within stages.
