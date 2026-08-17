# Known Issues

Implementation issues that have been identified during a review (see the [`review-implementation`](./.claude/skills/review-implementation) skill) but are explicitly not worth fixing right now. Entries here are treated as a suppression list — matching issues are not re-flagged on future reviews.

Add a bullet whenever a finding is intentionally deferred rather than fixed. Keep each one self-contained: what the issue is, where it lives, and why it's being left alone.

<!--
- `SkillRepository.bulkUpdate()` doesn't wrap its two writes in `@ResultTransactional()` — low-traffic admin path, not worth the atomicity guarantee yet.
-->
