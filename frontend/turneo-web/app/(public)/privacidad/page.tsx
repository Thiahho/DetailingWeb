// Versión vigente — subir junto con LegalTermsVersions.Customer en el backend
// cada vez que cambie el texto (mismo criterio que /terminos).
const PRIVACY_VERSION = "2026-09-02";

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-16 text-charcoal">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <span className="badge">Legal</span>
          <h1 className="text-4xl font-semibold text-charcoal">Política de Privacidad</h1>
          <p className="text-sm text-charcoal/50">Versión vigente: {PRIVACY_VERSION}</p>
        </div>

        <div className="glass-card space-y-6 p-6 text-sm leading-relaxed text-charcoal/80 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-charcoal [&_h2]:mt-2">
          <p>
            Esta página explica qué datos personales recopila el sistema de reserva de
            turnos online del negocio, para qué se usan, con quién se comparten y qué
            derechos tenés sobre ellos, conforme a la Ley N.º 25.326 de Protección de
            Datos Personales de Argentina.
          </p>

          <section>
            <h2>1. Datos que recopilamos</h2>
            <p>Al reservar un turno recopilamos:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Nombre, teléfono y (opcionalmente) email.</li>
              <li>El servicio elegido y cualquier comentario o consulta adicional que escribas.</li>
              <li>
                Campos adicionales que el negocio puede configurar por servicio (por
                ejemplo, preferencias o datos específicos del tratamiento) — varían según
                el servicio y el negocio.
              </li>
            </ul>
            <p>
              Si el negocio te da de alta como cliente en su ficha interna (CRM), también
              puede guardar: cumpleaños, Instagram, notas internas del profesional
              (preferencias, tratamientos anteriores) y fotos asociadas a tus turnos
              (por ejemplo, antes/después de un tratamiento).
            </p>
            <p>
              Si accedés al portal de &quot;Mis turnos&quot; con código de un solo uso, guardamos
              temporalmente ese código (nunca en texto plano) y su fecha de expiración.
            </p>
            <p>
              Si pagás tu turno online, el pago se procesa enteramente en la pasarela de
              MercadoPago — nosotros nunca recibimos ni almacenamos el número de tarjeta.
              Guardamos solo metadatos de la transacción (monto, estado, método de pago,
              email del pagador e identificadores internos de MercadoPago) para poder
              conciliar el cobro con tu turno.
            </p>
          </section>

          <section>
            <h2>2. Para qué usamos estos datos</h2>
            <ul className="list-disc space-y-1 pl-5">
              <li>Gestionar tu reserva y contactarte por confirmaciones, recordatorios o cambios.</li>
              <li>Llevar el historial de servicios que el negocio te prestó, si sos cliente habitual.</li>
              <li>Estadísticas internas del negocio (agregadas, no identifican a un cliente individual fuera del propio panel del negocio).</li>
            </ul>
            <p>
              No usamos tus datos con fines publicitarios propios ni los vendemos a
              terceros. Este sitio no utiliza píxeles de seguimiento publicitario de
              terceros (Meta Pixel u otros) ni comparte datos de navegación con redes de
              publicidad.
            </p>
          </section>

          <section>
            <h2>3. Cookies y almacenamiento local</h2>
            <p>
              Al entrar por primera vez te preguntamos qué categorías de cookies aceptás.
              Podés cambiar tu decisión cuando quieras desde el botón &quot;Preferencias de
              cookies&quot; al pie de la página.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Necesarias</strong> (siempre activas) — mantienen tu sesión
                iniciada en el portal de clientes o en el panel del negocio, y una cookie
                técnica (<code>turneo_consent</code>, 180 días) que guarda tu propia
                decisión sobre cookies. No rastrean tu navegación fuera de este sitio.
              </li>
              <li>
                <strong>Preferencias</strong> (opcional) — si las aceptás, guardamos en tu
                navegador (almacenamiento local, no en un servidor) una copia del catálogo
                de servicios, galería y datos públicos del negocio, para que la página
                cargue más rápido en tu próxima visita. No incluye datos personales tuyos.
              </li>
              <li>
                <strong>Analítica</strong> (opcional) — categoría declarada para uso
                futuro; hoy este sitio no tiene ninguna herramienta de analítica ni de
                seguimiento activa.
              </li>
            </ul>
            <p>
              No usamos cookies ni tecnologías de seguimiento publicitario de terceros
              (Google Analytics, Meta Pixel u otros).
            </p>
          </section>

          <section>
            <h2>4. Con quién compartimos tus datos</h2>
            <p>
              Para poder prestar el servicio, algunos datos se envían a proveedores que
              actúan como encargados del tratamiento por nuestra cuenta:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong>MercadoPago</strong> — procesamiento de pagos, si el negocio ofrece pago online.</li>
              <li><strong>Meta (WhatsApp Business)</strong> — envío de confirmaciones y recordatorios de turno por WhatsApp, cuando el negocio tiene ese canal activado.</li>
              <li><strong>Proveedor de email</strong> (Gmail u otro configurado por el negocio) — envío de confirmaciones y recordatorios por correo.</li>
              <li><strong>Cloudinary</strong> — alojamiento de fotos (galería del negocio, fotos antes/después) cuando el negocio las utiliza.</li>
              <li>
                <strong>OpenAI</strong> — cuando el negocio tiene activados los recordatorios
                generados con inteligencia artificial, se envían tu nombre, el servicio
                reservado, la fecha/hora del turno y la ubicación del negocio para redactar
                el mensaje del recordatorio.
              </li>
            </ul>
            <p>
              Algunos de estos proveedores procesan datos fuera de Argentina (por ejemplo,
              en Estados Unidos). Al usar el servicio, aceptás esta transferencia
              internacional de datos, necesaria para el funcionamiento del sistema.
            </p>
            <p>
              No compartimos tus datos con otros negocios: el sistema aísla técnicamente
              la información de cada negocio, y tus datos solo son visibles para el
              negocio con el que reservaste el turno.
            </p>
          </section>

          <section>
            <h2>5. Seguridad</h2>
            <p>
              Las contraseñas de las cuentas del sistema se almacenan siempre encriptadas
              (nunca en texto plano). El acceso al panel de administración del negocio
              usa sesiones con cookies seguras, no visibles ni accesibles por scripts del
              navegador.
            </p>
          </section>

          <section>
            <h2>6. Tus derechos</h2>
            <p>
              Conforme a la Ley N.º 25.326, tenés derecho de acceso, rectificación y
              supresión de tus datos personales. Para pedir la supresión de tus datos,
              podés completar el{" "}
              <a href="/privacidad/solicitar-borrado" className="font-medium text-blush hover:underline">
                formulario de solicitud de borrado
              </a>
              . El negocio revisa y confirma el pedido manualmente; una vez confirmado, tu
              nombre, teléfono y email se reemplazan por datos anónimos en el sistema (el
              registro del turno en sí se conserva, sin datos que te identifiquen). La
              Agencia de Acceso a la Información Pública, como órgano de control de la Ley
              N.º 25.326, tiene la atribución de atender denuncias y reclamos que se
              interpongan en relación al incumplimiento de las normas sobre protección de
              datos personales.
            </p>
          </section>

          <section>
            <h2>7. Modificaciones</h2>
            <p>
              Esta política puede actualizarse. La versión vigente es la publicada en esta
              página.
            </p>
          </section>
        </div>

        <p className="text-xs text-charcoal/40">
          Texto modelo, pendiente de revisión por un profesional matriculado antes de su
          uso definitivo en producción.
        </p>

        <a href="/" className="text-sm font-medium text-blush hover:underline">
          ← Volver
        </a>
      </div>
    </main>
  );
}
