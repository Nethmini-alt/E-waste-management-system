// Component B — Collection & Logistics: collector app tests (owner: Nethmini)
//
// TC-FL-B-001..005  widget tests of the collector's home screen (JobListScreen)
// TC-FL-B-006       completion form validation (CompleteJobSheet)
// TC-FL-B-007..008  API integration: CollectorApi against a fake HTTP backend
//
// The backend is replaced with Riverpod overrides and a fake Dio adapter, so no
// API, network, GPS or secure storage is needed.

import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_flutter/core/auth/auth_controller.dart';
import 'package:mobile_flutter/core/auth/auth_models.dart';
import 'package:mobile_flutter/features/collector/application/collector_providers.dart';
import 'package:mobile_flutter/features/collector/data/collector_api.dart';
import 'package:mobile_flutter/features/collector/data/collector_models.dart';
import 'package:mobile_flutter/features/collector/presentation/complete_job_sheet.dart';
import 'package:mobile_flutter/features/collector/presentation/job_list_screen.dart';
import 'package:mobile_flutter/features/notifications/notifications_api.dart';

// ---------- test data ----------

const _collectorId = 'c0ffee00-0000-4000-8000-000000000001';

CollectorProfile profile({bool online = false}) => CollectorProfile(
      collectorId: _collectorId,
      fullName: 'Test Collector',
      vehicleType: 'Lorry',
      capacityKg: 500,
      isAvailable: online,
      rating: 4.5,
      activeJobCount: 1,
      maxActiveJobs: 3,
    );

CollectionJob job(String id, JobStatus status, String address, {int hoursAgo = 1}) => CollectionJob(
      jobId: id,
      status: status,
      pickupAddress: address,
      requiredCapacityKg: 12,
      createdAt: DateTime.now().subtract(Duration(hours: hoursAgo)),
    );

class _SignedInCollector extends AuthController {
  @override
  AuthState build() => const AuthState.signedIn(
        AuthUser(userId: 'u1', email: 'c@test.lk', fullName: 'Test Collector', role: 'Collector'),
        'token',
      );
}

/// Records the calls the screens make, instead of sending them to the backend.
class _FakeCollectorApi extends CollectorApi {
  _FakeCollectorApi() : super(Dio());

  final availabilityCalls = <bool>[];
  int completeCalls = 0;

  @override
  Future<CollectorProfile> updateAvailability(String collectorId, bool isAvailable) async {
    availabilityCalls.add(isAvailable);
    return profile(online: isAvailable);
  }

  @override
  Future<CollectionJob> complete(String jobId, {required String photoUrl, required double measuredWeightKg, String? notes}) async {
    completeCalls++;
    return job(jobId, JobStatus.completed, '');
  }
}

Future<_FakeCollectorApi> _pumpJobList(
  WidgetTester tester, {
  required Stream<List<CollectionJob>> active,
  CollectorProfile? collector,
}) async {
  final api = _FakeCollectorApi();
  await tester.pumpWidget(ProviderScope(
    overrides: [
      authControllerProvider.overrideWith(_SignedInCollector.new),
      collectorApiProvider.overrideWithValue(api),
      // Always offline here, so the GPS tracker is never started in a test.
      collectorProfileProvider.overrideWith((ref) async => collector ?? profile()),
      myActiveJobsProvider.overrideWith((ref) => active),
      myCompletedJobsProvider.overrideWith((ref) => Stream.value(const <CollectionJob>[])),
      unreadNotificationsProvider.overrideWith((ref) => Stream.value(0)),
    ],
    child: const MaterialApp(home: Scaffold(body: JobListScreen())),
  ));
  await tester.pumpAndSettle();
  return api;
}

