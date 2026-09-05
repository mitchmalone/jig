# Swift standards (delta from the jig standard)

The jig standard's TypeScript sections don't apply to Swift code; these do.

- **Swift 6 language mode, complete concurrency checking.** Data-race safety is a compile error, not a code-review note.
- **Logic lives in `packages/*`, never in the app target.** Core packages are pure SwiftPM: no UI, no I/O, no direct `Date()`/`UUID()` — inject them. `swift test` must run without Xcode, a simulator, or a signing identity.
- **The app target is composition.** SwiftUI views, platform adapters (WebKit, CloudKit, Keychain), and wiring. Anything you'd want to unit-test goes down a level.
- **Swift Testing** (`import Testing`, `@Test`, `#expect`) for new tests. XCTest only where a framework demands it (UI tests).
- No `!` force unwraps, `try!`, or `as!` outside tests — swift-format enforces it (a `Tests/.swift-format` relaxes the two rules there). Errors are typed values; model domain errors as `enum … : Error`.
- Naming follows the [Swift API Design Guidelines](https://www.swift.org/documentation/api-design-guidelines/); `swift-format` (bundled with Xcode) is the formatter — don't fight it.
- **`project.yml` is the project.** Never hand-edit or commit `.xcodeproj`; run `pnpm generate` after changing the spec. Adding a platform is a `supportedDestinations`/`platform` change in the spec, not a new project.
- Minimum deployment target is declared once, in `project.yml` and `Package.swift`; keep them equal.
- Signing is environment-driven (`DEVELOPMENT_TEAM` from `.envrc`). Unset means an unsigned build — that's the CI path, and it must always work.
- Performance budgets, if the product has them, are requirements — put the table in `AGENTS.md` and test against it.
