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
import '../../data/processing_enums.dart';
import '../../data/warehouse_models.dart';

// Every sheet pops with a success message (String) or null. The item screen shows the message and
// reloads. Each one mirrors the web modal of the same name, including its rules and wording.

// =============================================================================== status change

class _TransitionCopy {
  const _TransitionCopy(this.title, this.description, this.confirm, {this.warning, this.danger = false});

  final String title;
  final String description;
  final String confirm;
  final String? warning;
  final bool danger;
}

const _transitionCopy = {
  InventoryStatus.sorting: _TransitionCopy(
    'Start sorting',
    'Moves the item from Received into Sorting so it can be dismantled or classified.',
    'Start sorting',
  ),
  InventoryStatus.readyForSale: _TransitionCopy(
    'Mark ready for sale',
    'Hands the classified item over for sale.',
    'Mark ready for sale',
    warning: 'Ready for sale is final — the status cannot be changed afterwards (the location still can).',
  ),
  InventoryStatus.exportOnly: _TransitionCopy(
    'Reserve for export',
    'Reserves the export-grade item for export channels only.',
    'Reserve for export',
    warning: 'Reserved for export is final — the status cannot be changed afterwards (the location still can).',
  ),
  InventoryStatus.onHold: _TransitionCopy(
    'Put item on hold',
    'Quarantines the item so it cannot be sold or exported.',
    'Put on hold',
    warning: 'On hold is final — there is no way to release the item afterwards from this system.',
    danger: true,
  ),
};

/// Button text for each manual status change (TRANSITION_BUTTON_LABELS on the web).
String transitionButtonLabel(InventoryStatus next) => _transitionCopy[next]?.confirm ?? 'Move to ${next.label}';

class TransitionSheet extends ConsumerStatefulWidget {
  const TransitionSheet({super.key, required this.item, required this.next});

  final InventoryDetail item;
  final InventoryStatus next;

  @override
  ConsumerState<TransitionSheet> createState() => _TransitionSheetState();
}

class _TransitionSheetState extends ConsumerState<TransitionSheet> {
  final _notes = TextEditingController();
  String? _locationId;
  bool _locationChosen = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_notes.text.length > Limits.notes) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(warehouseApiProvider).transition(widget.item.id, widget.next, notes: _notes.text, newLocationId: _locationId);
      if (mounted) Navigator.pop(context, 'Status changed to “${widget.next.label}”.');
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Failed to change the status.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final copy = _transitionCopy[widget.next] ??
        _TransitionCopy('Move to ${widget.next.label}', '', 'Confirm');
    final locations = ref.watch(warehouseLocationsProvider).value ?? const <WarehouseLocation>[];

    // Pre-select the area this status belongs in (e.g. On hold → Hazardous Hold Area); staff can change it.
    if (!_locationChosen && locations.isNotEmpty) {
      _locationChosen = true;
      final name = widget.next.suggestedLocationName?.toLowerCase();
      final suggested = locations.where((l) => l.name.toLowerCase() == name).firstOrNull;
      _locationId = suggested != null && suggested.id != item.currentLocationId ? suggested.id : null;
    }

    return AppSheet(
      title: copy.title,
      subtitle: '${item.itemType} · currently ${item.status.label}',
      busy: _submitting,
      footer: [
        AppButton.secondary(label: 'Cancel', onPressed: _submitting ? null : () => Navigator.pop(context)),
        AppButton(
          label: _submitting ? 'Saving…' : copy.confirm,
          variant: copy.danger ? AppButtonVariant.danger : AppButtonVariant.primary,
          loading: _submitting,
          onPressed: _submit,
        ),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (copy.description.isNotEmpty) ...[Text(copy.description, style: AppText.body), const SizedBox(height: 12)],
          if (copy.warning != null) ...[
            Notice(tone: copy.danger ? NoticeTone.error : NoticeTone.warning, message: copy.warning),
            const SizedBox(height: 16),
          ],
          LabeledField(
            label: 'Notes (optional)',
            child: TextField(
              controller: _notes,
              minLines: 3,
              maxLines: 5,
              maxLength: Limits.notes,
              decoration: const InputDecoration(hintText: "Anything worth recording in the item's history…"),
            ),
          ),
          const SizedBox(height: 8),
          LabeledField(
            label: 'Move to location (optional)',
            child: AppDropdown<String?>(
              value: _locationId,
              items: [
                DropdownMenuItem<String?>(value: null, child: Text('Keep current location (${item.currentLocationName})')),
                for (final l in locations.where((l) => l.id != item.currentLocationId))
                  DropdownMenuItem<String?>(value: l.id, child: Text(l.name)),
              ],
              onChanged: (v) => setState(() => _locationId = v),
            ),
          ),
          if (_error != null) ...[const SizedBox(height: 16), ErrorMessage(message: _error!)],
        ],
      ),
    );
  }
}

