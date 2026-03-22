using System.Text.Json.Serialization;

namespace InvensoftDesktop.Models.Products;

public class Product
{
    [JsonPropertyName("id")]
    public int Id { get; set; }

    [JsonPropertyName("name")]
    public string Name { get; set; } = "";

    [JsonPropertyName("sku")]
    public string? Sku { get; set; }

    [JsonPropertyName("barcode")]
    public string? Barcode { get; set; }

    [JsonPropertyName("price")]
    public decimal Price { get; set; }

    [JsonPropertyName("stock")]
    public decimal Stock { get; set; }

    [JsonPropertyName("category_name")]
    public string? CategoryName { get; set; }

    public string StockDisplay => Stock % 1 == 0
        ? ((int)Stock).ToString()
        : Stock.ToString("0.##");

    public string PriceDisplay => $"${Price:F2}";
}

public class ProductListResponse
{
    [JsonPropertyName("items")]
    public List<Product> Items { get; set; } = new();

    [JsonPropertyName("total")]
    public int Total { get; set; }

    [JsonPropertyName("page")]
    public int Page { get; set; }

    [JsonPropertyName("size")]
    public int Size { get; set; }
}
