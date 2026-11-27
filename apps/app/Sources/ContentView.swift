import SmokeSwiftCore
import SwiftUI

struct ContentView: View {
    var body: some View {
        Text(Greeting.text(for: "SmokeSwift"))
            .padding()
            .frame(minWidth: 320, minHeight: 200)
    }
}
