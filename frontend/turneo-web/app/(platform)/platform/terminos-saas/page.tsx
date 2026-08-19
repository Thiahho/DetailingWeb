// Versión vigente — debe coincidir con LegalTermsVersions.Saas en el
// backend (backend/Turneo.Api/Shared/Constants/LegalTermsVersions.cs).
const TERMS_VERSION = "2026-08-13";

export default function TerminosSaasPage() {
  return (
    <main className="min-h-screen bg-charcoal px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Legal</span>
          <h1 className="text-4xl font-semibold">Términos del Servicio SaaS</h1>
          <p className="text-sm text-white/40">Versión vigente: {TERMS_VERSION}</p>
        </div>

        <div className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm leading-relaxed text-white/80 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-white [&_h2]:mt-2">
          <p>
            Este documento regula la relación contractual entre la plataforma (el
            &quot;Proveedor&quot;) y el negocio que contrata el servicio de gestión de
            turnos, agenda y clientes (el &quot;Titular&quot;). Al aceptar este documento
            al momento del alta, el Titular declara haberlo leído y aceptado en su
            totalidad.
          </p>

          <section>
            <h2>1. Objeto del contrato</h2>
            <p>
              El Proveedor otorga al Titular una licencia de uso, no exclusiva e
              intransferible, del software de gestión de turnos (el &quot;Software&quot;)
              bajo la modalidad y el plan comercial acordados. El Titular es responsable
              de la configuración de su negocio dentro del Software y de la relación con
              sus propios clientes finales.
            </p>
          </section>

          <section>
            <h2>2. Datos y aislamiento</h2>
            <p>
              Los datos que el Titular carga en el Software (clientes, turnos, caja,
              estadísticas) pertenecen al Titular. El Proveedor implementa aislamiento
              técnico de datos entre negocios (multi-tenant) y se compromete a no acceder
              a esos datos salvo para soporte técnico solicitado por el Titular o
              obligación legal.
            </p>
          </section>

          <section>
            <h2>3. Plan comercial, pagos y disponibilidad</h2>
            <p>
              El Titular abona el plan contratado según la periodicidad acordada. La
              falta de pago puede resultar en la suspensión del acceso al Software. El
              Proveedor procura una disponibilidad razonable del servicio, sin garantizar
              disponibilidad ininterrumpida (mantenimientos programados, incidentes de
              terceros proveedores de infraestructura, etc.).
            </p>
          </section>

          <section>
            <h2>4. Baja del servicio</h2>
            <p>
              El Titular puede solicitar la baja del servicio en cualquier momento. El
              Proveedor conservará una copia de los datos por un plazo razonable tras la
              baja, a los fines de permitir su exportación, y luego procederá a su
              eliminación.
            </p>
          </section>

          <section>
            <h2>5. Cláusula de arbitraje</h2>
            <p>
              Toda controversia, disputa o reclamo que surja de este contrato o que se
              relacione con él, incluyendo su existencia, validez, interpretación,
              alcance o incumplimiento, será resuelto de forma definitiva mediante
              arbitraje, con exclusión de la vía judicial ordinaria, ante un tribunal
              arbitral que se constituirá conforme al reglamento del centro de arbitraje
              que las partes acuerden al momento de la controversia, o en su defecto el
              de la jurisdicción del domicilio del Proveedor. El laudo arbitral será
              definitivo y vinculante para ambas partes.
            </p>
            <p>
              Esta cláusula rige exclusivamente la relación comercial B2B entre el
              Proveedor y el Titular como contratante del Servicio SaaS. No aplica ni
              afecta de ningún modo los derechos de los clientes finales del Titular como
              consumidores, que se rigen por los Términos y Condiciones de reserva
              publicados en el sitio del Titular.
            </p>
          </section>

          <section>
            <h2>6. Contenido subido por el Titular</h2>
            <p>
              El Titular es el único responsable del contenido que carga en el Software
              (fotos, videos, logo, imágenes de servicios y profesionales) y declara ser
              titular de los derechos de autor sobre ese contenido o contar con la
              licencia necesaria para publicarlo. El Titular indemnizará y mantendrá
              indemne al Proveedor frente a cualquier reclamo, multa o gasto (incluyendo
              honorarios legales razonables) que surja de una denuncia de terceros por
              infracción de derechos de autor, marca u otro derecho de propiedad
              intelectual sobre contenido cargado por el Titular.
            </p>
            <p>
              El Proveedor podrá dar de baja, sin necesidad de autorización previa del
              Titular, cualquier contenido que reciba una notificación de infracción de
              derechos de autor válida (ver la política de{" "}
              <a href="/derechos-de-autor" className="font-medium text-white hover:underline">
                Derechos de Autor
              </a>
              ), y podrá suspender la cuenta del Titular ante reclamos reiterados.
            </p>
          </section>

          <section>
            <h2>7. Modificaciones</h2>
            <p>
              El Proveedor puede actualizar este documento. Los cambios sustanciales se
              comunicarán al Titular con antelación razonable por los medios de contacto
              provistos al momento del alta.
            </p>
          </section>
        </div>

        <p className="text-xs text-white/30">
          Texto modelo, pendiente de revisión por un profesional matriculado antes de su
          uso definitivo en producción.
        </p>
      </div>
    </main>
  );
}
