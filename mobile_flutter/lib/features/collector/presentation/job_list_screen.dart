import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/glass_card.dart';
import '../application/collector_providers.dart';
import '../application/location_tracker.dart';
import '../data/collector_models.dart';

String jobStatusLabel(JobStatus status) => switch (status) {
      JobStatus.assigned => 'New job',
      JobStatus.accepted => 'Accepted',
      JobStatus.inProgress => 'On the way',
      JobStatus.rejected => 'Rejected',
      JobStatus.completed => 'Completed',
      JobStatus.cancelled => 'Cancelled',
      JobStatus.noCollectorAvailable => 'Unassigned',
      JobStatus.pickupLocationUnresolved => 'Address needs review',
    };

/// Home screen for Collectors: availability switch (drives location tracking) and a list of
/// Assigned/Accepted/InProgress jobs, polled every 30s by myActiveJobsProvider.
class JobListScreen extends ConsumerStatefulWidget {
  const JobListScreen({super.key});

  @override
  ConsumerState<JobListScreen> createState() => _JobListScreenState();
}

class _JobListScreenState extends ConsumerState<JobListScreen> {
  LocationTracker? _tracker;
  bool _togglingAvailability = false;

  @override
  void dispose() {
    _tracker?.stop();
    super.dispose();
  }

  void _syncTracker(CollectorProfile? profile) {
    if (profile == null) return;
    _tracker ??= LocationTracker(ref.read(collectorApiProvider), profile.collectorId);
    if (profile.isAvailable) {
      _tracker!.start();
    } else {
      _tracker!.stop();
    }
  }

  Future<void> _toggleAvailability(CollectorProfile profile) async {
    setState(() => _togglingAvailability = true);
    try {
      await ref.read(collectorApiProvider).updateAvailability(profile.collectorId, !profile.isAvailable);
      ref.invalidate(collectorProfileProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(apiErrorMessage(e, 'Could not update availability.'))));
      }
    } finally {
      if (mounted) setState(() => _togglingAvailability = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(collectorProfileProvider);
    profileAsync.whenData(_syncTracker);
    final profile = profileAsync.value;

    final jobsAsync = ref.watch(myActiveJobsProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('My Jobs'),
        actions: [
          if (profile != null)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(profile.isAvailable ? 'Online' : 'Offline', style: AppText.small),
                  Switch(
                    value: profile.isAvailable,
                    onChanged: _togglingAvailability ? null : (_) => _toggleAvailability(profile),
                    activeThumbColor: AppColors.mint600,
                  ),
                ],
              ),
            ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
            icon: const Icon(LucideIcons.logOut),
          ),
        ],
      ),
      body: Stack(
        children: [
          const AppBackground(),
          SafeArea(
            child: RefreshIndicator(
              color: AppColors.mint600,
              onRefresh: () => ref.refresh(myActiveJobsProvider.future),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
                physics: const AlwaysScrollableScrollPhysics(),
                children: [
                  if (profile != null && !profile.isAvailable)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Notice(
                        tone: NoticeTone.info,
                        message: "You're offline — switch on to be matched with new jobs.",
                      ),
                    ),
                  switch (jobsAsync) {
                    AsyncData(:final value) when value.isEmpty => const EmptyState(
                        icon: LucideIcons.packageCheck,
                        title: 'No active jobs',
                        description: 'New jobs will appear here once you\'re matched.',
                      ),
                    AsyncData(:final value) =>
                      Column(children: [for (final j in value) ...[_JobCard(j), const SizedBox(height: 12)]]),
                    AsyncError(:final error) => ErrorMessage(
                        message: apiErrorMessage(error, 'Failed to load your jobs.'),
                        onRetry: () => ref.invalidate(myActiveJobsProvider),
                      ),
                    _ => const LoadingState(),
                  },
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _JobCard extends StatelessWidget {
  const _JobCard(this.job);

  final CollectionJob job;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      onTap: () => context.push('/collector/jobs/${job.jobId}'),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(LucideIcons.mapPin, size: 14, color: AppColors.mint600),
                    const SizedBox(width: 6),
                    Expanded(child: Text(job.pickupAddress, style: AppText.strong, maxLines: 2, overflow: TextOverflow.ellipsis)),
                  ],
                ),
                const SizedBox(height: 6),
                if (job.estimatedDistanceKm != null || job.estimatedEtaMinutes != null)
                  Text(
                    [
                      if (job.estimatedDistanceKm != null) '${job.estimatedDistanceKm!.toStringAsFixed(1)} km',
                      if (job.estimatedEtaMinutes != null) '~${job.estimatedEtaMinutes} min',
                    ].join(' · '),
                    style: AppText.small,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              _StatusChip(job.status),
              const SizedBox(height: 4),
              const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.ink600),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip(this.status);

  final JobStatus status;

  @override
  Widget build(BuildContext context) {
    final color = status == JobStatus.assigned ? AppColors.amber900 : AppColors.mint700;
    final background = status == JobStatus.assigned ? AppColors.amber50 : AppColors.mint50;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Text(jobStatusLabel(status), style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w700)),
    );
  }
}
