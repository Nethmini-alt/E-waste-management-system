import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/glass_card.dart';
import '../application/collector_providers.dart';
import '../data/collector_models.dart';
import 'complete_job_sheet.dart';
import 'job_list_screen.dart' show jobStatusLabel;

final _jobDetailProvider = FutureProvider.autoDispose.family<CollectionJob, String>(
  (ref, jobId) => ref.watch(collectorApiProvider).getById(jobId),
);

/// Accept/reject a new job, navigate then start an accepted one, or complete an in-progress one.
class JobDetailScreen extends ConsumerStatefulWidget {
  const JobDetailScreen({super.key, required this.jobId});

  final String jobId;

  @override
  ConsumerState<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends ConsumerState<JobDetailScreen> {
  bool _busy = false;

  void _refresh() {
    ref.invalidate(_jobDetailProvider(widget.jobId));
    ref.invalidate(myActiveJobsProvider);
  }

  Future<void> _run(Future<void> Function() action) async {
    setState(() => _busy = true);
    try {
      await action();
      _refresh();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorMessage(e, 'That didn\'t work. Please try again.'))));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _accept() => _run(() => ref.read(collectorApiProvider).accept(widget.jobId));

  Future<void> _reject() async {
    final reason = await showDialog<String>(
      context: context,
      builder: (context) => _RejectDialog(),
    );
    if (reason == null) return; // dialog cancelled
    await _run(() => ref.read(collectorApiProvider).reject(widget.jobId, reason: reason.isEmpty ? null : reason));
  }

  Future<void> _navigateAndStart(CollectionJob job) async {
    if (job.pickupLatitude != null && job.pickupLongitude != null) {
      final uri = Uri.parse(
        'https://www.google.com/maps/dir/?api=1&destination=${job.pickupLatitude},${job.pickupLongitude}&travelmode=driving',
      );
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
    await _run(() => ref.read(collectorApiProvider).start(widget.jobId));
  }

  Future<void> _openCompleteSheet() async {
    final done = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => CompleteJobSheet(jobId: widget.jobId),
    );
    if (done == true) {
      _refresh();
      if (mounted) context.pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final jobAsync = ref.watch(_jobDetailProvider(widget.jobId));

    return Scaffold(
      appBar: AppBar(backgroundColor: Colors.transparent, elevation: 0, title: const Text('Job details')),
      body: Stack(
        children: [
          const AppBackground(),
          SafeArea(
            child: switch (jobAsync) {
              AsyncData(:final value) => _JobBody(job: value, busy: _busy, onAccept: _accept, onReject: _reject, onNavigate: _navigateAndStart, onComplete: _openCompleteSheet),
              AsyncError(:final error) => Padding(
                  padding: const EdgeInsets.all(16),
                  child: ErrorMessage(message: apiErrorMessage(error, 'Failed to load this job.'), onRetry: _refresh),
                ),
              _ => const LoadingState(),
            },
          ),
        ],
      ),
    );
  }
}

class _JobBody extends StatelessWidget {
  const _JobBody({required this.job, required this.busy, required this.onAccept, required this.onReject, required this.onNavigate, required this.onComplete});

  final CollectionJob job;
  final bool busy;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final void Function(CollectionJob) onNavigate;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
      children: [
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  const Icon(LucideIcons.mapPin, size: 16, color: AppColors.mint600),
                  const SizedBox(width: 8),
                  Expanded(child: Text(job.pickupAddress, style: AppText.display(16))),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 16,
                runSpacing: 6,
                children: [
                  if (job.requiredCapacityKg != null) _Fact(LucideIcons.weight, '${job.requiredCapacityKg} kg'),
                  if (job.estimatedDistanceKm != null) _Fact(LucideIcons.route, '${job.estimatedDistanceKm!.toStringAsFixed(1)} km'),
                  if (job.estimatedEtaMinutes != null) _Fact(LucideIcons.clock, '~${job.estimatedEtaMinutes} min'),
                ],
              ),
              const SizedBox(height: 6),
              Text('Status: ${jobStatusLabel(job.status)}', style: AppText.small),
            ],
          ),
        ),
        const SizedBox(height: 20),
        switch (job.status) {
          JobStatus.assigned => Row(
              children: [
                Expanded(child: AppButton(label: 'Accept', icon: LucideIcons.check, loading: busy, onPressed: onAccept)),
                const SizedBox(width: 12),
                Expanded(child: AppButton.danger(label: 'Reject', icon: LucideIcons.x, loading: busy, onPressed: onReject)),
              ],
            ),
          JobStatus.accepted => AppButton(
              label: 'Navigate',
              icon: LucideIcons.navigation,
              expand: true,
              loading: busy,
              onPressed: () => onNavigate(job),
            ),
          JobStatus.inProgress => AppButton(
              label: 'Complete job',
              icon: LucideIcons.packageCheck,
              expand: true,
              loading: busy,
              onPressed: onComplete,
            ),
          _ => const SizedBox.shrink(),
        },
      ],
    );
  }
}

class _Fact extends StatelessWidget {
  const _Fact(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [Icon(icon, size: 13, color: AppColors.ink600), const SizedBox(width: 4), Text(text, style: AppText.small)],
    );
  }
}

class _RejectDialog extends StatefulWidget {
  @override
  State<_RejectDialog> createState() => _RejectDialogState();
}

class _RejectDialogState extends State<_RejectDialog> {
  final _reason = TextEditingController();

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Reject this job?'),
      content: TextField(
        controller: _reason,
        decoration: const InputDecoration(hintText: 'Reason (optional)'),
        maxLines: 2,
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(
          onPressed: () => Navigator.of(context).pop(_reason.text.trim()),
          style: FilledButton.styleFrom(backgroundColor: AppColors.red600),
          child: const Text('Reject'),
        ),
      ],
    );
  }
}
