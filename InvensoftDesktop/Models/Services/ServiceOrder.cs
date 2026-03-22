using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Services;

public class ServiceCustomerInfo
{
    [JsonPropertyName("id")]   public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
}

public class ServiceOrder
{
    [JsonPropertyName("id")]             public int Id { get; set; }
    [JsonPropertyName("ticket_number")]  public string TicketNumber { get; set; } = "";
    [JsonPropertyName("status")]         public string Status { get; set; } = "";
    [JsonPropertyName("service_type")]   public string ServiceType { get; set; } = "";
    [JsonPropertyName("device_type")]    public string? DeviceType { get; set; }
    [JsonPropertyName("brand")]          public string? Brand { get; set; }
    [JsonPropertyName("model")]          public string? Model { get; set; }
    [JsonPropertyName("problem_description")] public string? ProblemDescription { get; set; }
    [JsonPropertyName("priority")]       public string Priority { get; set; } = "NORMAL";
    [JsonPropertyName("created_at")]     public DateTime CreatedAt { get; set; }
    [JsonPropertyName("customer")]       public ServiceCustomerInfo? Customer { get; set; }

    public string CustomerName  => Customer?.Name ?? "—";
    public string DateDisplay   => CreatedAt.ToString("dd/MM/yyyy");
    public string DeviceDisplay => string.Join(" ", new[] { Brand, Model, DeviceType }.Where(s => !string.IsNullOrWhiteSpace(s)));

    public string StatusDisplay => Status switch
    {
        "RECEIVED"    => "Recibido",
        "IN_PROGRESS" => "En proceso",
        "READY"       => "Listo",
        "DELIVERED"   => "Entregado",
        _             => Status
    };
    public string StatusColor => Status switch
    {
        "RECEIVED"    => "#D97706",
        "IN_PROGRESS" => "#4F46E5",
        "READY"       => "#059669",
        "DELIVERED"   => "#94A3B8",
        _             => "#64748B"
    };
    public string ServiceTypeDisplay => ServiceType == "LAUNDRY" ? "Lavandería" : "Reparación";
    public string PriorityColor => Priority == "HIGH" ? "#DC2626" : (Priority == "URGENT" ? "#7C3AED" : "#64748B");
}

public class ServiceOrderListResponse
{
    [JsonPropertyName("items")] public List<ServiceOrder> Items { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
}

public class UpdateStatusRequest
{
    [JsonPropertyName("status")]           public string Status { get; set; } = "";
    [JsonPropertyName("diagnosis_notes")]  public string? DiagnosisNotes { get; set; }
}
