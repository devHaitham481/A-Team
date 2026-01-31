import AppKit
import SwiftUI

/// Floating pill window that stays on top of all other windows
/// Uses NSPanel for always-on-top behavior and is excluded from screen capture
@MainActor
final class FloatingPillWindow {
    static let shared = FloatingPillWindow()

    private var panel: NSPanel?
    private var recorder: ScreenRecorder?

    private init() {}

    /// Show the floating pill window with the given recorder
    /// - Parameter recorder: The ScreenRecorder instance to control
    func show(recorder: ScreenRecorder) {
        self.recorder = recorder

        // Create panel if it doesn't exist
        if panel == nil {
            createPanel()
        }

        // Set the content view
        if let panel = panel {
            let pillView = PillView(recorder: recorder)
            let hostingView = NSHostingView(rootView: pillView)
            panel.contentView = hostingView

            // Position the window
            positionWindow()

            // Show the window
            panel.orderFront(nil)
        }
    }

    /// Hide the floating pill window
    func hide() {
        panel?.orderOut(nil)
    }

    private func createPanel() {
        // Create NSPanel with borderless and non-activating style
        let newPanel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 120, height: 40),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )

        // Configure window level - floating stays on top of regular windows
        newPanel.level = .floating

        // Configure appearance
        newPanel.backgroundColor = .clear
        newPanel.isOpaque = false
        newPanel.hasShadow = true

        // Don't let window be moved by dragging
        newPanel.isMovableByWindowBackground = false

        // Make visible on all desktops and in fullscreen
        newPanel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]

        // CRITICAL: Exclude from screen capture
        // This tells ScreenCaptureKit to not capture this window
        newPanel.sharingType = .none

        panel = newPanel
    }

    private func positionWindow() {
        guard let panel = panel, let screen = NSScreen.main else { return }

        let screenFrame = screen.visibleFrame
        let pillWidth: CGFloat = 120
        let pillHeight: CGFloat = 40

        // Position: left-middle of screen, 20 points from left edge
        let x = screenFrame.origin.x + 20
        let y = screenFrame.origin.y + (screenFrame.height - pillHeight) / 2

        panel.setFrame(NSRect(x: x, y: y, width: pillWidth, height: pillHeight), display: true)
    }
}
