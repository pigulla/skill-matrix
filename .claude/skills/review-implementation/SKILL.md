---
name: review-implementation
description: Use when asked to review, audit, or check the codebase's compliance with this project's own conventions — e.g. "review the implementation", "audit against AGENTS.md", "check this codebase follows our conventions". Checks the whole codebase against AGENTS.md and every .claude/skills/*/SKILL.md, checks for consistency across vertical slices (e.g. the user/skill/team/kind domains) and among similar tests, and allows general best-practice recommendations beyond documented rules — suppressing anything already accepted in KNOWN_ISSUES.md. Not for generic bug-hunting (use code-review) or writing new tests (use writing-tests).
model: sonnet
effort: high
---

# Review Implementation

## Overview

This skill audits the whole codebase in three complementary ways:

1. **Documented-rule violations** — against rules the project has _written down about itself_ in `AGENTS.md`, every `.claude/skills/*/SKILL.md`, and every accepted ADR in `docs/`. Every finding in this category must cite the specific rule or decision violated.
2. **Consistency findings** — the same kind of thing implemented differently in different places, with no documented reason for the divergence. Two angles matter most here: **vertical slices** (e.g. compare how `user`, `skill`, `team`, `kind`, and `team-skill-proficiencies` each implement their domain/application/persistence/presentation layers — one slice doing something the others don't is a signal even when no rule names it explicitly) and **similar tests** (e.g. compare all controller integration tests against each other, or all repository tests against each other, for a case that's covered in one and silently missing in its siblings, or asserted in a different style for no reason).
3. **General recommendations** — genuinely useful observations that go beyond what's written down or what a sibling slice does (e.g. a missing edge case, an unclear name, a simpler way to express something). These are still worth surfacing; they just don't need a citation the way category 1 findings do.

Not every finding needs a rule citation — but every finding must say which of the three categories it's making, since that changes how much weight it should carry.

Findings are cross-checked against `KNOWN_ISSUES.md` (repo root) — issues previously identified and explicitly accepted as not worth fixing right now. A match is suppressed, not re-reported, regardless of which category it falls under.

A finding is also suppressed when it only re-argues a trade-off an accepted ADR in `docs/` already made on the record. Before reporting anything that touches a larger architectural decision — persistence approach, error-handling pattern, concurrency/hashing scheme, DTO/validation construction, or similar system-wide design — check whether an ADR covers it. If the finding amounts to "use X instead" where X appears in that ADR's Considered Options, or restates a downside already listed under Consequences as an accepted cost, drop it: that trade-off has already been weighed and accepted, and re-raising it is noise, not a finding. This does not cover findings that show the implementation doesn't actually deliver what the ADR decided — a bug that breaks an invariant the decision depends on, or a case the ADR's own text never considered (e.g. `docs/architecture-review.md`'s finding that the concurrency token can compare equal across a real change, despite ADR 003's chosen hash still being the right hash for the pre-image it assumed) — those remain valid, and should cite the ADR being undermined rather than propose the alternative it already rejected.

A finding is also suppressed when the code itself already explains the deviation. Before reporting anything, read any comment attached to that piece of code (inline, above the line, JSDoc) — if it explains why the code diverges from the rule/pattern/sibling, and that explanation actually holds up against what the code really does, drop the finding; a self-documented, deliberate exception is not the same as an unexplained violation. A comment that's merely nearby but doesn't actually justify the specific deviation, or explains something else entirely, doesn't earn suppression.

**The final report is a punch list, not an assessment.** It contains only actionable findings — things that should change. It never contains praise, a compliance summary, or a note that some file/rule/slice is fine, done correctly, or already consistent. If a review agent verifies something and it turns out fine, that's the end of it: it produces nothing, not a positive mention.

## Sources of truth (read fresh every run, in full, before reviewing any code)

1. **`AGENTS.md`** at repo root — architecture layers/import boundaries, the Result error-handling pattern, code conventions, file naming, imports.
2. **Every `.claude/skills/*/SKILL.md`** — read all of them, not just ones whose `paths` glob matches recently changed files; this is a whole-codebase audit, not a diff review. Follow a skill's "Deeper guides" links when its rules need that extra detail (e.g. `database-changes/adding-a-repository.md`).
3. **Every ADR in `docs/`** — files named `NNN-title.md` with decision-record front matter (`status: accepted` or `superseded`), e.g. `docs/001-persistence-strategy.md`. Read each one in full, not just its Decision Outcome: the Considered Options and Consequences sections record exactly which alternatives and downsides were already weighed and accepted, and that's what governs findings touching a larger architectural decision (see suppression rule below). A `superseded` ADR is historical context only — its successor (named in its own text, e.g. "Supersedes ADR 003") governs instead. Other files under `docs/` (`architecture-review.md`, `task-*.md`, `openapi.*`) are not ADRs and don't carry this weight.
4. **`KNOWN_ISSUES.md`** at repo root, if it exists — a suppression list, see below. If absent, treat it as empty; don't error, and don't invent a template for it until a finding actually needs deferring.

Do not rely on memory of what these files say from an earlier turn — they change, and a review is only as good as the rule text it was checked against.

## Process

1. **Run the mechanical checks first**: `npm run lint` (tsc, `lint:architecture`, biome, knip, markdown, sql, lockfile, package.json) and `npm run vitest`. Anything these already catch is guaranteed to surface on its own — don't spend agent effort re-deriving it, and don't report it as a finding. Note failures only as context for step 3.
2. **Build the rule set**: read AGENTS.md, every SKILL.md, every ADR in `docs/`, and KNOWN_ISSUES.md in full (sources of truth above).
3. **Dispatch one review agent per source-of-truth document** (AGENTS.md's own conventions not delegated to a skill, plus one per SKILL.md) to sweep the whole codebase for violations of that document's rules only (category 1). Give each agent the literal rule text, not a paraphrase, and tell it to cite the specific rule it's checking in every finding. Keep each agent scoped to non-mechanical, judgment-requiring rules — the kind lint/tsc/architecture checks can't catch (e.g. `get*` vs `find*` return semantics, correct `Result` usage at each layer, no inline SQL, test placement/mocking conventions, the `operationId` convention).
4. **Dispatch a consistency review** (category 2), separate from the rule-based agents above: enumerate the vertical slices under `src/domain/*` (and their counterparts in `src/application/`, `src/infrastructure/persistence/`, `src/presentation/`) and diff how each implements the same kind of concern; separately, group test files by what they're testing (all controller integration tests together, all repository tests together, etc.) and diff those for coverage or style gaps between siblings. Flag divergences that aren't explained by a real difference in the underlying domain.
5. **Let every agent surface general recommendations too** (category 3) — things worth pointing out that don't fit categories 1 or 2. Don't force these into a rule citation or a sibling comparison; just label them as recommendations.
6. **Cross-check every candidate finding against `KNOWN_ISSUES.md`** by substance (same file + same underlying issue), not exact wording. Drop matches. Report how many were suppressed this way so coverage isn't silently overstated.
7. **Adversarially verify** what's left. First, for every candidate, check the code for a nearby comment (inline, above the line, JSDoc) explaining the deviation — if it holds up against what the code actually does, drop the finding here and don't report it. Second, for any candidate that touches a larger architectural decision, check it against the relevant ADR in `docs/`: if it re-argues an alternative already listed and rejected in that ADR's Considered Options, or a downside already accepted under Consequences, drop it; if it shows the implementation doesn't actually deliver what the ADR decided, keep it and cite the ADR being undermined. For what remains: for category 1, re-read the cited rule and the actual code and confirm the violation is real, not a misreading of the rule or a case the rule explicitly exempts; for category 2, confirm the divergence isn't justified by a genuine difference between the slices/tests being compared; for category 3, confirm the recommendation actually applies to the code as it stands.
8. **Report via the `ReportFindings` tool**, most severe first. Ranking: category 1 architecture-boundary and error-handling (Result pattern) violations first — they break invariants enforced elsewhere in the stack — then other category 1 persistence/testing/OpenAPI convention violations, then category 2 consistency findings, then category 3 recommendations. Every finding's summary or failure_scenario should say which category it is and, for category 1, quote or closely paraphrase the rule. Include only entries that survived verification in step 7 — no entry may describe something the codebase already does correctly. If nothing survives, call `ReportFindings` with an empty `findings` array rather than writing up what was checked.
9. **After the user triages findings**: for any finding they decide isn't worth fixing now — in any category — add a bullet to `KNOWN_ISSUES.md` (create the file, with just a one-line header, if it doesn't exist yet) so it isn't rediscovered and re-reported next time. Don't add entries for findings that get fixed.

## KNOWN_ISSUES.md format

Freeform bullet list, one bullet per accepted issue. Keep each bullet self-contained enough to match against future findings — what/where the issue is, and why it's accepted:

```markdown
- `SkillRepository.bulkUpdate()` doesn't wrap its two writes in `@ResultTransactional()` — low-traffic admin path, not worth the atomicity guarantee yet.
- `team-skill-proficiencies` integration tests don't cover the 0-team edge case — flagged in review, deprioritized until the feature ships.
```

## Common mistakes

- Reviewing only files changed recently instead of the whole codebase — this skill is an audit, not a diff review; "pre-existing" is not an exemption here.
- Flagging something a linter/tsc/architecture-check already enforces mechanically (wastes review effort and duplicates a CI failure that will surface anyway).
- Re-reporting something already listed in `KNOWN_ISSUES.md`, or matching it only on exact wording instead of substance.
- Claiming a category 1 (documented-rule) violation without citing real rule text — that citation is what separates it from a category 3 recommendation.
- Flagging a vertical-slice or test divergence as a consistency finding when it's actually explained by a genuine difference between the two things being compared (e.g. one domain genuinely has no delete operation).
- Presenting a category 3 recommendation as if it were a hard rule violation, or vice versa — the category changes how much weight the finding carries, so mislabeling it is misleading.
- Flagging `extends` where AGENTS.md says "implement, don't extend" without checking whether the interface in question is actually used as a DI token (`grep "provide:" src/module/*.module.ts`) — a shared abstract base class between several concrete implementations (e.g. `UuidProvider`) that itself sits below the DI boundary is not the same as a class extending the DI-token interface it's registered under.
- Adding a `KNOWN_ISSUES.md` entry for something the user actually fixed, or skipping the entry for something they explicitly deferred.
- Padding the report with what's already compliant, well-implemented, or consistent — the report is a list of things to act on, not a scorecard; leave compliant code out entirely instead of mentioning it approvingly.
- Suppressing a finding just because a comment exists nearby, without checking that it actually explains and justifies this specific deviation — a comment that misdescribes what the code does, or explains an unrelated concern, doesn't earn suppression.
- Ignoring a genuine, correct justifying comment and reporting the deviation anyway — re-litigating a decision the code has already explained is noise, not a finding.
- Recommending an alternative to a documented architectural decision (e.g. "use an ORM instead of raw SQL", "use SHA-256 instead of MD5", "use explicit command types instead of domain-derived DTOs") without first checking whether the relevant ADR in `docs/` already considered and rejected that exact alternative — re-litigating an accepted trade-off is noise, not a finding.
- Suppressing an architectural finding just because an ADR exists in the same area, without checking whether it actually shows the ADR's own decision isn't being delivered by the implementation (a bug undermining the invariant the decision relies on) rather than re-arguing the decision itself.
- Flagging a database view as unused or unnecessary because no application `.sql` file references it — views may exist in migrations for developer convenience and explorability, with no current application-code use intended; this is an accepted pattern (documented in `database-changes/SKILL.md`).
