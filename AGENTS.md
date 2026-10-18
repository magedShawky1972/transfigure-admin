# Architecture rules

- Product API upserts must use each target table's unique identity (production product ID, test SKU), because production SKUs are not unique.