using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Quotes;

public class QuoteCustomerInfo
{
    [JsonPropertyName("id")]   public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
}

public class Quote
{
    [JsonPropertyName("id")]           public int Id { get; set; }
    [JsonPropertyName("date")]         public DateTime Date { get; set; }
    [JsonPropertyName("total_amount")] public decimal TotalAmount { get; set; }
    [JsonPropertyName("notes")]        public string? Notes { get; set; }
    [JsonPropertyName("status")]       public string Status { get; set; } = "PENDING";
    [JsonPropertyName("customer")]     public QuoteCustomerInfo? Customer { get; set; }

    public string CustomerName  => Customer?.Name ?? "Contado";
    public string DateDisplay   => Date.ToString("dd/MM/yyyy");
    public string TotalDisplay  => $"${TotalAmount:F2}";

    public string StatusDisplay => Status switch
    {
        "PENDING"   => "Pendiente",
        "CONVERTED" => "Convertida",
        "EXPIRED"   => "Expirada",
        _           => Status
    };
    public string StatusColor => Status switch
    {
        "PENDING"   => "#D97706",
        "CONVERTED" => "#059669",
        "EXPIRED"   => "#94A3B8",
        _           => "#64748B"
    };
}

public class QuoteListResponse
{
    [JsonPropertyName("items")]    public List<Quote> Items { get; set; } = new();
    [JsonPropertyName("total")]    public int Total { get; set; }
    [JsonPropertyName("has_more")] public bool HasMore { get; set; }
}
