import SwiftUI

struct ContentView: View {
    @StateObject private var permissionManager = PermissionManager()
    @ObservedObject var recorder: ScreenRecorder

    private var allPermissionsGranted: Bool {
        permissionManager.microphoneAuthorized && permissionManager.screenRecordingAuthorized
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("DIP - Screen Recorder")
                .font(.title)
                .fontWeight(.bold)

            // Permission status section
            VStack(spacing: 16) {
                PermissionRow(
                    title: "Microphone",
                    description: "Required for voice narration",
                    isAuthorized: permissionManager.microphoneAuthorized,
                    onRequest: {
                        Task {
                            await permissionManager.requestMicrophonePermission()
                        }
                    },
                    onOpenSettings: {
                        permissionManager.openMicrophoneSettings()
                    }
                )

                PermissionRow(
                    title: "Screen Recording",
                    description: "Required for capturing your screen",
                    isAuthorized: permissionManager.screenRecordingAuthorized,
                    onRequest: {
                        Task {
                            await permissionManager.requestScreenRecordingPermission()
                        }
                    },
                    onOpenSettings: {
                        permissionManager.openScreenRecordingSettings()
                    }
                )
            }
            .padding()
            .background(Color(.windowBackgroundColor))
            .cornerRadius(12)

            // Recording status section
            VStack(spacing: 12) {
                HStack {
                    if recorder.isRecording {
                        Circle()
                            .fill(Color.red)
                            .frame(width: 12, height: 12)
                        Text("Recording...")
                            .foregroundColor(.red)
                            .fontWeight(.semibold)
                    } else if let error = recorder.error {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                        Text(error)
                            .foregroundColor(.orange)
                            .font(.caption)
                    } else if allPermissionsGranted {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("Ready to record")
                            .foregroundColor(.green)
                    } else {
                        Image(systemName: "exclamationmark.circle.fill")
                            .foregroundColor(.yellow)
                        Text("Grant permissions above")
                            .foregroundColor(.secondary)
                    }
                }
                .font(.headline)

                // Recording button
                Button(action: {
                    Task {
                        if recorder.isRecording {
                            try? await recorder.stopRecording()
                        } else {
                            do {
                                try await recorder.startRecording()
                            } catch {
                                recorder.error = error.localizedDescription
                            }
                        }
                    }
                }) {
                    HStack {
                        Image(systemName: recorder.isRecording ? "stop.fill" : "record.circle")
                        Text(recorder.isRecording ? "Stop Recording" : "Start Recording")
                    }
                    .frame(minWidth: 180)
                    .padding(.vertical, 8)
                }
                .buttonStyle(.borderedProminent)
                .tint(recorder.isRecording ? .red : .blue)
                .disabled(!allPermissionsGranted)
            }
            .padding()
            .background(Color(.controlBackgroundColor))
            .cornerRadius(12)

            // Last recording info
            if let url = recorder.recordingURL {
                VStack(spacing: 8) {
                    Text("Last Recording")
                        .font(.headline)

                    Text(url.path)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(2)
                        .truncationMode(.middle)

                    Button("Open in Finder") {
                        NSWorkspace.shared.selectFile(url.path, inFileViewerRootedAtPath: url.deletingLastPathComponent().path)
                    }
                    .buttonStyle(.bordered)
                }
                .padding()
                .background(Color(.controlBackgroundColor))
                .cornerRadius(12)
            }
        }
        .padding(32)
        .frame(minWidth: 400, minHeight: 300)
        .task {
            await permissionManager.checkAllPermissions()
        }
    }
}

struct PermissionRow: View {
    let title: String
    let description: String
    let isAuthorized: Bool
    let onRequest: () -> Void
    let onOpenSettings: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Image(systemName: isAuthorized ? "checkmark.circle.fill" : "xmark.circle.fill")
                        .foregroundColor(isAuthorized ? .green : .red)
                    Text(title)
                        .font(.headline)
                }
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            if isAuthorized {
                Text("Granted")
                    .foregroundColor(.green)
                    .font(.caption)
            } else {
                HStack(spacing: 8) {
                    Button("Request") {
                        onRequest()
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Settings") {
                        onOpenSettings()
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
        .padding()
        .background(Color(.controlBackgroundColor))
        .cornerRadius(8)
    }
}

#Preview {
    ContentView(recorder: ScreenRecorder())
}
