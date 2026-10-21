// ShoeLab emails — Italiano: the Italian translation of en.js (format and rules in en.js's header).
export default {
  _: {
    hi: 'Ciao {name},', hiAll: 'Ciao,',
    signoff: 'A presto,\nShoeLab', team: 'Il team ShoeLab', vaultTeam: 'Il team di ShoeLab Vault',
    readIn: 'Leggi questa email in un’altra lingua:',
    footer: 'ShoeLab · Studio di cura delle sneaker · Brema',
    footerVault: 'ShoeLab Vault · rivendita di sneaker autenticate di ShoeLab, Brema',
    replyHint: 'Domande? Rispondi pure a questa email.',
    whatsapp: 'Puoi anche scriverci su WhatsApp: +49 177 2258878.',
    dropoffTitle: 'Dove portare le scarpe:', dropoffLater: 'Prima dell’appuntamento ti invieremo su WhatsApp l’indirizzo esatto dove portare le scarpe.',
    // table labels
    ref: 'Riferimento', when: 'Quando', service: 'Servizio', plan: 'Piano', amount: 'Importo', toPay: 'Da pagare in studio', paid: 'Pagato',
    item: 'Articolo', auth: 'Autenticazione', ship: 'Spedizione', total: 'Totale', commission: 'Commissione ShoeLab',
    postage: 'Rimborso spese postali', payout: 'Accredito al venditore', order: 'Ordine', tracking: 'Tracciamento', size: 'Taglia', price: 'Prezzo',
    tier: 'Verifica', format: 'Formato', seller: 'Venditore', buyer: 'Acquirente', email: 'Email', phone: 'Telefono',
    name: 'Nome', notes: 'Note', language: 'Lingua', payment: 'Pagamento', status: 'Stato', category: 'Argomento',
    oneTime: 'Una tantum', monthly: 'Abbonamento mensile', atStudio: 'In studio — ancora nessun addebito', online: 'Online con Stripe',
    whenAt: '{date}, ore {time}',
    // shared sentences and words
    tierLab: 'Lab Verified', tierPhoto: 'Photo Verified', auction: 'Asta', fixed: 'Compralo Subito',
    nextPhotoCheck: 'Ora uno specialista ShoeLab esamina le tue foto per verificare l’autenticità del paio. Se tutto torna, l’annuncio va online con il badge Photo Verified.',
    nextLabCheck: 'Diamo una rapida occhiata all’annuncio e lo mettiamo online. Quando il paio viene venduto, lo spedisci al nostro lab e uno specialista lo autentica a mano prima che prosegua verso l’acquirente.',
    liveLab: 'Gli acquirenti lo vedono già e sanno che il nostro lab lo controllerà a mano prima della spedizione.',
    livePhoto: 'I nostri specialisti hanno controllato le tue foto, quindi l’annuncio mostra il badge Photo Verified.',
    paidNextLab: 'Ora il venditore spedisce il paio al nostro lab. Uno specialista lo autentica prima che prosegua verso di te.',
    paidNextPhoto: 'Ora il venditore ti spedisce il paio. Riceverai il numero di tracciamento via email.',
    shipLab: 'Spedisci il paio a ShoeLab per l’autenticazione — non all’acquirente. Metti nella scatola un biglietto con il numero d’ordine #{order}, poi inserisci il numero di tracciamento nel tuo Vault.',
    shipPhoto: 'Spedisci il paio direttamente all’acquirente, poi inserisci il numero di tracciamento nel tuo Vault. Ecco l’indirizzo:',
    labAddressLater: 'Ti invieremo via email l’indirizzo del lab ShoeLab entro un giorno lavorativo.',
    // how an order came to count as delivered (studio payout emails)
    howBuyer: 'l’acquirente ha confermato la consegna', howAuto: 'automaticamente, 14 giorni dopo la spedizione',
    howReleased: 'segnalazione chiusa a favore del venditore', howRetry: 'accredito ritentato',
    payoutAfterLab: 'Riceverai {payout} quando il paio avrà superato il controllo nel nostro lab e sarà arrivato all’acquirente.',
    payoutAfterDelivery: 'Riceverai {payout} quando l’acquirente avrà ricevuto il paio.',
    ratePos: 'positivo', rateNeu: 'neutro', rateNeg: 'negativo',
    catOrder: 'Problema con un ordine', catPayment: 'Pagamento o accredito', catAccount: 'Account', catAuth: 'Autenticazione', catTech: 'Problema tecnico', catOther: 'Altro',
    statusOpen: 'Aperta', statusAnswered: 'Risposta inviata',
  },

  /* ── bookings ─────────────────────────────────────────────────────── */
  bookingReserved: {
    s: 'Prenotazione ShoeLab effettuata — {ref}',
    b: ['Ciao {name},', 'Abbiamo riservato il tuo appuntamento da ShoeLab.', '%rows', '%dropoff',
      'Vuoi cambiare qualcosa? Rispondi pure a questa email o scrivici su WhatsApp al +49 177 2258878.', '{signoff}'],
  },
  bookingRequested: {
    s: 'La tua richiesta di prenotazione ShoeLab — {ref}',
    b: ['Ciao {name},', 'Grazie per aver prenotato da ShoeLab. Abbiamo ricevuto la tua richiesta:', '%rows',
      'Riceverai una conferma a parte non appena il pagamento sarà andato a buon fine. Se hai chiuso la pagina di pagamento prima di completarlo, rispondi a questa email e ti riserveremo comunque l’appuntamento.',
      '{signoff}'],
  },
  bookingPaid: {
    s: 'Pagamento confermato — il tuo appuntamento ShoeLab {ref}',
    b: ['Ciao {name},', 'Il pagamento è andato a buon fine e il tuo appuntamento è confermato.', '%rows', '%dropoff',
      'La maggior parte dei trattamenti si conclude entro 48 ore.', 'Domande? Rispondi qui o scrivici su WhatsApp al +49 177 2258878.', '{signoff}'],
  },

  /* ── account ──────────────────────────────────────────────────────── */
  verifyEmail: {
    s: 'Conferma il tuo indirizzo email',
    b: ['Ciao {name},', 'Ti diamo il benvenuto su ShoeLab. Conferma che questo è il tuo indirizzo email: così il tuo account resta protetto e puoi fare offerte, comprare e vendere su ShoeLab Vault.',
      'Il link è valido per 7 giorni.', 'Se non hai creato un account, puoi ignorare questa email.'],
    c: 'Conferma la mia email',
  },
  passwordReset: {
    s: 'Reimposta la tua password ShoeLab',
    b: ['Ciao {name},', 'Abbiamo ricevuto una richiesta di reimpostazione della tua password ShoeLab. Usa il pulsante entro 1 ora per sceglierne una nuova.',
      'Se non l’hai chiesto tu, puoi tranquillamente ignorare questa email.'],
    c: 'Scegli una nuova password',
  },

  /* ── Vault: listings ──────────────────────────────────────────────── */
  listingSubmitted: {
    s: 'Stiamo controllando il tuo annuncio',
    b: ['Ciao {name},', 'Grazie per aver messo in vendita il tuo paio di {title} (EU {size}).', '{next}', 'Di solito ci vuole meno di un giorno lavorativo.'],
    c: 'Vedi il tuo annuncio',
  },
  listingLive: {
    s: 'Il tuo paio di {title} è online',
    b: ['Ciao {name},', 'Ottime notizie: il tuo paio di {title} ora è online su ShoeLab Vault.', '{note}'],
    c: 'Guarda il tuo annuncio',
  },
  listingRejected: {
    s: 'Non abbiamo potuto approvare il tuo annuncio: {title}',
    b: ['Ciao {name},', 'Il nostro specialista non ha potuto approvare questo annuncio:', '%message', 'Puoi pubblicarlo di nuovo quando vuoi, dopo aver risolto il problema.'],
    c: 'Metti in vendita un paio',
  },
  auctionNoBids: {
    s: 'La tua asta si è conclusa senza offerte',
    b: ['Ciao {name},', 'Il tuo paio di {title} non ha ricevuto offerte. Puoi rimetterlo in vendita con un clic — con un prezzo di partenza più basso o con Compralo Subito. Le tue foto restano salvate.'],
    c: 'Rimettilo in vendita',
  },

  /* ── Vault: bids and offers ───────────────────────────────────────── */
  outbid: {
    s: 'La tua offerta per {title} è stata superata',
    b: ['Ciao {name},', 'Qualcuno ha fatto un’offerta più alta per {title}. Ora il prezzo è {price}.', 'Rilancia prima che l’asta finisca.'],
    c: 'Rilancia',
  },
  offerReceived: {
    s: 'Nuova proposta: {amount} per {title}',
    b: ['Ciao {name},', 'Qualcuno ha proposto {amount} per il tuo paio di {title} (in vendita a {price}).', '%message', 'Accetta, rifiuta o fai una controproposta entro 48 ore.'],
    c: 'Rispondi alla proposta',
  },
  offerDeclined: {
    s: 'La tua proposta è stata rifiutata',
    b: ['Ciao {name},', 'La tua proposta di {amount} per {title} è stata rifiutata. Puoi ancora acquistare il paio al prezzo dell’annuncio o fare una nuova proposta.'],
    c: 'Vedi il paio',
  },
  counterOffer: {
    s: 'Controproposta: {amount} per {title}',
    b: ['Ciao {name},', 'Il venditore ha risposto alla tua proposta di {offer} per {title} con una controproposta di {amount}.', 'Accetta o rifiuta entro 48 ore.'],
    c: 'Rispondi alla controproposta',
  },

  /* ── Vault: the sale ──────────────────────────────────────────────── */
  boughtNow: {
    s: 'Hai acquistato {title}',
    b: ['Ciao {name},', 'Hai acquistato un paio di {title} (EU {size}).', '%rows', 'Completa il pagamento entro 72 ore per assicurarti il paio.'],
    c: 'Paga ora',
  },
  wonAuction: {
    s: 'Hai vinto l’asta per {title}',
    b: ['Ciao {name},', 'Complimenti — hai vinto l’asta per {title} (EU {size}).', '%rows', 'Completa il pagamento entro 72 ore per assicurarti il paio.'],
    c: 'Paga ora',
  },
  offerAccepted: {
    s: 'La tua proposta è stata accettata: {title}',
    b: ['Ciao {name},', 'Il venditore ha accettato la tua proposta per {title} (EU {size}).', '%rows', 'Completa il pagamento entro 72 ore per assicurarti il paio.'],
    c: 'Paga ora',
  },
  sold: {
    s: 'Venduto: {title}',
    b: ['Ciao {name},', 'Il tuo paio di {title} è stato venduto a {price}.', '{payoutLine}', 'Ti invieremo via email le istruzioni per la spedizione appena l’acquirente avrà pagato. Per ora non devi spedire nulla.'],
  },
  paymentManual: {
    s: 'Pagamento per {title}',
    b: ['Ciao {name},', 'Grazie. Entro un giorno lavorativo ti invieremo via email i dati per pagare {amount}. Nel frattempo il paio resta riservato per te.'],
  },
  paidShip: {
    s: 'Pagamento ricevuto — spedisci {title}',
    b: ['Ciao {name},', 'L’acquirente ha completato il pagamento per {title} (ordine #{order}).', '{howToShip}', '%address', 'Ti chiediamo di spedire il paio entro tre giorni lavorativi.'],
    c: 'Inserisci il numero di tracciamento',
  },
  paymentReceived: {
    s: 'Pagamento ricevuto per {title}',
    b: ['Ciao {name},', 'Grazie — abbiamo ricevuto il tuo pagamento di {amount} per {title}.', '{next}'],
    c: 'Segui il tuo ordine',
  },
  shippedToBuyer: {
    s: 'Il tuo paio di {title} è in viaggio',
    b: ['Ciao {name},', 'Il venditore ha spedito il tuo paio.', '%rows', 'Quando arriva, controllalo e conferma la consegna — oppure segnala un problema prima di confermarla.'],
    c: 'Conferma la consegna',
  },
  unpaidCancelled: {
    s: 'Vendita annullata — l’acquirente non ha pagato',
    b: ['Ciao {name},', 'L’acquirente non ha pagato entro 72 ore, quindi l’ordine #{order} per {title} è stato annullato. Puoi rimettere in vendita il paio con un clic.'],
    c: 'Rimettilo in vendita',
  },

  /* ── Vault: delivery, payouts and refunds ─────────────────────────── */
  delivered: {
    s: 'Consegnato — stiamo preparando il tuo accredito',
    b: ['Ciao {name},', 'L’acquirente ha confermato la consegna dell’ordine #{order} ({title}). Stiamo preparando il tuo accredito di {payout}.'],
  },
  deliveredAuto: {
    s: 'L’ordine #{order} risulta consegnato',
    b: ['Ciao {name},', 'L’ordine #{order} ({title}) risulta consegnato: sono passate due settimane dalla spedizione senza segnalazioni di problemi. Stiamo preparando il tuo accredito di {payout}.'],
  },
  payoutSent: {
    s: 'Il tuo accredito di {payout} è in arrivo',
    b: ['Ciao {name},', 'Abbiamo inviato {payout} per l’ordine #{order} ({title}) al tuo account Stripe. Stripe trasferisce poi l’importo sul tuo conto bancario secondo la consueta programmazione, di solito entro pochi giorni lavorativi.'],
    c: 'Apri i tuoi accrediti',
  },
  payoutSetupNeeded: {
    s: 'Configura gli accrediti per ricevere {payout}',
    b: ['Ciao {name},', 'L’ordine #{order} ({title}) è concluso e c’è un accredito di {payout} che ti aspetta. Per riceverlo, completa la configurazione degli accrediti con Stripe, il nostro partner per i pagamenti: ci vogliono circa 3 minuti.'],
    c: 'Configura gli accrediti',
  },
  refundIssued: {
    s: 'Rimborso per l’ordine #{order}',
    b: ['Ciao {name},', 'Abbiamo rimborsato {amount} per l’ordine #{order} ({title}) sul tuo metodo di pagamento originale. A seconda della banca, l’importo sarà visibile entro 5–10 giorni lavorativi.', '%message'],
  },
  refundManual: {
    s: 'Rimborso per l’ordine #{order}',
    b: ['Ciao {name},', 'Ti rimborsiamo per intero il pagamento di {amount} per l’ordine #{order} ({title}). Entro un giorno lavorativo ti contatteremo per organizzare il bonifico.', '%message'],
  },
  refundedSeller: {
    s: 'L’ordine #{order} è stato rimborsato',
    b: ['Ciao {name},', 'Dopo aver esaminato la segnalazione dell’acquirente, abbiamo rimborsato l’ordine #{order} ({title}):', '%message', 'Ti contatteremo per organizzare la restituzione del paio.'],
  },

  /* ── Vault: problems and feedback ─────────────────────────────────── */
  problemReceived: {
    s: 'Abbiamo ricevuto la tua segnalazione sull’ordine #{order}',
    b: ['Ciao {name},', 'Grazie per avercelo segnalato. Il venditore non riceverà il pagamento finché uno specialista ShoeLab non avrà verificato la situazione. Ti risponderemo entro un giorno lavorativo.', 'La tua segnalazione:', '%message'],
  },
  problemSeller: {
    s: 'L’acquirente ha segnalato un problema con l’ordine #{order}',
    b: ['Ciao {name},', 'L’acquirente di {title} ha segnalato un problema con la consegna. Il tuo accredito resta sospeso mentre uno specialista ShoeLab verifica la situazione. Ti contatteremo a breve.'],
  },
  disputeReleased: {
    s: 'Problema risolto — accredito sbloccato',
    b: ['Ciao {name},', 'Il nostro specialista ha chiuso la segnalazione sull’ordine #{order}. Stiamo sbloccando il tuo accredito di {payout}.', '%message'],
  },
  disputeClosed: {
    s: 'La tua segnalazione sull’ordine #{order} è stata chiusa',
    b: ['Ciao {name},', 'Il nostro specialista ha esaminato la tua segnalazione e l’ha chiusa.', '%message', 'Domande? Rispondi pure a questa email.'],
  },
  feedbackNew: {
    s: 'Nuovo feedback {rating}',
    b: ['Ciao {name},', 'L’acquirente dell’ordine #{order} ha lasciato un feedback {rating}.', '%message'],
  },

  /* ── Vault: the lab ───────────────────────────────────────────────── */
  labArrived: {
    s: 'Il tuo paio di {title} è arrivato al lab',
    b: ['Ciao {name},', 'Ora il tuo paio è nelle mani dei nostri specialisti. Ti faremo sapere l’esito.'],
  },
  labPassedBuyer: {
    s: 'Autenticato: {title}',
    b: ['Ciao {name},', 'Ottime notizie — il tuo paio ha superato l’autenticazione nel nostro lab. Ora te lo spediamo.', '%message'],
  },
  labPassedSeller: {
    s: 'Autenticato: {title}',
    b: ['Ciao {name},', 'Il tuo paio ha superato l’autenticazione. Il tuo accredito di {payout} arriverà quando il paio avrà raggiunto l’acquirente.'],
  },
  labFailedBuyer: {
    s: 'L’ordine #{order} non ha superato l’autenticazione',
    b: ['Ciao {name},', 'I nostri specialisti non sono riusciti ad autenticare questo paio, quindi non ti verrà spedito. Il tuo pagamento di {amount} ti verrà rimborsato per intero.'],
  },
  labFailedSeller: {
    s: 'Autenticazione non superata: {title}',
    b: ['Ciao {name},', 'I nostri specialisti non sono riusciti ad autenticare il paio:', '%message', 'Ti contatteremo per organizzarne la restituzione.'],
  },
  labShipped: {
    s: 'Autenticato e in viaggio: {title}',
    b: ['Ciao {name},', 'Il tuo paio Lab Verified è in viaggio.', '%rows', 'Quando arriva, conferma la consegna — oppure segnala un problema prima di confermarla.'],
    c: 'Conferma la consegna',
  },

  /* ── support ──────────────────────────────────────────────────────── */
  supportReceived: {
    s: 'Abbiamo ricevuto il tuo messaggio (#{ticket})',
    b: ['Ciao {name},', 'Grazie per averci scritto. Uno specialista ShoeLab ti risponderà entro un giorno lavorativo — di solito molto prima. Se vuoi aggiungere qualcosa, rispondi semplicemente a questa email.', 'Il tuo messaggio:', '%message'],
  },
  supportReply: {
    s: 'Re: la tua richiesta ShoeLab #{ticket}',
    b: ['Ciao {name},', '%message', 'Se hai altre domande, rispondi semplicemente a questa email.', '{team}'],
  },

  /* ── to the studio (written in the studio's language) ─────────────── */
  sBookingNew: {
    s: '{tag} {customer} — {when} — {service}',
    b: ['Nuova prenotazione {ref}.', '%rows', '%message', 'Rispondi a questa email per scrivere direttamente al cliente.'],
  },
  sBookingPaid: {
    s: '[PAID] {customer} — {when} — {amount}',
    b: ['Pagamento ricevuto per la prenotazione {ref}. L’appuntamento è confermato.', '%rows', 'Rispondi a questa email per scrivere al cliente.'],
  },
  sContact: {
    s: 'Modulo di contatto — {customer}',
    b: ['Un messaggio dal modulo di contatto:', '%rows', '%message'],
  },
  sReview: {
    s: 'Nuova recensione da approvare — {customer} ({rating}★)',
    b: ['{customer} ha lasciato una recensione da {rating}★:', '%message'],
  },
  sListingReview: {
    s: '[VAULT] Nuovo annuncio da controllare: {title}',
    b: ['Un nuovo annuncio è in attesa di revisione.', '%rows'],
    c: 'Apri la console del lab',
  },
  sSale: {
    s: '[VAULT] Vendita #{order}: {title} a {price}',
    b: ['Un paio è stato venduto. Ora l’acquirente ha 72 ore per pagare.', '%rows'],
  },
  sPaymentNeeded: {
    s: '[VAULT] Servono i dati di pagamento per l’ordine #{order}',
    b: ['I pagamenti con carta non sono attivi: invia via email a {buyerEmail} i dati per pagare {amount} ({title}). Quando il denaro arriva, segna l’ordine come pagato nella console del lab.'],
    c: 'Apri la console del lab',
  },
  sIncoming: {
    s: '[VAULT] In arrivo al lab: ordine #{order}',
    b: ['Un paio Lab Verified è in viaggio verso il lab.', '%rows'],
    c: 'Apri la console del lab',
  },
  sProblem: {
    s: '[VAULT] PROBLEMA segnalato sull’ordine #{order}: {title}',
    b: ['Un acquirente ha segnalato un problema. L’accredito resta sospeso finché non lo sblocchi o non rimborsi l’acquirente.', '%rows', 'L’acquirente scrive:', '%message'],
    c: 'Apri la console del lab',
  },
  sLabAddress: {
    s: '[VAULT] Invia l’indirizzo del lab: ordine #{order}',
    b: ['L’ordine #{order} ({title}) è pagato e il venditore deve spedire il paio al lab. DROPOFF_ADDRESS non è impostato, quindi al venditore è stato detto che l’indirizzo arriverà via email. Inviaglielo tu, per favore.', '%rows'],
  },
  sPayoutDue: {
    s: '[VAULT] ACCREDITO da versare: ordine #{order} — {payout}',
    b: ['L’ordine #{order} ({title}) risulta consegnato ({how}). Paga il venditore con un bonifico bancario.', '%rows'],
  },
  sPayoutFailed: {
    s: '[VAULT] Accredito non riuscito per l’ordine #{order}',
    b: ['Stripe non è riuscito a inviare l’accredito per l’ordine #{order} ({title}). Puoi riprovare dalla console del lab.', '%message'],
    c: 'Apri la console del lab',
  },
  sRefund: {
    s: '[VAULT] RIMBORSO ordine #{order}',
    b: ['Rimborsa manualmente {amount} a {buyerEmail}: questo ordine non è stato pagato tramite Stripe.', '%message'],
  },
  sRefunded: {
    s: '[VAULT] Ordine #{order} rimborsato — {amount}',
    b: ['Stripe ha rimborsato {amount} all’acquirente dell’ordine #{order} ({title}). Se serve, organizza la restituzione del paio.', '%message'],
  },
  sRefundFailed: {
    s: '[VAULT] Rimborso non riuscito per l’ordine #{order}',
    b: ['Stripe non è riuscito a rimborsare {amount} per l’ordine #{order} ({title}). Esegui il rimborso dalla dashboard di Stripe.', '%message'],
  },
  sSupport: {
    s: '[VAULT] Richiesta di assistenza #{ticket}: {topic}',
    b: ['{customer} ha bisogno di uno specialista.', '%rows', 'Riepilogo:', '%message', '%transcript', 'Rispondi a questa email oppure dalla console del lab.'],
    c: 'Apri la console del lab',
  },
  sTest: {
    s: '[TEST] Verifica email ShoeLab',
    b: ['Questa è una prova da /api/health?testmail=1.', 'Se la stai leggendo, le email del sito arrivano a {to}.'],
  },
};
