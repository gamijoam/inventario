using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Employees;

/// <summary>
/// Espejo de schemas.UserRead devuelto por GET /api/v1/users/
/// </summary>
public class Employee
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("username")]
    public string Username { get; set; } = "";

    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }

    [JsonPropertyName("role")]
    public string Role { get; set; } = "";

    [JsonPropertyName("is_active")]
    public bool IsActive { get; set; } = true;

    [JsonPropertyName("commission_percentage")]
    public decimal CommissionPercentage { get; set; }

    [JsonPropertyName("created_at")]
    public DateTime? CreatedAt { get; set; }

    // Propiedades de visualizacion
    public string DisplayName    => !string.IsNullOrWhiteSpace(FullName) ? FullName : Username;
    public string RoleDisplay    => Role switch
    {
        "ADMIN"    => "Administrador",
        "CASHIER"  => "Cajero",
        "MANAGER"  => "Gerente",
        _          => Role
    };
    public string StatusDisplay  => IsActive ? "Activo" : "Inactivo";
    public string StatusColor    => IsActive ? "#059669" : "#94A3B8";
    public string CommissionDisplay => $"{CommissionPercentage:F1}%";
    public bool IsSuperuser      => Role == "superadmin" || Role == "SUPERADMIN";
}

/// <summary>
/// Payload para POST /api/v1/users/ (crear nuevo empleado)
/// </summary>
public class CreateEmployeeRequest
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = "";

    [JsonPropertyName("password")]
    public string Password { get; set; } = "";

    [JsonPropertyName("email")]
    public string Email { get; set; } = "";

    [JsonPropertyName("full_name")]
    public string? FullName { get; set; }

    [JsonPropertyName("role")]
    public string Role { get; set; } = "CASHIER";

    [JsonPropertyName("commission_percentage")]
    public decimal CommissionPercentage { get; set; } = 0m;
}
