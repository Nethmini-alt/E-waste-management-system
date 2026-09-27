import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/layout.dart';

/// Sign in — the same screen as the web app's LoginPage/AuthShell: circuit background, colour
/// blobs, brand mark top-left and a glass card with email + password.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
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
      await ref.read(authControllerProvider.notifier).signIn(_email.text, _password.text);
      // The router moves on as soon as the session is set.
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Login failed. Check your credentials.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final reason = ref.watch(authControllerProvider.select((s) => s.signedOutReason));

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
                      constraints: const BoxConstraints(maxWidth: 384),
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
                                    const Icon(LucideIcons.logIn, size: 20, color: AppColors.mint600),
                                    const SizedBox(width: 8),
                                    Text('Sign in', style: AppText.display(20)),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                const Text('Warehouse staff and admins', style: AppText.small),
                                if (reason != null && _error == null) ...[
                                  const SizedBox(height: 16),
                                  _InlineMessage(text: reason, icon: LucideIcons.clock, color: AppColors.amber800, background: AppColors.amber50),
                                ],
                                const SizedBox(height: 20),
                                Text('EMAIL', style: AppText.label),
                                const SizedBox(height: 4),
                                TextFormField(
                                  controller: _email,
                                  keyboardType: TextInputType.emailAddress,
                                  textInputAction: TextInputAction.next,
                                  autofillHints: const [AutofillHints.email],
                                  autocorrect: false,
                                  validator: (v) => (v == null || !v.contains('@')) ? 'Enter your email address.' : null,
                                ),
                                const SizedBox(height: 16),
                                Text('PASSWORD', style: AppText.label),
                                const SizedBox(height: 4),
                                TextFormField(
                                  controller: _password,
                                  obscureText: _obscure,
                                  textInputAction: TextInputAction.done,
                                  autofillHints: const [AutofillHints.password],
                                  onFieldSubmitted: (_) => _submit(),
                                  validator: (v) => (v == null || v.isEmpty) ? 'Enter your password.' : null,
                                  decoration: InputDecoration(
                                    suffixIcon: IconButton(
                                      tooltip: _obscure ? 'Show password' : 'Hide password',
                                      onPressed: () => setState(() => _obscure = !_obscure),
                                      icon: Icon(_obscure ? LucideIcons.eye : LucideIcons.eyeOff, size: 18, color: AppColors.ink600),
                                    ),
                                  ),
                                ),
                                if (_error != null) ...[
                                  const SizedBox(height: 16),
                                  _InlineMessage(text: _error!, icon: LucideIcons.circleAlert, color: AppColors.red600, background: AppColors.red50),
                                ],
                                const SizedBox(height: 24),
                                AppButton(
                                  label: _loading ? 'Signing in…' : 'Sign in',
                                  loading: _loading,
                                  expand: true,
                                  onPressed: _submit,
                                ),
                                const SizedBox(height: 20),
                                const Text(
                                  "Don't have an account? Sign up on the web portal.",
                                  textAlign: TextAlign.center,
                                  style: AppText.small,
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
}

/// `flex items-center gap-2 text-sm px-3 py-2 rounded-xl` message line from the web login form.
class _InlineMessage extends StatelessWidget {
  const _InlineMessage({required this.text, required this.icon, required this.color, required this.background});

  final String text;
  final IconData icon;
  final Color color;
  final Color background;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(AppRadius.input)),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: TextStyle(fontSize: 14, color: color))),
        ],
      ),
    );
  }
}
