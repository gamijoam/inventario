using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Reports;

public class CurrencyStat
{
    [JsonPropertyName("currency")]  public string Currency { get; set; } = "";
    [JsonPropertyName("collected")] public decimal Collected { get; set; }
    [JsonPropertyName("count")]     public int Count { get; set; }
}

public class DashboardStats
{
    [JsonPropertyName("sales_by_currency")]   public List<CurrencyStat> SalesByCurrency { get; set; } = new();
    [JsonPropertyName("total_sales_base_usd")] public decimal TotalSalesBaseUsd { get; set; }
    [JsonPropertyName("profit_estimated")]     public decimal ProfitEstimated { get; set; }

    // Computed helpers
    public int    TotalSales   => SalesByCurrency.Sum(s => s.Count);
    public decimal TotalRevenue => TotalSalesBaseUsd;
    public decimal GrossProfit  => ProfitEstimated;
    public decimal TotalCost    => TotalRevenue - GrossProfit;
    public decimal TotalRevenueBs => SalesByCurrency.FirstOrDefault(s => s.Currency == "VES")?.Collected ?? 0;
}
