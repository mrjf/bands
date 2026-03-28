# Bands Versioning: The Lobster Scale

*Homarus americanus*, from berry to lobster roll.

## Stages

| # | Stage | Version | Description |
|---|-------|---------|-------------|
| 0 | **Berry** | `0.x.y` | Fertilized egg on the swimmerets. Nothing swims yet. |
| 1 | **Prezoea** | `1.x.y` | Newly hatched. Not yet a larva, not still an egg. |
| 2 | **Stage I** | `2.x.y` | First true larva. Planktonic, translucent, drifting. |
| 3 | **Stage II** | `3.x.y` | Claws forming. Features stabilizing. |
| 4 | **Stage III** | `4.x.y` | Final larval stage. Skill contract locked. |
| 5 | **Postlarva** | `5.x.y` | Settles to the bottom. First real isolation. |
| 6 | **Juvenile** | `6.x.y` | Hides in shelter. Molts frequently. Soft-shell. |
| 7 | **Adolescent** | `7.x.y` | Leaves the burrow. Hard-shell forming. |
| 8 | **Short** | `8.x.y` | Under legal size. Beta. Must be thrown back. |
| 9 | **Chicken** | `9.x.y` | Minimum legal size (~1 lb). First stable release. |
| 10 | **Quarter** | `10.x.y` | 1 1/4 lbs. Hard-shell. Producing offspring. |
| 11 | **Large** | `11.x.y` | 1 1/2 - 2 1/2 lbs. Enterprise. In the pot. |
| 12 | **Jumbo** | `12.x.y` | Over 2 1/2 lbs. Banded, on ice. Maintenance-only. |
| 13 | **Boiled** | `13.x.y` | Shell turned red. Security patches only. |
| 14 | **Lobster Roll** | `14.x.y` | Served. Time to start a new crustacean. |

## Current Stage

**Berry** (`0.x.y`)

## Rules

1. Stage transitions are one-way. You cannot un-boil a lobster.
2. Breaking changes are free through Stage III (`4.x`).
3. Short (`8.x`) is beta. Keeping shorts is called *shorts on*.
4. Chicken (`9.x`) is the first stable release. Semver applies from here.
5. Stage tags go on git tags: `v0.1.0-berry`, `v9.0.0-chicken`.

## Git Tags

```
v0.1.0-berry
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
