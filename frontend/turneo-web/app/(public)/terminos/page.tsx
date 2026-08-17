import Link from "next/link";

// Versión vigente — debe coincidir con LegalTermsVersions.Customer en el
// backend (backend/Turneo.Api/Shared/Constants/LegalTermsVersions.cs).
const TERMS_VERSION = "2026-08-15";

export default function TerminosPage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-16 text-charcoal">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <span className="badge">Legal</span>
          <h1 className="text-4xl font-semibold text-charcoal">Términos y Condiciones</h1>
          <p className="text-sm text-charcoal/50">Versión vigente: {TERMS_VERSION}</p>
        </div>

        <div className="glass-card space-y-6 p-6 text-sm leading-relaxed text-charcoal/80 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-charcoal [&_h2]:mt-2">
          <p>
            Este documento regula el uso del sistema de reserva de turnos online (el
            &quot;Servicio&quot;) que el negocio pone a disposición de sus clientes. Al
            marcar la casilla de aceptación y confirmar una reserva, el cliente declara
            haber leído y aceptado estos términos.
          </p>

          <section>
            <h2>1. Objeto</h2>
            <p>
              El Servicio permite a los clientes del negocio consultar disponibilidad y
              reservar turnos de forma online. El negocio es el responsable de prestar el
              servicio reservado (el turno en sí); la plataforma tecnológica utilizada
              actúa únicamente como intermediaria para la gestión de la agenda.
            </p>
          </section>

          <section>
            <h2>2. Datos personales</h2>
            <p>
              Los datos que el cliente proporciona al reservar (nombre, teléfono, email y
              cualquier dato adicional del formulario) se utilizan exclusivamente para
              gestionar el turno, contactar al cliente por confirmaciones o recordatorios,
              y para las estadísticas internas del negocio. Para el detalle completo de
              qué datos se recopilan, con qué proveedores se comparten y cómo ejercer tus
              derechos, ver la{" "}
              <Link href="/privacidad" className="font-medium text-blush hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
          </section>

          <section>
            <h2>3. Comunicaciones automatizadas y uso de inteligencia artificial</h2>
            <p>
              Algunos recordatorios de turno que recibís por email o WhatsApp pueden estar
              redactados con asistencia de inteligencia artificial (a partir de los datos
              de tu reserva: nombre, servicio, fecha, hora y lugar), en reemplazo de un
              mensaje de plantilla fija. Cuando esto ocurre, el propio mensaje lo indica
              expresamente. El uso de IA se limita a la redacción de ese texto: no toma
              decisiones sobre tu reserva ni reemplaza el contacto humano del negocio. Para
              más detalle sobre qué datos se comparten con el proveedor de IA, ver la{" "}
              <Link href="/privacidad" className="font-medium text-blush hover:underline">
                Política de Privacidad
              </Link>
              .
            </p>
          </section>

          <section>
            <h2>4. Cancelaciones y reprogramaciones</h2>
            <p>
              El cliente puede cancelar o reprogramar su turno contactando directamente al
              negocio con la anticipación que este indique. El negocio se reserva el
              derecho de cancelar o reprogramar turnos por causas de fuerza mayor,
              notificando al cliente por los medios de contacto provistos.
            </p>
          </section>

          <section>
            <h2>5. Responsabilidad</h2>
            <p>
              El negocio es el único responsable por la calidad, ejecución y resultado del
              servicio prestado durante el turno reservado. La plataforma tecnológica no
              interviene en la prestación del servicio y no asume responsabilidad por
              disputas relativas a este.
            </p>
          </section>

          <section>
            <h2>6. Resolución de conflictos y jurisdicción</h2>
            <p>
              Para cualquier controversia derivada de la relación de consumo entre el
              cliente y el negocio, el cliente podrá optar, a su elección, por la vía
              administrativa ante los organismos de defensa del consumidor o por la vía
              judicial ante los tribunales ordinarios correspondientes al domicilio del
              consumidor, de conformidad con lo dispuesto por la Ley N.º 24.240 de Defensa
              del Consumidor y el Código Civil y Comercial de la Nación. Este documento no
              establece arbitraje obligatorio ni renuncia alguna al fuero del consumidor.
            </p>
          </section>

          <section>
            <h2>7. Modificaciones</h2>
            <p>
              Estos términos pueden actualizarse. La versión vigente es la publicada en
              esta página al momento de confirmar la reserva.
            </p>
          </section>
        </div>

        <p className="text-xs text-charcoal/40">
          Texto modelo, pendiente de revisión por un profesional matriculado antes de su
          uso definitivo en producción.
        </p>

        <Link href="/" className="text-sm font-medium text-blush hover:underline">
          ← Volver
        </Link>
      </div>
    </main>
  );
}
