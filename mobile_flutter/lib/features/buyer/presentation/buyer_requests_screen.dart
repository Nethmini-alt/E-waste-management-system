import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_background.dart';
import '../../../core/widgets/glass_card.dart';
import '../../../core/widgets/layout.dart';
import '../application/buyer_providers.dart';
import '../data/buyer_models.dart';

class BuyerRequestsScreen extends ConsumerWidget {
  const BuyerRequestsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(buyerRequestsProvider);
    final user = ref.watch(authControllerProvider).user;
    return Scaffold(
      extendBody: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Buyer portal'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => ref.read(authControllerProvider.notifier).signOut(),
            icon: const Icon(LucideIcons.logOut),
          ),
        ],
      ),
      body: Stack(
        children: [
          const AppBackground(),
          RefreshIndicator(
            color: AppColors.mint600,
            onRefresh: () => ref.refresh(buyerRequestsProvider.future),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
              children: [
                ResponsiveCenter(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text('Hello ${user?.firstName ?? ''}', style: AppText.display(23)),
                      const SizedBox(height: 4),
                      const Text('Request recovered materials and follow each request through fulfillment.', style: AppText.body),
                      const SizedBox(height: 18),
                      FilledButton.icon(
                        onPressed: () async {
                          final created = await showModalBottomSheet<bool>(
                            context: context,
                            isScrollControlled: true,
                            backgroundColor: Colors.transparent,
                            builder: (_) => const _RequestMaterialSheet(),
                          );
                          if (created == true) ref.invalidate(buyerRequestsProvider);
                        },
                        icon: const Icon(LucideIcons.packagePlus, size: 19),
                        label: const Text('Request material'),
                      ),
                      const SizedBox(height: 22),
                      Row(
                        children: [
                          const Expanded(child: SectionTitle('My material requests')),
                          if (requests.hasValue) Text('${requests.value!.length}', style: AppText.small),
                        ],
                      ),
                      const SizedBox(height: 9),
                      switch (requests) {
                        AsyncData(:final value) => _RequestList(
                            requests: value,
                            onCancel: (request) => _cancel(context, ref, request),
                          ),
                        AsyncError(:final error) => _RequestError(
                            message: apiErrorMessage(error, 'Could not load your material requests.'),
                            onRetry: () => ref.invalidate(buyerRequestsProvider),
                          ),
                        _ => const GlassCard(child: Center(child: CircularProgressIndicator())),
                      },
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _cancel(BuildContext context, WidgetRef ref, MaterialRequest request) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel this request?'),
        content: Text('The ${request.materialType} request will be cancelled.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Keep request')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Cancel request')),
        ],
      ),
    );
    if (confirmed != true) return;

    try {
      await ref.read(buyerApiProvider).cancelRequest(request.id);
      ref.invalidate(buyerRequestsProvider);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(apiErrorMessage(error, 'Could not cancel this request.'))));
      }
    }
  }
}

class _RequestList extends StatelessWidget {
  const _RequestList({required this.requests, required this.onCancel});

  final List<MaterialRequest> requests;
  final ValueChanged<MaterialRequest> onCancel;

