# Voglio Solo Risparmiare (Jekyll + GitHub Pages)

Sito statico per pubblicare offerte (post brevi) e inviarle automaticamente su Telegram.

## Secrets (GitHub Actions)

Imposta questi secrets su **Settings → Secrets and variables → Actions**:

- `CREATORS_CREDENTIAL_ID`
- `CREATORS_CREDENTIAL_SECRET`
- `CREATORS_CREDENTIAL_VERSION` (es. `2.2`)
- `AMAZON_ASSOCIATE_TAG` (es. `tuotag-21`)
- `TELEGRAM_BOT_TOKEN` (opzionale)
- `TELEGRAM_CHANNEL_ID` (opzionale, es. `@nomecanale`)

## Nuova offerta

Vai su **Actions → New Deal** → Run workflow, e incolla:
- ASIN (10 caratteri) **oppure** URL Amazon.it
- nota (opzionale)

Lo script crea un file in `_posts/`, fa commit e aggiorna il sito.

## Dominio

Il repo include `CNAME` = `vogliosolorisparmiare.it`.
Quando vuoi passare al dominio, vai in **Settings → Pages** e imposta il Custom domain, poi configura i DNS.
