# Security Best Practices Report

## Executive Summary
- OpenRouter API credentials and the full betting state (teams, bankroll, bet history, AI toggles) are persisted in `localStorage` and rehydrated on every load, which exposes secrets and private data to any script running in the page (XSS, extensions, toolbar widgets).
- There is no Content Security Policy or other HTTP security headers in `index.html`, so even a minor DOM injection would run with no browser-enforced containment.
- The same `localStorage` blob that contains the API key also cements a permanent copy of the user’s bankroll/bet history, creating a data-leakage/privacy vector for compromised origins.

## Findings

### High Severity
#### F1 – REACT-CONFIG-001 (Credential exposure)
- **Severity:** High
- **Location:** `src/App.jsx`:319-381
- **Evidence:** `localStorage.setItem('sportsBettingModel', JSON.stringify({ teamsBySport, bets, gameLog, bankroll, kellyFraction, openRouterApiKey, aiModel, enableWebSearch, sport }));`
- **Impact:** Any successful XSS/extension in the same origin can read `sportsBettingModel`, extract `openRouterApiKey`, and reuse it to call OpenRouter or Web Search APIs; the API key is treated as secret per OpenRouter’s docs but is trivially exfiltrated from localStorage.
- **Fix:** Stop persisting the key—keep it in non-persistent React state (cleared on reload) or proxy the AI calls through a backend that stores the key securely and issues short-lived tokens. If persistence is required, encrypt the key with a user-provided passphrase before writing it back.
- **Mitigation:** Add a strict CSP/Trusted Types policy and only allow scripted sources from your bundle so that stealing values from localStorage becomes harder; pair that with subresource integrity on any third-party additions.
- **False positive notes:** This only matters if the OpenRouter key must remain confidential; if it is shared among several teammates in a trusted internal network, document why persistence is acceptable.

### Medium Severity
#### F2 – REACT-CSP-001 / REACT-HEADERS-001 (No CSP or security headers)
- **Severity:** Medium
- **Location:** `index.html`:1-12
- **Evidence:** No `<meta http-equiv="Content-Security-Policy">`, `nosniff`, `X-Frame-Options`, or other security headers are emitted from the static shell.
- **Impact:** A DOM injection (from a future dependency, browser vulnerability, or a malicious extension) would execute unrestricted scripts, make authenticated requests, and read localStorage; there is no browser-side containment.
- **Fix:** Emit at least a base CSP (`Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none';`) via meta tag or hosting config, add `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, and, if any CDN scripts are needed later, pin them with SRI.
- **Mitigation:** Start by using report-only mode to discover violations, then enforce; combine CSP with SRI and Trusted Types once the app no longer uses any inline scripts/styles without hashes.
- **False positive notes:** If the hosting stack (e.g., CDN or reverse proxy) already injects these headers, the repo-level shell will not show them—verify the deployed headers with `curl -I`.

#### F3 – REACT-NET-001 / privacy (Persistent data leakage)
- **Severity:** Medium
- **Location:** `src/App.jsx`:369-381
- **Evidence:** `const data = { teamsBySport, bets, gameLog, bankroll, kellyFraction, openRouterApiKey, aiModel, enableWebSearch, sport }; localStorage.setItem('sportsBettingModel', JSON.stringify(data));`
- **Impact:** The entire betting history, bankroll, and staking decisions are stored in plain text; any script that runs in the same origin (malicious extension, compromised search plugin, XSS) can copy that blob and exfiltrate detailed wagers and financial data.
- **Fix:** Limit persistence to metadata that the user explicitly consents to (e.g., only team ratings), store bets in sessionStorage, or encrypt the payload with a passphrase that is never stored; add a “Do not persist history” toggle and respect it before writing anything back.
- **Mitigation:** Clear `localStorage` on logout/reset, expire entries regularly, and keep sensitive fields scoped so that only the minimal required data is saved.
- **False positive notes:** If the app is strictly single-user on a locked-down workstation and the user accepts this trade-off, document that decision and require explicit opt-in for persistence.
