// ShoeLab emails — French (fr), the translation of en.js (which explains the format).
// French typography: no-break spaces before : ; ? ! and after n° are typed as real
// (invisible) characters: U+00A0 before : and after n°, U+202F before ; ? !
export default {
  _: {
    hi: 'Bonjour {name},', hiAll: 'Bonjour,',
    signoff: 'À bientôt,\nShoeLab', team: 'L’équipe ShoeLab', vaultTeam: 'L’équipe du ShoeLab Vault',
    readIn: 'Lire cet e-mail dans une autre langue :',
    footer: 'ShoeLab · Studio de soin de sneakers · Brême',
    footerVault: 'ShoeLab Vault · revente de sneakers authentifiées par ShoeLab, Brême',
    replyHint: 'Des questions ? Réponds simplement à cet e-mail.',
    whatsapp: 'Tu peux aussi nous écrire sur WhatsApp : +49 177 2258878.',
    dropoffTitle: 'Adresse de dépôt :', dropoffLater: 'Nous t’enverrons l’adresse exacte de dépôt sur WhatsApp avant ton rendez-vous.',
    // table labels
    ref: 'Référence', when: 'Date', service: 'Prestation', plan: 'Formule', amount: 'Montant', toPay: 'À régler au studio', paid: 'Montant payé',
    item: 'Article', auth: 'Authentification', ship: 'Livraison', total: 'Total', commission: 'Commission ShoeLab',
    postage: 'Remboursement du port', payout: 'Ton versement', order: 'Commande', tracking: 'Numéro de suivi', size: 'Taille', price: 'Prix',
    tier: 'Vérification', format: 'Type de vente', seller: 'Vendeur', buyer: 'Acheteur', email: 'E-mail', phone: 'Téléphone',
    name: 'Nom', notes: 'Remarques', language: 'Langue', payment: 'Paiement', status: 'Statut', category: 'Sujet',
    oneTime: 'À l’unité', monthly: 'Abonnement mensuel', atStudio: 'Au studio — rien n’a encore été débité', online: 'En ligne via Stripe',
    whenAt: '{date} à {time}',
    // shared sentences and words
    tierLab: 'Lab Verified', tierPhoto: 'Photo Verified', auction: 'Vente aux enchères', fixed: 'Achat immédiat',
    nextPhotoCheck: 'Un spécialiste ShoeLab examine maintenant tes photos pour vérifier l’authenticité de la paire. Si tout concorde, ton annonce sera mise en ligne avec le badge Photo Verified.',
    nextLabCheck: 'Nous jetons un rapide coup d’œil à ton annonce, puis nous la mettons en ligne. Une fois la paire vendue, tu l’envoies à notre lab : un spécialiste l’authentifie à la main avant qu’elle ne parte chez l’acheteur.',
    liveLab: 'Tous les acheteurs voient qu’elle sera contrôlée à la main dans notre lab avant l’expédition.',
    livePhoto: 'Nos spécialistes ont vérifié tes photos : ton annonce affiche donc le badge Photo Verified.',
    paidNextLab: 'Le vendeur envoie maintenant la paire à notre lab. Un spécialiste l’authentifie avant qu’elle ne poursuive sa route jusqu’à toi.',
    paidNextPhoto: 'Le vendeur va maintenant t’envoyer la paire. Tu recevras le numéro de suivi par e-mail.',
    shipLab: 'Envoie la paire à ShoeLab pour authentification — et non à l’acheteur. Glisse dans la boîte un mot indiquant la commande n° {order}, puis saisis le numéro de suivi dans ton tableau de bord Vault.',
    shipPhoto: 'Envoie la paire directement à l’acheteur, puis saisis le numéro de suivi dans ton tableau de bord Vault. Adresse de l’acheteur :',
    labAddressLater: 'Nous t’enverrons l’adresse du lab ShoeLab par e-mail sous un jour ouvré.',
    payoutAfterLab: 'Tu recevras {payout} une fois que la paire aura passé notre contrôle au lab et sera arrivée chez l’acheteur.',
    payoutAfterDelivery: 'Tu recevras {payout} dès que l’acheteur aura reçu la paire.',
    ratePos: 'positif', rateNeu: 'neutre', rateNeg: 'négatif',
    catOrder: 'Problème de commande', catPayment: 'Paiement ou versement', catAccount: 'Compte', catAuth: 'Authentification', catTech: 'Problème technique', catOther: 'Autre',
    statusOpen: 'Ouverte', statusAnswered: 'Réponse envoyée',
  },

  /* ── bookings ─────────────────────────────────────────────────────── */
  bookingReserved: {
    s: 'Ton créneau ShoeLab est réservé — {ref}',
    b: ['Bonjour {name},', 'Ton créneau chez ShoeLab est réservé.', '%rows', '%dropoff',
      'Besoin de modifier quelque chose ? Réponds simplement à cet e-mail ou écris-nous sur WhatsApp au +49 177 2258878.', '{signoff}'],
  },
  bookingRequested: {
    s: 'Ta demande de réservation ShoeLab — {ref}',
    b: ['Bonjour {name},', 'Merci d’avoir réservé chez ShoeLab. Nous avons bien reçu ta demande :', '%rows',
      'Tu recevras une confirmation séparée dès que ton paiement aura été validé. Si tu as fermé la page de paiement avant la fin, réponds à cet e-mail : nous te garderons quand même le créneau.',
      '{signoff}'],
  },
  bookingPaid: {
    s: 'Paiement confirmé — ton rendez-vous ShoeLab {ref}',
    b: ['Bonjour {name},', 'Ton paiement a bien été accepté et ton rendez-vous est confirmé.', '%rows', '%dropoff',
      'La plupart des soins sont terminés sous 48 heures.', 'Des questions ? Réponds à cet e-mail ou écris-nous sur WhatsApp au +49 177 2258878.', '{signoff}'],
  },

  /* ── account ──────────────────────────────────────────────────────── */
  verifyEmail: {
    s: 'Confirme ton adresse e-mail',
    b: ['Bonjour {name},', 'Bienvenue chez ShoeLab. Confirme que cette adresse e-mail est bien la tienne : cela protège ton compte et te permet d’enchérir, d’acheter et de vendre dans le ShoeLab Vault.',
      'Le lien est valable 7 jours.', 'Si tu n’as pas créé de compte, tu peux ignorer cet e-mail.'],
    c: 'Confirmer mon adresse e-mail',
  },
  passwordReset: {
    s: 'Réinitialise ton mot de passe ShoeLab',
    b: ['Bonjour {name},', 'Nous avons reçu une demande de réinitialisation de ton mot de passe ShoeLab. Utilise le bouton ci-dessous dans l’heure qui suit pour en choisir un nouveau.',
      'Si tu n’as rien demandé, tu peux ignorer cet e-mail sans crainte.'],
    c: 'Choisir un nouveau mot de passe',
  },

  /* ── Vault: listings ──────────────────────────────────────────────── */
  listingSubmitted: {
    s: 'Nous vérifions ton annonce',
    b: ['Bonjour {name},', 'Merci d’avoir mis en vente ta paire {title} (EU {size}).', '{next}', 'Cela prend généralement moins d’un jour ouvré.'],
    c: 'Voir ton annonce',
  },
  listingLive: {
    s: 'Ta paire {title} est en ligne',
    b: ['Bonjour {name},', 'Bonne nouvelle : ta paire {title} est maintenant en ligne dans le ShoeLab Vault.', '{note}'],
    c: 'Voir ton annonce',
  },
  listingRejected: {
    s: 'Ton annonce {title} n’a pas pu être acceptée',
    b: ['Bonjour {name},', 'Notre spécialiste n’a pas pu approuver cette annonce :', '%message', 'N’hésite pas à la remettre en vente une fois le problème corrigé.'],
    c: 'Mettre une paire en vente',
  },
  auctionNoBids: {
    s: 'Ta vente aux enchères s’est terminée sans enchère',
    b: ['Bonjour {name},', 'Ta paire {title} n’a reçu aucune enchère. Tu peux la remettre en vente en un clic — avec un prix de départ plus bas ou en Achat immédiat. Tes photos sont conservées.'],
    c: 'La remettre en vente',
  },

  /* ── Vault: bids and offers ───────────────────────────────────────── */
  outbid: {
    s: 'Ton enchère sur {title} a été dépassée',
    b: ['Bonjour {name},', 'Quelqu’un a placé une enchère plus élevée sur la paire {title}. Le prix est maintenant de {price}.', 'Enchéris à nouveau avant la fin de la vente.'],
    c: 'Enchérir à nouveau',
  },
  offerReceived: {
    s: 'Nouvelle offre : {amount} pour {title}',
    b: ['Bonjour {name},', 'Quelqu’un propose {amount} pour ta paire {title} (prix affiché : {price}).', '%message', 'Accepte, refuse ou fais une contre-offre sous 48 heures.'],
    c: 'Répondre à l’offre',
  },
  offerDeclined: {
    s: 'Ton offre a été refusée',
    b: ['Bonjour {name},', 'Ton offre de {amount} pour la paire {title} a été refusée. Tu peux toujours l’acheter au prix affiché ou faire une nouvelle offre.'],
    c: 'Voir la paire',
  },
  counterOffer: {
    s: 'Contre-offre : {amount} pour {title}',
    b: ['Bonjour {name},', 'Le vendeur a répondu à ton offre de {offer} pour la paire {title} par une contre-offre de {amount}.', 'Accepte-la ou refuse-la sous 48 heures.'],
    c: 'Répondre à la contre-offre',
  },

  /* ── Vault: the sale ──────────────────────────────────────────────── */
  boughtNow: {
    s: 'Tu as acheté {title}',
    b: ['Bonjour {name},', 'Tu as acheté la paire {title} (EU {size}).', '%rows', 'Finalise le paiement sous 72 heures pour t’assurer la paire.'],
    c: 'Payer maintenant',
  },
  wonAuction: {
    s: 'Tu as remporté l’enchère pour {title}',
    b: ['Bonjour {name},', 'Félicitations ! Tu as remporté l’enchère pour la paire {title} (EU {size}).', '%rows', 'Finalise le paiement sous 72 heures pour t’assurer la paire.'],
    c: 'Payer maintenant',
  },
  offerAccepted: {
    s: 'Ton offre a été acceptée : {title}',
    b: ['Bonjour {name},', 'Le vendeur a accepté ton offre pour la paire {title} (EU {size}).', '%rows', 'Finalise le paiement sous 72 heures pour t’assurer la paire.'],
    c: 'Payer maintenant',
  },
  sold: {
    s: 'Vendue : {title}',
    b: ['Bonjour {name},', 'Ta paire {title} a été vendue pour {price}.', '{payoutLine}', 'Nous t’enverrons les instructions d’expédition dès que l’acheteur aura payé. Rien à envoyer pour l’instant.'],
  },
  paymentManual: {
    s: 'Paiement de ta paire {title}',
    b: ['Bonjour {name},', 'Merci. Nous t’enverrons par e-mail les informations de paiement pour {amount} sous un jour ouvré. D’ici là, la paire reste réservée pour toi.'],
  },
  paidShip: {
    s: 'Paiement reçu — merci d’expédier {title}',
    b: ['Bonjour {name},', 'L’acheteur a payé ta paire {title} (commande n° {order}).', '{howToShip}', '%address', 'Merci d’expédier la paire sous trois jours ouvrés.'],
    c: 'Saisir le numéro de suivi',
  },
  paymentReceived: {
    s: 'Paiement reçu pour {title}',
    b: ['Bonjour {name},', 'Merci ! Nous avons bien reçu ton paiement de {amount} pour la paire {title}.', '{next}'],
    c: 'Suivre ta commande',
  },
  shippedToBuyer: {
    s: 'Ta paire {title} est en route',
    b: ['Bonjour {name},', 'Le vendeur a expédié ta paire.', '%rows', 'À son arrivée, vérifie-la et confirme la réception — ou signale un problème avant de confirmer.'],
    c: 'Confirmer la réception',
  },
  unpaidCancelled: {
    s: 'Vente annulée — l’acheteur n’a pas payé',
    b: ['Bonjour {name},', 'L’acheteur n’a pas payé sous 72 heures : la commande n° {order} ({title}) a donc été annulée. Tu peux remettre la paire en vente en un clic.'],
    c: 'La remettre en vente',
  },

  /* ── Vault: delivery, payouts and refunds ─────────────────────────── */
  delivered: {
    s: 'Livrée — ton versement est en préparation',
    b: ['Bonjour {name},', 'L’acheteur a confirmé la réception de la commande n° {order} ({title}). Ton versement de {payout} est en préparation.'],
  },
  deliveredAuto: {
    s: 'La commande n° {order} est considérée comme livrée',
    b: ['Bonjour {name},', 'La commande n° {order} ({title}) est considérée comme livrée : deux semaines se sont écoulées depuis l’expédition sans aucun signalement de problème. Ton versement de {payout} est en préparation.'],
  },
  payoutSent: {
    s: 'Ton versement de {payout} est en route',
    b: ['Bonjour {name},', 'Nous avons envoyé {payout} pour la commande n° {order} ({title}) sur ton compte Stripe. Stripe le verse ensuite sur ton compte bancaire selon ton calendrier habituel — généralement sous quelques jours ouvrés.'],
    c: 'Voir tes versements',
  },
  payoutSetupNeeded: {
    s: 'Configure tes versements pour recevoir {payout}',
    b: ['Bonjour {name},', 'La commande n° {order} ({title}) est terminée et une somme de {payout} t’attend. Pour la recevoir, finalise la configuration de tes versements avec notre partenaire de paiement Stripe — cela prend environ 3 minutes.'],
    c: 'Configurer les versements',
  },
  refundIssued: {
    s: 'Remboursement de la commande n° {order}',
    b: ['Bonjour {name},', 'Nous avons remboursé {amount} pour la commande n° {order} ({title}) sur ton moyen de paiement d’origine. Selon ta banque, le montant apparaîtra sous 5 à 10 jours ouvrés.', '%message'],
  },
  refundManual: {
    s: 'Remboursement de la commande n° {order}',
    b: ['Bonjour {name},', 'Nous te remboursons intégralement ton paiement de {amount} pour la commande n° {order} ({title}). Nous te contacterons au sujet du virement sous un jour ouvré.', '%message'],
  },
  refundedSeller: {
    s: 'La commande n° {order} a été remboursée',
    b: ['Bonjour {name},', 'Après examen du signalement de l’acheteur, nous avons remboursé la commande n° {order} ({title}) :', '%message', 'Nous te contacterons pour organiser le retour de la paire.'],
  },

  /* ── Vault: problems and feedback ─────────────────────────────────── */
  problemReceived: {
    s: 'Nous avons bien reçu ton signalement sur la commande n° {order}',
    b: ['Bonjour {name},', 'Merci de nous avoir prévenus. Le vendeur ne sera pas payé tant qu’un spécialiste ShoeLab n’aura pas examiné la situation. Nous revenons vers toi sous un jour ouvré.', 'Ton signalement :', '%message'],
  },
  problemSeller: {
    s: 'L’acheteur a signalé un problème sur la commande n° {order}',
    b: ['Bonjour {name},', 'L’acheteur de ta paire {title} a signalé un problème avec la livraison. Ton versement est suspendu pendant qu’un spécialiste ShoeLab examine la situation. Nous te contacterons très vite.'],
  },
  disputeReleased: {
    s: 'Problème résolu — versement débloqué',
    b: ['Bonjour {name},', 'Notre spécialiste a clôturé le signalement sur la commande n° {order}. Ton versement de {payout} est en cours de déblocage.', '%message'],
  },
  disputeClosed: {
    s: 'Ton signalement sur la commande n° {order} est clôturé',
    b: ['Bonjour {name},', 'Notre spécialiste a examiné ton signalement et l’a clôturé.', '%message', 'Des questions ? Réponds simplement à cet e-mail.'],
  },
  feedbackNew: {
    s: 'Nouvel avis {rating}',
    b: ['Bonjour {name},', 'L’acheteur de la commande n° {order} a laissé un avis {rating}.', '%message'],
  },

  /* ── Vault: the lab ───────────────────────────────────────────────── */
  labArrived: {
    s: 'Ta paire {title} est arrivée au lab',
    b: ['Bonjour {name},', 'Ta paire est maintenant entre les mains de nos spécialistes. Nous te tiendrons au courant du résultat.'],
  },
  labPassedBuyer: {
    s: 'Authentifiée : {title}',
    b: ['Bonjour {name},', 'Bonne nouvelle : ta paire a passé avec succès notre authentification au lab. Elle va maintenant t’être expédiée.', '%message'],
  },
  labPassedSeller: {
    s: 'Authentifiée : {title}',
    b: ['Bonjour {name},', 'Ta paire a passé l’authentification. Ton versement de {payout} suivra dès qu’elle sera arrivée chez l’acheteur.'],
  },
  labFailedBuyer: {
    s: 'La commande n° {order} n’a pas passé l’authentification',
    b: ['Bonjour {name},', 'Nos spécialistes n’ont pas pu authentifier cette paire : elle ne te sera donc pas envoyée. Ton paiement de {amount} est intégralement remboursé.'],
  },
  labFailedSeller: {
    s: 'Ta paire {title} n’a pas passé l’authentification',
    b: ['Bonjour {name},', 'Nos spécialistes n’ont pas pu authentifier la paire :', '%message', 'Nous te contacterons pour organiser son retour.'],
  },
  labShipped: {
    s: 'Authentifiée et en route : {title}',
    b: ['Bonjour {name},', 'Ta paire Lab Verified est en route.', '%rows', 'À son arrivée, confirme la réception — ou signale un problème avant de confirmer.'],
    c: 'Confirmer la réception',
  },

  /* ── support ──────────────────────────────────────────────────────── */
  supportReceived: {
    s: 'Nous avons bien reçu ton message (demande n° {ticket})',
    b: ['Bonjour {name},', 'Merci de nous avoir écrit. Un spécialiste ShoeLab te répondra sous un jour ouvré — souvent bien plus tôt. Pour ajouter quoi que ce soit, réponds simplement à cet e-mail.', 'Ton message :', '%message'],
  },
  supportReply: {
    s: 'Re: ta demande ShoeLab n° {ticket}',
    b: ['Bonjour {name},', '%message', 'Si tu as d’autres questions, réponds simplement à cet e-mail.', '{team}'],
  },

  /* ── to the studio (written in the studio's language) ─────────────── */
  sBookingNew: {
    s: '{tag} {customer} — {when} — {service}',
    b: ['Nouvelle réservation {ref}.', '%rows', '%message', 'Réponds à cet e-mail pour joindre directement le client.'],
  },
  sBookingPaid: {
    s: '[PAID] {customer} — {when} — {amount}',
    b: ['Paiement reçu pour la réservation {ref}. Le rendez-vous est confirmé.', '%rows', 'Réponds à cet e-mail pour joindre le client.'],
  },
  sContact: {
    s: 'Formulaire de contact — {customer}',
    b: ['Nouveau message via le formulaire de contact :', '%rows', '%message'],
  },
  sReview: {
    s: 'Nouvel avis en attente de validation — {customer} ({rating}★)',
    b: ['{customer} a laissé un avis noté {rating}/5 :', '%message'],
  },
  sListingReview: {
    s: '[VAULT] Nouvelle annonce à vérifier : {title}',
    b: ['Une nouvelle annonce attend sa vérification.', '%rows'],
    c: 'Ouvrir la console du lab',
  },
  sSale: {
    s: '[VAULT] Vente n° {order} : {title} pour {price}',
    b: ['Une paire a été vendue. L’acheteur a maintenant 72 heures pour payer.', '%rows'],
  },
  sPaymentNeeded: {
    s: '[VAULT] Informations de paiement à envoyer : commande n° {order}',
    b: ['Le paiement par carte n’est pas activé : envoie par e-mail à {buyerEmail} les informations de paiement pour {amount} ({title}). Marque la commande comme payée dans la console du lab dès que l’argent est arrivé.'],
    c: 'Ouvrir la console du lab',
  },
  sIncoming: {
    s: '[VAULT] En route vers le lab : commande n° {order}',
    b: ['Une paire Lab Verified est en route vers le lab.', '%rows'],
    c: 'Ouvrir la console du lab',
  },
  sProblem: {
    s: '[VAULT] PROBLÈME signalé sur la commande n° {order} : {title}',
    b: ['Un acheteur a signalé un problème. Le versement est suspendu jusqu’à ce que tu le débloques ou que tu rembourses l’acheteur.', '%rows', 'L’acheteur indique :', '%message'],
    c: 'Ouvrir la console du lab',
  },
  sLabAddress: {
    s: '[VAULT] Adresse du lab à envoyer : commande n° {order}',
    b: ['La commande n° {order} ({title}) est payée et le vendeur doit envoyer la paire au lab. DROPOFF_ADDRESS n’est pas défini : le vendeur a donc été informé que l’adresse lui serait communiquée par e-mail. Merci de la lui envoyer.', '%rows'],
  },
  sPayoutDue: {
    s: '[VAULT] VERSEMENT à effectuer : commande n° {order} — {payout}',
    b: ['La commande n° {order} ({title}) est livrée ({how}). Merci de payer le vendeur par virement bancaire.', '%rows'],
  },
  sPayoutFailed: {
    s: '[VAULT] Échec du versement pour la commande n° {order}',
    b: ['Stripe n’a pas pu envoyer le versement pour la commande n° {order} ({title}). Tu peux le relancer depuis la console du lab.', '%message'],
    c: 'Ouvrir la console du lab',
  },
  sRefund: {
    s: '[VAULT] REMBOURSEMENT à effectuer : commande n° {order}',
    b: ['Merci de rembourser manuellement {amount} à {buyerEmail} — cette commande n’a pas été payée via Stripe.', '%message'],
  },
  sRefunded: {
    s: '[VAULT] Commande n° {order} remboursée — {amount}',
    b: ['Stripe a remboursé {amount} à l’acheteur de la commande n° {order} ({title}). Organise le retour de la paire si nécessaire.', '%message'],
  },
  sRefundFailed: {
    s: '[VAULT] Échec du remboursement pour la commande n° {order}',
    b: ['Stripe n’a pas pu rembourser {amount} pour la commande n° {order} ({title}). Merci d’effectuer le remboursement depuis le tableau de bord Stripe.', '%message'],
  },
  sSupport: {
    s: '[VAULT] Demande de support n° {ticket} : {topic}',
    b: ['{customer} a besoin d’un spécialiste.', '%rows', 'Résumé :', '%message', '%transcript', 'Réponds à cet e-mail, ou directement depuis la console du lab.'],
    c: 'Ouvrir la console du lab',
  },
  sTest: {
    s: '[TEST] Vérification des e-mails ShoeLab',
    b: ['Ceci est un test envoyé depuis /api/health?testmail=1.', 'Si tu lis ce message, les e-mails du site arrivent bien à {to}.'],
  },
};
