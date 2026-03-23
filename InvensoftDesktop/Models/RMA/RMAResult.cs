using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.RMA;

public class RMACheckResult
{
    [JsonPropertyName("valid")]             public bool Valid { get; set; }
    [JsonPropertyName("message")]           public string Message { get; set; } = "";
    [JsonPropertyName("warranty_status")]   public string WarrantyStatus { get; set; } = "";
    [JsonPropertyName("days_elapsed")]      public int? DaysElapsed { get; set; }
    [JsonPropertyName("original_price")]    public decimal? OriginalPrice { get; set; }
    [JsonPropertyName("net_price")]         public decimal? NetPrice { get; set; }
    [JsonPropertyName("customer_name")]     public string? CustomerName { get; set; }
    [JsonPropertyName("product_name")]      public string? ProductName { get; set; }
    [JsonPropertyName("sale_date")]         public DateTime? SaleDate { get; set; }
    [JsonPropertyName("original_currency")] public string? OriginalCurrency { get; set; }

    public string StatusDisplay => WarrantyStatus switch
    {
        "ACTIVE"    => "Garantia activa",
        "EXPIRED"   => "Garantia expirada",
        "NOT_FOUND" => "IMEI no encontrado",
        _           => WarrantyStatus
    };
    public string StatusColor => WarrantyStatus switch
    {
        "ACTIVE"  => "#059669",
        "EXPIRED" => "#D97706",
        _         => "#DC2626"
    };
    public string PriceDisplay    => OriginalPrice.HasValue ? $"${OriginalPrice:F2}" : "—";
    public string SaleDateDisplay => SaleDate.HasValue ? SaleDate.Value.ToString("dd/MM/yyyy") : "—";
    public string DaysDisplay     => DaysElapsed.HasValue ? DaysElapsed.Value.ToString() : "—";
}
