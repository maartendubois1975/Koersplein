# Koersplein Europe — Block 2 identity registry acceptance

Status: TECHNICAL FOUNDATION PASSED; OFFICIAL SOURCE CERTIFICATION BLOCKED.

## Verified execution
- GitHub Actions run: https://github.com/maartendubois1975/Koersplein/actions/runs/38687268661
- Head commit: e99f4505a685da2a76f010e067e8dc35cafbc6af
- Workflow result: SUCCESS.
- Block 2 evidence artifact: block2-31-market-identity-manifest, ID 11951017296, 345089 bytes, SHA256 ab337f3a008de82ae5dc86cd44f8e9e50a940481ecafdc7d5739ed6160c30f7b.
- The artifact includes a report for 31 markets and marks independently certified count as zero. The manifest process exits nonzero deliberately until source verification exists; the test expects this fail-closed result.

## What is implemented
- Deterministic MIC + symbol + ISIN identities and SHA256 fingerprints.
- ISIN checksum validation, explicit share-type restriction, MIC mismatch and duplicate listing rejection.
- Catalog-embedded source metadata is insufficient to certify independent provenance.
- 31-market manifest generation, unit tests, workflow execution and archived evidence.

## What is not proven
- Independent official source retrieval, snapshot fingerprint, reviewer attestations against primary exchange records, rights and timestamp validity.
- Cross-venue duplicates, listing validity intervals, ticker changes, delistings and historical universe membership.
- Real approved ordinary-share counts. Existing COMPLETE markers are not acceptance evidence.

## Required for Block 2 data acceptance
1. Register trusted official sources per MIC, including legal usage and freshness requirements.
2. Independently ingest signed or hashed primary-source snapshots with durable capture timestamps.
3. Reconcile all candidate listings by MIC, ISIN, type and validity interval; quarantine every unresolved conflict.
4. Run 31-market source checks, produce accepted/rejected counts and independently review sample/exception evidence.
5. Promote only externally verified listings to an immutable catalog. Never promote merely to make the tests green.

No merge to main, production write, or live publication is authorized by this report.
