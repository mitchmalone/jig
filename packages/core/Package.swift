// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "SmokeSwiftCore",
    platforms: [.macOS(.v15), .iOS(.v18)],
    products: [
        .library(name: "SmokeSwiftCore", targets: ["SmokeSwiftCore"])
    ],
    targets: [
        .target(name: "SmokeSwiftCore"),
        .testTarget(
            name: "SmokeSwiftCoreTests",
            dependencies: ["SmokeSwiftCore"]
        ),
    ],
    swiftLanguageModes: [.v6]
)
