import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/glass_card.dart';
import '../application/buyer_providers.dart';

class BuyerRegistrationScreen extends ConsumerStatefulWidget {
  const BuyerRegistrationScreen({super.key});

  @override
  ConsumerState<BuyerRegistrationScreen> createState() => _BuyerRegistrationScreenState();
}

class _BuyerRegistrationScreenState extends ConsumerState<BuyerRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _phone = TextEditingController();
  final _company = TextEditingController();
  final _contact = TextEditingController();
  final _address = TextEditingController();
  String _buyerType = 'Local';
  bool _loading = false;
  bool _registered = false;
  String? _error;

  @override
  void dispose() {
    _fullName.dispose();
    _email.dispose();
    _password.dispose();
    _phone.dispose();
    _company.dispose();
    _contact.dispose();
    _address.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_loading || !_formKey.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await ref.read(buyerApiProvider).register(
            fullName: _fullName.text,
            email: _email.text,
            password: _password.text,
            phoneNumber: _phone.text,
            companyName: _company.text,
            contactPerson: _contact.text,
            address: _address.text,
            buyerType: _buyerType,
          );
      if (mounted) setState(() => _registered = true);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorMessage(error, 'Could not create your buyer account.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: Stack(
          children: [
            const AppBackground(blobOpacity: 0.35, showYellowBlob: true),
            SafeArea(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 28),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 520),
                    child: GlassCard(
                      padding: const EdgeInsets.all(24),
                      child: _registered ? _RegistrationComplete(onSignIn: () => context.go('/login')) : _registrationForm(),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      );

  Widget _registrationForm() => Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(LucideIcons.building2, size: 26, color: AppColors.mint700),
            const SizedBox(height: 10),
            Text('Register as a buyer', textAlign: TextAlign.center, style: AppText.display(22)),
            const SizedBox(height: 5),
            const Text('Create an account to request recovered materials.', textAlign: TextAlign.center, style: AppText.small),
            const SizedBox(height: 22),
            _field('FULL NAME', _fullName, required: true, textCapitalization: TextCapitalization.words),
            _field('EMAIL', _email, required: true, keyboardType: TextInputType.emailAddress),
            _field('PASSWORD', _password, required: true, obscureText: true, helper: 'At least 6 characters'),
            _field('PHONE', _phone, keyboardType: TextInputType.phone),
            _field('COMPANY NAME', _company, required: true, textCapitalization: TextCapitalization.words),
            _field('CONTACT PERSON', _contact, required: true, textCapitalization: TextCapitalization.words),
            _field('ADDRESS', _address, maxLines: 2, textCapitalization: TextCapitalization.sentences),
            Text('BUYER TYPE', style: AppText.label),
            const SizedBox(height: 5),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(value: 'Local', label: Text('Local'), icon: Icon(LucideIcons.mapPin)),
                ButtonSegment(value: 'Export', label: Text('Export'), icon: Icon(LucideIcons.globe2)),
              ],
              selected: {_buyerType},
              onSelectionChanged: (values) => setState(() => _buyerType = values.first),
              showSelectedIcon: false,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: AppColors.red600, fontSize: 13)),
            ],
            const SizedBox(height: 18),
            AppButton(label: _loading ? 'Creating account…' : 'Create buyer account', loading: _loading, expand: true, onPressed: _submit),
            const SizedBox(height: 8),
            TextButton(onPressed: _loading ? null : () => context.go('/login'), child: const Text('Already registered? Sign in')),
          ],
        ),
      );

  Widget _field(
    String label,
    TextEditingController controller, {
    bool required = false,
    bool obscureText = false,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    int maxLines = 1,
    String? helper,
  }) => Padding(
        padding: const EdgeInsets.only(bottom: 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(label, style: AppText.label),
            const SizedBox(height: 5),
            TextFormField(
              controller: controller,
              obscureText: obscureText,
              keyboardType: keyboardType,
              textCapitalization: textCapitalization,
              maxLines: obscureText ? 1 : maxLines,
              decoration: helper == null ? null : InputDecoration(helperText: helper),
              validator: (value) {
                final text = value?.trim() ?? '';
                if (required && text.isEmpty) return 'This field is required.';
                if (label == 'EMAIL' && !text.contains('@')) return 'Enter a valid email address.';
                if (label == 'PASSWORD' && text.length < 6) return 'Use at least 6 characters.';
                return null;
              },
            ),
          ],
        ),
      );
}

class _RegistrationComplete extends StatelessWidget {
  const _RegistrationComplete({required this.onSignIn});

  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) => Column(
        children: [
          const Icon(LucideIcons.circleCheck, size: 38, color: AppColors.mint700),
          const SizedBox(height: 12),
          Text('Application received', style: AppText.display(21)),
          const SizedBox(height: 8),
          const Text(
            'Your buyer account is pending staff activation. You can sign in after approval to submit and track material requests.',
            textAlign: TextAlign.center,
            style: AppText.body,
          ),
          const SizedBox(height: 20),
          AppButton(label: 'Go to sign in', expand: true, onPressed: onSignIn),
        ],
      );
}