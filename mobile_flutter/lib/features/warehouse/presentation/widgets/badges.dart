import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../../core/theme/app_colors.dart';
import '../../data/processing_enums.dart';

/// Rounded pill used by every badge (`rounded-full px-2.5 py-1 text-xs font-semibold`).
class Pill extends StatelessWidget {
  const Pill({super.key, required this.label, required this.background, required this.foreground, this.dot, this.icon});

  final String label;
  final Color background;
  final Color foreground;
  final Color? dot;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dot != null) ...[
            Container(width: 6, height: 6, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
            const SizedBox(width: 6),
          ],
          if (icon != null) ...[Icon(icon, size: 12, color: foreground), const SizedBox(width: 4)],
          Text(label, style: TextStyle(color: foreground, fontSize: 12, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// Same colours as the web StatusBadge.
class StatusBadge extends StatelessWidget {
  const StatusBadge(this.status, {super.key});

  final InventoryStatus status;

  static const _styles = {
    InventoryStatus.received: (AppColors.sky100, AppColors.sky800, AppColors.sky500),
    InventoryStatus.sorting: (AppColors.amber100, AppColors.amber800, AppColors.amber500),
    InventoryStatus.dismantling: (AppColors.orange100, AppColors.orange800, AppColors.orange500),
    InventoryStatus.classified: (AppColors.mint100, AppColors.mint800, AppColors.mint500),
    InventoryStatus.readyForSale: (AppColors.mint600, Colors.white, Colors.white),
    InventoryStatus.exportOnly: (AppColors.violet100, AppColors.violet800, AppColors.violet500),
    InventoryStatus.onHold: (AppColors.red100, AppColors.red800, AppColors.red500),
  };

  @override
  Widget build(BuildContext context) {
    final (bg, fg, dot) = _styles[status]!;
    return Pill(label: status.label, background: bg, foreground: fg, dot: dot);
  }
}

/// Same colours as the web CategoryBadge; "Unclassified" when there is no category yet.
class CategoryBadge extends StatelessWidget {
  const CategoryBadge(this.category, {super.key});

  final ClassificationCategory? category;

  @override
  Widget build(BuildContext context) {
    final c = category;
    if (c == null) return const Pill(label: 'Unclassified', background: AppColors.ink100, foreground: AppColors.ink600);
    final (bg, fg) = switch (c) {
      ClassificationCategory.reusable => (AppColors.mint100, AppColors.mint800),
      ClassificationCategory.localRecyclable => (AppColors.teal100, AppColors.teal800),
      ClassificationCategory.hazardous => (AppColors.red100, AppColors.red800),
      ClassificationCategory.exportOnly => (AppColors.violet100, AppColors.violet800),
    };
    return Pill(
      label: c.label,
      background: bg,
      foreground: fg,
      icon: c == ClassificationCategory.hazardous ? LucideIcons.shieldAlert : null,
    );
  }
}

/// Read-only progress strip: Received → Sorting → Dismantling → Classified → outcome.
class StatusStepper extends StatelessWidget {
  const StatusStepper(this.status, {super.key});

  final InventoryStatus status;

  static int _index(InventoryStatus s) => switch (s) {
        InventoryStatus.received => 0,
        InventoryStatus.sorting => 1,
        InventoryStatus.dismantling => 2,
        InventoryStatus.classified => 3,
        _ => 4,
      };

  @override
  Widget build(BuildContext context) {
    final current = _index(status);
    final labels = ['Received', 'Sorting', 'Dismantling', 'Classified', current == 4 ? status.label : 'Outcome'];

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < labels.length; i++) ...[
          SizedBox(
            width: 58,
            child: Column(
              children: [
                _dot(i, current),
                const SizedBox(height: 4),
                Text(
                  labels[i].toUpperCase(),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 9,
                    letterSpacing: 0.4,
                    fontWeight: i == current ? FontWeight.w700 : FontWeight.w400,
                    color: i == current ? AppColors.ink900 : AppColors.ink600,
                  ),
                ),
              ],
            ),
          ),
          if (i < labels.length - 1)
            Expanded(
              child: Container(
                margin: const EdgeInsets.only(top: 13),
                height: 2,
                decoration: BoxDecoration(
                  color: i < current ? AppColors.mint600 : AppColors.ink100,
                  borderRadius: BorderRadius.circular(1),
                ),
              ),
            ),
        ],
      ],
    );
  }

  Widget _dot(int i, int current) {
    final done = i < current;
    final active = i == current;
    final bad = active && status == InventoryStatus.onHold;
    return Container(
      width: 28,
      height: 28,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: bad
            ? AppColors.red600
            : done || active
                ? AppColors.mint600
                : AppColors.ink100,
        border: active && !bad ? Border.all(color: AppColors.mint200, width: 4, strokeAlign: BorderSide.strokeAlignOutside) : null,
      ),
      child: done
          ? const Icon(LucideIcons.check, size: 14, color: Colors.white)
          : Text(
              '${i + 1}',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: done || active ? Colors.white : AppColors.ink600,
              ),
            ),
    );
  }
}
