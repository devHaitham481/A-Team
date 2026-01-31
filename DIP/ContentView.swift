import SwiftUI

struct ContentView: View {
    @StateObject private var permissionManager = PermissionManager()

    var body: some View {
        VStack(spacing: 24) {
            Text("DIP Permissions")
                .font(.title)
                .fontWeight(.bold)

            VStack(spacing: 16) {
                // Microphone Permission Row
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

                // Screen Recording Permission Row
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

            if permissionManager.microphoneAuthorized && permissionManager.screenRecordingAuthorized {
                Text("All permissions granted!")
                    .foregroundColor(.green)
                    .font(.headline)
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
    ContentView()
}
