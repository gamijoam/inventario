using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Warranties;

public class WarrantyPolicy
{
    [JsonPropertyName("id")]          public int Id { get; set; }
    [JsonPropertyName("name")]        public string Name { get; set; } = "";
    [JsonPropertyName("type")]        public string Type { get; set; } = "";
    [JsonPropertyName("duration")]    public int? Duration { get; set; }
    [JsonPropertyName("description")] public string? Description { get; set; }
    [JsonPropertyName("is_active")]   public bool IsActive { get; set; } = true;
    [JsonPropertyName("is_default")]  public bool IsDefault { get; set; }
    [JsonPropertyName("tenant_id")]   public int TenantId { get; set; }
    [JsonPropertyName("created_at")]  public DateTime CreatedAt { get; set; }
    [JsonPropertyName("updated_at")]  public DateTime? UpdatedAt { get; set; }

    public string DurationDisplay => Type == "LIFETIME"
        ? "De por vida"
        : $"{Duration} {Type switch { "DAYS" => "dias", "MONTHS" => "meses", "YEARS" => "anos", _ => Type }}";

    public string ActiveDisplay => IsActive ? "Activa" : "Inactiva";
    public string ActiveColor   => IsActive ? "#059669" : "#94A3B8";
}

public class WarrantyClaim
{
    [JsonPropertyName("id")]               public int Id { get; set; }
    [JsonPropertyName("reason")]           public string Reason { get; set; } = "";
    [JsonPropertyName("status")]           public string Status { get; set; } = "PENDING";
    // Backend field is "claimed_at", not "created_at"
    [JsonPropertyName("claimed_at")]       public DateTime ClaimedAt { get; set; }
    [JsonPropertyName("resolved_at")]      public DateTime? ResolvedAt { get; set; }
    [JsonPropertyName("diagnosis")]        public string? Diagnosis { get; set; }
    [JsonPropertyName("resolution_type")]  public string? ResolutionType { get; set; }
    [JsonPropertyName("resolution_notes")] public string? ResolutionNotes { get; set; }
    [JsonPropertyName("sale_item_id")]     public int SaleItemId { get; set; }
    [JsonPropertyName("customer_id")]      public int CustomerId { get; set; }

    public string DateDisplay => ClaimedAt.ToString("dd/MM/yyyy");
    public string StatusDisplay => Status switch
    {
        "PENDING"   => "Pendiente",
        "APPROVED"  => "Aprobado",
        "REJECTED"  => "Rechazado",
        "COMPLETED" => "Completado",
        _           => Status
    };
    public string StatusColor => Status switch
    {
        "PENDING"   => "#D97706",
        "APPROVED"  => "#4F46E5",
        "COMPLETED" => "#059669",
        "REJECTED"  => "#DC2626",
        _           => "#94A3B8"
    };
}
