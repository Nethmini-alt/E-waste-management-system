import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/app_button.dart';
import '../../../core/widgets/feedback.dart';
import '../../../core/widgets/form_fields.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/layout.dart';
import '../application/collector_providers.dart';

/// Shown once, right after a Collector's first login, before they can reach anything else —
/// CollectorsController.CreateProfile has no default vehicle/capacity, so this can't be skipped.
class CollectorProfileSetupScreen extends ConsumerStatefulWidget {
  const CollectorProfileSetupScreen({super.key});

  @override
  ConsumerState<CollectorProfileSetupScreen> createState() => _CollectorProfileSetupScreenState();
}

class _CollectorProfileSetupScreenState extends ConsumerState<CollectorProfileSetupScreen> {
  final _formKey = GlobalKey<FormState>();
  final _vehicleType = TextEditingController();
  final _capacityKg = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _vehicleType.dispose();
    _capacityKg.dispose();
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
      await ref.read(collectorApiProvider).createProfile(
            vehicleType: _vehicleType.text.trim(),
            capacityKg: parseDecimal(_capacityKg.text) ?? 0,
          );
      // The router re-checks this once it's invalidated and moves on to the job list.
      ref.invalidate(collectorProfileProvider);
    } catch (e) {
      if (mounted) setState(() => _error = apiErrorMessage(e, 'Could not create your profile.'));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          const AppBackground(blobOpacity: 0.35),
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(16),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: GlassCard(
                    padding: const EdgeInsets.all(28),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Align(alignment: Alignment.centerLeft, child: BrandMark()),
                          const SizedBox(height: 20),
                          const Icon(LucideIcons.truck, size: 32, color: AppColors.mint600),
                          const SizedBox(height: 12),
                          Text('Set up your collector profile', textAlign: TextAlign.center, style: AppText.display(18)),
                          const SizedBox(height: 6),
                          const Text(
                            'One-time setup so jobs can be matched to your vehicle.',
                            textAlign: TextAlign.center,
                            style: AppText.small,
                          ),
                          const SizedBox(height: 20),
                          LabeledField(
                            label: 'Vehicle type',
                            child: TextFormField(
                              controller: _vehicleType,
                              decoration: const InputDecoration(hintText: 'e.g. Van, Three-wheeler, Truck'),
                              validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your vehicle type.' : null,
                            ),
                          ),
                          const SizedBox(height: 16),
                          LabeledField(
                            label: 'Capacity',
                            child: DecimalField(controller: _capacityKg, hint: '0.0'),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 16),
                            Notice(tone: NoticeTone.error, message: _error),
                          ],
                          const SizedBox(height: 24),
                          AppButton(
                            label: _loading ? 'Saving…' : 'Save and continue',
                            loading: _loading,
                            expand: true,
                            onPressed: _submit,
                          ),
                          const SizedBox(height: 12),
                          AppButton.secondary(
                            label: 'Sign out',
                            icon: LucideIcons.logOut,
                            expand: true,
                            onPressed: _loading ? null : () => ref.read(authControllerProvider.notifier).signOut(),
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
    );
  }
}
