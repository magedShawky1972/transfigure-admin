# Architecture rules

- The six incoming sales/catalog APIs await the shared KOON gateway relay only after successful local saves; expose and audit a separate delivery result without rolling back local data or automatically retrying insert-only payments. Admin users may manually retry only failed KOON log entries through the authenticated retry function, which relays the saved KOON body without repeating the local save.

- Custom outgoing email transports must check the shared email-policy before any SMTP/provider connection; email-only handlers reject disabled requests before side effects, while mixed workflows keep their non-email operations running.

- Product API upserts must use each target table's unique identity (production product ID, test SKU), because production SKUs are not unique.
- Customers Without Orders uses a paginated security-invoker RPC matching customer phone against non-deleted Purpletransaction orders with inclusive integer date bounds, to preserve RLS and avoid downloading the transaction history. The RPC only lists customers whose registration date falls inside the selected From–To window (inclusive), so only customers registered in that period are reported.
- Payment Method Report uses a paginated security-invoker daily aggregation of non-deleted transactions using integer dates; its RPC and page enforce the latest Reports/payment-method permission or server-validated admin role, so direct calls cannot bypass report security.