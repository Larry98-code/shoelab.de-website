/* ShoeLab — booking flow: catalog, state, i18n and page controllers.
 * Shared by /booking.html, /checkout.html and /thank-you.html. */
(function (w, d) {
  'use strict';

  /* ── catalog ───────────────────────────────────────────────────────────
     Prices mirror the service cards on the homepage. Keep them in sync. */
  var SERVICES = [
    { id: 'refresh', name: 'The ShoeLab Refresh', once: 18.00, month: 14.00, tag: 'svcTag0', desc: 'svcDesc0' },
    { id: 'revival', name: 'The ShoeLab Revival', once: 35.00, month: 27.00, tag: 'svcTag1', desc: 'svcDesc1' },
    { id: 'autopsy', name: 'The ShoeLab Autopsy', once: 60.00, month: 47.00, tag: 'svcTag2', desc: 'svcDesc2' }
  ];

  var SLOTS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  var ORDER_KEY = 'shoelab_order';

  /* ── i18n ──────────────────────────────────────────────────────────────
     Missing keys fall back to English, so a partially translated language
     degrades to readable rather than blank. */
  var T = {
    en: {
      back: '← Back to site', step1: 'Service', step2: 'Payment', step3: 'Confirmed',
      required: 'Required', invalidEmail: 'Enter a valid email address', secure: 'Secure checkout · SSL encrypted',
      bEyebrow: 'Step 1 of 3', bTitleA: 'Book Your', bTitleB: 'Appointment',
      bSub: 'Pick your treatment, choose a slot, and drop your pair at the lab in Bremen. Takes under a minute.',
      planOnce: 'One-time', planMonth: 'Monthly', planSave: 'Monthly plans save you up to 22%',
      svcChoose: 'Choose your treatment',
      svcTag0: 'Back to baseline', svcTag1: 'Brought back to life', svcTag2: 'Every flaw erased',
      svcDesc0: 'A precise surface treatment that strips away dirt, revives colour and restores your kicks to baseline perfection.',
      svcDesc1: 'For shoes that have been through it. We go beneath the surface — lifting stains, rebuilding structure, restoring life.',
      svcDesc2: 'The full lab autopsy. Every layer examined, every flaw erased. Reserved for sneakers that demand the best.',
      when: 'When should we expect you?', hours: 'Mon–Fri 10:00–19:00 · Sat 10:00–16:00 · Sun closed', date: 'Preferred date', time: 'Time slot',
      pickSlot: 'Pick a time', closedSun: "We're closed on Sundays — please choose another day.",
      details: 'Your details', first: 'First name', last: 'Last name', email: 'Email', phone: 'Phone / WhatsApp',
      notes: 'Notes (brand, model, issue)', notesPh: 'e.g. White Air Force 1, scuffed toe box and yellowed soles',
      continueBtn: 'Continue to payment', summary: 'Your booking',
      sService: 'Service', sPlan: 'Plan', sWhen: 'When', sTotal: 'Total',
      onceLbl: 'one-time', monthLbl: 'per month', notChosen: 'Not chosen yet',
      cEyebrow: 'Step 2 of 3', cTitleA: 'Secure', cTitleB: 'Payment',
      cSub: 'Your slot is held while you pay. All payments are encrypted end to end.',
      method: 'Payment method', mCard: 'Card', mPaypal: 'PayPal', mSepa: 'SEPA', mKlarna: 'Klarna',
      cardNum: 'Card number', exp: 'Expiry', cvc: 'CVC', holder: 'Name on card',
      iban: 'IBAN', acctHolder: 'Account holder',
      redirectNote: 'You will be redirected to approve the payment, then brought straight back.', stripeNote: 'You choose and enter your payment details on Stripe\'s secure page — ShoeLab never sees or stores your card number.',
      payBtn: 'Pay securely', payStudio: 'Reserve — pay at the studio', payStudioNote: 'We\'ll hold your slot. Pay when you drop your shoes off.', orLabel: 'or', reserving: 'Reserving…', tUnpaidSub: 'Your slot is reserved. Pay when you drop your shoes off.', payAtStudioLbl: 'Pay at the studio', paySub: 'Start subscription', processing: 'Processing…',
      editBooking: '← Edit booking', noOrder: 'There is no booking in progress.',
      startBooking: 'Start a booking', billedMonthly: 'Billed monthly · cancel any time',
      tEyebrow: 'Step 3 of 3', tTitleA: "You're", tTitleB: 'Booked',
      tSub: 'Your slot is confirmed. A confirmation is on its way to your inbox.',
      refLbl: 'Your reference', next: 'What happens next',
      n1: 'Bring your pair to the lab at your chosen slot — or message us on WhatsApp to arrange a pickup.',
      n2: 'We inspect, photograph and treat them. You get an update when work begins.',
      n3: 'Collect them fresh, or we deliver them back. Most treatments are done within 48 hours.',
      backHome: 'Back to ShoeLab', questions: 'Questions? Contact the team'
    },
    de: {
      back: '← Zurück zur Seite', step1: 'Service', step2: 'Zahlung', step3: 'Bestätigt',
      required: 'Pflichtfeld', invalidEmail: 'Bitte eine gültige E-Mail-Adresse eingeben', secure: 'Sichere Zahlung · SSL-verschlüsselt',
      bEyebrow: 'Schritt 1 von 3', bTitleA: 'Termin', bTitleB: 'Buchen',
      bSub: 'Wähle deine Behandlung, such dir einen Termin und bring dein Paar zu uns ins Lab in Bremen. Dauert keine Minute.',
      planOnce: 'Einmalig', planMonth: 'Monatlich', planSave: 'Mit Monatsabo bis zu 22 % sparen',
      svcChoose: 'Wähle deine Behandlung',
      svcTag0: 'Zurück zum Original', svcTag1: 'Zurück ins Leben geholt', svcTag2: 'Jeder Makel beseitigt',
      svcDesc0: 'Eine präzise Oberflächenbehandlung, die Schmutz entfernt, Farben auffrischt und deine Kicks wieder perfekt macht.',
      svcDesc1: 'Für Schuhe, die einiges erlebt haben. Wir gehen unter die Oberfläche — Flecken raus, Struktur neu aufgebaut, Leben zurück.',
      svcDesc2: 'Die komplette Lab-Autopsie. Jede Schicht geprüft, jeder Makel beseitigt. Für Sneaker, die das Beste verlangen.',
      when: 'Wann dürfen wir dich erwarten?', hours: 'Mo–Fr 10:00–19:00 · Sa 10:00–16:00 · So geschlossen', date: 'Wunschdatum', time: 'Uhrzeit',
      pickSlot: 'Uhrzeit wählen', closedSun: 'Sonntags haben wir geschlossen — bitte wähle einen anderen Tag.',
      details: 'Deine Daten', first: 'Vorname', last: 'Nachname', email: 'E-Mail', phone: 'Telefon / WhatsApp',
      notes: 'Anmerkungen (Marke, Modell, Problem)', notesPh: 'z. B. weiße Air Force 1, Schrammen an der Spitze, vergilbte Sohlen',
      continueBtn: 'Weiter zur Zahlung', summary: 'Deine Buchung',
      sService: 'Service', sPlan: 'Tarif', sWhen: 'Termin', sTotal: 'Gesamt',
      onceLbl: 'einmalig', monthLbl: 'pro Monat', notChosen: 'Noch nicht gewählt',
      cEyebrow: 'Schritt 2 von 3', cTitleA: 'Sichere', cTitleB: 'Zahlung',
      cSub: 'Dein Termin ist reserviert, während du bezahlst. Alle Zahlungen sind Ende-zu-Ende verschlüsselt.',
      method: 'Zahlungsart', mCard: 'Karte', mPaypal: 'PayPal', mSepa: 'SEPA', mKlarna: 'Klarna',
      cardNum: 'Kartennummer', exp: 'Gültig bis', cvc: 'CVC', holder: 'Name auf der Karte',
      iban: 'IBAN', acctHolder: 'Kontoinhaber',
      redirectNote: 'Du wirst zur Freigabe der Zahlung weitergeleitet und danach direkt zurückgebracht.', stripeNote: 'Du wählst und gibst deine Zahlungsdaten auf der sicheren Seite von Stripe ein — ShoeLab sieht und speichert deine Kartennummer nie.',
      payBtn: 'Sicher bezahlen', payStudio: 'Reservieren — im Studio bezahlen', payStudioNote: 'Wir halten deinen Termin frei. Du zahlst bei der Abgabe.', orLabel: 'oder', reserving: 'Wird reserviert…', tUnpaidSub: 'Dein Termin ist reserviert. Du zahlst bei der Abgabe.', payAtStudioLbl: 'Zahlung im Studio', paySub: 'Abo starten', processing: 'Wird verarbeitet…',
      editBooking: '← Buchung bearbeiten', noOrder: 'Es läuft gerade keine Buchung.',
      startBooking: 'Buchung starten', billedMonthly: 'Monatliche Abrechnung · jederzeit kündbar',
      tEyebrow: 'Schritt 3 von 3', tTitleA: 'Termin', tTitleB: 'Gebucht',
      tSub: 'Dein Termin ist bestätigt. Die Bestätigung ist schon auf dem Weg in dein Postfach.',
      refLbl: 'Deine Referenz', next: 'Wie es weitergeht',
      n1: 'Bring dein Paar zum gewählten Termin ins Lab — oder schreib uns auf WhatsApp für eine Abholung.',
      n2: 'Wir prüfen, fotografieren und behandeln sie. Du bekommst eine Nachricht, sobald wir starten.',
      n3: 'Hol sie frisch ab oder wir bringen sie zurück. Die meisten Behandlungen sind in 48 Stunden fertig.',
      backHome: 'Zurück zu ShoeLab', questions: 'Fragen? Kontaktiere das Team'
    },
    pl: {
      back: '← Powrót do strony', step1: 'Usługa', step2: 'Płatność', step3: 'Potwierdzone',
      required: 'Pole wymagane', invalidEmail: 'Podaj poprawny adres e-mail', secure: 'Bezpieczna płatność · szyfrowanie SSL',
      bEyebrow: 'Krok 1 z 3', bTitleA: 'Zarezerwuj', bTitleB: 'Termin',
      bSub: 'Wybierz zabieg, wskaż termin i przynieś swoją parę do naszego labu w Bremie. Zajmie ci to mniej niż minutę.',
      planOnce: 'Jednorazowo', planMonth: 'Miesięcznie', planSave: 'W abonamencie miesięcznym oszczędzasz do 22%',
      svcChoose: 'Wybierz swój zabieg',
      svcTag0: 'Powrót do oryginału', svcTag1: 'Przywrócone do życia', svcTag2: 'Każda skaza usunięta',
      svcDesc0: 'Precyzyjny zabieg powierzchniowy, który usuwa brud, odświeża kolory i przywraca twoim kicksom wyjściową perfekcję.',
      svcDesc1: 'Dla butów, które mają już swoje za sobą. Wchodzimy pod powierzchnię — plamy znikają, struktura wraca na miejsce, a z nią życie.',
      svcDesc2: 'Pełna autopsja w labie. Każda warstwa sprawdzona, każda skaza usunięta. Dla sneakerów, które wymagają tego, co najlepsze.',
      when: 'Kiedy mamy się ciebie spodziewać?', hours: 'Pon–Pt 10:00–19:00 · Sob 10:00–16:00 · Niedziela nieczynne', date: 'Preferowana data', time: 'Godzina',
      pickSlot: 'Wybierz godzinę', closedSun: 'W niedziele mamy zamknięte — wybierz, proszę, inny dzień.',
      details: 'Twoje dane', first: 'Imię', last: 'Nazwisko', email: 'E-mail', phone: 'Telefon / WhatsApp',
      notes: 'Uwagi (marka, model, problem)', notesPh: 'np. białe Air Force 1, obtarty nosek i zżółkłe podeszwy',
      continueBtn: 'Przejdź do płatności', summary: 'Twoja rezerwacja',
      sService: 'Usługa', sPlan: 'Plan', sWhen: 'Termin', sTotal: 'Razem',
      onceLbl: 'jednorazowo', monthLbl: 'miesięcznie', notChosen: 'Jeszcze nie wybrano',
      cEyebrow: 'Krok 2 z 3', cTitleA: 'Bezpieczna', cTitleB: 'Płatność',
      cSub: 'Trzymamy dla ciebie termin, dopóki płacisz. Wszystkie płatności są szyfrowane end-to-end.',
      method: 'Metoda płatności', mCard: 'Karta', mPaypal: 'PayPal', mSepa: 'SEPA', mKlarna: 'Klarna',
      cardNum: 'Numer karty', exp: 'Ważna do', cvc: 'CVC', holder: 'Imię i nazwisko na karcie',
      iban: 'IBAN', acctHolder: 'Właściciel rachunku',
      redirectNote: 'Przekierujemy cię do zatwierdzenia płatności, a potem od razu wrócisz tutaj.', stripeNote: 'Metodę i dane płatności podajesz na bezpiecznej stronie Stripe — ShoeLab nigdy nie widzi ani nie przechowuje numeru twojej karty.',
      payBtn: 'Zapłać bezpiecznie', payStudio: 'Rezerwuj — zapłać w studiu', payStudioNote: 'Trzymamy dla ciebie termin. Zapłacisz przy oddaniu butów.', orLabel: 'lub', reserving: 'Rezerwuję…', tUnpaidSub: 'Twój termin jest zarezerwowany. Zapłacisz przy oddaniu butów.', payAtStudioLbl: 'Płatność w studiu', paySub: 'Rozpocznij abonament', processing: 'Przetwarzanie…',
      editBooking: '← Edytuj rezerwację', noOrder: 'Nie masz w toku żadnej rezerwacji.',
      startBooking: 'Zacznij rezerwację', billedMonthly: 'Rozliczenie miesięczne · anulujesz kiedy chcesz',
      tEyebrow: 'Krok 3 z 3', tTitleA: 'Termin', tTitleB: 'Zarezerwowany',
      tSub: 'Twój termin jest potwierdzony. Potwierdzenie już leci na twoją skrzynkę.',
      refLbl: 'Twój numer referencyjny', next: 'Co dalej',
      n1: 'Przynieś swoją parę do labu w wybranym terminie — albo napisz do nas na WhatsAppie, żebyśmy ją odebrali.',
      n2: 'Sprawdzamy je, fotografujemy i bierzemy się do pracy. Dostaniesz wiadomość, gdy zaczniemy.',
      n3: 'Odbierzesz je świeże albo odwieziemy ci je z powrotem. Większość zabiegów kończymy w ciągu 48 godzin.',
      backHome: 'Powrót do ShoeLab', questions: 'Pytania? Skontaktuj się z zespołem'
    },
    ru: {
      back: '← Назад на сайт',
      step1: 'Услуга',
      step2: 'Оплата',
      step3: 'Подтверждено',
      required: 'Обязательное поле',
      invalidEmail: 'Введи корректный адрес email',
      secure: 'Безопасная оплата · SSL-шифрование',
      bEyebrow: 'Шаг 1 из 3',
      bTitleA: 'Забронируй',
      bTitleB: 'визит',
      bSub: 'Выбери обработку, забронируй удобное время и привези свою пару к нам в лаб в Бремене. Займёт меньше минуты.',
      planOnce: 'Разово',
      planMonth: 'Ежемесячно',
      planSave: 'С месячной подпиской экономишь до 22 %',
      svcChoose: 'Выбери свою обработку',
      svcTag0: 'Возврат к оригиналу',
      svcTag1: 'Возвращены к жизни',
      svcTag2: 'Каждый изъян устранён',
      svcDesc0: 'Точная обработка поверхности: снимаем грязь, освежаем цвет и возвращаем твоим кикам идеальный вид.',
      svcDesc1: 'Для обуви, которая прошла через многое. Идём глубже поверхности — выводим пятна, восстанавливаем форму, возвращаем жизнь.',
      svcDesc2: 'Полная лабораторная автопсия. Каждый слой под осмотром, каждый изъян устранён. Для сникеров, которым нужно только лучшее.',
      when: 'Когда тебя ждать?', hours: 'Пн–Пт 10:00–19:00 · Сб 10:00–16:00 · Вс выходной',
      date: 'Удобная дата',
      time: 'Время',
      pickSlot: 'Выбери время',
      closedSun: 'По воскресеньям мы закрыты — выбери, пожалуйста, другой день.',
      details: 'Твои данные',
      first: 'Имя',
      last: 'Фамилия',
      email: 'Email',
      phone: 'Телефон / WhatsApp',
      notes: 'Комментарий (бренд, модель, проблема)',
      notesPh: 'например, белые Air Force 1, потёртый носок и пожелтевшие подошвы',
      continueBtn: 'Перейти к оплате',
      summary: 'Твоя бронь',
      sService: 'Услуга',
      sPlan: 'Тариф',
      sWhen: 'Когда',
      sTotal: 'Итого',
      onceLbl: 'разово',
      monthLbl: 'в месяц',
      notChosen: 'Пока не выбрано',
      cEyebrow: 'Шаг 2 из 3',
      cTitleA: 'Безопасная',
      cTitleB: 'оплата',
      cSub: 'Твоё время держим за тобой, пока ты оплачиваешь. Все платежи шифруются от начала до конца.',
      method: 'Способ оплаты',
      mCard: 'Карта',
      mPaypal: 'PayPal',
      mSepa: 'SEPA',
      mKlarna: 'Klarna',
      cardNum: 'Номер карты',
      exp: 'Срок действия',
      cvc: 'CVC',
      holder: 'Имя на карте',
      iban: 'IBAN',
      acctHolder: 'Владелец счёта',
      redirectNote: 'Мы перенаправим тебя для подтверждения платежа, а сразу после вернём обратно.', stripeNote: 'Способ и данные оплаты ты вводишь на защищённой странице Stripe — ShoeLab никогда не видит и не хранит номер твоей карты.',
      payBtn: 'Оплатить безопасно', payStudio: 'Забронировать — оплата в студии', payStudioNote: 'Мы придержим твоё время. Оплатишь, когда привезёшь обувь.', orLabel: 'или', reserving: 'Бронируем…', tUnpaidSub: 'Твоё время забронировано. Оплатишь при сдаче обуви.', payAtStudioLbl: 'Оплата в студии',
      paySub: 'Оформить подписку',
      processing: 'Обрабатываем…',
      editBooking: '← Изменить бронь',
      noOrder: 'Сейчас нет активной брони.',
      startBooking: 'Начать бронирование',
      billedMonthly: 'Списание раз в месяц · отмена в любой момент',
      tEyebrow: 'Шаг 3 из 3',
      tTitleA: 'Визит',
      tTitleB: 'забронирован',
      tSub: 'Твой визит подтверждён. Подтверждение уже летит тебе на почту.',
      refLbl: 'Твой номер брони',
      next: 'Что дальше',
      n1: 'Привези свою пару в лаб в выбранное время — или напиши нам в WhatsApp, и мы заберём её сами.',
      n2: 'Мы осматриваем, фотографируем и обрабатываем их. Как только начнём работу, пришлём тебе сообщение.',
      n3: 'Забери их свежими или мы привезём их обратно. Большинство обработок готовы за 48 часов.',
      backHome: 'Назад в ShoeLab',
      questions: 'Вопросы? Свяжись с командой'
    },
    uk: {
      back: '← Назад на сайт', step1: 'Послуга', step2: 'Оплата', step3: 'Підтверджено',
      required: 'Обов’язкове поле', invalidEmail: 'Введи дійсну електронну адресу', secure: 'Безпечна оплата · SSL-шифрування',
      bEyebrow: 'Крок 1 з 3', bTitleA: 'Забронюй', bTitleB: 'візит',
      bSub: 'Обери обробку, вибери зручний час і принеси свою пару до лабораторії в Бремені. Це займе менше хвилини.',
      planOnce: 'Разово', planMonth: 'Щомісяця', planSave: 'З місячною підпискою економиш до 22%',
      svcChoose: 'Обери свою обробку',
      svcTag0: 'Назад до оригіналу', svcTag1: 'Повернуто до життя', svcTag2: 'Кожен дефект усунено',
      svcDesc0: 'Точна обробка поверхні: знімаємо бруд, оновлюємо колір і повертаємо твоїм кіксам ідеальний вигляд.',
      svcDesc1: 'Для взуття, яке пережило немало. Ми йдемо під поверхню — виводимо плями, відновлюємо структуру, повертаємо життя.',
      svcDesc2: 'Повна лабораторна автопсія. Кожен шар перевірено, кожен дефект усунено. Для сникерів, які вимагають найкращого.',
      when: 'Коли тебе чекати?', hours: 'Пн–Пт 10:00–19:00 · Сб 10:00–16:00 · Нд вихідний', date: 'Бажана дата', time: 'Час',
      pickSlot: 'Вибери час', closedSun: 'У неділю ми зачинені — обери, будь ласка, інший день.',
      details: 'Твої дані', first: 'Ім’я', last: 'Прізвище', email: 'Email', phone: 'Телефон / WhatsApp',
      notes: 'Примітки (бренд, модель, проблема)', notesPh: 'напр. білі Air Force 1, потертий носок і пожовклі підошви',
      continueBtn: 'Далі до оплати', summary: 'Твоє бронювання',
      sService: 'Послуга', sPlan: 'Тариф', sWhen: 'Коли', sTotal: 'Разом',
      onceLbl: 'разово', monthLbl: 'на місяць', notChosen: 'Ще не вибрано',
      cEyebrow: 'Крок 2 з 3', cTitleA: 'Безпечна', cTitleB: 'оплата',
      cSub: 'Твій час зарезервовано, поки ти оплачуєш. Усі платежі зашифровані від початку до кінця.',
      method: 'Спосіб оплати', mCard: 'Картка', mPaypal: 'PayPal', mSepa: 'SEPA', mKlarna: 'Klarna',
      cardNum: 'Номер картки', exp: 'Термін дії', cvc: 'CVC', holder: 'Ім’я на картці',
      iban: 'IBAN', acctHolder: 'Власник рахунку',
      redirectNote: 'Ми перенаправимо тебе для підтвердження платежу, а потім одразу повернемо сюди.', stripeNote: 'Спосіб і дані оплати ти вводиш на захищеній сторінці Stripe — ShoeLab ніколи не бачить і не зберігає номер твоєї картки.',
      payBtn: 'Оплатити безпечно', payStudio: 'Забронювати — оплата в студії', payStudioNote: 'Ми притримаємо твій час. Оплатиш, коли привезеш взуття.', orLabel: 'або', reserving: 'Бронюємо…', tUnpaidSub: 'Твій час заброньовано. Оплатиш при здачі взуття.', payAtStudioLbl: 'Оплата в студії', paySub: 'Оформити підписку', processing: 'Обробляємо…',
      editBooking: '← Редагувати бронювання', noOrder: 'Зараз немає активного бронювання.',
      startBooking: 'Почати бронювання', billedMonthly: 'Щомісячна оплата · скасувати можна будь-коли',
      tEyebrow: 'Крок 3 з 3', tTitleA: 'Візит', tTitleB: 'заброньовано',
      tSub: 'Твій час підтверджено. Підтвердження вже летить на твою пошту.',
      refLbl: 'Твій номер бронювання', next: 'Що далі',
      n1: 'Принеси свою пару до лабораторії у вибраний час — або напиши нам у WhatsApp, і ми заберемо її самі.',
      n2: 'Ми оглядаємо, фотографуємо та обробляємо їх. Щойно почнемо — отримаєш повідомлення.',
      n3: 'Забереш їх свіжими — або ми привеземо назад. Більшість обробок готові протягом 48 годин.',
      backHome: 'Назад до ShoeLab', questions: 'Питання? Зв’яжися з командою'
    },
    it: {
      back: '← Torna al sito',
      step1: 'Servizio',
      step2: 'Pagamento',
      step3: 'Confermato',
      required: 'Obbligatorio',
      invalidEmail: 'Inserisci un indirizzo email valido',
      secure: 'Pagamento sicuro · crittografia SSL',
      bEyebrow: 'Passo 1 di 3',
      bTitleA: 'Prenota il',
      bTitleB: 'Tuo Posto',
      bSub: 'Scegli il trattamento, prendi l\'orario che preferisci e porta il tuo paio al lab di Brema. Ci metti meno di un minuto.',
      planOnce: 'Una tantum',
      planMonth: 'Mensile',
      planSave: 'Con l\'abbonamento mensile risparmi fino al 22%',
      svcChoose: 'Scegli il tuo trattamento',
      svcTag0: 'Di nuovo come nuove',
      svcTag1: 'Riportate in vita',
      svcTag2: 'Ogni difetto cancellato',
      svcDesc0: 'Un trattamento di superficie preciso che porta via lo sporco, ravviva i colori e riporta le tue kicks alla perfezione originale.',
      svcDesc1: 'Per scarpe che ne hanno passate tante. Andiamo sotto la superficie: macchie via, struttura ricostruita, vita restituita.',
      svcDesc2: 'L\'autopsia completa del lab. Ogni strato esaminato, ogni difetto cancellato. Riservata alle sneaker che pretendono il massimo.',
      when: 'Quando ti aspettiamo?', hours: 'Lun–Ven 10:00–19:00 · Sab 10:00–16:00 · Dom chiuso',
      date: 'Data preferita',
      time: 'Fascia oraria',
      pickSlot: 'Scegli un orario',
      closedSun: 'La domenica siamo chiusi — scegli un altro giorno.',
      details: 'I tuoi dati',
      first: 'Nome',
      last: 'Cognome',
      email: 'Email',
      phone: 'Telefono / WhatsApp',
      notes: 'Note (marca, modello, problema)',
      notesPh: 'es. Air Force 1 bianche, punta graffiata e suole ingiallite',
      continueBtn: 'Vai al pagamento',
      summary: 'La tua prenotazione',
      sService: 'Servizio',
      sPlan: 'Piano',
      sWhen: 'Quando',
      sTotal: 'Totale',
      onceLbl: 'una tantum',
      monthLbl: 'al mese',
      notChosen: 'Non ancora scelto',
      cEyebrow: 'Passo 2 di 3',
      cTitleA: 'Pagamento',
      cTitleB: 'Sicuro',
      cSub: 'Il tuo orario resta riservato mentre paghi. Tutti i pagamenti sono crittografati end-to-end.',
      method: 'Metodo di pagamento',
      mCard: 'Carta',
      mPaypal: 'PayPal',
      mSepa: 'SEPA',
      mKlarna: 'Klarna',
      cardNum: 'Numero della carta',
      exp: 'Scadenza',
      cvc: 'CVC',
      holder: 'Nome sulla carta',
      iban: 'IBAN',
      acctHolder: 'Intestatario del conto',
      redirectNote: 'Ti reindirizziamo per autorizzare il pagamento e poi torni subito qui.', stripeNote: 'Scegli e inserisci i dati di pagamento sulla pagina sicura di Stripe — ShoeLab non vede né conserva mai il numero della tua carta.',
      payBtn: 'Paga in sicurezza', payStudio: 'Prenota — paghi in studio', payStudioNote: 'Teniamo il tuo slot. Paghi quando porti le scarpe.', orLabel: 'oppure', reserving: 'Prenotazione…', tUnpaidSub: 'Il tuo slot è prenotato. Paghi quando porti le scarpe.', payAtStudioLbl: 'Pagamento in studio',
      paySub: 'Attiva l\'abbonamento',
      processing: 'Elaborazione…',
      editBooking: '← Modifica prenotazione',
      noOrder: 'Non c\'è nessuna prenotazione in corso.',
      startBooking: 'Inizia una prenotazione',
      billedMonthly: 'Addebito mensile · disdici quando vuoi',
      tEyebrow: 'Passo 3 di 3',
      tTitleA: 'Prenotazione',
      tTitleB: 'Confermata',
      tSub: 'Il tuo orario è confermato. La conferma sta già arrivando nella tua casella.',
      refLbl: 'Il tuo riferimento',
      next: 'Cosa succede ora',
      n1: 'Porta il tuo paio al lab all\'orario scelto — oppure scrivici su WhatsApp e passiamo a ritirarlo.',
      n2: 'Le controlliamo, le fotografiamo e le trattiamo. Ti avvisiamo appena iniziamo.',
      n3: 'Le ritiri fresche, o te le riportiamo noi. La maggior parte dei trattamenti è pronta in 48 ore.',
      backHome: 'Torna a ShoeLab',
      questions: 'Domande? Contatta il team'
    },
    es: {
      back: '← Volver al sitio',
      step1: 'Servicio',
      step2: 'Pago',
      step3: 'Confirmado',
      required: 'Obligatorio',
      invalidEmail: 'Introduce una dirección de correo válida',
      secure: 'Pago seguro · cifrado SSL',
      bEyebrow: 'Paso 1 de 3',
      bTitleA: 'Reserva tu',
      bTitleB: 'Cita',
      bSub: 'Elige tu tratamiento, reserva una hora y deja tu par en el lab de Bremen. Te lleva menos de un minuto.',
      planOnce: 'Pago único',
      planMonth: 'Mensual',
      planSave: 'Con el plan mensual ahorras hasta un 22 %',
      svcChoose: 'Elige tu tratamiento',
      svcTag0: 'De vuelta al original',
      svcTag1: 'De vuelta a la vida',
      svcTag2: 'Sin un solo defecto',
      svcDesc0: 'Un tratamiento de superficie preciso que elimina la suciedad, revive el color y devuelve tus kicks a su estado original.',
      svcDesc1: 'Para zapas que han pasado por todo. Vamos más allá de la superficie: manchas fuera, estructura reconstruida, vida de vuelta.',
      svcDesc2: 'La autopsia completa del lab. Cada capa examinada, cada defecto borrado. Reservado para sneakers que exigen lo mejor.',
      when: '¿Cuándo te esperamos?', hours: 'Lun–Vie 10:00–19:00 · Sáb 10:00–16:00 · Dom cerrado',
      date: 'Fecha preferida',
      time: 'Hora',
      pickSlot: 'Elige una hora',
      closedSun: 'Los domingos cerramos — elige otro día, por favor.',
      details: 'Tus datos',
      first: 'Nombre',
      last: 'Apellido',
      email: 'Correo electrónico',
      phone: 'Teléfono / WhatsApp',
      notes: 'Notas (marca, modelo, problema)',
      notesPh: 'p. ej. Air Force 1 blancas, puntera rozada y suelas amarillentas',
      continueBtn: 'Continuar al pago',
      summary: 'Tu reserva',
      sService: 'Servicio',
      sPlan: 'Plan',
      sWhen: 'Cita',
      sTotal: 'Total',
      onceLbl: 'pago único',
      monthLbl: 'al mes',
      notChosen: 'Sin elegir todavía',
      cEyebrow: 'Paso 2 de 3',
      cTitleA: 'Pago',
      cTitleB: 'Seguro',
      cSub: 'Tu hora queda reservada mientras pagas. Todos los pagos van cifrados de extremo a extremo.',
      method: 'Forma de pago',
      mCard: 'Tarjeta',
      mPaypal: 'PayPal',
      mSepa: 'SEPA',
      mKlarna: 'Klarna',
      cardNum: 'Número de tarjeta',
      exp: 'Caducidad',
      cvc: 'CVC',
      holder: 'Nombre en la tarjeta',
      iban: 'IBAN',
      acctHolder: 'Titular de la cuenta',
      redirectNote: 'Te redirigimos para autorizar el pago y vuelves aquí directamente.', stripeNote: 'Eliges e introduces tus datos de pago en la página segura de Stripe — ShoeLab nunca ve ni guarda el número de tu tarjeta.',
      payBtn: 'Pagar de forma segura', payStudio: 'Reservar — paga en el estudio', payStudioNote: 'Guardamos tu hora. Pagas cuando traigas las zapatillas.', orLabel: 'o', reserving: 'Reservando…', tUnpaidSub: 'Tu hora está reservada. Pagas cuando traigas las zapatillas.', payAtStudioLbl: 'Pago en el estudio',
      paySub: 'Empezar suscripción',
      processing: 'Procesando…',
      editBooking: '← Editar reserva',
      noOrder: 'No hay ninguna reserva en curso.',
      startBooking: 'Empezar una reserva',
      billedMonthly: 'Facturación mensual · cancela cuando quieras',
      tEyebrow: 'Paso 3 de 3',
      tTitleA: 'Cita',
      tTitleB: 'Reservada',
      tSub: 'Tu cita está confirmada. La confirmación ya va camino de tu bandeja de entrada.',
      refLbl: 'Tu referencia',
      next: 'Cómo seguimos',
      n1: 'Trae tu par al lab a la hora elegida — o escríbenos por WhatsApp y lo recogemos.',
      n2: 'Las revisamos, fotografiamos y tratamos. Te avisamos en cuanto empezamos.',
      n3: 'Recógelas recién hechas o te las llevamos de vuelta. La mayoría de los tratamientos están listos en 48 horas.',
      backHome: 'Volver a ShoeLab',
      questions: '¿Preguntas? Contacta con el equipo'
    },
    fr: {
      back: '← Retour au site', step1: 'Service', step2: 'Paiement', step3: 'Confirmé',
      required: 'Champ obligatoire', invalidEmail: 'Saisis une adresse e-mail valide', secure: 'Paiement sécurisé · chiffrement SSL',
      bEyebrow: 'Étape 1 sur 3', bTitleA: 'Prends', bTitleB: 'Rendez-vous',
      bSub: 'Choisis ton traitement, prends un créneau et dépose ta paire au lab à Brême. Ça prend moins d\'une minute.',
      planOnce: 'Paiement unique', planMonth: 'Mensuel', planSave: 'Avec l\'abonnement mensuel, tu économises jusqu\'à 22 %',
      svcChoose: 'Choisis ton traitement',
      svcTag0: 'Comme au premier jour', svcTag1: 'Ramenées à la vie', svcTag2: 'Plus aucun défaut',
      svcDesc0: 'Un traitement de surface précis qui chasse la saleté, ravive les couleurs et rend à tes kicks leur perfection d\'origine.',
      svcDesc1: 'Pour les paires qui en ont vu. On passe sous la surface — taches levées, structure reconstruite, vie retrouvée.',
      svcDesc2: 'L\'autopsie complète au lab. Chaque couche examinée, chaque défaut effacé. Réservée aux sneakers qui exigent le meilleur.',
      when: 'Quand est-ce qu\'on t\'attend ?', hours: 'Lun–Ven 10h–19h · Sam 10h–16h · Dim fermé', date: 'Date souhaitée', time: 'Créneau horaire',
      pickSlot: 'Choisis un horaire', closedSun: 'On est fermé le dimanche — choisis un autre jour.',
      details: 'Tes coordonnées', first: 'Prénom', last: 'Nom', email: 'E-mail', phone: 'Téléphone / WhatsApp',
      notes: 'Remarques (marque, modèle, problème)', notesPh: 'ex. Air Force 1 blanches, bout éraflé et semelles jaunies',
      continueBtn: 'Continuer vers le paiement', summary: 'Ta réservation',
      sService: 'Service', sPlan: 'Formule', sWhen: 'Quand', sTotal: 'Total',
      onceLbl: 'une fois', monthLbl: 'par mois', notChosen: 'Pas encore choisi',
      cEyebrow: 'Étape 2 sur 3', cTitleA: 'Paiement', cTitleB: 'Sécurisé',
      cSub: 'Ton créneau reste réservé pendant que tu paies. Tous les paiements sont chiffrés de bout en bout.',
      method: 'Moyen de paiement', mCard: 'Carte', mPaypal: 'PayPal', mSepa: 'SEPA', mKlarna: 'Klarna',
      cardNum: 'Numéro de carte', exp: 'Expiration', cvc: 'CVC', holder: 'Nom sur la carte',
      iban: 'IBAN', acctHolder: 'Titulaire du compte',
      redirectNote: 'Tu vas être redirigé pour valider le paiement, puis ramené ici directement.', stripeNote: 'Tu choisis et saisis tes informations de paiement sur la page sécurisée de Stripe — ShoeLab ne voit ni ne conserve jamais ton numéro de carte.',
      payBtn: 'Payer en toute sécurité', payStudio: 'Réserver — payer au studio', payStudioNote: 'On garde ton créneau. Tu paies en déposant tes chaussures.', orLabel: 'ou', reserving: 'Réservation…', tUnpaidSub: 'Ton créneau est réservé. Tu paies en déposant tes chaussures.', payAtStudioLbl: 'Paiement au studio', paySub: 'Démarrer l\'abonnement', processing: 'Traitement en cours…',
      editBooking: '← Modifier la réservation', noOrder: 'Aucune réservation en cours.',
      startBooking: 'Commencer une réservation', billedMonthly: 'Facturation mensuelle · résiliable à tout moment',
      tEyebrow: 'Étape 3 sur 3', tTitleA: 'C\'est', tTitleB: 'Réservé',
      tSub: 'Ton créneau est confirmé. La confirmation est déjà en route vers ta boîte mail.',
      refLbl: 'Ta référence', next: 'La suite',
      n1: 'Apporte ta paire au lab au créneau choisi — ou écris-nous sur WhatsApp pour qu\'on vienne la chercher.',
      n2: 'On les inspecte, on les photographie et on les traite. Tu reçois un message dès qu\'on commence.',
      n3: 'Récupère-les toutes fraîches, ou on te les rapporte. La plupart des traitements sont terminés en 48 heures.',
      backHome: 'Retour à ShoeLab', questions: 'Des questions ? Contacte l’équipe'
    }
  };

  var lang = 'en';
  function t(k) {
    var L = T[lang];
    if (L && L[k] != null) return L[k];
    return T.en[k] != null ? T.en[k] : k;
  }

  /* ── order state ───────────────────────────────────────────────────────
     sessionStorage, not the URL: the URL carries only what is safe to share
     (service + plan). Personal details never land in a link or in history. */
  function getOrder() {
    try { return JSON.parse(w.sessionStorage.getItem(ORDER_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setOrder(o) {
    try { w.sessionStorage.setItem(ORDER_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function clearOrder() {
    try { w.sessionStorage.removeItem(ORDER_KEY); } catch (e) {}
  }
  function serviceById(id) {
    for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return SERVICES[i];
    return null;
  }
  function money(n) { return '€' + Number(n).toFixed(2); }

  /* ── i18n application ──────────────────────────────────────────────────*/
  function applyI18n() {
    d.querySelectorAll('[data-t]').forEach(function (el) {
      var v = t(el.getAttribute('data-t'));
      if (v != null) el.textContent = v;
    });
    d.querySelectorAll('[data-t-ph]').forEach(function (el) {
      var v = t(el.getAttribute('data-t-ph'));
      if (v != null) el.setAttribute('placeholder', v);
    });
    d.documentElement.lang = lang;
    var cur = d.getElementById('flLangCur');
    if (cur) cur.textContent = lang.toUpperCase();
    d.querySelectorAll('.fl-lang-opt').forEach(function (o) {
      o.classList.toggle('active', o.getAttribute('data-lang') === lang);
    });
  }

  var LANG_META = [
    { c: 'en', n: 'English', f: '🇬🇧' }, { c: 'de', n: 'Deutsch', f: '🇩🇪' },
    { c: 'pl', n: 'Polski', f: '🇵🇱' }, { c: 'ru', n: 'Русский', f: '🇷🇺' },
    { c: 'uk', n: 'Українська', f: '🇺🇦' }, { c: 'it', n: 'Italiano', f: '🇮🇹' },
    { c: 'es', n: 'Español', f: '🇪🇸' }, { c: 'fr', n: 'Français', f: '🇫🇷' }
  ];

  function buildLangMenu(onPick) {
    var menu = d.getElementById('flLangMenu');
    var btn = d.getElementById('flLangBtn');
    if (!menu || !btn) return;
    menu.innerHTML = LANG_META.map(function (l) {
      return '<button type="button" class="fl-lang-opt" data-lang="' + l.c + '"><span>' + l.f + '</span> ' + l.n + '</button>';
    }).join('');
    btn.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('open'); });
    d.addEventListener('click', function () { menu.classList.remove('open'); });
    menu.addEventListener('click', function (e) {
      var o = e.target.closest('.fl-lang-opt');
      if (!o) return;
      var L = o.getAttribute('data-lang');
      if (w.SLGeo) w.SLGeo.choose(L);
      menu.classList.remove('open');
      onPick(L);
    });
  }

  /* Resolve language (with location awareness) and re-render on change. */
  function initLang(render) {
    var apply = function (L) {
      lang = (T[L] || L === 'en') ? L : L;   // unknown codes still fall back per-key
      if (w.SLGeo && w.SLGeo.remember) w.SLGeo.remember(lang);
      applyI18n();
      if (render) render();
    };
    if (w.SLGeo) {
      w.SLGeo.resolve(function (L, info) {
        apply(L);
        if (info && info.suggest) {
          w.SLGeo.offer(info.suggest, function (chosen) { apply(chosen); });
        }
      });
    } else {
      apply('en');
    }
    buildLangMenu(apply);
  }

  /* ── shared chrome ─────────────────────────────────────────────────────*/
  function markSteps(active) {
    d.querySelectorAll('.fl-step').forEach(function (el, i) {
      el.classList.toggle('active', i === active);
      el.classList.toggle('done', i < active);
    });
  }

  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

  function fieldError(input, on, msg) {
    input.classList.toggle('err', !!on);
    var e = input.parentNode.querySelector('.fl-err');
    if (e) { e.classList.toggle('on', !!on); if (msg) e.textContent = msg; }
  }

  /* Reference like SL-7K2F9. Deterministic enough to be unique per booking
     without pretending to be a real order id from a backend we don't have. */
  function makeRef(seed) {
    var A = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ', out = '';
    var n = Math.abs(seed | 0) || 1;
    for (var i = 0; i < 5; i++) { n = (n * 1103515245 + 12345) & 0x7fffffff; out += A[n % A.length]; }
    return 'SL-' + out;
  }

  w.SLFlow = {
    SERVICES: SERVICES, SLOTS: SLOTS, LANG_META: LANG_META, T: T,
    t: t, lang: function () { return lang; },
    getOrder: getOrder, setOrder: setOrder, clearOrder: clearOrder,
    serviceById: serviceById, money: money,
    applyI18n: applyI18n, initLang: initLang, markSteps: markSteps,
    validEmail: validEmail, fieldError: fieldError, makeRef: makeRef
  };
})(window, document);
