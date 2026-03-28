# Bands Versioning: The Lobster Scale

Bands follows the **Lobster Scale** -- a versioning system modeled on the
life cycle of *Homarus americanus* (the American lobster), from fertilized
egg to lobster roll.

Based on the developmental biology described by Factor & Clemetson
(Sea Grant / SUNY, 2003) and traditional lobstering terminology from
the fishermen who haul the pots.

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
| **Shelter Juvenile** | `6.x.y` | Digs burrows in mud, hides under rocks. Molts frequently. Rarely ventures out. Rapid feature growth but stays close to home. Public API is stable but internals churn. A *soft-shell* -- freshly molted, still hardening. |

### Growth (emerging -- building the shell)

The lobster ventures out of its shelter, grows through repeated molts,
and develops its characteristic hard shell and heavy claws.

| Stage | Version | Meaning |
|-------|---------|---------|
| **Adolescent** | `7.x.y` | Leaves the burrow. Explores the reef. Multi-skill composition, band inheritance, and the editor are battle-tested. Molts slow down. |
| **Short** | `8.x.y` | A *short* -- carapace under the minimum legal size. Functionally complete but must be thrown back. Beta. Keeping one is called *shorts on* and you will get fined. |
| **Chicken** | `9.x.y` | Meets minimum legal size (~1 lb). The smallest lobster you can keep. Production-ready. First stable release. Other projects can safely depend on bands. Semver rules apply from here. |
| **Quarter** | `10.x.y` | 1 1/4 lbs. Growing. *Hard-shell* -- black mottling under the claws, dense meat. The project produces offspring: frameworks, forks, ecosystems built on bands. |

### Harvest

The lobster has lived a full life on the ocean floor. Now it meets
the lobster pot.

| Stage | Version | Meaning |
|-------|---------|---------|
| **Large** | `11.x.y` | 1 1/2 to 2 1/2 lbs. Walked into the *pot* voluntarily. Enterprise adoption, compliance, audit logging. Can't easily walk back out. |
| **Jumbo** | `12.x.y` | Over 2 1/2 lbs. Pulled from the ocean, banded, on ice. Fully extracted from the development cycle. Feature-frozen. Maintenance-only. |
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
5. **Short** (`8.x`) is beta. Functional but must be thrown back. Use at your own risk.
6. **Chicken** (`9.x`) is the first stable release. Semver rules apply from here.
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
v8.0.0-short
v9.0.0-chicken
v10.0.0-quarter
v11.0.0-large
v12.0.0-jumbo
v13.0.0-boiled
v14.0.0-lobster-roll
```

## Glossary

Terms from the trade, used throughout this project:

| Term | Meaning |
|------|---------|
| **Berries** | Lobster eggs. Our issues and PRs, carried until they hatch. |
| **Berried** | A release carrying unhatched features (release candidates). |
| **Chicken** | Smallest legal lobster (~1 lb). Our first stable release. |
| **Cull** | A lobster missing one claw. A release with a known missing feature -- still edible, sold at a discount. |
| **Hard-shell** | Fully hardened after a molt. A release that's been in production long enough to trust. |
| **Hen** | Female lobster. A release that produces offspring (other projects depend on it). |
| **Molt** | Shedding the old shell to grow. A breaking change. |
| **Pistol** | A lobster that's lost both claws. A release with critical regressions -- avoid. |
| **Pot** | A lobster trap. The production environment. |
| **Short** | Undersized, must be thrown back. A beta release. |
| **Shorts on** | A lobsterman caught keeping undersized lobsters. Shipping a beta as stable. |
| **Sleeper** | A sluggish lobster that can't hold up its claws. A release with known performance issues -- should be avoided. |
| **Soft-shell** | Freshly molted, still hardening. A release immediately after a major refactor. |
| **Tomalley** | The liver. Green, prized by some, avoided by others. Our internal APIs. |

## FAQ

**Q: What if we need to go past lobster roll?**
A: Start over as a new egg. Lobsters are biologically immortal -- they
never stop growing. Neither do we.

**Q: Is a Short safe to use in production?**
A: Like an undersized lobster, it must be thrown back if it breaks.
Keeping shorts is called *shorts on* and you will get fined.

**Q: Why not semver?**
A: Semver tells you what changed. The Lobster Scale tells you what the
project *is*. Both are useful. After Chicken (`9.x`), semver rules
apply within stages.

**Q: What's a cull release?**
A: Missing a feature but otherwise functional. Sold at a discount.
The release notes will say which claw is missing.
