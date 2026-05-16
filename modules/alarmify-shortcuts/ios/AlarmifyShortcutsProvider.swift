import AppIntents

@available(iOS 16.0, *)
struct AlarmifyShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: GetActiveAlarmTrack(),
      phrases: [
        "Get alarm music from \(.applicationName)",
        "Get active alarm track in \(.applicationName)",
      ],
      shortTitle: "Get Active Alarm Music Link",
      systemImageName: "alarm"
    )
  }
}
