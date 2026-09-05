/// The core package is pure: no UI, no I/O. Everything here is unit-tested with `swift test`.
public enum Greeting {
    public static func text(for name: String) -> String {
        "Hello from \(name)"
    }
}
