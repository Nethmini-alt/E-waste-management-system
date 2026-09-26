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

/// Weigh in one completed job (the web JobReceiveForm). Pops with the new inventory item id when
/// the user taps "Open item", or null.
class ReceiveJobSheet extends ConsumerStatefulWidget {
  const ReceiveJobSheet({super.key, required this.job});

  final ReceivableJob job;

  @override
  ConsumerState<ReceiveJobSheet> createState() => _ReceiveJobSheetState();
}

class _ReceiveJobSheetState extends ConsumerState<ReceiveJobSheet> {
  late final _weight = TextEditingController(
    text: widget.job.reportedWeightKg == null ? '' : widget.job.reportedWeightKg!.toString(),
  );
  // Pre-select the customer's category when it is on the list; otherwise staff must choose.
  late String? _itemType = widget.job.suggestedItemType;
  String? _locationId;
  bool _submitting = false;
  bool _submitted = false;
  String? _error;
  ReceiveJobResult? _result;

  @override
  void dispose() {
    _weight.dispose();
    super.dispose();
  }

  List<String> get _problems => [
        if (_itemType == null) 'Choose what the collected waste is (item type).',
        if (!((parseDecimal(_weight.text) ?? 0) > 0)) 'Enter the verified weight (greater than 0).',
        if (_locationId == null) 'Choose the warehouse location.',
      ];

  Future<void> _submit() async {
    setState(() => _submitted = true);
    if (_problems.isNotEmpty) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      // The job's own collector is sent; the server verifies it and rejects anything else.
      final result = await ref.read(warehouseApiProvider).receiveJob(
            jobId: widget.job.jobId,
            collectorId: widget.job.collectorId,
            warehouseLocationId: _locationId!,
            verifiedWeightKg: parseDecimal(_weight.text)!,
            itemType: _itemType!,
          );
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Failed to receive the job.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result != null) return _success(result);

    final job = widget.job;
    final locations = ref.watch(warehouseLocationsProvider);
    final itemTypes = ref.watch(itemTypesProvider);

    // Default the destination to the receiving bay once the locations arrive.
    if (_locationId == null && locations.value != null && locations.value!.isNotEmpty) {
      final all = locations.value!;
      _locationId = (all.where((l) => l.name.toLowerCase().contains('receiv')).firstOrNull ?? all.first).id;
    }

    final verified = parseDecimal(_weight.text);
    final reported = job.reportedWeightKg;
    final diff = verified != null && reported != null ? verified - reported : null;

    return AppSheet(
      title: 'Verify and receive',
      subtitle: job.collectorLabel,
      busy: _submitting,
      footer: [
        AppButton.secondary(label: 'Cancel', onPressed: _submitting ? null : () => Navigator.pop(context)),
        AppButton(label: _submitting ? 'Receiving…' : 'Receive into inventory', loading: _submitting, onPressed: _submit),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Tile(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(job.pickupAddress.isEmpty ? 'No address recorded' : job.pickupAddress, style: AppText.strong),
                const SizedBox(height: 2),
                Text('Collector: ${job.collectorLabel}', style: AppText.small),
                const SizedBox(height: 2),
                const Text("The payment always goes to the job's own collector.", style: TextStyle(fontSize: 11, color: AppColors.ink600)),
              ],
            ),
          ),
          const SizedBox(height: 16),
          LabeledField(
            label: 'Item type',
            help: job.submissionCategory != null && job.suggestedItemType == null
                ? "The customer's category “${job.submissionCategory}” isn't a known item type — choose the closest match."
                : null,
            helpColor: AppColors.amber700,
            child: switch (itemTypes) {
              AsyncError(:final error) => ErrorMessage(
                  message: apiErrorMessage(error, 'Failed to load item types.'),
                  onRetry: () => ref.invalidate(itemTypesProvider),
                ),
              _ => AppDropdown<String>(
                  value: _itemType,
                  hint: itemTypes.isLoading ? 'Loading…' : 'Choose what was collected…',
                  enabled: itemTypes.hasValue,
                  items: [for (final t in itemTypes.value ?? const <String>[]) DropdownMenuItem(value: t, child: Text(t))],
                  onChanged: (v) => setState(() => _itemType = v),
                ),
            },
          ),
          const SizedBox(height: 16),
          LabeledField(
            label: 'Verified weight',
            help: reported == null ? null : 'Collector reported ${Format.kg(reported)}. The difference is recorded on the item.',
            child: DecimalField(controller: _weight, hint: 'Weighed at the warehouse', onChanged: (_) => setState(() {})),
          ),
          if (diff != null) ...[
            const SizedBox(height: 8),
            Align(
              alignment: Alignment.centerLeft,
              child: _DiffChip(diff: diff),
            ),
          ],
          const SizedBox(height: 16),
          LabeledField(
            label: 'Warehouse location',
            child: switch (locations) {
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
          ),
          if (_submitted && _problems.isNotEmpty) ...[const SizedBox(height: 16), ProblemList(problems: _problems)],
          if (_error != null) ...[const SizedBox(height: 16), ErrorMessage(message: _error!)],
        ],
      ),
    );
  }

  Widget _success(ReceiveJobResult result) {
    final diff = result.discrepancyKg;
    final matches = diff != null && diff.abs() < 0.005;
    return AppSheet(
      title: 'Job received into inventory',
      footer: [
        AppButton.secondary(label: 'Done', onPressed: () => Navigator.pop(context)),
        AppButton(label: 'Open item', icon: LucideIcons.arrowRight, onPressed: () => Navigator.pop(context, result.inventoryItemId)),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Notice(
            tone: NoticeTone.success,
            message: 'A new ${result.itemType} inventory item was created and a pending payment was raised for the job\'s collector.',
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: _Figure(label: 'Verified', value: Format.kg(result.verifiedWeightKg))),
              const SizedBox(width: 8),
              Expanded(
                child: _Figure(
                  label: 'Reported',
                  value: result.reportedWeightKg == null ? '—' : Format.kg(result.reportedWeightKg!),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _Figure(
                  label: 'Discrepancy',
                  value: diff == null ? 'n/a' : (matches ? 'None' : Format.signedKg(diff)),
                  tint: diff == null ? null : (matches ? AppColors.mint50 : AppColors.amber50),
                ),
              ),
            ],
          ),
        ],
      ),
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
        matches ? 'Matches the reported weight' : 'Difference ${Format.signedKg(diff)}',
        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: matches ? AppColors.mint800 : AppColors.amber800),
      ),
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value, this.tint});

  final String label;
  final String value;
  final Color? tint;

  @override
  Widget build(BuildContext context) {
    return Tile(
      color: tint,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: AppText.label.copyWith(fontSize: 10)),
          const SizedBox(height: 4),
          Text(value, style: AppText.display(15)),
        ],
      ),
    );
  }
}
