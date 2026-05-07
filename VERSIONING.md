# Lobster Life-cycle Versioning

*Homarus americanus*, from berry to jumbo.

## Stages

Pre-release stages live under `0.x`. The first stable release is Chicken (`1.0.0`).

### Pre-release (`0.x.y`)

| Stage | Version | Description |
|-------|---------|-------------|
| **Berry** | `0.1.y` | Fertilized egg on the swimmerets. Nothing swims yet. |
| **Prezoea** | `0.2.y` | Newly hatched. Not yet a larva, not still an egg. |
| **Larva I** | `0.3.y` | First true larva. Planktonic, translucent, drifting. |
| **Larva II** | `0.4.y` | Claws forming. Features stabilizing. |
| **Larva III** | `0.5.y` | Final larval stage. |
| **Postlarva** | `0.6.y` | Settles to the bottom. First real isolation. |
| **Juvenile** | `0.7.y` | Hides in shelter. Molts frequently. Soft-shell. |
| **Adolescent** | `0.8.y` | Leaves the burrow. Hard-shell forming. |
| **Short** | `0.9.y` | Under legal size, but maybe you want to risk it. |

### Release (`N.x.y`)

| Stage | Version | Description |
|-------|---------|-------------|
| **Chicken** | `1.x.y` | Minimum legal size (~1 lb). First stable release. |
| **Quarter** | `2.x.y` | 1 1/4 lbs. Hard-shell. |
| **Large** | `3.x.y` | 1 1/2 - 2 1/2 lbs. |
| **Jumbo** | `4.x.y` | Over 2 1/2 lbs. |

## Rules

1. Stage transitions are one-way. You cannot un-boil a lobster.
2. Breaking changes are free during pre-release (`0.x`).
3. Short (`0.9`) is beta. Using shorts is called *shorts-on* and it's risky.
4. Chicken (`1.0.0`) is the first stable release. Semver applies from here.
5. Stage tags go on git tags: `v0.1.0-berry`, `v1.0.0-chicken`.

## Git Tags

```
v0.1.0-berry
v0.2.0-prezoea
v0.3.0-larva-i
v0.4.0-larva-ii
v0.5.0-larva-iii
v0.6.0-postlarva
v0.7.0-juvenile
v0.8.0-adolescent
v0.9.0-short
v1.0.0-chicken
v2.0.0-quarter
v3.0.0-large
v4.0.0-jumbo
```
