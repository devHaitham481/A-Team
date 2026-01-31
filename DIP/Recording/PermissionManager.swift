import AVFoundation
@preconcurrency import ScreenCaptureKit
import SwiftUI

@MainActor
final class PermissionManager: ObservableObject {
    @Published var microphoneAuthorized: Bool = false
    @Published var screenRecordingAuthorized: Bool = false

    init() {
        // Initial status check without triggering prompts
        updateMicrophoneStatus()
    }

    // MARK: - Permission Checking

    func checkAllPermissions() async {
        updateMicrophoneStatus()
        await checkScreenRecordingPermission()
    }

    private func updateMicrophoneStatus() {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)
        microphoneAuthorized = status == .authorized
    }

    private func checkScreenRecordingPermission() async {
        do {
            // Attempting to get shareable content will trigger permission prompt if not granted
            _ = try await SCShareableContent.current
            screenRecordingAuthorized = true
        } catch {
            // If error, permission was denied or not yet granted
            screenRecordingAuthorized = false
        }
    }

    // MARK: - Permission Requests

    func requestMicrophonePermission() async -> Bool {
        let status = AVCaptureDevice.authorizationStatus(for: .audio)

        switch status {
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .audio)
            microphoneAuthorized = granted
            return granted
        case .authorized:
            microphoneAuthorized = true
            return true
        case .denied, .restricted:
            microphoneAuthorized = false
            return false
        @unknown default:
            microphoneAuthorized = false
            return false
        }
    }

    func requestScreenRecordingPermission() async -> Bool {
        do {
            // This will trigger the system permission prompt on first call
            _ = try await SCShareableContent.current
            screenRecordingAuthorized = true
            return true
        } catch {
            // Permission denied or requires app restart
            screenRecordingAuthorized = false
            return false
        }
    }

    // MARK: - Settings Helpers

    func openMicrophoneSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone") {
            NSWorkspace.shared.open(url)
        }
    }

    func openScreenRecordingSettings() {
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture") {
            NSWorkspace.shared.open(url)
        }
    }
}
