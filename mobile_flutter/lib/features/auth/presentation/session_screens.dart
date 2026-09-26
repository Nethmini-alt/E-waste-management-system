import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/layout.dart';

/// Shown for the moment it takes to read the saved session on start-up.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Stack(
        children: [
          AppBackground(blobOpacity: 0.35),
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [BrandMark(showTagline: true), SizedBox(height: 24), CircularProgressIndicator()],
            ),
          ),
        ],
      ),
    );
  }
}

/// For roles whose mobile screens are not in this app yet (each team member adds their own part).
/// Keeps them signed in with a clear message instead of an empty or broken screen.
class RoleNotAvailableScreen extends ConsumerWidget {
  const RoleNotAvailableScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authControllerProvider).user;
    return Scaffold(
      body: Stack(
        children: [
          const AppBackground(blobOpacity: 0.35),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 400),
                  child: GlassCard(
                    padding: const EdgeInsets.all(28),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Align(alignment: Alignment.centerLeft, child: BrandMark()),
                        const SizedBox(height: 20),
                        const Icon(LucideIcons.smartphone, size: 32, color: AppColors.mint600),
                        const SizedBox(height: 12),
                        Text('Coming soon to mobile', textAlign: TextAlign.center, style: AppText.display(18)),
                        const SizedBox(height: 8),
                        Text(
                          'Hi ${user?.firstName ?? 'there'}, the ${user?.role ?? ''} screens are not in the mobile app yet. '
                          'Please use the web portal for now.',
                          textAlign: TextAlign.center,
                          style: AppText.body,
                        ),
                        const SizedBox(height: 20),
                        AppButton.secondary(
                          label: 'Sign out',
                          icon: LucideIcons.logOut,
                          expand: true,
                          onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
