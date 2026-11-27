import Testing

@testable import SmokeSwiftCore

@Test func greetingNamesTheProject() {
    #expect(Greeting.text(for: "SmokeSwift") == "Hello from SmokeSwift")
}
