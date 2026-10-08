import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile_flutter/core/auth/auth_controller.dart';
import 'package:mobile_flutter/core/auth/auth_models.dart';
import 'package:mobile_flutter/core/theme/app_theme.dart';
import 'package:mobile_flutter/features/submissions/application/submissions_providers.dart';
import 'package:mobile_flutter/features/submissions/data/submission_models.dart';
import 'package:mobile_flutter/features/submissions/data/submissions_api.dart';
import 'package:mobile_flutter/features/submissions/presentation/my_submissions_screen.dart';
import 'package:mobile_flutter/features/submissions/presentation/submit_item_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  GoogleFonts.config.allowRuntimeFetching = false;

  group('SubmitItemScreen', () {
    testWidgets('validates required fields before sending a submission',
        (tester) async {
      _useTallViewport(tester);
      final api = _FakeSubmissionsApi();
      await tester
          .pumpWidget(_app(api, const SubmitItemScreen(onSubmitted: _noop)));

      await tester.drag(find.byType(ListView).first, const Offset(0, -1400));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Submit e-waste item'));
      await tester.tap(find.text('Submit e-waste item'));
      await tester.pumpAndSettle();

      expect(api.createCalls, isEmpty);
      expect(find.text('Choose a category.'), findsOneWidget);
      expect(find.text('Enter a pickup address.'), findsOneWidget);
      expect(find.text('Enter a phone number.'), findsOneWidget);
    });

    testWidgets(
        'submits three items, enforces the item limit, and notifies the caller',
        (tester) async {
      _useTallViewport(tester);
      final api = _FakeSubmissionsApi();
      var submitted = false;
      await tester.pumpWidget(
        _app(api, SubmitItemScreen(onSubmitted: () => submitted = true)),
      );

      final category = find.byType(DropdownButtonFormField<String>);
      await tester.ensureVisible(category);
      await tester.tap(category);
      await tester.pumpAndSettle();
      await tester.tap(find.text('IT Equipment').last);
      await tester.pumpAndSettle();

      await tester.enterText(find.byType(TextField).first, '12.5');
      await tester.enterText(
          find.byType(TextFormField).at(0), '10 Galle Road, Colombo 03');
      await tester.enterText(find.byType(TextFormField).at(1), '0771234567');

      await tester.ensureVisible(find.text('Add another item'));
      await tester.tap(find.text('Add another item'));
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('Add another item'));
      await tester.tap(find.text('Add another item'));
      await tester.pumpAndSettle();

      expect(find.text('Items (3/3)'), findsOneWidget);
      final addItemButton = tester.widget<OutlinedButton>(
        find.widgetWithText(OutlinedButton, 'Add another item'),
      );
      expect(addItemButton.onPressed, isNull);

      final names = ['Old laptop', 'UPS battery', 'Desktop computer'];
      for (var i = 0; i < names.length; i++) {
        await tester.enterText(
            find.byType(TextFormField).at(2 + i * 2), names[i]);
        await tester.enterText(
          find.byType(TextFormField).at(3 + i * 2),
          '${names[i]} ready for safe recycling',
        );
      }

      await tester.ensureVisible(find.text('Submit e-waste item'));
      await tester.tap(find.text('Submit e-waste item'));
      await tester.pumpAndSettle();

      expect(api.createCalls, hasLength(1));
      expect(api.createCalls.single['category'], 'IT Equipment');
      expect(api.createCalls.single['estimatedWeight'], 12.5);
      expect(
          api.createCalls.single['pickupAddress'], '10 Galle Road, Colombo 03');
      expect(api.createCalls.single['phoneNumber'], '0771234567');
      expect(
        api.createCalls.single['items']
            .map((item) => item['itemName'])
            .toList(),
        names,
      );
      expect(submitted, isTrue);
    });
  });

  testWidgets(
      'MySubmissionsScreen shows the signed-in generator submission status',
      (tester) async {
    _useTallViewport(tester);
    final api = _FakeSubmissionsApi(submissions: [_submission()]);
    await tester.pumpWidget(_app(api, const MySubmissionsScreen()));
    await tester.pumpAndSettle();

    expect(find.text('My submissions'), findsOneWidget);
    expect(find.text('IT Equipment'), findsOneWidget);
    expect(find.text('Awaiting review'), findsOneWidget);
    expect(find.text('10 Galle Road, Colombo 03'), findsOneWidget);
    expect(find.text('1 item · Submitted Sep 26, 2026'), findsOneWidget);
  });
}

void _useTallViewport(WidgetTester tester) {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

void _noop() {}

Widget _app(SubmissionsApi api, Widget screen) => ProviderScope(
      overrides: [
        authControllerProvider.overrideWith(_SignedInHousehold.new),
        submissionsApiProvider.overrideWithValue(api),
      ],
      child: MaterialApp(
        theme: buildAppTheme(),
        home: Scaffold(body: screen),
      ),
    );

SubmissionResponse _submission() => SubmissionResponse(
      id: 'submission-12345678',
      category: 'IT Equipment',
      estimatedWeight: 2.5,
      pickupAddress: '10 Galle Road, Colombo 03',
      phoneNumber: '0771234567',
      createdAt: DateTime(2026, 9, 26),
      items: const [
        SubmissionItem(
          id: 'item-1',
          itemName: 'Old laptop',
          description: 'Cracked screen',
          imageUrl: '',
        ),
      ],
      status: 'AwaitingReview',
      statusLabel: 'Awaiting review',
    );

class _FakeSubmissionsApi extends SubmissionsApi {
  _FakeSubmissionsApi({List<SubmissionResponse>? submissions})
      : submissions = submissions ?? const [],
        super(Dio());

  final List<SubmissionResponse> submissions;
  final List<Map<String, dynamic>> createCalls = [];

  @override
  Future<SubmissionResponse> create({
    required String category,
    required double estimatedWeight,
    required String pickupAddress,
    required String phoneNumber,
    required List<SubmissionItemDraft> items,
  }) async {
    createCalls.add({
      'category': category,
      'estimatedWeight': estimatedWeight,
      'pickupAddress': pickupAddress,
      'phoneNumber': phoneNumber,
      'items': [
        for (final item in items)
          {
            'itemName': item.itemName,
            'description': item.description,
            'imageUrl': item.imageUrl
          },
      ],
    });
    return _submission();
  }

  @override
  Future<List<SubmissionResponse>> mine() async => submissions;
}

class _SignedInHousehold extends AuthController {
  @override
  AuthState build() => const AuthState.signedIn(
        AuthUser(
          userId: 'household-1',
          email: 'generator@example.test',
          fullName: 'Test Generator',
          role: 'Household',
        ),
        'test-token',
      );
}
