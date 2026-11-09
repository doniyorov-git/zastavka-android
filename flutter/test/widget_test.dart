import 'package:flutter_test/flutter_test.dart';
import 'package:zastavka/models.dart';

void main() {
  test('usdForCoins packs', () {
    expect(usdForCoins(100), 1);
    expect(usdForCoins(300), 3);
    expect(usdForCoins(500), 5);
  });
}
