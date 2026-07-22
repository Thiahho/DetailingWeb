namespace Turneo.Api.Shared.Interfaces;

// Marca las entidades que pertenecen a un tenant. ApplicationDbContext.SaveChanges
// usa esto para completar TenantId automáticamente en cada inserción nueva, así
// ningún Controller/Service tiene que acordarse de setearlo a mano.
public interface ITenantScoped
{
    int TenantId { get; set; }
}
