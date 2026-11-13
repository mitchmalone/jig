# desktop-swift

Native Apple app (macOS first; iPadOS by adding a destination) written in Swift. Composes as: pure SwiftPM packages under `packages/*` holding all logic and tests, and a thin SwiftUI app under `apps/app` described by an XcodeGen `project.yml`. The `.xcodeproj` is generated and gitignored — YAML is the project.

The pnpm root is kept purely as the gate runner (lefthook, commitlint, prettier for docs); the generator strips TypeScript tooling. `verify` = swift-format lint + prettier check + `swift test` per package + an `xcodebuild` of the app. Record nothing in `DEVIATIONS.md` — the standard sanctions Swift for Apple-native apps.

Prerequisites: Xcode (swift-format ships with it) and `brew bundle` for XcodeGen. Signing is environment-driven: `export DEVELOPMENT_TEAM=XXXXXXXXXX` in a gitignored `.envrc` (direnv; start from `.envrc.example`) signs local builds automatically; without it the build is unsigned, which is what CI does.

Does not compose with the `ci` layer (the pre-push hook is the gate; macOS runners are for releases only) or with `tui-bun` (Bun toolchain swap) — one toolchain per repo. Composes with `public`: gitleaks arrives as a lefthook fragment and the release workflow is a scaffold to replace with the archive/notarize build.
