namespace TTurnos.Api.SaaS.Tenants;

// Los tres modelos de negocio de TTurnos (ver roadmap de arquitectura).
// El mismo código sirve a los tres: License/Custom son, en la práctica,
// un Tenant único por deploy, sin necesidad de UI ni lógica separada.
public enum CommercialModel
{
    SaaS,
    License,
    Custom
}
