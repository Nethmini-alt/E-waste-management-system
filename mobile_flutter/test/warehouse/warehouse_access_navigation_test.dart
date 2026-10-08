// Component C — TC-C-F09 / F10: warehouse navigation and worker-only access.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_flutter/core/auth/auth_models.dart';
import 'package:mobile_flutter/core/router/app_router.dart';
import 'package:mobile_flutter/features/warehouse/presentation/warehouse_shell.dart';

AuthUser user(String role) => AuthUser(userId: 'u-1', email: 'u@test.com', fullName: 'Test $role', role: role);

void main() {
  setUpAll(() => GoogleFonts.config.allowRuntimeFetching = false);

  group('TC-C-F10 only worker staff get the warehouse app', () {
    test('a worker lands on the warehouse after signing in', () {
      expect(homeFor(user('Worker')), '/warehouse');
      expect(homeFor(user('worker')), '/warehouse'); // role names are not case sensitive
    });

    test('management staff and admins are sent to the web portal, never the warehouse', () {
      for (final role in ['Staff', 'Admin']) {
        expect(user(role).isWorker, isFalse);
        expect(user(role).isWebOnly, isTrue);
        expect(homeFor(user(role)), '/unavailable');
      }
    });

    test('customers and collectors get their own apps, not the warehouse', () {
      expect(homeFor(user('Household')), '/submissions');
      expect(homeFor(user('Collector')), '/collector');
      for (final role in ['Household', 'Corporate', 'Collector']) {
        expect(user(role).isWorker, isFalse);
      }
    });
  });

  group('TC-C-F09 warehouse navigation', () {
    testWidgets('the bottom bar switches between Home, Receive, Inventory and Scan', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.5;
      addTearDown(tester.view.reset);

      StatefulShellBranch branch(String path, String label) => StatefulShellBranch(routes: [
            GoRoute(path: path, builder: (_, __) => Center(child: Text('$label page'))),
          ]);

      final router = GoRouter(
        initialLocation: '/warehouse',
        routes: [
          StatefulShellRoute.indexedStack(
            builder: (_, __, shell) => WarehouseShell(navigationShell: shell),
            branches: [
              branch('/warehouse', 'Home'),
              branch('/warehouse/receive', 'Receive'),
              branch('/warehouse/inventory', 'Inventory'),
              branch('/warehouse/scan', 'Scan'),
            ],
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(MaterialApp.router(routerConfig: router));
      await tester.pumpAndSettle();
      expect(find.text('Home page'), findsOneWidget);

      for (final tab in ['Receive', 'Inventory', 'Scan', 'Home']) {
        await tester.tap(find.text(tab).last);
        await tester.pumpAndSettle();
        expect(find.text('$tab page'), findsOneWidget, reason: 'tapping "$tab" opens its page');
        expect(router.routerDelegate.currentConfiguration.uri.path, tab == 'Home' ? '/warehouse' : '/warehouse/${tab.toLowerCase()}');
      }
    });
  });
}
