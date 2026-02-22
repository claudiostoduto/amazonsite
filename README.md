# Voglio Solo Risparmiare (Jekyll + GitHub Pages)

Questo pacchetto è **pronto e funzionante subito** senza dipendere dalla Creators API (che può dare 403 AssociateNotEligible).

## Perché manuale?
Amazon ha risposto con:
`403 AccessDeniedException - AssociateNotEligible`  
Questa non è una questione di codice: è un requisito di idoneità dell'account.

## Come pubblichi una nuova offerta
Vai su **Actions → New Deal (Manual...) → Run workflow** e compila:
- Title
- URL Amazon.it
- (opzionale) Image URL, Price, Discount %, Note

Il workflow crea un post in `_posts/`, fa commit, aggiorna GitHub Pages e (se configurato) pubblica su Telegram.

## Secrets (solo questi)
Imposta in **Settings → Secrets and variables → Actions**:
- `AMAZON_ASSOCIATE_TAG` (es. tuo-tag-21)
- `TELEGRAM_BOT_TOKEN` (opzionale)
- `TELEGRAM_CHANNEL_ID` (opzionale)

## Dominio
Il repo include `CNAME` = `vogliosolorisparmiare.it`.
Quando vuoi collegare il dominio: Settings → Pages → Custom domain e poi DNS dal provider.
