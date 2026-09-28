import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/layout.dart';
import '../application/submissions_providers.dart';
import '../data/submission_models.dart';
import 'widgets/submission_status_badge.dart';

/// GET /api/v1/submissions/mine, pull-to-refresh — status, category, address, and any
/// rejection/failure reason, same fields as the web app's MySubmissionsPage.
class MySubmissionsScreen extends ConsumerWidget {
  const MySubmissionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final submissions = ref.watch(mySubmissionsProvider);

    return RefreshIndicator(
      color: AppColors.mint600,
      onRefresh: () => ref.refresh(mySubmissionsProvider.future),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          const PageHeader(title: 'My submissions', subtitle: 'Track the items you\'ve submitted for collection.', icon: LucideIcons.packageSearch),
          switch (submissions) {
            AsyncData(:final value) when value.isEmpty => const EmptyState(
                icon: LucideIcons.packageSearch,
                title: 'No submissions yet',
                description: 'Items you submit will show up here.',
              ),
            AsyncData(:final value) => Column(children: [for (final s in value) ...[_SubmissionCard(s), const SizedBox(height: 12)]]),
            AsyncError(:final error) => ErrorMessage(
                message: apiErrorMessage(error, 'Failed to load your submissions.'),
                onRetry: () => ref.invalidate(mySubmissionsProvider),
              ),
            _ => const LoadingState(),
          },
        ],
      ),
    );
  }
}

class _SubmissionCard extends StatelessWidget {
  const _SubmissionCard(this.submission);

  final SubmissionResponse submission;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: Text(submission.category, style: AppText.strong)),
              SubmissionStatusBadge(status: submission.status, label: submission.statusLabel),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(LucideIcons.mapPin, size: 13, color: AppColors.ink600),
              const SizedBox(width: 4),
              Expanded(child: Text(submission.pickupAddress, style: AppText.small)),
            ],
          ),
          const SizedBox(height: 2),
          Text(
            '${submission.items.length} item${submission.items.length == 1 ? '' : 's'} · Submitted ${Format.date(submission.createdAt.toIso8601String())}',
            style: const TextStyle(fontSize: 11, color: AppColors.ink600),
          ),
          if (submission.statusReason != null) ...[
            const SizedBox(height: 8),
            Text(submission.statusReason!, style: const TextStyle(fontSize: 12, color: AppColors.red600)),
          ],
          if (submission.jobId != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(LucideIcons.truck, size: 13, color: AppColors.ink600),
                const SizedBox(width: 4),
                Text('Job #${Format.shortId(submission.jobId)} — ${submission.jobStatus}', style: AppText.small),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
