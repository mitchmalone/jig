// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "{{PROJECT_PASCAL}}Core",
    platforms: [.macOS(.v15), .iOS(.v18)],
    products: [
        .library(name: "{{PROJECT_PASCAL}}Core", targets: ["{{PROJECT_PASCAL}}Core"])
    ],
    targets: [
        .target(name: "{{PROJECT_PASCAL}}Core"),
        .testTarget(
            name: "{{PROJECT_PASCAL}}CoreTests",
            dependencies: ["{{PROJECT_PASCAL}}Core"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
