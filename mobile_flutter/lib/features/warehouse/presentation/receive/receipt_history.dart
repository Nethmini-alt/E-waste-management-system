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
import '../../../../core/widgets/glass_card.dart';
import '../../application/warehouse_providers.dart';
import '../../data/warehouse_models.dart';
import '../widgets/badges.dart';

/// Past extra-waste drop-offs, newest first (the web "Receipt history" tab). Read-only: tap one to
/// see what was accepted or turned away. Pops the receipt sheet with an item id to open it.
class ReceiptHistory extends ConsumerStatefulWidget {
  const ReceiptHistory({super.key, required this.onOpenItem});

  final ValueChanged<String> onOpenItem;

  @override
  ConsumerState<ReceiptHistory> createState() => _ReceiptHistoryState();
}

class _ReceiptHistoryState extends ConsumerState<ReceiptHistory> {
  final List<ExtraWasteReceiptSummary> _receipts = [];
  int _page = 0;
  int _totalPages = 1;
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load(1);
  }

  Future<void> _load(int page) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await ref.read(warehouseApiProvider).extraWasteReceipts(page: page);
      if (!mounted) return;
      setState(() {
        if (page == 1) _receipts.clear();
        _receipts.addAll(result.items);
        _page = result.page;
        _totalPages = result.totalPages;
      });
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Failed to load past drop-offs.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _open(ExtraWasteReceiptSummary receipt) async {
    final itemId = await showAppSheet<String>(context, builder: (_) => _ReceiptSheet(receiptId: receipt.receiptId));
    if (itemId != null) widget.onOpenItem(itemId);
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && _receipts.isEmpty) return ErrorMessage(message: _error!, onRetry: () => _load(1));
    if (_loading && _receipts.isEmpty) return const GlassCard(child: LoadingState(label: 'Loading past drop-offs…'));
    if (_receipts.isEmpty) {
      return const GlassCard(
        child: EmptyState(
          icon: LucideIcons.receiptText,
          title: 'No drop-offs yet',
          description: 'Extra waste you receive will be listed here.',
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text('Past extra-waste drop-offs · tap one to see it', style: AppText.small),
        ),
        for (final r in _receipts) _ReceiptCard(receipt: r, onTap: () => _open(r)),
        if (_error != null) ErrorMessage(message: _error!, onRetry: () => _load(_page + 1)),
        if (_page < _totalPages)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: AppButton.secondary(
              label: _loading ? 'Loading…' : 'Show older',
              loading: _loading,
              expand: true,
              onPressed: () => _load(_page + 1),
            ),
          ),
      ],
    );
  }
}

class _ReceiptCard extends StatelessWidget {
  const _ReceiptCard({required this.receipt, required this.onTap});

  final ExtraWasteReceiptSummary receipt;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final r = receipt;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Tile(
        onTap: onTap,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(r.collectorName ?? 'Unknown collector', style: AppText.strong),
                  const SizedBox(height: 2),
                  Text(Format.dateTime(r.receivedAt), style: AppText.small),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      Pill(
                        label: '${r.acceptedCount} accepted · ${Format.kg(r.acceptedWeightKg)}',
                        background: AppColors.mint100,
                        foreground: AppColors.mint800,
                      ),
                      if (r.rejectedCount > 0)
                        Pill(label: '${r.rejectedCount} turned away', background: AppColors.ink100, foreground: AppColors.ink800),
                      if (r.paymentStatus == 'Paid')
                        const Pill(label: 'Paid', background: AppColors.mint600, foreground: Colors.white)
                      else if (r.paymentStatus != null)
                        const Pill(label: 'Payment pending', background: AppColors.amber100, foreground: AppColors.amber800),
                    ],
                  ),
                ],
              ),
            ),
            const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.ink600),
          ],
        ),
      ),
    );
  }
}

class _ReceiptSheet extends ConsumerWidget {
  const _ReceiptSheet({required this.receiptId});

  final String receiptId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receipt = ref.watch(receiptDetailProvider(receiptId));
    final value = receipt.value;

    return AppSheet(
      title: value?.collectorName ?? 'Drop-off',
      subtitle: value == null ? null : Format.dateTime(value.receivedAt),
      footer: [AppButton.secondary(label: 'Close', expand: true, onPressed: () => Navigator.pop(context))],
      body: switch (receipt) {
        AsyncData(:final value) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (final line in value.items)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Tile(
                    color: line.accepted ? null : AppColors.ink50,
                    onTap: line.inventoryItemId == null ? null : () => Navigator.pop(context, line.inventoryItemId),
                    child: Row(
                      children: [
                        Icon(
                          line.accepted ? LucideIcons.circleCheck : LucideIcons.circleX,
                          size: 20,
                          color: line.accepted ? AppColors.mint600 : AppColors.ink600,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(line.itemType, style: AppText.strong),
                              Text(
                                line.accepted ? 'Accepted' : 'Turned away · ${line.rejectionReason ?? 'no reason given'}',
                                style: AppText.small,
                              ),
                            ],
                          ),
                        ),
                        Text(Format.kg(line.weightKg), style: AppText.strong),
                        if (line.inventoryItemId != null) ...[
                          const SizedBox(width: 6),
                          const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.ink600),
                        ],
                      ],
                    ),
                  ),
                ),
              if (value.receivedByName != null) ...[
                const SizedBox(height: 4),
                Text('Received by ${value.receivedByName}', style: AppText.small),
              ],
              if (value.notes != null && value.notes!.trim().isNotEmpty) ...[
                const SizedBox(height: 4),
                Text('Note: ${value.notes}', style: AppText.small),
              ],
            ],
          ),
        AsyncError(:final error) => ErrorMessage(
            message: apiErrorMessage(error, 'Failed to load this drop-off.'),
            onRetry: () => ref.invalidate(receiptDetailProvider(receiptId)),
          ),
        _ => const LoadingState(label: 'Loading…'),
      },
    );
  }
}
