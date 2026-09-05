import SwiftUI
import {{PROJECT_PASCAL}}Core

struct ContentView: View {
    var body: some View {
        Text(Greeting.text(for: "{{PROJECT_PASCAL}}"))
            .padding()
            .frame(minWidth: 320, minHeight: 200)
    }
}
