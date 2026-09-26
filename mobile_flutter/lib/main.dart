import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';

void main() {
  runApp(
    ProviderScope(
      // Don't silently retry failed requests: show the error with a "Try again" link instead,
      // the same way the web app does.
      retry: (_, __) => null,
      child: const EWasteApp(),
    ),
  );
}
