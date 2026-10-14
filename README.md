# NickApp

Personal daily-priorities scorecard. Full spec: [nickapp-spec.md](nickapp-spec.md).

- `web/` — field app (PWA), deployed to GitHub Pages by `.github/workflows/pages.yml`.
- `apps-script/` — data service + Trends, bound to the NickApp Sheet, pushed with clasp.

## Environments

| | Sheet | Script | Web-app deployment |
|---|---|---|---|
| **Live** | [NickApp](https://docs.google.com/spreadsheets/d/161-JcM656--auzYZiINaF31uUfgnAALfjfH60TpBgM4) | `1wc1KNwlejVFAJ9sl3dm0njYtS8CdUIIwcoaJc4ufnrNFHSBWuys15Iop` | `AKfycby48oBTLtSi5hHRezoWmb22fvTAUu2GAvmQJ8MO6AiM_A7NMY3iFoMZUGsvO-Hj_EJ-` |
| **Test** | [NickApp TEST](https://docs.google.com/spreadsheets/d/1VMFK6nIFgdE8Vo7STqGCHvfUhWxuOBMa3-wtVWqoSPw) | `1pkzUyfv7Mh-ScCR4-xtSWV29-SYp-SvPtV2qax3e0Yry4TkuCC-3B_Cg` | `AKfycbwRVJ2wlNJf0-Y9fJjoI1fqMPsBPRva8kWU8YyzCFN102TsGdJdsaAqkuFC-1nNYXMebw` |

Both run as nick@uptopacres.com. The PWA uses live by default; add `?env=test` to the
Pages URL to hit the test backend.

## Deploy

**PWA:** push to `main`; the Pages workflow publishes `web/`.

**Apps Script** (run from `apps-script/`). Test first, then live. Redeploying to the
existing deployment id keeps the `/exec` URL stable.

```powershell
# test  (-P needs a Windows backslash path; clasp 3.4 rejects forward slashes)
clasp -P "$PWD\.clasp.test.json" push -f
clasp -P "$PWD\.clasp.test.json" redeploy AKfycbwRVJ2wlNJf0-Y9fJjoI1fqMPsBPRva8kWU8YyzCFN102TsGdJdsaAqkuFC-1nNYXMebw -d "msg"

# live
clasp push -f
clasp redeploy AKfycby48oBTLtSi5hHRezoWmb22fvTAUu2GAvmQJ8MO6AiM_A7NMY3iFoMZUGsvO-Hj_EJ- -d "msg"
```
