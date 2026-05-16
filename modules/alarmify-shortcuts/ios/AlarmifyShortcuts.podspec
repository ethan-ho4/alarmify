require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AlarmifyShortcuts'
  s.version        = package['version']
  s.summary        = 'Alarmify App Group + Shortcuts App Intent'
  s.license        = 'MIT'
  s.author         = 'Alarmify'
  s.homepage       = 'https://github.com/ethan-ho4/alarmify'
  s.platforms      = { :ios => '16.0' }
  s.swift_version  = '5.9'
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.frameworks = 'AppIntents'
end
