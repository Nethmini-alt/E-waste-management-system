import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/submission_models.dart';
import '../data/submissions_api.dart';

final submissionsApiProvider = Provider<SubmissionsApi>((ref) => SubmissionsApi(ref.watch(dioProvider)));

/// The signed-in generator's own submissions (GET /mine). autoDispose + refresh() on
/// pull-to-refresh, same pattern as the warehouse feature's list providers.
final mySubmissionsProvider = FutureProvider.autoDispose<List<SubmissionResponse>>(
  (ref) => ref.watch(submissionsApiProvider).mine(),
);
