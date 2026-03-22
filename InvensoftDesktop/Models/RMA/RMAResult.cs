using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.RMA;

public class RMACheckResult
{
    [JsonPropertyName("valid")]            public bool Valid { get; set; }
    [JsonPropertyName("message")]          public string Message { get; set; } = "";
    [JsonPropertyName("warranty_status")]  public string WarrantyStatus { get; set; } = "";
    [JsonPropertyName("days_elapsed")]     public int? DaysElapsed { get; set; }
    [JsonPropertyName("original_price")]   public decimal? OriginalPrice { get; set; }
    [JsonPropertyName("net_price")]        public decimal? NetPrice { get; set; }

    public string StatusDisplay => WarrantyStatus switch
    {
        "ACTIVE"    => "Garantía activa",
        "EXPIRED"   => "Garantía expirada",
        "NOT_FOUND" => "IMEI no encontrado",
        _           => WarrantyStatus
    };
    public string StatusColor => WarrantyStatus switch
    {
        "ACTIVE"  => "#059669",
        "EXPIRED" => "#D97706",
        _         => "#DC2626"
    };
    public string PriceDisplay => OriginalPrice.HasValue ? $"${OriginalPrice:F2}" : "—";
}
