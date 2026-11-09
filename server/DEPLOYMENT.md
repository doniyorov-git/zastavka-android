# Zastavka API deployment

This Express service serves the existing Flutter API under `/zastavka-api`, including authenticated Google Play purchase verification. Run it on the same server/database as the existing Zastavka API so that account tokens and coin balances remain in the same SQLite database.

## Configuration

Use Node.js 20.19 or newer. Do not deploy this service to the `103.27.159.104` shared host unless Node.js hosting is enabled; that host did not have Node.js available when inspected. The live API hostname currently resolves to a different server.

Set the variables in `.env.example` through the service manager, not in Flutter or a committed file. `ADMIN_PASSWORD` must be a unique random secret. Keep the Google service-account JSON outside the source checkout, readable only by the service account, and set `GOOGLE_APPLICATION_CREDENTIALS` to that file. Grant that service account the minimum Play Console access needed for this app and enable the Google Play Android Developer API in the linked Cloud project.

For refund notifications, configure a Pub/Sub push subscription with OIDC authentication and set `PUBSUB_OIDC_AUDIENCE` and `PUBSUB_OIDC_SERVICE_ACCOUNT_EMAIL` to the exact audience and push identity. Do not enable unauthenticated push delivery.

Set `ZASTAVKA_DATA_DIR` to the directory containing the existing production `zastavka.sqlite` and uploads. Back up the database before deploying. Do not start this service against an empty production data directory: demo user seeding is disabled in production, and a fresh database would not contain existing users or balances.

## Reverse proxy

Proxy `/zastavka-api/` to `http://127.0.0.1:3050` without stripping the path. Keep HTTPS enabled at the public host. The app calls:

- `GET /zastavka-api/billing/status`
- `POST /zastavka-api/billing/verify` with the signed-in user's bearer token

## Rollout and checks

1. Back up the existing database and service configuration.
2. Deploy the server source and install locked dependencies with `npm ci`.
3. Configure the environment and service-account file outside the repository.
4. Restart the API service and confirm `/zastavka-api/health` returns `200`.
5. Confirm `/zastavka-api/billing/status` returns the three coin product IDs and indicates the credential file is present. `true` confirms the file exists; it does not prove Play Console authorization, which must be checked with a license-tester purchase.
6. Run a purchase through a Play license tester and confirm the purchase is credited once, appears in the ledger, and is consumed.

The production server must be updated before uploading the 1.0.3 AAB for billing. This repository does not contain the live server's database or credentials.
