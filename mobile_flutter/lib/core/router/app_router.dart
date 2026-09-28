import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/register_screen.dart';
import '../../features/auth/presentation/session_screens.dart';
import '../../features/collector/application/collector_providers.dart';
import '../../features/collector/presentation/collector_profile_setup_screen.dart';
import '../../features/collector/presentation/job_detail_screen.dart';
import '../../features/collector/presentation/job_list_screen.dart';
import '../../features/submissions/presentation/submission_shell.dart';
import '../../features/warehouse/data/processing_enums.dart';
import '../../features/warehouse/presentation/home/warehouse_home_screen.dart';
import '../../features/warehouse/presentation/inventory/inventory_list_screen.dart';
import '../../features/warehouse/presentation/inventory/item_detail_screen.dart';
import '../../features/warehouse/presentation/receive/receive_screen.dart';
import '../../features/warehouse/presentation/scan/scan_screen.dart';
import '../../features/warehouse/presentation/warehouse_shell.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';

/// Where each role lands after signing in. Staff/Admin get the warehouse (Processing &
/// Inventory); Household/Corporate get the submission flow; Collector gets the job list (once
/// their profile check, below, lets them past it).
String homeFor(AuthUser user) {
  if (user.isStaffOrAdmin) return '/warehouse';
  if (user.isGenerator) return '/submissions';
  if (user.isCollector) return '/collector';
  return '/unavailable';
}

final routerProvider = Provider<GoRouter>((ref) {
  // Re-run the redirect whenever the session changes (sign in, sign out, token expiry).
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    debugLogDiagnostics: kDebugMode,
    redirect: (context, state) async {
      final auth = ref.read(authControllerProvider);
      final path = state.matchedLocation;

      if (auth.status == AuthStatus.restoring) return path == '/splash' ? null : '/splash';

      final user = auth.user;
      if (user == null) return (path == '/login' || path == '/register') ? null : '/login';

      if (path == '/login' || path == '/register' || path == '/splash') return homeFor(user);

      // Each role's API is scoped server-side too — don't show a screen that would only ever
      // come back 403.
      if (path.startsWith('/warehouse') && !user.isStaffOrAdmin) return '/unavailable';
      if (path.startsWith('/submissions') && !user.isGenerator) return '/unavailable';
      if (path.startsWith('/collector') && !user.isCollector) return '/unavailable';

      // A Collector with no profile yet can reach nothing except the setup screen; a Collector
      // who already has one skips straight past it. Cached by collectorProfileProvider, so this
      // only makes a network call the first time (or after CreateProfile invalidates it) —
      // not on every navigation.
      if (user.isCollector && path.startsWith('/collector')) {
        final hasProfile = await ref.read(collectorProfileProvider.future) != null;
        if (!hasProfile && path != '/collector/setup-profile') return '/collector/setup-profile';
        if (hasProfile && path == '/collector/setup-profile') return '/collector';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/unavailable', builder: (_, __) => const RoleNotAvailableScreen()),
      GoRoute(path: '/submissions', builder: (_, __) => const SubmissionShell()),
      GoRoute(path: '/collector/setup-profile', builder: (_, __) => const CollectorProfileSetupScreen()),
      GoRoute(
        path: '/collector',
        builder: (_, __) => const JobListScreen(),
        routes: [
          GoRoute(
            path: 'jobs/:id',
            builder: (_, state) => JobDetailScreen(key: ValueKey(state.pathParameters['id']), jobId: state.pathParameters['id']!),
          ),
        ],
      ),
      StatefulShellRoute.indexedStack(
        builder: (_, __, shell) => WarehouseShell(navigationShell: shell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/warehouse', builder: (_, __) => const WarehouseHomeScreen()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/warehouse/receive',
              builder: (_, state) => ReceiveScreen(
                initialTab: state.uri.queryParameters['tab'] == 'extra' ? ReceiveTab.extra : ReceiveTab.job,
              ),
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(
              path: '/warehouse/inventory',
              builder: (_, state) {
                final name = state.uri.queryParameters['status'];
                final status = InventoryStatus.values.where((s) => s.apiName == name).firstOrNull;
                return InventoryListScreen(initialStatus: status);
              },
              routes: [
                GoRoute(
                  path: ':id',
                  builder: (_, state) => ItemDetailScreen(
                    key: ValueKey(state.pathParameters['id']),
                    itemId: state.pathParameters['id']!,
                  ),
                ),
              ],
            ),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/warehouse/scan', builder: (_, __) => const ScanScreen()),
          ]),
        ],
      ),
    ],
  );
});
