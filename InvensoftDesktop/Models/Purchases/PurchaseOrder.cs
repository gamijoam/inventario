using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Purchases;

public class SupplierInfo
{
    [JsonPropertyName("id")]   public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
}

public class PurchaseOrder
{
    [JsonPropertyName("id")]             public int Id { get; set; }
    [JsonPropertyName("purchase_date")]  public DateTime PurchaseDate { get; set; }
    [JsonPropertyName("invoice_number")] public string? InvoiceNumber { get; set; }
    [JsonPropertyName("total_amount")]   public decimal TotalAmount { get; set; }
    [JsonPropertyName("paid_amount")]    public decimal PaidAmount { get; set; }
    [JsonPropertyName("payment_status")] public string PaymentStatus { get; set; } = "";
    [JsonPropertyName("supplier")]       public SupplierInfo? Supplier { get; set; }

    public string SupplierName => Supplier?.Name ?? "—";
    public string TotalDisplay  => $"${TotalAmount:F2}";
    public string PaidDisplay   => $"${PaidAmount:F2}";
    public decimal PendingAmount => TotalAmount - PaidAmount;
    public string PendingDisplay => $"${PendingAmount:F2}";

    public string StatusDisplay => PaymentStatus switch
    {
        "PAID"    => "Pagado",
        "PARTIAL" => "Parcial",
        "PENDING" => "Pendiente",
        _         => PaymentStatus
    };
    public string StatusColor => PaymentStatus switch
    {
        "PAID"    => "#059669",
        "PARTIAL" => "#D97706",
        "PENDING" => "#DC2626",
        _         => "#64748B"
    };
    public string DateDisplay => PurchaseDate.ToString("dd/MM/yyyy");
}

public class PurchaseListResponse
{
    [JsonPropertyName("items")] public List<PurchaseOrder> Items { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
}
