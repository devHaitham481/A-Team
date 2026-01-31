import SwiftUI

/// Shared ScreenRecorder instance used by both main window and floating pill
@MainActor
let sharedRecorder = ScreenRecorder()

@main
struct DIPApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        WindowGroup {
            ContentView(recorder: sharedRecorder)
        }
    }
}

/// App delegate to handle application lifecycle events
class AppDelegate: NSObject, NSApplicationDelegate {
    @MainActor
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Show the floating pill window on launch
        FloatingPillWindow.shared.show(recorder: sharedRecorder)
    }
}
