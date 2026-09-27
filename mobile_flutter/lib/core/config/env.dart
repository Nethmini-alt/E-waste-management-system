import 'package:flutter/foundation.dart';

/// Where the ASP.NET Core API lives.
///
/// Override at build/run time:  flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5172
/// Defaults: the Android emulator reaches the host PC at 10.0.2.2; everything else (iOS simulator,
/// web, desktop) uses localhost. A real phone needs the PC's LAN address via --dart-define.
abstract final class Env {
  static const _override = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_override.isNotEmpty) return _override;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) return 'http://10.0.2.2:5172';
    return 'http://localhost:5172';
  }
}
