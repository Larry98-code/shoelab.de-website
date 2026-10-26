// ShoeLab emails — Deutsch, the German translation of en.js.
// Same keys, same {placeholders}, same %blocks; [TAGS] in subjects stay English.
export default {
  _: {
    hi: 'Hallo {name},', hiAll: 'Hallo,',
    signoff: 'Bis bald\nDein ShoeLab-Team', team: 'Dein ShoeLab-Team', vaultTeam: 'Dein ShoeLab-Vault-Team',
    readIn: 'Diese E-Mail in einer anderen Sprache lesen:',
    footer: 'ShoeLab · Studio für Sneaker-Pflege · Bremen',
    footerVault: 'ShoeLab Vault · Sneaker-Resale mit Echtheitsprüfung von ShoeLab, Bremen',
    replyHint: 'Fragen? Antworte einfach auf diese E-Mail.',
    whatsapp: 'Du kannst uns auch auf WhatsApp schreiben: https://wa.me/491772258878.',
    dropoffTitle: 'Abgabeadresse:', dropoffLater: 'Die genaue Abgabeadresse schicken wir dir vor deinem Termin per WhatsApp.',
    // table labels
    ref: 'Buchungsnummer', when: 'Termin', service: 'Leistung', plan: 'Abrechnung', amount: 'Betrag', toPay: 'Im Studio zu zahlen', paid: 'Bezahlt',
    item: 'Artikelpreis', auth: 'Echtheitsprüfung', ship: 'Versand', total: 'Gesamt', commission: 'ShoeLab-Provision',
    postage: 'Portoerstattung', payout: 'Auszahlung', order: 'Bestellung', tracking: 'Sendungsnummer', size: 'Größe', price: 'Preis',
    tier: 'Prüfung', format: 'Format', seller: 'Verkäufer', buyer: 'Käufer', email: 'E-Mail', phone: 'Telefon',
    name: 'Name', notes: 'Anmerkungen', language: 'Sprache', payment: 'Zahlung', status: 'Status', category: 'Thema',
    oneTime: 'Einmalig', monthly: 'Monatliches Abo', atStudio: 'Im Studio — noch nichts berechnet', online: 'Online über Stripe',
    whenAt: '{date} um {time} Uhr',
    // shared sentences and words
    tierLab: 'Lab Verified', tierPhoto: 'Photo Verified', auction: 'Auktion', fixed: 'Sofort-Kaufen',
    nextPhotoCheck: 'Ein ShoeLab-Spezialist prüft jetzt deine Fotos auf Echtheit. Passt alles, geht die Anzeige mit dem Badge „Photo Verified“ online.',
    nextLabCheck: 'Wir werfen einen kurzen Blick darauf und schalten die Anzeige live. Sobald das Paar verkauft ist, schickst du es an unser Lab, und ein Spezialist prüft es von Hand auf Echtheit, bevor es weiter zum Käufer geht.',
    liveLab: 'Jeder Käufer sieht, dass unser Lab das Paar vor dem Versand von Hand prüft.',
    livePhoto: 'Unsere Spezialisten haben deine Fotos geprüft, deshalb trägt die Anzeige das Badge „Photo Verified“.',
    paidNextLab: 'Der Verkäufer schickt das Paar jetzt an unser Lab. Ein Spezialist prüft es auf Echtheit, bevor es weiter zu dir geht.',
    paidNextPhoto: 'Der Verkäufer schickt dir das Paar jetzt zu. Die Sendungsnummer bekommst du per E-Mail.',
    shipLab: 'Schicke das Paar zur Echtheitsprüfung an ShoeLab — nicht an den Käufer. Leg einen Zettel mit der Bestellnummer #{order} in den Karton und trag danach die Sendungsnummer in deinem Vault-Dashboard ein.',
    shipPhoto: 'Schicke das Paar direkt an den Käufer und trag danach die Sendungsnummer in deinem Vault-Dashboard ein. Die Lieferadresse:',
    labAddressLater: 'Die Adresse unseres Labs schicken wir dir innerhalb eines Werktags per E-Mail.',
    // how an order came to count as delivered (studio payout emails)
    howBuyer: 'der Käufer hat die Lieferung bestätigt', howAuto: 'automatisch, 14 Tage nach dem Versand',
    howReleased: 'Problemmeldung zugunsten des Verkäufers abgeschlossen', howRetry: 'Auszahlung erneut versucht',
    payoutAfterLab: 'Du erhältst {payout}, sobald das Paar unsere Prüfung im Lab bestanden hat und beim Käufer angekommen ist.',
    payoutAfterDelivery: 'Du erhältst {payout}, sobald der Käufer das Paar hat.',
    ratePos: 'positive', rateNeu: 'neutrale', rateNeg: 'negative',
    catOrder: 'Problem mit einer Bestellung', catPayment: 'Zahlung oder Auszahlung', catAccount: 'Konto', catAuth: 'Echtheitsprüfung', catTech: 'Technisches Problem', catOther: 'Sonstiges',
    statusOpen: 'Offen', statusAnswered: 'Beantwortet',
  },

  /* ── bookings ─────────────────────────────────────────────────────── */
  bookingReserved: {
    s: 'Deine ShoeLab-Buchung ist reserviert — {ref}',
    b: ['Hallo {name},', 'dein Termin bei ShoeLab ist reserviert.', '%rows', '%dropoff',
      'Möchtest du etwas ändern? Antworte einfach auf diese E-Mail oder schreib uns auf WhatsApp: https://wa.me/491772258878.', '{signoff}'],
  },
  bookingRequested: {
    s: 'Deine Buchungsanfrage bei ShoeLab — {ref}',
    b: ['Hallo {name},', 'danke für deine Buchung bei ShoeLab. Deine Anfrage ist bei uns eingegangen:', '%rows',
      'Sobald deine Zahlung eingegangen ist, bekommst du eine separate Bestätigung. Falls du die Zahlungsseite vor dem Abschluss geschlossen hast, antworte einfach auf diese E-Mail — wir halten dir den Termin trotzdem frei.',
      '{signoff}'],
  },
  bookingPaid: {
    s: 'Zahlung bestätigt — dein ShoeLab-Termin {ref}',
    b: ['Hallo {name},', 'deine Zahlung ist eingegangen und dein Termin ist bestätigt.', '%rows', '%dropoff',
      'Die meisten Behandlungen sind innerhalb von 48 Stunden fertig.', 'Fragen? Antworte einfach hier oder schreib uns auf WhatsApp: https://wa.me/491772258878.', '{signoff}'],
  },

  /* ── account ──────────────────────────────────────────────────────── */
  verifyEmail: {
    s: 'Bestätige deine E-Mail-Adresse',
    b: ['Hallo {name},', 'willkommen bei ShoeLab! Bitte bestätige, dass das deine E-Mail-Adresse ist — so bleibt dein Konto sicher, und du kannst im ShoeLab Vault bieten, kaufen und verkaufen.',
      'Der Link ist 7 Tage gültig.', 'Falls du kein Konto erstellt hast, kannst du diese E-Mail einfach ignorieren.'],
    c: 'E-Mail-Adresse bestätigen',
  },
  passwordReset: {
    s: 'Dein ShoeLab-Passwort zurücksetzen',
    b: ['Hallo {name},', 'wir haben eine Anfrage zum Zurücksetzen deines ShoeLab-Passworts erhalten. Über den Button kannst du innerhalb einer Stunde ein neues wählen.',
      'Falls du das nicht angefordert hast, kannst du diese E-Mail einfach ignorieren.'],
    c: 'Neues Passwort wählen',
  },

  /* ── Vault: listings ──────────────────────────────────────────────── */
  listingSubmitted: {
    s: 'Wir prüfen deine Anzeige',
    b: ['Hallo {name},', 'danke, dass du dein Paar {title} (EU {size}) eingestellt hast.', '{next}', 'Das dauert in der Regel weniger als einen Werktag.'],
    c: 'Deine Anzeige ansehen',
  },
  listingLive: {
    s: 'Deine Anzeige ist live: {title}',
    b: ['Hallo {name},', 'gute Nachrichten: Dein Paar {title} ist jetzt live im ShoeLab Vault.', '{note}'],
    c: 'Deine Anzeige ansehen',
  },
  listingRejected: {
    s: 'Wir konnten deine Anzeige nicht freigeben: {title}',
    b: ['Hallo {name},', 'unser Spezialist konnte diese Anzeige leider nicht freigeben:', '%message', 'Du kannst das Paar gern erneut einstellen, sobald das Problem behoben ist.'],
    c: 'Paar einstellen',
  },
  auctionNoBids: {
    s: 'Deine Auktion endete ohne Gebote',
    b: ['Hallo {name},', 'für dein Paar {title} ist leider kein Gebot eingegangen. Du kannst es mit einem Klick neu einstellen — mit einem niedrigeren Startpreis oder als Sofort-Kaufen. Deine Fotos bleiben erhalten.'],
    c: 'Neu einstellen',
  },

  /* ── Vault: bids and offers ───────────────────────────────────────── */
  outbid: {
    s: 'Du wurdest überboten: {title}',
    b: ['Hallo {name},', 'jemand hat ein höheres Gebot für {title} abgegeben. Der Preis liegt jetzt bei {price}.', 'Biete noch einmal, bevor die Auktion endet.'],
    c: 'Erneut bieten',
  },
  offerReceived: {
    s: 'Neuer Preisvorschlag: {amount} für {title}',
    b: ['Hallo {name},', 'jemand hat {amount} für dein Paar {title} vorgeschlagen (eingestellt für {price}).', '%message', 'Du hast 48 Stunden Zeit, den Vorschlag anzunehmen, abzulehnen oder ein Gegenangebot zu machen.'],
    c: 'Preisvorschlag beantworten',
  },
  offerDeclined: {
    s: 'Dein Preisvorschlag wurde abgelehnt',
    b: ['Hallo {name},', 'dein Preisvorschlag über {amount} für {title} wurde abgelehnt. Du kannst das Paar trotzdem zum angegebenen Preis kaufen oder einen neuen Vorschlag machen.'],
    c: 'Paar ansehen',
  },
  counterOffer: {
    s: 'Gegenangebot: {amount} für {title}',
    b: ['Hallo {name},', 'der Verkäufer hat auf deinen Preisvorschlag von {offer} für {title} mit einem Gegenangebot über {amount} geantwortet.', 'Du hast 48 Stunden Zeit, es anzunehmen oder abzulehnen.'],
    c: 'Gegenangebot beantworten',
  },

  /* ── Vault: the sale ──────────────────────────────────────────────── */
  boughtNow: {
    s: 'Du hast {title} gekauft',
    b: ['Hallo {name},', 'du hast {title} (EU {size}) gekauft.', '%rows', 'Bezahle innerhalb von 72 Stunden, um dir das Paar zu sichern.'],
    c: 'Jetzt bezahlen',
  },
  wonAuction: {
    s: 'Du hast die Auktion für {title} gewonnen',
    b: ['Hallo {name},', 'herzlichen Glückwunsch — du hast die Auktion für {title} (EU {size}) gewonnen.', '%rows', 'Bezahle innerhalb von 72 Stunden, um dir das Paar zu sichern.'],
    c: 'Jetzt bezahlen',
  },
  offerAccepted: {
    s: 'Dein Preisvorschlag wurde angenommen: {title}',
    b: ['Hallo {name},', 'der Verkäufer hat deinen Preisvorschlag für {title} (EU {size}) angenommen.', '%rows', 'Bezahle innerhalb von 72 Stunden, um dir das Paar zu sichern.'],
    c: 'Jetzt bezahlen',
  },
  sold: {
    s: 'Verkauft: {title}',
    b: ['Hallo {name},', 'dein Paar {title} wurde für {price} verkauft.', '{payoutLine}', 'Sobald der Käufer bezahlt hat, schicken wir dir die Versandanweisungen per E-Mail. Bis dahin musst du noch nichts verschicken.'],
  },
  paymentManual: {
    s: 'Zahlung für {title}',
    b: ['Hallo {name},', 'danke! Wir schicken dir die Zahlungsdetails für {amount} innerhalb eines Werktags per E-Mail. Das Paar bleibt so lange für dich reserviert.'],
  },
  paidShip: {
    s: 'Bezahlt — bitte verschicke {title}',
    b: ['Hallo {name},', 'der Käufer hat für {title} bezahlt (Bestellung #{order}).', '{howToShip}', '%address', 'Bitte verschicke das Paar innerhalb von drei Werktagen.'],
    c: 'Sendungsnummer eintragen',
  },
  paymentReceived: {
    s: 'Zahlung für {title} eingegangen',
    b: ['Hallo {name},', 'danke — deine Zahlung über {amount} für {title} ist bei uns eingegangen.', '{next}'],
    c: 'Bestellung verfolgen',
  },
  shippedToBuyer: {
    s: 'Dein Paar ist unterwegs: {title}',
    b: ['Hallo {name},', 'der Verkäufer hat dein Paar verschickt.', '%rows', 'Prüfe es, wenn es ankommt, und bestätige den Erhalt — oder melde ein Problem, bevor du bestätigst.'],
    c: 'Erhalt bestätigen',
  },
  unpaidCancelled: {
    s: 'Verkauf storniert — der Käufer hat nicht bezahlt',
    b: ['Hallo {name},', 'der Käufer hat nicht innerhalb von 72 Stunden bezahlt, deshalb wurde Bestellung #{order} für {title} storniert. Du kannst das Paar mit einem Klick neu einstellen.'],
    c: 'Neu einstellen',
  },

  /* ── Vault: delivery, payouts and refunds ─────────────────────────── */
  delivered: {
    s: 'Zugestellt — deine Auszahlung wird vorbereitet',
    b: ['Hallo {name},', 'der Käufer hat den Erhalt von Bestellung #{order} ({title}) bestätigt. Deine Auszahlung über {payout} wird vorbereitet.'],
  },
  deliveredAuto: {
    s: 'Bestellung #{order} gilt als zugestellt',
    b: ['Hallo {name},', 'Bestellung #{order} ({title}) gilt als zugestellt: Seit dem Versand sind zwei Wochen vergangen, ohne dass ein Problem gemeldet wurde. Deine Auszahlung über {payout} wird vorbereitet.'],
  },
  payoutSent: {
    s: 'Deine Auszahlung über {payout} ist unterwegs',
    b: ['Hallo {name},', 'wir haben {payout} für Bestellung #{order} ({title}) an dein Stripe-Konto überwiesen. Stripe zahlt den Betrag nach deinem gewohnten Zeitplan auf dein Bankkonto aus — meist innerhalb weniger Werktage.'],
    c: 'Auszahlungen ansehen',
  },
  payoutSetupNeeded: {
    s: 'Richte Auszahlungen ein, um {payout} zu erhalten',
    b: ['Hallo {name},', 'Bestellung #{order} ({title}) ist abgeschlossen, und deine Auszahlung über {payout} wartet auf dich. Damit du sie erhältst, schließ die Einrichtung der Auszahlungen bei unserem Zahlungspartner Stripe ab — das dauert etwa 3 Minuten.'],
    c: 'Auszahlungen einrichten',
  },
  refundIssued: {
    s: 'Erstattung für Bestellung #{order}',
    b: ['Hallo {name},', 'wir haben dir {amount} für Bestellung #{order} ({title}) auf deine ursprüngliche Zahlungsmethode erstattet. Je nach Bank siehst du den Betrag innerhalb von 5–10 Werktagen.', '%message'],
  },
  refundManual: {
    s: 'Erstattung für Bestellung #{order}',
    b: ['Hallo {name},', 'wir erstatten dir deine Zahlung über {amount} für Bestellung #{order} ({title}) in voller Höhe. Wegen der Überweisung melden wir uns innerhalb eines Werktags bei dir.', '%message'],
  },
  refundedSeller: {
    s: 'Bestellung #{order} wurde erstattet',
    b: ['Hallo {name},', 'nach Prüfung der Meldung des Käufers haben wir Bestellung #{order} ({title}) erstattet:', '%message', 'Wegen der Rücksendung des Paares melden wir uns bei dir.'],
  },

  /* ── Vault: problems and feedback ─────────────────────────────────── */
  problemReceived: {
    s: 'Deine Meldung zu Bestellung #{order} ist eingegangen',
    b: ['Hallo {name},', 'danke, dass du uns Bescheid gibst. Der Verkäufer wird nicht ausgezahlt, solange ein ShoeLab-Spezialist den Fall prüft. Wir melden uns innerhalb eines Werktags bei dir.', 'Deine Meldung:', '%message'],
  },
  problemSeller: {
    s: 'Der Käufer hat ein Problem mit Bestellung #{order} gemeldet',
    b: ['Hallo {name},', 'der Käufer von {title} hat ein Problem mit der Lieferung gemeldet. Deine Auszahlung ist angehalten, während ein ShoeLab-Spezialist den Fall prüft. Wir melden uns in Kürze bei dir.'],
  },
  disputeReleased: {
    s: 'Problem geklärt — Auszahlung freigegeben',
    b: ['Hallo {name},', 'unser Spezialist hat die Meldung zu Bestellung #{order} abgeschlossen. Deine Auszahlung über {payout} wird freigegeben.', '%message'],
  },
  disputeClosed: {
    s: 'Deine Meldung zu Bestellung #{order} ist abgeschlossen',
    b: ['Hallo {name},', 'unser Spezialist hat deine Meldung geprüft und abgeschlossen.', '%message', 'Fragen? Antworte einfach auf diese E-Mail.'],
  },
  feedbackNew: {
    s: 'Neue {rating} Bewertung',
    b: ['Hallo {name},', 'der Käufer von Bestellung #{order} hat eine {rating} Bewertung abgegeben.', '%message'],
  },

  /* ── Vault: the lab ───────────────────────────────────────────────── */
  labArrived: {
    s: '{title} ist im Lab angekommen',
    b: ['Hallo {name},', 'dein Paar ist jetzt bei unseren Spezialisten. Wir sagen dir Bescheid, sobald das Ergebnis feststeht.'],
  },
  labPassedBuyer: {
    s: 'Echtheit bestätigt: {title}',
    b: ['Hallo {name},', 'gute Nachrichten — dein Paar hat unsere Echtheitsprüfung im Lab bestanden. Als Nächstes schicken wir es dir zu.', '%message'],
  },
  labPassedSeller: {
    s: 'Echtheit bestätigt: {title}',
    b: ['Hallo {name},', 'dein Paar hat die Echtheitsprüfung bestanden. Deine Auszahlung über {payout} folgt, sobald es beim Käufer angekommen ist.'],
  },
  labFailedBuyer: {
    s: 'Bestellung #{order} hat die Echtheitsprüfung nicht bestanden',
    b: ['Hallo {name},', 'unsere Spezialisten konnten die Echtheit dieses Paares nicht bestätigen, deshalb schicken wir es dir nicht zu. Deine Zahlung über {amount} wird dir vollständig erstattet.'],
  },
  labFailedSeller: {
    s: '{title} hat die Echtheitsprüfung nicht bestanden',
    b: ['Hallo {name},', 'unsere Spezialisten konnten die Echtheit des Paares nicht bestätigen:', '%message', 'Wegen der Rücksendung an dich melden wir uns bei dir.'],
  },
  labShipped: {
    s: 'Echtheit bestätigt und unterwegs: {title}',
    b: ['Hallo {name},', 'dein Paar mit Lab Verified ist auf dem Weg zu dir.', '%rows', 'Wenn es ankommt, bestätige den Erhalt — oder melde ein Problem, bevor du bestätigst.'],
    c: 'Erhalt bestätigen',
  },

  /* ── support ──────────────────────────────────────────────────────── */
  supportReceived: {
    s: 'Deine Nachricht ist eingegangen (#{ticket})',
    b: ['Hallo {name},', 'danke für deine Nachricht. Ein ShoeLab-Spezialist antwortet dir innerhalb eines Werktags — meist deutlich schneller. Wenn du noch etwas ergänzen möchtest, antworte einfach auf diese E-Mail.', 'Deine Nachricht:', '%message'],
  },
  supportReply: {
    s: 'Re: Deine ShoeLab-Anfrage #{ticket}',
    b: ['Hallo {name},', '%message', 'Wenn du noch Fragen hast, antworte einfach auf diese E-Mail.', '{team}'],
  },

  /* ── to the studio (written in the studio's language) ─────────────── */
  sBookingNew: {
    s: '{tag} {customer} — {when} — {service}',
    b: ['Neue Buchung {ref}.', '%rows', '%message', 'Antworte auf diese E-Mail, um den Kunden direkt zu erreichen.'],
  },
  sBookingPaid: {
    s: '[PAID] {customer} — {when} — {amount}',
    b: ['Zahlung für Buchung {ref} eingegangen. Der Termin ist bestätigt.', '%rows', 'Antworte auf diese E-Mail, um den Kunden zu erreichen.'],
  },
  sContact: {
    s: 'Kontaktformular — {customer}',
    b: ['Eine Nachricht über das Kontaktformular:', '%rows', '%message'],
  },
  sReview: {
    s: 'Neue Bewertung wartet auf Freigabe — {customer} ({rating}★)',
    b: ['{customer} hat eine {rating}-Sterne-Bewertung abgegeben:', '%message'],
  },
  sListingReview: {
    s: '[VAULT] Neue Anzeige zu prüfen: {title}',
    b: ['Eine neue Anzeige wartet auf Prüfung.', '%rows'],
    c: 'Lab-Konsole öffnen',
  },
  sSale: {
    s: '[VAULT] Verkauf #{order}: {title} für {price}',
    b: ['Ein Paar wurde verkauft. Der Käufer hat jetzt 72 Stunden Zeit zu bezahlen.', '%rows'],
  },
  sPaymentNeeded: {
    s: '[VAULT] Zahlungsdetails für Bestellung #{order} nötig',
    b: ['Kartenzahlung ist nicht aktiviert. Bitte schick {buyerEmail} die Zahlungsdetails für {amount} ({title}) und markiere die Bestellung in der Lab-Konsole als bezahlt, sobald das Geld eingegangen ist.'],
    c: 'Lab-Konsole öffnen',
  },
  sIncoming: {
    s: '[VAULT] Unterwegs ins Lab: Bestellung #{order}',
    b: ['Ein Paar mit Lab Verified ist auf dem Weg ins Lab.', '%rows'],
    c: 'Lab-Konsole öffnen',
  },
  sProblem: {
    s: '[VAULT] PROBLEM gemeldet bei Bestellung #{order}: {title}',
    b: ['Ein Käufer hat ein Problem gemeldet. Die Auszahlung ist angehalten, bis du sie freigibst oder dem Käufer den Betrag erstattest.', '%rows', 'Der Käufer schreibt:', '%message'],
    c: 'Lab-Konsole öffnen',
  },
  sLabAddress: {
    s: '[VAULT] Lab-Adresse schicken: Bestellung #{order}',
    b: ['Bestellung #{order} ({title}) ist bezahlt, und der Verkäufer muss das Paar ans Lab schicken. DROPOFF_ADDRESS ist nicht gesetzt, deshalb wurde ihm mitgeteilt, dass die Adresse per E-Mail folgt. Bitte schick sie dem Verkäufer.', '%rows'],
  },
  sPayoutDue: {
    s: '[VAULT] AUSZAHLUNG fällig: Bestellung #{order} — {payout}',
    b: ['Bestellung #{order} ({title}) ist zugestellt ({how}). Bitte zahl den Verkäufer per Banküberweisung aus.', '%rows'],
  },
  sPayoutFailed: {
    s: '[VAULT] Auszahlung für Bestellung #{order} fehlgeschlagen',
    b: ['Stripe konnte die Auszahlung für Bestellung #{order} ({title}) nicht senden. Du kannst sie in der Lab-Konsole erneut anstoßen.', '%message'],
    c: 'Lab-Konsole öffnen',
  },
  sRefund: {
    s: '[VAULT] ERSTATTUNG für Bestellung #{order}',
    b: ['Bitte erstatte {buyerEmail} manuell {amount} — diese Bestellung wurde nicht über Stripe bezahlt.', '%message'],
  },
  sRefunded: {
    s: '[VAULT] Bestellung #{order} erstattet — {amount}',
    b: ['Stripe hat dem Käufer von Bestellung #{order} ({title}) {amount} erstattet. Kümmere dich bei Bedarf um die Rücksendung des Paares.', '%message'],
  },
  sRefundFailed: {
    s: '[VAULT] Erstattung für Bestellung #{order} fehlgeschlagen',
    b: ['Stripe konnte {amount} für Bestellung #{order} ({title}) nicht erstatten. Bitte erstatte den Betrag über das Stripe-Dashboard.', '%message'],
  },
  sSupport: {
    s: '[VAULT] Supportanfrage #{ticket}: {topic}',
    b: ['{customer} braucht einen Spezialisten.', '%rows', 'Zusammenfassung:', '%message', '%transcript', 'Antworte auf diese E-Mail oder direkt in der Lab-Konsole.'],
    c: 'Lab-Konsole öffnen',
  },
  sTest: {
    s: '[TEST] ShoeLab-E-Mail-Test',
    b: ['Das ist ein Test von /api/health?testmail=1.', 'Wenn du das liest, kommen E-Mails von der Website bei {to} an.'],
  },
};
