import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/network/api_error.dart';
import '../../core/theme/app_colors.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_sheet.dart';
import '../../core/widgets/feedback.dart';
import 'notifications_api.dart';

/// Header bell with an unread badge. Opens the notification list as a bottom sheet.
class NotificationBell extends ConsumerWidget {
  const NotificationBell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadNotificationsProvider).value ?? 0;
    return Semantics(
      button: true,
      label: unread == 0 ? 'Notifications' : 'Notifications, $unread unread',
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: () async {
          await showAppSheet<void>(context, builder: (_) => const _NotificationSheet());
          ref.invalidate(unreadNotificationsProvider);
        },
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.7),
            shape: BoxShape.circle,
            border: Border.all(color: AppColors.mint100),
          ),
          child: Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              const Icon(LucideIcons.bell, size: 20, color: AppColors.ink800),
              if (unread > 0)
                Positioned(
                  top: 6,
                  right: 5,
                  child: Container(
                    constraints: const BoxConstraints(minWidth: 16),
                    height: 16,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.mint600,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: Colors.white, width: 1.5),
                    ),
                    child: Text(
                      unread > 9 ? '9+' : '$unread',
                      style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700, height: 1),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationSheet extends ConsumerWidget {
  const _NotificationSheet();

  static final _when = DateFormat('MMM d, h:mm a');

  Future<void> _open(BuildContext context, WidgetRef ref, AppNotification n) async {
    if (!n.isRead) {
      try {
        await ref.read(notificationsApiProvider).markRead(n.id);
      } catch (_) {
        // reading still works if marking fails; the badge just stays until the next try
      }
      ref.invalidate(notificationsListProvider);
    }
    final link = n.link;
    if (!context.mounted || link == null) return;
    // Only follow links this app has a screen for (the web app uses the same field).
    if (link.startsWith('/collector')) {
      final router = GoRouter.of(context); // the sheet's context is gone once it closes
      Navigator.of(context).pop();
      router.go(link);
    }
  }

  Future<void> _markAll(WidgetRef ref) async {
    try {
      await ref.read(notificationsApiProvider).markAllRead();
    } finally {
      ref.invalidate(notificationsListProvider);
      ref.invalidate(unreadNotificationsProvider);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final listAsync = ref.watch(notificationsListProvider);
    final hasUnread = listAsync.value?.any((n) => !n.isRead) ?? false;

    return AppSheet(
      title: 'Notifications',
      body: switch (listAsync) {
        AsyncData(:final value) when value.isEmpty => const EmptyState(
            icon: LucideIcons.bellOff,
            title: 'No notifications yet',
            description: 'Updates about your work will show up here.',
          ),
        AsyncData(:final value) => Column(
            children: [
              for (final n in value)
                _NotificationTile(n, when: n.createdAt == null ? null : _when.format(n.createdAt!), onTap: () => _open(context, ref, n)),
            ],
          ),
        AsyncError(:final error) => ErrorMessage(
            message: apiErrorMessage(error, 'Failed to load notifications.'),
            onRetry: () => ref.invalidate(notificationsListProvider),
          ),
        _ => const LoadingState(),
      },
      footer: [
        if (hasUnread)
          TextButton.icon(
            onPressed: () => _markAll(ref),
            icon: const Icon(LucideIcons.checkCheck, size: 16),
            label: const Text('Mark all as read'),
          ),
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile(this.n, {required this.when, required this.onTap});

  final AppNotification n;
  final String? when;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final (icon, color) = switch (n.type) {
      'success' => (LucideIcons.circleCheck, AppColors.mint600),
      'warning' => (LucideIcons.triangleAlert, AppColors.amber700),
      'error' => (LucideIcons.circleAlert, const Color(0xFFDC2626)),
      _ => (LucideIcons.info, AppColors.sky500),
    };
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.input),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: n.isRead ? Colors.transparent : AppColors.mint50,
          borderRadius: BorderRadius.circular(AppRadius.input),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: color),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(n.title, style: AppText.strong),
                  const SizedBox(height: 2),
                  Text(n.message, style: AppText.body),
                  if (when != null) ...[
                    const SizedBox(height: 4),
                    Text(when!, style: AppText.small),
                  ],
                ],
              ),
            ),
            if (!n.isRead)
              Container(
                width: 8,
                height: 8,
                margin: const EdgeInsets.only(top: 6, left: 6),
                decoration: const BoxDecoration(color: AppColors.mint600, shape: BoxShape.circle),
              ),
          ],
        ),
      ),
    );
  }
}
