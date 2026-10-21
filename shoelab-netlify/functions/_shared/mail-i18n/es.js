// ShoeLab emails — Spanish (español), a translation of en.js.
// Same keys, same paragraph order, same {placeholders}; en.js explains the format.
export default {
  _: {
    hi: 'Hola, {name}:', hiAll: 'Hola:',
    signoff: '¡Hasta pronto!\nShoeLab', team: 'El equipo de ShoeLab', vaultTeam: 'El equipo de ShoeLab Vault',
    readIn: 'Lee este correo en otro idioma:',
    footer: 'ShoeLab · Estudio de cuidado de sneakers · Bremen',
    footerVault: 'ShoeLab Vault · reventa de sneakers autenticadas de ShoeLab, Bremen',
    replyHint: '¿Tienes alguna pregunta? Responde a este correo.',
    whatsapp: 'También puedes escribirnos por WhatsApp: +49 177 2258878.',
    dropoffTitle: 'Dirección para dejar tus zapatillas:', dropoffLater: 'Antes de tu cita te enviaremos por WhatsApp la dirección exacta donde dejar tus zapatillas.',
    // table labels
    ref: 'Referencia', when: 'Fecha y hora', service: 'Servicio', plan: 'Plan', amount: 'Importe', toPay: 'A pagar en el estudio', paid: 'Pagado',
    item: 'Artículo', auth: 'Autenticación', ship: 'Envío', total: 'Total', commission: 'Comisión de ShoeLab',
    postage: 'Reembolso del envío', payout: 'Cobro del vendedor', order: 'Pedido', tracking: 'N.º de seguimiento', size: 'Talla', price: 'Precio',
    tier: 'Verificación', format: 'Formato', seller: 'Vendedor', buyer: 'Comprador', email: 'Correo electrónico', phone: 'Teléfono',
    name: 'Nombre', notes: 'Notas', language: 'Idioma', payment: 'Pago', status: 'Estado', category: 'Tema',
    oneTime: 'Pago único', monthly: 'Suscripción mensual', atStudio: 'En el estudio (aún no se ha cobrado nada)', online: 'Online con Stripe',
    whenAt: '{date} a las {time}',
    // shared sentences and words
    tierLab: 'Lab Verified', tierPhoto: 'Photo Verified', auction: 'Subasta', fixed: 'Cómpralo ya',
    nextPhotoCheck: 'Ahora un especialista de ShoeLab revisa tus fotos para comprobar que el par es auténtico. Si todo cuadra, el anuncio se publicará con el distintivo Photo Verified.',
    nextLabCheck: 'Le echamos un vistazo rápido y lo publicamos. Cuando se venda, lo envías a nuestro lab y un especialista lo autentica a mano antes de que siga su camino hasta el comprador.',
    liveLab: 'Ya está a la venta, y todos los compradores ven que nuestro lab revisará el par a mano antes de enviarlo.',
    livePhoto: 'Nuestros especialistas han revisado tus fotos, así que lleva el distintivo Photo Verified.',
    paidNextLab: 'Ahora el vendedor envía el par a nuestro lab. Un especialista lo autentica antes de que siga su camino hasta ti.',
    paidNextPhoto: 'Ahora el vendedor te envía el par. Recibirás el número de seguimiento por correo.',
    shipLab: 'Envía el par a ShoeLab para su autenticación, no al comprador. Incluye dentro de la caja una nota con el número de pedido {order} y, después, introduce el número de seguimiento en tu panel del Vault.',
    shipPhoto: 'Envía el par directamente al comprador y, después, introduce el número de seguimiento en tu panel del Vault. Esta es la dirección de envío:',
    labAddressLater: 'Te enviaremos por correo la dirección del lab de ShoeLab en un plazo de un día laborable.',
    // how an order came to count as delivered (studio payout emails)
    howBuyer: 'el comprador confirmó la entrega', howAuto: 'automáticamente, 14 días después del envío',
    howReleased: 'incidencia cerrada a favor del vendedor', howRetry: 'cobro reintentado',
    payoutAfterLab: 'Recibirás {payout} cuando el par haya superado nuestra inspección en el lab y haya llegado al comprador.',
    payoutAfterDelivery: 'Recibirás {payout} cuando el comprador tenga el par.',
    ratePos: 'positiva', rateNeu: 'neutral', rateNeg: 'negativa',
    catOrder: 'Problema con un pedido', catPayment: 'Pago o cobro', catAccount: 'Cuenta', catAuth: 'Autenticación', catTech: 'Problema técnico', catOther: 'Otro',
    statusOpen: 'Abierta', statusAnswered: 'Respondida',
  },

  /* ── bookings ─────────────────────────────────────────────────────── */
  bookingReserved: {
    s: 'Tu cita en ShoeLab está reservada — {ref}',
    b: ['Hola, {name}:', 'Ya tienes tu hora reservada en ShoeLab.', '%rows', '%dropoff',
      '¿Necesitas cambiar algo? Responde a este correo o escríbenos por WhatsApp al +49 177 2258878.', '{signoff}'],
  },
  bookingRequested: {
    s: 'Tu solicitud de cita en ShoeLab — {ref}',
    b: ['Hola, {name}:', 'Gracias por reservar en ShoeLab. Hemos recibido tu solicitud:', '%rows',
      'Recibirás una confirmación aparte en cuanto se procese tu pago. Si cerraste la página de pago antes de terminar, responde a este correo y te guardaremos la hora igualmente.',
      '{signoff}'],
  },
  bookingPaid: {
    s: 'Pago confirmado — tu cita en ShoeLab {ref}',
    b: ['Hola, {name}:', 'Hemos recibido tu pago y tu cita está confirmada.', '%rows', '%dropoff',
      'La mayoría de los tratamientos están listos en 48 horas.', '¿Tienes alguna pregunta? Responde a este correo o escríbenos por WhatsApp al +49 177 2258878.', '{signoff}'],
  },

  /* ── account ──────────────────────────────────────────────────────── */
  verifyEmail: {
    s: 'Confirma tu dirección de correo',
    b: ['Hola, {name}:', 'Te damos la bienvenida a ShoeLab. Confirma que esta es tu dirección de correo: así tu cuenta está protegida y puedes pujar, comprar y vender en el ShoeLab Vault.',
      'El enlace es válido durante 7 días.', 'Si no has creado ninguna cuenta, puedes ignorar este correo.'],
    c: 'Confirmar mi correo',
  },
  passwordReset: {
    s: 'Restablece tu contraseña de ShoeLab',
    b: ['Hola, {name}:', 'Hemos recibido una solicitud para restablecer tu contraseña de ShoeLab. Usa el botón de abajo en la próxima hora para elegir una nueva.',
      'Si no lo has pedido tú, puedes ignorar este correo sin problema.'],
    c: 'Elegir una nueva contraseña',
  },

  /* ── Vault: listings ──────────────────────────────────────────────── */
  listingSubmitted: {
    s: 'Estamos revisando tu anuncio',
    b: ['Hola, {name}:', 'Gracias por publicar tu par de {title} (EU {size}).', '{next}', 'Normalmente tardamos menos de un día laborable.'],
    c: 'Ver tu anuncio',
  },
  listingLive: {
    s: 'Tu anuncio de {title} ya está publicado',
    b: ['Hola, {name}:', '¡Buenas noticias! Tu anuncio de {title} ya está publicado en el ShoeLab Vault.', '{note}'],
    c: 'Ver tu anuncio',
  },
  listingRejected: {
    s: 'No hemos podido aceptar tu anuncio de {title}',
    b: ['Hola, {name}:', 'Nuestro especialista no ha podido aprobar este anuncio:', '%message', 'Puedes volver a publicarlo cuando hayas solucionado el problema.'],
    c: 'Publicar un par',
  },
  auctionNoBids: {
    s: 'Tu subasta ha terminado sin pujas',
    b: ['Hola, {name}:', 'Tu anuncio de {title} no ha recibido ninguna puja. Puedes volver a publicarlo con un solo clic, con un precio de salida más bajo o a precio fijo con «Cómpralo ya». Conservamos tus fotos.'],
    c: 'Volver a publicarlo',
  },

  /* ── Vault: bids and offers ───────────────────────────────────────── */
  outbid: {
    s: 'Han superado tu puja por {title}',
    b: ['Hola, {name}:', 'Alguien ha pujado más alto por {title}. El precio actual es de {price}.', 'Vuelve a pujar antes de que termine la subasta.'],
    c: 'Volver a pujar',
  },
  offerReceived: {
    s: 'Nueva oferta: {amount} por {title}',
    b: ['Hola, {name}:', 'Alguien ha ofrecido {amount} por tu par de {title} (precio del anuncio: {price}).', '%message', 'Acéptala, recházala o haz una contraoferta en un plazo de 48 horas.'],
    c: 'Responder a la oferta',
  },
  offerDeclined: {
    s: 'Han rechazado tu oferta',
    b: ['Hola, {name}:', 'Han rechazado tu oferta de {amount} por {title}. Todavía puedes comprar el par al precio del anuncio o hacer una nueva oferta.'],
    c: 'Ver el par',
  },
  counterOffer: {
    s: 'Contraoferta: {amount} por {title}',
    b: ['Hola, {name}:', 'El vendedor ha respondido a tu oferta de {offer} por {title} con una contraoferta de {amount}.', 'Acéptala o recházala en un plazo de 48 horas.'],
    c: 'Responder a la contraoferta',
  },

  /* ── Vault: the sale ──────────────────────────────────────────────── */
  boughtNow: {
    s: 'Has comprado {title}',
    b: ['Hola, {name}:', 'Has comprado {title} (EU {size}).', '%rows', 'Completa el pago en un plazo de 72 horas para asegurarte el par.'],
    c: 'Pagar ahora',
  },
  wonAuction: {
    s: 'Has ganado la subasta de {title}',
    b: ['Hola, {name}:', '¡Enhorabuena! Has ganado la subasta de {title} (EU {size}).', '%rows', 'Completa el pago en un plazo de 72 horas para asegurarte el par.'],
    c: 'Pagar ahora',
  },
  offerAccepted: {
    s: 'Han aceptado tu oferta: {title}',
    b: ['Hola, {name}:', 'El vendedor ha aceptado tu oferta por {title} (EU {size}).', '%rows', 'Completa el pago en un plazo de 72 horas para asegurarte el par.'],
    c: 'Pagar ahora',
  },
  sold: {
    s: 'Vendido: {title}',
    b: ['Hola, {name}:', 'Tu par de {title} se ha vendido por {price}.', '{payoutLine}', 'Te enviaremos por correo las instrucciones de envío en cuanto el comprador haya pagado. De momento no tienes que enviar nada.'],
  },
  paymentManual: {
    s: 'Pago de {title}',
    b: ['Hola, {name}:', 'Gracias. Te enviaremos por correo los datos para pagar {amount} en un plazo de un día laborable. Mientras tanto, el par sigue reservado para ti.'],
  },
  paidShip: {
    s: 'Pagado — ya puedes enviar {title}',
    b: ['Hola, {name}:', 'El comprador ha pagado tu par de {title} (pedido n.º {order}).', '{howToShip}', '%address', 'Recuerda enviarlo en un plazo de tres días laborables.'],
    c: 'Introducir el número de seguimiento',
  },
  paymentReceived: {
    s: 'Pago recibido: {title}',
    b: ['Hola, {name}:', 'Gracias. Hemos recibido tu pago de {amount} por {title}.', '{next}'],
    c: 'Seguir tu pedido',
  },
  shippedToBuyer: {
    s: 'Tu par de {title} va de camino',
    b: ['Hola, {name}:', 'El vendedor ha enviado tu par.', '%rows', 'Cuando llegue, revísalo y confirma la entrega. Si algo no está bien, comunica el problema antes de confirmar.'],
    c: 'Confirmar entrega',
  },
  unpaidCancelled: {
    s: 'Venta cancelada — el comprador no ha pagado',
    b: ['Hola, {name}:', 'El comprador no ha pagado en un plazo de 72 horas, así que hemos cancelado el pedido n.º {order} de {title}. Puedes volver a publicar el par con un solo clic.'],
    c: 'Volver a publicarlo',
  },

  /* ── Vault: delivery, payouts and refunds ─────────────────────────── */
  delivered: {
    s: 'Entregado — estamos preparando tu cobro',
    b: ['Hola, {name}:', 'El comprador ha confirmado la entrega del pedido n.º {order} ({title}). Estamos preparando tu cobro de {payout}.'],
  },
  deliveredAuto: {
    s: 'El pedido n.º {order} se da por entregado',
    b: ['Hola, {name}:', 'El pedido n.º {order} ({title}) se da por entregado: han pasado dos semanas desde el envío sin que se haya comunicado ningún problema. Estamos preparando tu cobro de {payout}.'],
  },
  payoutSent: {
    s: 'Tu cobro de {payout} va de camino',
    b: ['Hola, {name}:', 'Hemos enviado {payout} del pedido n.º {order} ({title}) a tu cuenta de Stripe. Stripe lo transferirá a tu banco según tu calendario habitual, normalmente en pocos días laborables.'],
    c: 'Ver tus cobros',
  },
  payoutSetupNeeded: {
    s: 'Configura los cobros para recibir {payout}',
    b: ['Hola, {name}:', 'El pedido n.º {order} ({title}) se ha completado y tienes {payout} esperándote. Para recibir el dinero, termina de configurar los cobros con Stripe, nuestro socio de pagos. Se tarda unos 3 minutos.'],
    c: 'Configurar los cobros',
  },
  refundIssued: {
    s: 'Reembolso del pedido n.º {order}',
    b: ['Hola, {name}:', 'Hemos reembolsado {amount} del pedido n.º {order} ({title}) a tu método de pago original. Según tu banco, lo verás reflejado en un plazo de 5 a 10 días laborables.', '%message'],
  },
  refundManual: {
    s: 'Reembolso del pedido n.º {order}',
    b: ['Hola, {name}:', 'Vamos a reembolsarte íntegramente tu pago de {amount} del pedido n.º {order} ({title}). Te escribiremos en un plazo de un día laborable para organizar la transferencia.', '%message'],
  },
  refundedSeller: {
    s: 'Se ha reembolsado el pedido n.º {order}',
    b: ['Hola, {name}:', 'Tras revisar el aviso del comprador, hemos reembolsado el pedido n.º {order} ({title}):', '%message', 'Nos pondremos en contacto contigo para organizar la devolución del par.'],
  },

  /* ── Vault: problems and feedback ─────────────────────────────────── */
  problemReceived: {
    s: 'Hemos recibido tu aviso sobre el pedido n.º {order}',
    b: ['Hola, {name}:', 'Gracias por avisarnos. El vendedor no cobrará mientras un especialista de ShoeLab revisa el caso. Te responderemos en un plazo de un día laborable.', 'Tu aviso:', '%message'],
  },
  problemSeller: {
    s: 'El comprador ha comunicado un problema con el pedido n.º {order}',
    b: ['Hola, {name}:', 'El comprador de {title} ha comunicado un problema con la entrega. Tu cobro queda retenido mientras un especialista de ShoeLab revisa el caso. Nos pondremos en contacto contigo en breve.'],
  },
  disputeReleased: {
    s: 'Problema resuelto — cobro liberado',
    b: ['Hola, {name}:', 'Nuestro especialista ha cerrado el aviso sobre el pedido n.º {order}. Estamos liberando tu cobro de {payout}.', '%message'],
  },
  disputeClosed: {
    s: 'Tu aviso sobre el pedido n.º {order} está cerrado',
    b: ['Hola, {name}:', 'Nuestro especialista ha revisado tu aviso y lo ha cerrado.', '%message', '¿Tienes alguna pregunta? Responde a este correo.'],
  },
  feedbackNew: {
    s: 'Nueva valoración {rating}',
    b: ['Hola, {name}:', 'El comprador del pedido n.º {order} te ha dejado una valoración {rating}.', '%message'],
  },

  /* ── Vault: the lab ───────────────────────────────────────────────── */
  labArrived: {
    s: 'Tu par de {title} ha llegado al lab',
    b: ['Hola, {name}:', 'Tu par ya está en manos de nuestros especialistas. Te avisaremos del resultado.'],
  },
  labPassedBuyer: {
    s: 'Autenticado: {title}',
    b: ['Hola, {name}:', '¡Buenas noticias! Tu par ha superado nuestra autenticación en el lab. Ahora te lo enviamos.', '%message'],
  },
  labPassedSeller: {
    s: 'Autenticado: {title}',
    b: ['Hola, {name}:', 'Tu par ha superado la autenticación. Recibirás tu cobro de {payout} cuando llegue al comprador.'],
  },
  labFailedBuyer: {
    s: 'El pedido n.º {order} no ha superado la autenticación',
    b: ['Hola, {name}:', 'Nuestros especialistas no han podido autenticar este par, así que no te lo enviaremos. Te reembolsamos íntegramente tu pago de {amount}.'],
  },
  labFailedSeller: {
    s: 'Tu par de {title} no ha superado la autenticación',
    b: ['Hola, {name}:', 'Nuestros especialistas no han podido autenticar el par:', '%message', 'Nos pondremos en contacto contigo para devolvértelo.'],
  },
  labShipped: {
    s: 'Autenticado y en camino: {title}',
    b: ['Hola, {name}:', 'Tu par Lab Verified va de camino.', '%rows', 'Cuando llegue, confirma la entrega. Si algo no está bien, comunica el problema antes de confirmar.'],
    c: 'Confirmar entrega',
  },

  /* ── support ──────────────────────────────────────────────────────── */
  supportReceived: {
    s: 'Hemos recibido tu mensaje (n.º {ticket})',
    b: ['Hola, {name}:', 'Gracias por escribirnos. Un especialista de ShoeLab te responderá en un plazo de un día laborable, normalmente mucho antes. Si quieres añadir algo, responde a este correo.', 'Tu mensaje:', '%message'],
  },
  supportReply: {
    s: 'Re: tu solicitud n.º {ticket} a ShoeLab',
    b: ['Hola, {name}:', '%message', 'Si tienes más preguntas, responde a este correo.', '{team}'],
  },

  /* ── to the studio (written in the studio's language) ─────────────── */
  sBookingNew: {
    s: '{tag} {customer} — {when} — {service}',
    b: ['Nueva reserva {ref}.', '%rows', '%message', 'Responde a este correo para contactar directamente con el cliente.'],
  },
  sBookingPaid: {
    s: '[PAID] {customer} — {when} — {amount}',
    b: ['Pago recibido para la reserva {ref}. La cita está confirmada.', '%rows', 'Responde a este correo para contactar con el cliente.'],
  },
  sContact: {
    s: 'Formulario de contacto — {customer}',
    b: ['Un mensaje del formulario de contacto:', '%rows', '%message'],
  },
  sReview: {
    s: 'Nueva reseña pendiente de aprobación — {customer} ({rating}★)',
    b: ['{customer} ha dejado una reseña con {rating} de 5 estrellas:', '%message'],
  },
  sListingReview: {
    s: '[VAULT] Nuevo anuncio por revisar: {title}',
    b: ['Hay un anuncio nuevo pendiente de revisión.', '%rows'],
    c: 'Abrir la consola del lab',
  },
  sSale: {
    s: '[VAULT] Venta n.º {order}: {title} por {price}',
    b: ['Se ha vendido un par. Ahora el comprador tiene 72 horas para pagar.', '%rows'],
  },
  sPaymentNeeded: {
    s: '[VAULT] Hay que enviar los datos de pago del pedido n.º {order}',
    b: ['Los pagos con tarjeta no están activados, así que envía por correo a {buyerEmail} los datos para pagar {amount} ({title}). Cuando llegue el dinero, marca el pedido como pagado en la consola del lab.'],
    c: 'Abrir la consola del lab',
  },
  sIncoming: {
    s: '[VAULT] En camino al lab: pedido n.º {order}',
    b: ['Un par Lab Verified va de camino al lab.', '%rows'],
    c: 'Abrir la consola del lab',
  },
  sProblem: {
    s: '[VAULT] PROBLEMA comunicado en el pedido n.º {order}: {title}',
    b: ['Un comprador ha comunicado un problema. El cobro queda retenido hasta que lo liberes o reembolses al comprador.', '%rows', 'El comprador dice:', '%message'],
    c: 'Abrir la consola del lab',
  },
  sLabAddress: {
    s: '[VAULT] Envía la dirección del lab: pedido n.º {order}',
    b: ['El pedido n.º {order} ({title}) está pagado y el vendedor tiene que enviarlo al lab. La variable DROPOFF_ADDRESS no está definida, así que al vendedor se le ha dicho que recibirá la dirección por correo. Envíasela, por favor.', '%rows'],
  },
  sPayoutDue: {
    s: '[VAULT] COBRO pendiente: pedido n.º {order} — {payout}',
    b: ['El pedido n.º {order} ({title}) está entregado ({how}). Paga al vendedor por transferencia bancaria.', '%rows'],
  },
  sPayoutFailed: {
    s: '[VAULT] Ha fallado el cobro del pedido n.º {order}',
    b: ['Stripe no ha podido enviar el cobro del pedido n.º {order} ({title}). Puedes reintentarlo desde la consola del lab.', '%message'],
    c: 'Abrir la consola del lab',
  },
  sRefund: {
    s: '[VAULT] REEMBOLSO del pedido n.º {order}',
    b: ['Reembolsa manualmente {amount} a {buyerEmail}: este pedido no se pagó a través de Stripe.', '%message'],
  },
  sRefunded: {
    s: '[VAULT] Pedido n.º {order} reembolsado — {amount}',
    b: ['Stripe ha reembolsado {amount} al comprador del pedido n.º {order} ({title}). Si hace falta, organiza la devolución del par.', '%message'],
  },
  sRefundFailed: {
    s: '[VAULT] Ha fallado el reembolso del pedido n.º {order}',
    b: ['Stripe no ha podido reembolsar {amount} del pedido n.º {order} ({title}). Reembólsalo desde el panel de Stripe.', '%message'],
  },
  sSupport: {
    s: '[VAULT] Solicitud de soporte n.º {ticket}: {topic}',
    b: ['{customer} necesita a un especialista.', '%rows', 'Resumen:', '%message', '%transcript', 'Responde a este correo o contesta desde la consola del lab.'],
    c: 'Abrir la consola del lab',
  },
  sTest: {
    s: '[TEST] Prueba de correo de ShoeLab',
    b: ['Esto es una prueba enviada desde /api/health?testmail=1.', 'Si estás leyendo esto, los correos de la web llegan a {to}.'],
  },
};
