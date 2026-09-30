import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/network/api_error.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/format.dart';
import '../../../../core/widgets/feedback.dart';
import '../../../../core/widgets/glass_card.dart';
import '../../../../core/widgets/layout.dart';
import '../../application/warehouse_providers.dart';
import '../../data/warehouse_models.dart';
import '../warehouse_shell.dart';

/// Recovered materials ready for sale, one card per material with its total weight (the web
/// Material stock page). Open a card to see each piece and where it is stored. Read-only.
class MaterialStockScreen extends ConsumerStatefulWidget {
  const MaterialStockScreen({super.key});

  @override
  ConsumerState<MaterialStockScreen> createState() => _MaterialStockScreenState();
}

class _MaterialStockScreenState extends ConsumerState<MaterialStockScreen> {
  final Set<String> _open = {};

  @override
  Widget build(BuildContext context) {
    final stock = ref.watch(materialStockProvider);

    return WarehousePage(
      onRefresh: () => ref.refresh(materialStockProvider.future),
      children: [
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: () => context.canPop() ? context.pop() : context.go('/warehouse/inventory'),
            icon: const Icon(LucideIcons.arrowLeft, size: 14, color: AppColors.mint700),
            label: const Text('Inventory', style: TextStyle(color: AppColors.mint700, fontWeight: FontWeight.w600)),
          ),
        ),
        const SizedBox(height: 4),
        const PageHeader(
          title: 'Material stock',
          subtitle: 'Recovered materials ready to sell, and where they are.',
          icon: LucideIcons.packageOpen,
        ),
        switch (stock) {
          AsyncData(:final value) when value.isEmpty => const GlassCard(
              child: EmptyState(
                icon: LucideIcons.packageOpen,
                title: 'No materials in stock',
                description: 'Materials recovered by dismantling show up here once they are ready to sell.',
              ),
            ),
          AsyncData(:final value) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _Totals(groups: value),
                const SizedBox(height: 14),
                for (final g in value)
                  _MaterialCard(
                    group: g,
                    open: _open.contains(g.materialType),
                    onToggle: () => setState(() {
                      if (!_open.remove(g.materialType)) _open.add(g.materialType);
                    }),
                  ),
              ],
            ),
          AsyncError(:final error) => ErrorMessage(
              message: apiErrorMessage(error, 'Failed to load material stock.'),
              onRetry: () => ref.invalidate(materialStockProvider),
            ),
          _ => const GlassCard(child: LoadingState(label: 'Loading stock…')),
        },
      ],
    );
  }
}

class _Totals extends StatelessWidget {
  const _Totals({required this.groups});

  final List<MaterialStockGroup> groups;

  @override
  Widget build(BuildContext context) {
    final total = groups.fold<double>(0, (sum, g) => sum + g.totalWeightKg);
    return Row(
      children: [
        Expanded(child: _Figure(label: 'Materials', value: '${groups.length}')),
        const SizedBox(width: 10),
        Expanded(child: _Figure(label: 'Total weight', value: Format.kg(total))),
      ],
    );
  }
}

class _Figure extends StatelessWidget {
  const _Figure({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return GlassCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(), style: AppText.label.copyWith(fontSize: 10)),
          const SizedBox(height: 6),
          Text(value, style: AppText.display(22)),
        ],
      ),
    );
  }
}

class _MaterialCard extends StatelessWidget {
  const _MaterialCard({required this.group, required this.open, required this.onToggle});

  final MaterialStockGroup group;
  final bool open;
  final VoidCallback onToggle;

  @override
  Widget build(BuildContext context) {
    final g = group;
    final reserved = g.reservedWeightKg;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: GlassCard(
        padding: EdgeInsets.zero,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Material(
              type: MaterialType.transparency,
              child: InkWell(
                onTap: onToggle,
                borderRadius: BorderRadius.circular(AppRadius.card),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(g.materialType, style: AppText.display(16)),
                            const SizedBox(height: 2),
                            Text(
                              [
                                '${g.items.length} piece${g.items.length == 1 ? '' : 's'}',
                                if (reserved > 0.005) '${Format.kg(reserved)} set aside for orders',
                              ].join(' · '),
                              style: AppText.small,
                            ),
                          ],
                        ),
                      ),
                      Text(Format.kg(g.totalWeightKg), style: AppText.display(18, color: AppColors.mint800)),
                      const SizedBox(width: 8),
                      AnimatedRotation(
                        turns: open ? 0.25 : 0,
                        duration: const Duration(milliseconds: 150),
                        child: const Icon(LucideIcons.chevronRight, size: 18, color: AppColors.ink600),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            AnimatedSize(
              duration: const Duration(milliseconds: 180),
              alignment: Alignment.topCenter,
              child: !open
                  ? const SizedBox(width: double.infinity)
                  : Padding(
                      padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                      child: Column(
                        children: [
                          for (final item in g.items)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Tile(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                onTap: () => context.go('/warehouse/inventory/${item.inventoryItemId}'),
                                child: Row(
                                  children: [
                                    const Icon(LucideIcons.mapPin, size: 16, color: AppColors.mint600),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(item.locationName, style: AppText.strong),
                                          Text(
                                            [
                                              if (item.parentItemType != null) 'From ${item.parentItemType}',
                                              Format.date(item.recordedAt),
                                            ].join(' · '),
                                            style: AppText.small,
                                          ),
                                        ],
                                      ),
                                    ),
                                    Text(Format.kg(item.weightKg), style: AppText.strong),
                                    const SizedBox(width: 4),
                                    const Icon(LucideIcons.chevronRight, size: 16, color: AppColors.ink600),
                                  ],
                                ),
                              ),
                            ),
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
