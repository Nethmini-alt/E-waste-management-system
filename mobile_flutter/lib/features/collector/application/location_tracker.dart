import 'dart:async';

import 'package:geolocator/geolocator.dart';

import '../data/collector_api.dart';

/// Sends the collector's current position to PUT /collectors/{id}/location every few minutes
/// while they're online. Best-effort: a failed ping (no signal, permission revoked mid-shift,
/// a dropped request) is swallowed and tried again on the next tick rather than crashing
/// anything, since a missed update is far less harmful than the app breaking on it.
class LocationTracker {
  LocationTracker(this._api, this._collectorId);

  static const _interval = Duration(minutes: 4);

  final CollectorApi _api;
  final String _collectorId;
  Timer? _timer;

  bool get isRunning => _timer != null;

  void start() {
    if (isRunning) return;
    unawaited(_sendOnce());
    _timer = Timer.periodic(_interval, (_) => _sendOnce());
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _sendOnce() async {
    try {
      if (!await _hasPermission()) return;
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 20)),
      );
      await _api.updateLocation(_collectorId, position.latitude, position.longitude);
    } catch (_) {
      // See class doc — swallowed on purpose.
    }
  }

  Future<bool> _hasPermission() async {
    if (!await Geolocator.isLocationServiceEnabled()) return false;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }
}