void main() {
  // ---------- JobListScreen ----------

  testWidgets('TC-FL-B-001: active jobs are listed with a collector-friendly status', (tester) async {
    await _pumpJobList(tester, active: Stream.value([
      job('j1', JobStatus.assigned, 'No 10, Galle Road, Colombo 03'),
      job('j2', JobStatus.inProgress, '25 Kandy Road, Kiribathgoda'),
    ]));

    expect(find.text('No 10, Galle Road, Colombo 03'), findsOneWidget);
    expect(find.text('25 Kandy Road, Kiribathgoda'), findsOneWidget);
    expect(find.text('New job'), findsOneWidget);
    expect(find.text('On the way'), findsOneWidget);
  });

  testWidgets('TC-FL-B-002: no active jobs shows the empty state', (tester) async {
    await _pumpJobList(tester, active: Stream.value(const <CollectionJob>[]));

    expect(find.text('No active jobs'), findsOneWidget);
  });

  testWidgets('TC-FL-B-003: a failed job request shows an error with a retry, not a crash', (tester) async {
    await _pumpJobList(tester, active: Stream.error(Exception('server down')));

    expect(find.text('Failed to load your jobs.'), findsOneWidget);
    expect(find.text('No active jobs'), findsNothing);
  });

  testWidgets('TC-FL-B-004: an offline collector is told they will not be matched', (tester) async {
    await _pumpJobList(tester, active: Stream.value(const <CollectionJob>[]), collector: profile(online: false));

    expect(find.text('Offline'), findsOneWidget);
    expect(find.textContaining("You're offline"), findsOneWidget);
  });

  testWidgets('TC-FL-B-005: the availability switch asks the API to go online', (tester) async {
    final api = await _pumpJobList(tester, active: Stream.value(const <CollectionJob>[]));

    await tester.tap(find.byType(Switch));
    await tester.pumpAndSettle();

    expect(api.availabilityCalls, [true]);
  });

  // ---------- CompleteJobSheet ----------

  testWidgets('TC-FL-B-006: a job cannot be completed without a photo', (tester) async {
    final api = _FakeCollectorApi();
    await tester.pumpWidget(ProviderScope(
      overrides: [collectorApiProvider.overrideWithValue(api)],
      child: const MaterialApp(home: Scaffold(body: CompleteJobSheet(jobId: 'j1'))),
    ));
    await tester.enterText(find.byType(TextField).first, '11.8');

    await tester.tap(find.text('Mark complete'));
    await tester.pumpAndSettle();

    expect(find.text('Add a photo of the collected items.'), findsOneWidget);
    expect(api.completeCalls, 0, reason: 'nothing is sent to the API');
  });

  // ---------- CollectorApi against a fake backend ----------

  test('TC-FL-B-007: active jobs = Assigned + Accepted + InProgress, newest first', () async {
    final now = DateTime.utc(2026, 10, 8, 12);
    Map<String, dynamic> j(String id, String status, int hoursAgo) => {
          'jobId': id,
          'status': status,
          'pickupAddress': id,
          'createdAt': now.subtract(Duration(hours: hoursAgo)).toIso8601String(),
        };
    final backend = _FakeBackend({
      'Assigned': [j('assigned-old', 'Assigned', 5)],
      'Accepted': [j('accepted-new', 'Accepted', 1)],
      'InProgress': [j('inprogress-mid', 'InProgress', 3)],
    });

    final jobs = await CollectorApi(backend.dio).myActiveJobs();

    expect(backend.requestedStatuses.toSet(), {'Assigned', 'Accepted', 'InProgress'});
    expect(jobs.map((e) => e.jobId), ['accepted-new', 'inprogress-mid', 'assigned-old']);
  });

  test('TC-FL-B-008: every backend job status maps to a known label', () {
    for (final status in JobStatus.values) {
      expect(JobStatus.fromApi(status.apiValue), status, reason: 'round-trips ${status.apiValue}');
      expect(jobStatusLabel(status), isNotEmpty);
    }
    expect(JobStatus.fromApi('SomethingNew'), isNull);
  });
}

/// A Dio whose adapter answers GET /api/v1/jobs/my?status=X from an in-memory map.
class _FakeBackend {
  _FakeBackend(this.jobsByStatus) {
    dio.httpClientAdapter = _Adapter(this);
  }

  final Map<String, List<Map<String, dynamic>>> jobsByStatus;
  final requestedStatuses = <String>[];
  final dio = Dio(BaseOptions(baseUrl: 'http://fake'));
}

class _Adapter implements HttpClientAdapter {
  _Adapter(this.backend);

  final _FakeBackend backend;

  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<Uint8List>? requestStream, Future<void>? cancelFuture) async {
    final status = options.queryParameters['status'] as String;
    backend.requestedStatuses.add(status);
    return ResponseBody.fromString(
      jsonEncode(backend.jobsByStatus[status] ?? []),
      200,
      headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
    );
  }

  @override
  void close({bool force = false}) {}
}
