import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Opens a form as a bottom sheet — the phone-friendly version of the web app's modals.
/// Returns whatever the sheet pops with (e.g. a success message).
Future<T?> showAppSheet<T>(BuildContext context, {required Widget Function(BuildContext) builder}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Colors.transparent,
    barrierColor: AppColors.ink900.withValues(alpha: 0.4),
    constraints: const BoxConstraints(maxWidth: 720),
    builder: builder,
  );
}

/// Sheet chrome: grab handle, title, subtitle, scrolling body and a pinned button row.
class AppSheet extends StatelessWidget {
  const AppSheet({
    super.key,
    required this.title,
    required this.body,
    this.subtitle,
    this.footer = const [],
    this.busy = false,
  });

  final String title;
  final String? subtitle;
  final Widget body;
  final List<Widget> footer;

  /// While a request is running the sheet can't be dismissed by dragging or Back.
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    return PopScope(
      canPop: !busy,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottomInset),
        child: Container(
          constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.92),
          decoration: const BoxDecoration(
            color: Color(0xFFF7FCFA),
            borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.card)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: 10),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(color: AppColors.ink100, borderRadius: BorderRadius.circular(2)),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 8, 8),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: AppText.display(18)),
                          if (subtitle != null) ...[
                            const SizedBox(height: 2),
                            Text(subtitle!, style: AppText.small),
                          ],
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'Close',
                      onPressed: busy ? null : () => Navigator.of(context).maybePop(),
                      icon: const Icon(LucideIcons.x, size: 20, color: AppColors.ink600),
                    ),
                  ],
                ),
              ),
              const Divider(),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
                  child: body,
                ),
              ),
              if (footer.isNotEmpty) ...[
                const Divider(),
                SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        for (var i = 0; i < footer.length; i++) ...[
                          if (i > 0) const SizedBox(width: 8),
                          Flexible(child: footer[i]),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
