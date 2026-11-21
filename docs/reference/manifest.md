# Reference figures (draft, main 232ab91a: a dry run, small)

- Commit: `92799e20`, holding main at `232ab91a`
- Taken: 2026-11-21 08:21 UTC, finished in 16 minutes
- How it is read: docs/REFERENCE.md. How it was taken: `QUICK=1 npm run reference` (scripts/reference.mjs).

| Step | Minutes | File | Asking |
| --- | --- | --- | --- |
| Shared report | 1 | `health-a-plain.md` | HEALTH=1 CAMPAIGNS=16 FIRST=1 |
|  |  | `health-a-answer.md` | HEALTH=1 CAMPAIGNS=16 FIRST=1 STORIES=answer |
|  |  | `health-b-plain.md` | HEALTH=1 CAMPAIGNS=16 FIRST=17 |
|  |  | `health-b-answer.md` | HEALTH=1 CAMPAIGNS=16 FIRST=17 STORIES=answer |
| Round of fifteen | 15 | `round.txt` | ROUND=1 SEED0=0 SEED1=1 |
|  |  | `round.txt` | ROUND=1 SEED0=1 SEED1=2 |
|  |  | `round.txt` | ROUND=1 SEED0=2 SEED1=3 |
|  |  | `round.txt` | ROUND=1 SEED0=3 SEED1=4 |
| Round table | 0 | `round.txt` | ROUND=1 SEED0=0 SEED1=4 |
| Fingerprint | 1 | `fingerprint.txt` | FINGERPRINT=1 |

| File | sha256 (first 16) |
| --- | --- |
| `fingerprint.txt` | f8a79857fa5c3292 |
| `health-a-answer.md` | 1484455c2de1b155 |
| `health-a-answer.md.sparse.json` | 56ca1e614b92e4e2 |
| `health-a-plain.md` | c800c7756b76e459 |
| `health-a-plain.md.sparse.json` | dcc85ad6c550aa4e |
| `health-b-answer.md` | 04d777cb2b413086 |
| `health-b-answer.md.sparse.json` | 522f848ea2a483c4 |
| `health-b-plain.md` | 32742deea42dcb94 |
| `health-b-plain.md.sparse.json` | 92029265db3a31b5 |
| `round.txt` | 33ea4bd7c41ac9d5 |
| `round.txt.md` | 8a8ab19ca56a0535 |
