const { withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');

const APP_GROUP = 'group.com.ethanho.alarmify';

/** @type {import('@expo/config-plugins').ConfigPlugin} */
module.exports = function withAlarmifyShortcuts(config) {
  config = withEntitlementsPlist(config, (entitlements) => {
    const existing = entitlements['com.apple.security.application-groups'] ?? [];
    if (!existing.includes(APP_GROUP)) {
      entitlements['com.apple.security.application-groups'] = [...existing, APP_GROUP];
    }
    return entitlements;
  });

  config = withInfoPlist(config, (info) => {
    const schemes = info.LSApplicationQueriesSchemes ?? [];
    const next = [...schemes];
    for (const scheme of ['shortcuts', 'spotify']) {
      if (!next.includes(scheme)) next.push(scheme);
    }
    info.LSApplicationQueriesSchemes = next;
    return info;
  });

  return config;
};
