import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:uuid/uuid.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/format.dart';
import '../../../../core/widgets/app_button.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../core/widgets/form_fields.dart';
import '../../../../core/widgets/glass_card.dart';
import '../../../../core/widgets/layout.dart';
import '../../application/warehouse_providers.dart';
import '../../data/processing_enums.dart';
import '../../data/warehouse_models.dart';

class _Line {
  String? itemType;
  final weight = TextEditingController();
  bool accepted = true;
  final reason = TextEditingController();

  void dispose() {
    weight.dispose();
    reason.dispose();
  }
}

/// Extra-waste receipt (the web ExtraWasteReceiveForm): waste a collector brings without a job.
/// Every line is accepted or rejected; accepted lines become inventory items and are paid at their
/// item type's active rate. Only active rate-policy types can be accepted.
class ExtraWasteForm extends ConsumerStatefulWidget {
  const ExtraWasteForm({super.key});

  @override
  ConsumerState<ExtraWasteForm> createState() => _ExtraWasteFormState();
}

class _ExtraWasteFormState extends ConsumerState<ExtraWasteForm> {
  String? _collectorId;
  String? _locationId;
  final _notes = TextEditingController();
  final List<_Line> _lines = [_Line()];

  // One key per receipt: resending after a timeout returns the original receipt instead of
  // creating (and paying for) a second one.
  String _idempotencyKey = const Uuid().v4();

  bool _submitting = false;
  bool _submitted = false;
  String? _error;
  ExtraWasteReceiptResult? _result;

  @override
  void dispose() {
    _notes.dispose();
    for (final l in _lines) {
      l.dispose();
    }
    super.dispose();
  }

  RatePolicy? _rateFor(List<RatePolicy> rates, String? type) =>
      type == null ? null : rates.where((r) => r.itemType.toLowerCase() == type.toLowerCase()).firstOrNull;

  /// Mirrors ReceiveExtraWasteRequestValidator + the "accepted items need an active rate" rule.
  List<String> _problems(List<RatePolicy> rates) {
    final out = <String>[];
    if (_collectorId == null) out.add('Choose the collector.');
    if (_locationId == null) out.add('Choose the warehouse location.');
    if (_notes.text.length > Limits.notes) out.add('Notes must be ${Limits.notes} characters or fewer.');
    for (var i = 0; i < _lines.length; i++) {
      final l = _lines[i];
      final n = i + 1;
      if (l.itemType == null) {
        out.add('Item $n: choose an item type.');
      } else if (l.accepted && _rateFor(rates, l.itemType) == null) {
        out.add('Item $n: “${l.itemType}” has no active rate policy, so it cannot be accepted.');
      }
      if (!((parseDecimal(l.weight.text) ?? 0) > 0)) out.add('Item $n: weight must be greater than 0.');
      if (!l.accepted) {
        if (l.reason.text.trim().isEmpty) {
          out.add('Item $n: give a reason for rejecting it.');
        } else if (l.reason.text.length > Limits.rejectionReason) {
          out.add('Item $n: rejection reason must be ${Limits.rejectionReason} characters or fewer.');
        }
      }
    }
    return out;
  }

