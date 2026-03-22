using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Inventory;

public class KardexProductInfo
{
    [JsonPropertyName("id")]   public int Id { get; set; }
    [JsonPropertyName("name")] public string Name { get; set; } = "";
    [JsonPropertyName("sku")]  public string? Sku { get; set; }
}

public class KardexEntry
{
    [JsonPropertyName("id")]             public int Id { get; set; }
    [JsonPropertyName("date")]           public DateTime Date { get; set; }
    [JsonPropertyName("movement_type")]  public string MovementType { get; set; } = "";
    [JsonPropertyName("quantity")]       public decimal Quantity { get; set; }
    [JsonPropertyName("balance_after")]  public decimal BalanceAfter { get; set; }
    [JsonPropertyName("description")]    public string? Description { get; set; }
    [JsonPropertyName("product")]        public KardexProductInfo? Product { get; set; }

    public string ProductName => Product?.Name ?? "—";
    public string DateDisplay  => Date.ToString("dd/MM/yyyy HH:mm");
    public string QtyDisplay   => Quantity % 1 == 0 ? ((int)Quantity).ToString() : Quantity.ToString("0.##");
    public string BalanceDisplay => BalanceAfter % 1 == 0 ? ((int)BalanceAfter).ToString() : BalanceAfter.ToString("0.##");

    public string TypeDisplay => MovementType switch
    {
        "SALE"                  => "Venta",
        "PURCHASE"              => "Compra",
        "ADJUSTMENT_IN"         => "Ajuste +"  ,
        "ADJUSTMENT_OUT"        => "Ajuste -",
        "TRANSFER_IN"           => "Traslado ent.",
        "TRANSFER_OUT"          => "Traslado sal.",
        "EXTERNAL_TRANSFER_IN"  => "Traslado externo",
        "RETURN"                => "Devolución",
        "DAMAGED"               => "Dañado",
        "INTERNAL_USE"          => "Uso interno",
        _                       => MovementType
    };
    public string TypeColor => MovementType.Contains("IN") || MovementType is "PURCHASE" or "RETURN"
        ? "#059669"
        : "#DC2626";

    public bool IsIncoming => Quantity > 0;
}

public class KardexListResponse
{
    [JsonPropertyName("items")] public List<KardexEntry> Items { get; set; } = new();
    [JsonPropertyName("total")] public int Total { get; set; }
}
