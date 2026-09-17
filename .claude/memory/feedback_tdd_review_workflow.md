---
name: tdd-review-workflow
description: User wants refactors/fixes done TDD-first, followed by code-review and security-review passes, iterating fix -> review
metadata:
  type: feedback
---

For refactoring and bug-fix work in pairwise-tui the user asked for: TDD (write the failing test first, watch it fail, then implement), explicitly no functionality change during pure refactors, KISS/DRY, and afterwards a code review plus (for larger work) a security review. When a review pass finds issues, they tend to ask for another fix round followed by another review pass.

**Why:** the user treats review passes as the quality gate and wants regressions pinned by tests before code changes; they caught that review findings deserve their own TDD-fixed round.

**How to apply:** for any non-trivial change here, follow red-green TDD (`bun test`), verify with `bun run test && bun run typecheck && bun run check`, then run the code-review skill (and security-review when the change touches I/O, paths, subprocesses or credentials) and report findings rather than silently fixing them - let the user decide on the next round. Related: [[project-review-followups]].
