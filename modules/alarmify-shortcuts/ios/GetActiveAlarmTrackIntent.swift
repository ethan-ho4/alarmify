import AppIntents
import Foundation

@available(iOS 16.0, *)
struct GetActiveAlarmTrack: AppIntent {
  static var title: LocalizedStringResource = "Get Active Alarm Music Link"
  static var description = IntentDescription(
    "Returns the Spotify link for your enabled Alarmify alarm."
  )
  static var openAppWhenRun = false

  @MainActor
  func perform() async throws -> some IntentResult & ReturnsValue<String> {
    let suite = UserDefaults(suiteName: "group.com.ethanho.alarmify")
    let enabled = suite?.bool(forKey: "alarm_enabled") ?? false
    guard enabled,
          let uri = suite?.string(forKey: "active_spotify_uri"),
          !uri.isEmpty
    else {
      throw NSError(
        domain: "AlarmifyShortcuts",
        code: 1,
        userInfo: [
          NSLocalizedDescriptionKey:
            "No active alarm in Alarmify. Open Alarmify, enable an alarm with a song, then try again.",
        ]
      )
    }
    return .result(value: uri)
  }
}
