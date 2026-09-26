import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

class EWasteApp extends ConsumerWidget {
  const EWasteApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return MaterialApp.router(
      title: 'E-Waste Management System',
      debugShowCheckedModeBanner: false,
      theme: buildAppTheme(),
      // The web app's glass design is light-only for the Processing screens, so the app is too.
      themeMode: ThemeMode.light,
      routerConfig: ref.watch(routerProvider),
    );
  }
}
