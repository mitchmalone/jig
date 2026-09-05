import Testing

@testable import {{PROJECT_PASCAL}}Core

@Test func greetingNamesTheProject() {
    #expect(Greeting.text(for: "{{PROJECT_PASCAL}}") == "Hello from {{PROJECT_PASCAL}}")
}
