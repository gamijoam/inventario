using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Reports;

public class DashboardStats
{
    [JsonPropertyName("total_revenue")]
    public decimal TotalRevenue { get; set; }

    [JsonPropertyName("total_sales")]
    public int TotalSales { get; set; }

    [JsonPropertyName("total_cost")]
    public decimal TotalCost { get; set; }

    [JsonPropertyName("gross_profit")]
    public decimal GrossProfit { get; set; }

    [JsonPropertyName("total_revenue_bs")]
    public decimal TotalRevenueBs { get; set; }

    [JsonPropertyName("period")]
    public string Period { get; set; } = "today";
}
