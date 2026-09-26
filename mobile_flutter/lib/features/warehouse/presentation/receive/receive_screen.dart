import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/format.dart';
import '../../../../core/widgets/app_sheet.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../core/widgets/glass_card.dart';
import '../../../../core/widgets/layout.dart';
import '../../application/warehouse_providers.dart';
import '../../data/warehouse_models.dart';
import '../warehouse_shell.dart';
import 'extra_waste_form.dart';
import 'receive_job_sheet.dart';

enum ReceiveTab { job, extra }

/// Receive waste at the dock: a completed job, or an extra-waste drop-off — kept separate, each
/// with its own receipt and payment, exactly like the web Receive page.
class ReceiveScreen extends StatefulWidget {
  const ReceiveScreen({super.key, this.initialTab = ReceiveTab.job});

  final ReceiveTab initialTab;

  @override
  State<ReceiveScreen> createState() => _ReceiveScreenState();
}

class _ReceiveScreenState extends State<ReceiveScreen> {
  late ReceiveTab _tab = widget.initialTab;

  @override
  void didUpdateWidget(covariant ReceiveScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialTab != widget.initialTab) _tab = widget.initialTab;
  }

  @override
  Widget build(BuildContext context) {
    return switch (_tab) {
      ReceiveTab.job => _JobCollectionTab(header: _header()),
      ReceiveTab.extra => WarehousePage(children: [_header(), const ExtraWasteForm()]),
    };
  }

  Widget _header() => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const PageHeader(
            title: 'Receive waste',
            subtitle: 'Weigh in completed jobs and extra-waste drop-offs.',
            icon: LucideIcons.packagePlus,
          ),
          PillTabs<ReceiveTab>(
            value: _tab,
            options: const {ReceiveTab.job: 'Job collection', ReceiveTab.extra: 'Extra waste'},
            onChanged: (t) => setState(() => _tab = t),
          ),
          const SizedBox(height: 16),
        ],
      );
}

/// The web app's pill tab list (`rounded-full px-4 py-2`, selected = mint-600).
class PillTabs<T> extends StatelessWidget {
  const PillTabs({super.key, required this.value, required this.options, required this.onChanged});

  final T value;
  final Map<T, String> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(6),
      radius: 999,
      child: Row(
        children: [
          for (final entry in options.entries)
            Expanded(
              child: Semantics(
                selected: entry.key == value,
                button: true,
                child: InkWell(
                  onTap: () => onChanged(entry.key),
                  borderRadius: BorderRadius.circular(999),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 180),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: entry.key == value ? AppColors.mint600 : Colors.transparent,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: entry.key == value
                          ? const [BoxShadow(color: Color(0x4D10B981), blurRadius: 10, offset: Offset(0, 4))]
                          : null,
                    ),
                    child: Text(
                      entry.value,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: entry.key == value ? Colors.white : AppColors.ink800,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _JobCollectionTab extends ConsumerWidget {
  const _JobCollectionTab({required this.header});

  final Widget header;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(receivableJobsProvider);

    return WarehousePage(
      onRefresh: () => ref.refresh(receivableJobsProvider.future),
      children: [
        header,
        switch (jobs) {
          AsyncData(:final value) when value.isEmpty => const GlassCard(
              child: EmptyState(
                icon: LucideIcons.truck,
                title: 'No jobs waiting to be received',
                description: 'When a collector completes a pickup it appears here until it has been received into inventory.',
              ),
            ),
          AsyncData(:final value) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 4, bottom: 8),
                  child: Text('${value.length} completed job${value.length == 1 ? '' : 's'} · tap one to weigh it in',
                      style: const TextStyle(fontSize: 12, color: AppColors.ink600)),
                ),
                for (final job in value) _JobCard(job: job),
              ],
            ),
          AsyncError(:final error) => ErrorMessage(
              message: apiErrorMessage(error, 'Failed to load the jobs waiting to be received.'),
              onRetry: () => ref.invalidate(receivableJobsProvider),
            ),
          _ => const GlassCard(child: LoadingState(label: 'Loading jobs…')),
        },
      ],
    );
  }
}

class _JobCard extends ConsumerWidget {
  const _JobCard({required this.job});

  final ReceivableJob job;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: const EdgeInsets.all(16),
        onTap: () async {
          final itemId = await showAppSheet<String>(context, builder: (_) => ReceiveJobSheet(job: job));
          ref.invalidate(receivableJobsProvider);
          ref.invalidate(warehouseSummaryProvider);
          if (itemId != null && context.mounted) context.go('/warehouse/inventory/$itemId');
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Icon(LucideIcons.mapPin, size: 15, color: AppColors.mint600),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    job.pickupAddress.isEmpty ? 'No address recorded' : job.pickupAddress,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.ink900),
                  ),
                ),
                Text(Format.shortId(job.jobId), style: const TextStyle(fontFamily: 'monospace', fontSize: 11, color: AppColors.ink600)),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 14,
              runSpacing: 4,
              children: [
                _Meta(LucideIcons.truck, job.collectorLabel),
                if (job.submissionCategory != null) _Meta(LucideIcons.tag, job.submissionCategory!),
                _Meta(LucideIcons.scale, 'Reported ${job.reportedWeightKg == null ? 'n/a' : Format.kg(job.reportedWeightKg!)}'),
                if (job.estimatedDistanceKm != null) _Meta(LucideIcons.route, '${job.estimatedDistanceKm} km'),
                _Meta(LucideIcons.clock, Format.dateTime(job.completedAt)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Meta extends StatelessWidget {
  const _Meta(this.icon, this.text);

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: AppColors.ink600),
        const SizedBox(width: 4),
        Text(text, style: const TextStyle(fontSize: 12, color: AppColors.ink600)),
      ],
    );
  }
}