  @override
  Widget build(BuildContext context) {
    if (requests.isEmpty) {
      return const GlassCard(
        child: Column(
          children: [
            Icon(LucideIcons.inbox, size: 26, color: AppColors.ink600),
            SizedBox(height: 8),
            Text('No material requests yet.', style: AppText.strong),
          ],
        ),
      );
    }
    return Column(
      children: [
        for (final request in requests)
          Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: GlassCard(
              padding: const EdgeInsets.all(15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(child: Text(request.materialType, style: AppText.display(16))),
                      _RequestStatus(status: request.status),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('${request.quantityKg.toStringAsFixed(2)} kg · Requested ${_shortDate(request.createdAt)}', style: AppText.small),
                  if (request.lastMatchingNote?.isNotEmpty == true) ...[
                    const SizedBox(height: 9),
                    Text(request.lastMatchingNote!, style: AppText.body),
                  ] else if (request.commercialPlanId != null) ...[
                    const SizedBox(height: 9),
                    const Text('A material plan is being prepared.', style: AppText.small),
                  ],
                  if (request.canCancel) ...[
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton.icon(
                        onPressed: () => onCancel(request),
                        icon: const Icon(LucideIcons.x, size: 16),
                        label: const Text('Cancel request'),
                        style: TextButton.styleFrom(foregroundColor: AppColors.red600),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
      ],
    );
  }
}

class _RequestStatus extends StatelessWidget {
  const _RequestStatus({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final (label, color, background) = switch (status) {
      'Waiting' => ('Waiting', AppColors.amber800, AppColors.amber100),
      'WaitingForPrice' => ('Waiting for price', AppColors.amber800, AppColors.amber100),
      'GeneratingPlan' => ('Preparing plan', const Color(0xFF075985), const Color(0xFFE0F2FE)),
      'PlanGenerated' => ('Plan ready', AppColors.mint700, AppColors.mint100),
      'PlanGenerationFailed' => ('Retrying plan', AppColors.red600, AppColors.red50),
      'OrderPlaced' => ('Order placed', AppColors.mint700, AppColors.mint100),
      'Fulfilled' => ('Fulfilled', AppColors.mint700, AppColors.mint100),
      _ => ('Cancelled', AppColors.ink600, AppColors.mint50),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
      decoration: BoxDecoration(color: background, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
    );
  }
}

class _RequestError extends StatelessWidget {
  const _RequestError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => GlassCard(
        child: Column(
          children: [
            Text(message, style: AppText.body),
            const SizedBox(height: 8),
            TextButton.icon(onPressed: onRetry, icon: const Icon(LucideIcons.refreshCw, size: 16), label: const Text('Try again')),
          ],
        ),
      );
}

class _RequestMaterialSheet extends ConsumerStatefulWidget {
  const _RequestMaterialSheet();

  @override
  ConsumerState<_RequestMaterialSheet> createState() => _RequestMaterialSheetState();
}

class _RequestMaterialSheetState extends ConsumerState<_RequestMaterialSheet> {
  final _formKey = GlobalKey<FormState>();
  final _materialType = TextEditingController();
  final _quantityKg = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _materialType.dispose();
    _quantityKg.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Container(
          padding: const EdgeInsets.fromLTRB(20, 14, 20, 22),
          decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(22))),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(children: [
                  const Expanded(child: Text('Request material', style: AppText.strong)),
                  IconButton(tooltip: 'Close', onPressed: () => Navigator.pop(context), icon: const Icon(LucideIcons.x)),
                ]),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _materialType,
                  maxLength: 100,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Material type', hintText: 'e.g. Copper'),
                  validator: (value) => value == null || value.trim().isEmpty ? 'Enter a material type.' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: _quantityKg,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(labelText: 'Quantity (kg)'),
                  validator: (value) {
                    final quantity = double.tryParse(value?.trim() ?? '');
                    if (quantity == null || quantity <= 0 || quantity > 1000000) return 'Enter a quantity greater than 0 and no more than 1,000,000 kg.';
                    return null;
                  },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 10),
                  Text(_error!, style: const TextStyle(color: AppColors.red600, fontSize: 13)),
                ],
                const SizedBox(height: 14),
                FilledButton.icon(
                  onPressed: _saving ? null : _submit,
                  icon: _saving ? const SizedBox(width: 17, height: 17, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)) : const Icon(LucideIcons.packagePlus, size: 18),
                  label: Text(_saving ? 'Submitting…' : 'Submit request'),
                ),
              ],
            ),
          ),
        ),
      );

  Future<void> _submit() async {
    if (_saving || !_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(buyerApiProvider).requestMaterial(
            materialType: _materialType.text,
            quantityKg: double.parse(_quantityKg.text.trim()),
          );
      if (mounted) Navigator.pop(context, true);
    } catch (error) {
      if (mounted) setState(() => _error = apiErrorMessage(error, 'Could not submit the material request.'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }
}

String _shortDate(DateTime date) => '${date.day}/${date.month}/${date.year}';