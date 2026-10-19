# Architecture rules

- Product API upserts must use each target table's unique identity (production product ID, test SKU), because production SKUs are not unique.
- Customers Without Orders uses a paginated security-invoker RPC matching customer phone against non-deleted Purpletransaction orders with inclusive integer date bounds, to preserve RLS and avoid downloading the transaction history. The RPC only lists customers whose registration date falls inside the selected From–To window (inclusive), so only customers registered in that period are reported.