# Project rules

- Define browser print colors as shared semantic tokens in global CSS; standalone ledger windows copy these tokens so every printed document stays consistent without changing screen styling.
- Keep salary revision resolution in a pure exported function used by the async fetch wrapper so effective-period rules can be tested without database access; retain year/month keys for backward compatibility.
- Reuse the exit-date dialog for creating and editing departures, prefilling existing dates so both rosters follow the same interaction.