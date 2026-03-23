using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Reports;

/// <summary>
/// Espejo del objeto devuelto por GET /api/v1/reports/dashboard/financials.
/// Cada entrada en sales_by_currency tiene: currency, total_collected, count, returns.
/// </summary>
public class CurrencyStat
{
    [JsonPropertyName("currency")]        public string Currency { get; set; } = "";
    // El backend devuelve "total_collected" (neto: ventas - devoluciones)
    [JsonPropertyName("total_collected")] public decimal TotalCollected { get; set; }
    [JsonPropertyName("count")]           public int Count { get; set; }
    [JsonPropertyName("returns")]         public decimal Returns { get; set; }

    // Helper para mostrar en tabla
    public string CurrencyLabel => Currency switch
    {
        "USD" => "Dólares (USD)",
        "VES" => "Bolívares (VES)",
        "COP" => "Pesos (COP)",
        _     => Currency
    };
    public string CollectedDisplay => $"{TotalCollected:F2}";
    public string ReturnsDisplay   => Returns > 0 ? $"-{Returns:F2}" : "—";
}

public class DashboardStats
{
    [JsonPropertyName("sales_by_currency")]    public List<CurrencyStat> SalesByCurrency { get; set; } = new();
    [JsonPropertyName("total_sales_base_usd")] public decimal TotalSalesBaseUsd { get; set; }
    [JsonPropertyName("profit_estimated")]     public decimal ProfitEstimated { get; set; }

    // Propiedades calculadas para las tarjetas de métricas
    public int     TotalSales   => SalesByCurrency.Sum(s => s.Count);
    public decimal TotalRevenue => TotalSalesBaseUsd;
    public decimal GrossProfit  => ProfitEstimated;
    public decimal TotalCost    => TotalRevenue - GrossProfit;

    // Bolívares cobrados (para tarjeta "Ingresos Bs")
    public decimal TotalRevenueBs =>
        SalesByCurrency.FirstOrDefault(s => s.Currency == "VES")?.TotalCollected ?? 0;

    public bool HasData => SalesByCurrency.Count > 0 || TotalSalesBaseUsd > 0;
}
