import SwiftUI
import FirebaseCore

/// Shared ScreenRecorder instance used by both main window and floating pill
@MainActor
let sharedRecorder = ScreenRecorder()

/// Shared coordinator for ScreenAssist functionality
@MainActor
let sharedCoordinator = ScreenAssistCoordinator()

@main
struct DIPApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    init() {
        // Initialize Firebase
        FirebaseApp.configure()
    }

    var body: some Scene {
        WindowGroup {
            ScreenAssistView()
        }
        .windowStyle(.hiddenTitleBar)
        .defaultSize(width: 450, height: 600)
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
