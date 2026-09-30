import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/auth/auth_controller.dart';
import '../../../core/network/api_client.dart';
import '../data/buyer_api.dart';
import '../data/buyer_models.dart';

final buyerApiProvider = Provider<BuyerApi>((ref) => BuyerApi(ref.watch(dioProvider)));

final buyerRequestsProvider = FutureProvider<List<MaterialRequest>>((ref) {
  ref.watch(authControllerProvider.select((state) => state.user?.userId));
  return ref.watch(buyerApiProvider).myRequests();
});