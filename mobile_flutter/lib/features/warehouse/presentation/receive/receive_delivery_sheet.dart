import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/format.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/app_sheet.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../core/widgets/form_fields.dart';
import '../../../../core/widgets/glass_card.dart';
import '../../../../core/widgets/layout.dart';
import '../../application/warehouse_providers.dart';
import '../../data/warehouse_models.dart';

/// A collector's delivery (the web JobReceiveForm): tick the jobs they brought, check each weight,
/// save them together. Every job still becomes its own inventory item and payment. Pops with an
/// inventory item id when the worker taps one on the success screen, or null.
class ReceiveDeliverySheet extends ConsumerStatefulWidget {
  const ReceiveDeliverySheet({super.key, required this.collectorName, required this.jobs});

  final String collectorName;

  /// The collector's completed jobs that are waiting to be received (all the same collector).
  final List<ReceivableJob> jobs;

  @override
  ConsumerState<ReceiveDeliverySheet> createState() => _ReceiveDeliverySheetState();
}

class _JobEntry {
  _JobEntry(ReceivableJob job, {required this.selected})
      : weight = TextEditingController(text: job.reportedWeightKg?.toString() ?? ''),
        itemType = job.suggestedItemType;

  bool selected;
  final TextEditingController weight;
  String? itemType;
}

class _ReceiveDeliverySheetState extends ConsumerState<ReceiveDeliverySheet> {
  // A collector with a single job almost always brought it, so it starts ticked.
  late final Map<String, _JobEntry> _entries = {
    for (final j in widget.jobs) j.jobId: _JobEntry(j, selected: widget.jobs.length == 1),
  };
  String? _locationId;
  bool _submitting = false;
  bool _submitted = false;
  String? _error;
  DeliveryResult? _result;

  @override
  void dispose() {
    for (final e in _entries.values) {
      e.weight.dispose();
    }
    super.dispose();
  }

  List<ReceivableJob> get _selected => widget.jobs.where((j) => _entries[j.jobId]!.selected).toList();

  List<String> get _problems {
    final selected = _selected;
    return [
      if (selected.isEmpty) 'Tick at least one job the collector brought.',
      for (final (i, j) in selected.indexed) ...[
        if (_entries[j.jobId]!.itemType == null) 'Job ${i + 1}: choose what it is.',
        if (!((parseDecimal(_entries[j.jobId]!.weight.text) ?? 0) > 0)) 'Job ${i + 1}: enter the weight.',
      ],
      if (_locationId == null) 'Choose where to put it.',
    ];
  }

