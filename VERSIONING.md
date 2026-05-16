# Lobster Life-cycle Versioning

*Homarus americanus*, from berry to jumbo.

## Pre-release

| Stage | Version | Description |
|-------|---------|-------------|
| Berry | `0.1.y` | Fertilized egg on the swimmerets. Nothing swims yet. |
| Prezoea | `0.2.y` | Newly hatched. Not yet a larva, not still an egg. |
| Larva I | `0.3.y` | First true larva. Planktonic, translucent, drifting. |
| Larva II | `0.4.y` | Claws forming. Features stabilizing. |
| Larva III | `0.5.y` | Final larval stage. Skill contract locked. |
| Postlarva | `0.6.y` | Settles to the bottom. First real isolation. |
| Juvenile | `0.7.y` | Hides in shelter. Molts frequently. Soft-shell. |
| Adolescent | `0.8.y` | Leaves the burrow. Hard-shell forming. |
| Short | `0.9.y` | Under legal size, but maybe you want to risk it. |

## Release

| Stage | Version | Description |
|-------|---------|-------------|
| Chicken | `1.x.y` | Minimum legal size. First stable release. |
| Quarter | `2.x.y` | Hard-shell. |
| Large | `3.x.y` | Established. |
| Jumbo | `4.x.y` | Full grown. |

## Rules

1. Stage transitions are one-way.
2. Breaking changes are free during pre-release.
3. Short is beta. Using shorts is called *shorts-on* — it's risky.
4. Chicken is the first stable release. Semver applies from there.
5. Stage tags on git tags: `v0.1.0-berry`, `v1.0.0-chicken`.
