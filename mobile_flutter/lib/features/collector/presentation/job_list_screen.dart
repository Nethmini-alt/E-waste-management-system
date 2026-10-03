import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/format.dart';
import '../../../core/widgets/app_shell.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/layout.dart';
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

/// Home screen for Collectors: availability switch (drives location tracking), vehicle capacity
/// left, the Assigned/Accepted/InProgress jobs and the completed ones — both lists polled every 30s.
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
    final completedAsync = ref.watch(myCompletedJobsProvider);
    final completed = completedAsync.value;

    return ShellPage(
      onRefresh: () async {
        ref.invalidate(collectorProfileProvider);
        ref.invalidate(myCompletedJobsProvider);
        final _ = await ref.refresh(myActiveJobsProvider.future);
      },
      children: [
        PageHeader(
          title: 'My Jobs',
          subtitle: 'Hi ${ref.watch(authControllerProvider).user?.firstName ?? ''} · Collection',
          icon: LucideIcons.truck,
          actions: [
            if (profile != null)
              Row(
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
          ],
        ),
        if (profile != null && !profile.isAvailable)
          const Padding(
            padding: EdgeInsets.only(bottom: 12),
            child: Notice(
              tone: NoticeTone.info,
              message: "You're offline — switch on to be matched with new jobs.",
            ),
          ),
        if (profile != null && completed != null) ...[
          _CapacityCard(profile: profile, completed: completed),
          const SizedBox(height: 20),
        ],
        Text('ACTIVE JOBS', style: AppText.label),
        const SizedBox(height: 8),
        switch (jobsAsync) {
          AsyncData(:final value) when value.isEmpty => const EmptyState(
              icon: LucideIcons.packageCheck,
              title: 'No active jobs',
              description: 'New jobs will appear here once you\'re matched.',
            ),
          AsyncData(:final value) => Column(children: [
              for (final j in value) ...[_JobCard(j), const SizedBox(height: 12)]
            ]),
          AsyncError(:final error) => ErrorMessage(
              message: apiErrorMessage(error, 'Failed to load your jobs.'),
              onRetry: () => ref.invalidate(myActiveJobsProvider),
            ),
          _ => const LoadingState(),
        },
        const SizedBox(height: 24),
        Text('COMPLETED', style: AppText.label),
        const SizedBox(height: 8),
        switch (completedAsync) {
          AsyncData(:final value) when value.isEmpty =>
            Text('Jobs you complete will be listed here.', style: AppText.small),
          AsyncData(:final value) => _CompletedList(value),
          AsyncError(:final error) => ErrorMessage(
              message: apiErrorMessage(error, 'Failed to load your completed jobs.'),
              onRetry: () => ref.invalidate(myCompletedJobsProvider),
            ),
          _ => const LoadingState(),
        },
      ],
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
                    Expanded(
                        child: Text(job.pickupAddress,
                            style: AppText.strong, maxLines: 2, overflow: TextOverflow.ellipsis)),
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

/// Free space in the vehicle. Completed jobs stay on board until the warehouse receives them,
/// so their measured weight counts against the capacity until then.
class _CapacityCard extends StatelessWidget {
  const _CapacityCard({required this.profile, required this.completed});

  final CollectorProfile profile;
  final List<CollectionJob> completed;

  @override
  Widget build(BuildContext context) {
    final onBoard = completed.where((j) => !j.receivedAtWarehouse).toList();
    final loadKg = onBoard.fold<double>(0, (sum, j) => sum + (j.measuredWeightKg ?? 0));
    final capacityKg = profile.capacityKg;
    final leftKg = (capacityKg - loadKg).clamp(0, capacityKg).toDouble();
    final usedShare = capacityKg > 0 ? (loadKg / capacityKg).clamp(0.0, 1.0) : 0.0;
    final nearlyFull = usedShare >= 0.8;
    final barColor = nearlyFull ? AppColors.amber500 : AppColors.mint600;

    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(LucideIcons.truck, size: 16, color: AppColors.mint600),
              const SizedBox(width: 8),
              Expanded(
                child: Text(profile.vehicleType.isEmpty ? 'Your vehicle' : profile.vehicleType, style: AppText.strong),
              ),
              Text('${Format.kg(capacityKg)} capacity', style: AppText.small),
            ],
          ),
          const SizedBox(height: 12),
          Text('${Format.kg(leftKg)} free',
              style: AppText.display(22, color: nearlyFull ? AppColors.amber900 : AppColors.ink900)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: usedShare,
              minHeight: 8,
              backgroundColor: AppColors.mint100,
              valueColor: AlwaysStoppedAnimation(barColor),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            onBoard.isEmpty
                ? 'Nothing on board — everything you collected has been received at the warehouse.'
                : '${Format.kg(loadKg)} on board from ${onBoard.length} completed job${onBoard.length == 1 ? '' : 's'}. '
                    'It frees up once the warehouse receives them.',
            style: AppText.small,
          ),
        ],
      ),
    );
  }
}

/// Jobs still in the vehicle first, then the most recent deliveries.
class _CompletedList extends StatelessWidget {
  const _CompletedList(this.jobs);

  final List<CollectionJob> jobs;

  static const _recentDelivered = 10;

  @override
  Widget build(BuildContext context) {
    final onBoard = jobs.where((j) => !j.receivedAtWarehouse);
    final delivered = jobs.where((j) => j.receivedAtWarehouse).take(_recentDelivered);
    return Column(
      children: [
        for (final j in [...onBoard, ...delivered]) ...[_CompletedJobCard(j), const SizedBox(height: 10)],
      ],
    );
  }
}

class _CompletedJobCard extends StatelessWidget {
  const _CompletedJobCard(this.job);

  final CollectionJob job;

  static final _when = DateFormat('MMM d, h:mm a');

  @override
  Widget build(BuildContext context) {
    final delivered = job.receivedAtWarehouse;
    return GlassCard(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      onTap: () => context.push('/collector/jobs/${job.jobId}'),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(job.pickupAddress, style: AppText.strong, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(
                  [
                    if (job.measuredWeightKg != null) Format.kg(job.measuredWeightKg!),
                    if (job.completedAt != null) 'Completed ${_when.format(job.completedAt!)}',
                  ].join(' · '),
                  style: AppText.small,
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: delivered ? AppColors.mint50 : AppColors.amber50,
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              delivered ? 'Delivered' : 'On board',
              style: TextStyle(
                color: delivered ? AppColors.mint700 : AppColors.amber900,
                fontSize: 11,
                fontWeight: FontWeight.w700,
              ),
            ),
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