// =============================================================================== move location

class MoveLocationSheet extends ConsumerStatefulWidget {
  const MoveLocationSheet({super.key, required this.item});

  final InventoryDetail item;

  @override
  ConsumerState<MoveLocationSheet> createState() => _MoveLocationSheetState();
}

class _MoveLocationSheetState extends ConsumerState<MoveLocationSheet> {
  String? _locationId;
  bool _submitting = false;
  String? _error;

  Future<void> _submit(List<WarehouseLocation> locations) async {
    final target = locations.where((l) => l.id == _locationId).firstOrNull;
    if (target == null) {
      setState(() => _error = 'Choose the new location.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await ref.read(warehouseApiProvider).moveLocation(widget.item.id, target.id);
      if (mounted) Navigator.pop(context, 'Moved to ${target.name}.');
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Failed to move the item.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final locations = ref.watch(warehouseLocationsProvider).value ?? const <WarehouseLocation>[];
    final others = locations.where((l) => l.id != widget.item.currentLocationId).toList();
    return AppSheet(
      title: 'Move location',
      subtitle: '${widget.item.itemType} · now in ${widget.item.currentLocationName}',
      busy: _submitting,
      footer: [
        AppButton.secondary(label: 'Cancel', onPressed: _submitting ? null : () => Navigator.pop(context)),
        AppButton(label: _submitting ? 'Moving…' : 'Move item', loading: _submitting, onPressed: () => _submit(locations)),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Every move is recorded in the item history. The location can change in any status.', style: AppText.body),
          const SizedBox(height: 16),
          for (final l in others)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Tile(
                color: _locationId == l.id ? AppColors.mint50 : null,
                onTap: () => setState(() => _locationId = l.id),
                child: Row(
                  children: [
                    Icon(
                      _locationId == l.id ? LucideIcons.circleCheck : LucideIcons.mapPin,
                      size: 18,
                      color: _locationId == l.id ? AppColors.mint600 : AppColors.ink600,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(l.name, style: AppText.strong),
                          if (l.description != null) Text(l.description!, style: AppText.small),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (_error != null) ...[const SizedBox(height: 8), ErrorMessage(message: _error!)],
        ],
      ),
    );
  }
}

// =============================================================================== dismantle

class _Component {
  String? itemType;
  final weight = TextEditingController();
}

class DismantleSheet extends ConsumerStatefulWidget {
  const DismantleSheet({super.key, required this.item});

  final InventoryDetail item;

  @override
  ConsumerState<DismantleSheet> createState() => _DismantleSheetState();
}

class _DismantleSheetState extends ConsumerState<DismantleSheet> {
  final _description = TextEditingController();
  final _remaining = TextEditingController();
  final List<_Component> _components = [];
  bool _submitting = false;
  bool _submitted = false;
  String? _error;

  @override
  void dispose() {
    _description.dispose();
    _remaining.dispose();
    for (final c in _components) {
      c.weight.dispose();
    }
    super.dispose();
  }

  // Weight is conserved, exactly as the backend enforces it: components + remainder ≤ current weight.
  // With no remainder entered the components are taken off the item automatically.
  double get _current => widget.item.verifiedWeightKg;
  double get _componentsTotal =>
      _components.fold(0, (sum, c) => sum + ((parseDecimal(c.weight.text) ?? 0) > 0 ? parseDecimal(c.weight.text)! : 0));
  double? get _remainingEntered => parseDecimal(_remaining.text);
  double get _newWeight => _remainingEntered ?? _current - _componentsTotal;
  double get _loss => _current - _componentsTotal - _newWeight;
  // Small tolerance so float noise never blocks a valid entry.
  bool get _overweight => _componentsTotal > _current + 0.0005 || _componentsTotal + _newWeight > _current + 0.0005;

  List<String> get _problems => [
        if (_description.text.trim().isEmpty) 'Describe what was done in this step.',
        for (var i = 0; i < _components.length; i++) ...[
          if (_components[i].itemType == null) 'Component ${i + 1}: choose an item type.',
          if (!((parseDecimal(_components[i].weight.text) ?? 0) > 0)) 'Component ${i + 1}: weight must be greater than 0.',
        ],
        if (_overweight) "Components plus the remaining weight can't be more than this item's current ${Format.kg(_current)}.",
      ];

  Future<void> _submit() async {
    setState(() => _submitted = true);
    if (_problems.isNotEmpty) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await ref.read(warehouseApiProvider).addDismantleLog(
            widget.item.id,
            description: _description.text,
            remainingWeightKg: _remainingEntered,
            components: [for (final c in _components) (itemType: c.itemType!, weightKg: parseDecimal(c.weight.text)!)],
          );
      final created = result.childIds.length;
      final loss = result.lossKg > 0 ? ' ${Format.kg(result.lossKg)} recorded as loss.' : '';
      if (mounted) {
        Navigator.pop(
          context,
          created > 0
              ? 'Dismantle step logged — $created component${created == 1 ? '' : 's'} created.$loss'
              : 'Dismantle step logged.$loss',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Failed to log the dismantle step.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final itemTypes = ref.watch(itemTypesProvider);
    final showPreview = _components.isNotEmpty || _remainingEntered != null;

    return AppSheet(
      title: 'Add dismantle step',
      subtitle: '${item.itemType} · ${item.status.label} · ${Format.kg(item.verifiedWeightKg)}',
      busy: _submitting,
      footer: [
        AppButton.secondary(label: 'Cancel', onPressed: _submitting ? null : () => Navigator.pop(context)),
        AppButton(label: _submitting ? 'Saving…' : 'Log step', loading: _submitting, onPressed: _submit),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (item.status == InventoryStatus.sorting) ...[
            const Notice(tone: NoticeTone.info, message: 'The first dismantle step also moves this item from Sorting to Dismantling.'),
            const SizedBox(height: 16),
          ],
          LabeledField(
            label: 'What was done',
            child: TextField(
              controller: _description,
              minLines: 2,
              maxLines: 4,
              maxLength: Limits.notes,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(hintText: 'e.g. Removed the battery pack and separated the mainboard.'),
            ),
          ),
          const SizedBox(height: 8),
          LabeledField(
            label: 'Remaining weight of this item (optional)',
            help: 'Leave blank to subtract the components automatically. If entered, any difference is recorded as loss (dust, screws, scrap).',
            child: DecimalField(
              controller: _remaining,
              hint: 'Currently ${Format.kg(_current)}',
              decimals: 3,
              onChanged: (_) => setState(() {}),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(child: Text('COMPONENTS CREATED (OPTIONAL)', style: AppText.label)),
              TextButton.icon(
                onPressed: () => setState(() => _components.add(_Component())),
                icon: const Icon(LucideIcons.plus, size: 14, color: AppColors.mint700),
                label: const Text('Add component', style: TextStyle(color: AppColors.mint700, fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          if (itemTypes.hasError)
            ErrorMessage(message: apiErrorMessage(itemTypes.error!, 'Failed to load item types.'), onRetry: () => ref.invalidate(itemTypesProvider)),
          if (_components.isEmpty)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(AppRadius.input),
                border: Border.all(color: AppColors.mint200),
              ),
              child: const Text(
                "No components added. Add one for each part that should be tracked as its own inventory item — it inherits this item's origin and location.",
                style: AppText.small,
              ),
            ),
          for (var i = 0; i < _components.length; i++)
            Padding(
              key: ObjectKey(_components[i]),
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 3,
                    child: AppDropdown<String>(
                      value: _components[i].itemType,
                      hint: itemTypes.isLoading ? 'Loading…' : 'Component ${i + 1} type…',
                      enabled: itemTypes.hasValue,
                      items: [for (final t in itemTypes.value ?? const <String>[]) DropdownMenuItem(value: t, child: Text(t))],
                      onChanged: (v) => setState(() => _components[i].itemType = v),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: DecimalField(controller: _components[i].weight, hint: 'kg', decimals: 3, onChanged: (_) => setState(() {})),
                  ),
                  IconButton(
                    tooltip: 'Remove component ${i + 1}',
                    onPressed: () {
                      final removed = _components[i];
                      setState(() => _components.removeAt(i));
                      WidgetsBinding.instance.addPostFrameCallback((_) => removed.weight.dispose());
                    },
                    icon: const Icon(LucideIcons.trash2, size: 16, color: AppColors.red600),
                  ),
                ],
              ),
            ),
          if (showPreview) ...[
            const SizedBox(height: 8),
            Notice(
              tone: _overweight ? NoticeTone.error : NoticeTone.info,
              message: _overweight
                  ? 'Components (${Format.kg(_componentsTotal)}) plus the remaining weight (${Format.kg(_newWeight < 0 ? 0 : _newWeight)}) are more than this item\'s current ${Format.kg(_current)}.'
                  : 'This item will go from ${Format.kg(_current)} to ${Format.kg(_newWeight)}; components ${Format.kg(_componentsTotal)}${_loss > 0.0005 ? '; loss ${Format.kg(_loss)}' : ''}.',
            ),
          ],
          if (_submitted && _problems.isNotEmpty) ...[
            const SizedBox(height: 12),
            ProblemList(problems: _problems, title: 'Please fix the following'),
          ],
          if (_error != null) ...[const SizedBox(height: 12), ErrorMessage(message: _error!)],
        ],
      ),
    );
  }
}

// =============================================================================== classify

/// Classify an item. Like the web ClassifyModal, the choice must pass the (side-effect free)
/// validation check first, and flagged results need an explicit acknowledgement.
class ClassifySheet extends ConsumerStatefulWidget {
  const ClassifySheet({super.key, required this.item});

  final InventoryDetail item;

  @override
  ConsumerState<ClassifySheet> createState() => _ClassifySheetState();
}

class _ClassifySheetState extends ConsumerState<ClassifySheet> {
  ClassificationCategory? _category;
  final _subCategory = TextEditingController();
  final _confidence = TextEditingController();
  ClassificationSource _source = ClassificationSource.manual;
  bool _isFinal = true;

  ClassificationValidation? _validation;
  String? _validatedKey;
  bool _ack = false;
  bool _validating = false;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _subCategory.dispose();
    _confidence.dispose();
    super.dispose();
  }

  // What the validate endpoint sees. If any of it changes after validating, the result is stale.
  String get _inputKey => '${_category?.apiName}|${_subCategory.text.trim()}|${_confidence.text.trim()}';
  bool get _validationIsCurrent => _validation != null && _validatedKey == _inputKey;
  double? get _confidenceValue => parseDecimal(_confidence.text);

  String? get _inputProblem {
    if (_subCategory.text.length > Limits.subCategory) return 'Sub-category must be ${Limits.subCategory} characters or fewer.';
    final c = _confidenceValue;
    if (_confidence.text.trim().isNotEmpty && (c == null || c < 0 || c > 1)) return 'Confidence must be between 0 and 1.';
    return null;
  }

  bool get _isHazardous => _category == ClassificationCategory.hazardous;
  bool get _needsAck => _validationIsCurrent && (_validation!.requiresHumanReview || _isHazardous);
  bool get _canValidate => _category != null && _inputProblem == null && !_validating && !_submitting;
  bool get _canConfirm => _validationIsCurrent && _validation!.approved && (!_needsAck || _ack) && !_submitting;

  Future<void> _validate() async {
    if (!_canValidate) return;
    final key = _inputKey;
    setState(() {
      _validating = true;
      _error = null;
      _ack = false;
    });
    try {
      final result = await ref.read(warehouseApiProvider).validateClassification(
            widget.item.id,
            category: _category!,
            subCategory: _subCategory.text,
            confidenceScore: _confidenceValue,
          );
      if (mounted) {
        setState(() {
          _validation = result;
          _validatedKey = key;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _validation = null;
          _validatedKey = null;
          _error = apiErrorMessage(e, 'Validation failed.');
        });
      }
    } finally {
      if (mounted) setState(() => _validating = false);
    }
  }

  Future<void> _confirm() async {
    if (!_canConfirm) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      final result = await ref.read(warehouseApiProvider).classify(
            widget.item.id,
            category: _category!,
            subCategory: _subCategory.text,
            source: _source,
            confidenceScore: _confidenceValue,
            isFinal: _isFinal,
          );
      final label = result.category?.label ?? _category!.label;
      if (mounted) {
        Navigator.pop(
          context,
          result.status == InventoryStatus.onHold
              ? 'Classified as $label — the item was automatically moved to On hold.'
              : 'Classified as $label.',
        );
      }
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Failed to classify the item.'));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final validation = _validation;
    final stale = validation != null && !_validationIsCurrent;

    return AppSheet(
      title: 'Classify item',
      subtitle: '${item.itemType} · ${item.status.label}',
      busy: _submitting || _validating,
      footer: [
        AppButton.secondary(
          label: _validating ? 'Checking…' : 'Validate',
          icon: LucideIcons.shieldCheck,
          loading: _validating,
          onPressed: _canValidate ? _validate : null,
        ),
        AppButton(
          label: _submitting ? 'Saving…' : 'Classify',
          icon: LucideIcons.tag,
          loading: _submitting,
          onPressed: _canConfirm ? _confirm : null,
        ),
      ],
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('CATEGORY', style: AppText.label),
          const SizedBox(height: 6),
          for (final c in ClassificationCategory.values)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Tile(
                color: _category == c ? (c == ClassificationCategory.hazardous ? AppColors.red50 : AppColors.mint50) : null,
                onTap: () => setState(() => _category = c),
                child: Row(
                  children: [
                    Icon(
                      _category == c ? LucideIcons.circleCheck : LucideIcons.circle,
                      size: 18,
                      color: _category == c
                          ? (c == ClassificationCategory.hazardous ? AppColors.red600 : AppColors.mint600)
                          : AppColors.ink600,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.label, style: AppText.strong),
                          Text(c.help, style: AppText.small),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          if (_isHazardous) ...[
            const Notice(
              tone: NoticeTone.error,
              title: 'Hazardous items are quarantined automatically',
              message: 'Classifying this item as Hazardous also puts it On hold straight away. On hold is final.',
            ),
            const SizedBox(height: 12),
          ],
          const SizedBox(height: 4),
          LabeledField(
            label: 'Sub-category (optional)',
            child: TextField(
              controller: _subCategory,
              maxLength: Limits.subCategory,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(hintText: 'e.g. Copper wiring', counterText: ''),
            ),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: LabeledField(
                  label: 'Source',
                  child: AppDropdown<ClassificationSource>(
                    value: _source,
                    items: [for (final s in ClassificationSource.values) DropdownMenuItem(value: s, child: Text(s.label))],
                    onChanged: (v) => setState(() => _source = v ?? ClassificationSource.manual),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: LabeledField(
                  label: 'Confidence (0–1)',
                  child: DecimalField(
                    controller: _confidence,
                    hint: _source == ClassificationSource.ai ? 'e.g. 0.92' : 'Usually blank',
                    suffix: null,
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _isFinal,
            onChanged: (v) => setState(() => _isFinal = v),
            title: const Text('Final classification', style: AppText.strong),
            subtitle: const Text('Turn off if this is a provisional classification.', style: AppText.small),
          ),
          if (_inputProblem != null) Notice(tone: NoticeTone.error, message: _inputProblem),
          if (validation == null && _inputProblem == null)
            const Notice(tone: NoticeTone.info, message: 'Choose a category, then Validate. You can classify once the check passes.'),
          if (stale)
            const Notice(tone: NoticeTone.info, message: 'You changed the classification after validating — run the validation again before saving.'),
          if (_validationIsCurrent && !validation!.approved)
            Notice(tone: NoticeTone.error, title: 'Validation rejected this classification', child: _Reasons(validation.reasons)),
          if (_validationIsCurrent && validation!.approved && !validation.requiresHumanReview)
            Notice(tone: NoticeTone.success, title: 'Validation passed', child: _Reasons(validation.reasons)),
          if (_validationIsCurrent && validation!.approved && validation.requiresHumanReview)
            Notice(tone: NoticeTone.warning, title: 'Approved, but flagged for human review', child: _Reasons(validation.reasons)),
          if (_needsAck && validation!.approved)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              controlAffinity: ListTileControlAffinity.leading,
              value: _ack,
              onChanged: (v) => setState(() => _ack = v ?? false),
              title: Text(
                _isHazardous
                    ? 'I understand this item will be quarantined (On hold) immediately.'
                    : 'I have reviewed the flagged reasons and want to classify it anyway.',
                style: AppText.body,
              ),
            ),
          if (_error != null) ...[const SizedBox(height: 12), ErrorMessage(message: _error!)],
        ],
      ),
    );
  }
}

class _Reasons extends StatelessWidget {
  const _Reasons(this.reasons);

  final List<String> reasons;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [for (final r in reasons) Text('• $r')]);
  }
}
