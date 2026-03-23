using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Returns;

public class SaleSearchResult
{
    [JsonPropertyName("id")]             public int Id { get; set; }
    // Backend SaleRead uses "date", not "sale_date"
    [JsonPropertyName("date")]           public DateTime SaleDate { get; set; }
    [JsonPropertyName("total_amount")]   public decimal TotalAmount { get; set; }
    [JsonPropertyName("payment_method")] public string PaymentMethod { get; set; } = "";
    [JsonPropertyName("cashier_name")]   public string? CashierName { get; set; }
    [JsonPropertyName("customer")]       public SaleSearchCustomer? Customer { get; set; }

    public string DateDisplay  => SaleDate.ToString("dd/MM/yyyy HH:mm");
    public string TotalDisplay => $"${TotalAmount:F2}";
    public string CustomerDisplay => Customer?.Name ?? "Contado";
}

public class SaleSearchCustomer
{
    [JsonPropertyName("id")]   public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
}

public class SaleSearchResponse
{
    [JsonPropertyName("items")] public List<SaleSearchResult> Items { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
}

public class ReturnRecord
{
    [JsonPropertyName("id")]             public int Id { get; set; }
    [JsonPropertyName("sale_id")]        public int SaleId { get; set; }
    [JsonPropertyName("date")]           public DateTime Date { get; set; }
    [JsonPropertyName("total_refunded")] public decimal TotalRefunded { get; set; }
    [JsonPropertyName("reason")]         public string? Reason { get; set; }

    public string DateDisplay    => Date.ToString("dd/MM/yyyy");
    public string RefundDisplay  => $"${TotalRefunded:F2}";
    public string ReasonDisplay  => string.IsNullOrWhiteSpace(Reason) ? "Sin motivo" : Reason;
}

public class ReturnListResponse
{
    [JsonPropertyName("items")] public List<ReturnRecord> Items { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
}
