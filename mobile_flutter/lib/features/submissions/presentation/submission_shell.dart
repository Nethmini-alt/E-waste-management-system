import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_background.dart';
import '../application/submissions_providers.dart';
import 'my_submissions_screen.dart';
import 'submit_item_screen.dart';

/// Two tabs for Household/Corporate: Submit and My Submissions — the same two screens as the
/// web app's Component A nav, kept as one IndexedStack so switching tabs doesn't lose either
/// screen's state.
class SubmissionShell extends ConsumerStatefulWidget {
  const SubmissionShell({super.key});

  @override
  ConsumerState<SubmissionShell> createState() => _SubmissionShellState();
}

class _SubmissionShellState extends ConsumerState<SubmissionShell> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const AppBackground(),
          SafeArea(
            child: IndexedStack(
              index: _index,
              children: [
                SubmitItemScreen(onSubmitted: () => setState(() => _index = 1)),
                const MySubmissionsScreen(),
              ],
            ),
          ),
        ],
      ),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('E-Waste'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
            icon: const Icon(LucideIcons.logOut),
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) {
          if (i == 1) ref.invalidate(mySubmissionsProvider);
          setState(() => _index = i);
        },
        indicatorColor: AppColors.mint100,
        destinations: const [
          NavigationDestination(icon: Icon(LucideIcons.send), label: 'Submit'),
          NavigationDestination(icon: Icon(LucideIcons.packageSearch), label: 'My Submissions'),
        ],
      ),
    );
  }
}
