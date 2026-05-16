import ExpoModulesCore
import Foundation

private let appGroupId = "group.com.ethanho.alarmify"
private let uriKey = "active_spotify_uri"
private let enabledKey = "alarm_enabled"

public class AlarmifyShortcutsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlarmifyShortcuts")

    Function("setActiveAlarmPayload") { (uri: String, enabled: Bool) in
      guard let defaults = UserDefaults(suiteName: appGroupId) else {
        throw Exception(name: "AppGroupError", description: "Could not open App Group storage")
      }
      defaults.set(uri, forKey: uriKey)
      defaults.set(enabled, forKey: enabledKey)
    }

    Function("getActiveAlarmPayload") { () -> [String: Any] in
      guard let defaults = UserDefaults(suiteName: appGroupId) else {
        return ["uri": "", "enabled": false]
      }
      return [
        "uri": defaults.string(forKey: uriKey) ?? "",
        "enabled": defaults.bool(forKey: enabledKey),
      ]
    }

    Function("isAvailable") {
      return true
    }
  }
}