  Future<void> _submit(List<RatePolicy> rates) async {
    setState(() => _submitted = true);
    if (_problems(rates).isNotEmpty) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await ref.read(warehouseApiProvider).receiveExtraWaste(
            collectorId: _collectorId!,
            warehouseLocationId: _locationId!,
            notes: _notes.text,
            idempotencyKey: _idempotencyKey,
            lines: [
              for (final l in _lines)
                ExtraWasteLineInput(
                  itemType: l.itemType!,
                  weightKg: parseDecimal(l.weight.text)!,
                  accepted: l.accepted,
                  rejectionReason: l.reason.text,
                ),
            ],
          );
      ref.invalidate(warehouseSummaryProvider);
      if (mounted) setState(() => _result = result);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Failed to record the receipt.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _startNew() {
    setState(() {
      _result = null;
      _collectorId = null;
      _notes.clear();
      for (final l in _lines) {
        l.dispose();
      }
      _lines
        ..clear()
        ..add(_Line());
      _submitted = false;
      _error = null;
      _idempotencyKey = const Uuid().v4();
    });
  }

  @override
  Widget build(BuildContext context) {
    final result = _result;
    if (result != null) return _success(result);

    final locations = ref.watch(warehouseLocationsProvider);
    final collectors = ref.watch(collectorsProvider);
    final ratesAsync = ref.watch(extraWasteRatesProvider);
    final rates = ratesAsync.value ?? const <RatePolicy>[];

    if (_locationId == null && locations.value != null && locations.value!.isNotEmpty) {
      final all = locations.value!;
      _locationId = (all.where((l) => l.name.toLowerCase().contains('receiv')).firstOrNull ?? all.first).id;
    }

    final estimatedPayment = _lines.fold<double>(0, (sum, l) {
      final rate = l.accepted ? _rateFor(rates, l.itemType) : null;
      final w = parseDecimal(l.weight.text) ?? 0;
      return rate != null && w > 0 ? sum + w * rate.ratePerKg : sum;
    });
    final acceptedCount = _lines.where((l) => l.accepted).length;
    final problems = _problems(rates);

    final loadError = [locations, collectors, ratesAsync].where((a) => a.hasError).firstOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (loadError != null) ...[
          ErrorMessage(
            message: apiErrorMessage(loadError.error!, 'Failed to load reference data.'),
            onRetry: () {
              ref.invalidate(warehouseLocationsProvider);
              ref.invalidate(collectorsProvider);
              ref.invalidate(extraWasteRatesProvider);
            },
          ),
          const SizedBox(height: 12),
        ],
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SectionTitle('1 · Who and where', icon: LucideIcons.user),
              LabeledField(
                label: 'Collector',
                child: AppDropdown<String>(
                  value: _collectorId,
                  hint: collectors.isLoading ? 'Loading…' : 'Choose the collector…',
                  enabled: collectors.hasValue,
                  items: [
                    for (final c in collectors.value ?? const <CollectorLookup>[])
                      DropdownMenuItem(
                        value: c.collectorId,
                        child: Text(c.vehicleType.isEmpty ? c.fullName : '${c.fullName} · ${c.vehicleType}'),
                      ),
                  ],
                  onChanged: (v) => setState(() => _collectorId = v),
                ),
              ),
              const SizedBox(height: 14),
              LabeledField(
                label: 'Warehouse location',
                child: AppDropdown<String>(
                  value: _locationId,
                  hint: 'Loading…',
                  enabled: locations.hasValue,
                  items: [
                    for (final l in locations.value ?? const <WarehouseLocation>[]) DropdownMenuItem(value: l.id, child: Text(l.name)),
                  ],
                  onChanged: (v) => setState(() => _locationId = v),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SectionTitle(
                '2 · Items brought in',
                icon: LucideIcons.packagePlus,
                trailing: TextButton.icon(
                  onPressed: () => setState(() => _lines.add(_Line())),
                  icon: const Icon(LucideIcons.plus, size: 14, color: AppColors.mint700),
                  label: const Text('Add item', style: TextStyle(color: AppColors.mint700, fontWeight: FontWeight.w600)),
                ),
              ),
              for (var i = 0; i < _lines.length; i++) _lineEditor(i, rates, ratesAsync.isLoading),
              const SizedBox(height: 4),
              Tile(
                color: AppColors.mint50,
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        '$acceptedCount of ${_lines.length} accepted',
                        style: const TextStyle(fontSize: 13, color: AppColors.ink800),
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text('ESTIMATED PAYMENT', style: AppText.label.copyWith(fontSize: 9.5)),
                        Text(Format.money(estimatedPayment), style: AppText.display(16, color: AppColors.mint800)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 14),
        GlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              LabeledField(
                label: 'Notes (optional)',
                child: TextField(
                  controller: _notes,
                  minLines: 2,
                  maxLines: 4,
                  maxLength: Limits.notes,
                  decoration: const InputDecoration(hintText: 'Anything worth recording on the receipt…'),
                ),
              ),
              if (_submitted && problems.isNotEmpty) ...[
                const SizedBox(height: 8),
                ProblemList(problems: problems, title: 'Please fix the following'),
              ],
              if (_error != null) ...[const SizedBox(height: 8), ErrorMessage(message: _error!)],
              const SizedBox(height: 12),
              AppButton(
                label: _submitting ? 'Recording…' : 'Record receipt',
                icon: LucideIcons.check,
                loading: _submitting,
                expand: true,
                onPressed: () => _submit(rates),
              ),
            ],
          ),
        ),
      ],
    );
  }

  void _removeLine(int index) {
    final removed = _lines[index];
    setState(() => _lines.removeAt(index));
    // Its text fields are still on screen until this frame finishes, so dispose afterwards.
    WidgetsBinding.instance.addPostFrameCallback((_) => removed.dispose());
  }

  Widget _lineEditor(int index, List<RatePolicy> rates, bool ratesLoading) {
    final line = _lines[index];
    final rate = _rateFor(rates, line.itemType);
    return Padding(
      key: ObjectKey(line),
      padding: const EdgeInsets.only(bottom: 10),
      child: Tile(
        color: line.accepted ? null : AppColors.red50,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Text('ITEM ${index + 1}', style: AppText.label.copyWith(fontWeight: FontWeight.w700)),
                const Spacer(),
                Text(line.accepted ? 'Accepted' : 'Rejected',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: line.accepted ? AppColors.mint700 : AppColors.red700)),
                Switch(value: line.accepted, onChanged: (v) => setState(() => line.accepted = v)),
                if (_lines.length > 1)
                  IconButton(
                    tooltip: 'Remove item ${index + 1}',
                    onPressed: () => _removeLine(index),
                    icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.red600),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: AppDropdown<String>(
                    value: line.itemType,
                    hint: ratesLoading ? 'Loading…' : 'Item type…',
                    enabled: rates.isNotEmpty,
                    items: [for (final r in rates) DropdownMenuItem(value: r.itemType, child: Text(r.itemType))],
                    onChanged: (v) => setState(() => line.itemType = v),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 2,
                  child: DecimalField(controller: line.weight, hint: '0.00', onChanged: (_) => setState(() {})),
                ),
              ],
            ),
            if (line.accepted && rate != null) ...[
              const SizedBox(height: 6),
              Text('${Format.money(rate.ratePerKg)} per kg', style: const TextStyle(fontSize: 12, color: AppColors.ink600)),
            ],
            if (!line.accepted) ...[
              const SizedBox(height: 8),
              TextField(
                controller: line.reason,
                maxLength: Limits.rejectionReason,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(hintText: 'Why is this item rejected?', counterText: ''),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _success(ExtraWasteReceiptResult result) {
    final accepted = result.items.where((i) => i.accepted).toList();
    final rejected = result.items.where((i) => !i.accepted).toList();
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(color: AppColors.mint100, borderRadius: BorderRadius.circular(AppRadius.tile)),
                child: const Icon(LucideIcons.circleCheck, color: AppColors.mint700),
              ),
              const SizedBox(width: 12),
              Expanded(child: Text('Receipt recorded', style: AppText.display(18))),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            accepted.isEmpty
                ? 'Every item was rejected, so no inventory items or payment were created.'
                : '${accepted.length} item${accepted.length == 1 ? '' : 's'} added to inventory and a pending payment was raised for the collector.',
            style: AppText.body,
          ),
          const SizedBox(height: 12),
          for (final item in accepted)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Tile(
                onTap: item.inventoryItemId == null ? null : () => context.go('/warehouse/inventory/${item.inventoryItemId}'),
                child: Row(
                  children: [
                    const Icon(LucideIcons.circleCheck, size: 16, color: AppColors.mint600),
                    const SizedBox(width: 8),
                    Expanded(child: Text(item.itemType, style: AppText.strong)),
                    const Text('Open', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.mint700)),
                    const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.mint700),
                  ],
                ),
              ),
            ),
          for (final item in rejected)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Tile(
                color: AppColors.red50,
                child: Row(
                  children: [
                    const Icon(LucideIcons.circleX, size: 16, color: AppColors.red600),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text('${item.itemType} — rejected${item.rejectionReason == null ? '' : ': ${item.rejectionReason}'}',
                          style: const TextStyle(fontSize: 13, color: AppColors.red800)),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: 8),
          AppButton(label: 'Record another receipt', icon: LucideIcons.plus, expand: true, onPressed: _startNew),
        ],
      ),
    );
  }
}
