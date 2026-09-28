import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_client.dart';
import '../data/collector_api.dart';
import '../data/collector_models.dart';

final collectorApiProvider = Provider<CollectorApi>((ref) => CollectorApi(ref.watch(dioProvider)));

void _resetOnUserChange(Ref ref) => ref.watch(authControllerProvider.select((s) => s.user?.userId));

/// null means the signed-in collector has no profile yet (GET /me returned 404) — the router's
/// profile gate uses this to decide whether to show the setup screen.
final collectorProfileProvider = FutureProvider<CollectorProfile?>((ref) {
  _resetOnUserChange(ref);
  return ref.watch(collectorApiProvider).me();
});

/// Assigned + Accepted + InProgress jobs, re-fetched every 30 seconds while this provider has a
/// listener (i.e. while the job list screen is on screen) — autoDispose stops the polling loop
/// as soon as it doesn't.
final myActiveJobsProvider = StreamProvider.autoDispose<List<CollectionJob>>((ref) async* {
  final api = ref.watch(collectorApiProvider);
  while (true) {
    yield await api.myActiveJobs();
    await Future<void>.delayed(const Duration(seconds: 30));
  }
});