  Future<void> _submit() async {
    setState(() => _submitted = true);
    if (_problems.isNotEmpty) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await ref.read(warehouseApiProvider).receiveDelivery(
            collectorId: widget.jobs.first.collectorId,
            warehouseLocationId: _locationId!,
            jobs: [
              for (final j in _selected)
                DeliveryJobInput(
                  jobId: j.jobId,
                  verifiedWeightKg: parseDecimal(_entries[j.jobId]!.weight.text)!,
                  itemType: _entries[j.jobId]!.itemType!,
                ),
            ],
          );
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'The delivery could not be saved. Nothing was received.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _setAll(bool selected) => setState(() {
        for (final e in _entries.values) {
          e.selected = selected;
        }
      });

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result != null) return _success(result);

    final locations = ref.watch(warehouseLocationsProvider);
    final itemTypes = ref.watch(itemTypesProvider);

    // Default the destination to the receiving bay once the locations arrive.
    if (_locationId == null && locations.value != null && locations.value!.isNotEmpty) {
      final all = locations.value!;
      _locationId = (all.where((l) => l.name.toLowerCase().contains('receiv')).firstOrNull ?? all.first).id;
    }

    final count = _selected.length;
    final allTicked = count == widget.jobs.length;

    return AppSheet(
      title: 'Receive from ${widget.collectorName}',
      subtitle: widget.jobs.length == 1 ? 'Check the weight, then save.' : 'Tick the jobs they brought and check each weight.',
      busy: _submitting,
      footer: [
        AppButton.secondary(label: 'Cancel', onPressed: _submitting ? null : () => Navigator.pop(context)),
        AppButton(
          label: _submitting
              ? 'Saving…'
              : count <= 1
                  ? 'Receive job'
                  : 'Receive $count jobs',
          icon: LucideIcons.check,
          loading: _submitting,
          onPressed: count == 0 ? null : _submit,
        ),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (widget.jobs.length > 1)
            Row(
              children: [
                Expanded(child: _StepLabel(number: 1, text: 'Which jobs did they bring?')),
                TextButton(
                  onPressed: () => _setAll(!allTicked),
                  child: Text(allTicked ? 'Untick all' : 'Tick all',
                      style: const TextStyle(color: AppColors.mint700, fontWeight: FontWeight.w600)),
                ),
              ],
            )
          else
            const _StepLabel(number: 1, text: 'Check the job'),
          const SizedBox(height: 8),
          for (final job in widget.jobs)
            _JobEntryCard(
              job: job,
              entry: _entries[job.jobId]!,
              itemTypes: itemTypes,
              onChanged: () => setState(() {}),
              onRetryItemTypes: () => ref.invalidate(itemTypesProvider),
            ),
          const SizedBox(height: 12),
          const _StepLabel(number: 2, text: 'Where are you putting it?'),
          const SizedBox(height: 8),
          switch (locations) {
            AsyncError(:final error) => ErrorMessage(
                message: apiErrorMessage(error, 'Failed to load locations.'),
                onRetry: () => ref.invalidate(warehouseLocationsProvider),
              ),
            _ => AppDropdown<String>(
                value: _locationId,
                hint: 'Loading…',
                enabled: locations.hasValue,
                items: [
                  for (final l in locations.value ?? const <WarehouseLocation>[]) DropdownMenuItem(value: l.id, child: Text(l.name)),
                ],
                onChanged: (v) => setState(() => _locationId = v),
              ),
          },
          if (_submitted && _problems.isNotEmpty) ...[const SizedBox(height: 16), ProblemList(problems: _problems)],
          if (_error != null) ...[const SizedBox(height: 16), ErrorMessage(message: _error!)],
        ],
      ),
    );
  }

  Widget _success(DeliveryResult result) {
    final n = result.jobs.length;
    return AppSheet(
      title: 'Received',
      footer: [AppButton(label: 'Done', expand: true, onPressed: () => Navigator.pop(context))],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 4),
          Center(
            child: Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(color: AppColors.mint100, shape: BoxShape.circle),
              child: const Icon(LucideIcons.check, size: 32, color: AppColors.mint700),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '$n job${n == 1 ? '' : 's'} received from ${widget.collectorName}',
            textAlign: TextAlign.center,
            style: AppText.display(17),
          ),
          const SizedBox(height: 4),
          const Text('Each one is now in inventory. Tap one to open it.', textAlign: TextAlign.center, style: AppText.small),
          const SizedBox(height: 16),
          for (final j in result.jobs)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Tile(
                onTap: () => Navigator.pop(context, j.inventoryItemId),
                child: Row(
                  children: [
                    const Icon(LucideIcons.package, size: 18, color: AppColors.mint700),
                    const SizedBox(width: 10),
                    Expanded(child: Text(j.itemType, style: AppText.strong)),
                    Text(Format.kg(j.verifiedWeightKg), style: AppText.strong),
                    const SizedBox(width: 6),
                    const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.ink600),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          Tile(
            color: AppColors.amber50,
            child: Row(
              children: [
                const Icon(LucideIcons.wallet, size: 18, color: AppColors.amber800),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Payment ${Format.money(result.totalPendingAmount)}',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.amber900)),
                      const SizedBox(height: 2),
                      const Text('The office pays the collector. You don\'t need to do anything.',
                          style: TextStyle(fontSize: 12, color: AppColors.amber800)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// "1  Which jobs did they bring?" — numbered steps so the form reads top to bottom.
class _StepLabel extends StatelessWidget {
  const _StepLabel({required this.number, required this.text});

  final int number;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: const BoxDecoration(color: AppColors.mint600, shape: BoxShape.circle),
          child: Text('$number', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white)),
        ),
        const SizedBox(width: 10),
        Flexible(child: Text(text, style: AppText.display(15))),
      ],
    );
  }
}

/// One job: tap to tick it; once ticked, its item type and weight appear underneath.
class _JobEntryCard extends StatelessWidget {
  const _JobEntryCard({
    required this.job,
    required this.entry,
    required this.itemTypes,
    required this.onChanged,
    required this.onRetryItemTypes,
  });

  final ReceivableJob job;
  final _JobEntry entry;
  final AsyncValue<List<String>> itemTypes;
  final VoidCallback onChanged;
  final VoidCallback onRetryItemTypes;

  @override
  Widget build(BuildContext context) {
    final selected = entry.selected;
    final verified = parseDecimal(entry.weight.text);
    final reported = job.reportedWeightKg;
    final diff = verified != null && reported != null ? verified - reported : null;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        decoration: BoxDecoration(
          color: selected ? Colors.white : AppColors.tileFill,
          borderRadius: BorderRadius.circular(AppRadius.tile),
          border: Border.all(color: selected ? AppColors.mint400 : AppColors.mint100, width: selected ? 1.5 : 1),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Material(
              type: MaterialType.transparency,
              child: InkWell(
                borderRadius: BorderRadius.circular(AppRadius.tile),
                onTap: () {
                  entry.selected = !selected;
                  onChanged();
                },
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Row(
                    children: [
                      _Tick(selected: selected),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              job.pickupAddress.isEmpty ? 'No address recorded' : job.pickupAddress,
                              style: AppText.strong,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              [
                                if (job.submissionCategory != null) job.submissionCategory!,
                                'Collector said ${reported == null ? 'no weight' : Format.kg(reported)}',
                              ].join(' · '),
                              style: AppText.small,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 180),
              alignment: Alignment.topCenter,
              child: !selected
                  ? const SizedBox(width: double.infinity)
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(14, 0, 14, 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          LabeledField(
                            label: 'What is it?',
                            help: job.submissionCategory != null && job.suggestedItemType == null
                                ? 'The customer wrote “${job.submissionCategory}”. Pick the closest match.'
                                : null,
                            helpColor: AppColors.amber700,
                            child: switch (itemTypes) {
                              AsyncError(:final error) => ErrorMessage(
                                  message: apiErrorMessage(error, 'Failed to load item types.'),
                                  onRetry: onRetryItemTypes,
                                ),
                              _ => AppDropdown<String>(
                                  value: entry.itemType,
                                  hint: itemTypes.isLoading ? 'Loading…' : 'Choose…',
                                  enabled: itemTypes.hasValue,
                                  items: [
                                    for (final t in itemTypes.value ?? const <String>[]) DropdownMenuItem(value: t, child: Text(t)),
                                  ],
                                  onChanged: (v) {
                                    entry.itemType = v;
                                    onChanged();
                                  },
                                ),
                            },
                          ),
                          const SizedBox(height: 12),
                          LabeledField(
                            label: 'Weight on the scale',
                            child: DecimalField(controller: entry.weight, hint: 'Weigh it here', onChanged: (_) => onChanged()),
                          ),
                          if (diff != null) ...[
                            const SizedBox(height: 8),
                            Align(alignment: Alignment.centerLeft, child: _DiffChip(diff: diff)),
                          ],
                        ],
                      ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Tick extends StatelessWidget {
  const _Tick({required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: selected ? AppColors.mint600 : Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: selected ? AppColors.mint600 : AppColors.ink100, width: 2),
      ),
      child: selected ? const Icon(LucideIcons.check, size: 16, color: Colors.white) : null,
    );
  }
}

class _DiffChip extends StatelessWidget {
  const _DiffChip({required this.diff});

  final double diff;

  @override
  Widget build(BuildContext context) {
    final matches = diff.abs() < 0.005;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: matches ? AppColors.mint50 : AppColors.amber50,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        matches ? 'Same as the collector said' : '${Format.signedKg(diff)} from what the collector said',
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: matches ? AppColors.mint800 : AppColors.amber800),
      ),
    );
  }
}
