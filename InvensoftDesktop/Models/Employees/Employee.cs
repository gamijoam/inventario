using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Employees;

public class Employee
{
    [JsonPropertyName("id")]                        public int Id { get; set; }
    [JsonPropertyName("name")]                      public string Name { get; set; } = "";
    [JsonPropertyName("document_id")]               public string? DocumentId { get; set; }
    [JsonPropertyName("phone")]                     public string? Phone { get; set; }
    [JsonPropertyName("status")]                    public string Status { get; set; } = "ACTIVE";
    [JsonPropertyName("base_commission_percentage")] public decimal CommissionPct { get; set; }

    public bool IsActive           => Status == "ACTIVE";
    public string StatusDisplay    => IsActive ? "Activo" : "Inactivo";
    public string StatusColor      => IsActive ? "#059669" : "#94A3B8";
    public string CommissionDisplay => $"{CommissionPct:F1}%";
}
