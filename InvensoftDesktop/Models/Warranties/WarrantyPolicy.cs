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

    public string DurationDisplay => Type == "LIFETIME"
        ? "De por vida"
        : $"{Duration} {Type switch { "DAYS" => "días", "MONTHS" => "meses", "YEARS" => "años", _ => Type }}";

    public string ActiveDisplay => IsActive ? "Activa" : "Inactiva";
    public string ActiveColor   => IsActive ? "#059669" : "#94A3B8";
}

public class WarrantyClaim
{
    [JsonPropertyName("id")]          public int Id { get; set; }
    [JsonPropertyName("reason")]      public string Reason { get; set; } = "";
    [JsonPropertyName("status")]      public string Status { get; set; } = "PENDING";
    [JsonPropertyName("created_at")]  public DateTime CreatedAt { get; set; }

    public string DateDisplay => CreatedAt.ToString("dd/MM/yyyy");
    public string StatusDisplay => Status == "PENDING" ? "Pendiente" : "Resuelto";
    public string StatusColor   => Status == "PENDING" ? "#D97706" : "#059669";
}
