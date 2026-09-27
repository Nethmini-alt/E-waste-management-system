import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

enum NoticeTone { success, info, warning, error }

/// Inline banner (Notice in the web app) — used instead of dialogs for feedback.
class Notice extends StatelessWidget {
  const Notice({super.key, required this.tone, this.title, this.message, this.child});

  final NoticeTone tone;
  final String? title;
  final String? message;
  final Widget? child;

  static const _styles = {
    NoticeTone.success: (AppColors.mint50, AppColors.mint800, AppColors.mint200, LucideIcons.circleCheck),
    NoticeTone.info: (AppColors.sky50, AppColors.sky800, AppColors.sky200, LucideIcons.info),
    NoticeTone.warning: (AppColors.amber50, AppColors.amber900, AppColors.amber200, LucideIcons.triangleAlert),
    NoticeTone.error: (AppColors.red50, AppColors.red800, AppColors.red200, LucideIcons.circleAlert),
  };

  @override
  Widget build(BuildContext context) {
    final (background, foreground, border, icon) = _styles[tone]!;
    return Semantics(
      liveRegion: true,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(AppRadius.tile),
          border: Border.all(color: border),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: foreground, fontSize: 14, height: 1.4),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(padding: const EdgeInsets.only(top: 1), child: Icon(icon, size: 18, color: foreground)),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (title != null) Text(title!, style: const TextStyle(fontWeight: FontWeight.w600)),
                    if (title != null && (message != null || child != null)) const SizedBox(height: 2),
                    if (message != null) Text(message!),
                    if (child != null) child!,
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// An error notice with an optional "Try again" link (ErrorMessage in the web app).
class ErrorMessage extends StatelessWidget {
  const ErrorMessage({super.key, required this.message, this.title, this.onRetry});

  final String message;
  final String? title;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return Notice(
      tone: NoticeTone.error,
      title: title,
      child: Wrap(
        spacing: 16,
        runSpacing: 4,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(message),
          if (onRetry != null)
            InkWell(
              onTap: onRetry,
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(LucideIcons.refreshCw, size: 12, color: AppColors.red800),
                  SizedBox(width: 4),
                  Text(
                    'Try again',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, decoration: TextDecoration.underline),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.title, this.description, this.icon = LucideIcons.inbox, this.action});

  final String title;
  final String? description;
  final IconData icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(color: AppColors.mint50, borderRadius: BorderRadius.circular(AppRadius.tile)),
            child: Icon(icon, size: 26, color: AppColors.mint600),
          ),
          const SizedBox(height: 10),
          Text(title, textAlign: TextAlign.center, style: AppText.display(16)),
          if (description != null) ...[
            const SizedBox(height: 6),
            Text(description!, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14, color: AppColors.ink600)),
          ],
          if (action != null) ...[const SizedBox(height: 12), action!],
        ],
      ),
    );
  }
}

class LoadingState extends StatelessWidget {
  const LoadingState({super.key, this.label = 'Loading…'});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 48),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(fontSize: 14, color: AppColors.ink600)),
        ],
      ),
    );
  }
}

/// Numbered list of form problems, shown after the user tries to submit.
class ProblemList extends StatelessWidget {
  const ProblemList({super.key, required this.problems, this.title});

  final List<String> problems;
  final String? title;

  @override
  Widget build(BuildContext context) {
    return Notice(
      tone: NoticeTone.error,
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [for (final p in problems) Text('• $p')],
      ),
    );
  }
}
