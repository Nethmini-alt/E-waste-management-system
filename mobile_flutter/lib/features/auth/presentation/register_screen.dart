import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/form_fields.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/layout.dart';

/// The three roles this app has screens for. Staff/Admin sign up on the web portal, same as
/// the login screen already tells them.
const _roles = ['Household', 'Corporate', 'Collector'];

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullName = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _confirmPassword = TextEditingController();
  String? _role;
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _fullName.dispose();
    _email.dispose();
    _phone.dispose();
    _password.dispose();
    _confirmPassword.dispose();
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
      await ref.read(authControllerProvider.notifier).signUp(
            fullName: _fullName.text,
            email: _email.text,
            password: _password.text,
            phone: _phone.text,
            role: _role!,
          );
      // The router moves on as soon as the session is set (same as sign-in).
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Registration failed. Please try again.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const AppBackground(blobOpacity: 0.35, showYellowBlob: true),
          SafeArea(
            child: Stack(
              children: [
                const Positioned(top: 16, left: 20, child: BrandMark()),
                Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 72, 16, 32),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 420),
                      child: GlassCard(
                        padding: const EdgeInsets.all(32),
                        child: Form(
                          key: _formKey,
                          child: AutofillGroup(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Row(
                                  children: [
                                    const Icon(LucideIcons.userPlus, size: 20, color: AppColors.mint600),
                                    const SizedBox(width: 8),
                                    Text('Create an account', style: AppText.display(20)),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                const Text('Generators (household or corporate) and collectors', style: AppText.small),
                                const SizedBox(height: 20),

                                Text('I AM A', style: AppText.label),
                                const SizedBox(height: 4),
                                AppDropdown<String>(
                                  value: _role,
                                  hint: 'Select a role…',
                                  items: [
                                    for (final r in _roles) DropdownMenuItem(value: r, child: Text(_roleLabel(r))),
                                  ],
                                  onChanged: (v) => setState(() => _role = v),
                                ),
                                if (_role == null)
                                  const Padding(
                                    padding: EdgeInsets.only(top: 4),
                                    child: Text('Choose a role to continue.', style: TextStyle(color: AppColors.red600, fontSize: 12)),
                                  ),
                                const SizedBox(height: 16),

                                Text('FULL NAME', style: AppText.label),
                                const SizedBox(height: 4),
                                TextFormField(
                                  controller: _fullName,
                                  textInputAction: TextInputAction.next,
                                  autofillHints: const [AutofillHints.name],
                                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your full name.' : null,
                                ),
                                const SizedBox(height: 16),

                                Text('EMAIL', style: AppText.label),
                                const SizedBox(height: 4),
                                TextFormField(
                                  controller: _email,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.next,
                                  autofillHints: const [AutofillHints.email],
                                  autocorrect: false,
                                  validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email address.' : null,
                                ),
                                const SizedBox(height: 16),

                                Text('PHONE', style: AppText.label),
                                const SizedBox(height: 4),
                                TextFormField(
                                  controller: _phone,
                                  keyboardType: TextInputType.phone,
                                  textInputAction: TextInputAction.next,
                                  autofillHints: const [AutofillHints.telephoneNumber],
                                  decoration: const InputDecoration(hintText: '07XXXXXXXX'),
                                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter a phone number.' : null,
                                ),
                                const SizedBox(height: 16),

                                Text('PASSWORD', style: AppText.label),
                                const SizedBox(height: 4),
                                TextFormField(
                                  controller: _password,
                                  obscureText: _obscure,
                                  textInputAction: TextInputAction.next,
                                  autofillHints: const [AutofillHints.newPassword],
                                  validator: (v) => (v == null || v.length < 6) ? 'At least 6 characters.' : null,
                                  decoration: InputDecoration(
                                    suffixIcon: IconButton(
                                      tooltip: _obscure ? 'Show password' : 'Hide password',
                                      onPressed: () => setState(() => _obscure = !_obscure),
                                      icon: Icon(_obscure ? LucideIcons.eye : LucideIcons.eyeOff, size: 18, color: AppColors.ink600),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 16),

                                Text('CONFIRM PASSWORD', style: AppText.label),
                                const SizedBox(height: 4),
                                TextFormField(
                                  controller: _confirmPassword,
                                  obscureText: _obscure,
                                  textInputAction: TextInputAction.done,
                                  onFieldSubmitted: (_) => _submit(),
                                  validator: (v) => v != _password.text ? 'Passwords do not match.' : null,
                                ),

                                if (_error != null) ...[
                                  const SizedBox(height: 16),
                                  _InlineError(text: _error!),
                                ],
                                const SizedBox(height: 24),
                                AppButton(
                                  label: _loading ? 'Creating account…' : 'Create account',
                                  loading: _loading,
                                  expand: true,
                                  onPressed: _role == null ? null : _submit,
                                ),
                                const SizedBox(height: 20),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Text('Already have an account?', style: AppText.small),
                                    TextButton(
                                      onPressed: _loading ? null : () => context.go('/login'),
                                      child: const Text('Sign in'),
                                    ),
                                  ],
                                ),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Flexible(child: Text('Buying recovered materials?', style: AppText.small)),
                                    TextButton(
                                      onPressed: _loading ? null : () => context.go('/register/buyer'),
                                      child: const Text('Register as buyer'),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static String _roleLabel(String role) => switch (role) {
        'Household' => 'Household — submit e-waste from home',
        'Corporate' => 'Corporate — submit e-waste for a business',
        'Collector' => 'Collector — pick up e-waste',
        _ => role,
      };
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: AppColors.red50, borderRadius: BorderRadius.circular(AppRadius.input)),
      child: Row(
        children: [
          const Icon(LucideIcons.circleAlert, size: 16, color: AppColors.red600),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 14, color: AppColors.red600))),
        ],
      ),
    );
  }
}
