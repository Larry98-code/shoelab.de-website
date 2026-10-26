// ShoeLab emails — Polski: the Polish translation of en.js.
// Same keys, % blocks and {placeholders} as en.js; subject tags in [BRACKETS] stay English.
export default {
  _: {
    hi: 'Cześć, {name}!', hiAll: 'Dzień dobry!',
    signoff: 'Do zobaczenia!\nShoeLab', team: 'Zespół ShoeLab', vaultTeam: 'Zespół ShoeLab Vault',
    readIn: 'Przeczytaj tę wiadomość w innym języku:',
    footer: 'ShoeLab · Studio pielęgnacji sneakersów · Brema',
    footerVault: 'ShoeLab Vault · odsprzedaż sneakersów z weryfikacją · ShoeLab, Brema',
    replyHint: 'Masz pytania? Po prostu odpowiedz na tę wiadomość.',
    whatsapp: 'Możesz też napisać do nas na WhatsAppie: https://wa.me/491772258878.',
    dropoffTitle: 'Gdzie przynieść buty:', dropoffLater: 'Dokładny adres, pod który przyniesiesz buty, wyślemy Ci na WhatsAppie przed wizytą.',
    // table labels
    ref: 'Numer referencyjny', when: 'Termin', service: 'Usługa', plan: 'Plan', amount: 'Kwota', toPay: 'Do zapłaty w studiu', paid: 'Zapłacono',
    item: 'Cena pary', auth: 'Opłata za weryfikację', ship: 'Wysyłka', total: 'Razem', commission: 'Prowizja ShoeLab',
    postage: 'Zwrot kosztów wysyłki', payout: 'Wypłata', order: 'Zamówienie', tracking: 'Numer przesyłki', size: 'Rozmiar', price: 'Cena',
    tier: 'Weryfikacja', format: 'Rodzaj sprzedaży', seller: 'Sprzedający', buyer: 'Kupujący', email: 'E-mail', phone: 'Telefon',
    name: 'Imię i nazwisko', notes: 'Uwagi', language: 'Język', payment: 'Płatność', status: 'Status', category: 'Temat',
    oneTime: 'Jednorazowo', monthly: 'Abonament miesięczny', atStudio: 'W studiu — na razie nic nie pobrano', online: 'Online przez Stripe',
    whenAt: '{date}, godz. {time}',
    // shared sentences and words
    tierLab: 'Lab Verified', tierPhoto: 'Photo Verified', auction: 'Licytacja', fixed: 'Kup teraz',
    nextPhotoCheck: 'Specjalista ShoeLab sprawdza teraz autentyczność pary na podstawie Twoich zdjęć. Jeśli wszystko się zgadza, ogłoszenie zostanie opublikowane z odznaką Photo Verified.',
    nextLabCheck: 'Szybko przejrzymy ogłoszenie i je opublikujemy. Gdy para się sprzeda, wyślesz ją do naszego laboratorium, gdzie specjalista ręcznie sprawdzi jej autentyczność, zanim trafi do kupującego.',
    liveLab: 'Każdy kupujący widzi, że przed wysyłką para przejdzie ręczną kontrolę w naszym laboratorium.',
    livePhoto: 'Nasi specjaliści sprawdzili Twoje zdjęcia, dlatego ogłoszenie ma odznakę Photo Verified.',
    paidNextLab: 'Sprzedający wyśle teraz parę do naszego laboratorium. Specjalista sprawdzi jej autentyczność, zanim trafi ona do Ciebie.',
    paidNextPhoto: 'Sprzedający wyśle teraz parę bezpośrednio do Ciebie. Numer przesyłki dostaniesz e-mailem.',
    shipLab: 'Wyślij parę do ShoeLab na weryfikację — nie do kupującego. Włóż do pudełka kartkę z dopiskiem „zamówienie nr {order}”, a potem wpisz numer przesyłki w zakładce Mój Vault.',
    shipPhoto: 'Wyślij parę bezpośrednio do kupującego, a potem wpisz numer przesyłki w zakładce Mój Vault. Adres kupującego:',
    labAddressLater: 'Adres laboratorium ShoeLab wyślemy Ci e-mailem w ciągu jednego dnia roboczego.',
    // how an order came to count as delivered (studio payout emails)
    howBuyer: 'kupujący potwierdził dostawę', howAuto: 'automatycznie, 14 dni po wysyłce',
    howReleased: 'zgłoszenie problemu zamknięte na korzyść sprzedającego', howRetry: 'ponowiono wypłatę',
    payoutAfterLab: 'Otrzymasz {payout}, gdy para przejdzie kontrolę w naszym laboratorium i dotrze do kupującego.',
    payoutAfterDelivery: 'Otrzymasz {payout}, gdy para dotrze do kupującego.',
    ratePos: 'pozytywna', rateNeu: 'neutralna', rateNeg: 'negatywna',
    catOrder: 'Problem z zamówieniem', catPayment: 'Płatność lub wypłata', catAccount: 'Konto', catAuth: 'Weryfikacja', catTech: 'Problem techniczny', catOther: 'Inne',
    statusOpen: 'Otwarte', statusAnswered: 'Z odpowiedzią',
  },

  /* ── bookings ─────────────────────────────────────────────────────── */
  bookingReserved: {
    s: 'Zarezerwowano Twój termin w ShoeLab — {ref}',
    b: ['Cześć, {name}!', 'Twój termin w ShoeLab jest zarezerwowany.', '%rows', '%dropoff',
      'Chcesz coś zmienić? Po prostu odpowiedz na tę wiadomość albo napisz do nas na WhatsAppie: https://wa.me/491772258878.', '{signoff}'],
  },
  bookingRequested: {
    s: 'Twoja prośba o rezerwację w ShoeLab — {ref}',
    b: ['Cześć, {name}!', 'Dziękujemy za rezerwację w ShoeLab. Otrzymaliśmy Twoją prośbę:', '%rows',
      'Gdy płatność zostanie zaksięgowana, dostaniesz osobne potwierdzenie. Jeśli strona płatności zamknęła się, zanim udało Ci się zapłacić, odpowiedz na tę wiadomość — i tak zatrzymamy dla Ciebie ten termin.',
      '{signoff}'],
  },
  bookingPaid: {
    s: 'Płatność potwierdzona — Twoja wizyta w ShoeLab {ref}',
    b: ['Cześć, {name}!', 'Otrzymaliśmy Twoją płatność, a wizyta jest potwierdzona.', '%rows', '%dropoff',
      'Większość zabiegów kończymy w ciągu 48 godzin.', 'Masz pytania? Odpowiedz na tę wiadomość albo napisz do nas na WhatsAppie: https://wa.me/491772258878.', '{signoff}'],
  },

  /* ── account ──────────────────────────────────────────────────────── */
  verifyEmail: {
    s: 'Potwierdź swój adres e-mail',
    b: ['Cześć, {name}!', 'Witamy w ShoeLab! Potwierdź, że to Twój adres e-mail — dzięki temu Twoje konto jest bezpieczne, a Ty możesz licytować, kupować i sprzedawać w ShoeLab Vault.',
      'Link jest ważny przez 7 dni.', 'Jeśli konto nie zostało założone przez Ciebie, możesz zignorować tę wiadomość.'],
    c: 'Potwierdź adres e-mail',
  },
  passwordReset: {
    s: 'Zresetuj hasło do konta ShoeLab',
    b: ['Cześć, {name}!', 'Otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta ShoeLab. Użyj przycisku w ciągu godziny, aby ustawić nowe hasło.',
      'Jeśli ta prośba nie pochodzi od Ciebie, możesz spokojnie zignorować tę wiadomość.'],
    c: 'Ustaw nowe hasło',
  },

  /* ── Vault: listings ──────────────────────────────────────────────── */
  listingSubmitted: {
    s: 'Sprawdzamy Twoje ogłoszenie',
    b: ['Cześć, {name}!', 'Dziękujemy za wystawienie pary {title} (EU {size}).', '{next}', 'Zwykle trwa to krócej niż jeden dzień roboczy.'],
    c: 'Zobacz ogłoszenie',
  },
  listingLive: {
    s: 'Twoja para {title} jest już w sprzedaży',
    b: ['Cześć, {name}!', 'Dobra wiadomość: Twoja para {title} jest już w sprzedaży w ShoeLab Vault.', '{note}'],
    c: 'Zobacz ogłoszenie',
  },
  listingRejected: {
    s: 'Nie mogliśmy zatwierdzić Twojego ogłoszenia: {title}',
    b: ['Cześć, {name}!', 'Niestety, nie możemy zatwierdzić tego ogłoszenia. Uwagi naszego specjalisty:', '%message', 'Gdy poprawisz to, co wskazaliśmy, możesz śmiało wystawić parę ponownie.'],
    c: 'Wystaw parę',
  },
  auctionNoBids: {
    s: 'Twoja licytacja zakończyła się bez ofert',
    b: ['Cześć, {name}!', 'Nikt nie złożył oferty na Twoją parę {title}. Możesz wystawić ją ponownie jednym kliknięciem — z niższą ceną wywoławczą albo z opcją Kup teraz. Twoje zdjęcia zostają zachowane.'],
    c: 'Wystaw ponownie',
  },

  /* ── Vault: bids and offers ───────────────────────────────────────── */
  outbid: {
    s: 'Twoja oferta na {title} została przebita',
    b: ['Cześć, {name}!', 'Ktoś złożył wyższą ofertę na {title}. Aktualna cena to {price}.', 'Podbij ofertę, zanim licytacja się zakończy.'],
    c: 'Podbij ofertę',
  },
  offerReceived: {
    s: 'Nowa propozycja: {amount} za {title}',
    b: ['Cześć, {name}!', 'Ktoś proponuje {amount} za Twoją parę {title} (cena w ogłoszeniu: {price}).', '%message', 'Masz 48 godzin, aby przyjąć propozycję, odrzucić ją albo złożyć kontrofertę.'],
    c: 'Odpowiedz na propozycję',
  },
  offerDeclined: {
    s: 'Twoja propozycja została odrzucona',
    b: ['Cześć, {name}!', 'Twoja propozycja {amount} za {title} została odrzucona. Nadal możesz kupić parę za cenę z ogłoszenia albo zaproponować nową cenę.'],
    c: 'Zobacz parę',
  },
  counterOffer: {
    s: 'Kontroferta: {amount} za {title}',
    b: ['Cześć, {name}!', 'Sprzedający odpowiedział na Twoją propozycję {offer} za {title} kontrofertą: {amount}.', 'Masz 48 godzin, aby ją przyjąć lub odrzucić.'],
    c: 'Odpowiedz na kontrofertę',
  },

  /* ── Vault: the sale ──────────────────────────────────────────────── */
  boughtNow: {
    s: 'Twój zakup: {title}',
    b: ['Cześć, {name}!', 'Dziękujemy za zakup: {title} (EU {size}).', '%rows', 'Dokończ płatność w ciągu 72 godzin, aby zapewnić sobie tę parę.'],
    c: 'Zapłać teraz',
  },
  wonAuction: {
    s: 'Wygrana licytacja: {title}',
    b: ['Cześć, {name}!', 'Gratulacje — wygrywasz licytację {title} (EU {size})!', '%rows', 'Dokończ płatność w ciągu 72 godzin, aby zapewnić sobie tę parę.'],
    c: 'Zapłać teraz',
  },
  offerAccepted: {
    s: 'Twoja propozycja została przyjęta: {title}',
    b: ['Cześć, {name}!', 'Sprzedający przyjął Twoją propozycję za {title} (EU {size}).', '%rows', 'Dokończ płatność w ciągu 72 godzin, aby zapewnić sobie tę parę.'],
    c: 'Zapłać teraz',
  },
  sold: {
    s: 'Sprzedano: {title}',
    b: ['Cześć, {name}!', 'Twoja para {title} sprzedała się za {price}.', '{payoutLine}', 'Gdy tylko kupujący zapłaci, wyślemy Ci e-mailem instrukcje wysyłki. Na razie niczego nie nadawaj.'],
  },
  paymentManual: {
    s: 'Płatność za {title}',
    b: ['Cześć, {name}!', 'Dziękujemy! W ciągu jednego dnia roboczego wyślemy Ci e-mailem dane do płatności na kwotę {amount}. Do tego czasu para pozostaje zarezerwowana dla Ciebie.'],
  },
  paidShip: {
    s: 'Opłacone — wyślij parę {title}',
    b: ['Cześć, {name}!', 'Kupujący zapłacił za {title} (zamówienie nr {order}).', '{howToShip}', '%address', 'Prosimy o wysyłkę w ciągu trzech dni roboczych.'],
    c: 'Wpisz numer przesyłki',
  },
  paymentReceived: {
    s: 'Otrzymaliśmy płatność za {title}',
    b: ['Cześć, {name}!', 'Dziękujemy — otrzymaliśmy Twoją płatność w wysokości {amount} za {title}.', '{next}'],
    c: 'Śledź zamówienie',
  },
  shippedToBuyer: {
    s: 'Twoja para {title} jest w drodze',
    b: ['Cześć, {name}!', 'Sprzedający nadał Twoją parę.', '%rows', 'Gdy paczka dotrze, sprawdź parę i potwierdź odbiór — a jeśli coś jest nie tak, zgłoś problem, zanim potwierdzisz.'],
    c: 'Potwierdź odbiór',
  },
  unpaidCancelled: {
    s: 'Sprzedaż anulowana — kupujący nie zapłacił',
    b: ['Cześć, {name}!', 'Kupujący nie zapłacił w ciągu 72 godzin, więc zamówienie nr {order} ({title}) zostało anulowane. Możesz wystawić parę ponownie jednym kliknięciem.'],
    c: 'Wystaw ponownie',
  },

  /* ── Vault: delivery, payouts and refunds ─────────────────────────── */
  delivered: {
    s: 'Doręczono — przygotowujemy Twoją wypłatę',
    b: ['Cześć, {name}!', 'Kupujący potwierdził odbiór zamówienia nr {order} ({title}). Przygotowujemy Twoją wypłatę w wysokości {payout}.'],
  },
  deliveredAuto: {
    s: 'Zamówienie nr {order} uznane za doręczone',
    b: ['Cześć, {name}!', 'Zamówienie nr {order} ({title}) uznajemy za doręczone: od wysyłki minęły dwa tygodnie, a nikt nie zgłosił problemu. Przygotowujemy Twoją wypłatę w wysokości {payout}.'],
  },
  payoutSent: {
    s: 'Twoja wypłata w wysokości {payout} jest w drodze',
    b: ['Cześć, {name}!', 'Przelaliśmy {payout} za zamówienie nr {order} ({title}) na Twoje konto Stripe. Stripe przekaże te pieniądze na Twoje konto bankowe zgodnie z Twoim zwykłym harmonogramem wypłat — zazwyczaj w ciągu kilku dni roboczych.'],
    c: 'Zobacz swoje wypłaty',
  },
  payoutSetupNeeded: {
    s: 'Skonfiguruj wypłaty, aby otrzymać {payout}',
    b: ['Cześć, {name}!', 'Zamówienie nr {order} ({title}) zostało zrealizowane i czeka na Ciebie {payout}. Aby otrzymać te pieniądze, dokończ konfigurację wypłat u naszego partnera płatniczego Stripe — zajmie to około 3 minut.'],
    c: 'Skonfiguruj wypłaty',
  },
  refundIssued: {
    s: 'Zwrot pieniędzy za zamówienie nr {order}',
    b: ['Cześć, {name}!', 'Zwróciliśmy {amount} za zamówienie nr {order} ({title}) na Twoją pierwotną metodę płatności. W zależności od banku pieniądze pojawią się na koncie w ciągu 5–10 dni roboczych.', '%message'],
  },
  refundManual: {
    s: 'Zwrot pieniędzy za zamówienie nr {order}',
    b: ['Cześć, {name}!', 'Zwracamy Ci całą kwotę {amount} za zamówienie nr {order} ({title}). W ciągu jednego dnia roboczego skontaktujemy się z Tobą w sprawie przelewu.', '%message'],
  },
  refundedSeller: {
    s: 'Zwrot pieniędzy dla kupującego — zamówienie nr {order}',
    b: ['Cześć, {name}!', 'Po rozpatrzeniu zgłoszenia kupującego zwróciliśmy pieniądze za zamówienie nr {order} ({title}). Nasze ustalenia:', '%message', 'Skontaktujemy się z Tobą w sprawie odesłania pary.'],
  },

  /* ── Vault: problems and feedback ─────────────────────────────────── */
  problemReceived: {
    s: 'Otrzymaliśmy Twoje zgłoszenie dotyczące zamówienia nr {order}',
    b: ['Cześć, {name}!', 'Dziękujemy za informację. Dopóki specjalista ShoeLab wyjaśnia sprawę, sprzedający nie otrzyma pieniędzy. Odezwiemy się w ciągu jednego dnia roboczego.', 'Twoje zgłoszenie:', '%message'],
  },
  problemSeller: {
    s: 'Kupujący zgłosił problem z zamówieniem nr {order}',
    b: ['Cześć, {name}!', 'Kupujący zgłosił problem z dostawą pary {title}. Twoja wypłata jest wstrzymana, dopóki specjalista ShoeLab nie wyjaśni sprawy. Wkrótce się z Tobą skontaktujemy.'],
  },
  disputeReleased: {
    s: 'Sprawa wyjaśniona — wypłata uruchomiona',
    b: ['Cześć, {name}!', 'Nasz specjalista zamknął zgłoszenie dotyczące zamówienia nr {order}. Uruchamiamy Twoją wypłatę w wysokości {payout}.', '%message'],
  },
  disputeClosed: {
    s: 'Twoje zgłoszenie dotyczące zamówienia nr {order} zostało zamknięte',
    b: ['Cześć, {name}!', 'Nasz specjalista rozpatrzył Twoje zgłoszenie i je zamknął.', '%message', 'Masz pytania? Po prostu odpowiedz na tę wiadomość.'],
  },
  feedbackNew: {
    s: 'Nowa ocena: {rating}',
    b: ['Cześć, {name}!', 'Kupujący wystawił ocenę za zamówienie nr {order}: {rating}.', '%message'],
  },

  /* ── Vault: the lab ───────────────────────────────────────────────── */
  labArrived: {
    s: 'Para {title} dotarła do laboratorium',
    b: ['Cześć, {name}!', 'Twoja para jest już u naszych specjalistów. Damy Ci znać o wyniku.'],
  },
  labPassedBuyer: {
    s: 'Autentyczność potwierdzona: {title}',
    b: ['Cześć, {name}!', 'Dobra wiadomość — Twoja para przeszła weryfikację w naszym laboratorium. Teraz wysyłamy ją do Ciebie.', '%message'],
  },
  labPassedSeller: {
    s: 'Autentyczność potwierdzona: {title}',
    b: ['Cześć, {name}!', 'Twoja para przeszła weryfikację. Wypłatę w wysokości {payout} otrzymasz, gdy para dotrze do kupującego.'],
  },
  labFailedBuyer: {
    s: 'Para z zamówienia nr {order} nie przeszła weryfikacji',
    b: ['Cześć, {name}!', 'Nasi specjaliści nie mogli potwierdzić autentyczności tej pary, dlatego nie zostanie ona do Ciebie wysłana. Twoja płatność w wysokości {amount} zostanie zwrócona w całości.'],
  },
  labFailedSeller: {
    s: 'Para {title} nie przeszła weryfikacji',
    b: ['Cześć, {name}!', 'Nasi specjaliści nie mogli potwierdzić autentyczności pary. Ich ustalenia:', '%message', 'Skontaktujemy się z Tobą w sprawie odesłania pary.'],
  },
  labShipped: {
    s: 'Para zweryfikowana i już w drodze: {title}',
    b: ['Cześć, {name}!', 'Twoja para Lab Verified jest już w drodze.', '%rows', 'Gdy dotrze, potwierdź odbiór — a jeśli coś jest nie tak, zgłoś problem, zanim potwierdzisz.'],
    c: 'Potwierdź odbiór',
  },

  /* ── support ──────────────────────────────────────────────────────── */
  supportReceived: {
    s: 'Otrzymaliśmy Twoją wiadomość (zgłoszenie nr {ticket})',
    b: ['Cześć, {name}!', 'Dziękujemy za kontakt. Specjalista ShoeLab odpowie w ciągu jednego dnia roboczego — zwykle dużo szybciej. Jeśli chcesz coś dodać, po prostu odpowiedz na tę wiadomość.', 'Twoja wiadomość:', '%message'],
  },
  supportReply: {
    s: 'Re: Twoje zgłoszenie nr {ticket} w ShoeLab',
    b: ['Cześć, {name}!', '%message', 'Jeśli masz więcej pytań, po prostu odpowiedz na tę wiadomość.', '{team}'],
  },

  /* ── to the studio (written in the studio's language) ─────────────── */
  sBookingNew: {
    s: '{tag} {customer} — {when} — {service}',
    b: ['Nowa rezerwacja {ref}.', '%rows', '%message', 'Odpowiedz na tę wiadomość, aby skontaktować się bezpośrednio z klientem.'],
  },
  sBookingPaid: {
    s: '[PAID] {customer} — {when} — {amount}',
    b: ['Otrzymaliśmy płatność za rezerwację {ref}. Wizyta jest potwierdzona.', '%rows', 'Odpowiedz na tę wiadomość, aby skontaktować się z klientem.'],
  },
  sContact: {
    s: 'Formularz kontaktowy — {customer}',
    b: ['Nowa wiadomość z formularza kontaktowego:', '%rows', '%message'],
  },
  sReview: {
    s: 'Nowa opinia czeka na zatwierdzenie — {customer} ({rating}★)',
    b: ['{customer} — nowa opinia z oceną {rating}★:', '%message'],
  },
  sListingReview: {
    s: '[VAULT] Nowe ogłoszenie do sprawdzenia: {title}',
    b: ['Nowe ogłoszenie czeka na sprawdzenie.', '%rows'],
    c: 'Otwórz panel laboratorium',
  },
  sSale: {
    s: '[VAULT] Sprzedaż nr {order}: {title} za {price}',
    b: ['Para została sprzedana. Kupujący ma teraz 72 godziny na zapłatę.', '%rows'],
  },
  sPaymentNeeded: {
    s: '[VAULT] Potrzebne dane do płatności: zamówienie nr {order}',
    b: ['Płatności kartą nie są włączone, więc wyślij, proszę, na adres {buyerEmail} dane do płatności na kwotę {amount} ({title}). Gdy pieniądze wpłyną, oznacz zamówienie w panelu laboratorium jako opłacone.'],
    c: 'Otwórz panel laboratorium',
  },
  sIncoming: {
    s: '[VAULT] Przesyłka do laboratorium: zamówienie nr {order}',
    b: ['Para Lab Verified jest w drodze do laboratorium.', '%rows'],
    c: 'Otwórz panel laboratorium',
  },
  sProblem: {
    s: '[VAULT] PROBLEM z zamówieniem nr {order}: {title}',
    b: ['Kupujący zgłosił problem. Wypłata jest wstrzymana, dopóki jej nie uruchomisz albo nie zwrócisz pieniędzy kupującemu.', '%rows', 'Kupujący pisze:', '%message'],
    c: 'Otwórz panel laboratorium',
  },
  sLabAddress: {
    s: '[VAULT] Wyślij adres laboratorium: zamówienie nr {order}',
    b: ['Zamówienie nr {order} ({title}) jest opłacone i sprzedający musi wysłać parę do laboratorium. Zmienna DROPOFF_ADDRESS nie jest ustawiona, więc sprzedający dostał informację, że adres przyjdzie e-mailem. Prześlij mu go, proszę.', '%rows'],
  },
  sPayoutDue: {
    s: '[VAULT] DO WYPŁATY: zamówienie nr {order} — {payout}',
    b: ['Zamówienie nr {order} ({title}) jest doręczone ({how}). Wypłać, proszę, pieniądze sprzedającemu przelewem bankowym.', '%rows'],
  },
  sPayoutFailed: {
    s: '[VAULT] Wypłata nieudana: zamówienie nr {order}',
    b: ['Stripe nie mógł wysłać wypłaty za zamówienie nr {order} ({title}). Możesz ją ponowić w panelu laboratorium.', '%message'],
    c: 'Otwórz panel laboratorium',
  },
  sRefund: {
    s: '[VAULT] ZWROT: zamówienie nr {order}',
    b: ['Zwróć, proszę, ręcznie {amount} kupującemu ({buyerEmail}) — to zamówienie nie zostało opłacone przez Stripe.', '%message'],
  },
  sRefunded: {
    s: '[VAULT] Zwrócono pieniądze: zamówienie nr {order} — {amount}',
    b: ['Stripe zwrócił {amount} kupującemu z zamówienia nr {order} ({title}). W razie potrzeby zorganizuj zwrot pary.', '%message'],
  },
  sRefundFailed: {
    s: '[VAULT] Zwrot nieudany: zamówienie nr {order}',
    b: ['Stripe nie mógł zwrócić {amount} za zamówienie nr {order} ({title}). Zwróć, proszę, pieniądze w panelu Stripe.', '%message'],
  },
  sSupport: {
    s: '[VAULT] Zgłoszenie nr {ticket}: {topic}',
    b: ['{customer} potrzebuje pomocy specjalisty.', '%rows', 'Podsumowanie:', '%message', '%transcript', 'Odpowiedz na tę wiadomość albo w panelu laboratorium.'],
    c: 'Otwórz panel laboratorium',
  },
  sTest: {
    s: '[TEST] Test poczty ShoeLab',
    b: ['To jest wiadomość testowa z /api/health?testmail=1.', 'Skoro ją czytasz, e-maile ze strony docierają na adres {to}.'],
  },
};
