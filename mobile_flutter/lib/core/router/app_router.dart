import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/session_screens.dart';
import '../../features/warehouse/data/processing_enums.dart';
import '../../features/warehouse/presentation/home/warehouse_home_screen.dart';
import '../../features/warehouse/presentation/inventory/inventory_list_screen.dart';
import '../../features/warehouse/presentation/inventory/item_detail_screen.dart';
import '../../features/warehouse/presentation/receive/receive_screen.dart';
import '../../features/warehouse/presentation/scan/scan_screen.dart';
import '../../features/warehouse/presentation/warehouse_shell.dart';
import '../auth/auth_controller.dart';
import '../auth/auth_models.dart';

/// Where each role lands after signing in. Staff and Admin get the warehouse (Processing &
/// Inventory). Other roles' mobile screens are added by their component owners — add a case here.
String homeFor(AuthUser user) => user.isStaffOrAdmin ? '/warehouse' : '/unavailable';

final routerProvider = Provider<GoRouter>((ref) {
  // Re-run the redirect whenever the session changes (sign in, sign out, token expiry).
  final refresh = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, __) => refresh.value++);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    debugLogDiagnostics: kDebugMode,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      final path = state.matchedLocation;

      if (auth.status == AuthStatus.restoring) return path == '/splash' ? null : '/splash';

      final user = auth.user;
      if (user == null) return path == '/login' ? null : '/login';

      if (path == '/login' || path == '/splash') return homeFor(user);
      // The warehouse API is Staff/Admin only — don't show screens that would only return 403.
      if (path.startsWith('/warehouse') && !user.isStaffOrAdmin) return '/unavailable';
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/unavailable', builder: (_, __) => const RoleNotAvailableScreen()),
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
