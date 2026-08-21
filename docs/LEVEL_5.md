# Level 5 Operations

This folder documents the product-growth submission without overstating progress. The application is deployed on Stellar Testnet; it is not a mainnet financial product.

## Submission assets

- Pitch deck: [`pitch-deck/stellar-lending-level5-pitch.pptx`](pitch-deck/stellar-lending-level5-pitch.pptx)
- Demo recording script: [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)
- Tester guide: [`USER_ONBOARDING.md`](USER_ONBOARDING.md)
- Evidence register: [`evidence/wallet-interactions.csv`](evidence/wallet-interactions.csv)

## Real interaction protocol

The 50-wallet requirement can only be met by 50 real, separate public Testnet wallets. Do not create synthetic addresses, replay one wallet, or report unconfirmed transactions as activity.

1. Invite a tester to open `/app/onboarding` and use Freighter on Stellar Testnet.
2. Have the tester fund their wallet with Friendbot and complete one meaningful action: deposit, borrow, repay, withdraw, or liquidate.
3. Wait 2–3 minutes before the next tester completes their transaction.
4. Record only the public wallet address, action, timestamp, transaction hash, and Stellar Expert link in the evidence register.
5. Verify the transaction in the explorer before marking the row confirmed.
6. Ask the tester for a rating and an optional text comment directly; do not request secret keys, seed phrases, or mainnet funds.

The CSV is deliberately empty until genuine activity occurs. It is a record-keeping template, not proof of activity.

## Product improvements tied to feedback

| Feedback theme | Product response |
|---|---|
| Health-factor display was confusing | Capped the UI representation and clarified the percentage state. |
| Homepage lacked product context | Added a live position preview, protocol parameters, and a Testnet-first CTA. |
| Desktop layout felt too sparse | Expanded the application layout and added desktop two-column content. |
| First interaction needs more guidance | Added `/app/onboarding` with Testnet safety, funding, proof, and action guidance. |
| Wallet changes could show stale data | Cancelled stale dashboard requests and tied loading state to the active address. |

The Level 5 onboarding, deck, and evidence workflow implementation is in [`fc3b65a`](https://github.com/subodhingle/lending-app/commit/fc3b65a651e258db91040071fb1037267deb7418).

## Evidence to attach before submission

- A completed `wallet-interactions.csv` containing 50 verified, unique wallets.
- Explorer screenshots or links for the completed interactions.
- A published demo video following `DEMO_SCRIPT.md`.
- A deployed build containing the onboarding experience.
- A public GitHub commit link for this Level 5 update.

## Known limitations

- Google Forms and a hosted spreadsheet are not part of this iteration, by request. If the programme evaluator strictly requires a Google Form and Excel export, that requirement remains outstanding.
- The cohort count, user ratings, and user feedback are not yet claimed as complete until real participants provide them.
