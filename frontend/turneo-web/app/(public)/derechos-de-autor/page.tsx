// Versión vigente — mismo criterio que /terminos y /privacidad.
const COPYRIGHT_POLICY_VERSION = "2026-08-13";

export default function DerechosDeAutorPage() {
  return (
    <main className="min-h-screen bg-cream px-6 py-16 text-charcoal">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <span className="badge">Legal</span>
          <h1 className="text-4xl font-semibold text-charcoal">Derechos de Autor</h1>
          <p className="text-sm text-charcoal/50">Versión vigente: {COPYRIGHT_POLICY_VERSION}</p>
        </div>

        <div className="glass-card space-y-6 p-6 text-sm leading-relaxed text-charcoal/80 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-charcoal [&_h2]:mt-2">
          <p>
            Este sitio es operado por un negocio que usa la plataforma Turneo para
            publicar fotos, videos y contenido propio (galería de trabajos, contenido
            destacado, imágenes de servicios y profesionales). Si considerás que alguna
            imagen o video publicado infringe tus derechos de autor, podés notificarlo
            siguiendo el procedimiento de esta página.
          </p>

          <section>
            <h2>1. Cómo hacer una denuncia</h2>
            <p>
              Enviá una notificación por escrito a{" "}
              <strong>[COMPLETAR: email de contacto para reclamos de copyright]</strong>{" "}
              incluyendo:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>La URL exacta del contenido que consideras infractor (la imagen o el video, no solo la página).</li>
              <li>Una descripción de la obra original sobre la que reclamás derechos, y en lo posible un enlace o prueba de tu titularidad.</li>
              <li>Tus datos de contacto (nombre y email).</li>
              <li>
                Una declaración de que actuás de buena fe y que la información
                proporcionada es exacta.
              </li>
            </ul>
          </section>

          <section>
            <h2>2. Qué hacemos al recibir tu reclamo</h2>
            <p>
              Revisamos la notificación y, si corresponde, damos de baja el contenido
              reportado de forma expeditiva — tanto de la visualización pública como del
              almacenamiento donde está alojado el archivo. Podemos contactarte para
              pedir información adicional si el reclamo no está completo.
            </p>
          </section>

          <section>
            <h2>3. Contranotificación</h2>
            <p>
              Si sos el autor del contenido dado de baja y considerás que la baja fue un
              error (por ejemplo, porque tenés licencia para usar la obra), podés
              responder al mismo contacto explicando la situación. Evaluamos la
              contranotificación y, de corresponder, restablecemos el contenido.
            </p>
          </section>

          <section>
            <h2>4. Responsabilidad del negocio</h2>
            <p>
              Todo el contenido publicado en este sitio es cargado por el propio negocio,
              que declara ser titular de los derechos o contar con la licencia
              correspondiente para usarlo. Ante reclamos reiterados de copyright contra
              un mismo negocio, la plataforma se reserva el derecho de suspender su
              cuenta.
            </p>
          </section>

          <section>
            <h2>5. Marco legal</h2>
            <p>
              Este procedimiento sigue el espíritu del sistema de notificación y baja
              ("notice and takedown") reconocido internacionalmente en materia de
              derechos de autor en internet, y se aplica de buena fe con independencia de
              la jurisdicción del reclamante. No implica un reconocimiento de
              jurisdicción extranjera sobre el negocio ni sobre la plataforma.
            </p>
          </section>
        </div>

        <p className="text-xs text-charcoal/40">
          Texto modelo, pendiente de revisión por un profesional matriculado antes de su
          uso definitivo en producción. El contacto de la sección 1 debe completarse
          antes de publicar esta página.
        </p>

        <a href="/" className="text-sm font-medium text-blush hover:underline">
          ← Volver
        </a>
      </div>
    </main>
  );
}
